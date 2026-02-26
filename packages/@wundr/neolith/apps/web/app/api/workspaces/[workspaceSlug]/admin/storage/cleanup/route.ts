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
      select: { id: true, size: true, s3Key: true, s3Bucket: true },
    });

    const deletedCount = filesToDelete.length;
    const freedSpace = filesToDelete.reduce(
      (sum, file) => sum + Number(file.size || 0n),
      0
    );

    // Delete actual file objects from S3 before removing DB records
    if (filesToDelete.length > 0) {
      // Group files by bucket so we can batch-delete per bucket
      const byBucket = new Map<string, string[]>();
      for (const file of filesToDelete) {
        if (!file.s3Key || !file.s3Bucket) continue;
        const keys = byBucket.get(file.s3Bucket) ?? [];
        keys.push(file.s3Key);
        byBucket.set(file.s3Bucket, keys);
      }

      try {
        const s3Module = await import('@aws-sdk/client-s3').catch(() => null);
        if (s3Module) {
          const { S3Client, DeleteObjectsCommand } = s3Module;
          const client = new S3Client({
            region: process.env.MY_AWS_REGION ?? 'us-east-1',
            credentials: {
              accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID ?? '',
              secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY ?? '',
            },
          });

          for (const [bucket, keys] of byBucket) {
            // S3 DeleteObjects supports up to 1000 keys per request
            for (let i = 0; i < keys.length; i += 1000) {
              const batch = keys.slice(i, i + 1000);
              const result = await client.send(
                new DeleteObjectsCommand({
                  Bucket: bucket,
                  Delete: {
                    Objects: batch.map(Key => ({ Key })),
                    Quiet: false,
                  },
                })
              );
              if (result.Errors && result.Errors.length > 0) {
                console.error(
                  '[POST /api/workspaces/:workspaceSlug/storage/cleanup] S3 deletion errors:',
                  result.Errors
                );
              }
            }
          }
        } else {
          console.warn(
            '[POST /api/workspaces/:workspaceSlug/storage/cleanup] @aws-sdk/client-s3 not available; skipping S3 deletion'
          );
        }
      } catch (s3Error) {
        // Log but do not abort — proceed to remove DB records so they are not orphaned
        console.error(
          '[POST /api/workspaces/:workspaceSlug/storage/cleanup] S3 deletion failed:',
          s3Error
        );
      }
    }

    // Delete DB records after S3 objects have been removed
    await prisma.file.deleteMany({ where });

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
