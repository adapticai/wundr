/**
 * Agent Identity Single Resource API Routes
 *
 * Handles reading, updating, and deleting a single agent identity.
 *
 * Routes:
 * - GET /api/agent-identity/:identityId - Get a single agent identity
 * - PATCH /api/agent-identity/:identityId - Update an agent identity
 * - DELETE /api/agent-identity/:identityId - Delete an agent identity
 *
 * @module app/api/agent-identity/[identityId]/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { agentIdentityService } from '@/lib/services/agent-identity-service';
import {
  updateAgentIdentitySchema,
  createErrorResponse,
  AGENT_IDENTITY_ERROR_CODES,
} from '@/lib/validations/agent-identity';

import type { UpdateAgentIdentityInput } from '@/lib/validations/agent-identity';
import type { NextRequest } from 'next/server';

/**
 * Route context with identity ID parameter
 */
interface RouteContext {
  params: Promise<{ identityId: string }>;
}

/**
 * GET /api/agent-identity/:identityId
 *
 * Get a single agent identity by ID.
 *
 * @param _request - Next.js request object
 * @param context - Route context containing identity ID
 * @returns Agent identity object
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          AGENT_IDENTITY_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { identityId } = await context.params;

    const identity = await (agentIdentityService as any).getIdentity(
      identityId
    );

    if (!identity) {
      return NextResponse.json(
        createErrorResponse(
          'Agent identity not found',
          AGENT_IDENTITY_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: identity });
  } catch (error) {
    console.error('[GET /api/agent-identity/:identityId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        AGENT_IDENTITY_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agent-identity/:identityId
 *
 * Update an agent identity.
 *
 * @param request - Next.js request with updated identity data
 * @param context - Route context containing identity ID
 * @returns Updated agent identity object
 *
 * @example
 * ```
 * PATCH /api/agent-identity/id_123
 * Content-Type: application/json
 *
 * {
 *   "corporateEmail": "newemail@company.com",
 *   "voiceEnabled": true
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          AGENT_IDENTITY_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { identityId } = await context.params;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          AGENT_IDENTITY_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateAgentIdentitySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          AGENT_IDENTITY_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateAgentIdentityInput = parseResult.data;

    const identity = await agentIdentityService.updateIdentity(
      identityId,
      input
    );

    if (!identity) {
      return NextResponse.json(
        createErrorResponse(
          'Agent identity not found',
          AGENT_IDENTITY_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: identity,
      message: 'Agent identity updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/agent-identity/:identityId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        AGENT_IDENTITY_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-identity/:identityId
 *
 * Delete an agent identity.
 *
 * @param _request - Next.js request object
 * @param context - Route context containing identity ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          AGENT_IDENTITY_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { identityId } = await context.params;

    await agentIdentityService.deleteIdentity(identityId);

    return NextResponse.json({
      message: 'Agent identity deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/agent-identity/:identityId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        AGENT_IDENTITY_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
