/**
 * DaemonNode - Represents a single daemon instance in distributed cluster
 * Handles inter-node communication, session spawning, and health monitoring
 */

import { EventEmitter } from 'eventemitter3';
import WebSocket = require('ws');
import type { Session, Task } from '../types';

/**
 * Node capabilities define what operations this node can perform
 */
export interface NodeCapabilities {
  canSpawnSessions: boolean;
  maxConcurrentSessions: number;
  supportedSessionTypes: Array<'claude-code' | 'claude-flow'>;
  hasGPUAccess: boolean;
  hasHighMemory: boolean;
  customCapabilities?: Record<string, boolean>;
}

/**
 * Node health metrics
 */
export interface NodeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  cpuUsage: number; // 0-100
  memoryUsage: number; // 0-100
  activeSessions: number;
  responseTime: number; // milliseconds
  lastHeartbeat: Date;
  uptime: number; // seconds
}

/**
 * Session spawn request
 */
export interface SessionSpawnRequest {
  orchestratorId: string;
  task: Task;
  sessionType: 'claude-code' | 'claude-flow';
  memoryProfile?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Serialized session state for restoration
 */
export interface SerializedSession {
  session: Session;
  memorySnapshot: Record<string, unknown>;
  metadata: {
    serializedAt: Date;
    nodeId: string;
    version: string;
  };
}

/**
 * WebSocket message types for inter-node communication
 */
type NodeMessage =
  | { type: 'heartbeat'; timestamp: number; health: NodeHealth }
  | { type: 'heartbeat_ack'; timestamp: number }
  | { type: 'spawn_session'; request: SessionSpawnRequest }
  | { type: 'session_spawned'; sessionId: string; session: Session }
  | { type: 'get_session'; sessionId: string }
  | { type: 'session_state'; sessionId: string; session: Session | null }
  | { type: 'terminate_session'; sessionId: string }
  | { type: 'session_terminated'; sessionId: string; success: boolean }
  | { type: 'restore_session'; serializedSession: SerializedSession }
  | { type: 'session_restored'; sessionId: string; success: boolean }
  | { type: 'get_health' }
  | { type: 'health_response'; health: NodeHealth }
  | { type: 'get_sessions' }
  | { type: 'sessions_response'; sessions: Session[] }
  | { type: 'error'; error: string; requestType?: string };

/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * DaemonNode - Represents a single daemon instance in the distributed cluster
 */
export class DaemonNode extends EventEmitter {
  private id: string;
  private host: string;
  private port: number;
  private capabilities: NodeCapabilities;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 60000; // 60 seconds
  private messageQueue: NodeMessage[] = [];
  private maxQueueSize = 1000;
  private lastHeartbeatReceived: Date | null = null;
  private lastHeartbeatSent: Date | null = null;
  private pendingRequests: Map<string, (response: NodeMessage) => void> = new Map();
  private healthMetrics: NodeHealth = {
    status: 'offline',
    cpuUsage: 0,
    memoryUsage: 0,
    activeSessions: 0,
    responseTime: 0,
    lastHeartbeat: new Date(),
    uptime: 0,
  };

  constructor(id: string, host: string, port: number, capabilities: NodeCapabilities) {
    super();
    this.id = id;
    this.host = host;
    this.port = port;
    this.capabilities = capabilities;
  }

  /**
   * Get node ID
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get node capabilities
   */
  public getCapabilities(): NodeCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Get connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Connect to the daemon node
   */
  public async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    this.emit('connecting', { nodeId: this.id });

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${this.host}:${this.port}`;

      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.on('open', () => {
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.emit('connected', { nodeId: this.id });
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        });

        ws.on('message', (data: WebSocket.RawData) => {
          this.handleMessage(data);
        });

        ws.on('close', () => {
          this.handleDisconnection();
        });

        ws.on('error', (error: Error) => {
          this.emit('error', { nodeId: this.id, error });
          if (this.connectionState === 'connecting') {
            reject(error);
          } else {
            this.handleDisconnection();
          }
        });

        // Connection timeout
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            this.ws?.close();
            reject(new Error(`Connection timeout for node ${this.id}`));
          }
        }, 10000);
      } catch (error) {
        this.connectionState = 'failed';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the daemon node
   */
  public async disconnect(): Promise<void> {
    if (this.connectionState === 'disconnected') {
      return;
    }

    this.stopHeartbeat();
    this.stopReconnect();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.healthMetrics.status = 'offline';
    this.emit('disconnected', { nodeId: this.id });
  }

  /**
   * Spawn a session on this node
   */
  public async spawnSession(request: SessionSpawnRequest): Promise<Session> {
    if (!this.capabilities.canSpawnSessions) {
      throw new Error(`Node ${this.id} does not support session spawning`);
    }

    if (!this.capabilities.supportedSessionTypes.includes(request.sessionType)) {
      throw new Error(
        `Node ${this.id} does not support session type: ${request.sessionType}`,
      );
    }

    const message: NodeMessage = {
      type: 'spawn_session',
      request,
    };

    const response = await this.sendRequest(message);

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    if (response.type === 'session_spawned') {
      this.emit('session-spawned', {
        nodeId: this.id,
        sessionId: response.sessionId,
        session: response.session,
      });
      return response.session;
    }

    throw new Error('Unexpected response type for spawn_session');
  }

  /**
   * Get session state from this node
   */
  public async getSession(sessionId: string): Promise<Session | null> {
    const message: NodeMessage = {
      type: 'get_session',
      sessionId,
    };

    const response = await this.sendRequest(message);

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    if (response.type === 'session_state') {
      return response.session;
    }

    throw new Error('Unexpected response type for get_session');
  }

  /**
   * Terminate a specific session on this node
   */
  public async terminateSession(sessionId: string): Promise<boolean> {
    const message: NodeMessage = {
      type: 'terminate_session',
      sessionId,
    };

    const response = await this.sendRequest(message);

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    if (response.type === 'session_terminated') {
      this.emit('session-terminated', {
        nodeId: this.id,
        sessionId,
        success: response.success,
      });
      return response.success;
    }

    throw new Error('Unexpected response type for terminate_session');
  }

  /**
   * Restore a session from serialized state
   */
  public async restoreSession(serializedSession: SerializedSession): Promise<boolean> {
    const message: NodeMessage = {
      type: 'restore_session',
      serializedSession,
    };

    const response = await this.sendRequest(message);

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    if (response.type === 'session_restored') {
      this.emit('session-restored', {
        nodeId: this.id,
        sessionId: response.sessionId,
        success: response.success,
      });
      return response.success;
    }

    throw new Error('Unexpected response type for restore_session');
  }

  /**
   * Get node health metrics
   */
  public async getHealth(): Promise<NodeHealth> {
    if (this.connectionState !== 'connected') {
      return { ...this.healthMetrics, status: 'offline' };
    }

    const message: NodeMessage = {
      type: 'get_health',
    };

    try {
      const response = await this.sendRequest(message, 5000);

      if (response.type === 'error') {
        return { ...this.healthMetrics, status: 'unhealthy' };
      }

      if (response.type === 'health_response') {
        this.healthMetrics = response.health;
        return response.health;
      }
    } catch (error) {
      return { ...this.healthMetrics, status: 'offline' };
    }

    return this.healthMetrics;
  }

  /**
   * Get all sessions on this node
   */
  public async getSessions(): Promise<Session[]> {
    const message: NodeMessage = {
      type: 'get_sessions',
    };

    const response = await this.sendRequest(message);

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    if (response.type === 'sessions_response') {
      return response.sessions;
    }

    throw new Error('Unexpected response type for get_sessions');
  }

  /**
   * Get cached health metrics (synchronous)
   */
  public getCachedHealth(): NodeHealth {
    return { ...this.healthMetrics };
  }

  /**
   * Check if node is healthy
   */
  public isHealthy(): boolean {
    return (
      this.connectionState === 'connected' &&
      (this.healthMetrics.status === 'healthy' || this.healthMetrics.status === 'degraded')
    );
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(message: NodeMessage, timeout = 30000): Promise<NodeMessage> {
    return new Promise((resolve, reject) => {
      const requestId = `${message.type}_${Date.now()}_${Math.random()}`;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${message.type}`));
      }, timeout);

      this.pendingRequests.set(requestId, (response: NodeMessage) => {
        clearTimeout(timeoutHandle);
        resolve(response);
      });

      this.sendMessage({ ...message, requestId } as any);
    });
  }

  /**
   * Send a message to the node
   */
  private sendMessage(message: NodeMessage & { requestId?: string }): void {
    if (this.connectionState !== 'connected' || !this.ws) {
      // Queue message for later
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push(message);
      } else {
        this.emit('error', {
          nodeId: this.id,
          error: new Error('Message queue full'),
        });
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.emit('error', {
        nodeId: this.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as NodeMessage & { requestId?: string };

      // Handle heartbeat responses
      if (message.type === 'heartbeat_ack') {
        this.lastHeartbeatReceived = new Date();
        return;
      }

      if (message.type === 'heartbeat') {
        this.lastHeartbeatReceived = new Date();
        this.healthMetrics = message.health;
        this.sendMessage({ type: 'heartbeat_ack', timestamp: Date.now() });
        return;
      }

      // Handle request responses
      if (message.requestId) {
        const handler = this.pendingRequests.get(message.requestId);
        if (handler) {
          this.pendingRequests.delete(message.requestId);
          handler(message);
          return;
        }
      }

      // Emit as event for unsolicited messages
      this.emit('message', { nodeId: this.id, message });
    } catch (error) {
      this.emit('error', {
        nodeId: this.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    if (this.connectionState === 'disconnected') {
      return;
    }

    this.stopHeartbeat();
    this.connectionState = 'reconnecting';
    this.healthMetrics.status = 'offline';
    this.emit('disconnected', { nodeId: this.id });

    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionState = 'failed';
      this.emit('reconnect-failed', {
        nodeId: this.id,
        attempts: this.reconnectAttempts,
      });
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, will try again via handleDisconnection
      });
    }, delay);

    this.emit('reconnecting', {
      nodeId: this.id,
      attempt: this.reconnectAttempts,
      delay,
    });
  }

  /**
   * Stop reconnection attempts
   */
  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.lastHeartbeatSent = new Date();
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now(),
          health: this.healthMetrics,
        });

        // Check if heartbeat is too old
        if (
          this.lastHeartbeatReceived &&
          Date.now() - this.lastHeartbeatReceived.getTime() > 60000
        ) {
          this.handleDisconnection();
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.disconnect();
    this.pendingRequests.clear();
    this.messageQueue = [];
    this.removeAllListeners();
  }
}
