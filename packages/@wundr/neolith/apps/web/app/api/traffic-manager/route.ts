/**
 * Traffic Manager Configuration API Routes
 *
 * Routes:
 * - GET /api/traffic-manager - Get traffic manager config for org
 * - PUT /api/traffic-manager - Update traffic manager config
 *
 * @module app/api/traffic-manager/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateTrafficManagerConfigSchema,
  TRAFFIC_MANAGER_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/traffic-manager';

import type { NextRequest } from 'next/server';

/**
 * GET /api/traffic-manager
 *
 * Returns traffic manager configuration for the authenticated user's organization.
 * Config is stored in workspace.settings.trafficManager JSON field.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TRAFFIC_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const orgMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            workspaces: {
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Organization not found', TRAFFIC_MANAGER_ERROR_CODES.CONFIG_NOT_FOUND),
        { status: 404 }
      );
    }

    const workspace = orgMembership.organization.workspaces[0];
    const settings = (workspace?.settings ?? {}) as Record<string, unknown>;
    const trafficManagerConfig = settings.trafficManager ?? null;

    return NextResponse.json({
      data: {
        config: trafficManagerConfig,
        organizationId: orgMembership.organizationId,
        workspaceId: workspace?.id ?? null,
      },
    });
  } catch (error) {
    console.error('[GET /api/traffic-manager] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TRAFFIC_MANAGER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/traffic-manager
 *
 * Updates traffic manager configuration. Validated with updateTrafficManagerConfigSchema.
 * Stored in workspace.settings.trafficManager JSON field.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TRAFFIC_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    const parseResult = updateTrafficManagerConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 }
      );
    }

    const orgMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            workspaces: {
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Organization not found', TRAFFIC_MANAGER_ERROR_CODES.CONFIG_NOT_FOUND),
        { status: 404 }
      );
    }

    const workspace = orgMembership.organization.workspaces[0];
    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', TRAFFIC_MANAGER_ERROR_CODES.CONFIG_NOT_FOUND),
        { status: 404 }
      );
    }

    const currentSettings = (workspace.settings ?? {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      trafficManager: {
        ...(currentSettings.trafficManager as Record<string, unknown> | undefined ?? {}),
        ...parseResult.data,
      },
    };

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { settings: updatedSettings },
    });

    const settings = updatedWorkspace.settings as Record<string, unknown>;

    return NextResponse.json({
      data: {
        config: settings.trafficManager,
        organizationId: orgMembership.organizationId,
        workspaceId: workspace.id,
      },
      message: 'Traffic manager configuration updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/traffic-manager] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TRAFFIC_MANAGER_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
