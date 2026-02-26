/**
 * Export Job Status API Endpoint
 *
 * Provides status information and results for async export jobs.
 *
 * GET /api/workspaces/[workspaceId]/export/jobs/[jobId]
 *   - Get job status and download URL if completed
 *
 * DELETE /api/workspaces/[workspaceId]/export/jobs/[jobId]
 *   - Cancel a pending/processing job or delete completed job
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET - Get export job status
 *
 * Returns current status of export job and download URL if completed.
 *
 * @returns Export job details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; jobId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId, jobId } = await params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch job details
    const job = await prisma.exportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Export job not found' },
        { status: 404 }
      );
    }

    // Verify job belongs to this workspace
    if (job.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Export job not found in this workspace' },
        { status: 404 }
      );
    }

    // Calculate duration if job is completed
    let duration: number | null = null;
    if (job.startedAt && job.completedAt) {
      duration = Math.floor(
        (job.completedAt.getTime() - job.startedAt.getTime()) / 1000
      );
    }

    // Return job status
    return NextResponse.json({
      id: job.id,
      workspaceId: job.workspaceId,
      type: job.type,
      format: job.format,
      status: job.status,
      progress: job.progress,
      recordCount: job.recordCount,
      fileSize: job.fileSize ? Number(job.fileSize) : null,
      fileUrl: job.fileUrl,
      error: job.error,
      dateRange: {
        from: job.startDate?.toISOString(),
        to: job.endDate?.toISOString(),
      },
      requestedBy: job.requestedBy,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      duration, // in seconds
    });
  } catch (error) {
    console.error('Export job status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export job status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel or delete export job
 *
 * Cancels a pending/processing job or deletes a completed/failed job.
 *
 * @returns Success confirmation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; jobId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId, jobId } = await params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Only ADMIN and OWNER can delete export jobs
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can delete export jobs' },
        { status: 403 }
      );
    }

    // Fetch job details
    const job = await prisma.exportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Export job not found' },
        { status: 404 }
      );
    }

    // Verify job belongs to this workspace
    if (job.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Export job not found in this workspace' },
        { status: 404 }
      );
    }

    // Delete the job
    await prisma.exportJob.delete({
      where: { id: jobId },
    });

    // If job has a file URL (S3 key), delete the exported file from S3
    if (job.fileUrl) {
      const s3Module = await import('@aws-sdk/client-s3').catch(() => null);
      if (s3Module) {
        const { S3Client, DeleteObjectCommand } = s3Module;
        const client = new S3Client({
          region: process.env.MY_AWS_REGION ?? 'us-east-1',
          credentials: {
            accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY ?? '',
          },
        });
        await client
          .send(
            new DeleteObjectCommand({
              Bucket: process.env.MY_AWS_S3_BUCKET ?? '',
              Key: job.fileUrl,
            })
          )
          .catch((err: Error) => {
            console.error('S3 export file delete failed:', err.message);
          });
      }
    }

    return NextResponse.json({
      message: 'Export job deleted successfully',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Export job deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete export job' },
      { status: 500 }
    );
  }
}
