/**
 * Server-side WebSocket Implementation
 *
 * This module provides the WebSocket server singleton for handling
 * real-time connections on the server side using the 'ws' library.
 */

import { WebSocketServer, WebSocket } from 'ws';

/**
 * WebSocket server singleton instance
 */
let wsServer: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server
 * Should be called once during application startup
 */
export function initWebSocketServer(port?: number): WebSocketServer {
  if (wsServer) {
    console.warn('[WebSocket] Server already initialized');
    return wsServer;
  }

  const options = port ? { port } : { noServer: true };
  wsServer = new WebSocketServer(options);

  console.log('[WebSocket] Server initialized', options);

  // Set up connection handler
  wsServer.on('connection', (ws: WebSocket, request: any) => {
    console.log('[WebSocket] New connection established');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[WebSocket] Received message:', message);

        // TODO: Add message handling logic
        // This should route messages to appropriate handlers
        // based on message type (subscribe, unsubscribe, message, etc.)
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Connection closed');
      // TODO: Add cleanup logic (remove subscriptions, etc.)
    });

    ws.on('error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        event: 'connected',
        timestamp: Date.now(),
      })
    );
  });

  wsServer.on('error', (error: Error) => {
    console.error('[WebSocket] Server error:', error);
  });

  return wsServer;
}

/**
 * Get the WebSocket server instance
 * Returns null if not initialized (client-side or before initialization)
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}

/**
 * Close the WebSocket server and cleanup
 */
export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!wsServer) {
      resolve();
      return;
    }

    wsServer.close(err => {
      if (err) {
        console.error('[WebSocket] Error closing server:', err);
        reject(err);
      } else {
        console.log('[WebSocket] Server closed');
        wsServer = null;
        resolve();
      }
    });
  });
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(message: any): void {
  if (!wsServer) {
    console.warn('[WebSocket] Cannot broadcast, server not initialized');
    return;
  }

  const data = JSON.stringify(message);
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/**
 * Get count of connected clients
 */
export function getConnectionCount(): number {
  return wsServer?.clients.size ?? 0;
}
