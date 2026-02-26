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

import { prisma } from '@neolith/database';
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
  // push event fields
  ref?: string;
  commits?: Array<{ id: string; message: string; author: { name: string } }>;
  pusher?: { name: string; email: string };
  // pull_request event fields
  number?: number;
  pull_request?: {
    number: number;
    title: string;
    merged: boolean;
    user: { login: string };
    head: { ref: string };
    base: { ref: string };
  };
  // issues event fields
  issue?: {
    number: number;
    title: string;
    user: { login: string };
  };
}

/**
 * GitLab webhook event structure
 */
interface GitLabEvent {
  object_kind?: string;
  ref?: string;
  status?: string;
  stages?: string[];
  object_attributes?: {
    action?: string;
    title?: string;
    source_branch?: string;
    target_branch?: string;
    state?: string;
    iid?: number;
  };
}

/**
 * Linear webhook event structure
 */
interface LinearEvent {
  type?: string;
  action?: string;
  data?: {
    id?: string;
    title?: string;
    state?: { name: string };
    assignee?: { name: string };
  };
}

/** Webhook processor result */
interface WebhookProcessorResult {
  [key: string]: unknown;
  processed: boolean;
  event: string;
  summary: string;
}

/** Write an audit log entry for an integration event */
async function writeAuditLog(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await (prisma as any).auditLog.create({
    data: {
      actorType: 'integration',
      action,
      resourceType,
      resourceId,
      metadata,
    },
  });
}

/** Process a GitHub webhook payload after signature verification */
async function processGitHubWebhook(
  request: NextRequest,
  payload: GitHubEvent
): Promise<WebhookProcessorResult> {
  const eventType = request.headers.get('x-github-event') ?? 'unknown';
  const repo = payload.repository?.full_name ?? 'unknown';
  let summary = '';

  switch (eventType) {
    case 'push': {
      const branch = payload.ref?.replace('refs/heads/', '') ?? 'unknown';
      const commitCount = payload.commits?.length ?? 0;
      const pusher = payload.pusher?.name ?? payload.sender?.login ?? 'unknown';
      summary = `${pusher} pushed ${commitCount} commit(s) to ${repo}/${branch}`;
      await writeAuditLog('github.push', 'repository', repo, {
        repo,
        branch,
        commitCount,
        pusher,
        commits: (payload.commits ?? []).map(c => ({
          id: c.id,
          message: c.message,
          author: c.author.name,
        })),
      });
      break;
    }

    case 'pull_request': {
      const action = payload.action ?? 'unknown';
      const pr = payload.pull_request;
      const prNumber = pr?.number ?? payload.number ?? 0;
      const prTitle = pr?.title ?? 'unknown';
      const author = pr?.user?.login ?? payload.sender?.login ?? 'unknown';
      const merged = pr?.merged ?? false;
      const effectiveAction = action === 'closed' && merged ? 'merged' : action;
      summary = `PR #${prNumber} "${prTitle}" ${effectiveAction} by ${author} in ${repo}`;
      await writeAuditLog(
        `github.pull_request.${effectiveAction}`,
        'pull_request',
        String(prNumber),
        {
          repo,
          prNumber,
          title: prTitle,
          author,
          action: effectiveAction,
          merged,
        }
      );
      break;
    }

    case 'issues': {
      const action = payload.action ?? 'unknown';
      const issue = payload.issue;
      const issueNumber = issue?.number ?? 0;
      const issueTitle = issue?.title ?? 'unknown';
      summary = `Issue #${issueNumber} "${issueTitle}" ${action} in ${repo}`;
      await writeAuditLog(
        `github.issue.${action}`,
        'issue',
        String(issueNumber),
        {
          repo,
          issueNumber,
          title: issueTitle,
          action,
        }
      );
      break;
    }

    default:
      summary = `Unhandled GitHub event: ${eventType} in ${repo}`;
      break;
  }

  return { processed: true, event: eventType, summary };
}

/** Process a GitLab webhook payload after token verification */
async function processGitLabWebhook(
  request: NextRequest,
  payload: GitLabEvent
): Promise<WebhookProcessorResult> {
  const eventHeader = request.headers.get('x-gitlab-event') ?? 'unknown';
  let summary = '';

  switch (eventHeader) {
    case 'Pipeline Hook': {
      const status = payload.status ?? 'unknown';
      const ref = payload.ref ?? 'unknown';
      const stages = payload.stages ?? [];
      summary = `Pipeline ${status} on ${ref} (stages: ${stages.join(', ') || 'none'})`;
      await writeAuditLog(`gitlab.pipeline.${status}`, 'pipeline', ref, {
        status,
        ref,
        stages,
      });
      break;
    }

    case 'Merge Request Hook': {
      const attrs = payload.object_attributes ?? {};
      const action = attrs.action ?? 'unknown';
      const title = attrs.title ?? 'unknown';
      const sourceBranch = attrs.source_branch ?? 'unknown';
      const targetBranch = attrs.target_branch ?? 'unknown';
      const mrIid = attrs.iid ?? 0;
      summary = `MR #${mrIid} "${title}" ${action} (${sourceBranch} -> ${targetBranch})`;
      await writeAuditLog(
        `gitlab.merge_request.${action}`,
        'merge_request',
        String(mrIid),
        {
          action,
          title,
          sourceBranch,
          targetBranch,
          mrIid,
        }
      );
      break;
    }

    default:
      summary = `Unhandled GitLab event: ${eventHeader}`;
      break;
  }

  return { processed: true, event: eventHeader, summary };
}

/** Process a Linear webhook payload */
async function processLinearWebhook(
  payload: LinearEvent
): Promise<WebhookProcessorResult> {
  const type = payload.type ?? 'unknown';
  const action = payload.action ?? 'unknown';
  let summary = '';

  if (type === 'Issue' && (action === 'create' || action === 'update')) {
    const data = payload.data ?? {};
    const issueId = data.id ?? 'unknown';
    const title = data.title ?? 'unknown';
    const status = data.state?.name ?? 'unknown';
    const assignee = data.assignee?.name ?? 'unassigned';
    summary = `Issue "${title}" ${action}d — status: ${status}, assignee: ${assignee}`;
    await writeAuditLog(`linear.issue.${action}`, 'issue', issueId, {
      title,
      status,
      assignee,
      action,
    });
  } else {
    summary = `Unhandled Linear event: type=${type} action=${action}`;
  }

  return { processed: true, event: `${type}.${action}`, summary };
}

/**
 * Handle Slack incoming webhooks
 */
async function handleSlackWebhook(
  request: NextRequest,
  body: string
): Promise<NextResponse> {
  // Get Slack signature headers
  const signature = request.headers.get('x-slack-signature');
  const timestamp = request.headers.get('x-slack-request-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json(
      createErrorResponse(
        'Missing Slack signature headers',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
    );
  }

  // Verify request is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return NextResponse.json(
      createErrorResponse(
        'Request timestamp is too old',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
    );
  }

  // Verify signature
  const slackSecret = process.env.SLACK_SIGNING_SECRET || '';
  if (!verifySlackSignature(timestamp, body, signature, slackSecret)) {
    return NextResponse.json(
      createErrorResponse(
        'Invalid Slack signature',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
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
  body: string
): Promise<NextResponse> {
  // Get GitHub signature header
  const signature = request.headers.get('x-hub-signature-256');

  if (!signature) {
    return NextResponse.json(
      createErrorResponse(
        'Missing GitHub signature header',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
    );
  }

  // Verify signature
  const githubSecret = process.env.GITHUB_WEBHOOK_SECRET || '';
  if (!verifyGitHubSignature(body, signature, githubSecret)) {
    return NextResponse.json(
      createErrorResponse(
        'Invalid GitHub signature',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
    );
  }

  // Parse the payload and process
  const payload = JSON.parse(body) as GitHubEvent;
  const result = await processGitHubWebhook(request, payload);

  logger.info('GitHub webhook processed', result);

  // Acknowledge receipt
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle GitLab incoming webhooks
 */
async function handleGitLabWebhook(
  request: NextRequest,
  body: string
): Promise<NextResponse> {
  // Get GitLab token header
  const token = request.headers.get('x-gitlab-token');

  // Verify token
  const expectedToken = process.env.GITLAB_WEBHOOK_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json(
      createErrorResponse(
        'Invalid GitLab token',
        INTEGRATION_ERROR_CODES.WEBHOOK_SECRET_MISMATCH
      ),
      { status: 401 }
    );
  }

  // Parse the payload and process
  const payload = JSON.parse(body) as GitLabEvent;
  const result = await processGitLabWebhook(request, payload);

  logger.info('GitLab webhook processed', result);

  // Acknowledge receipt
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle Linear incoming webhooks
 */
async function handleLinearWebhook(
  _request: NextRequest,
  body: string
): Promise<NextResponse> {
  // Linear uses a signature in the request body
  const payload = JSON.parse(body) as LinearEvent;
  const result = await processLinearWebhook(payload);

  logger.info('Linear webhook processed', result);

  // Acknowledge receipt
  return NextResponse.json({ success: true });
}

/**
 * Handle custom/generic incoming webhooks
 */
async function handleCustomWebhook(
  _request: NextRequest,
  _body: string
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
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Get provider
    const params = await context.params;
    const { provider } = params;

    if (!provider) {
      return NextResponse.json(
        createErrorResponse(
          'Provider is required',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();

    if (!body) {
      return NextResponse.json(
        createErrorResponse(
          'Empty request body',
          INTEGRATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          createErrorResponse(
            `Unknown provider: ${provider}`,
            INTEGRATION_ERROR_CODES.VALIDATION_ERROR
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
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
  context: RouteContext
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
      createErrorResponse(
        'Method not allowed',
        INTEGRATION_ERROR_CODES.VALIDATION_ERROR
      ),
      { status: 405 }
    );
  } catch (error: unknown) {
    logger.error('Webhook GET failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        INTEGRATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
