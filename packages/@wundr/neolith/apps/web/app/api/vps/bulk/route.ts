/**
 * VP Bulk Operations API Route
 *
 * Handles bulk status change operations for multiple Virtual Person (VP) entities.
 *
 * Routes:
 * - POST /api/vps/bulk - Execute bulk action (activate/deactivate)
 *
 * @module app/api/vps/bulk/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpBulkActionSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { VPBulkActionInput, VPStatusType } from '@/lib/validations/vp';
import type { NextRequest} from 'next/server';

/**
 * Maps action to VP status
 */
const ACTION_TO_STATUS: Record<VPBulkActionInput['action'], VPStatusType> = {
  activate: 'ONLINE',
  deactivate: 'OFFLINE',
};

/**
 * Maps action to User status
 */
const ACTION_TO_USER_STATUS: Record<VPBulkActionInput['action'], 'ACTIVE' | 'INACTIVE'> = {
  activate: 'ACTIVE',
  deactivate: 'INACTIVE',
};

/**
 * Result of a single VP operation in a bulk request
 */
interface BulkOperationResult {
  vpId: string;
  success: boolean;
  previousStatus?: string;
  newStatus?: string;
  error?: string;
}

/**
 * POST /api/vps/bulk
 *
 * Execute a bulk action on multiple VPs (activate or deactivate).
 * Requires authentication and admin/owner role for each VP's organization.
 * Operations are performed independently - failures don't affect other VPs.
 *
 * @param request - Next.js request with bulk action data
 * @returns Results for each VP operation
 *
 * @example
 * ```
 * POST /api/vps/bulk
 * Content-Type: application/json
 *
 * {
 *   "action": "deactivate",
 *   "ids": ["vp_123", "vp_456", "vp_789"],
 *   "reason": "Scheduled maintenance"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = vpBulkActionSchema.safeParse(body);
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

    const input: VPBulkActionInput = parseResult.data;

    // Get user's organization memberships with admin/owner roles
    const userOrganizations = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { organizationId: true, role: true },
    });

    const adminOrgIds = new Set(userOrganizations.map((m) => m.organizationId));

    // Fetch all requested VPs
    const vps = await prisma.vP.findMany({
      where: { id: { in: input.ids } },
      include: {
        user: {
          select: { id: true, name: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    // Create a map for quick lookup
    const vpMap = new Map(vps.map((vp) => [vp.id, vp]));

    // Process each VP
    const results: BulkOperationResult[] = [];
    const newStatus = ACTION_TO_STATUS[input.action];
    const newUserStatus = ACTION_TO_USER_STATUS[input.action];

    // Track VPs to update (those we have permission for)
    const vpsToUpdate: { vpId: string; userId: string; previousStatus: string }[] = [];

    for (const vpId of input.ids) {
      const vp = vpMap.get(vpId);

      // Check if VP exists
      if (!vp) {
        results.push({
          vpId,
          success: false,
          error: 'VP not found',
        });
        continue;
      }

      // Check if user has admin access to VP's organization
      if (!adminOrgIds.has(vp.organizationId)) {
        results.push({
          vpId,
          success: false,
          error: 'Insufficient permissions',
        });
        continue;
      }

      // Check if already in target status
      if (vp.status === newStatus) {
        results.push({
          vpId,
          success: true,
          previousStatus: vp.status,
          newStatus: vp.status,
        });
        continue;
      }

      // Add to batch update
      vpsToUpdate.push({
        vpId: vp.id,
        userId: vp.user.id,
        previousStatus: vp.status,
      });
    }

    // Perform batch update in a transaction
    if (vpsToUpdate.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Update all VP statuses
        await tx.vP.updateMany({
          where: { id: { in: vpsToUpdate.map((v) => v.vpId) } },
          data: { status: newStatus },
        });

        // Update all associated user statuses
        await tx.user.updateMany({
          where: { id: { in: vpsToUpdate.map((v) => v.userId) } },
          data: { status: newUserStatus },
        });
      });

      // Add successful results
      for (const vp of vpsToUpdate) {
        results.push({
          vpId: vp.vpId,
          success: true,
          previousStatus: vp.previousStatus,
          newStatus,
        });
      }
    }

    // Calculate summary statistics
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const skippedCount = results.filter(
      (r) => r.success && r.previousStatus === r.newStatus,
    ).length;

    // Determine response status
    const hasFailures = failureCount > 0;
    const allFailed = successCount === 0;

    // TODO: Log the bulk action to audit log service in production

    // Build response
    const response = {
      action: input.action,
      summary: {
        total: input.ids.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount,
        updated: successCount - skippedCount,
      },
      results,
      ...(input.reason && { reason: input.reason }),
      message: allFailed
        ? 'All operations failed'
        : hasFailures
        ? 'Some operations failed'
        : 'All operations completed successfully',
    };

    // Return appropriate status code
    if (allFailed) {
      return NextResponse.json(response, { status: 400 });
    }

    if (hasFailures) {
      // Partial success
      return NextResponse.json(
        {
          ...response,
          code: VP_ERROR_CODES.BULK_OPERATION_PARTIAL,
        },
        { status: 207 }, // Multi-Status
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/vps/bulk] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
