/**
 * Domain Settings API Routes
 *
 * Handles domain-based auto-invite settings for workspaces.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/invites/domain-settings - Get domain settings
 * - POST /api/workspaces/:workspaceSlug/admin/invites/domain-settings - Update domain settings
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/invites/domain-settings/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface DomainSettings {
  enableAutoInvite: boolean;
  allowedDomains: string[];
  defaultRole: string;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/invites/domain-settings
 *
 * Get domain-based auto-invite settings. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug
 * @returns Domain settings
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const settings = (workspace.settings as Record<string, unknown>) || {};
    const domainSettings = (settings.domainInviteSettings as DomainSettings) || {
      enableAutoInvite: false,
      allowedDomains: [],
      defaultRole: 'MEMBER',
    };

    return NextResponse.json({ settings: domainSettings });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch domain settings',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/invites/domain-settings
 *
 * Update domain-based auto-invite settings. Requires admin role.
 *
 * @param request - Next.js request with domain settings
 * @param context - Route context containing workspace slug
 * @returns Updated domain settings
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invalid JSON body',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const domainSettings = body as DomainSettings;

    // Validate domain settings
    if (
      typeof domainSettings.enableAutoInvite !== 'boolean' ||
      !Array.isArray(domainSettings.allowedDomains) ||
      typeof domainSettings.defaultRole !== 'string'
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invalid domain settings format',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Update workspace settings
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...currentSettings,
          domainInviteSettings: domainSettings,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'domain_settings.updated', ${session.user.id}, ${JSON.stringify(domainSettings)}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({
      message: 'Domain settings updated successfully',
      settings: domainSettings,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to update domain settings',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
