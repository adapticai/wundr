/**
 * VP Work Artifacts Storage API Route
 *
 * Handles storing work artifacts to S3 for VP task execution.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/artifacts - Upload artifact to S3
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/artifacts/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadArtifactSchema,
  createErrorResponse,
  WORK_SESSION_ERROR_CODES,
} from '@/lib/validations/work-session';

import type { NextRequest } from 'next/server';

/**
 * Route context with path parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
  }>;
}

/**
 * Upload content to S3
 *
 * @param content - Base64 encoded content or plain text
 * @param s3Key - S3 object key
 * @param contentType - MIME type
 * @returns S3 URL
 */
async function uploadToS3(
  content: string,
  s3Key: string,
  contentType: string,
): Promise<string> {
  const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  // Determine if content is base64 encoded
  let buffer: Buffer;
  if (contentType.startsWith('text/') || contentType === 'application/json') {
    // Plain text content
    buffer = Buffer.from(content, 'utf-8');
  } else {
    // Binary content - decode from base64
    buffer = Buffer.from(content, 'base64');
  }

  // Upload to S3
  await client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  // Return S3 URL
  return `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/artifacts
 *
 * Upload a work artifact to S3.
 * Stores artifacts under path: workspaces/{workspaceId}/vps/{vpId}/artifacts/{taskId}/{filename}
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and VP IDs
 * @returns S3 URL of uploaded artifact
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (or VP daemon)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORK_SESSION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Parse request body
    const body = await request.json();
    const validationResult = uploadArtifactSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation error', WORK_SESSION_ERROR_CODES.VALIDATION_ERROR, {
          errors: validationResult.error.errors,
        }),
        { status: 400 },
      );
    }

    const { filename, contentType, content, taskId, metadata } = validationResult.data;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORK_SESSION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Verify VP exists and belongs to workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        workspaceId,
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', WORK_SESSION_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task exists and belongs to VP
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        vpId,
        workspaceId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', WORK_SESSION_ERROR_CODES.TASK_NOT_FOUND),
        { status: 404 },
      );
    }

    // Generate S3 key
    const timestamp = new Date().getTime();
    const s3Key = `workspaces/${workspaceId}/vps/${vpId}/artifacts/${taskId}/${timestamp}-${filename}`;

    // Upload to S3
    let s3Url: string;
    try {
      s3Url = await uploadToS3(content, s3Key, contentType);
    } catch (error) {
      console.error('S3 upload error:', error);
      return NextResponse.json(
        createErrorResponse(
          'Failed to upload artifact to S3',
          WORK_SESSION_ERROR_CODES.S3_UPLOAD_FAILED,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ),
        { status: 500 },
      );
    }

    // Store artifact reference in database
    const file = await prisma.file.create({
      data: {
        filename,
        originalName: filename,
        mimeType: contentType,
        size: BigInt(Buffer.byteLength(content, 'utf-8')),
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET ?? 'genesis-uploads',
        status: 'READY',
        workspaceId,
        uploadedById: session.user.id,
        metadata: {
          type: 'vp_artifact',
          vpId,
          taskId,
          taskTitle: task.title,
          uploadedAt: new Date().toISOString(),
          ...(metadata && metadata),
        },
      },
    });

    return NextResponse.json({
      message: 'Artifact uploaded successfully',
      data: {
        fileId: file.id,
        s3Url,
        s3Key,
        filename,
        contentType,
        size: Number(file.size),
        uploadedAt: file.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error uploading artifact:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORK_SESSION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
