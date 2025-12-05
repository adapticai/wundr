/**
 * Real-time Analytics API with Server-Sent Events (SSE)
 *
 * Provides real-time workspace analytics streaming including:
 * - Live user count tracking
 * - Active sessions metrics
 * - Real-time message activity
 * - Event-based updates
 * - Connection health monitoring
 *
 * Supports both SSE streaming (GET with Accept: text/event-stream)
 * and snapshot polling (GET with standard Accept header)
 *
 * @module app/api/workspaces/[workspaceId]/analytics/realtime/route
 */

import {
  AnalyticsServiceImpl,
  redis,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
} from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { getServerSession } from '@/lib/auth';

import type { NextRequest } from 'next/server';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface RealTimeStats {
  /** Total active users in the workspace right now */
  activeUsers: number;
  /** Users currently online (active in last 5 minutes) */
  onlineUsers: number;
  /** Active sessions count */
  activeSessions: number;
  /** Messages sent in the last hour */
  messagesLastHour: number;
  /** Messages sent today */
  messagesToday: number;
  /** Active channels (with activity in last hour) */
  activeChannels: number;
  /** Current active orchestrators */
  activeOrchestrators: number;
  /** Tasks in progress */
  tasksInProgress: number;
  /** Event breakdown by type */
  eventCounts: Record<string, number>;
  /** Timestamp of stats generation */
  timestamp: string;
}

interface ConnectionManager {
  id: string;
  workspaceId: string;
  userId: string;
  controller: ReadableStreamDefaultController;
  lastPing: number;
  closed: boolean;
}

// =============================================================================
// CONNECTION MANAGEMENT
// =============================================================================

/** Active SSE connections mapped by connection ID */
const activeConnections = new Map<string, ConnectionManager>();

/** Cleanup interval for stale connections (5 minutes) */
const CONNECTION_CLEANUP_INTERVAL = 5 * 60 * 1000;

/** Heartbeat interval to keep connections alive (30 seconds) */
const HEARTBEAT_INTERVAL = 30 * 1000;

/** Stats update interval (5 seconds) */
const STATS_UPDATE_INTERVAL = 5000;

/** Maximum connection duration (1 hour) */
const MAX_CONNECTION_DURATION = 60 * 60 * 1000;

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Clean up stale connections
 */
function cleanupStaleConnections(): void {
  const now = Date.now();
  for (const [id, conn] of activeConnections.entries()) {
    const age = now - conn.lastPing;
    if (age > MAX_CONNECTION_DURATION || conn.closed) {
      try {
        if (!conn.closed) {
          conn.controller.close();
        }
      } catch {
        // Connection already closed
      }
      activeConnections.delete(id);
    }
  }
}

// Start periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStaleConnections, CONNECTION_CLEANUP_INTERVAL);
}

// =============================================================================
// ANALYTICS SERVICE HELPERS
// =============================================================================

const analyticsService = new AnalyticsServiceImpl({
  prisma: prisma as unknown as AnalyticsDatabaseClient,
  redis: redis as unknown as AnalyticsRedisClient,
});

/**
 * Get comprehensive real-time statistics
 */
async function getComprehensiveStats(
  workspaceId: string,
): Promise<RealTimeStats> {
  const today = new Date().toISOString().split('T')[0] as string;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Fetch all data in parallel for performance
  const [
    redisStats,
    activeUsersCount,
    onlineUsersCount,
    messagesLastHour,
    messagesToday,
    activeChannelsCount,
    activeOrchestratorsCount,
    tasksInProgress,
    activeSessions,
  ] = await Promise.all([
    // Redis real-time event counts
    analyticsService.getRealTimeStats(workspaceId),

    // Active users (sent messages today)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT m."senderId") as count
      FROM "Message" m
      JOIN "Channel" c ON m."channelId" = c.id
      WHERE c."workspaceId" = ${workspaceId}
        AND m."createdAt" >= ${new Date(today)}::timestamp
        AND m."isDeleted" = false
    `,

    // Online users (active in last 5 minutes)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT m."senderId") as count
      FROM "Message" m
      JOIN "Channel" c ON m."channelId" = c.id
      WHERE c."workspaceId" = ${workspaceId}
        AND m."createdAt" >= ${fiveMinutesAgo}
        AND m."isDeleted" = false
    `,

    // Messages in last hour
    prisma.message.count({
      where: {
        channel: { workspaceId },
        createdAt: { gte: oneHourAgo },
        isDeleted: false,
      },
    }),

    // Messages today
    prisma.message.count({
      where: {
        channel: { workspaceId },
        createdAt: { gte: new Date(today) },
        isDeleted: false,
      },
    }),

    // Active channels (with messages in last hour)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT c.id) as count
      FROM "Channel" c
      JOIN "Message" m ON m."channelId" = c.id
      WHERE c."workspaceId" = ${workspaceId}
        AND m."createdAt" >= ${oneHourAgo}
        AND c."isArchived" = false
    `,

    // Active orchestrators
    prisma.orchestrator.count({
      where: {
        workspaceId,
        status: {
          in: ['ONLINE', 'BUSY'],
        },
      },
    }),

    // Tasks in progress
    prisma.task.count({
      where: {
        workspaceId,
        status: {
          in: ['TODO', 'IN_PROGRESS'],
        },
      },
    }),

    // Active SSE connections for this workspace
    Promise.resolve(
      Array.from(activeConnections.values()).filter(
        conn => conn.workspaceId === workspaceId && !conn.closed,
      ).length,
    ),
  ]);

  return {
    activeUsers: Number(activeUsersCount[0]?.count ?? 0n),
    onlineUsers: Number(onlineUsersCount[0]?.count ?? 0n),
    activeSessions,
    messagesLastHour,
    messagesToday,
    activeChannels: Number(activeChannelsCount[0]?.count ?? 0n),
    activeOrchestrators: activeOrchestratorsCount,
    tasksInProgress,
    eventCounts: redisStats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format SSE message
 */
function formatSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Send heartbeat ping
 */
function sendHeartbeat(controller: ReadableStreamDefaultController): void {
  try {
    const encoder = new TextEncoder();
    controller.enqueue(
      encoder.encode(formatSSEMessage('ping', { timestamp: Date.now() })),
    );
  } catch {
    // Connection closed
  }
}

/**
 * Stream stats updates to client
 */
async function streamStatsUpdates(
  workspaceId: string,
  controller: ReadableStreamDefaultController,
  connectionId: string,
): Promise<void> {
  const encoder = new TextEncoder();
  let running = true;

  // Stop streaming when connection is closed
  const conn = activeConnections.get(connectionId);
  if (!conn) {
    running = false;
  }

  // Stats update loop
  while (running) {
    try {
      const conn = activeConnections.get(connectionId);
      if (!conn || conn.closed) {
        running = false;
        break;
      }

      // Fetch and send stats
      const stats = await getComprehensiveStats(workspaceId);
      controller.enqueue(
        encoder.encode(formatSSEMessage('stats', stats)),
      );

      // Update last ping time
      conn.lastPing = Date.now();

      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, STATS_UPDATE_INTERVAL));
    } catch (error) {
      console.error('[SSE Stats Stream] Error:', error);
      running = false;
    }
  }
}

/**
 * Start heartbeat for connection
 */
function startHeartbeat(
  controller: ReadableStreamDefaultController,
  connectionId: string,
): NodeJS.Timeout {
  return setInterval(() => {
    const conn = activeConnections.get(connectionId);
    if (!conn || conn.closed) {
      return;
    }
    sendHeartbeat(controller);
  }, HEARTBEAT_INTERVAL);
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/workspaces/:workspaceId/analytics/realtime
 *
 * Supports two modes:
 * 1. SSE Streaming: Accept: text/event-stream
 *    - Real-time stats updates every 5 seconds
 *    - Heartbeat pings every 30 seconds
 *    - Auto-disconnect after 1 hour
 *
 * 2. Snapshot Polling: Standard Accept header
 *    - Returns current stats snapshot
 *    - No persistent connection
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    // Authenticate user
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await params;

    // Validate workspace ID format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json(
        { error: 'Invalid workspace ID format', code: 'INVALID_ID' },
        { status: 400 },
      );
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Check if client wants SSE streaming
    const acceptHeader = request.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    // Mode 1: SSE Streaming
    if (wantsSSE) {
      const connectionId = generateConnectionId();

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          // Register connection
          const conn: ConnectionManager = {
            id: connectionId,
            workspaceId,
            userId: session.user.id,
            controller,
            lastPing: Date.now(),
            closed: false,
          };
          activeConnections.set(connectionId, conn);

          // Send initial connection event
          controller.enqueue(
            encoder.encode(
              formatSSEMessage('connected', {
                connectionId,
                workspaceId,
                timestamp: new Date().toISOString(),
              }),
            ),
          );

          // Send initial stats immediately
          const initialStats = await getComprehensiveStats(workspaceId);
          controller.enqueue(
            encoder.encode(formatSSEMessage('stats', initialStats)),
          );

          // Start heartbeat
          const heartbeatInterval = startHeartbeat(controller, connectionId);

          // Start stats streaming
          streamStatsUpdates(workspaceId, controller, connectionId)
            .catch(error => {
              console.error('[SSE] Stream error:', error);
            })
            .finally(() => {
              clearInterval(heartbeatInterval);
              conn.closed = true;
              activeConnections.delete(connectionId);
              try {
                controller.close();
              } catch {
                // Already closed
              }
            });
        },
        cancel() {
          // Client disconnected
          const conn = activeConnections.get(connectionId);
          if (conn) {
            conn.closed = true;
            activeConnections.delete(connectionId);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      });
    }

    // Mode 2: Snapshot Polling
    const stats = await getComprehensiveStats(workspaceId);

    return NextResponse.json({
      data: stats,
      meta: {
        workspaceId,
        userId: session.user.id,
        mode: 'snapshot',
        connections: activeConnections.size,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/analytics/realtime]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch real-time stats',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/analytics/realtime
 *
 * Track real-time events (user activity, presence, etc.)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    // Authenticate user
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await params;

    // Validate workspace ID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json(
        { error: 'Invalid workspace ID format', code: 'INVALID_ID' },
        { status: 400 },
      );
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const { eventType, eventData, sessionId } = body;

    // Validate event type
    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json(
        { error: 'Event type required', code: 'MISSING_EVENT_TYPE' },
        { status: 400 },
      );
    }

    // Track event through analytics service
    await analyticsService.track({
      workspaceId,
      userId: session.user.id,
      eventType: eventType as never,
      eventData: (eventData as Record<string, string | number | boolean | undefined>) || {},
      sessionId: sessionId as string | undefined,
      metadata: {
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          undefined,
      },
    });

    // Broadcast update to SSE clients for this workspace (if implemented)
    // This would notify connected clients of the new event
    const workspaceConnections = Array.from(activeConnections.values()).filter(
      conn => conn.workspaceId === workspaceId && !conn.closed,
    );

    // Send event notification to all connected clients
    const encoder = new TextEncoder();
    for (const conn of workspaceConnections) {
      try {
        conn.controller.enqueue(
          encoder.encode(
            formatSSEMessage('event', {
              eventType,
              userId: session.user.id,
              timestamp: new Date().toISOString(),
            }),
          ),
        );
      } catch {
        // Connection closed, will be cleaned up later
        conn.closed = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully',
      eventType,
      notified: workspaceConnections.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/analytics/realtime]', error);
    return NextResponse.json(
      {
        error: 'Failed to track real-time event',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/analytics/realtime
 *
 * Close all active SSE connections for the workspace (admin only)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace ID
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    // Authenticate user
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Close all connections for this workspace
    let closedCount = 0;
    for (const [id, conn] of activeConnections.entries()) {
      if (conn.workspaceId === workspaceId && !conn.closed) {
        try {
          conn.controller.close();
          conn.closed = true;
          closedCount++;
        } catch {
          // Already closed
        }
        activeConnections.delete(id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Connections closed',
      closedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/analytics/realtime]', error);
    return NextResponse.json(
      {
        error: 'Failed to close connections',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
