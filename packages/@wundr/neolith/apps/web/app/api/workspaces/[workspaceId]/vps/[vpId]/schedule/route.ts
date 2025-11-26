/**
 * VP Work Schedule API Routes
 *
 * Handles VP work schedule configuration including work hours,
 * active days, timezone, breaks, and batch processing windows.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/schedule - Get VP's work schedule
 * - PATCH /api/workspaces/:workspaceId/vps/:vpId/schedule - Update VP work schedule
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/schedule/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getWorkSchedule,
  updateWorkSchedule,
} from '@/lib/services/vp-scheduling-service';
import { createErrorResponse, VP_ERROR_CODES } from '@/lib/validations/vp';
import {
  getWorkScheduleSchema,
  updateWorkScheduleSchema,
} from '@/lib/validations/vp-scheduling';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to check if user has access to a VP within a workspace
 */
async function checkVPAccess(workspaceId: string, vpId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

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

  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    select: { id: true, userId: true },
  });

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/schedule
 *
 * Get VP's work schedule configuration including:
 * - Work hours per day (e.g., 09:00-17:00)
 * - Active days (Mon-Fri)
 * - Timezone (e.g., America/New_York)
 * - Break times (lunch, etc.)
 * - Batch processing windows (e.g., 2AM-4AM for heavy tasks)
 * - Office hours for availability
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
 * @returns VP work schedule configuration
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/schedule
 *
 * Response:
 * {
 *   "data": {
 *     "workHours": { "startHour": 9, "startMinute": 0, "endHour": 17, "endMinute": 0 },
 *     "activeDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
 *     "timezone": "America/New_York",
 *     "breakTimes": [{ "startHour": 12, "startMinute": 0, "endHour": 13, "endMinute": 0 }],
 *     "batchWindows": [{ "startHour": 2, "startMinute": 0, "endHour": 4, "endMinute": 0 }],
 *     "officeHours": { "startHour": 9, "startMinute": 0, "endHour": 17, "endMinute": 0 }
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = getWorkScheduleSchema.safeParse({
      detailed: searchParams.get('detailed'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const schedule = await getWorkSchedule(vpId);

    // Return default schedule if none configured
    if (!schedule) {
      return NextResponse.json({
        data: {
          workHours: { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
          activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          timezone: 'America/New_York',
          breakTimes: [],
          batchWindows: [],
          officeHours: { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        },
        message: 'Using default schedule configuration',
      });
    }

    return NextResponse.json({ data: schedule });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/vps/:vpId/schedule] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/vps/:vpId/schedule
 *
 * Update VP's work schedule configuration.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with schedule update data
 * @param context - Route context containing workspace and VP IDs
 * @returns Updated work schedule
 *
 * @example
 * ```
 * PATCH /api/workspaces/ws_123/vps/vp_456/schedule
 * Content-Type: application/json
 *
 * {
 *   "workHours": { "startHour": 8, "startMinute": 0, "endHour": 16, "endMinute": 0 },
 *   "activeDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"],
 *   "timezone": "America/Los_Angeles"
 * }
 *
 * Response:
 * {
 *   "data": { ... updated schedule ... },
 *   "message": "Work schedule updated successfully"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = updateWorkScheduleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update VP schedule',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const updatedSchedule = await updateWorkSchedule(vpId, parseResult.data);

    return NextResponse.json({
      data: updatedSchedule,
      message: 'Work schedule updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/vps/:vpId/schedule] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
