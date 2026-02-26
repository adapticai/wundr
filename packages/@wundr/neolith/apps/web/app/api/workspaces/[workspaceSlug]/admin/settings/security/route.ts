import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const defaults = {
  // Authentication
  twoFactorRequired: false,
  ssoEnabled: false,
  ssoProvider: null,
  allowedAuthMethods: ['email', 'google', 'github'],

  // Session Policies
  sessionTimeout: 30,
  requireReauthForSensitive: true,
  maxConcurrentSessions: 5,

  // Domain & Email
  allowedEmailDomains: [],
  blockedEmailDomains: [],
  emailVerificationRequired: true,

  // Data & Privacy
  dataRetentionDays: 365,
  messageEditWindow: 15,
  messageDeleteWindow: 60,
  fileRetentionDays: 365,
  dataExportEnabled: true,

  // Audit & Compliance
  activityLogRetentionDays: 90,
  auditLogsEnabled: true,
  complianceMode: null,

  // API & Integrations
  apiRateLimit: 1000,
  allowedOAuthScopes: ['read', 'write'],
  webhookSignatureRequired: true,
};

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const wsSettings = (workspace.settings as Record<string, unknown>) || {};
    const securitySettings =
      (wsSettings.security as Record<string, unknown>) || {};

    return NextResponse.json({ ...defaults, ...securitySettings });
  } catch (error) {
    console.error('[GET /admin/settings/security] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const wsSettings = (workspace.settings as Record<string, unknown>) || {};
    const currentSettings =
      (wsSettings.security as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, ...body };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { settings: { ...wsSettings, security: updatedSettings } },
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('[PATCH /admin/settings/security] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
