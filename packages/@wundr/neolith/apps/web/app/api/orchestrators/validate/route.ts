/**
 * OrchestratorAPI Key Validation Route
 *
 * Validates API keys for Orchestrator daemon authentication.
 * This endpoint is used by Orchestrator daemons to verify their credentials
 * and retrieve Orchestrator information for authorized operations.
 *
 * Routes:
 * - POST /api/orchestrators/validate - Validate API key and return Orchestrator info
 *
 * @module app/api/orchestrators/validate/route
 */

import { createHash } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';


import {
  validateApiKeySchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { ValidateApiKeyInput } from '@/lib/validations/orchestrator';
import type { NextRequest} from 'next/server';

/**
 * Hash an API key for comparison
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * API key metadata structure stored in Orchestrator capabilities
 */
interface ApiKeyMetadata {
  hash: string;
  name?: string;
  scopes?: string[];
  createdAt?: string;
  createdBy?: string;
  expiresAt?: string;
}

/**
 * POST /api/orchestrators/validate
 *
 * Validate an API key and return Orchestrator information if valid.
 * This endpoint does NOT require session authentication -
 * it's designed for daemon-to-server communication using API keys.
 *
 * @param request - Next.js request with API key
 * @returns Orchestrator info if key is valid
 *
 * @example
 * ```
 * POST /api/orchestrators/validate
 * Content-Type: application/json
 *
 * {
 *   "apiKey": "vp_abc123...",
 *   "orchestratorId": "vp_123" // Optional - for additional validation
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = validateApiKeySchema.safeParse(body);
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

    const input: ValidateApiKeyInput = parseResult.data;

    // Validate API key format
    if (!input.apiKey.startsWith('vp_')) {
      return NextResponse.json(
        createErrorResponse('Invalid API key format', ORCHESTRATOR_ERROR_CODES.INVALID_API_KEY),
        { status: 401 },
      );
    }

    // Hash the provided API key for comparison
    const apiKeyHash = hashApiKey(input.apiKey);

    // Build query to find Orchestrator with matching API key hash
    // If orchestratorId is provided, add it as an additional filter
    const whereClause = input.orchestratorId ? { id: input.orchestratorId } : {};

    // Fetch all VPs (or specific Orchestrator if orchestratorId provided) to check API keys
    // Note: In production with many VPs, consider a dedicated API key table with index
    const orchestrators = await prisma.orchestrator.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Find Orchestrator with matching API key hash
    let matchedVP = null;
    let keyMetadata: ApiKeyMetadata | null = null;

    for (const orchestrator of orchestrators) {
      const capabilities = orchestrator.capabilities as Record<string, unknown> | null;
      if (capabilities?.apiKey) {
        const storedKey = capabilities.apiKey as ApiKeyMetadata;
        if (storedKey.hash === apiKeyHash) {
          matchedVP = orchestrator;
          keyMetadata = storedKey;
          break;
        }
      }
    }

    if (!matchedVP || !keyMetadata) {
      return NextResponse.json(
        createErrorResponse('Invalid API key', ORCHESTRATOR_ERROR_CODES.INVALID_API_KEY),
        { status: 401 },
      );
    }

    // Check if API key has expired
    if (keyMetadata.expiresAt) {
      const expirationDate = new Date(keyMetadata.expiresAt);
      if (expirationDate < new Date()) {
        return NextResponse.json(
          createErrorResponse('API key has expired', ORCHESTRATOR_ERROR_CODES.API_KEY_EXPIRED),
          { status: 401 },
        );
      }
    }

    // Check if Orchestrator is active (not offline or suspended)
    if (matchedVP.status === 'OFFLINE') {
      // Allow validation but include status in response
      console.warn(
        `[OrchestratorValidate] API key validated for offline Orchestrator ${matchedVP.id}`,
      );
    }

    // Check if user is active
    if (matchedVP.user.status !== 'ACTIVE') {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator user account is not active',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // TODO: Log successful validation to audit log service in production

    // Return Orchestrator info without sensitive data
    return NextResponse.json({
      valid: true,
      data: {
        orchestrator: {
          id: matchedVP.id,
          discipline: matchedVP.discipline,
          role: matchedVP.role,
          status: matchedVP.status,
          daemonEndpoint: matchedVP.daemonEndpoint,
          capabilities: (() => {
            // Return capabilities without the API key hash
            const caps = matchedVP.capabilities as Record<string, unknown>;
            if (caps) {
              const { apiKey: _, ...safeCaps } = caps;
              return safeCaps;
            }
            return {};
          })(),
        },
        user: {
          id: matchedVP.user.id,
          name: matchedVP.user.name,
          email: matchedVP.user.email,
          displayName: matchedVP.user.displayName,
          avatarUrl: matchedVP.user.avatarUrl,
        },
        organization: {
          id: matchedVP.organization.id,
          name: matchedVP.organization.name,
          slug: matchedVP.organization.slug,
        },
        apiKey: {
          name: keyMetadata.name,
          scopes: keyMetadata.scopes ?? [],
          expiresAt: keyMetadata.expiresAt ?? null,
        },
      },
    });
  } catch (error) {
    console.error('[POST /api/orchestrators/validate] Error:', error);
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
 * OPTIONS /api/orchestrators/validate
 *
 * Handle CORS preflight requests for daemon authentication.
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin') ?? '*';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
