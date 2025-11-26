/**
 * Daemon Messages API Route
 *
 * Handles message operations for VP daemon services.
 *
 * Routes:
 * - GET /api/daemon/messages - Get messages from a channel
 * - POST /api/daemon/messages - Send a message to a channel
 *
 * @module app/api/daemon/messages/route
 */

import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

/**
 * Schema for sending a message
 */
const sendMessageSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  content: z.string().min(1, 'Message content is required'),
  threadId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string(),
    name: z.string().optional(),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for message operations
 */
const MESSAGE_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  CHANNEL_ACCESS_DENIED: 'CHANNEL_ACCESS_DENIED',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  vpId: string;
  daemonId: string;
  scopes: string[];
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Verify daemon token from Authorization header
 */
async function verifyDaemonToken(request: NextRequest): Promise<AccessTokenPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

/**
 * Check if VP has access to a channel
 */
async function checkChannelAccess(vpId: string, channelId: string): Promise<boolean> {
  const vp = await prisma.vps.findUnique({
    where: { id: vpId },
    select: { userId: true },
  });

  if (!vp) {
    return false;
  }

  const membership = await prisma.channels_members.findFirst({
    where: {
      channelId,
      userId: vp.userId,
    },
  });

  return !!membership;
}

/**
 * GET /api/daemon/messages - Get messages from a channel
 *
 * Retrieves messages from a channel the VP daemon has access to.
 *
 * @param request - Next.js request with channel ID and pagination params
 * @returns List of messages
 *
 * @example
 * ```
 * GET /api/daemon/messages?channelId=chan_123&limit=50&before=msg_456
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: MESSAGE_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before') || undefined;
    const after = searchParams.get('after') || undefined;

    // Validate required parameters
    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required', code: MESSAGE_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Check channel access
    const hasAccess = await checkChannelAccess(token.vpId, channelId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Channel access denied', code: MESSAGE_ERROR_CODES.CHANNEL_ACCESS_DENIED },
        { status: 403 },
      );
    }

    // Build cursor conditions
    const cursorConditions: { createdAt?: { lt?: Date; gt?: Date } } = {};
    if (before) {
      const beforeMsg = await prisma.messages.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMsg) {
        cursorConditions.createdAt = { lt: beforeMsg.createdAt };
      }
    }
    if (after) {
      const afterMsg = await prisma.messages.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      if (afterMsg) {
        cursorConditions.createdAt = { ...cursorConditions.createdAt, gt: afterMsg.createdAt };
      }
    }

    // Fetch messages
    const rawMessages = await prisma.messages.findMany({
      where: {
        channelId,
        ...cursorConditions,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch author information separately (workaround for Prisma type mapping)
    type MessageWithAuthorId = typeof rawMessages[0] & { authorId: string };
    const messagesTyped = rawMessages as unknown as MessageWithAuthorId[];
    const authorIds = Array.from(new Set(messagesTyped.map((m) => m.authorId)));
    const authors = await prisma.users.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        isVP: true,
      },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    // Format messages with author info
    const messages = messagesTyped.map((msg) => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      metadata: msg.metadata,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      isEdited: msg.isEdited,
      channelId: msg.channelId,
      parentId: msg.parentId,
      author: authorMap.get(msg.authorId) || { id: msg.authorId, name: 'Unknown' },
    }));

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('[GET /api/daemon/messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages', code: MESSAGE_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}

/**
 * POST /api/daemon/messages - Send a message to a channel
 *
 * Sends a message to a channel on behalf of the VP daemon.
 *
 * @param request - Next.js request with message data
 * @returns Created message ID
 *
 * @example
 * ```
 * POST /api/daemon/messages
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "channelId": "chan_123",
 *   "content": "Hello from the daemon!",
 *   "threadId": "msg_456",
 *   "metadata": { "source": "automated" }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: MESSAGE_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Check scope permissions
    const hasWriteScope = token.scopes.includes('messages:write') || token.scopes.includes('*');
    if (!hasWriteScope) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: MESSAGE_ERROR_CODES.INSUFFICIENT_SCOPE },
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: MESSAGE_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = sendMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Channel ID and content required', code: MESSAGE_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    const { channelId, content, threadId, attachments, metadata } = parseResult.data;

    // Check channel access
    const hasAccess = await checkChannelAccess(token.vpId, channelId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Channel access denied', code: MESSAGE_ERROR_CODES.CHANNEL_ACCESS_DENIED },
        { status: 403 },
      );
    }

    // Get VP user ID
    const vp = await prisma.vps.findUnique({
      where: { id: token.vpId },
      select: { userId: true },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'VP not found', code: MESSAGE_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Build message data with proper typing
    interface MessageCreateData {
      content: string;
      channelId: string;
      authorId: string;
      parentId?: string;
      metadata?: Record<string, unknown>;
    }

    const messageData: MessageCreateData = {
      content,
      channelId,
      authorId: vp.userId,
    };

    if (threadId) {
      messageData.parentId = threadId;
    }

    // Include attachment metadata in message metadata if provided
    if (metadata || attachments) {
      const messageMetadata: Record<string, unknown> = {};

      if (metadata) {
        Object.assign(messageMetadata, metadata);
      }

      // Store attachment references in message metadata
      // Actual file content should be uploaded separately via file upload API
      if (attachments && attachments.length > 0) {
        messageMetadata.attachmentRefs = attachments.map((att, index) => ({
          id: `att_${Date.now()}_${index}`,
          type: att.type,
          url: att.url,
          name: att.name ?? `attachment_${index}`,
        }));
      }

      messageData.metadata = messageMetadata;
    }

    // Create message using Prisma
    const message = await prisma.messages.create({
      data: messageData as unknown as Parameters<typeof prisma.messages.create>[0]['data'],
    });

    // Update channel last activity
    await prisma.channels.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ messageId: message.id });
  } catch (error) {
    console.error('[POST /api/daemon/messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message', code: MESSAGE_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
