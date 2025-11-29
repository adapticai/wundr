/**
 * Orchestrator Capabilities API Routes
 *
 * Handles orchestrator capability configuration operations.
 *
 * Routes:
 * - GET /api/orchestrators/:id/capabilities - Get orchestrator capabilities
 * - PUT /api/orchestrators/:id/capabilities - Update orchestrator capabilities
 *
 * @module app/api/orchestrators/[orchestratorId]/capabilities/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateCapabilitiesSchema,
  createDefaultOrchestratorConfig,
  ORCHESTRATOR_CONFIG_ERROR_CODES,
} from '@/lib/validations/orchestrator-config';
import {
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { UpdateCapabilitiesInput } from '@/lib/validations/orchestrator-config';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to orchestrator
 */
async function checkOrchestratorAccess(orchestratorId: string, userId: string) {
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: { id: true },
      },
      organization: {
        select: { id: true },
      },
    },
  });

  if (!orchestrator) {
    return { hasAccess: false, isOwner: false, orchestrator: null };
  }

  const isOwner = orchestrator.userId === userId;

  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orchestrator.organizationId,
        userId,
      },
    },
  });

  const isAdmin = orgMember?.role === 'ADMIN' || orgMember?.role === 'OWNER';

  return {
    hasAccess: isOwner || isAdmin,
    isOwner,
    isAdmin,
    orchestrator,
  };
}

/**
 * GET /api/orchestrators/:id/capabilities
 *
 * Get orchestrator capabilities configuration.
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestratorId
 * @returns Orchestrator capabilities
 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkOrchestratorAccess(params.orchestratorId, session.user.id);
    if (!access.hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get configuration
    let config = await prisma.orchestratorConfig.findUnique({
      where: { orchestratorId: params.orchestratorId },
      select: {
        enabledCapabilities: true,
        capabilityLimits: true,
      },
    });

    // Create default config if it doesn't exist
    if (!config) {
      const defaultConfig = createDefaultOrchestratorConfig();
      const newConfig = await prisma.orchestratorConfig.create({
        data: {
          orchestratorId: params.orchestratorId,
          ...(defaultConfig as any),
        },
        select: {
          enabledCapabilities: true,
          capabilityLimits: true,
        },
      });
      config = newConfig;
    }

    return NextResponse.json({ data: config });
  } catch (error) {
    console.error('[GET /api/orchestrators/:id/capabilities] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONFIG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/orchestrators/:id/capabilities
 *
 * Update orchestrator capabilities configuration.
 *
 * @param request - Next.js request with capabilities data
 * @param context - Route context containing orchestratorId
 * @returns Updated capabilities configuration
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
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
          ORCHESTRATOR_CONFIG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateCapabilitiesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONFIG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateCapabilitiesInput = parseResult.data;

    // Check access
    const access = await checkOrchestratorAccess(params.orchestratorId, session.user.id);
    if (!access.hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
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
          ORCHESTRATOR_CONFIG_ERROR_CODES.CONFIG_LOCKED,
        ),
        { status: 403 },
      );
    }

    // Update capabilities
    const defaultConfig = createDefaultOrchestratorConfig();
    const updatedConfig = await prisma.orchestratorConfig.upsert({
      where: { orchestratorId: params.orchestratorId },
      update: {
        enabledCapabilities: input.capabilities as any,
      },
      create: {
        orchestratorId: params.orchestratorId,
        ...(defaultConfig as any),
        enabledCapabilities: input.capabilities as any,
      },
      select: {
        enabledCapabilities: true,
        capabilityLimits: true,
      },
    });

    return NextResponse.json({
      data: updatedConfig,
      message: 'Capabilities updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/orchestrators/:id/capabilities] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONFIG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
