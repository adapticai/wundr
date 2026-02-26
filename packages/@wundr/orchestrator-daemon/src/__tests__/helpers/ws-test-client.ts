/**
 * WebSocket test client for protocol-level testing.
 *
 * Provides a promise-based API for connecting to the orchestrator daemon
 * WebSocket server, sending messages, and waiting for typed responses.
 *
 * Usage:
 *   const client = new WsTestClient();
 *   await client.connect(8787);
 *   client.send({ type: 'ping' });
 *   const pong = await client.waitForMessage('pong');
 *   expect(pong.type).toBe('pong');
 *   client.close();
 */

import WebSocket from 'ws';

import type { WSMessage, WSResponse } from '../../types';

export interface WsTestClientOptions {
  /** JWT bearer token for Authorization header. */
  token?: string;
  /** API key for x-api-key header. */
  apiKey?: string;
  /** Connection timeout in milliseconds. Default: 5000. */
  connectTimeout?: number;
  /** Default timeout for waitForMessage in milliseconds. Default: 5000. */
  messageTimeout?: number;
}

export class WsTestClient {
  private ws: WebSocket | null = null;
  private receivedMessages: WSResponse[] = [];
  private messageWaiters: Array<{
    resolve: (msg: WSResponse) => void;
    reject: (err: Error) => void;
    type?: string;
    timeout: NodeJS.Timeout;
  }> = [];
  private options: Required<WsTestClientOptions>;

  constructor(options?: WsTestClientOptions) {
    this.options = {
      token: options?.token ?? '',
      apiKey: options?.apiKey ?? '',
      connectTimeout: options?.connectTimeout ?? 5000,
      messageTimeout: options?.messageTimeout ?? 5000,
    };
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  /**
   * Connect to a WebSocket server.
   *
   * @param port - The port number.
   * @param host - The hostname. Default: 'localhost'.
   */
  async connect(port: number, host = 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (this.options.token) {
        headers['Authorization'] = `Bearer ${this.options.token}`;
      }
      if (this.options.apiKey) {
        headers['x-api-key'] = this.options.apiKey;
      }

      const timer = setTimeout(() => {
        reject(
          new Error(`Connection timeout after ${this.options.connectTimeout}ms`)
        );
      }, this.options.connectTimeout);

      this.ws = new WebSocket(`ws://${host}:${port}`, { headers });

      this.ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });

      this.ws.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as WSResponse;
          this.receivedMessages.push(msg);

          // Resolve any matching waiters
          for (let i = this.messageWaiters.length - 1; i >= 0; i--) {
            const waiter = this.messageWaiters[i]!;
            if (!waiter.type || waiter.type === msg.type) {
              clearTimeout(waiter.timeout);
              this.messageWaiters.splice(i, 1);
              waiter.resolve(msg);
            }
          }
        } catch {
          // Non-JSON message -- ignore for protocol testing
        }
      });

      this.ws.on('close', () => {
        // Reject all pending waiters
        for (const waiter of this.messageWaiters) {
          clearTimeout(waiter.timeout);
          waiter.reject(
            new Error('WebSocket closed while waiting for message')
          );
        }
        this.messageWaiters = [];
      });
    });
  }

  /**
   * Close the connection gracefully.
   */
  close(): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close();
    }
    this.ws = null;
  }

  // -------------------------------------------------------------------------
  // Sending
  // -------------------------------------------------------------------------

  /**
   * Send a typed WebSocket message.
   */
  send(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a raw string (for testing malformed input).
   */
  sendRaw(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(data);
  }

  // -------------------------------------------------------------------------
  // Receiving
  // -------------------------------------------------------------------------

  /**
   * Wait for the next message of a given type.
   *
   * @param type - The WSResponse `type` field to match. Omit to match any.
   * @param timeout - Override the default message timeout.
   * @returns The matched response.
   */
  waitForMessage(type?: string, timeout?: number): Promise<WSResponse> {
    const ms = timeout ?? this.options.messageTimeout;

    // Check if we already have a matching message
    if (type) {
      const idx = this.receivedMessages.findIndex(m => m.type === type);
      if (idx !== -1) {
        return Promise.resolve(this.receivedMessages.splice(idx, 1)[0]!);
      }
    } else if (this.receivedMessages.length > 0) {
      return Promise.resolve(this.receivedMessages.shift()!);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.messageWaiters.findIndex(w => w.timeout === timer);
        if (idx !== -1) {
          this.messageWaiters.splice(idx, 1);
        }
        reject(
          new Error(
            `Timeout waiting for message${type ? ` of type "${type}"` : ''} after ${ms}ms`
          )
        );
      }, ms);

      this.messageWaiters.push({ resolve, reject, type, timeout: timer });
    });
  }

  /**
   * Wait for a specific number of messages.
   */
  async waitForMessages(
    count: number,
    timeout?: number
  ): Promise<WSResponse[]> {
    const results: WSResponse[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.waitForMessage(undefined, timeout));
    }
    return results;
  }

  /**
   * Drain all currently buffered messages without waiting.
   */
  drain(): WSResponse[] {
    const messages = [...this.receivedMessages];
    this.receivedMessages = [];
    return messages;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** All messages received since connection (or last drain). */
  get messages(): readonly WSResponse[] {
    return this.receivedMessages;
  }

  /** Whether the client is currently connected. */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
