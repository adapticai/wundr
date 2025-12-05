/**
 * Workspace Icon API Endpoint
 *
 * Handles workspace icon (brand logo) uploads.
 * Supports file uploads, URLs, and base64 data.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceSlug]/icon - Get icon URL
 * - POST /api/workspaces/[workspaceSlug]/icon - Upload new icon
 * - DELETE /api/workspaces/[workspaceSlug]/icon - Delete icon
 *
 * @module app/api/workspaces/[workspaceSlug]/icon/route
 */

import { getStorageService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace admin access
 * Supports both workspace ID and slug for lookup
 */
async function checkWorkspaceAdminAccess(
  workspaceIdOrSlug: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
    },
    include: {
      organization: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  // Check if user is org admin/owner or workspace admin
  const isOrgAdmin = ['OWNER', 'ADMIN'].includes(orgMembership.role);
  const isWorkspaceAdmin = workspaceMembership?.role === 'ADMIN';

  if (!isOrgAdmin && !isWorkspaceAdmin) {
    return null;
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * GET /api/workspaces/[workspaceSlug]/icon
 *
 * Gets the icon URL for a workspace
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    // Support both workspace ID and slug for lookup
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { avatarUrl: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      icon: workspace.avatarUrl,
      name: workspace.name,
    });
  } catch (error) {
    console.error('Workspace icon GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace icon' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/[workspaceSlug]/icon
 *
 * Uploads a new icon for a workspace. Supports:
 * - Multipart file upload
 * - JSON with base64 data
 * - JSON with URL to download from
 *
 * Request body (multipart/form-data):
 * - file: Image file
 *
 * Request body (application/json):
 * - source: Base64 data URL or external URL
 *
 * Returns the icon URL
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    // Check admin access (supports both ID and slug)
    const access = await checkWorkspaceAdminAccess(
      workspaceSlug,
      session.user.id,
    );
    if (!access) {
      return NextResponse.json(
        { error: 'Forbidden - workspace admin access required' },
        { status: 403 },
      );
    }

    // Use the actual workspace ID from the access check
    const workspaceId = access.workspace.id;

    const contentType = request.headers.get('content-type') || '';

    let fileBuffer: Buffer;
    let filename: string = 'icon.png';
    let mimeType: string = 'image/png';

    // Handle multipart/form-data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided in form data' },
          { status: 400 },
        );
      }

      // Validate file size (5MB max for icons)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size must be less than 5MB' },
          { status: 400 },
        );
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
          { error: 'Invalid file type. Use JPEG, PNG, WebP, or SVG' },
          { status: 400 },
        );
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      filename = file.name;
      mimeType = file.type;
    } else if (contentType.includes('application/json')) {
      // Handle application/json (base64 or URL)
      const body = await request.json();

      if (!body.source) {
        return NextResponse.json(
          { error: 'Missing "source" field in request body' },
          { status: 400 },
        );
      }

      // Check if it's a base64 data URL
      if (body.source.startsWith('data:')) {
        const matches = body.source.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          return NextResponse.json(
            { error: 'Invalid base64 data URL format' },
            { status: 400 },
          );
        }

        mimeType = matches[1];
        fileBuffer = Buffer.from(matches[2], 'base64');

        // Validate file type
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/svg+xml',
        ];
        if (!allowedTypes.includes(mimeType)) {
          return NextResponse.json(
            { error: 'Invalid file type. Use JPEG, PNG, WebP, or SVG' },
            { status: 400 },
          );
        }

        // Validate size (5MB max)
        if (fileBuffer.length > 5 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'File size must be less than 5MB' },
            { status: 400 },
          );
        }
      } else if (body.source.startsWith('http')) {
        // It's a URL - download the image
        try {
          const response = await fetch(body.source);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
          mimeType = response.headers.get('content-type') || 'image/png';

          // Validate size (5MB max)
          if (fileBuffer.length > 5 * 1024 * 1024) {
            return NextResponse.json(
              { error: 'Downloaded file size must be less than 5MB' },
              { status: 400 },
            );
          }
        } catch (downloadError) {
          console.error('Failed to download icon from URL:', downloadError);
          return NextResponse.json(
            { error: 'Failed to download image from provided URL' },
            { status: 502 },
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Source must be a base64 data URL or HTTP URL' },
          { status: 400 },
        );
      }

      filename = body.filename || 'icon.png';
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid content type. Use multipart/form-data or application/json',
        },
        { status: 400 },
      );
    }

    // Upload to S3
    const storageService = getStorageService();
    const key = storageService.generateKey({
      workspaceId,
      filename: `icon-${Date.now()}.${mimeType.split('/')[1] || 'png'}`,
      prefix: 'workspaces',
    });

    const result = await storageService.uploadBuffer(fileBuffer, {
      key,
      contentType: mimeType,
      filename,
      metadata: {
        workspaceId,
        type: 'workspace-icon',
        uploadedBy: session.user.id,
      },
    });

    // Update workspace with new icon URL
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { avatarUrl: result.url },
      select: { id: true, name: true, avatarUrl: true },
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        icon: updatedWorkspace.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Workspace icon upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload workspace icon' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceSlug]/icon
 *
 * Deletes a workspace's icon
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await params;

    // Check admin access (supports both ID and slug)
    const access = await checkWorkspaceAdminAccess(
      workspaceSlug,
      session.user.id,
    );
    if (!access) {
      return NextResponse.json(
        { error: 'Forbidden - workspace admin access required' },
        { status: 403 },
      );
    }

    // Use the actual workspace ID from the access check
    const workspaceId = access.workspace.id;

    // Get current icon URL from the workspace we already fetched
    if (access.workspace.avatarUrl) {
      // Try to delete from S3 if it's an S3 URL
      if (access.workspace.avatarUrl.includes('workspaces/')) {
        try {
          const storageService = getStorageService();
          // Extract key from URL
          const url = new URL(access.workspace.avatarUrl);
          const key = url.pathname.replace(/^\//, '');
          await storageService.deleteFile(key);
        } catch (deleteError) {
          // Log but don't fail the request - the S3 file might not exist
          console.warn('Failed to delete workspace icon from S3:', deleteError);
        }
      }
    }

    // Clear icon from workspace
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { avatarUrl: null },
      select: { id: true, name: true, avatarUrl: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Workspace icon deleted',
      workspace: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        icon: updatedWorkspace.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Workspace icon delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace icon' },
      { status: 500 },
    );
  }
}
