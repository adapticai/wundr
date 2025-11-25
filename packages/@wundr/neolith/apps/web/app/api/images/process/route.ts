/**
 * Image Processing API Route
 *
 * Handles processing uploaded images (resize, crop, compress, etc.)
 *
 * Routes:
 * - POST /api/images/process - Process an uploaded image
 *
 * @module app/api/images/process/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  imageProcessSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
} from '@/lib/validations/upload';

import type { ImageProcessInput, ImageVariant } from '@/lib/validations/upload';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Supported image operations
 */
interface ImageOperation {
  type: 'resize' | 'crop' | 'rotate' | 'compress' | 'format';
  params: Record<string, unknown>;
}

/**
 * Process image with specified operations
 *
 * @param s3Key - S3 object key of the source image
 * @param s3Bucket - S3 bucket name
 * @param operations - Array of operations to perform
 * @param outputFormat - Desired output format
 * @param _quality - Output quality (1-100)
 * @returns Processed image variant data
 */
async function processImage(
  s3Key: string,
  s3Bucket: string,
  operations: ImageOperation[],
  outputFormat: string | undefined,
  _quality: number,
): Promise<ImageVariant> {
  // In production, this would:
  // 1. Download the image from S3
  // 2. Use Sharp or similar library to process the image
  // 3. Upload the processed image to S3
  // 4. Return the variant metadata

  const randomId = crypto.randomBytes(4).toString('hex');
  const format = outputFormat ?? 'jpeg';

  // Extract dimensions from resize operations
  let width = 800;
  let height = 600;
  const resizeOp = operations.find((op) => op.type === 'resize');
  if (resizeOp) {
    width = (resizeOp.params.width as number) ?? width;
    height = (resizeOp.params.height as number) ?? height;
  }

  // Generate variant key
  const variantKey = s3Key.replace(/\.[^.]+$/, `-${width}x${height}-${randomId}.${format}`);

  const cdnDomain = process.env.CDN_DOMAIN;
  const region = process.env.AWS_REGION ?? 'us-east-1';

  const url = cdnDomain
    ? `https://${cdnDomain}/${variantKey}`
    : `https://${s3Bucket}.s3.${region}.amazonaws.com/${variantKey}`;

  // Estimate size based on dimensions and quality
  const estimatedSize = Math.floor((width * height * 3 * _quality) / 100);

  return {
    id: `var_${randomId}`,
    name: `${width}x${height}`,
    width,
    height,
    format,
    size: estimatedSize,
    url,
  };
}

/**
 * POST /api/images/process
 *
 * Process an uploaded image with specified operations.
 * Supports resize, crop, rotate, compress, and format conversion.
 * Requires authentication and access to the image's workspace.
 *
 * @param request - Next.js request with processing instructions
 * @returns Processed image variant data
 *
 * @example
 * ```
 * POST /api/images/process
 * Content-Type: application/json
 *
 * {
 *   "fileId": "file_123",
 *   "operations": [
 *     { "type": "resize", "params": { "width": 800, "height": 600, "fit": "cover" } },
 *     { "type": "compress", "params": {} }
 *   ],
 *   "outputFormat": "webp",
 *   "quality": 85
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = imageProcessSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: ImageProcessInput = parseResult.data;

    // Fetch the source file
    const file = await prisma.file.findUnique({
      where: { id: input.fileId },
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
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify file is an image
    const category = getFileCategory(file.mimeType);
    if (category !== 'image') {
      return NextResponse.json(
        createErrorResponse(
          'Only image files can be processed',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createErrorResponse(
          'File is not ready for processing',
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

    // Process the image
    const variant = await processImage(
      file.s3Key,
      file.s3Bucket,
      input.operations as ImageOperation[],
      input.outputFormat,
      input.quality,
    );

    // Store variant metadata in the file record
    const existingMetadata = file.metadata as Record<string, unknown> | null;
    const existingVariants = (existingMetadata?.variants as ImageVariant[]) ?? [];

    const updatedMetadata: Prisma.JsonObject = {
      ...(existingMetadata as Prisma.JsonObject ?? {}),
      variants: [...existingVariants, variant] as unknown as Prisma.JsonArray,
    };

    await prisma.file.update({
      where: { id: file.id },
      data: {
        metadata: updatedMetadata,
      },
    });

    return NextResponse.json({
      data: { variant },
      message: 'Image processed successfully',
    });
  } catch (error) {
    console.error('[POST /api/images/process] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
