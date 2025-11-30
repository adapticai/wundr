/**
 * Neolith MCP Stdio Transport Implementation
 *
 * Implements the Model Context Protocol transport layer using stdin/stdout
 * for communication with Claude Code. Uses newline-delimited JSON messages.
 *
 * @see https://spec.modelcontextprotocol.io/specification/basic/transports/
 */

import { EventEmitter } from 'events';

import {
  JsonRpcRequestSchema,
  JsonRpcNotificationSchema,
  JSONRPC_VERSION,
} from '../types/protocol-types';

import type {
  MCPTransport,
  StdioTransportOptions,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification} from '../types/protocol-types';

/**
 * Buffer size for reading from stdin (64KB)
 */
const READ_BUFFER_SIZE = 65536;

/**
 * Message delimiter for stdio transport
 */
const MESSAGE_DELIMITER = '\n';

/**
 * Stdio Transport for MCP Protocol
 *
 * Handles bidirectional communication using stdin for incoming messages
 * and stdout for outgoing messages. Messages are newline-delimited JSON.
 */
export class StdioTransport extends EventEmitter implements MCPTransport {
  private readonly inputStream: NodeJS.ReadableStream;
  private readonly outputStream: NodeJS.WritableStream;
  private readonly debug: boolean;

  private buffer: string = '';
  private isRunning: boolean = false;
  private isClosed: boolean = false;

  // Event handlers
  public onMessage: ((message: JsonRpcRequest | JsonRpcNotification) => void) | null = null;
  public onError: ((error: Error) => void) | null = null;
  public onClose: (() => void) | null = null;

  constructor(options: StdioTransportOptions = {}) {
    super();

    this.inputStream = options.inputStream ?? process.stdin;
    this.outputStream = options.outputStream ?? process.stdout;
    this.debug = options.debug ?? false;

    // Set encoding for streams
    if ('setEncoding' in this.inputStream) {
      (this.inputStream as NodeJS.ReadableStream & { setEncoding: (encoding: string) => void }).setEncoding('utf8');
    }
  }

  /**
   * Start the transport - begin listening for incoming messages
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Transport is already running');
    }

    if (this.isClosed) {
      throw new Error('Transport has been closed and cannot be restarted');
    }

    this.isRunning = true;
    this.setupInputHandlers();
    this.debugLog('Transport started');
  }

  /**
   * Stop the transport - clean up resources
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isClosed = true;

    // Remove all listeners
    this.inputStream.removeAllListeners('data');
    this.inputStream.removeAllListeners('end');
    this.inputStream.removeAllListeners('error');

    // Clear buffer
    this.buffer = '';

    this.debugLog('Transport stopped');

    // Notify close handler
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Send a JSON-RPC message through stdout
   */
  public async send(message: JsonRpcMessage): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Transport is not running');
    }

    try {
      const serialized = JSON.stringify(message) + MESSAGE_DELIMITER;
      this.debugLog('Sending message:', message);

      await this.writeToOutput(serialized);
    } catch (error) {
      const transportError = new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'SEND_ERROR',
      );
      this.handleError(transportError);
      throw transportError;
    }
  }

  /**
   * Set up input stream event handlers
   */
  private setupInputHandlers(): void {
    this.inputStream.on('data', (chunk: string | Buffer) => {
      this.handleInputData(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });

    this.inputStream.on('end', () => {
      this.debugLog('Input stream ended');
      this.stop().catch((err) => this.handleError(err as Error));
    });

    this.inputStream.on('error', (error: Error) => {
      this.handleError(new TransportError(`Input stream error: ${error.message}`, 'INPUT_ERROR'));
    });
  }

  /**
   * Handle incoming data from stdin
   */
  private handleInputData(data: string): void {
    this.buffer += data;
    this.processBuffer();
  }

  /**
   * Process the input buffer for complete messages
   */
  private processBuffer(): void {
    let newlineIndex: number;

    while ((newlineIndex = this.buffer.indexOf(MESSAGE_DELIMITER)) !== -1) {
      const messageStr = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (messageStr.trim()) {
        this.parseAndDispatchMessage(messageStr);
      }
    }

    // Prevent buffer from growing too large
    if (this.buffer.length > READ_BUFFER_SIZE) {
      this.handleError(new TransportError('Input buffer overflow', 'BUFFER_OVERFLOW'));
      this.buffer = '';
    }
  }

  /**
   * Parse and dispatch a single message
   */
  private parseAndDispatchMessage(messageStr: string): void {
    try {
      const parsed = JSON.parse(messageStr) as unknown;
      this.debugLog('Received message:', parsed);

      // Validate JSON-RPC version
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid message format: not an object');
      }

      const message = parsed as Record<string, unknown>;

      if (message['jsonrpc'] !== JSONRPC_VERSION) {
        throw new Error(`Invalid JSON-RPC version: ${String(message['jsonrpc'])}`);
      }

      // Determine if it's a request or notification
      if ('id' in message) {
        // It's a request
        const validatedRequest = JsonRpcRequestSchema.safeParse(message);
        if (!validatedRequest.success) {
          throw new Error(`Invalid request: ${validatedRequest.error.message}`);
        }
        this.dispatchMessage(validatedRequest.data as JsonRpcRequest);
      } else {
        // It's a notification
        const validatedNotification = JsonRpcNotificationSchema.safeParse(message);
        if (!validatedNotification.success) {
          throw new Error(`Invalid notification: ${validatedNotification.error.message}`);
        }
        this.dispatchMessage(validatedNotification.data as JsonRpcNotification);
      }
    } catch (error) {
      this.handleError(
        new TransportError(
          `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
          'PARSE_ERROR',
        ),
      );
    }
  }

  /**
   * Dispatch a validated message to the handler
   */
  private dispatchMessage(message: JsonRpcRequest | JsonRpcNotification): void {
    if (this.onMessage) {
      try {
        this.onMessage(message);
      } catch (error) {
        this.handleError(
          new TransportError(
            `Message handler error: ${error instanceof Error ? error.message : String(error)}`,
            'HANDLER_ERROR',
          ),
        );
      }
    }
  }

  /**
   * Write data to the output stream
   */
  private writeToOutput(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const canContinue = this.outputStream.write(data, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

      // Handle backpressure
      if (!canContinue) {
        this.outputStream.once('drain', () => {
          resolve();
        });
      }
    });
  }

  /**
   * Handle transport errors
   */
  private handleError(error: Error): void {
    this.debugLog('Transport error:', error);

    if (this.onError) {
      this.onError(error);
    }

    this.emit('error', error);
  }

  /**
   * Debug logging (to stderr to avoid polluting stdout)
   */
  private debugLog(message: string, data?: unknown): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      const logMessage = data
        ? `[Neolith MCP Transport ${timestamp}] ${message} ${JSON.stringify(data)}`
        : `[Neolith MCP Transport ${timestamp}] ${message}`;
      process.stderr.write(logMessage + '\n');
    }
  }
}

/**
 * Transport-specific error class
 */
export class TransportError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TransportError';
    this.code = code;
    Object.setPrototypeOf(this, TransportError.prototype);
  }
}

/**
 * Create a new stdio transport instance
 */
export function createStdioTransport(options?: StdioTransportOptions): StdioTransport {
  return new StdioTransport(options);
}

/**
 * Response builder utilities for transport layer
 */
export const ResponseBuilder = {
  /**
   * Build a success response
   */
  success(id: string | number | null, result: unknown): JsonRpcMessage {
    return {
      jsonrpc: JSONRPC_VERSION,
      id,
      result,
    } as JsonRpcMessage;
  },

  /**
   * Build an error response
   */
  error(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcMessage {
    return {
      jsonrpc: JSONRPC_VERSION,
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {}),
      },
    } as JsonRpcMessage;
  },

  /**
   * Build a notification message
   */
  notification(method: string, params?: Record<string, unknown>): JsonRpcMessage {
    return {
      jsonrpc: JSONRPC_VERSION,
      method,
      ...(params !== undefined ? { params } : {}),
    } as JsonRpcMessage;
  },
};
