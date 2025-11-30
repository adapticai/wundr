/**
 * WebSocket API Route for Real-Time Messaging
 *
 * This Next.js API route handles WebSocket upgrade requests and delegates
 * connection management to the WebSocket server singleton.
 *
 * Features:
 * - WebSocket protocol upgrade handling
 * - CORS support for allowed origins
 * - Integration with Next.js 14 App Router
 * - Proper error responses for non-upgrade requests
 *
 * @module api/ws/route
 */

import { NextRequest } from 'next/server';
import { getWebSocketServer } from '@/lib/realtime/init';

/**
 * List of allowed origins for CORS
 * In production, this should be configured via environment variables
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://neolith.ai',
  'https://*.neolith.ai',
];

/**
 * Checks if the request origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow same-origin requests

  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.includes('*')) {
      // Handle wildcard subdomains
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  });
}

/**
 * GET handler for WebSocket upgrade requests
 *
 * This endpoint:
 * 1. Validates the WebSocket upgrade request
 * 2. Checks CORS origin
 * 3. Delegates to WebSocket server for connection handling
 * 4. Returns appropriate response
 *
 * @param req - Next.js request object
 * @returns Response indicating success or error
 */
export async function GET(req: NextRequest) {
  const upgradeHeader = req.headers.get('upgrade');
  const origin = req.headers.get('origin');

  // Validate WebSocket upgrade request
  if (upgradeHeader !== 'websocket') {
    return new Response(
      JSON.stringify({
        error: 'Expected WebSocket upgrade request',
        message: 'This endpoint only accepts WebSocket connections',
      }),
      {
        status: 426, // Upgrade Required
        headers: {
          'Content-Type': 'application/json',
          'Upgrade': 'websocket',
        },
      }
    );
  }

  // Validate CORS origin
  if (!isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({
        error: 'Origin not allowed',
        message: `Origin ${origin} is not in the allowed list`,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // Get WebSocket server singleton
    const wsServer = getWebSocketServer();

    // The actual WebSocket upgrade is handled by the server
    // In Next.js, we need to access the underlying Node.js request/response
    // This is a placeholder - actual implementation depends on deployment environment

    // For development with Next.js standalone server:
    const nodeReq = (req as any).raw || req;
    const socket = (nodeReq.socket || nodeReq.connection);

    if (!socket) {
      throw new Error('No socket available for WebSocket upgrade');
    }

    // Handle the upgrade via our WebSocket server
    wsServer.handleUpgrade(nodeReq, socket, Buffer.alloc(0), (ws) => {
      wsServer.emit('connection', ws, nodeReq);
    });

    // Return empty response - connection is now upgraded
    return new Response(null, {
      status: 101, // Switching Protocols
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
    });
  } catch (error) {
    console.error('[WebSocket] Upgrade failed:', error);

    return new Response(
      JSON.stringify({
        error: 'WebSocket upgrade failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * POST handler - returns method not allowed
 */
export async function POST() {
  return new Response(
    JSON.stringify({
      error: 'Method not allowed',
      message: 'This endpoint only accepts WebSocket GET requests',
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET',
      },
    }
  );
}

/**
 * Export runtime configuration
 * Use 'nodejs' for WebSocket support (Edge runtime doesn't support WebSockets)
 */
export const runtime = 'nodejs';

/**
 * Disable static optimization for this route
 */
export const dynamic = 'force-dynamic';
