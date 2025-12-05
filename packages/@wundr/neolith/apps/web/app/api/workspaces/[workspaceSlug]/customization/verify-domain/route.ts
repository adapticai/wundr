import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * POST /api/workspaces/:workspaceSlug/customization/verify-domain
 * Verify custom domain DNS configuration
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
        workspaceMembers: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const member = workspace.workspaceMembers[0];
    if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Get custom domain from settings
    const settings = (workspace.settings as Record<string, unknown>) || {};
    const customization = (settings.customization as Record<string, unknown>) || {};
    const customDomain = customization.customDomain as string;

    if (!customDomain) {
      return NextResponse.json(
        { error: 'No custom domain configured' },
        { status: 400 },
      );
    }

    // Verify DNS records
    let verified = false;
    try {
      // In a real implementation, you would:
      // 1. Look up DNS records for the domain
      // 2. Check if CNAME points to your service
      // 3. Verify SSL certificate is valid

      // For this example, we'll use a simple DNS lookup
      const dns = await import('dns').then(m => m.promises);
      const records = await dns.resolveCname(customDomain).catch(() => []);

      // Check if CNAME points to your service domain
      verified = records.some(record =>
        record.includes('neolith.io') || record.includes('app.neolith.io'),
      );
    } catch (error) {
      console.error('DNS verification error:', error);
      verified = false;
    }

    // Update settings with verification status
    const updatedCustomization = {
      ...customization,
      domainVerified: verified,
      domainVerifiedAt: verified ? new Date().toISOString() : null,
    };

    const updatedSettings = {
      ...settings,
      customization: updatedCustomization,
    };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    // Log verification attempt
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorType: 'user',
        action: 'workspace.domain.verification',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          domain: customDomain,
          verified,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      verified,
      domain: customDomain,
      message: verified
        ? 'Domain verified successfully'
        : 'Domain verification pending. Please check DNS records.',
    });
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
