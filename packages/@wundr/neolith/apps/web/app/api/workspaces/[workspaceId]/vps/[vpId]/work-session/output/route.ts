/**
 * VP Work Session Output Capture API Route
 *
 * Captures incremental output and artifacts from VP work sessions.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/work-session/output - Capture session output
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/work-session/output/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  captureOutputSchema,
  createErrorResponse,
  WORK_SESSION_ERROR_CODES,
} from '@/lib/validations/work-session';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with path parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
  }>;
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/work-session/output
 *
 * Capture incremental output from VP work session.
 * Stores logs, progress updates, and artifact references.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and VP IDs
 * @returns Success confirmation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (or VP daemon)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORK_SESSION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Parse request body
    const body = await request.json();
    const validationResult = captureOutputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation error', WORK_SESSION_ERROR_CODES.VALIDATION_ERROR, {
          errors: validationResult.error.errors,
        }),
        { status: 400 },
      );
    }

    const { taskId, output, artifacts, progress, metadata } = validationResult.data;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORK_SESSION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Verify VP exists and belongs to workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        workspaceId,
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', WORK_SESSION_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task exists and belongs to VP
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        vpId,
        workspaceId,
      },
      select: {
        id: true,
        metadata: true,
        status: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', WORK_SESSION_ERROR_CODES.TASK_NOT_FOUND),
        { status: 404 },
      );
    }

    // Get existing metadata
    const currentMetadata = (task.metadata as Prisma.JsonObject) || {};

    // Append output to execution log
    const existingOutputs = (currentMetadata.executionOutputs as string[]) || [];
    const newOutputEntry = {
      timestamp: new Date().toISOString(),
      output,
      progress,
    };

    // Update task metadata with new output and progress
    const updatedMetadata: Prisma.JsonObject = {
      ...currentMetadata,
      progress,
      lastProgressUpdate: new Date().toISOString(),
      executionOutputs: [...existingOutputs, newOutputEntry] as Prisma.JsonArray,
      ...(artifacts.length > 0 && {
        artifacts: [
          ...((currentMetadata.artifacts as string[]) || []),
          ...artifacts,
        ] as Prisma.JsonArray,
      }),
      ...(metadata && {
        execution: {
          ...(currentMetadata.execution as Record<string, unknown>),
          ...metadata,
        } as Prisma.JsonObject,
      }),
    };

    // Update the task
    await prisma.task.update({
      where: { id: taskId },
      data: {
        metadata: updatedMetadata,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Output captured successfully',
      data: {
        taskId,
        progress,
        outputsCaptured: existingOutputs.length + 1,
        artifactsStored: artifacts.length,
      },
    });
  } catch (error) {
    console.error('Error capturing work session output:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORK_SESSION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
