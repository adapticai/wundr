/**
 * Agent Identity Provision Email API Route
 *
 * Handles provisioning a corporate email address for an orchestrator.
 *
 * Routes:
 * - POST /api/agent-identity/:identityId/provision-email - Provision corporate email
 *
 * @module app/api/agent-identity/[identityId]/provision-email/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { agentIdentityService } from '@/lib/services/agent-identity-service';
import {
  provisionEmailSchema,
  createErrorResponse,
  AGENT_IDENTITY_ERROR_CODES,
} from '@/lib/validations/agent-identity';

import type { ProvisionEmailInput } from '@/lib/validations/agent-identity';
import type { NextRequest } from 'next/server';

/**
 * Route context with identity ID parameter
 */
interface RouteContext {
  params: Promise<{ identityId: string }>;
}

/**
 * POST /api/agent-identity/:identityId/provision-email
 *
 * Provision a corporate email address for an orchestrator.
 * Creates a managed email account within the specified domain.
 *
 * @param request - Next.js request with provisioning data
 * @param context - Route context containing identity ID
 * @returns Provisioned email details
 *
 * @example
 * ```
 * POST /api/agent-identity/id_123/provision-email
 * Content-Type: application/json
 *
 * {
 *   "orchestratorId": "orch_456",
 *   "emailDomain": "company.com",
 *   "preferredUsername": "sales-agent"
 * }
 * ```
 */
export async function POST(
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
    const parseResult = provisionEmailSchema.safeParse(body);
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

    const input: ProvisionEmailInput = parseResult.data;

    const result = await agentIdentityService.provisionEmail(
      identityId,
      input
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Agent identity not found',
          AGENT_IDENTITY_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: result, message: 'Corporate email provisioned successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/agent-identity/:identityId/provision-email] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        AGENT_IDENTITY_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
