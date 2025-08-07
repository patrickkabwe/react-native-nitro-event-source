import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import EventSource, {
  type NitroEventSourceEvent,
} from 'react-native-nitro-event-source';

const { width } = Dimensions.get('window');

interface MessageData {
  id: string;
  type: string;
  timestamp: string;
  data: any;
  raw?: string;
}

interface EventStats {
  message: number;
  update: number;
  notification: number;
  heartbeat: number;
  total: number;
}

interface SystemMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  activeUsers?: number;
  uptimeSeconds?: number;
}

const baseUrl = Platform.select({
  ios: 'http://localhost:8080/sse',
  android: 'http://10.0.2.2:8080/sse',
});

function App(): React.JSX.Element {
  const [status, setStatus] = useState<
    'connecting' | 'connected' | 'error' | 'disconnected'
  >('disconnected');
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [serverUrl, setServerUrl] = useState(baseUrl);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [eventStats, setEventStats] = useState<EventStats>({
    message: 0,
    update: 0,
    notification: 0,
    heartbeat: 0,
    total: 0,
  });
  const [latestMetrics, setLatestMetrics] = useState<SystemMetrics>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const handleEventData = useCallback(
    (event: NitroEventSourceEvent) => {
      try {
        let parsedData = null;
        let displayData = event.data;

        try {
          parsedData = JSON.parse(event.data);
          displayData = parsedData;

          // Extract system metrics from update events
          if (event.type === 'update' && parsedData.metrics) {
            setLatestMetrics({
              cpuUsage: parsedData.metrics.cpu_usage,
              memoryUsage: parsedData.metrics.memory_usage,
              activeUsers: parsedData.metrics.active_users,
              uptimeSeconds: parsedData.metrics.uptime_seconds,
            });
          }
        } catch {
          displayData = event.data;
        }

        const messageData: MessageData = {
          id: event.id || Date.now().toString(),
          type: event.type,
          timestamp: new Date().toISOString(),
          data: displayData,
          raw: event.data,
        };

        setMessages(prev => [messageData, ...prev.slice(0, 99)]); // Keep last 100 messages

        // Update statistics
        setEventStats(prev => ({
          ...prev,
          [event.type]: prev[event.type as keyof EventStats] + 1 || 1,
          total: prev.total + 1,
        }));

        // Provide feedback for new events
        if (soundEnabled && Platform.OS === 'ios') {
          Vibration.vibrate(50);
        }

        // Animate new message
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        // Pulse animation for status indicator
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (error) {
        console.error('Error processing message:', error);
        const errorMessage: MessageData = {
          id: Date.now().toString(),
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
          raw: String(error),
        };
        setMessages(prev => [errorMessage, ...prev.slice(0, 99)]);
      }
    },
    [fadeAnim, pulseAnim, soundEnabled],
  );

  const connect = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }

    setStatus('connecting');
    setMessages([]);

    const newEventSource = new EventSource(serverUrl!, {
      withCredentials: true,
    });

    // Standard event listeners
    newEventSource.addEventListener('message', handleEventData);
    newEventSource.addEventListener('update', handleEventData);
    newEventSource.addEventListener('notification', handleEventData);
    newEventSource.addEventListener('heartbeat', handleEventData);

    newEventSource.addEventListener('error', event => {
      setStatus('error');
      console.log('❌ Error event:', event);
    });

    newEventSource.addEventListener('open', event => {
      setStatus('connected');
      console.log('✅ Connection opened');
    });

    setEventSource(newEventSource);

    return () => {
      newEventSource.close();
      setStatus('disconnected');
    };
  }, [serverUrl, handleEventData, eventSource]);

  const disconnect = useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setStatus('disconnected');
    }
  }, [eventSource]);

  // Filter and search functionality
  const filteredMessages = messages.filter(message => {
    const matchesFilter =
      selectedFilter === 'all' || message.type === selectedFilter;
    return matchesFilter;
  });

  const filterOptions = [
    { key: 'all', label: 'All Events', icon: '📊', count: eventStats.total },
    {
      key: 'message',
      label: 'Messages',
      icon: '💬',
      count: eventStats.message,
    },
    { key: 'update', label: 'Updates', icon: '🔄', count: eventStats.update },
    {
      key: 'notification',
      label: 'Notifications',
      icon: '🔔',
      count: eventStats.notification,
    },
    {
      key: 'heartbeat',
      label: 'Heartbeat',
      icon: '💓',
      count: eventStats.heartbeat,
    },
  ];

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, []);

  // Theme configuration
  const theme = {
    background: isDarkMode ? '#121212' : '#f8f9fa',
    surface: isDarkMode ? '#1e1e1e' : '#ffffff',
    surfaceVariant: isDarkMode ? '#2d2d2d' : '#f5f5f5',
    primary: isDarkMode ? '#bb86fc' : '#6200ea',
    onSurface: isDarkMode ? '#ffffff' : '#212529',
    onSurfaceVariant: isDarkMode ? '#b3b3b3' : '#6c757d',
    border: isDarkMode ? '#3d3d3d' : '#dee2e6',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return theme.success;
      case 'connecting':
        return theme.warning;
      case 'error':
        return theme.error;
      default:
        return theme.onSurfaceVariant;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getEventTypeConfig = (type: string) => {
    const configs = {
      message: {
        icon: '💬',
        color: '#2196f3',
        bgColor: isDarkMode ? '#1a2332' : '#e3f2fd',
      },
      update: {
        icon: '🔄',
        color: '#9c27b0',
        bgColor: isDarkMode ? '#2d1b32' : '#f3e5f5',
      },
      notification: {
        icon: '🔔',
        color: '#ff9800',
        bgColor: isDarkMode ? '#332619' : '#fff3e0',
      },
      heartbeat: {
        icon: '💓',
        color: '#4caf50',
        bgColor: isDarkMode ? '#1b2e1f' : '#e8f5e8',
      },
      error: {
        icon: '❌',
        color: '#f44336',
        bgColor: isDarkMode ? '#2e1a1a' : '#ffebee',
      },
    };
    return configs[type as keyof typeof configs] || configs.message;
  };

  const renderEventCard = (message: MessageData, index: number) => {
    const config = getEventTypeConfig(message.type);
    const isNew = index === 0;

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.eventCard,
          {
            backgroundColor: config.bgColor,
            borderLeftColor: config.color,
            opacity: isNew ? fadeAnim : 1,
          },
        ]}
      >
        <View style={styles.eventHeader}>
          <View style={styles.eventTypeSection}>
            <Text style={styles.eventIcon}>{config.icon}</Text>
            <View>
              <Text style={[styles.eventType, { color: config.color }]}>
                {message.type.toUpperCase()}
              </Text>
              <Text style={[styles.eventId, { color: theme.onSurfaceVariant }]}>
                #{message.id}
              </Text>
            </View>
          </View>
          <Text style={[styles.eventTime, { color: theme.onSurfaceVariant }]}>
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>

        <View style={styles.eventContent}>
          {message.type === 'message' && message.data?.user && (
            <View style={styles.chatMessage}>
              <Text style={[styles.chatUser, { color: config.color }]}>
                {message.data.user}
              </Text>
              <Text style={[styles.chatText, { color: theme.onSurface }]}>
                {message.data.message}
              </Text>
            </View>
          )}

          {message.type === 'notification' && (
            <View style={styles.notificationContent}>
              <Text
                style={[styles.notificationTitle, { color: theme.onSurface }]}
              >
                {message.data?.icon} {message.data?.title}
              </Text>
              <Text
                style={[
                  styles.notificationMessage,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                {message.data?.message}
              </Text>
              {message.data?.severity && (
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: config.color },
                  ]}
                >
                  <Text style={styles.severityText}>
                    {message.data.severity}
                  </Text>
                </View>
              )}
            </View>
          )}

          {message.type === 'update' && message.data?.metrics && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricLabel,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  CPU
                </Text>
                <Text style={[styles.metricValue, { color: theme.onSurface }]}>
                  {message.data.metrics.cpu_usage}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricLabel,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  Memory
                </Text>
                <Text style={[styles.metricValue, { color: theme.onSurface }]}>
                  {message.data.metrics.memory_usage}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricLabel,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  Users
                </Text>
                <Text style={[styles.metricValue, { color: theme.onSurface }]}>
                  {message.data.metrics.active_users}
                </Text>
              </View>
            </View>
          )}

          {message.type === 'heartbeat' && (
            <View style={styles.heartbeatInfo}>
              <Text
                style={[
                  styles.heartbeatText,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                Sequence: {message.data?.sequence} • Latency:{' '}
                {message.data?.latency_ms}ms
              </Text>
              <Text style={[styles.heartbeatStatus, { color: config.color }]}>
                {message.data?.connection_status?.toUpperCase() || 'STABLE'}
              </Text>
            </View>
          )}

          {(message.type === 'error' ||
            !['message', 'notification', 'update', 'heartbeat'].includes(
              message.type,
            )) && (
            <Text style={[styles.rawContent, { color: theme.onSurface }]}>
              {typeof message.data === 'string'
                ? message.data
                : JSON.stringify(message.data, null, 2)}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header with Dark Mode Toggle */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>
              🚀 EventSource Pro
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}
            >
              Real-time Server-Sent Events Monitor
            </Text>
          </View>
          <View style={styles.headerControls}>
            <View style={styles.themeToggle}>
              <Text
                style={[styles.toggleLabel, { color: theme.onSurfaceVariant }]}
              >
                {isDarkMode ? '🌙' : '☀️'}
              </Text>
              <Switch
                value={isDarkMode}
                onValueChange={setIsDarkMode}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor={isDarkMode ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Connection Controls */}
      <View style={[styles.connectionCard, { backgroundColor: theme.surface }]}>
        <View style={styles.urlInputContainer}>
          <Text style={[styles.inputLabel, { color: theme.onSurface }]}>
            {getStatusIcon()} Server Endpoint
          </Text>
          <TextInput
            style={[
              styles.urlInput,
              {
                backgroundColor: theme.surfaceVariant,
                borderColor: theme.border,
                color: theme.onSurface,
              },
            ]}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="Enter SSE endpoint URL"
            placeholderTextColor={theme.onSurfaceVariant}
            editable={status === 'disconnected'}
          />
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  status === 'connected'
                    ? theme.onSurfaceVariant
                    : theme.success,
              },
            ]}
            onPress={connect}
            disabled={status === 'connected'}
          >
            <Text style={styles.actionButtonText}>
              {status === 'connecting' ? '⏳ Connecting...' : '🔗 Connect'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  status === 'disconnected'
                    ? theme.onSurfaceVariant
                    : theme.error,
              },
            ]}
            onPress={disconnect}
            disabled={status === 'disconnected'}
          >
            <Text style={styles.actionButtonText}>🔌 Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Statistics */}
      <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.statsTitle, { color: theme.onSurface }]}>
          📊 Event Statistics
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
        >
          {filterOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.statChip,
                {
                  backgroundColor:
                    selectedFilter === option.key
                      ? theme.primary
                      : theme.surfaceVariant,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setSelectedFilter(option.key)}
            >
              <Text style={styles.statIcon}>{option.icon}</Text>
              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      selectedFilter === option.key
                        ? '#ffffff'
                        : theme.onSurface,
                  },
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.statCount,
                  {
                    color:
                      selectedFilter === option.key ? '#ffffff' : theme.primary,
                  },
                ]}
              >
                {option.count}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Events Feed */}
      <View style={styles.eventsFeed}>
        <View style={styles.feedHeader}>
          <Text style={[styles.feedTitle, { color: theme.onSurface }]}>
            📡 Live Events ({filteredMessages.length})
          </Text>
        </View>

        {filteredMessages.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
            <Text style={styles.emptyIcon}>
              {messages.length === 0 ? '💭' : '🔍'}
            </Text>
            <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
              {messages.length === 0 ? 'No events yet' : 'No matching events'}
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: theme.onSurfaceVariant }]}
            >
              {messages.length === 0
                ? 'Connect to start receiving real-time events'
                : 'Try adjusting your filter or search query'}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.eventsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.eventsContainer}
          >
            {filteredMessages.map(renderEventCard)}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },

  // Header Styles
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  headerControls: {
    alignItems: 'center',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 18,
  },

  // Status Dashboard
  statusDashboard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  liveMetrics: {
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricChipValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Connection Card
  connectionCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  urlInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Stats Card
  statsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsScroll: {
    marginHorizontal: -4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
  },
  statCount: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Search Card
  searchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },

  // Events Feed
  eventsFeed: {
    flex: 1,
    marginTop: 12,
  },
  feedHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventsList: {
    flex: 1,
  },
  eventsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // Event Cards
  eventCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  eventId: {
    fontSize: 11,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  eventContent: {
    marginTop: 4,
  },

  // Chat Message Styles
  chatMessage: {
    marginBottom: 4,
  },
  chatUser: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 20,
  },

  // Notification Styles
  notificationContent: {
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Heartbeat Info
  heartbeatInfo: {
    alignItems: 'center',
  },
  heartbeatText: {
    fontSize: 12,
    marginBottom: 4,
  },
  heartbeatStatus: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Raw Content
  rawContent: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    marginHorizontal: 16,
    borderRadius: 16,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default App;
