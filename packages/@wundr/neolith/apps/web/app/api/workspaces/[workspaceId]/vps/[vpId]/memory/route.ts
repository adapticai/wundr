/**
 * VP Memory API Routes
 *
 * Handles VP memory operations including listing and creating memory entries.
 * All memories are scoped to both the workspace and the VP.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/vps/[vpId]/memory - List memories for VP
 * - POST /api/workspaces/[workspaceId]/vps/[vpId]/memory - Create new memory entry
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/memory/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { storeMemory } from '@/lib/services/vp-memory-service';
import {
  createMemorySchema,
  memoryFiltersSchema,
  createErrorResponse,
  MEMORY_ERROR_CODES,
} from '@/lib/validations/vp-memory';

import type { CreateMemoryInput, MemoryFiltersInput } from '@/lib/validations/vp-memory';
import type { NextRequest } from 'next/server';

/**
 * Route context with params as a Promise (Next.js 16+)
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
  }>;
}

/**
 * Helper to verify VP access
 */
async function verifyVPAccess(
  workspaceId: string,
  vpId: string,
  userId: string,
): Promise<{ allowed: boolean; vp?: { id: string; organizationId: string } }> {
  // Check user has access to workspace
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
    },
  });

  if (!workspaceMember) {
    return { allowed: false };
  }

  // Verify VP exists
  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
    },
    select: { id: true, workspaceId: true, organizationId: true },
  });

  if (!vp) {
    return { allowed: false };
  }

  // Check VP belongs to workspace or organization
  if (vp.workspaceId && vp.workspaceId !== workspaceId) {
    return { allowed: false };
  }

  return { allowed: true, vp };
}

/**
 * GET /api/workspaces/[workspaceId]/vps/[vpId]/memory
 *
 * List memory entries for a specific VP within a workspace.
 * Supports pagination, filtering by memory type, importance, and date range.
 *
 * Query Parameters:
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 * - memoryType: Filter by type (conversation, task_completion, learned_pattern, preference)
 * - minImportance: Minimum importance score (0.0-1.0)
 * - from: Start date (ISO 8601)
 * - to: End date (ISO 8601)
 * - search: Search in content
 * - sortBy: Sort field (createdAt, importance, memoryType)
 * - sortOrder: Sort direction (asc, desc)
 * - includeExpired: Include expired memories (default false)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId and vpId
 * @returns Paginated list of memories for the VP
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MEMORY_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const resolvedParams = await params;
    const { workspaceId, vpId } = resolvedParams;

    // Verify access
    const access = await verifyVPAccess(workspaceId, vpId, session.user.id);
    if (!access.allowed) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          MEMORY_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const filterInput = {
      memoryType: searchParams.get('memoryType') || undefined,
      search: searchParams.get('search') || undefined,
      minImportance: searchParams.get('minImportance') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      includeExpired: searchParams.get('includeExpired') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const parseResult = memoryFiltersSchema.safeParse(filterInput);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid filter parameters',
          MEMORY_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: MemoryFiltersInput = parseResult.data;
    const skip = (filters.page - 1) * filters.limit;

    // Build where clause
    const where: Prisma.vPMemoryWhereInput = {
      vpId,
      ...(filters.memoryType && {
        memoryType: Array.isArray(filters.memoryType)
          ? { in: filters.memoryType }
          : filters.memoryType,
      }),
      ...(filters.minImportance !== undefined && {
        importance: { gte: filters.minImportance },
      }),
      ...(filters.search && {
        content: { contains: filters.search, mode: 'insensitive' as const },
      }),
      ...(filters.from && { createdAt: { gte: new Date(filters.from) } }),
      ...(filters.to && { createdAt: { lte: new Date(filters.to) } }),
      ...(!filters.includeExpired && {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      }),
    };

    // Build order by
    const orderBy: Prisma.vPMemoryOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch memories with count
    const [memories, totalCount] = await Promise.all([
      prisma.vPMemory.findMany({
        where,
        orderBy,
        skip,
        take: filters.limit,
      }),
      prisma.vPMemory.count({ where }),
    ]);

    return NextResponse.json({
      data: memories,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: totalCount,
        pages: Math.ceil(totalCount / filters.limit),
        hasMore: filters.page * filters.limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceId]/vps/[vpId]/memory] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/vps/[vpId]/memory
 *
 * Create a new memory entry for a specific VP.
 *
 * Request body:
 * {
 *   "memoryType": "conversation",
 *   "content": "Memory content text",
 *   "metadata": { "channelId": "channel_123" },
 *   "importance": 0.7,
 *   "expiresAt": "2025-12-31T00:00:00Z"
 * }
 *
 * @param request - Next.js request with memory creation data
 * @param context - Route context with workspaceId and vpId
 * @returns Created memory object
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MEMORY_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const resolvedParams = await params;
    const { workspaceId, vpId } = resolvedParams;

    // Verify access
    const access = await verifyVPAccess(workspaceId, vpId, session.user.id);
    if (!access.allowed) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          MEMORY_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', MEMORY_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createMemorySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          MEMORY_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateMemoryInput = parseResult.data;

    // Create memory using service
    const memory = await storeMemory(vpId, input);

    return NextResponse.json(
      { data: memory, message: 'Memory created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceId]/vps/[vpId]/memory] Error:', error);

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('VP not found', MEMORY_ERROR_CODES.VP_NOT_FOUND),
          { status: 404 },
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          createErrorResponse(
            'Foreign key constraint failed',
            MEMORY_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
