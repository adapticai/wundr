/**
 * VP API Key Management Routes
 *
 * Handles API key generation and revocation for Virtual Person (VP) entities.
 * API keys are used for daemon authentication and programmatic access.
 *
 * Routes:
 * - POST /api/vps/:id/api-key - Generate new API key
 * - DELETE /api/vps/:id/api-key - Revoke API key
 *
 * @module app/api/vps/[id]/api-key/route
 */



import { randomBytes, createHash } from 'crypto';

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateApiKeySchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { GenerateApiKeyInput } from '@/lib/validations/vp';
import type { Prisma } from '@prisma/client';
import type { NextRequest} from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Generate a secure API key
 * Format: vp_[random_32_bytes_hex]
 */
function generateApiKey(): string {
  const randomPart = randomBytes(32).toString('hex');
  return `vp_${randomPart}`;
}

/**
 * Hash an API key for storage
 * We store the hash, not the actual key
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * POST /api/vps/:id/api-key
 *
 * Generate a new API key for a VP.
 * The full API key is returned only once - we store a hash.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with key generation options
 * @param context - Route context containing VP ID
 * @returns Generated API key (shown only once)
 *
 * @example
 * ```
 * POST /api/vps/vp_123/api-key
 * Content-Type: application/json
 *
 * {
 *   "name": "Production API Key",
 *   "expiresInDays": 90,
 *   "scopes": ["read", "write"]
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body (optional)
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = generateApiKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: GenerateApiKeyInput = parseResult.data;

    // Get user's organization memberships
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    // Fetch VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      (m) => m.organizationId === vp.organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied to this VP', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to manage API keys',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Generate the API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    // Calculate expiration date if specified
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Store the API key metadata in VP capabilities
    // Note: The actual key is hashed for security
    const currentCapabilities =
      (vp.capabilities as Record<string, unknown>) ?? {};
    const updatedCapabilities = {
      ...currentCapabilities,
      apiKey: {
        hash: apiKeyHash,
        name: input.name,
        scopes: input.scopes,
        createdAt: new Date().toISOString(),
        createdBy: session.user.id,
        ...(expiresAt && { expiresAt: expiresAt.toISOString() }),
      },
    };

    // Update VP with new API key
    await prisma.vP.update({
      where: { id: params.id },
      data: { capabilities: updatedCapabilities },
    });

    // Log the action
    console.log(
      `[VP API Key] Generated new API key for VP ${params.id} by user ${session.user.id}`,
    );

    return NextResponse.json(
      {
        data: {
          apiKey, // Return the full key only this once
          name: input.name,
          scopes: input.scopes,
          expiresAt,
          vpId: params.id,
          vpName: vp.user.name,
        },
        message:
          'API key generated successfully. Store this key securely - it will not be shown again.',
        warning:
          'This is the only time the full API key will be displayed. Please save it securely.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/vps/:id/api-key] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/vps/:id/api-key
 *
 * Revoke the API key for a VP.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing VP ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get user's organization memberships
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    // Fetch VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        capabilities: true,
        user: {
          select: { name: true },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      (m) => m.organizationId === vp.organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied to this VP', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to manage API keys',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if VP has an API key
    const currentCapabilities =
      (vp.capabilities as Record<string, unknown>) ?? {};
    if (!currentCapabilities.apiKey) {
      return NextResponse.json(
        createErrorResponse('VP does not have an API key', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Remove API key from capabilities
    const { apiKey: _, ...updatedCapabilities } = currentCapabilities;

    // Update VP to remove API key
    await prisma.vP.update({
      where: { id: params.id },
      data: { capabilities: updatedCapabilities as Prisma.InputJsonValue },
    });

    // Log the action
    console.log(
      `[VP API Key] Revoked API key for VP ${params.id} by user ${session.user.id}`,
    );

    return NextResponse.json({
      message: 'API key revoked successfully',
      vpId: params.id,
      vpName: vp.user.name,
    });
  } catch (error) {
    console.error('[DELETE /api/vps/:id/api-key] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
