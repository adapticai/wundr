/**
 * Type definitions for Neolith API Client
 * @module neolith/types
 */

/**
 * Authentication response from the Neolith API
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  sessionId: string;
  orchestrator: {
    id: string;
    discipline: string | null;
    role: string | null;
    status: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      status: string;
    };
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

/**
 * Token refresh response
 */
export interface RefreshResponse {
  accessToken: string;
  expiresAt: string;
}

/**
 * Heartbeat metrics data
 */
export interface HeartbeatMetrics {
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  activeConnections?: number;
  messagesProcessed?: number;
  errorsCount?: number;
  uptimeSeconds?: number;
  lastTaskCompletedAt?: string;
  queueDepth?: number;
}

/**
 * Heartbeat request options
 */
export interface HeartbeatOptions {
  sessionId?: string;
  status?: 'active' | 'idle' | 'busy';
  metrics?: HeartbeatMetrics;
}

/**
 * Heartbeat response
 */
export interface HeartbeatResponse {
  success: true;
  serverTime: string;
  nextHeartbeat: string;
  heartbeatIntervalMs: number;
}

/**
 * Message author information
 */
export interface MessageAuthor {
  id: string;
  name: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isOrchestrator?: boolean;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  type: string;
  url: string;
  name?: string;
}

/**
 * Message object
 */
export interface Message {
  id: string;
  content: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  channelId: string;
  parentId: string | null;
  author: MessageAuthor;
}

/**
 * Options for retrieving messages
 */
export interface GetMessagesOptions {
  limit?: number;
  before?: string;
  after?: string;
}

/**
 * Messages response
 */
export interface MessagesResponse {
  messages: Message[];
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  threadId?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

/**
 * Send message response
 */
export interface SendMessageResponse {
  messageId: string;
}

/**
 * Orchestrator status types
 */
export type OrchestratorStatus = 'active' | 'paused' | 'error';

/**
 * Status update options
 */
export interface UpdateStatusOptions {
  message?: string;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  orchestrator: {
    id: string;
    discipline: string | null;
    role: string | null;
    status: string;
    daemonEndpoint: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
    status: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  capabilities: Record<string, unknown>;
  charter: unknown;
  operationalConfig: {
    heartbeatIntervalMs: number;
    reconnectDelayMs: number;
    maxReconnectAttempts: number;
    messageRateLimitPerMinute: number;
    idleTimeoutMs: number;
  };
  scopes: string[];
  endpoints: {
    messages: string;
    channels: string;
    presence: string;
    status: string;
    events: string;
    heartbeat: string;
  };
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  code: string;
}

/**
 * API client configuration
 */
export interface NeolithApiConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  retryAttempts?: number;
  retryDelay?: number;
  tokenRefreshBuffer?: number; // Time in ms before expiry to refresh token
}

/**
 * Request options for API calls
 */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  requiresAuth?: boolean;
  skipRetry?: boolean;
}
