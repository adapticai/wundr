/**
 * OrchestratorConnection - WebSocket connection to remote orchestrator
 * Handles message passing, capability checking, and delegation
 */

import { EventEmitter } from 'events';

import WebSocket from 'ws';

import type {
  FederationMessage,
  DelegationRequest,
  DelegationResponse,
  ConnectionStatus,
  OrchestratorCapability,
  ConnectionHealth,
  SerializedMessage,
  TaskCallback,
  BroadcastPayload,
  HeartbeatPayload,
} from './types';

/**
 * Configuration for OrchestratorConnection
 */
export interface OrchestratorConnectionConfig {
  id: string;
  socket: WebSocket.WebSocket;
  capabilities: OrchestratorCapability[];
  heartbeatTimeout?: number; // milliseconds before connection considered unhealthy
  maxQueueSize?: number;
}

/**
 * OrchestratorConnection events
 */
export interface OrchestratorConnectionEvents {
  message: (message: FederationMessage) => void;
  error: (error: Error) => void;
  close: (code: number, reason: string) => void;
  heartbeat: (timestamp: Date) => void;
  delegation: (request: DelegationRequest) => void;
  callback: (callback: TaskCallback) => void;
  status: (status: ConnectionHealth) => void;
  broadcast: (payload: BroadcastPayload) => void;
}

/**
 * OrchestratorConnection class
 * Manages connection to a remote orchestrator in the federation
 */
export class OrchestratorConnection extends EventEmitter {
  public readonly id: string;
  public readonly socket: WebSocket.WebSocket;
  public readonly capabilities: OrchestratorCapability[];

  private _status: ConnectionStatus;
  private _lastHeartbeat: Date;
  private _messageQueue: FederationMessage[];
  private _connectedAt: Date;
  private _messagesSent: number;
  private _messagesReceived: number;
  private _errors: number;
  private _heartbeatTimeout: number;
  private _maxQueueSize: number;
  private _heartbeatTimer?: NodeJS.Timeout;

  constructor(config: OrchestratorConnectionConfig) {
    super();

    this.id = config.id;
    this.socket = config.socket;
    this.capabilities = config.capabilities;

    this._status = 'connecting';
    this._lastHeartbeat = new Date();
    this._messageQueue = [];
    this._connectedAt = new Date();
    this._messagesSent = 0;
    this._messagesReceived = 0;
    this._errors = 0;
    this._heartbeatTimeout = config.heartbeatTimeout || 60000; // 60 seconds default
    this._maxQueueSize = config.maxQueueSize || 1000;

    this._setupSocketHandlers();
    this._startHeartbeatMonitor();
  }

  /**
   * Setup WebSocket event handlers
   */
  private _setupSocketHandlers(): void {
    this.socket.on('open', () => {
      this._status = 'connected';
      this._lastHeartbeat = new Date();
    });

    this.socket.on('message', (data: WebSocket.Data) => {
      try {
        const message = this._deserializeMessage(data.toString());
        this._messagesReceived++;
        this._handleIncomingMessage(message);
      } catch (error) {
        this._errors++;
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.socket.on('error', (error: Error) => {
      this._errors++;
      this._status = 'error';
      this.emit('error', error);
    });

    this.socket.on('close', (code: number, reason: Buffer) => {
      this._status = 'disconnected';
      this._stopHeartbeatMonitor();
      this.emit('close', code, reason.toString());
    });

    this.socket.on('pong', () => {
      this._lastHeartbeat = new Date();
    });
  }

  /**
   * Handle incoming messages and route by type
   */
  private _handleIncomingMessage(message: FederationMessage): void {
    this.emit('message', message);

    switch (message.type) {
      case 'heartbeat':
        this._handleHeartbeatMessage(message);
        break;

      case 'delegation':
        this._handleDelegationMessage(message);
        break;

      case 'callback':
        this._handleCallbackMessage(message);
        break;

      case 'status':
        this._handleStatusMessage(message);
        break;

      case 'broadcast':
        this._handleBroadcastMessage(message);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle heartbeat messages
   */
  private _handleHeartbeatMessage(message: FederationMessage): void {
    const payload = message.payload as HeartbeatPayload;
    this._lastHeartbeat = new Date(payload.timestamp);
    this.emit('heartbeat', this._lastHeartbeat);

    // Update connection status based on heartbeat payload
    if (payload.status === 'degraded') {
      this._status = 'degraded';
    } else if (payload.status === 'overloaded') {
      this._status = 'degraded';
    } else if (this._status !== 'active' && this._status !== 'idle') {
      this._status = 'connected';
    }
  }

  /**
   * Handle delegation messages
   */
  private _handleDelegationMessage(message: FederationMessage): void {
    const request = message.payload as DelegationRequest;
    this.emit('delegation', request);
  }

  /**
   * Handle callback messages
   */
  private _handleCallbackMessage(message: FederationMessage): void {
    const callback = message.payload as TaskCallback;
    this.emit('callback', callback);
  }

  /**
   * Handle status messages
   */
  private _handleStatusMessage(message: FederationMessage): void {
    const status = message.payload as ConnectionHealth;
    this.emit('status', status);
  }

  /**
   * Handle broadcast messages
   */
  private _handleBroadcastMessage(message: FederationMessage): void {
    const payload = message.payload as BroadcastPayload;
    this.emit('broadcast', payload);
  }

  /**
   * Start heartbeat monitoring
   */
  private _startHeartbeatMonitor(): void {
    this._heartbeatTimer = setInterval(() => {
      if (!this.isHealthy()) {
        this._status = 'degraded';
        this.emit('error', new Error(`No heartbeat received from ${this.id} for ${this._heartbeatTimeout}ms`));
      }

      // Send WebSocket ping
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.ping();
      }
    }, this._heartbeatTimeout / 2);
  }

  /**
   * Stop heartbeat monitoring
   */
  private _stopHeartbeatMonitor(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }
  }

  /**
   * Serialize message for WebSocket transmission
   */
  private _serializeMessage(message: FederationMessage): string {
    const serialized: SerializedMessage = {
      type: message.type,
      payload: JSON.stringify(message.payload),
      from: message.from,
      to: message.to,
      timestamp: message.timestamp.toISOString(),
      correlationId: message.correlationId,
    };

    return JSON.stringify(serialized);
  }

  /**
   * Deserialize message from WebSocket
   */
  private _deserializeMessage(data: string): FederationMessage {
    const serialized = JSON.parse(data) as SerializedMessage;

    return {
      type: serialized.type,
      payload: JSON.parse(serialized.payload),
      from: serialized.from,
      to: serialized.to,
      timestamp: new Date(serialized.timestamp),
      correlationId: serialized.correlationId,
    };
  }

  /**
   * Check if orchestrator has all required capabilities
   */
  public checkCapability(required: OrchestratorCapability[]): boolean {
    return required.every((cap) => this.capabilities.includes(cap));
  }

  /**
   * Accept a delegated task
   */
  public async acceptDelegation(request: DelegationRequest): Promise<DelegationResponse> {
    // Check if connection is healthy
    if (!this.isHealthy()) {
      return {
        taskId: request.task.id,
        accepted: false,
        reason: 'Connection unhealthy',
      };
    }

    // Accept the delegation
    const response: DelegationResponse = {
      taskId: request.task.id,
      accepted: true,
    };

    // Send acceptance message
    await this.sendMessage({
      type: 'callback',
      payload: response,
      from: this.id,
      to: request.fromOrchestratorId,
      timestamp: new Date(),
      correlationId: request.task.id,
    });

    return response;
  }

  /**
   * Send a message to the connected orchestrator
   */
  public async sendMessage(message: FederationMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.readyState !== WebSocket.OPEN) {
        // Queue message if connection not open
        if (this._messageQueue.length < this._maxQueueSize) {
          this._messageQueue.push(message);
          resolve();
        } else {
          reject(new Error(`Message queue full (${this._maxQueueSize})`));
        }
        return;
      }

      try {
        const serialized = this._serializeMessage(message);
        this.socket.send(serialized, (error) => {
          if (error) {
            this._errors++;
            reject(error);
          } else {
            this._messagesSent++;
            this._status = 'active';
            resolve();
          }
        });
      } catch (error) {
        this._errors++;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Get connection status and health info
   */
  public getStatus(): ConnectionHealth {
    const now = new Date();
    const uptime = now.getTime() - this._connectedAt.getTime();

    return {
      status: this._status,
      uptime,
      lastHeartbeat: this._lastHeartbeat,
      messagesSent: this._messagesSent,
      messagesReceived: this._messagesReceived,
      errors: this._errors,
    };
  }

  /**
   * Update last heartbeat timestamp
   */
  public handleHeartbeat(): void {
    this._lastHeartbeat = new Date();
    this.emit('heartbeat', this._lastHeartbeat);
  }

  /**
   * Check if connection is active and responsive
   */
  public isHealthy(): boolean {
    // Check if socket is open
    if (this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Check if heartbeat is recent
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - this._lastHeartbeat.getTime();

    if (timeSinceHeartbeat > this._heartbeatTimeout) {
      return false;
    }

    // Check status
    if (this._status === 'disconnected' || this._status === 'error') {
      return false;
    }

    return true;
  }

  /**
   * Gracefully disconnect from orchestrator
   */
  public async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this._stopHeartbeatMonitor();

      // Send any queued messages before closing
      const sendQueued = async () => {
        while (this._messageQueue.length > 0 && this.socket.readyState === WebSocket.OPEN) {
          const message = this._messageQueue.shift();
          if (message) {
            try {
              await this.sendMessage(message);
            } catch (error) {
              console.error('Failed to send queued message:', error);
            }
          }
        }
      };

      sendQueued()
        .then(() => {
          this._status = 'disconnected';
          this.socket.close(1000, 'Graceful disconnect');

          // Give socket time to close
          setTimeout(() => {
            this.removeAllListeners();
            resolve();
          }, 100);
        })
        .catch((error) => {
          console.error('Error during disconnect:', error);
          this.socket.close(1000, 'Graceful disconnect');
          this.removeAllListeners();
          resolve();
        });
    });
  }

  /**
   * Get current connection status
   */
  public get status(): ConnectionStatus {
    return this._status;
  }

  /**
   * Get last heartbeat timestamp
   */
  public get lastHeartbeat(): Date {
    return this._lastHeartbeat;
  }

  /**
   * Get message queue
   */
  public get messageQueue(): readonly FederationMessage[] {
    return Object.freeze([...this._messageQueue]);
  }
}
