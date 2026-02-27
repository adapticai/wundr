/**
 * Daemon Client - WebSocket client for communicating with orchestrator daemon
 */

// =============================================================================
// Core Types
// =============================================================================

export type DaemonMessage = {
  type: string;
  payload: unknown;
  id?: string;
};

export type DaemonEvent =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'reconnecting'
  | 'session_spawned'
  | 'session_updated'
  | 'daemon_status'
  | 'stream_start'
  | 'stream_chunk'
  | 'stream_end'
  | 'tool_call_start'
  | 'tool_call_result'
  | 'task_executing'
  | 'task_completed'
  | 'task_failed';

// Event payload type mapping
export interface DaemonEventPayloadMap {
  connected: void;
  disconnected: void;
  error: Error;
  message: DaemonMessage;
  reconnecting: number; // attempt number
  session_spawned: Session;
  session_updated: Session;
  daemon_status: DaemonStatus;
  stream_start: { sessionId: string; metadata?: Record<string, unknown> };
  stream_chunk: StreamChunk;
  stream_end: { sessionId: string; metadata?: Record<string, unknown> };
  tool_call_start: ToolCallInfo;
  tool_call_result: ToolCallInfo;
  task_executing: { sessionId: string; taskId: string };
  task_completed: { sessionId: string; taskId: string; result?: unknown };
  task_failed: { sessionId: string; taskId: string; error: string };
}

export type DaemonEventHandler<E extends DaemonEvent> =
  DaemonEventPayloadMap[E] extends void
    ? () => void
    : (data: DaemonEventPayloadMap[E]) => void;

// =============================================================================
// Session & Task Types
// =============================================================================

export interface SessionMetrics {
  tokensUsed: number;
  duration: number;
  tasksCompleted: number;
  errorsEncountered: number;
}

export interface Session {
  id: string;
  orchestratorId: string;
  status: 'active' | 'idle' | 'completed' | 'failed';
  sessionType: 'claude-code' | 'claude-chat' | 'custom';
  createdAt: string;
  startedAt: string | Date;
  metadata?: Record<string, unknown>;
  metrics: SessionMetrics;
  task?: Task;
  type?: string;
}

export interface Task {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface SpawnSessionPayload {
  orchestratorId: string;
  task: Task;
  sessionType?: 'claude-code' | 'claude-chat' | 'custom';
  metadata?: Record<string, unknown>;
  memoryProfile?: Record<string, unknown>;
}

export interface ExecuteTaskPayload {
  sessionId: string;
  task: Task;
  streamOutput?: boolean;
}

// =============================================================================
// Status & Monitoring Types
// =============================================================================

export interface DaemonMetrics {
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  activeConnections?: number;
  messagesProcessed?: number;
  errorsCount?: number;
  uptimeSeconds?: number;
  lastTaskCompletedAt?: string;
  queueDepth?: number;
  totalSessionsSpawned: number;
  totalTasksProcessed: number;
  totalTokensUsed: number;
  successRate: number;
  averageSessionDuration: number;
}

export interface SubsystemStatus {
  status: 'running' | 'error' | 'stopped';
  errors?: string[];
}

export interface DaemonStatus {
  status: 'running' | 'idle' | 'error';
  activeSessions: number;
  uptime: number;
  queuedTasks: number;
  version?: string;
  metrics: DaemonMetrics;
  subsystems: Record<string, SubsystemStatus>;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  sessionId: string;
  chunk: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallInfo {
  sessionId: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: string;
  status: string;
}

export class DaemonClient {
  private ws: WebSocket | null = null;
  private url: string;
  private apiUrl: string;
  private listeners: Map<DaemonEvent, Set<DaemonEventHandler<any>>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private manualDisconnect = false;

  constructor(url: string, apiUrl?: string) {
    this.url = url;
    this.apiUrl =
      apiUrl ??
      (typeof process !== 'undefined'
        ? (process.env.DAEMON_API_URL ?? 'http://localhost:8766')
        : 'http://localhost:8766');
    console.log(
      '[DaemonClient] Initialized with URL:',
      url,
      'API URL:',
      this.apiUrl
    );
  }

  connect(): Promise<void> {
    console.log('[DaemonClient] Connecting to daemon...');
    return new Promise((resolve, reject) => {
      try {
        this.manualDisconnect = false;
        this.ws = new WebSocket(this.url);

        const onOpen = () => {
          cleanup();
          this.handleOpen();
          resolve();
        };

        const onError = (event: Event) => {
          cleanup();
          const err = new Error('WebSocket connection failed');
          this.handleError(event);
          reject(err);
        };

        // Attach one-time handlers for the initial connection attempt so we
        // can resolve/reject the promise, then hand off to the persistent
        // lifecycle handlers.
        const cleanup = () => {
          this.ws?.removeEventListener('open', onOpen);
          this.ws?.removeEventListener('error', onError);
        };

        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('error', onError);

        // Persistent lifecycle handlers (always active after attachment).
        this.ws.onmessage = event => this.handleMessage(event);
        this.ws.onerror = event => this.handleError(event);
        this.ws.onclose = () => this.handleClose();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  disconnect(): void {
    console.log('[DaemonClient] Disconnecting from daemon...');
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: DaemonMessage): void {
    console.log('[DaemonClient] Sending message:', message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[DaemonClient] Cannot send message: WebSocket is not open');
    }
  }

  on<E extends DaemonEvent>(event: E, handler: DaemonEventHandler<E>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }

  off<E extends DaemonEvent>(event: E, handler: DaemonEventHandler<E>): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit<E extends DaemonEvent>(
    event: E,
    ...args: DaemonEventPayloadMap[E] extends void
      ? []
      : [DaemonEventPayloadMap[E]]
  ): void {
    this.listeners.get(event)?.forEach(handler => {
      if (args.length > 0) {
        (handler as (data: any) => void)(args[0]);
      } else {
        (handler as () => void)();
      }
    });
  }

  private handleOpen(): void {
    console.log('[DaemonClient] Connected to daemon');
    this.reconnectAttempts = 0;
    this.emit('connected');
  }

  private handleMessage(event: MessageEvent): void {
    console.log('[DaemonClient] Received message:', event.data);
    try {
      const message: DaemonMessage = JSON.parse(event.data as string);
      // Always emit the raw message for generic subscribers.
      this.emit('message', message);
      // Route typed daemon events so consumers can subscribe by event name
      // directly without inspecting the message envelope themselves.
      const typedEvent = message.type as DaemonEvent;
      if (typedEvent && this.listeners.has(typedEvent)) {
        this.emit(typedEvent as any, message.payload as any);
      }
    } catch (err) {
      console.error('[DaemonClient] Failed to parse incoming message:', err);
      this.emit(
        'error',
        new Error(`Failed to parse WebSocket message: ${String(err)}`)
      );
    }
  }

  private handleError(error: Event): void {
    console.error('[DaemonClient] WebSocket error:', error);
    this.emit(
      'error',
      error instanceof Error ? error : new Error('WebSocket error')
    );
  }

  private handleClose(): void {
    console.log('[DaemonClient] Disconnected from daemon');
    this.emit('disconnected');
    if (!this.manualDisconnect) {
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(
        `[DaemonClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
      );
      this.emit('reconnecting', this.reconnectAttempts);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    } else {
      console.error('[DaemonClient] Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // =============================================================================
  // Session Management Methods
  // =============================================================================

  async spawnSession(payload: SpawnSessionPayload): Promise<Session> {
    console.log('[DaemonClient] Spawning session:', payload);
    const response = await fetch(`${this.apiUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to spawn session (${response.status}): ${text}`);
    }
    const session: Session = await response.json();
    this.emit('session_spawned', session);
    return session;
  }

  async executeTask(payload: ExecuteTaskPayload): Promise<void> {
    console.log('[DaemonClient] Executing task:', payload);
    const response = await fetch(
      `${this.apiUrl}/sessions/${encodeURIComponent(payload.sessionId)}/tasks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to execute task (${response.status}): ${text}`);
    }
  }

  async getSessionStatus(sessionId: string): Promise<Session> {
    console.log('[DaemonClient] Getting session status:', sessionId);
    const response = await fetch(
      `${this.apiUrl}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(
        `Failed to get session status (${response.status}): ${text}`
      );
    }
    const session: Session = await response.json();
    this.emit('session_updated', session);
    return session;
  }

  async getDaemonStatus(): Promise<DaemonStatus> {
    console.log('[DaemonClient] Getting daemon status');
    const response = await fetch(`${this.apiUrl}/status`, { method: 'GET' });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(
        `Failed to get daemon status (${response.status}): ${text}`
      );
    }
    const status: DaemonStatus = await response.json();
    this.emit('daemon_status', status);
    return status;
  }

  async stopSession(sessionId: string): Promise<void> {
    console.log('[DaemonClient] Stopping session:', sessionId);
    const response = await fetch(
      `${this.apiUrl}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to stop session (${response.status}): ${text}`);
    }
  }
}

// Singleton instance
let daemonClient: DaemonClient | null = null;

export function getDaemonClient(url?: string): DaemonClient {
  if (!daemonClient && url) {
    daemonClient = new DaemonClient(url);
  }
  if (!daemonClient) {
    const wsUrl =
      typeof process !== 'undefined'
        ? (process.env.DAEMON_WS_URL ?? 'ws://localhost:8765')
        : 'ws://localhost:8765';
    daemonClient = new DaemonClient(wsUrl);
  }
  return daemonClient;
}

export function createDaemonClient(url: string, apiUrl?: string): DaemonClient {
  return new DaemonClient(url, apiUrl);
}
