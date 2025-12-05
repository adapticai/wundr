/**
 * Orchestrator Configuration API Routes
 *
 * Handles orchestrator configuration operations.
 *
 * Routes:
 * - GET /api/orchestrators/:id/config - Get orchestrator configuration
 * - PUT /api/orchestrators/:id/config - Update orchestrator configuration
 *
 * @module app/api/orchestrators/[orchestratorId]/config/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { checkOrchestratorAccess } from '@/lib/api/orchestrator-helpers';
import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';
import {
  updateOrchestratorConfigSchema,
  createDefaultOrchestratorConfig,
  ORCHESTRATOR_CONFIG_ERROR_CODES,
} from '@/lib/validations/orchestrator-config';

import type { UpdateOrchestratorConfigInput } from '@/lib/validations/orchestrator-config';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * GET /api/orchestrators/:id/config
 *
 * Get orchestrator configuration.
 * Orchestrators can view their own config, admins can view any config.
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestratorId
 * @returns Orchestrator configuration
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkOrchestratorAccess(
      params.orchestratorId,
      session.user.id
    );
    if (!access.hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get or create configuration
    let config = await prisma.orchestratorConfig.findUnique({
      where: { orchestratorId: params.orchestratorId },
    });

    // Create default config if it doesn't exist
    if (!config) {
      const defaultConfig = createDefaultOrchestratorConfig();
      config = await prisma.orchestratorConfig.create({
        data: {
          orchestratorId: params.orchestratorId,
          ...(defaultConfig as any),
        },
      });
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('[GET /api/orchestrators/:id/config] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONFIG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orchestrators/:id/config
 *
 * Update orchestrator configuration.
 * Orchestrators can update their own config, admins can update any config.
 * If config is locked by admin, orchestrators cannot update it.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing orchestratorId
 * @returns Updated orchestrator configuration
 */
export async function PUT(
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
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          ORCHESTRATOR_CONFIG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateOrchestratorConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONFIG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateOrchestratorConfigInput = parseResult.data;

    // Check access
    const access = await checkOrchestratorAccess(
      params.orchestratorId,
      session.user.id
    );
    if (!access.hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get existing config
    const existingConfig = await prisma.orchestratorConfig.findUnique({
      where: { orchestratorId: params.orchestratorId },
    });

    // Check if config is locked and user is not admin
    if (existingConfig?.isLocked && !access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Configuration is locked by administrator',
          ORCHESTRATOR_CONFIG_ERROR_CODES.CONFIG_LOCKED
        ),
        { status: 403 }
      );
    }

    // Prevent non-admins from modifying admin overrides and lock status
    const updateData = { ...input };
    if (!access.isAdmin) {
      delete updateData.adminOverrides;
      delete updateData.isLocked;
    }

    // Update or create configuration
    const updatedConfig = await prisma.orchestratorConfig.upsert({
      where: { orchestratorId: params.orchestratorId },
      update: updateData as any,
      create: {
        orchestratorId: params.orchestratorId,
        ...(createDefaultOrchestratorConfig() as any),
        ...(updateData as any),
      },
    });

    return NextResponse.json({
      data: updatedConfig,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/orchestrators/:id/config] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONFIG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
