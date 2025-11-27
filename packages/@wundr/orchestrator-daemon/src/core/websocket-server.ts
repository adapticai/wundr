/**
 * WebSocket Server for Orchestrator Daemon communication
 */

import * as http from 'http';

import { EventEmitter } from 'eventemitter3';
import { Server as WebSocketServer, WebSocket } from 'ws';

import { Logger } from '../utils/logger';

import type { WSMessage, WSResponse } from '../types';

export class OrchestratorWebSocketServer extends EventEmitter {
  private logger: Logger;
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private clients: Set<WebSocket>;
  private port: number;
  private host: string;

  constructor(port: number, host: string) {
    super();
    this.logger = new Logger('WebSocketServer');
    this.clients = new Set();
    this.port = port;
    this.host = host;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });

        this.wss.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error: Error) => {
          this.logger.error('WebSocket server error:', error);
          this.emit('error', error);
        });

        // Start listening
        this.httpServer.listen(this.port, this.host, () => {
          this.logger.info(`WebSocket server started on ${this.host}:${this.port}`);
          resolve();
        });

        this.httpServer.on('error', (error) => {
          this.logger.error('HTTP server error:', error);
          reject(error);
        });
      } catch (error) {
        this.logger.error('Failed to start WebSocket server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.info('Stopping WebSocket server...');

      // Close all client connections
      this.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          this.logger.debug('WebSocket server closed');
        });
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.logger.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.logger.debug('New WebSocket connection');
    this.clients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        this.logger.error('Failed to parse message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.logger.debug('WebSocket connection closed');
      this.clients.delete(ws);
    });

    ws.on('error', (error: Error) => {
      this.logger.error('WebSocket connection error:', error);
      this.clients.delete(ws);
    });

    // Send initial connection acknowledgment
    this.send(ws, { type: 'health_check_response', healthy: true });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    this.logger.debug('Received message:', message.type);

    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      case 'spawn_session':
        this.emit('spawn_session', { ws, payload: message.payload });
        break;

      case 'session_status':
        this.emit('session_status', { ws, sessionId: message.payload.sessionId });
        break;

      case 'daemon_status':
        this.emit('daemon_status', { ws });
        break;

      case 'stop_session':
        this.emit('stop_session', { ws, sessionId: message.payload.sessionId });
        break;

      case 'health_check':
        this.send(ws, { type: 'health_check_response', healthy: true });
        break;

      default:
        this.logger.warn('Unknown message type:', (message as WSMessage).type);
        this.sendError(ws, 'Unknown message type');
    }
  }

  /**
   * Send message to client
   */
  send(ws: WebSocket, message: WSResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  sendError(ws: WebSocket, error: string): void {
    this.send(ws, { type: 'error', error });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSResponse): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
