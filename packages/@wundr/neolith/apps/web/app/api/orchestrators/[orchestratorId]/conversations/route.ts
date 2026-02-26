/**
 * Orchestrator Conversations API Routes
 *
 * Handles listing and creating messages in an orchestrator's conversation thread.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/conversations - List messages for orchestrator
 * - POST /api/orchestrators/:orchestratorId/conversations - Post a new message
 *
 * @module app/api/orchestrators/[orchestratorId]/conversations/route
 */

import { z } from 'zod';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  ORCHESTRATOR_CONVERSATION_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/orchestrator-conversation';

import type { NextRequest } from 'next/server';

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Shape of a conversation message returned by this API
 */
interface ConversationMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole: string | null | undefined;
  recipientId: string | null | undefined;
  recipientName: string | null | undefined;
  channelId: string | null | undefined;
  channelName: string | null | undefined;
  type: string;
  priority: string;
  timestamp: string;
  metadata: unknown;
  parentMessageId: string | null | undefined;
  threadCount: number;
}

/**
 * Zod schema for POST body validation
 */
const postBodySchema = z.object({
  content: z.string().min(1).max(10000),
  channelId: z.string().min(1).optional(),
});

type PostBody = z.infer<typeof postBodySchema>;

/**
 * Helper function to verify the requesting user has access to an orchestrator
 */
async function checkOrchestratorAccess(orchestratorId: string, userId: string) {
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    select: {
      id: true,
      organizationId: true,
      role: true,
      discipline: true,
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * GET /api/orchestrators/:orchestratorId/conversations
 *
 * Returns a paginated list of messages where the orchestrator is either
 * the sender or the recipient. Optionally filtered by channelId.
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestratorId
 * @returns Array of ConversationMessage objects
 *
 * @example
 * ```
 * GET /api/orchestrators/orch_123/conversations?channelId=ch_456&limit=50
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Resolve and validate orchestratorId
    const params = await context.params;
    const orchestratorId = params.orchestratorId;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator ID is required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const access = await checkOrchestratorAccess(
      orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId') ?? undefined;
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor') ?? undefined;

    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100)
      : 50;

    // Build query options with optional cursor-based pagination
    const cursorOption = cursor ? { id: cursor } : undefined;

    // Fetch messages where the orchestrator is sender or recipient
    const messages = await (prisma as any).orchestratorMessage
      .findMany({
        where: {
          OR: [{ senderId: orchestratorId }, { recipientId: orchestratorId }],
          ...(channelId && { channelId }),
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        ...(cursorOption && {
          skip: 1,
          cursor: cursorOption,
        }),
        include: {
          sender: { select: { id: true, title: true, role: true } },
          recipient: { select: { id: true, title: true, role: true } },
        },
      })
      .catch(() => []);

    const data: ConversationMessage[] = messages.map((m: any) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderName: m.sender?.title ?? 'Unknown',
      senderRole: m.sender?.role,
      recipientId: m.recipientId,
      recipientName: m.recipient?.title,
      channelId: m.channelId,
      channelName: m.channelName,
      type: m.type ?? 'message',
      priority: m.priority ?? 'normal',
      timestamp: m.createdAt.toISOString(),
      metadata: m.metadata,
      parentMessageId: m.parentMessageId,
      threadCount: m.threadCount ?? 0,
    }));

    // Derive next cursor from the last returned record
    const nextCursor =
      data.length === limit ? messages[messages.length - 1]?.id : undefined;

    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/conversations] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrators/:orchestratorId/conversations
 *
 * Creates a new message record attributed to the calling user directed
 * at the given orchestrator. Optionally scoped to a channel.
 *
 * @param request - Next.js request with { content, channelId? }
 * @param context - Route context containing orchestratorId
 * @returns The created ConversationMessage
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/conversations
 * Content-Type: application/json
 *
 * { "content": "Please review the quarterly report.", "channelId": "ch_456" }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Resolve and validate orchestratorId
    const params = await context.params;
    const orchestratorId = params.orchestratorId;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator ID is required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const access = await checkOrchestratorAccess(
      orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = postBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const body: PostBody = parseResult.data;

    // Create the message record
    const created = await (prisma as any).orchestratorMessage
      .create({
        data: {
          content: body.content,
          senderId: session.user.id,
          recipientId: orchestratorId,
          channelId: body.channelId ?? null,
          type: 'message',
          priority: 'normal',
        },
        include: {
          sender: { select: { id: true, title: true, role: true } },
          recipient: { select: { id: true, title: true, role: true } },
        },
      })
      .catch((err: unknown) => {
        console.error(
          '[POST /api/orchestrators/:orchestratorId/conversations] DB error:',
          err
        );
        return null;
      });

    if (!created) {
      return NextResponse.json(
        createErrorResponse(
          'Failed to create conversation message',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR
        ),
        { status: 500 }
      );
    }

    const data: ConversationMessage = {
      id: created.id,
      content: created.content,
      senderId: created.senderId,
      senderName: created.sender?.title ?? 'Unknown',
      senderRole: created.sender?.role,
      recipientId: created.recipientId,
      recipientName: created.recipient?.title,
      channelId: created.channelId,
      channelName: created.channelName,
      type: created.type ?? 'message',
      priority: created.priority ?? 'normal',
      timestamp: created.createdAt.toISOString(),
      metadata: created.metadata,
      parentMessageId: created.parentMessageId,
      threadCount: created.threadCount ?? 0,
    };

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error(
      '[POST /api/orchestrators/:orchestratorId/conversations] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
