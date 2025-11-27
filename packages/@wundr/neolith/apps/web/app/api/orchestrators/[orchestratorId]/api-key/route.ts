/**
 * OrchestratorAPI Key Management Routes
 *
 * Handles API key generation and revocation for Orchestrator entities.
 * API keys are used for daemon authentication and programmatic access.
 *
 * Routes:
 * - POST /api/orchestrators/:id/api-key - Generate new API key
 * - DELETE /api/orchestrators/:id/api-key - Revoke API key
 *
 * @module app/api/orchestrators/[id]/api-key/route
 */



import { randomBytes, createHash } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateApiKeySchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { GenerateApiKeyInput } from '@/lib/validations/orchestrator';
import type { Prisma } from '@prisma/client';
import type { NextRequest} from 'next/server';

/**
 * Route context with OrchestratorID parameter
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
 * POST /api/orchestrators/:id/api-key
 *
 * Generate a new API key for a Orchestrator.
 * The full API key is returned only once - we store a hash.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request with key generation options
 * @param context - Route context containing OrchestratorID
 * @returns Generated API key (shown only once)
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/api-key
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
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
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = generateApiKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
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

    // Fetch Orchestrator and verify access
    const orchestrator = await prisma.vP.findUnique({
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      (m) => m.organizationId === orchestrator.organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied to this VP', ORCHESTRATOR_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to manage API keys',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
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

    // Store the API key metadata in Orchestrator capabilities
    // Note: The actual key is hashed for security
    const currentCapabilities =
      (orchestrator.capabilities as Record<string, unknown>) ?? {};
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

    // Update Orchestrator with new API key
    await prisma.vP.update({
      where: { id: params.id },
      data: { capabilities: updatedCapabilities },
    });

    // TODO: Log the action to audit log service in production

    return NextResponse.json(
      {
        data: {
          apiKey, // Return the full key only this once
          name: input.name,
          scopes: input.scopes,
          expiresAt,
          vpId: params.id,
          vpName: orchestrator.user.name,
        },
        message:
          'API key generated successfully. Store this key securely - it will not be shown again.',
        warning:
          'This is the only time the full API key will be displayed. Please save it securely.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/orchestrators/:id/api-key] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/orchestrators/:id/api-key
 *
 * Revoke the API key for a Orchestrator.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing OrchestratorID
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get user's organization memberships
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    // Fetch Orchestrator and verify access
    const orchestrator = await prisma.vP.findUnique({
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      (m) => m.organizationId === orchestrator.organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied to this VP', ORCHESTRATOR_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to manage API keys',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if Orchestrator has an API key
    const currentCapabilities =
      (orchestrator.capabilities as Record<string, unknown>) ?? {};
    if (!currentCapabilities.apiKey) {
      return NextResponse.json(
        createErrorResponse('VP does not have an API key', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Remove API key from capabilities
    const { apiKey: _, ...updatedCapabilities } = currentCapabilities;

    // Update Orchestrator to remove API key
    await prisma.vP.update({
      where: { id: params.id },
      data: { capabilities: updatedCapabilities as Prisma.InputJsonValue },
    });

    // TODO: Log the action to audit log service in production

    return NextResponse.json({
      message: 'API key revoked successfully',
      vpId: params.id,
      vpName: orchestrator.user.name,
    });
  } catch (error) {
    console.error('[DELETE /api/orchestrators/:id/api-key] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
