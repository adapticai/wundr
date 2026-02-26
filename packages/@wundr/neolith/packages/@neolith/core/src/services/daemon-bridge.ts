/**
 * @neolith/core - DaemonBridge
 *
 * HTTP client for the orchestrator daemon's REST API endpoints.
 * Allows the Neolith web app to communicate with the daemon for
 * health checks, agent management, traffic control, channel monitoring,
 * and metrics collection.
 *
 * @packageDocumentation
 */

// =============================================================================
// Error Classes
// =============================================================================

export class DaemonBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DaemonBridgeError';
  }
}

export class DaemonUnreachableError extends DaemonBridgeError {
  constructor(baseUrl: string, cause?: string) {
    super(`Daemon unreachable at ${baseUrl}${cause ? `: ${cause}` : ''}`);
    this.name = 'DaemonUnreachableError';
  }
}

export class DaemonResponseError extends DaemonBridgeError {
  constructor(status: number, path: string, body: string) {
    super(`Daemon returned ${status} for ${path}: ${body}`);
    this.name = 'DaemonResponseError';
  }
}

// =============================================================================
// Types
// =============================================================================

export interface DaemonHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  lastHeartbeat: string;
  components: Record<string, { status: string; latency?: number }>;
}

export interface DaemonStatus {
  running: boolean;
  activeAgents: number;
  totalChannels: number;
  messagesProcessed: number;
  startedAt: string;
}

export interface DaemonAgent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  discipline: string;
  capabilities: string[];
  currentLoad: number;
  lastActivity: string;
}

export interface DaemonChannel {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  messageCount: number;
}

export interface DaemonMetrics {
  cpu: number;
  memory: number;
  messagesPerMinute: number;
  averageLatencyMs: number;
  errorRate: number;
  activeConnections: number;
}

export interface AgentMetrics {
  messagesHandled: number;
  averageResponseTime: number;
  errorCount: number;
  tokenUsage: number;
}

// =============================================================================
// IDaemonBridge Interface
// =============================================================================

export interface IDaemonBridge {
  // Health & Status
  getHealth(): Promise<DaemonHealth>;
  getStatus(): Promise<DaemonStatus>;

  // Agent Management
  listAgents(): Promise<DaemonAgent[]>;
  getAgent(agentId: string): Promise<DaemonAgent>;
  restartAgent(agentId: string): Promise<void>;

  // Traffic Manager
  getTrafficConfig(): Promise<unknown>;
  updateTrafficConfig(config: Record<string, unknown>): Promise<void>;

  // Channel Management
  listChannels(): Promise<DaemonChannel[]>;
  getChannelHealth(channelId: string): Promise<{ healthy: boolean; latency: number }>;

  // Metrics
  getMetrics(): Promise<DaemonMetrics>;
  getAgentMetrics(agentId: string): Promise<AgentMetrics>;
}

// =============================================================================
// DaemonBridgeImpl Implementation
// =============================================================================

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * DaemonBridgeImpl communicates with the orchestrator daemon over HTTP REST,
 * providing access to health, agent, traffic, channel, and metrics endpoints.
 */
export class DaemonBridgeImpl implements IDaemonBridge {
  private readonly baseUrl: string;
  private readonly secret: string | undefined;
  private readonly timeoutMs: number;

  /**
   * Creates a new DaemonBridgeImpl instance.
   *
   * @param baseUrl - Base URL of the daemon REST API (defaults to DAEMON_API_URL env var or http://localhost:4000)
   * @param timeoutMs - Request timeout in milliseconds (default: 10000)
   */
  constructor(
    baseUrl: string = process.env.DAEMON_API_URL ?? 'http://localhost:4000',
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = process.env.DAEMON_API_SECRET;
    this.timeoutMs = timeoutMs;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.secret) {
      headers['Authorization'] = `Bearer ${this.secret}`;
    }
    return headers;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new DaemonUnreachableError(
        this.baseUrl,
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new DaemonResponseError(response.status, path, text);
    }

    // 204 No Content — resolve with undefined cast to T
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  getHealth(): Promise<DaemonHealth> {
    return this.request<DaemonHealth>('GET', '/api/health');
  }

  getStatus(): Promise<DaemonStatus> {
    return this.request<DaemonStatus>('GET', '/api/status');
  }

  // ===========================================================================
  // Agent Management
  // ===========================================================================

  listAgents(): Promise<DaemonAgent[]> {
    return this.request<DaemonAgent[]>('GET', '/api/agents');
  }

  getAgent(agentId: string): Promise<DaemonAgent> {
    return this.request<DaemonAgent>('GET', `/api/agents/${encodeURIComponent(agentId)}`);
  }

  async restartAgent(agentId: string): Promise<void> {
    await this.request<void>(
      'POST',
      `/api/agents/${encodeURIComponent(agentId)}/restart`
    );
  }

  // ===========================================================================
  // Traffic Manager
  // ===========================================================================

  getTrafficConfig(): Promise<unknown> {
    return this.request<unknown>('GET', '/api/traffic/config');
  }

  async updateTrafficConfig(config: Record<string, unknown>): Promise<void> {
    await this.request<void>('PUT', '/api/traffic/config', config);
  }

  // ===========================================================================
  // Channel Management
  // ===========================================================================

  listChannels(): Promise<DaemonChannel[]> {
    return this.request<DaemonChannel[]>('GET', '/api/channels');
  }

  getChannelHealth(channelId: string): Promise<{ healthy: boolean; latency: number }> {
    return this.request<{ healthy: boolean; latency: number }>(
      'GET',
      `/api/channels/${encodeURIComponent(channelId)}/health`
    );
  }

  // ===========================================================================
  // Metrics
  // ===========================================================================

  getMetrics(): Promise<DaemonMetrics> {
    return this.request<DaemonMetrics>('GET', '/api/metrics');
  }

  getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    return this.request<AgentMetrics>(
      'GET',
      `/api/agents/${encodeURIComponent(agentId)}/metrics`
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new DaemonBridge instance.
 *
 * @param baseUrl - Optional base URL override for the daemon REST API
 * @returns DaemonBridgeImpl instance
 *
 * @example
 * ```typescript
 * const bridge = createDaemonBridge();
 *
 * const health = await bridge.getHealth();
 * console.log(health.status); // 'healthy'
 *
 * const agents = await bridge.listAgents();
 * await bridge.restartAgent(agents[0].id);
 * ```
 */
export function createDaemonBridge(baseUrl?: string): DaemonBridgeImpl {
  return new DaemonBridgeImpl(baseUrl);
}

// =============================================================================
// Singleton
// =============================================================================

let instance: IDaemonBridge | null = null;

/**
 * Initialises the singleton DaemonBridge instance.
 * Call this once at application startup.
 *
 * @param baseUrl - Optional base URL override for the daemon REST API
 */
export function initDaemonBridge(baseUrl?: string): IDaemonBridge {
  instance = createDaemonBridge(baseUrl);
  return instance;
}

/**
 * Returns the singleton DaemonBridge instance.
 *
 * @throws {DaemonBridgeError} If the bridge has not been initialised via initDaemonBridge()
 */
export function getDaemonBridge(): IDaemonBridge {
  if (!instance) {
    throw new DaemonBridgeError(
      'DaemonBridge has not been initialised. Call initDaemonBridge() first.'
    );
  }
  return instance;
}
