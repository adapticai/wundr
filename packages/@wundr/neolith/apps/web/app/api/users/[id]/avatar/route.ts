/**
 * User Avatar API Endpoint
 *
 * Handles manual avatar uploads and changes for users.
 * Supports file uploads, URLs, and base64 data.
 *
 * Routes:
 * - GET /api/users/[id]/avatar - Get avatar URL with optional size
 * - POST /api/users/[id]/avatar - Upload new avatar
 * - DELETE /api/users/[id]/avatar - Delete avatar (reverts to fallback)
 *
 * @module app/api/users/[id]/avatar/route
 */

import { avatarService, type AvatarSize } from '@neolith/core/services';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET /api/users/[id]/avatar
 *
 * Gets the avatar URL for a user with optional size parameter
 *
 * Query params:
 * - size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE' (default: 'LARGE')
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const size = (searchParams.get('size') as AvatarSize) || 'LARGE';

    // Validate size
    const validSizes = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Must be one of: ${validSizes.join(', ')}` },
        { status: 400 }
      );
    }

    const url = await avatarService.getAvatarUrl(id, size);

    if (!url) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    return NextResponse.json({ url, size });
  } catch (error) {
    console.error('Avatar GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatar' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/[id]/avatar
 *
 * Uploads a new avatar for a user. Supports:
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
 * Returns all avatar variants with URLs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check authorization - users can only update their own avatar
    // (or admins can update any avatar - to be implemented)
    if (session.user.id !== id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - can only update your own avatar' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    let source: Buffer | string;
    let filename: string | undefined;

    // Handle multipart/form-data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided in form data' },
          { status: 400 }
        );
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      source = Buffer.from(arrayBuffer);
      filename = file.name;
    } else if (contentType.includes('application/json')) {
      // Handle application/json (base64 or URL)
      const body = await request.json();

      if (!body.source) {
        return NextResponse.json(
          { error: 'Missing "source" field in request body' },
          { status: 400 }
        );
      }

      source = body.source;
      filename = body.filename;
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid content type. Use multipart/form-data or application/json',
        },
        { status: 400 }
      );
    }

    // Upload avatar
    const result = await avatarService.uploadAvatar({
      userId: id,
      source,
      filename,
    });

    return NextResponse.json({
      success: true,
      avatar: result,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);

    // Handle specific avatar service errors
    if (error && typeof error === 'object' && 'name' in error) {
      const err = error as {
        name: string;
        message: string;
        statusCode?: number;
      };

      if (err.name === 'InvalidAvatarError') {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }

      if (err.name === 'AvatarDownloadError') {
        return NextResponse.json(
          { error: 'Failed to download avatar from provided URL' },
          { status: 502 }
        );
      }

      if (err.name === 'AvatarProcessingError') {
        return NextResponse.json(
          { error: 'Failed to process avatar image' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]/avatar
 *
 * Deletes a user's avatar and generates a fallback avatar with initials
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check authorization - users can only delete their own avatar
    if (session.user.id !== id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - can only delete your own avatar' },
        { status: 403 }
      );
    }

    // Delete current avatar
    await avatarService.deleteAvatar(id);

    // Generate fallback avatar
    const fallback = await avatarService.generateFallbackAvatar({
      name: session.user.name || session.user.email || 'User',
      userId: id,
    });

    return NextResponse.json({
      success: true,
      message: 'Avatar deleted and fallback generated',
      avatar: fallback,
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
