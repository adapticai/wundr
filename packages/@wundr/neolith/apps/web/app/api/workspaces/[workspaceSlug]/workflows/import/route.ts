/**
 * Workflow Import API Route
 *
 * Handles importing workflows from JSON with validation and conflict resolution.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/workflows/import - Import workflows from JSON
 *
 * @module app/api/workspaces/[workspaceSlug]/workflows/import/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createWorkflowSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { CreateWorkflowInput } from '@/lib/validations/workflow';
import type { WorkflowStatus } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Import result for a single workflow
 */
interface ImportResult {
  success: boolean;
  workflowName: string;
  workflowId?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Import request body
 */
interface ImportRequestBody {
  workflows: unknown[];
  conflictResolution?: 'skip' | 'rename' | 'overwrite';
  validateOnly?: boolean;
}

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    include: {
      organization: true,
    },
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
  });

  if (!orgMembership) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * POST /api/workspaces/:workspaceSlug/workflows/import
 *
 * Import workflows from JSON with validation and conflict resolution.
 *
 * @param request - Next.js request with import data
 * @param context - Route context with workspaceSlug
 * @returns Import results for all workflows
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/workflows/import
 * Content-Type: application/json
 *
 * {
 *   "workflows": [
 *     {
 *       "name": "Welcome Flow",
 *       "trigger": { "type": "user_join" },
 *       "actions": [...]
 *     }
 *   ],
 *   "conflictResolution": "rename",
 *   "validateOnly": false
 * }
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
          WORKFLOW_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Must be workspace member to import workflows
    if (!access.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to import workflows',
          WORKFLOW_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse request body
    let body: ImportRequestBody;
    try {
      body = (await request.json()) as ImportRequestBody;
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const {
      workflows: workflowsData,
      conflictResolution = 'rename',
      validateOnly = false,
    } = body;

    if (!Array.isArray(workflowsData) || workflowsData.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one workflow is required',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get existing workflows for conflict detection
    const existingWorkflows = await prisma.workflow.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const results: ImportResult[] = [];

    // Process each workflow
    for (const workflowData of workflowsData) {
      try {
        // Handle exported workflow format (wrapped in version/metadata)
        const data =
          workflowData &&
          typeof workflowData === 'object' &&
          'workflow' in workflowData
            ? (workflowData as { workflow: unknown }).workflow
            : workflowData;

        // Validate workflow data
        const parseResult = createWorkflowSchema.safeParse(data);
        if (!parseResult.success) {
          results.push({
            success: false,
            workflowName:
              (data && typeof data === 'object' && 'name' in data
                ? String(data.name)
                : 'Unknown') || 'Unknown',
            error: `Validation failed: ${parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          });
          continue;
        }

        const input: CreateWorkflowInput = parseResult.data;
        let finalName = input.name;
        const warnings: string[] = [];

        // Check for name conflicts
        const nameExists = existingWorkflows.some(w => w.name === finalName);
        if (nameExists) {
          if (conflictResolution === 'skip') {
            results.push({
              success: false,
              workflowName: input.name,
              error: 'Workflow with this name already exists (skipped)',
            });
            continue;
          } else if (conflictResolution === 'rename') {
            let counter = 1;
            while (
              existingWorkflows.some(
                w => w.name === `${input.name} (${counter})`
              )
            ) {
              counter++;
            }
            finalName = `${input.name} (${counter})`;
            warnings.push(
              `Workflow renamed from "${input.name}" to "${finalName}" due to name conflict`
            );
          } else if (conflictResolution === 'overwrite') {
            // Find and delete existing workflow
            const existingWorkflow = existingWorkflows.find(
              w => w.name === finalName
            );
            if (existingWorkflow) {
              await prisma.workflow.delete({
                where: { id: existingWorkflow.id },
              });
              warnings.push(`Existing workflow "${finalName}" was overwritten`);
            }
          }
        }

        // If validate-only mode, skip actual creation
        if (validateOnly) {
          results.push({
            success: true,
            workflowName: finalName,
            warnings,
          });
          continue;
        }

        // Create workflow
        const workflow = await prisma.workflow.create({
          data: {
            name: finalName,
            description: input.description,
            trigger: input.trigger as Prisma.InputJsonValue,
            actions: input.actions as unknown as Prisma.InputJsonValue,
            status: (input.status || 'DRAFT') as WorkflowStatus,
            tags: input.tags ?? [],
            metadata: input.metadata as Prisma.InputJsonValue,
            workspaceId,
            createdBy: session.user.id,
          },
        });

        results.push({
          success: true,
          workflowName: finalName,
          workflowId: workflow.id,
          warnings,
        });
      } catch (error) {
        // Handle Prisma errors
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          results.push({
            success: false,
            workflowName:
              (workflowData &&
              typeof workflowData === 'object' &&
              'name' in workflowData
                ? String(workflowData.name)
                : 'Unknown') || 'Unknown',
            error: 'A workflow with this name already exists',
          });
        } else {
          results.push({
            success: false,
            workflowName:
              (workflowData &&
              typeof workflowData === 'object' &&
              'name' in workflowData
                ? String(workflowData.name)
                : 'Unknown') || 'Unknown',
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          });
        }
      }
    }

    // Calculate summary stats
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const warningCount = results.reduce(
      (sum, r) => sum + (r.warnings?.length || 0),
      0
    );

    return NextResponse.json(
      {
        success: failureCount === 0,
        message: validateOnly
          ? `Validation complete: ${successCount} valid, ${failureCount} invalid`
          : `Import complete: ${successCount} imported, ${failureCount} failed`,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failureCount,
          warnings: warningCount,
        },
      },
      { status: failureCount === 0 ? 200 : 207 } // 207 Multi-Status for partial success
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/workflows/import] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred during import',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
