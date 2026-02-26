/**
 * Neolith API Client
 *
 * Handles communication between the orchestrator-daemon and the Neolith web app.
 * Manages JWT tokens, automatic token refresh, and retry logic.
 *
 * @module neolith/api-client
 */

import type {
  AuthResponse,
  RefreshResponse,
  HeartbeatOptions,
  HeartbeatResponse,
  GetMessagesOptions,
  MessagesResponse,
  SendMessageOptions,
  SendMessageResponse,
  OrchestratorStatus,
  UpdateStatusOptions,
  OrchestratorConfig,
  ApiError,
  NeolithApiConfig,
  RequestOptions,
} from './types';

/**
 * NeolithApiClient - Client for interacting with Neolith daemon APIs
 */
export class NeolithApiClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private sessionId: string | null = null;
  private retryAttempts: number;
  private retryDelay: number;
  private tokenRefreshBuffer: number;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  /**
   * Create a new Neolith API client
   *
   * @param config - Client configuration
   * @example
   * ```typescript
   * const client = new NeolithApiClient({
   *   baseUrl: 'https://neolith.wundr.io',
   *   apiKey: 'vp_abc123_xyz',
   *   apiSecret: 'secret_key',
   *   retryAttempts: 3,
   *   retryDelay: 1000,
   * });
   * ```
   */
  constructor(config: NeolithApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.retryAttempts = config.retryAttempts ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.tokenRefreshBuffer = config.tokenRefreshBuffer ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Authenticate with the Neolith API
   *
   * @param scopes - Optional scopes to request
   * @returns Authentication response with tokens
   * @throws {Error} If authentication fails
   *
   * @example
   * ```typescript
   * const auth = await client.authenticate(['messages:read', 'messages:write']);
   * console.log('Authenticated as:', auth.orchestrator.user.name);
   * ```
   */
  async authenticate(scopes: string[] = []): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      path: '/api/daemon/auth',
      body: {
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        scopes,
      },
      requiresAuth: false,
      skipRetry: true, // Don't retry auth failures
    });

    this.accessToken = response.accessToken;
    this.refreshToken = response.refreshToken;
    this.tokenExpiresAt = new Date(response.expiresAt);
    this.sessionId = response.sessionId;

    return response;
  }

  /**
   * Refresh the access token using the refresh token
   *
   * @returns New access token
   * @throws {Error} If refresh fails
   */
  async refreshAccessToken(): Promise<RefreshResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please authenticate first.');
    }

    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return {
        accessToken: this.accessToken!,
        expiresAt: this.tokenExpiresAt!.toISOString(),
      };
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      await this.refreshPromise;
      return {
        accessToken: this.accessToken!,
        expiresAt: this.tokenExpiresAt!.toISOString(),
      };
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method to perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<void> {
    const response = await this.request<RefreshResponse>({
      method: 'POST',
      path: '/api/daemon/auth/refresh',
      body: {
        refreshToken: this.refreshToken,
      },
      requiresAuth: false,
      skipRetry: true,
    });

    this.accessToken = response.accessToken;
    this.tokenExpiresAt = new Date(response.expiresAt);
  }

  /**
   * Check if the access token needs to be refreshed
   *
   * @returns True if token should be refreshed
   */
  private shouldRefreshToken(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }

    const now = Date.now();
    const expiresAt = this.tokenExpiresAt.getTime();
    const bufferTime = this.tokenRefreshBuffer;

    return now >= expiresAt - bufferTime;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    if (this.shouldRefreshToken()) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Send a heartbeat to the Neolith API
   *
   * @param options - Heartbeat options including status and metrics
   * @returns Server response with timing information
   *
   * @example
   * ```typescript
   * await client.sendHeartbeat({
   *   status: 'active',
   *   metrics: {
   *     memoryUsageMB: 256,
   *     cpuUsagePercent: 15.5,
   *     activeConnections: 5,
   *     messagesProcessed: 42,
   *   }
   * });
   * ```
   */
  async sendHeartbeat(
    options: HeartbeatOptions = {}
  ): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>({
      method: 'POST',
      path: '/api/daemon/heartbeat',
      body: {
        sessionId: options.sessionId ?? this.sessionId,
        status: options.status ?? 'active',
        metrics: options.metrics,
      },
    });
  }

  /**
   * Get messages from a channel
   *
   * @param channelId - The channel ID to fetch messages from
   * @param options - Pagination options
   * @returns List of messages
   *
   * @example
   * ```typescript
   * const { messages } = await client.getMessages('chan_123', {
   *   limit: 50,
   *   before: 'msg_456'
   * });
   * ```
   */
  async getMessages(
    channelId: string,
    options: GetMessagesOptions = {}
  ): Promise<MessagesResponse> {
    const params = new URLSearchParams();
    params.set('channelId', channelId);

    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.before) {
      params.set('before', options.before);
    }
    if (options.after) {
      params.set('after', options.after);
    }

    const response = await this.request<MessagesResponse>({
      method: 'GET',
      path: `/api/daemon/messages?${params.toString()}`,
    });

    // Convert date strings to Date objects
    response.messages = response.messages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
      updatedAt: new Date(msg.updatedAt),
    }));

    return response;
  }

  /**
   * Send a message to a channel
   *
   * @param channelId - The channel ID to send the message to
   * @param content - The message content
   * @param options - Additional message options
   * @returns Message ID of the created message
   *
   * @example
   * ```typescript
   * const { messageId } = await client.sendMessage('chan_123', 'Hello!', {
   *   threadId: 'msg_456',
   *   metadata: { source: 'automated' }
   * });
   * ```
   */
  async sendMessage(
    channelId: string,
    content: string,
    options: SendMessageOptions = {}
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>({
      method: 'POST',
      path: '/api/daemon/messages',
      body: {
        channelId,
        content,
        threadId: options.threadId,
        attachments: options.attachments,
        metadata: options.metadata,
      },
    });
  }

  /**
   * Update the orchestrator status
   *
   * @param status - The new status (active, paused, error)
   * @param options - Optional status message
   * @returns Success response
   *
   * @example
   * ```typescript
   * await client.updateStatus('active', {
   *   message: 'Processing requests'
   * });
   * ```
   */
  async updateStatus(
    status: OrchestratorStatus,
    options: UpdateStatusOptions = {}
  ): Promise<{ success: true }> {
    return this.request<{ success: true }>({
      method: 'PUT',
      path: '/api/daemon/status',
      body: {
        status,
        message: options.message,
      },
    });
  }

  /**
   * Get the orchestrator configuration
   *
   * @returns Full orchestrator configuration
   *
   * @example
   * ```typescript
   * const config = await client.getConfig();
   * console.log('Heartbeat interval:', config.operationalConfig.heartbeatIntervalMs);
   * ```
   */
  async getConfig(): Promise<OrchestratorConfig> {
    const response = await this.request<OrchestratorConfig>({
      method: 'GET',
      path: '/api/daemon/config',
    });

    // Convert date strings to Date objects
    return {
      ...response,
      orchestrator: {
        ...response.orchestrator,
        createdAt: new Date(response.orchestrator.createdAt),
        updatedAt: new Date(response.orchestrator.updatedAt),
      },
    };
  }

  /**
   * Make an HTTP request to the Neolith API with retry logic
   *
   * @param options - Request options
   * @returns Parsed JSON response
   * @throws {Error} If request fails after all retries
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const {
      method,
      path,
      body,
      requiresAuth = true,
      skipRetry = false,
    } = options;

    // Ensure valid token for authenticated requests
    if (requiresAuth) {
      await this.ensureValidToken();
    }

    const maxAttempts = skipRetry ? 1 : this.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (requiresAuth && this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = (await response.json()) as ApiError;

          // If token expired, try to refresh and retry once
          if (response.status === 401 && requiresAuth && attempt === 0) {
            try {
              await this.refreshAccessToken();
              continue; // Retry with new token
            } catch {
              // Refresh failed, throw the original error
              throw new Error(
                `API request failed: ${errorData.error} (${errorData.code})`
              );
            }
          }

          throw new Error(
            `API request failed: ${errorData.error} (${errorData.code})`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt < maxAttempts - 1) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed with unknown error');
  }

  /**
   * Check if the client is authenticated
   *
   * @returns True if authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.refreshToken !== null;
  }

  /**
   * Get the current session ID
   *
   * @returns Session ID or null if not authenticated
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.sessionId = null;
  }
}
