/**
 * Agent Identity Provision Phone API Route
 *
 * Handles provisioning a Twilio phone number for an orchestrator.
 *
 * Routes:
 * - POST /api/agent-identity/:identityId/provision-phone - Provision Twilio phone number
 *
 * @module app/api/agent-identity/[identityId]/provision-phone/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { agentIdentityService } from '@/lib/services/agent-identity-service';
import {
  provisionPhoneNumberSchema,
  createErrorResponse,
  AGENT_IDENTITY_ERROR_CODES,
} from '@/lib/validations/agent-identity';

import type { ProvisionPhoneNumberInput } from '@/lib/validations/agent-identity';
import type { NextRequest } from 'next/server';

/**
 * Route context with identity ID parameter
 */
interface RouteContext {
  params: Promise<{ identityId: string }>;
}

/**
 * POST /api/agent-identity/:identityId/provision-phone
 *
 * Provision a Twilio phone number for an orchestrator.
 * Acquires a phone number with the requested capabilities (voice, SMS, WhatsApp).
 *
 * @param request - Next.js request with provisioning data
 * @param context - Route context containing identity ID
 * @returns Provisioned phone number details
 *
 * @example
 * ```
 * POST /api/agent-identity/id_123/provision-phone
 * Content-Type: application/json
 *
 * {
 *   "orchestratorId": "orch_456",
 *   "countryCode": "US",
 *   "areaCode": "415",
 *   "capabilities": ["voice", "sms"]
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
    const parseResult = provisionPhoneNumberSchema.safeParse(body);
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

    const input: ProvisionPhoneNumberInput = parseResult.data;

    const result = await agentIdentityService.provisionPhoneNumber(
      input.orchestratorId,
      input.countryCode
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
      { data: result, message: 'Phone number provisioned successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/agent-identity/:identityId/provision-phone] Error:',
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
