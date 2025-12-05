import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const securityAlertsSchema = z.object({
  newDeviceLogin: z.boolean(),
  failedLoginAttempts: z.boolean(),
  roleChanges: z.boolean(),
  apiKeyCreated: z.boolean(),
  apiKeyRevoked: z.boolean(),
  securitySettingsChanged: z.boolean(),
  unusualActivity: z.boolean(),
  dataExport: z.boolean(),
  alertEmail: z.string().email().optional(),
  alertSlackWebhook: z.string().url().optional(),
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
      select: {
        id: true,
        settings: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = (workspace.settings as Record<string, unknown>) || {};
    const securityAlerts = (settings.securityAlerts as Record<
      string,
      unknown
    >) || {
      newDeviceLogin: true,
      failedLoginAttempts: true,
      roleChanges: true,
      apiKeyCreated: true,
      apiKeyRevoked: true,
      securitySettingsChanged: true,
      unusualActivity: false,
      dataExport: true,
      alertEmail: null,
      alertSlackWebhook: null,
    };

    return NextResponse.json({ securityAlerts });
  } catch (error) {
    console.error('Error fetching security alerts:', error);
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
    const parseResult = securityAlertsSchema.safeParse(body);
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
      select: {
        id: true,
        settings: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update security alerts settings
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      securityAlerts: parseResult.data,
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
        action: 'settings.security_alerts.updated',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          changes: parseResult.data,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ securityAlerts: parseResult.data });
  } catch (error) {
    console.error('Error updating security alerts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
