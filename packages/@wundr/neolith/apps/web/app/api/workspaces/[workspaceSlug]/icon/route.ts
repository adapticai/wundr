/**
 * Workspace Icon Upload API
 *
 * Handles workspace icon/avatar upload with S3 and local fallback.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/icon - Upload workspace icon
 *
 * @module app/api/workspaces/[workspaceSlug]/icon/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

async function saveLocally(
  workspaceId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const uploadsDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'workspaces',
    workspaceId,
    'icons'
  );
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/workspaces/${workspaceId}/icons/${filename}`;
}

/**
 * POST /api/workspaces/:workspaceSlug/icon
 * Upload or update the workspace icon/avatar.
 */
export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Find workspace and verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        slug: true,
        workspaceMembers: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const member = workspace.workspaceMembers[0];
    if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, SVG' },
        { status: 400 }
      );
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'png';
    const filename = `workspace-icon-${timestamp}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let iconUrl: string;

    const hasS3 =
      process.env.MY_AWS_ACCESS_KEY_ID &&
      process.env.MY_AWS_SECRET_ACCESS_KEY &&
      process.env.STORAGE_BUCKET;

    if (hasS3) {
      const s3Module = await import('@aws-sdk/client-s3').catch(() => null);
      if (s3Module) {
        const { S3Client, PutObjectCommand } = s3Module;
        const client = new S3Client({
          region: process.env.MY_AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY!,
          },
        });

        const s3Key = `workspaces/${workspace.id}/icons/${filename}`;
        const bucket = process.env.STORAGE_BUCKET!;

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: file.type,
          })
        );

        iconUrl = `https://${bucket}.s3.amazonaws.com/${s3Key}`;
      } else {
        iconUrl = await saveLocally(workspace.id, filename, buffer);
      }
    } else {
      iconUrl = await saveLocally(workspace.id, filename, buffer);
    }

    // Update workspace avatarUrl
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { avatarUrl: iconUrl },
      select: {
        id: true,
        slug: true,
        name: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      workspace: {
        ...updatedWorkspace,
        icon: updatedWorkspace.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/icon] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
