import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const defaults = {
  whoCanCreatePublic: 'everyone' as const,
  whoCanCreatePrivate: 'admins' as const,
  enforceNamingConvention: false,
  allowedCharacters: 'alphanumeric-dash' as const,
  defaultPostingPermission: 'everyone' as const,
  allowThreads: true,
  allowReactions: true,
  autoArchiveInactiveDays: 90,
  whoCanArchive: 'admins' as const,
  archiveRequiresConfirmation: true,
  maxChannelNameLength: 80,
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
    const channelSettings =
      (wsSettings.channels as Record<string, unknown>) || {};

    return NextResponse.json({ ...defaults, ...channelSettings });
  } catch (error) {
    console.error('[GET /admin/settings/channels] Error:', error);
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
      (wsSettings.channels as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, ...body };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { settings: { ...wsSettings, channels: updatedSettings } },
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('[PATCH /admin/settings/channels] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
