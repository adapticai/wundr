/**
 * OrchestratorBulk Operations API Route
 *
 * Handles bulk status change operations for multiple Orchestrator entities.
 *
 * Routes:
 * - POST /api/orchestrators/bulk - Execute bulk action (activate/deactivate)
 *
 * @module app/api/orchestrators/bulk/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
  orchestratorBulkActionSchema,
} from '@/lib/validations/orchestrator';

import type {
  OrchestratorBulkActionInput,
  OrchestratorStatusType,
} from '@/lib/validations/orchestrator';
import type { NextRequest } from 'next/server';

/**
 * Maps action to Orchestrator status (for activate/deactivate only)
 */
const ACTION_TO_STATUS: Partial<
  Record<OrchestratorBulkActionInput['action'], OrchestratorStatusType>
> = {
  activate: 'ONLINE',
  deactivate: 'OFFLINE',
};

/**
 * Maps action to User status (for activate/deactivate only)
 */
const ACTION_TO_USER_STATUS: Partial<
  Record<OrchestratorBulkActionInput['action'], 'ACTIVE' | 'INACTIVE'>
> = {
  activate: 'ACTIVE',
  deactivate: 'INACTIVE',
};

/**
 * Result of a single Orchestrator operation in a bulk request
 */
interface BulkOperationResult {
  orchestratorId: string;
  success: boolean;
  previousStatus?: string;
  newStatus?: string;
  error?: string;
}

/**
 * POST /api/orchestrators/bulk
 *
 * Execute a bulk action on multiple VPs (activate or deactivate).
 * Requires authentication and admin/owner role for each Orchestrator's organization.
 * Operations are performed independently - failures don't affect other VPs.
 *
 * @param request - Next.js request with bulk action data
 * @returns Results for each Orchestrator operation
 *
 * @example
 * ```
 * POST /api/orchestrators/bulk
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
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = orchestratorBulkActionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: OrchestratorBulkActionInput = parseResult.data;

    // Normalize IDs (support both 'ids' and 'orchestratorIds' fields)
    const orchestratorIds = input.ids || input.orchestratorIds || [];

    // Get user's organization memberships with admin/owner roles
    const userOrganizations = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { organizationId: true, role: true },
    });

    const adminOrgIds = new Set(userOrganizations.map(m => m.organizationId));

    // Fetch all requested VPs
    const orchestrators = await prisma.orchestrator.findMany({
      where: { id: { in: orchestratorIds } },
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
    const vpMap = new Map(
      orchestrators.map(orchestrator => [orchestrator.id, orchestrator])
    );

    // Process each Orchestrator
    const results: BulkOperationResult[] = [];

    // Check if action is valid for status updates
    const isStatusUpdateAction =
      input.action === 'activate' || input.action === 'deactivate';

    // Only process activate/deactivate actions for now
    if (!isStatusUpdateAction) {
      return NextResponse.json(
        createErrorResponse(
          `Bulk action '${input.action}' is not yet implemented`,
          ORCHESTRATOR_ERROR_CODES.INVALID_REQUEST
        ),
        { status: 400 }
      );
    }

    const newStatus = ACTION_TO_STATUS[input.action]!;
    const newUserStatus = ACTION_TO_USER_STATUS[input.action]!;

    // Track VPs to update (those we have permission for)
    const orchestratorsToUpdate: {
      orchestratorId: string;
      userId: string;
      previousStatus: string;
    }[] = [];

    for (const orchestratorId of orchestratorIds) {
      const orchestrator = vpMap.get(orchestratorId);

      // Check if Orchestrator exists
      if (!orchestrator) {
        results.push({
          orchestratorId,
          success: false,
          error: 'Orchestrator not found',
        });
        continue;
      }

      // Check if user has admin access to Orchestrator's organization
      if (!adminOrgIds.has(orchestrator.organizationId)) {
        results.push({
          orchestratorId,
          success: false,
          error: 'Insufficient permissions',
        });
        continue;
      }

      // Check if already in target status
      if (orchestrator.status === newStatus) {
        results.push({
          orchestratorId,
          success: true,
          previousStatus: orchestrator.status,
          newStatus: orchestrator.status,
        });
        continue;
      }

      // Add to batch update
      orchestratorsToUpdate.push({
        orchestratorId: orchestrator.id,
        userId: orchestrator.user.id,
        previousStatus: orchestrator.status,
      });
    }

    // Perform batch update in a transaction
    if (orchestratorsToUpdate.length > 0) {
      await prisma.$transaction(async tx => {
        // Update all Orchestrator statuses
        await tx.orchestrator.updateMany({
          where: {
            id: { in: orchestratorsToUpdate.map(v => v.orchestratorId) },
          },
          data: { status: newStatus },
        });

        // Update all associated user statuses
        await tx.user.updateMany({
          where: { id: { in: orchestratorsToUpdate.map(v => v.userId) } },
          data: { status: newUserStatus },
        });
      });

      // Add successful results
      for (const orchestrator of orchestratorsToUpdate) {
        results.push({
          orchestratorId: orchestrator.orchestratorId,
          success: true,
          previousStatus: orchestrator.previousStatus,
          newStatus,
        });
      }
    }

    // Calculate summary statistics
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const skippedCount = results.filter(
      r => r.success && r.previousStatus === r.newStatus
    ).length;

    // Determine response status
    const hasFailures = failureCount > 0;
    const allFailed = successCount === 0;

    // TODO: Log the bulk action to audit log service in production

    // Build response
    const response = {
      action: input.action,
      summary: {
        total: orchestratorIds.length,
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
          code: ORCHESTRATOR_ERROR_CODES.BULK_OPERATION_PARTIAL,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/orchestrators/bulk] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
