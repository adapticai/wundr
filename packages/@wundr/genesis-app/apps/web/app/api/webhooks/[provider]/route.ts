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
    // Log the event for processing
    console.log('[Slack Webhook] Event received:', event.event.type);

    // Process different event types
    switch (event.event.type) {
      case 'message':
        // Handle incoming Slack messages
        console.log('[Slack Webhook] Message:', {
          channel: event.event.channel,
          user: event.event.user,
          text: event.event.text?.substring(0, 100),
        });
        break;

      case 'app_mention':
        // Handle app mentions
        console.log('[Slack Webhook] App mention:', {
          channel: event.event.channel,
          user: event.event.user,
        });
        break;

      case 'channel_created':
      case 'channel_deleted':
      case 'channel_archive':
      case 'channel_unarchive':
        // Handle channel events
        console.log('[Slack Webhook] Channel event:', event.event.type);
        break;

      case 'team_join':
        // Handle new team members
        console.log('[Slack Webhook] New team member:', event.event.user);
        break;

      default:
        console.log('[Slack Webhook] Unhandled event type:', event.event.type);
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
  const event = request.headers.get('x-github-event');
  const deliveryId = request.headers.get('x-github-delivery');

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
  const payload: GitHubEvent = JSON.parse(body);

  console.log('[GitHub Webhook] Event received:', {
    event,
    deliveryId,
    action: payload.action,
    repository: payload.repository?.full_name,
  });

  // Process different event types
  switch (event) {
    case 'ping':
      // Webhook ping event
      return NextResponse.json({ message: 'pong' });

    case 'push':
      // Handle push events
      console.log('[GitHub Webhook] Push event:', payload.repository?.full_name);
      break;

    case 'pull_request':
      // Handle PR events
      console.log('[GitHub Webhook] PR event:', {
        action: payload.action,
        repository: payload.repository?.full_name,
      });
      break;

    case 'issues':
      // Handle issue events
      console.log('[GitHub Webhook] Issue event:', {
        action: payload.action,
        repository: payload.repository?.full_name,
      });
      break;

    case 'issue_comment':
    case 'pull_request_review':
    case 'pull_request_review_comment':
      // Handle comment events
      console.log('[GitHub Webhook] Comment event:', event);
      break;

    case 'check_run':
    case 'check_suite':
    case 'workflow_run':
      // Handle CI/CD events
      console.log('[GitHub Webhook] CI event:', event);
      break;

    case 'installation':
    case 'installation_repositories':
      // Handle app installation events
      console.log('[GitHub Webhook] Installation event:', payload.installation?.id);
      break;

    default:
      console.log('[GitHub Webhook] Unhandled event type:', event);
  }

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
  const event = request.headers.get('x-gitlab-event');

  // Verify token
  const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json(
      createErrorResponse('Invalid GitLab token', INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH),
      { status: 401 },
    );
  }

  // Parse the payload
  const payload = JSON.parse(body);

  console.log('[GitLab Webhook] Event received:', {
    event,
    objectKind: payload.object_kind,
    project: payload.project?.path_with_namespace,
  });

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
  const payload = JSON.parse(body) as { type?: string; action?: string };

  console.log('[Linear Webhook] Event received:', {
    type: payload.type,
    action: payload.action,
  });

  // Acknowledge receipt
  return NextResponse.json({ success: true });
}

/**
 * Handle custom/generic incoming webhooks
 */
async function handleCustomWebhook(
  request: NextRequest,
  body: string,
): Promise<NextResponse> {
  console.log('[Custom Webhook] Event received:', {
    contentType: request.headers.get('content-type'),
    bodyLength: body.length,
  });

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
    console.error('[POST /api/webhooks/:provider] Error:', error);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GET /api/webhooks/:provider] Error:', errorMessage);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', INTEGRATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
