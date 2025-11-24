/**
 * Presence Test Data Factories
 *
 * Factory functions for creating consistent mock presence data in tests.
 * These factories provide sensible defaults while allowing overrides
 * for specific test scenarios.
 *
 * @module @genesis/core/test-utils/presence-factories
 */

import { vi } from 'vitest';

// =============================================================================
// ID GENERATORS
// =============================================================================

let presenceIdCounter = 0;

/**
 * Generate a unique test ID for presence entities
 */
export function generatePresenceTestId(prefix = 'presence'): string {
  presenceIdCounter += 1;
  return `${prefix}_${Date.now()}_${presenceIdCounter}`;
}

/**
 * Reset the presence ID counter (useful between test suites)
 */
export function resetPresenceIdCounter(): void {
  presenceIdCounter = 0;
}

// =============================================================================
// PRESENCE STATUS TYPES
// =============================================================================

export type UserPresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'dnd';

export type VPPresenceStatus = 'online' | 'offline' | 'busy' | 'away';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// =============================================================================
// PRESENCE INTERFACES
// =============================================================================

/**
 * User presence information
 */
export interface UserPresence {
  userId: string;
  status: UserPresenceStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  lastSeen: string;
  connectedAt: string;
  metadata?: Record<string, unknown>;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    device?: string;
  };
  activeChannels?: string[];
}

/**
 * VP (Virtual Person) presence information
 */
export interface VPPresence {
  vpId: string;
  userId: string;
  status: VPPresenceStatus;
  daemonInfo: DaemonInfo;
  lastHeartbeat: string;
  lastSeen: string;
  connectedAt: string;
  activeConversations: number;
  maxConcurrentConversations: number;
  metrics?: VPMetrics;
  metadata?: Record<string, unknown>;
}

/**
 * Daemon process information for VPs
 */
export interface DaemonInfo {
  daemonId: string;
  endpoint: string;
  version: string;
  startedAt: string;
  processId?: number;
  hostname?: string;
  uptime?: number;
  healthCheckUrl?: string;
}

/**
 * VP performance metrics
 */
export interface VPMetrics {
  responseTimeMs: number;
  messagesProcessed: number;
  errorsCount: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  lastResponseTime?: string;
  averageResponseTimeMs?: number;
}

/**
 * Heartbeat record
 */
export interface HeartbeatRecord {
  vpId: string;
  daemonId: string;
  timestamp: string;
  sequenceNumber: number;
  metrics: VPMetrics;
  status: VPPresenceStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Health check status
 */
export interface HealthCheckStatus {
  vpId: string;
  status: HealthStatus;
  lastHeartbeat: string | null;
  missedHeartbeats: number;
  consecutiveFailures: number;
  lastCheckAt: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Channel presence information
 */
export interface ChannelPresence {
  channelId: string;
  onlineMembers: string[];
  typingUsers: Array<{
    userId: string;
    startedAt: string;
  }>;
  lastActivity: string;
  memberCount: number;
}

/**
 * Presence change event
 */
export interface PresenceChangeEvent {
  type: 'user_online' | 'user_offline' | 'status_change' | 'vp_online' | 'vp_offline';
  userId: string;
  vpId?: string;
  previousStatus?: UserPresenceStatus | VPPresenceStatus;
  newStatus: UserPresenceStatus | VPPresenceStatus;
  timestamp: string;
  channelId?: string;
  organizationId?: string;
}

// =============================================================================
// USER PRESENCE FACTORIES
// =============================================================================

/**
 * Create a mock user presence object
 */
export function createMockUserPresence(
  overrides?: Partial<UserPresence>
): UserPresence {
  const userId = overrides?.userId ?? generatePresenceTestId('user');
  const now = new Date().toISOString();

  return {
    userId,
    status: 'online',
    lastSeen: now,
    connectedAt: now,
    activeChannels: [],
    ...overrides,
  };
}

/**
 * Create a mock user presence with custom status
 */
export function createMockUserPresenceWithCustomStatus(
  customStatus: string,
  emoji?: string,
  overrides?: Partial<UserPresence>
): UserPresence {
  return createMockUserPresence({
    customStatus,
    customStatusEmoji: emoji,
    ...overrides,
  });
}

/**
 * Create multiple mock user presences
 */
export function createMockUserPresenceList(
  count: number,
  overrides?: Partial<UserPresence>
): UserPresence[] {
  return Array.from({ length: count }, (_, index) =>
    createMockUserPresence({
      ...overrides,
      userId: overrides?.userId
        ? `${overrides.userId}_${index}`
        : generatePresenceTestId('user'),
    })
  );
}

/**
 * Create mock online users for a channel
 */
export function createMockOnlineChannelMembers(
  channelId: string,
  memberCount: number
): UserPresence[] {
  return createMockUserPresenceList(memberCount, {
    status: 'online',
    activeChannels: [channelId],
  });
}

// =============================================================================
// VP PRESENCE FACTORIES
// =============================================================================

/**
 * Create a mock daemon info object
 */
export function createMockDaemonInfo(
  overrides?: Partial<DaemonInfo>
): DaemonInfo {
  const daemonId = overrides?.daemonId ?? generatePresenceTestId('daemon');
  const now = new Date().toISOString();

  return {
    daemonId,
    endpoint: `https://daemon-${daemonId}.genesis.local`,
    version: '1.0.0',
    startedAt: now,
    processId: Math.floor(Math.random() * 65535) + 1000,
    hostname: `vp-daemon-${daemonId.slice(-6)}`,
    uptime: 3600,
    healthCheckUrl: `https://daemon-${daemonId}.genesis.local/health`,
    ...overrides,
  };
}

/**
 * Create mock VP metrics
 */
export function createMockVPMetrics(
  overrides?: Partial<VPMetrics>
): VPMetrics {
  return {
    responseTimeMs: Math.floor(Math.random() * 500) + 50,
    messagesProcessed: Math.floor(Math.random() * 1000),
    errorsCount: 0,
    memoryUsageMb: Math.floor(Math.random() * 512) + 128,
    cpuUsagePercent: Math.floor(Math.random() * 30) + 5,
    lastResponseTime: new Date().toISOString(),
    averageResponseTimeMs: Math.floor(Math.random() * 300) + 100,
    ...overrides,
  };
}

/**
 * Create a mock VP presence object
 */
export function createMockVPPresence(
  overrides?: Partial<VPPresence>
): VPPresence {
  const vpId = overrides?.vpId ?? generatePresenceTestId('vp');
  const userId = overrides?.userId ?? generatePresenceTestId('user');
  const now = new Date().toISOString();

  return {
    vpId,
    userId,
    status: 'online',
    daemonInfo: createMockDaemonInfo(overrides?.daemonInfo),
    lastHeartbeat: now,
    lastSeen: now,
    connectedAt: now,
    activeConversations: 0,
    maxConcurrentConversations: 10,
    metrics: createMockVPMetrics(overrides?.metrics),
    ...overrides,
  };
}

/**
 * Create a mock VP presence with specific daemon info
 */
export function createMockVPPresenceWithDaemon(
  daemonOverrides?: Partial<DaemonInfo>,
  vpOverrides?: Partial<VPPresence>
): VPPresence {
  return createMockVPPresence({
    ...vpOverrides,
    daemonInfo: createMockDaemonInfo(daemonOverrides),
  });
}

/**
 * Create multiple mock VP presences
 */
export function createMockVPPresenceList(
  count: number,
  overrides?: Partial<VPPresence>
): VPPresence[] {
  return Array.from({ length: count }, () =>
    createMockVPPresence(overrides)
  );
}

/**
 * Create a mock offline VP presence
 */
export function createMockOfflineVPPresence(
  overrides?: Partial<VPPresence>
): VPPresence {
  const now = new Date();
  const lastSeen = new Date(now.getTime() - 300000); // 5 minutes ago

  return createMockVPPresence({
    status: 'offline',
    lastSeen: lastSeen.toISOString(),
    lastHeartbeat: lastSeen.toISOString(),
    activeConversations: 0,
    ...overrides,
  });
}

// =============================================================================
// HEARTBEAT FACTORIES
// =============================================================================

/**
 * Create a mock heartbeat record
 */
export function createMockHeartbeatRecord(
  overrides?: Partial<HeartbeatRecord>
): HeartbeatRecord {
  const vpId = overrides?.vpId ?? generatePresenceTestId('vp');
  const daemonId = overrides?.daemonId ?? generatePresenceTestId('daemon');
  const now = new Date().toISOString();

  return {
    vpId,
    daemonId,
    timestamp: now,
    sequenceNumber: 1,
    metrics: createMockVPMetrics(),
    status: 'online',
    ...overrides,
  };
}

/**
 * Create a sequence of heartbeat records (for testing missed heartbeats)
 */
export function createMockHeartbeatSequence(
  vpId: string,
  daemonId: string,
  count: number,
  intervalMs = 30000
): HeartbeatRecord[] {
  const now = Date.now();

  return Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(now - (count - 1 - index) * intervalMs);
    return createMockHeartbeatRecord({
      vpId,
      daemonId,
      timestamp: timestamp.toISOString(),
      sequenceNumber: index + 1,
    });
  });
}

/**
 * Create a mock heartbeat with errors
 */
export function createMockErrorHeartbeat(
  overrides?: Partial<HeartbeatRecord>
): HeartbeatRecord {
  return createMockHeartbeatRecord({
    ...overrides,
    metrics: createMockVPMetrics({
      errorsCount: Math.floor(Math.random() * 10) + 1,
      ...overrides?.metrics,
    }),
  });
}

// =============================================================================
// HEALTH STATUS FACTORIES
// =============================================================================

/**
 * Create a mock health check status
 */
export function createMockHealthStatus(
  overrides?: Partial<HealthCheckStatus>
): HealthCheckStatus {
  const vpId = overrides?.vpId ?? generatePresenceTestId('vp');
  const now = new Date().toISOString();

  return {
    vpId,
    status: 'healthy',
    lastHeartbeat: now,
    missedHeartbeats: 0,
    consecutiveFailures: 0,
    lastCheckAt: now,
    message: 'All systems operational',
    ...overrides,
  };
}

/**
 * Create a mock degraded health status
 */
export function createMockDegradedHealthStatus(
  vpId: string,
  missedHeartbeats = 1,
  overrides?: Partial<HealthCheckStatus>
): HealthCheckStatus {
  const now = new Date();
  const lastHeartbeat = new Date(now.getTime() - missedHeartbeats * 30000);

  return createMockHealthStatus({
    vpId,
    status: 'degraded',
    lastHeartbeat: lastHeartbeat.toISOString(),
    missedHeartbeats,
    consecutiveFailures: missedHeartbeats,
    message: `Missed ${missedHeartbeats} heartbeat(s)`,
    ...overrides,
  });
}

/**
 * Create a mock unhealthy health status
 */
export function createMockUnhealthyHealthStatus(
  vpId: string,
  missedHeartbeats = 3,
  overrides?: Partial<HealthCheckStatus>
): HealthCheckStatus {
  const now = new Date();
  const lastHeartbeat = new Date(now.getTime() - missedHeartbeats * 30000);

  return createMockHealthStatus({
    vpId,
    status: 'unhealthy',
    lastHeartbeat: lastHeartbeat.toISOString(),
    missedHeartbeats,
    consecutiveFailures: missedHeartbeats,
    message: `VP unresponsive - missed ${missedHeartbeats} consecutive heartbeats`,
    ...overrides,
  });
}

/**
 * Create a mock unknown health status (for unregistered VPs)
 */
export function createMockUnknownHealthStatus(
  vpId: string,
  overrides?: Partial<HealthCheckStatus>
): HealthCheckStatus {
  return createMockHealthStatus({
    vpId,
    status: 'unknown',
    lastHeartbeat: null,
    missedHeartbeats: 0,
    consecutiveFailures: 0,
    message: 'VP not registered or never sent heartbeat',
    ...overrides,
  });
}

// =============================================================================
// CHANNEL PRESENCE FACTORIES
// =============================================================================

/**
 * Create a mock channel presence object
 */
export function createMockChannelPresence(
  overrides?: Partial<ChannelPresence>
): ChannelPresence {
  const channelId = overrides?.channelId ?? generatePresenceTestId('channel');
  const now = new Date().toISOString();

  return {
    channelId,
    onlineMembers: [],
    typingUsers: [],
    lastActivity: now,
    memberCount: 0,
    ...overrides,
  };
}

/**
 * Create a mock channel presence with online members
 */
export function createMockActiveChannelPresence(
  channelId: string,
  onlineMemberIds: string[],
  overrides?: Partial<ChannelPresence>
): ChannelPresence {
  return createMockChannelPresence({
    channelId,
    onlineMembers: onlineMemberIds,
    memberCount: onlineMemberIds.length,
    ...overrides,
  });
}

/**
 * Create a mock channel presence with typing users
 */
export function createMockChannelPresenceWithTyping(
  channelId: string,
  typingUserIds: string[],
  overrides?: Partial<ChannelPresence>
): ChannelPresence {
  const now = new Date().toISOString();

  return createMockChannelPresence({
    channelId,
    typingUsers: typingUserIds.map((userId) => ({
      userId,
      startedAt: now,
    })),
    ...overrides,
  });
}

// =============================================================================
// EVENT FACTORIES
// =============================================================================

/**
 * Create a mock presence change event
 */
export function createMockPresenceChangeEvent(
  overrides?: Partial<PresenceChangeEvent>
): PresenceChangeEvent {
  const userId = overrides?.userId ?? generatePresenceTestId('user');
  const now = new Date().toISOString();

  return {
    type: 'status_change',
    userId,
    previousStatus: 'offline',
    newStatus: 'online',
    timestamp: now,
    ...overrides,
  };
}

/**
 * Create a mock user online event
 */
export function createMockUserOnlineEvent(
  userId: string,
  channelId?: string,
  organizationId?: string
): PresenceChangeEvent {
  return createMockPresenceChangeEvent({
    type: 'user_online',
    userId,
    previousStatus: 'offline',
    newStatus: 'online',
    channelId,
    organizationId,
  });
}

/**
 * Create a mock user offline event
 */
export function createMockUserOfflineEvent(
  userId: string,
  previousStatus: UserPresenceStatus = 'online',
  channelId?: string,
  organizationId?: string
): PresenceChangeEvent {
  return createMockPresenceChangeEvent({
    type: 'user_offline',
    userId,
    previousStatus,
    newStatus: 'offline',
    channelId,
    organizationId,
  });
}

/**
 * Create a mock VP online event
 */
export function createMockVPOnlineEvent(
  vpId: string,
  userId: string,
  organizationId?: string
): PresenceChangeEvent {
  return createMockPresenceChangeEvent({
    type: 'vp_online',
    userId,
    vpId,
    previousStatus: 'offline',
    newStatus: 'online',
    organizationId,
  });
}

/**
 * Create a mock VP offline event
 */
export function createMockVPOfflineEvent(
  vpId: string,
  userId: string,
  previousStatus: VPPresenceStatus = 'online',
  organizationId?: string
): PresenceChangeEvent {
  return createMockPresenceChangeEvent({
    type: 'vp_offline',
    userId,
    vpId,
    previousStatus,
    newStatus: 'offline',
    organizationId,
  });
}

// =============================================================================
// MOCK SERVICE FACTORIES
// =============================================================================

/**
 * Create a mock presence service
 */
export function createMockPresenceService() {
  return {
    setUserOnline: vi.fn(),
    setUserOffline: vi.fn(),
    getUserPresence: vi.fn(),
    setUserStatus: vi.fn(),
    setUserCustomStatus: vi.fn(),
    getOnlineChannelMembers: vi.fn(),
    getChannelPresence: vi.fn(),
    setVPOnline: vi.fn(),
    setVPOffline: vi.fn(),
    getVPPresence: vi.fn(),
    updateVPStatus: vi.fn(),
    subscribeToPresenceChanges: vi.fn(),
    unsubscribeFromPresenceChanges: vi.fn(),
    cleanup: vi.fn(),
  };
}

/**
 * Create a mock heartbeat service
 */
export function createMockHeartbeatService() {
  return {
    sendHeartbeat: vi.fn(),
    checkHealth: vi.fn(),
    getUnhealthyVPs: vi.fn(),
    getVPHealthStatus: vi.fn(),
    getAllVPHealthStatuses: vi.fn(),
    registerVP: vi.fn(),
    unregisterVP: vi.fn(),
    cleanup: vi.fn(),
  };
}

/**
 * Create a mock heartbeat monitor
 */
export function createMockHeartbeatMonitor() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
    setOnUnhealthy: vi.fn(),
    setOnRecovered: vi.fn(),
    checkNow: vi.fn(),
    getMonitoringStats: vi.fn(),
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const PresenceFactories = {
  // User presence
  userPresence: createMockUserPresence,
  userPresenceWithStatus: createMockUserPresenceWithCustomStatus,
  userPresenceList: createMockUserPresenceList,
  onlineChannelMembers: createMockOnlineChannelMembers,

  // VP presence
  vpPresence: createMockVPPresence,
  vpPresenceWithDaemon: createMockVPPresenceWithDaemon,
  vpPresenceList: createMockVPPresenceList,
  offlineVPPresence: createMockOfflineVPPresence,
  daemonInfo: createMockDaemonInfo,
  vpMetrics: createMockVPMetrics,

  // Heartbeat
  heartbeatRecord: createMockHeartbeatRecord,
  heartbeatSequence: createMockHeartbeatSequence,
  errorHeartbeat: createMockErrorHeartbeat,

  // Health status
  healthStatus: createMockHealthStatus,
  degradedHealthStatus: createMockDegradedHealthStatus,
  unhealthyHealthStatus: createMockUnhealthyHealthStatus,
  unknownHealthStatus: createMockUnknownHealthStatus,

  // Channel presence
  channelPresence: createMockChannelPresence,
  activeChannelPresence: createMockActiveChannelPresence,
  channelPresenceWithTyping: createMockChannelPresenceWithTyping,

  // Events
  presenceChangeEvent: createMockPresenceChangeEvent,
  userOnlineEvent: createMockUserOnlineEvent,
  userOfflineEvent: createMockUserOfflineEvent,
  vpOnlineEvent: createMockVPOnlineEvent,
  vpOfflineEvent: createMockVPOfflineEvent,

  // Mock services
  presenceService: createMockPresenceService,
  heartbeatService: createMockHeartbeatService,
  heartbeatMonitor: createMockHeartbeatMonitor,
};

export default PresenceFactories;
