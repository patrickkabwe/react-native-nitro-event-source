#include "HybridNitroEventSource.hpp"

#include <curl/curl.h>

#include <algorithm>
#include <chrono>
#include <iostream>
#include <utility>

namespace margelo::nitro::nitroeventsource::curl_utils
{

int
progress_callback(void* userdata, curl_off_t, curl_off_t, curl_off_t, curl_off_t) noexcept
{
  if (!userdata)
    return 1;

  const auto* self = static_cast<const HybridNitroEventSource*>(userdata);
  return (self->_running.load() && !self->_closed.load()) ? 0 : 1;
}

size_t
write_callback(char* ptr, size_t size, size_t nmemb, void* userdata) noexcept
{
  const size_t total_bytes = size * nmemb;

  if (!ptr || !userdata || total_bytes == 0)
  {
    return 0;
  }

  auto* self = static_cast<HybridNitroEventSource*>(userdata);

  if (!self->_running.load() || self->_closed.load())
  {
    return 0;
  }

  bool expected = false;
  if (self->_open_event_sent.compare_exchange_strong(expected, true))
  {
    if (!self->_closed.load())
    {
      const NitroEventSourceEvent open_event(self->_last_event_id, "open", "");
      self->dispatch_event(open_event);
    }
  }

  if (!self->_closed.load())
  {
    self->parse_sse_chunk(std::string_view(ptr, total_bytes));
  }

  return total_bytes;
}
} // namespace margelo::nitro::nitroeventsource::curl_utils

namespace margelo::nitro::nitroeventsource
{

std::shared_ptr<HybridNitroEventSourceSpec>
HybridNitroEventSource::create(const std::string&                            url,
                               const std::optional<NitroEventSourceOptions>& options)
{
  auto instance      = std::make_shared<HybridNitroEventSource>();
  instance->_url     = url;
  instance->_options = options;

  try
  {
    instance->_curl_thread = std::thread(
        [weak_instance = std::weak_ptr<HybridNitroEventSource>(instance)]() noexcept
        {
          if (auto instance = weak_instance.lock())
          {
            instance->connect();
          }
        });
  }
  catch (const std::system_error& e)
  {
    instance->log("Failed to create connection thread: " + std::string(e.what()));
    throw;
  }

  return instance;
}

HybridNitroEventSource::~HybridNitroEventSource()
{
  close();
}

void
HybridNitroEventSource::close()
{
  if (_closed.exchange(true))
  {
    log("EventSource already closed, skipping...");
    return;
  }

  log("Closing EventSource...");

  _running.store(false);
  _should_retry.store(false);

  {
    const std::lock_guard<std::mutex> callback_lock(_callback_mutex);
    _event_callback = nullptr;
  }

  {
    const std::lock_guard<std::mutex> listeners_lock(_listeners_mutex);
    _event_listeners.clear();
  }

  if (_curl_thread.joinable())
  {
    try
    {
      _curl_thread.join();
      log("Connection thread terminated");
    }
    catch (const std::system_error& e)
    {
      log("Error joining thread: " + std::string(e.what()));
    }
  }

  {
    const std::lock_guard<std::mutex> buffer_lock(_buffer_mutex);
    _buffer.clear();
    _event_type.clear();
    _event_data.clear();
  }

  log("EventSource closed successfully");
}

void
HybridNitroEventSource::setEventCallback(
    const std::function<void(const NitroEventSourceEvent&)>& callback)
{
  const std::lock_guard<std::mutex> lock(_callback_mutex);
  _event_callback = callback;
}

void
HybridNitroEventSource::addEventListener(
    const std::string& type, const std::function<void(const NitroEventSourceEvent&)>& listener)
{
  if (_closed.load())
  {
    log("Cannot add listener to closed EventSource");
    return;
  }

  const std::lock_guard<std::mutex> lock(_listeners_mutex);
  _event_listeners[type].emplace_back(listener);
}

void
HybridNitroEventSource::removeEventListener(
    const std::string& type,
    const std::function<void(const NitroEventSourceEvent&)>& /* listener */)
{
  const std::lock_guard<std::mutex> lock(_listeners_mutex);

  const auto it = _event_listeners.find(type);
  if (it == _event_listeners.end())
  {
    return;
  }

  auto& listeners = it->second;

  // Since std::function objects can't be reliably compared,
  // remove the most recently added listener for this type (LIFO)
  // This provides predictable behavior for the JavaScript wrapper
  if (!listeners.empty())
  {
    listeners.pop_back();

    // Remove empty entries to prevent memory bloat
    if (listeners.empty())
    {
      _event_listeners.erase(it);
    }
  }
}

void
HybridNitroEventSource::dispatch_event(const NitroEventSourceEvent& event) noexcept
{
  if (_closed.load())
  {
    return;
  }

  // Dispatch to single event callback (legacy onmessage/onerror/onopen)
  {
    const std::lock_guard<std::mutex> lock(_callback_mutex);
    if (_event_callback)
    {
      try
      {
        _event_callback(event);
      }
      catch (const std::exception& e)
      {
        log("Exception in event callback: " + std::string(e.what()));
      }
      catch (...)
      {
        log("Unknown exception in event callback");
      }
    }
  }

  // Dispatch to event-specific listeners (addEventListener)
  // Copy listeners to avoid holding lock during callback execution
  std::vector<std::function<void(const NitroEventSourceEvent&)>> listeners_copy;
  {
    const std::lock_guard<std::mutex> lock(_listeners_mutex);
    const auto                        it = _event_listeners.find(event.type);
    if (it != _event_listeners.end())
    {
      listeners_copy = it->second;
    }
  }

  for (const auto& listener : listeners_copy)
  {
    if (_closed.load())
      break;

    try
    {
      listener(event);
    }
    catch (const std::exception& e)
    {
      log("Exception in event listener [" + event.type + "]: " + std::string(e.what()));
    }
    catch (...)
    {
      log("Unknown exception in event listener [" + event.type + "]");
    }
  }
}

void
HybridNitroEventSource::connect() noexcept
{
  constexpr auto RECONNECT_DELAY = std::chrono::seconds(3);
  constexpr auto POLL_INTERVAL   = std::chrono::milliseconds(100);

  while (_running.load() && _should_retry.load() && !_closed.load())
  {
    _open_event_sent.store(false);

    if (!attempt_connection())
    {
      log("Connection failed, reconnecting in 3s...");

      const auto end_time = std::chrono::steady_clock::now() + RECONNECT_DELAY;
      while (std::chrono::steady_clock::now() < end_time && _running.load() &&
             _should_retry.load() && !_closed.load())
      {
        std::this_thread::sleep_for(POLL_INTERVAL);
      }
    }
  }

  log("Connection thread terminated");
}

bool
HybridNitroEventSource::attempt_connection() noexcept
{
  struct CurlHandle
  {
    CURL* handle;
    explicit CurlHandle() : handle(curl_easy_init())
    {
    }
    ~CurlHandle()
    {
      if (handle)
        curl_easy_cleanup(handle);
    }
    operator CURL*() const
    {
      return handle;
    }
    CURL*
    get() const
    {
      return handle;
    }
  };

  struct CurlHeaders
  {
    curl_slist* list = nullptr;
    ~CurlHeaders()
    {
      if (list)
        curl_slist_free_all(list);
    }
    void
    append(const char* header)
    {
      list = curl_slist_append(list, header);
    }
    curl_slist*
    get() const
    {
      return list;
    }
  };

  CurlHandle curl;
  if (!curl.get())
  {
    log("Failed to initialize CURL");
    return false;
  }

  const auto set_option = [&](CURLoption option, auto value) -> bool
  {
    const CURLcode result = curl_easy_setopt(curl.get(), option, value);
    if (result != CURLE_OK)
    {
      log("CURL option error: " + std::string(curl_easy_strerror(result)));
      return false;
    }
    return true;
  };

  if (!set_option(CURLOPT_URL, _url.c_str()) ||
      !set_option(CURLOPT_WRITEFUNCTION, curl_utils::write_callback) ||
      !set_option(CURLOPT_WRITEDATA, this) ||
      !set_option(CURLOPT_XFERINFOFUNCTION, curl_utils::progress_callback) ||
      !set_option(CURLOPT_XFERINFODATA, this) || !set_option(CURLOPT_NOPROGRESS, 0L) ||
      !set_option(CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1) ||
      !set_option(CURLOPT_USERAGENT, "nitro-event-source/1.0") ||
      !set_option(CURLOPT_FOLLOWLOCATION, 1L) || !set_option(CURLOPT_MAXREDIRS, 5L))
  {
    return false;
  }

  CurlHeaders headers;
  headers.append("Accept: text/event-stream");
  headers.append("Cache-Control: no-cache");
  headers.append("Connection: keep-alive");

  if (!_last_event_id.empty())
  {
    const std::string last_event_header = "Last-Event-ID: " + _last_event_id;
    headers.append(last_event_header.c_str());
  }

  if (_options && _options->headers)
  {
    for (const auto& [key, value] : *_options->headers)
    {
      const std::string header = key + ": " + value;
      headers.append(header.c_str());
    }
  }

  if (!set_option(CURLOPT_HTTPHEADER, headers.get()))
  {
    return false;
  }

  const CURLcode result = curl_easy_perform(curl.get());

  if (result != CURLE_OK && result != CURLE_ABORTED_BY_CALLBACK)
  {
    log("Connection error: " + std::string(curl_easy_strerror(result)));

    long response_code = 0;
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &response_code);
    if (response_code > 0)
    {
      log("HTTP response code: " + std::to_string(response_code));
      dispatch_event(NitroEventSourceEvent(_last_event_id, "error", std::to_string(response_code)));
    }
  }

  return result == CURLE_OK || result == CURLE_ABORTED_BY_CALLBACK;
}

void
HybridNitroEventSource::parse_sse_chunk(std::string_view chunk) noexcept
{
  if (chunk.empty() || _closed.load())
  {
    return;
  }

  const std::lock_guard<std::mutex> lock(_buffer_mutex);
  _buffer.append(chunk);

  size_t start = 0;
  size_t pos   = 0;

  while ((pos = _buffer.find('\n', start)) != std::string::npos)
  {
    std::string_view line(_buffer.data() + start, pos - start);
    start = pos + 1;
    if (!line.empty() && line.back() == '\r')
    {
      line.remove_suffix(1);
    }

    if (line.empty())
    {
      process_sse_event();
      continue;
    }

    const size_t colon_pos = line.find(':');
    if (colon_pos == std::string_view::npos)
    {
      continue;
    }

    const std::string_view field = line.substr(0, colon_pos);
    std::string_view       value = line.substr(colon_pos + 1);

    if (!value.empty() && value.front() == ' ')
    {
      value.remove_prefix(1);
    }

    if (field == "data")
    {
      if (!_event_data.empty())
      {
        _event_data += '\n';
      }
      _event_data.append(value);
    }
    else if (field == "event")
    {
      _event_type.assign(value);
    }
    else if (field == "id")
    {
      _last_event_id.assign(value);
    }
    else if (field == "retry")
    {
      try
      {
        const int retry_ms      = std::stoi(std::string(value));
        const int clamped_retry = std::clamp(retry_ms, 100, 60000);
        // TODO: Actually use the retry value for reconnection timing
        static_cast<void>(clamped_retry);
      }
      catch (const std::exception&)
      {
        log("Invalid retry value: " + std::string(value));
      }
    }
  }

  _buffer.erase(0, start);
}

void
HybridNitroEventSource::process_sse_event() noexcept
{
  if (_event_data.empty() || _closed.load())
  {
    return;
  }

  // Use default event type if none specified (per SSE spec)
  const std::string event_type = _event_type.empty() ? "message" : _event_type;

  // Create event and dispatch if still active
  if (!_closed.load())
  {
    const NitroEventSourceEvent event(_last_event_id, event_type, _event_data);
    dispatch_event(event);
  }

  // Reset event state for next event
  _event_type.clear();
  _event_data.clear();
}

void
HybridNitroEventSource::log(std::string_view message) const noexcept
{
  std::cout << "[" << TAG << "] " << message << std::endl;
}

} // namespace margelo::nitro::nitroeventsource
