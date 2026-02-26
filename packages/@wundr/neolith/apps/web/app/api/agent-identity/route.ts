/**
 * Agent Identity API Routes
 *
 * Handles listing and creating agent identities for the current user's organization.
 *
 * Routes:
 * - GET /api/agent-identity - List all agent identities for the current user's organization
 * - POST /api/agent-identity - Create a new agent identity
 *
 * @module app/api/agent-identity/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { agentIdentityService } from '@/lib/services/agent-identity-service';
import {
  createAgentIdentitySchema,
  createErrorResponse,
  AGENT_IDENTITY_ERROR_CODES,
} from '@/lib/validations/agent-identity';

import type { CreateAgentIdentityInput } from '@/lib/validations/agent-identity';
import type { NextRequest } from 'next/server';

/**
 * GET /api/agent-identity
 *
 * List all agent identities for the authenticated user's organization.
 *
 * @param request - Next.js request object
 * @returns List of agent identities
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
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

    const identities = await agentIdentityService.listIdentities(
      session.user.id
    );

    return NextResponse.json({ data: identities });
  } catch (error) {
    console.error('[GET /api/agent-identity] Error:', error);
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
 * POST /api/agent-identity
 *
 * Create a new agent identity.
 *
 * @param request - Next.js request with agent identity data
 * @returns Created agent identity object
 *
 * @example
 * ```
 * POST /api/agent-identity
 * Content-Type: application/json
 *
 * {
 *   "userId": "user_123",
 *   "corporateEmail": "agent@company.com",
 *   "communicationChannels": ["EMAIL", "SMS"]
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const parseResult = createAgentIdentitySchema.safeParse(body);
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

    const input: CreateAgentIdentityInput = parseResult.data;

    const identity = await agentIdentityService.createIdentity(input);

    return NextResponse.json(
      { data: identity, message: 'Agent identity created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/agent-identity] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        AGENT_IDENTITY_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
