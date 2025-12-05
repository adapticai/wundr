/**
 * Storage Cleanup API Routes
 *
 * Handles storage cleanup operations.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/storage/cleanup - Run cleanup
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/storage/cleanup/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface CleanupRequest {
  fileIds?: string[];
  olderThanDays?: number;
  fileTypes?: string[];
  minSize?: number; // in bytes
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/storage/cleanup
 *
 * Run cleanup operation. Requires admin role.
 */
export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body: CleanupRequest = await request.json();

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspaceSlug, userId: session.user.id },
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

    // Build where clause
    const where: any = {
      workspaceId: workspaceSlug,
    };

    if (body.fileIds && body.fileIds.length > 0) {
      where.id = { in: body.fileIds };
    }

    if (body.olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - body.olderThanDays);
      where.createdAt = { lt: cutoffDate };
    }

    if (body.fileTypes && body.fileTypes.length > 0) {
      where.mimeType = { in: body.fileTypes };
    }

    if (body.minSize) {
      where.size = { gte: body.minSize };
    }

    // Get files to delete for stats
    const filesToDelete = await prisma.file.findMany({
      where,
      select: { id: true, size: true },
    });

    const deletedCount = filesToDelete.length;
    const freedSpace = filesToDelete.reduce(
      (sum, file) => sum + Number(file.size || 0n),
      0
    );

    // Delete files
    await prisma.file.deleteMany({ where });

    // TODO: Also delete actual file objects from storage (S3, etc.)
    // This would require integration with the storage service

    return NextResponse.json({
      success: true,
      deletedCount,
      freedSpace,
      freedSpaceGB: freedSpace / (1024 * 1024 * 1024),
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/storage/cleanup] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    );
  }
}
