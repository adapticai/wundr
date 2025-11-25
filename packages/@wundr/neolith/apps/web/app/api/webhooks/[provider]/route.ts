/**
 * Incoming Webhooks API Route
 *
 * Handles incoming webhooks from external providers (Slack, GitHub, etc.).
 *
 * Routes:
 * - POST /api/webhooks/:provider - Receive webhook from provider
 *
 * @module app/api/webhooks/[provider]/route
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  verifySlackSignature,
  verifyGitHubSignature,
} from '@/lib/services/integration-service';
import { INTEGRATION_ERROR_CODES } from '@/lib/validations/integration';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with provider parameter
 */
interface RouteContext {
  params: Promise<{ provider: string }>;
}

/**
 * Slack webhook event types we handle
 */
interface SlackEvent {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel?: string;
    user?: string;
    text?: string;
    ts?: string;
  };
  team_id?: string;
  api_app_id?: string;
}

/**
 * GitHub webhook event structure
 */
interface GitHubEvent {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
  };
  sender?: {
    login: string;
    id: number;
  };
  installation?: {
    id: number;
  };
}

/**
 * Handle Slack incoming webhooks
 */
async function handleSlackWebhook(
  request: NextRequest,
  body: string,
): Promise<NextResponse> {
  // Get Slack signature headers
  const signature = request.headers.get('x-slack-signature');
  const timestamp = request.headers.get('x-slack-request-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json(
      createErrorResponse('Missing Slack signature headers', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Verify request is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return NextResponse.json(
      createErrorResponse('Request timestamp is too old', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Verify signature
  if (!verifySlackSignature(body, signature, timestamp)) {
    return NextResponse.json(
      createErrorResponse('Invalid Slack signature', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Parse the event
  const event: SlackEvent = JSON.parse(body);

  // Handle URL verification challenge
  if (event.type === 'url_verification' && event.challenge) {
    return NextResponse.json({ challenge: event.challenge });
  }

  // Handle event callbacks
  if (event.type === 'event_callback' && event.event) {
    // Process different event types
    switch (event.event.type) {
      case 'message':
        // Handle incoming Slack messages
        break;

      case 'app_mention':
        // Handle app mentions
        break;

      case 'channel_created':
      case 'channel_deleted':
      case 'channel_archive':
      case 'channel_unarchive':
        // Handle channel events
        break;

      case 'team_join':
        // Handle new team members
        break;

      default:
        // Unhandled event type - no action needed
        break;
    }
  }

  // Always acknowledge receipt
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle GitHub incoming webhooks
 */
async function handleGitHubWebhook(
  request: NextRequest,
  body: string,
): Promise<NextResponse> {
  // Get GitHub signature header
  const signature = request.headers.get('x-hub-signature-256');

  if (!signature) {
    return NextResponse.json(
      createErrorResponse('Missing GitHub signature header', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Verify signature
  if (!verifyGitHubSignature(body, signature)) {
    return NextResponse.json(
      createErrorResponse('Invalid GitHub signature', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Parse the payload
  // TODO: Process GitHub webhook payload
  JSON.parse(body) as GitHubEvent;

  // Acknowledge receipt
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle GitLab incoming webhooks
 */
async function handleGitLabWebhook(
  request: NextRequest,
  body: string,
): Promise<NextResponse> {
  // Get GitLab token header
  const token = request.headers.get('x-gitlab-token');

  // Verify token
  const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json(
      createErrorResponse('Invalid GitLab token', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Parse the payload
  // TODO: Process GitLab webhook payload
  JSON.parse(body);

  // Acknowledge receipt
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle Linear incoming webhooks
 */
async function handleLinearWebhook(
  _request: NextRequest,
  body: string,
): Promise<NextResponse> {
  // Linear uses a signature in the request body
  // TODO: Process Linear webhook payload
  JSON.parse(body) as { type?: string; action?: string };

  // Acknowledge receipt
  return NextResponse.json({ success: true });
}

/**
 * Handle custom/generic incoming webhooks
 */
async function handleCustomWebhook(
  _request: NextRequest,
  _body: string,
): Promise<NextResponse> {
  // Acknowledge receipt
  return NextResponse.json({ received: true });
}

/**
 * POST /api/webhooks/:provider
 *
 * Receive and process incoming webhooks from external providers.
 *
 * Supported providers:
 * - slack: Slack Events API
 * - github: GitHub Webhooks
 * - gitlab: GitLab Webhooks
 * - linear: Linear Webhooks
 * - custom: Generic webhook handler
 *
 * @param request - Next.js request with webhook payload
 * @param context - Route context containing provider
 * @returns Provider-specific acknowledgment
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Get provider
    const params = await context.params;
    const { provider } = params;

    if (!provider) {
      return NextResponse.json(
        createErrorResponse('Provider is required', INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get raw body for signature verification
    const body = await request.text();

    if (!body) {
      return NextResponse.json(
        createErrorResponse('Empty request body', INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Route to provider-specific handler
    switch (provider.toLowerCase()) {
      case 'slack':
        return handleSlackWebhook(request, body);

      case 'github':
        return handleGitHubWebhook(request, body);

      case 'gitlab':
        return handleGitLabWebhook(request, body);

      case 'linear':
        return handleLinearWebhook(request, body);

      case 'custom':
        return handleCustomWebhook(request, body);

      default:
        return NextResponse.json(
          createErrorResponse(`Unknown provider: ${provider}`, INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error('Webhook processing failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * GET /api/webhooks/:provider
 *
 * Handle GET requests for providers that use GET for verification.
 * Some providers (like certain OAuth flows or verification endpoints)
 * may send GET requests.
 *
 * @param request - Next.js request object
 * @param context - Route context containing provider
 * @returns Verification response or method not allowed
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { provider } = params;

    // Handle specific GET verification cases
    switch (provider?.toLowerCase()) {
      case 'custom': {
        // Custom webhooks might use GET for verification
        const challenge = request.nextUrl.searchParams.get('challenge');
        if (challenge) {
          return new NextResponse(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
        break;
      }
    }

    // Return method not allowed for other cases
    return NextResponse.json(
      createErrorResponse('Method not allowed', INTEGRATION_ERROR_CODES.VALIDATION_ERROR),
      { status: 405 },
    );
  } catch (error: unknown) {
    logger.error('Webhook GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
