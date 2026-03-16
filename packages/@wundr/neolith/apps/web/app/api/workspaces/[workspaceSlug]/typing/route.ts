/**
 * Workspace Batch Typing Indicators API
 *
 * Returns typing indicators for all channels the user belongs to in a workspace.
 * Used by the channel list sidebar to show typing status.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/typing - Get typing status for all user's channels
 *
 * @module app/api/workspaces/[workspaceSlug]/typing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface TypingUser {
  userId: string;
  userName: string;
  startedAt: string;
}

/**
 * Lazy Redis client initialization
 */
let redisClient: any = null;
let redisAvailable: boolean | null = null;

async function getRedisClient(): Promise<any> {
  if (redisAvailable === false) return null;
  if (redisClient) return redisClient;

  try {
    const ioredisModule = await import('ioredis').catch(() => null);
    if (!ioredisModule || !process.env.REDIS_URL) {
      redisAvailable = false;
      return null;
    }
    const Redis = ioredisModule.default;
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

/**
 * In-memory typing store reference (shared with per-channel route via module state)
 * Note: In production with multiple instances, Redis is the source of truth
 */
const memoryTypingStore = new Map<
  string,
  Map<string, { userId: string; userName: string; expiresAt: number }>
>();

/**
 * Get typing users for a specific channel
 */
async function getChannelTypingUsers(
  channelId: string,
  excludeUserId: string
): Promise<TypingUser[]> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const key = `typing:${channelId}`;
      const entries = await redis.hgetall(key);
      const users: TypingUser[] = [];
      for (const [userId, value] of Object.entries(entries)) {
        if (userId !== excludeUserId) {
          try {
            const parsed = JSON.parse(value as string);
            users.push({
              userId,
              userName: parsed.userName,
              startedAt: parsed.timestamp
                ? new Date(parsed.timestamp).toISOString()
                : new Date().toISOString(),
            });
          } catch {
            /* skip malformed entries */
          }
        }
      }
      return users;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  const channelTyping = memoryTypingStore.get(channelId);
  if (!channelTyping) return [];

  const users: TypingUser[] = [];
  for (const [userId, data] of channelTyping.entries()) {
    if (userId !== excludeUserId && data.expiresAt > now) {
      users.push({
        userId: data.userId,
        userName: data.userName,
        startedAt: new Date(data.expiresAt - 5000).toISOString(),
      });
    }
  }
  return users;
}

/**
 * GET /api/workspaces/:workspaceSlug/typing
 *
 * Get batch typing indicators for all channels the user belongs to.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug } = params;

    // Resolve workspace
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Get user's channel memberships in this workspace
    const memberships = await prisma.channelMember.findMany({
      where: {
        userId: session.user.id,
        channel: { workspaceId: workspace.id },
      },
      select: { channelId: true },
    });

    // Fetch typing status for each channel in parallel
    const channelIds = memberships.map(m => m.channelId);
    const typingResults = await Promise.all(
      channelIds.map(async channelId => {
        const users = await getChannelTypingUsers(channelId, session.user.id);
        return { channelId, users };
      })
    );

    // Build response - only include channels with active typing
    const data: Record<string, TypingUser[]> = {};
    for (const result of typingResults) {
      if (result.users.length > 0) {
        data[result.channelId] = result.users;
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/typing] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
