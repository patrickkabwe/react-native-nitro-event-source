#pragma once

#include "HybridNitroEventSourceSpec.hpp"

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <thread>
#include <unordered_map>
#include <vector>

namespace margelo::nitro::nitroeventsource
{
class HybridNitroEventSource : public HybridNitroEventSourceSpec
{
public:
  HybridNitroEventSource() : HybridObject(TAG), HybridNitroEventSourceSpec()
  {
  }
  ~HybridNitroEventSource() override;

  std::shared_ptr<HybridNitroEventSourceSpec> create(
      const std::string& url, const std::optional<NitroEventSourceOptions>& options) override;
  void close() override;
  void setEventCallback(
      const std::function<void(const NitroEventSourceEvent& /* event */)>& callback) override;
  void addEventListener(
      const std::string&                                                   type,
      const std::function<void(const NitroEventSourceEvent& /* event */)>& listener) override;
  void removeEventListener(
      const std::string&                                                   type,
      const std::function<void(const NitroEventSourceEvent& /* event */)>& listener) override;

public:
  // Cleanup state
  std::atomic<bool> _closed{false};
  std::atomic<bool> _open_event_sent{false};
  std::atomic<bool> _running{true};

  // SSE parsing
  std::string _buffer, _event_type, _event_data, _last_event_id;
  std::mutex  _buffer_mutex;

  void parse_sse_chunk(std::string_view chunk) noexcept;
  void dispatch_event(const NitroEventSourceEvent& event) noexcept;

private:
  void connect() noexcept;
  bool attempt_connection() noexcept;
  void process_sse_event() noexcept;
  void log(std::string_view message) const noexcept;

  std::string                                       _url;
  std::thread                                       _curl_thread;
  std::mutex                                        _callback_mutex;
  std::optional<NitroEventSourceOptions>            _options;
  std::function<void(const NitroEventSourceEvent&)> _event_callback;

  // Event listeners storage - simpler approach using the callback function as
  // key
  std::unordered_map<std::string, std::vector<std::function<void(const NitroEventSourceEvent&)>>>
             _event_listeners;
  std::mutex _listeners_mutex;

  std::atomic<bool> _should_retry{true};
};
}; // namespace margelo::nitro::nitroeventsource
