import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const ipListSchema = z.object({
  allowlist: z.array(z.string().ip()).optional(),
  blocklist: z.array(z.string().ip()).optional(),
  enabled: z.boolean(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = (workspace.settings as Record<string, unknown>) || {};
    const ipRestrictions = (settings.ipRestrictions as Record<
      string,
      unknown
    >) || {
      allowlist: [],
      blocklist: [],
      enabled: false,
    };

    return NextResponse.json({ ipRestrictions });
  } catch (error) {
    console.error('Error fetching IP restrictions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    // Validate input
    const parseResult = ipListSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update IP restrictions
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      ipRestrictions: parseResult.data,
    };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorType: 'user',
        action: 'settings.ip_restrictions.updated',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          enabled: parseResult.data.enabled,
          allowlistCount: parseResult.data.allowlist?.length || 0,
          blocklistCount: parseResult.data.blocklist?.length || 0,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ipRestrictions: parseResult.data });
  } catch (error) {
    console.error('Error updating IP restrictions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
