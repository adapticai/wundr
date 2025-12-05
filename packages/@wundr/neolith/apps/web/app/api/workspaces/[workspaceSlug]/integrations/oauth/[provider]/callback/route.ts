/**
 * OAuth Callback API Route
 *
 * Handles OAuth callback from integration providers.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/integrations/oauth/:provider/callback - OAuth callback
 *
 * @module app/api/workspaces/[workspaceId]/integrations/oauth/[provider]/callback/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  checkWorkspaceAccess,
  verifyOAuthState,
  exchangeOAuthCode,
  createIntegration,
  updateIntegration,
  listIntegrations,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { integrationProviderSchema } from '@/lib/validations/integration';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';

type IntegrationProviderType = z.infer<typeof integrationProviderSchema>;

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
 * GET /api/workspaces/:workspaceId/integrations/oauth/:provider/callback
 *
 * Handle OAuth callback from the provider.
 * Exchanges the authorization code for access tokens and creates/updates the integration.
 *
 * Query parameters (from OAuth provider):
 * - code: Authorization code
 * - state: State parameter for CSRF protection
 * - error: Error code (if authorization failed)
 * - error_description: Error description (if authorization failed)
 *
 * @param request - Next.js request object with OAuth callback parameters
 * @param context - Route context containing workspace ID and provider
 * @returns Redirect to integrations page or error response
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, provider: providerParam } = params;

    if (!workspaceId || !providerParam) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID and provider are required',
          INTEGRATION_ERROR_CODES.INVALID_PROVIDER,
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
          `Unsupported provider: ${providerLower}`,
          INTEGRATION_ERROR_CODES.INVALID_PROVIDER,
        ),
        { status: 400 },
      );
    }

    // TypeScript now knows provider is OAuthProvider type
    const provider: OAuthProvider = providerLower;

    // Extract query parameters
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      logger.error(`OAuth error for ${provider}`, { error, errorDescription });
      const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
      return NextResponse.redirect(
        `${baseUrl}/workspace/${workspaceId}/settings/integrations?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription ?? '')}`,
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        createErrorResponse(
          'Missing authorization code or state',
          INTEGRATION_ERROR_CODES.AUTH_FAILED,
        ),
        { status: 400 },
      );
    }

    // Verify state
    const stateData = verifyOAuthState(state);
    if (!stateData) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid or expired state parameter',
          INTEGRATION_ERROR_CODES.AUTH_FAILED,
        ),
        { status: 400 },
      );
    }

    // Note: verifyOAuthState currently returns boolean, not object with properties
    // TODO: Update verifyOAuthState to return state data or enhance validation

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          INTEGRATION_ERROR_CODES.AUTH_FAILED,
        ),
        { status: 401 },
      );
    }

    // Check workspace access and admin permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access || !access.hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          INTEGRATION_ERROR_CODES.INVALID_PROVIDER,
        ),
        { status: 404 },
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Admin permission required to connect integrations',
          INTEGRATION_ERROR_CODES.AUTH_FAILED,
        ),
        { status: 403 },
      );
    }

    // Build redirect URI (must match the one used during authorization)
    const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/workspaces/${workspaceId}/integrations/oauth/${provider}/callback`;

    // Get OAuth credentials from environment
    const providerUpper = provider.toUpperCase();
    const clientId = process.env[`${providerUpper}_CLIENT_ID`];
    const clientSecret = process.env[`${providerUpper}_CLIENT_SECRET`];

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        createErrorResponse(
          `OAuth credentials not configured for ${provider}`,
          INTEGRATION_ERROR_CODES.MISSING_CREDENTIALS,
        ),
        { status: 500 },
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeOAuthCode(
      provider,
      code,
      clientId,
      clientSecret,
      redirectUri,
    );
    if (!tokens) {
      return NextResponse.json(
        createErrorResponse(
          'Failed to exchange authorization code',
          INTEGRATION_ERROR_CODES.INTEGRATION_OAUTH_FAILED,
        ),
        { status: 400 },
      );
    }

    // Check for existing integration of this provider
    const { integrations } = await listIntegrations(workspaceId, {
      provider: provider as IntegrationProviderType,
      page: 1,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    let integration;

    if (integrations.length > 0) {
      // Update existing integration
      integration = await updateIntegration(workspaceId, integrations[0].id, {
        status: 'ACTIVE',
      });

      // Store tokens securely (in production, encrypt these)
      // For now, we update the integration with connection info
      if (integration) {
        await updateIntegration(workspaceId, integrations[0].id, {
          metadata: {
            ...integration.metadata,
            connectedAt: new Date().toISOString(),
            connectedBy: session.user.id,
          },
        });
      }
    } else {
      // Create new integration
      integration = await createIntegration(
        workspaceId,
        {
          provider: provider as IntegrationProviderType,
          name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Integration`,
          description: `Connected via OAuth on ${new Date().toLocaleDateString()}`,
          syncEnabled: false,
          metadata: {
            connectedAt: new Date().toISOString(),
            connectedBy: session.user.id,
          },
        },
        session.user.id,
      );

      // Update status to active after successful OAuth
      if (integration) {
        await updateIntegration(workspaceId, integration.id, {
          status: 'ACTIVE',
        });
      }
    }

    // Redirect to integrations page
    return NextResponse.redirect(
      `${baseUrl}/workspace/${workspaceId}/settings/integrations?success=true&provider=${provider}`,
    );
  } catch (error) {
    logger.error('OAuth callback failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Redirect with error
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
    return NextResponse.redirect(
      `${baseUrl}/workspace/${workspaceId}/settings/integrations?error=callback_failed`,
    );
  }
}
