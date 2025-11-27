/**
 * OrchestratorActivity Log API Routes
 *
 * Handles activity logging and retrieval for Orchestrator entities.
 * Activity is stored in the VPMemory table with specific memory types for tracking.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity - List Orchestrator activity with filters
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity - Log new activity (internal use)
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/activity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse, ORCHESTRATOR_ERROR_CODES } from '@/lib/validations/orchestrator';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
}

/**
 * Activity types that map to memory types or specific activity categories
 */
const ACTIVITY_TYPES = {
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_UPDATED: 'TASK_UPDATED',
  STATUS_CHANGE: 'STATUS_CHANGE',
  MESSAGE_SENT: 'MESSAGE_SENT',
  CHANNEL_JOINED: 'CHANNEL_JOINED',
  CHANNEL_LEFT: 'CHANNEL_LEFT',
  DECISION_MADE: 'DECISION_MADE',
  LEARNING_RECORDED: 'LEARNING_RECORDED',
  CONVERSATION_INITIATED: 'CONVERSATION_INITIATED',
  TASK_DELEGATED: 'TASK_DELEGATED',
  TASK_ESCALATED: 'TASK_ESCALATED',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  SYSTEM_EVENT: 'SYSTEM_EVENT',
} as const;

type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

/**
 * Activity details structure
 */
interface ActivityDetails {
  type: ActivityType;
  description: string;
  summary?: string;
  keywords?: string[];
  channelId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  relatedResourceId?: string;
  relatedResourceType?: string;
}

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 * Returns the Orchestrator if accessible, null otherwise
 */
async function getOrchestratorWithWorkspaceAccess(
  workspaceId: string,
  orchestratorId: string,
  userId: string,
) {
  // First, verify workspace exists and user has access
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  // Check user's organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  // Fetch Orchestrator and verify it belongs to the workspace
  const orchestrator = await prisma.orchestrator.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
      OR: [
        { workspaceId }, // Orchestrator is directly in this workspace
        { workspaceId: null }, // Orchestrator is org-wide (accessible to all workspaces)
      ],
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      workspaceId: true,
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role };
}

/**
 * Map activity type to memory type for storage
 */
function getMemoryTypeForActivity(activityType: ActivityType): string {
  switch (activityType) {
    case 'TASK_STARTED':
    case 'TASK_COMPLETED':
    case 'TASK_UPDATED':
    case 'TASK_DELEGATED':
    case 'TASK_ESCALATED':
      return 'TASK';
    case 'MESSAGE_SENT':
    case 'CHANNEL_JOINED':
    case 'CHANNEL_LEFT':
    case 'CONVERSATION_INITIATED':
      return 'CONVERSATION';
    case 'DECISION_MADE':
      return 'DECISION';
    case 'LEARNING_RECORDED':
      return 'LEARNING';
    case 'STATUS_CHANGE':
    case 'ERROR_OCCURRED':
    case 'SYSTEM_EVENT':
    default:
      return 'CONTEXT';
  }
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity
 *
 * List Orchestrator activity with filtering, pagination, and date range support.
 *
 * Query parameters:
 * - limit: Number of activities to return (default: 50, max: 100)
 * - cursor: Cursor for pagination (activity ID)
 * - type: Filter by activity type (comma-separated for multiple)
 * - dateFrom: Start date for filtering (ISO datetime)
 * - dateTo: End date for filtering (ISO datetime)
 * - channelId: Filter by channel context
 * - taskId: Filter by task context
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns List of Orchestrator activities with pagination metadata
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with access check
    const result = await getOrchestratorWithWorkspaceAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100,
    );
    const cursor = searchParams.get('cursor') || undefined;
    const activityTypes = searchParams.get('type')?.split(',') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const channelId = searchParams.get('channelId') || undefined;
    const taskId = searchParams.get('taskId') || undefined;

    // Build where clause
    const where: Prisma.orchestratorMemoryWhereInput = {
      orchestratorId: orchestratorId,
    };

    // Filter by activity types (stored in memoryType field)
    if (activityTypes && activityTypes.length > 0) {
      // Map activity types to memory types
      const memoryTypes = new Set(
        activityTypes.map((type) =>
          getMemoryTypeForActivity(type as ActivityType),
        ),
      );
      where.memoryType = { in: Array.from(memoryTypes) };
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Note: channelId and taskId are stored in metadata, not as separate fields
    // Filtering by these would require filtering in memory after fetching

    // Fetch activities with cursor pagination
    const activities = await prisma.orchestratorMemory.findMany({
      where,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      take: limit + 1, // Fetch one extra to determine if there are more
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        memoryType: true,
        content: true,
        metadata: true,
        importance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Determine if there are more results
    const hasMore = activities.length > limit;
    let items = hasMore ? activities.slice(0, -1) : activities;

    // Filter by channelId or taskId if provided (from metadata)
    if (channelId || taskId) {
      items = items.filter((activity) => {
        const metadata = activity.metadata as Record<string, unknown> | null;
        if (!metadata) {
return false;
}
        if (channelId && metadata.channelId !== channelId) {
return false;
}
        if (taskId && metadata.taskId !== taskId) {
return false;
}
        return true;
      });
    }

    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Transform activities to include activity type from metadata
    const formattedActivities = items.map((activity) => {
      const metadata = activity.metadata as ActivityDetails | Record<string, unknown> | null;

      return {
        id: activity.id,
        type: (metadata && typeof metadata === 'object' && 'type' in metadata)
          ? metadata.type
          : 'SYSTEM_EVENT',
        description: metadata && typeof metadata === 'object' && 'summary' in metadata
          ? String(metadata.summary)
          : activity.content,
        details: metadata || {},
        channelId: metadata && typeof metadata === 'object' && 'channelId' in metadata
          ? String(metadata.channelId)
          : undefined,
        taskId: metadata && typeof metadata === 'object' && 'taskId' in metadata
          ? String(metadata.taskId)
          : undefined,
        importance: activity.importance,
        keywords: metadata && typeof metadata === 'object' && 'keywords' in metadata
          ? (metadata.keywords as string[])
          : [],
        timestamp: activity.createdAt,
        updatedAt: activity.updatedAt,
      };
    });

    return NextResponse.json({
      data: {
        activities: formattedActivities,
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity
 *
 * Log new Orchestrator activity (internal use - typically called by Orchestrator daemon or system).
 *
 * Request body:
 * - type: Activity type (TASK_STARTED, TASK_COMPLETED, STATUS_CHANGE, etc.)
 * - description: Human-readable activity description
 * - details: Additional activity details (metadata)
 * - timestamp: Optional custom timestamp (defaults to now)
 * - channelId: Optional channel context
 * - taskId: Optional task context
 * - importance: Activity importance (1-10, default: 5)
 *
 * Requires authentication and admin/owner role OR Orchestrator service account.
 *
 * @param request - Next.js request with activity data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Created activity record
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    if (
      !body ||
      typeof body !== 'object' ||
      !('type' in body) ||
      !('description' in body)
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Missing required fields: type and description',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const input = body as {
      type: ActivityType;
      description: string;
      details?: Record<string, unknown>;
      timestamp?: string;
      channelId?: string;
      taskId?: string;
      importance?: number;
    };

    // Get Orchestrator with access check
    const result = await getOrchestratorWithWorkspaceAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check permissions: either admin/owner OR the Orchestrator's own service account
    const isOrchestratorServiceAccount = session.user.isOrchestrator && session.user.id === result.orchestrator.userId;
    const hasAdminAccess = result.role === 'OWNER' || result.role === 'ADMIN';

    if (!isOrchestratorServiceAccount && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to log activity for this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Validate activity type
    if (!Object.values(ACTIVITY_TYPES).includes(input.type)) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid activity type. Must be one of: ${Object.values(ACTIVITY_TYPES).join(', ')}`,
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Determine memory type based on activity type
    const memoryType = getMemoryTypeForActivity(input.type);

    // Extract keywords from description
    const keywords = input.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 10);

    // Create activity metadata
    const activityMetadata: ActivityDetails = {
      type: input.type,
      description: input.description,
      summary: input.description,
      metadata: input.details || {},
      keywords,
      ...(input.channelId && {
        channelId: input.channelId,
        relatedResourceId: input.channelId,
        relatedResourceType: 'channel',
      }),
      ...(input.taskId && {
        taskId: input.taskId,
        relatedResourceId: input.taskId,
        relatedResourceType: 'task',
      }),
    };

    // Create activity record as OrchestratorMemory
    const activity = await prisma.orchestratorMemory.create({
      data: {
        orchestratorId: orchestratorId,
        memoryType,
        content: input.description,
        metadata: activityMetadata as unknown as Prisma.InputJsonValue,
        importance: input.importance || 5,
        createdAt: input.timestamp ? new Date(input.timestamp) : undefined,
      },
      select: {
        id: true,
        memoryType: true,
        content: true,
        metadata: true,
        importance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Format response
    const metadata = activity.metadata as ActivityDetails | Record<string, unknown> | null;
    const formattedActivity = {
      id: activity.id,
      type: (metadata && typeof metadata === 'object' && 'type' in metadata)
        ? metadata.type
        : input.type,
      description: metadata && typeof metadata === 'object' && 'summary' in metadata
        ? String(metadata.summary)
        : activity.content,
      details: metadata || {},
      channelId: metadata && typeof metadata === 'object' && 'channelId' in metadata
        ? String(metadata.channelId)
        : undefined,
      taskId: metadata && typeof metadata === 'object' && 'taskId' in metadata
        ? String(metadata.taskId)
        : undefined,
      importance: activity.importance,
      keywords: metadata && typeof metadata === 'object' && 'keywords' in metadata
        ? (metadata.keywords as string[])
        : keywords,
      timestamp: activity.createdAt,
      updatedAt: activity.updatedAt,
    };

    return NextResponse.json(
      {
        data: formattedActivity,
        message: 'Activity logged successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/activity] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
