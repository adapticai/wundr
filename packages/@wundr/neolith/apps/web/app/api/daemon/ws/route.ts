/**
 * @fileoverview WebSocket Upgrade Route for VP Daemon Connections
 * Handles WebSocket upgrade requests and delegates to the WebSocket server.
 *
 * This route provides the HTTP → WebSocket upgrade endpoint.
 * Actual WebSocket handling is performed by the DaemonWebSocketServer.
 *
 * @module app/api/daemon/ws/route
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

/**
 * GET /api/daemon/ws - WebSocket Upgrade Endpoint
 *
 * This endpoint is reserved for WebSocket upgrades.
 * The actual WebSocket server is configured separately in the Next.js custom server.
 *
 * @param request - Next.js request
 * @returns Information response
 *
 * @example
 * ```
 * # WebSocket connection (not HTTP)
 * ws://your-domain/api/daemon/ws
 *
 * # HTTP request returns info
 * GET /api/daemon/ws
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'VP Daemon WebSocket endpoint',
    protocol: 'WebSocket',
    version: '1.0.0',
    documentation: 'https://docs.neolith.io/daemon-websocket',
    connection: {
      upgrade: 'Use WebSocket client to connect',
      url: 'ws://your-domain/api/daemon/ws (or wss:// for secure)',
      authentication: 'Send auth message after connection with JWT access token',
    },
    endpoints: {
      http: {
        auth: '/api/daemon/auth',
        refresh: '/api/daemon/auth/refresh',
        heartbeat: '/api/daemon/heartbeat',
        events: '/api/daemon/events',
      },
      websocket: {
        path: '/api/daemon/ws',
        protocol: 'See documentation for message format',
      },
    },
  });
}

/**
 * POST /api/daemon/ws - Not Supported
 *
 * WebSocket connections use GET with Upgrade header.
 *
 * @param _request - Next.js request
 * @returns Method not allowed response
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed. Use WebSocket connection instead.' },
    { status: 405 },
  );
}
