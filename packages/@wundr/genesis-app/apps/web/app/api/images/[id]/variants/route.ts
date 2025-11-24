/**
 * Image Variants API Route
 *
 * Handles listing variants (different sizes/formats) of an image.
 *
 * Routes:
 * - GET /api/images/:id/variants - List image variants
 *
 * @module app/api/images/[id]/variants/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  imageIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { ImageVariant } from '@/lib/validations/upload';
import type { NextRequest } from 'next/server';

/**
 * Route context with image ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Generate standard variant sizes for an image
 *
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @returns Array of standard variants
 */
function generateStandardVariants(
  s3Key: string,
  s3Bucket: string,
  originalWidth: number,
  originalHeight: number,
): ImageVariant[] {
  const cdnDomain = process.env.CDN_DOMAIN;
  const region = process.env.AWS_REGION ?? 'us-east-1';

  const baseUrl = cdnDomain
    ? `https://${cdnDomain}`
    : `https://${s3Bucket}.s3.${region}.amazonaws.com`;

  const standardSizes = [
    { name: 'thumbnail', width: 150, height: 150 },
    { name: 'small', width: 320, height: 240 },
    { name: 'medium', width: 640, height: 480 },
    { name: 'large', width: 1280, height: 960 },
    { name: 'original', width: originalWidth, height: originalHeight },
  ];

  return standardSizes.map((size, index) => {
    const aspectRatio = originalWidth / originalHeight;
    const targetWidth = Math.min(size.width, originalWidth);
    const targetHeight = Math.round(targetWidth / aspectRatio);

    const variantKey = size.name === 'original'
      ? s3Key
      : s3Key.replace(/\.[^.]+$/, `-${size.name}.webp`);

    return {
      id: `var_${index}`,
      name: size.name,
      width: targetWidth,
      height: targetHeight,
      format: size.name === 'original' ? s3Key.split('.').pop() ?? 'jpeg' : 'webp',
      size: Math.floor((targetWidth * targetHeight * 3 * 0.1)), // Estimate
      url: `${baseUrl}/${variantKey}`,
    };
  });
}

/**
 * GET /api/images/:id/variants
 *
 * List all variants (different sizes/formats) of an image.
 * Returns both auto-generated variants and any custom processed variants.
 * Requires authentication and access to the image's workspace.
 *
 * @param _request - Next.js request object
 * @param context - Route context with image ID
 * @returns List of image variants
 *
 * @example
 * ```
 * GET /api/images/file_123/variants
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "variants": [
 *       {
 *         "id": "var_0",
 *         "name": "thumbnail",
 *         "width": 150,
 *         "height": 150,
 *         "format": "webp",
 *         "size": 6750,
 *         "url": "https://cdn.example.com/...-thumbnail.webp"
 *       }
 *     ],
 *     "original": {
 *       "width": 1920,
 *       "height": 1080,
 *       "format": "jpeg",
 *       "url": "https://cdn.example.com/..."
 *     }
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate image ID parameter
    const params = await context.params;
    const paramResult = imageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid image ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Fetch the file
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        s3Key: true,
        s3Bucket: true,
        mimeType: true,
        workspaceId: true,
        status: true,
        metadata: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('Image not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify file is an image
    const category = getFileCategory(file.mimeType);
    if (category !== 'image') {
      return NextResponse.json(
        createErrorResponse(
          'File is not an image',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createErrorResponse(
          'Image is not ready',
          UPLOAD_ERROR_CODES.NOT_FOUND,
          { status: file.status },
        ),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: file.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Extract metadata
    const metadata = file.metadata as {
      width?: number;
      height?: number;
      variants?: ImageVariant[];
    } | null;

    const originalWidth = metadata?.width ?? 1920;
    const originalHeight = metadata?.height ?? 1080;

    // Get custom variants from metadata
    const customVariants = metadata?.variants ?? [];

    // Generate standard variants
    const standardVariants = generateStandardVariants(
      file.s3Key,
      file.s3Bucket,
      originalWidth,
      originalHeight,
    );

    // Merge custom variants with standard variants (custom takes precedence)
    const customVariantNames = new Set(customVariants.map((v) => v.name));
    const mergedVariants = [
      ...customVariants,
      ...standardVariants.filter((v) => !customVariantNames.has(v.name)),
    ];

    // Extract original info
    const original = {
      width: originalWidth,
      height: originalHeight,
      format: file.s3Key.split('.').pop() ?? 'jpeg',
      url: generateFileUrl(file.s3Key, file.s3Bucket),
    };

    return NextResponse.json({
      data: {
        variants: mergedVariants,
        original,
      },
    });
  } catch (error) {
    console.error('[GET /api/images/:id/variants] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
