/**
 * VP Memory Detail API Routes
 *
 * Handles individual memory operations including retrieval, update, and deletion.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId] - Get memory
 * - PATCH /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId] - Update memory
 * - DELETE /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId] - Delete memory
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { deleteMemory } from '@/lib/services/vp-memory-service';
import {
  memoryIdParamSchema,
  updateMemorySchema,
  createErrorResponse,
  MEMORY_ERROR_CODES,
} from '@/lib/validations/vp-memory';

import type { UpdateMemoryInput } from '@/lib/validations/vp-memory';
import type { NextRequest } from 'next/server';

/**
 * Route context with params as a Promise (Next.js 16+)
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
    memoryId: string;
  }>;
}

/**
 * Helper to verify VP and memory access
 */
async function verifyMemoryAccess(
  workspaceId: string,
  vpId: string,
  memoryId: string,
  userId: string,
): Promise<{ allowed: boolean; memory?: any }> {
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

  // Verify VP exists and belongs to workspace
  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
    },
    select: { id: true, workspaceId: true },
  });

  if (!vp) {
    return { allowed: false };
  }

  if (vp.workspaceId && vp.workspaceId !== workspaceId) {
    return { allowed: false };
  }

  // Verify memory exists and belongs to VP
  const memory = await prisma.vPMemory.findFirst({
    where: {
      id: memoryId,
      vpId,
    },
  });

  if (!memory) {
    return { allowed: false };
  }

  return { allowed: true, memory };
}

/**
 * GET /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]
 *
 * Get a specific memory entry by ID.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspaceId, vpId, and memoryId
 * @returns Memory entry details
 */
export async function GET(
  _request: NextRequest,
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
    const { workspaceId, vpId, memoryId } = resolvedParams;

    // Validate memory ID format
    const paramResult = memoryIdParamSchema.safeParse({ memoryId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid memory ID format', MEMORY_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyMemoryAccess(workspaceId, vpId, memoryId, session.user.id);
    if (!access.allowed) {
      return NextResponse.json(
        createErrorResponse('Memory not found or access denied', MEMORY_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ data: access.memory });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]
 *
 * Update a specific memory entry.
 *
 * Request body:
 * {
 *   "content": "Updated content",
 *   "importance": 0.8,
 *   "metadata": { "updated": true }
 * }
 *
 * @param request - Next.js request with update data
 * @param context - Route context with workspaceId, vpId, and memoryId
 * @returns Updated memory entry
 */
export async function PATCH(
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
    const { workspaceId, vpId, memoryId } = resolvedParams;

    // Validate memory ID format
    const paramResult = memoryIdParamSchema.safeParse({ memoryId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid memory ID format', MEMORY_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyMemoryAccess(workspaceId, vpId, memoryId, session.user.id);
    if (!access.allowed) {
      return NextResponse.json(
        createErrorResponse('Memory not found or access denied', MEMORY_ERROR_CODES.NOT_FOUND),
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
    const parseResult = updateMemorySchema.safeParse(body);
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

    const input: UpdateMemoryInput = parseResult.data;

    // Update memory
    const updatedMemory = await prisma.vPMemory.update({
      where: { id: memoryId },
      data: {
        ...(input.content && { content: input.content }),
        ...(input.embedding !== undefined && {
          embedding: input.embedding as Prisma.InputJsonValue,
        }),
        ...(input.metadata && { metadata: input.metadata as Prisma.InputJsonValue }),
        ...(input.importance !== undefined && { importance: input.importance }),
        ...(input.expiresAt !== undefined && {
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        }),
      },
    });

    return NextResponse.json({
      data: updatedMemory,
      message: 'Memory updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]] Error:',
      error,
    );

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Memory not found', MEMORY_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]
 *
 * Delete a specific memory entry.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspaceId, vpId, and memoryId
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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
    const { workspaceId, vpId, memoryId } = resolvedParams;

    // Validate memory ID format
    const paramResult = memoryIdParamSchema.safeParse({ memoryId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid memory ID format', MEMORY_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyMemoryAccess(workspaceId, vpId, memoryId, session.user.id);
    if (!access.allowed) {
      return NextResponse.json(
        createErrorResponse('Memory not found or access denied', MEMORY_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Delete memory using service
    const deleted = await deleteMemory(vpId, memoryId);

    if (!deleted) {
      return NextResponse.json(
        createErrorResponse('Failed to delete memory', MEMORY_ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: 'Memory deleted successfully',
      data: { id: memoryId, deleted: true },
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/[workspaceId]/vps/[vpId]/memory/[memoryId]] Error:',
      error,
    );

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Memory not found', MEMORY_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
