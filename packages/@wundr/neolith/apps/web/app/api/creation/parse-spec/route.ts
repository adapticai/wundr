/**
 * Spec Parser API
 * Validates and normalizes generated entity specs
 *
 * Routes:
 * - POST /api/creation/parse-spec - Parse and validate a spec
 *
 * @module app/api/creation/parse-spec/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorSpecSchema,
  workflowSpecSchema,
  channelSpecSchema,
  workspaceSpecSchema,
  sessionManagerFullSpecSchema,
  subagentFullSpecSchema,
  parseSpecRequestSchema,
  createCreationErrorResponse,
  CREATION_ERROR_CODES,
} from '@/lib/validations/creation';

import type { NextRequest } from 'next/server';

/**
 * POST /api/creation/parse-spec
 *
 * Parse and validate an entity specification.
 * Returns normalized spec or validation errors.
 *
 * @param request - Next.js request with spec data
 * @returns Validated and normalized spec or errors
 *
 * @example
 * ```
 * POST /api/creation/parse-spec
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "spec": {
 *     "name": "Sarah the Support Lead",
 *     "role": "Customer Support",
 *     "charter": "Handle customer inquiries...",
 *     "communicationStyle": "friendly"
 *   }
 * }
 *
 * Response:
 * {
 *   "valid": true,
 *   "spec": { ... normalized spec ... },
 *   "warnings": []
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createCreationErrorResponse(
          'Authentication required',
          CREATION_ERROR_CODES.UNAUTHORIZED
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
        createCreationErrorResponse(
          'Invalid JSON body',
          CREATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate request structure
    const requestParseResult = parseSpecRequestSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        createCreationErrorResponse(
          'Invalid request structure',
          CREATION_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: requestParseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const { entityType, spec } = requestParseResult.data;

    // Validate spec based on entity type
    let parseResult;
    let warnings: string[] = [];

    switch (entityType) {
      case 'orchestrator':
        parseResult = orchestratorSpecSchema.safeParse(spec);
        if (parseResult.success) {
          // Add warnings for optional fields
          if (!parseResult.data.discipline) {
            warnings.push(
              'No discipline specified. Consider adding one for better organization.'
            );
          }
          if (
            !parseResult.data.channels ||
            parseResult.data.channels.length === 0
          ) {
            warnings.push(
              'No channels specified. Orchestrator will not monitor any channels initially.'
            );
          }
          if (!parseResult.data.escalationRules) {
            warnings.push('No escalation rules specified. Using defaults.');
          }
        }
        break;

      case 'workflow':
        parseResult = workflowSpecSchema.safeParse(spec);
        if (parseResult.success) {
          if (!parseResult.data.successOutcome) {
            warnings.push('No success outcome specified.');
          }
          if (!parseResult.data.failureOutcome) {
            warnings.push('No failure outcome specified.');
          }
        }
        break;

      case 'channel':
        parseResult = channelSpecSchema.safeParse(spec);
        if (parseResult.success) {
          if (!parseResult.data.description) {
            warnings.push(
              'No description provided. Consider adding one for clarity.'
            );
          }
          if (
            parseResult.data.type === 'PRIVATE' &&
            parseResult.data.initialMembers.length === 0
          ) {
            warnings.push('Private channel has no initial members.');
          }
        }
        break;

      case 'workspace':
        parseResult = workspaceSpecSchema.safeParse(spec);
        if (parseResult.success) {
          if (
            !parseResult.data.initialOrchestrators ||
            parseResult.data.initialOrchestrators.length === 0
          ) {
            warnings.push(
              'No initial orchestrators specified. You can add them later.'
            );
          }
          if (
            !parseResult.data.initialChannels ||
            parseResult.data.initialChannels.length === 0
          ) {
            warnings.push(
              'No initial channels specified. You can add them later.'
            );
          }
        }
        break;

      case 'session-manager':
        parseResult = sessionManagerFullSpecSchema.safeParse(spec);
        if (parseResult.success) {
          if (!parseResult.data.channelId) {
            warnings.push(
              'No channel specified. Session manager will not be bound to a specific channel.'
            );
          }
          if (
            !parseResult.data.escalationCriteria ||
            parseResult.data.escalationCriteria.length === 0
          ) {
            warnings.push('No escalation criteria specified.');
          }
        }
        break;

      case 'subagent':
        parseResult = subagentFullSpecSchema.safeParse(spec);
        if (parseResult.success) {
          if (!parseResult.data.inputFormat) {
            warnings.push('No input format specified.');
          }
          if (!parseResult.data.outputFormat) {
            warnings.push('No output format specified.');
          }
          if (!parseResult.data.errorHandling) {
            warnings.push('No error handling strategy specified.');
          }
        }
        break;

      default:
        return NextResponse.json(
          createCreationErrorResponse(
            `Unsupported entity type: ${entityType}`,
            CREATION_ERROR_CODES.VALIDATION_ERROR
          ),
          { status: 400 }
        );
    }

    // Return validation results
    if (!parseResult.success) {
      return NextResponse.json(
        {
          valid: false,
          errors: parseResult.error.flatten().fieldErrors,
          message: 'Specification validation failed',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      spec: parseResult.data,
      warnings,
      entityType,
      message: 'Specification validated successfully',
    });
  } catch (error) {
    console.error('[POST /api/creation/parse-spec] Error:', error);
    return NextResponse.json(
      createCreationErrorResponse(
        'An internal error occurred',
        CREATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
