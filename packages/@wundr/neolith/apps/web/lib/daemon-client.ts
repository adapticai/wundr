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
  private listeners: Map<DaemonEvent, Set<DaemonEventHandler<any>>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    this.url = url;
    console.log('[DaemonClient] Initialized with URL:', url);
  }

  connect(): Promise<void> {
    console.log('[DaemonClient] Connecting to daemon...');
    return Promise.resolve();
    // TODO: Implement WebSocket connection
    // this.ws = new WebSocket(this.url);
    // this.ws.onopen = () => this.handleOpen();
    // this.ws.onmessage = (event) => this.handleMessage(event);
    // this.ws.onerror = (error) => this.handleError(error);
    // this.ws.onclose = () => this.handleClose();
  }

  disconnect(): void {
    console.log('[DaemonClient] Disconnecting from daemon...');
    // TODO: Implement WebSocket disconnection
    // if (this.ws) {
    //   this.ws.close();
    //   this.ws = null;
    // }
    // if (this.reconnectTimer) {
    //   clearTimeout(this.reconnectTimer);
    //   this.reconnectTimer = null;
    // }
  }

  send(message: DaemonMessage): void {
    console.log('[DaemonClient] Sending message:', message);
    // TODO: Implement message sending
    // if (this.ws?.readyState === WebSocket.OPEN) {
    //   this.ws.send(JSON.stringify(message));
    // }
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
    // TODO: Parse and emit message
    // const message = JSON.parse(event.data);
    // this.emit('message', message);
  }

  private handleError(error: Event): void {
    console.error('[DaemonClient] WebSocket error:', error);
    this.emit(
      'error',
      error instanceof Error ? error : new Error('WebSocket error'),
    );
  }

  private handleClose(): void {
    console.log('[DaemonClient] Disconnected from daemon');
    this.emit('disconnected');
    this.attemptReconnect();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(
        `[DaemonClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
      );
      this.emit('reconnecting', this.reconnectAttempts);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    } else {
      console.error('[DaemonClient] Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    // TODO: Implement connection status check
    // return this.ws?.readyState === WebSocket.OPEN;
    return false;
  }

  // =============================================================================
  // Session Management Methods
  // =============================================================================

  spawnSession(payload: SpawnSessionPayload): Promise<Session> {
    console.log('[DaemonClient] Spawning session:', payload);
    // TODO: Implement session spawning
    const now = new Date().toISOString();
    return Promise.resolve({
      id: `session_${Date.now()}`,
      orchestratorId: payload.orchestratorId,
      status: 'active',
      sessionType: payload.sessionType || 'claude-code',
      createdAt: now,
      startedAt: now,
      metadata: payload.metadata,
      metrics: {
        tokensUsed: 0,
        duration: 0,
        tasksCompleted: 0,
        errorsEncountered: 0,
      },
      task: payload.task,
      type: payload.sessionType || 'claude-code',
    });
  }

  executeTask(payload: ExecuteTaskPayload): void {
    console.log('[DaemonClient] Executing task:', payload);
    // TODO: Implement task execution
    this.send({
      type: 'execute_task',
      payload,
    });
  }

  getSessionStatus(sessionId: string): void {
    console.log('[DaemonClient] Getting session status:', sessionId);
    // TODO: Implement session status retrieval
    this.send({
      type: 'get_session_status',
      payload: { sessionId },
    });
  }

  getDaemonStatus(): void {
    console.log('[DaemonClient] Getting daemon status');
    // TODO: Implement daemon status retrieval
    this.send({
      type: 'get_daemon_status',
      payload: {},
    });
  }

  stopSession(sessionId: string): void {
    console.log('[DaemonClient] Stopping session:', sessionId);
    // TODO: Implement session stop
    this.send({
      type: 'stop_session',
      payload: { sessionId },
    });
  }
}

// Singleton instance
let daemonClient: DaemonClient | null = null;

export function getDaemonClient(url?: string): DaemonClient {
  if (!daemonClient && url) {
    daemonClient = new DaemonClient(url);
  }
  if (!daemonClient) {
    throw new Error('DaemonClient not initialized. Provide URL on first call.');
  }
  return daemonClient;
}

export function createDaemonClient(url: string): DaemonClient {
  return new DaemonClient(url);
}
