/**
 * OAuth Integration API Routes
 *
 * Handles OAuth flow initiation for integration providers.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/integrations/oauth/:provider - Start OAuth flow
 *
 * @module app/api/workspaces/[workspaceId]/integrations/oauth/[provider]/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  checkWorkspaceAccess,
  generateOAuthState,
  buildOAuthAuthorizationUrl,
  OAUTH_PROVIDERS,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Valid OAuth provider types - must match OAUTH_PROVIDERS keys
 */
type OAuthProvider = 'github' | 'slack' | 'gitlab' | 'linear' | 'notion' | 'discord';

/**
 * Type guard to check if a string is a valid OAuth provider
 */
function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return ['github', 'slack', 'gitlab', 'linear', 'notion', 'discord'].includes(provider);
}

/**
 * Route context with workspace ID and provider parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; provider: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/integrations/oauth/:provider
 *
 * Start the OAuth flow for a specific provider.
 * Redirects the user to the provider's authorization page.
 *
 * Query parameters:
 * - redirect_uri: Optional custom redirect URI (must be whitelisted)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID and provider
 * @returns Redirect to OAuth authorization URL or JSON with authorization URL
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, provider: providerParam } = params;

    if (!workspaceId || !providerParam) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and provider are required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Normalize provider name to lowercase
    const providerLower = providerParam.toLowerCase();

    // Validate provider using type guard
    if (!isValidOAuthProvider(providerLower)) {
      return NextResponse.json(
        createErrorResponse(
          `Unsupported OAuth provider: ${providerParam}`,
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // TypeScript now knows provider is OAuthProvider type
    const provider: OAuthProvider = providerLower;

    // Check workspace access and admin permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required to connect integrations',
          INTEGRATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Generate OAuth state
    const state = generateOAuthState();

    // Build redirect URI
    const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/workspaces/${workspaceId}/integrations/oauth/${provider}/callback`;

    // Build authorization URL
    const providerUpper = provider.toUpperCase();
    const clientId = process.env[`${providerUpper}_CLIENT_ID`] || '';
    const authorizationUrl = buildOAuthAuthorizationUrl(
      provider,
      clientId,
      redirectUri,
      state,
    );

    if (!authorizationUrl) {
      return NextResponse.json(
        createErrorResponse(
          'OAuth provider not configured',
          INTEGRATION_ERROR_CODES.OAUTH_PROVIDER_ERROR,
        ),
        { status: 500 },
      );
    }

    // Check if client wants JSON response or redirect
    const acceptHeader = request.headers.get('accept') ?? '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        authorizationUrl,
        state,
      });
    }

    // Redirect to authorization URL
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    logger.error('OAuth flow initiation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
