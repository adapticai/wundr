/**
 * Workspace Webhooks API Routes - STUB IMPLEMENTATION
 *
 * ⚠️ WARNING: This is a STUB implementation for frontend integration testing.
 * Real webhook functionality is not yet implemented.
 *
 * Handles listing and creating webhooks for a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/webhooks - List webhooks (mock data)
 * - POST /api/workspaces/:workspaceId/webhooks - Create webhook (stub)
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/route
 */

import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Webhook event types (STUB - for reference only)
 */
type WebhookEventType =
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'member.joined'
  | 'member.left'
  | 'member.updated'
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'message.created'
  | 'message.updated'
  | 'message.deleted';

/**
 * Webhook status (STUB)
 */
type WebhookStatus = 'ACTIVE' | 'INACTIVE' | 'FAILED';

/**
 * Webhook interface (STUB)
 */
interface Webhook {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  url: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  secret?: string; // Only returned on creation
  retryCount: number;
  timeoutMs: number;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastDeliveryAt?: string;
  successCount: number;
  failureCount: number;
}

/**
 * Create webhook request body (STUB)
 */
interface CreateWebhookRequest {
  name: string;
  description?: string;
  url: string;
  events: WebhookEventType[];
  retryCount?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * STUB: Mock webhook data generator
 */
function generateMockWebhook(
  workspaceId: string,
  userId: string,
  index: number,
): Webhook {
  const webhookIds = [
    'wh_1a2b3c4d5e6f',
    'wh_7g8h9i0j1k2l',
    'wh_3m4n5o6p7q8r',
  ];

  const now = new Date();
  const createdAt = new Date(now.getTime() - (index * 86400000)); // Each webhook is 1 day older

  return {
    id: webhookIds[index] || `wh_${randomBytes(6).toString('hex')}`,
    workspaceId,
    name: `Webhook ${index + 1}`,
    description: index === 0
      ? 'Production webhook for member events'
      : index === 1
      ? 'Development webhook for testing'
      : undefined,
    url: index === 0
      ? 'https://api.example.com/webhooks/production'
      : index === 1
      ? 'https://webhook.site/test-endpoint'
      : 'https://internal.company.com/webhooks',
    events: index === 0
      ? ['member.joined', 'member.left', 'member.updated']
      : index === 1
      ? ['workspace.created', 'workspace.updated']
      : ['message.created', 'message.updated', 'message.deleted'],
    status: index === 2 ? 'FAILED' : 'ACTIVE',
    retryCount: 3,
    timeoutMs: 10000,
    headers: index === 0
      ? { 'X-Custom-Header': 'production-value' }
      : undefined,
    metadata: index === 1
      ? { environment: 'development', team: 'engineering' }
      : undefined,
    createdAt: createdAt.toISOString(),
    updatedAt: new Date(createdAt.getTime() + 3600000).toISOString(),
    createdBy: userId,
    lastDeliveryAt: index === 2
      ? undefined
      : new Date(now.getTime() - 3600000).toISOString(),
    successCount: index === 0 ? 245 : index === 1 ? 12 : 0,
    failureCount: index === 0 ? 3 : index === 1 ? 1 : 5,
  };
}

/**
 * GET /api/workspaces/:workspaceId/webhooks
 *
 * ⚠️ STUB: Returns mock webhook data for frontend integration testing.
 *
 * Query parameters:
 * - status: Filter by status (ACTIVE, INACTIVE, FAILED)
 * - event: Filter by subscribed event type
 * - search: Search by name, description, or URL
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sortBy: Sort field (default: createdAt)
 * - sortOrder: Sort direction (default: desc)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of webhooks with pagination (MOCK DATA)
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
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get workspace ID
    const params = await context.params;
    const { workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: 'Workspace ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') as WebhookStatus | null;
    const event = searchParams.get('event') as WebhookEventType | null;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // STUB: Generate mock webhooks
    const mockWebhooks = Array.from({ length: 3 }, (_, i) =>
      generateMockWebhook(workspaceId, session.user.id, i),
    );

    // STUB: Apply filters
    let filteredWebhooks = [...mockWebhooks];

    if (status) {
      filteredWebhooks = filteredWebhooks.filter(w => w.status === status);
    }

    if (event) {
      filteredWebhooks = filteredWebhooks.filter(w => w.events.includes(event));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredWebhooks = filteredWebhooks.filter(w =>
        w.name.toLowerCase().includes(searchLower) ||
        w.description?.toLowerCase().includes(searchLower) ||
        w.url.toLowerCase().includes(searchLower),
      );
    }

    // STUB: Apply sorting
    filteredWebhooks.sort((a, b) => {
      const aValue = a[sortBy as keyof Webhook];
      const bValue = b[sortBy as keyof Webhook];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    // STUB: Apply pagination
    const total = filteredWebhooks.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedWebhooks = filteredWebhooks.slice(offset, offset + limit);

    // Remove secret from response
    const safeWebhooks = paginatedWebhooks.map(w => {
      const { secret: _secret, ...webhook } = w;
      return webhook;
    });

    return NextResponse.json({
      webhooks: safeWebhooks,
      total,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      _stub: true, // Flag indicating this is stub data
      _message: 'This is mock data from a stub implementation',
    });
  } catch (error) {
    console.error('Webhooks GET error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/webhooks
 *
 * ⚠️ STUB: Creates a mock webhook for frontend integration testing.
 * Does not persist data to database.
 *
 * Request body:
 * - name: Display name for the webhook (required)
 * - description: Optional description
 * - url: Webhook endpoint URL (required)
 * - events: Array of event types to subscribe to (required)
 * - retryCount: Number of retry attempts (default: 3)
 * - timeoutMs: Request timeout in milliseconds (default: 10000)
 * - headers: Custom headers to include
 * - metadata: Additional metadata
 *
 * @param request - Next.js request with webhook data
 * @param context - Route context containing workspace ID
 * @returns Created webhook and secret (MOCK DATA - shown only once)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get workspace ID
    const params = await context.params;
    const { workspaceId } = params;

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: 'Workspace ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Parse request body
    let body: CreateWebhookRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON body',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // STUB: Basic validation
    if (!body.name || !body.url || !body.events || body.events.length === 0) {
      return NextResponse.json(
        {
          error: 'Validation failed: name, url, and events are required',
          code: 'VALIDATION_ERROR',
          details: {
            name: !body.name ? ['Name is required'] : undefined,
            url: !body.url ? ['URL is required'] : undefined,
            events: !body.events || body.events.length === 0
              ? ['At least one event is required']
              : undefined,
          },
        },
        { status: 400 },
      );
    }

    // STUB: Validate URL format
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        {
          error: 'Validation failed: invalid URL format',
          code: 'VALIDATION_ERROR',
          details: {
            url: ['Must be a valid URL'],
          },
        },
        { status: 400 },
      );
    }

    // STUB: Generate webhook secret (would be securely stored in real implementation)
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    // STUB: Create mock webhook
    const now = new Date();
    const webhook: Webhook = {
      id: `wh_${randomBytes(6).toString('hex')}`,
      workspaceId,
      name: body.name,
      description: body.description,
      url: body.url,
      events: body.events,
      status: 'ACTIVE',
      retryCount: body.retryCount ?? 3,
      timeoutMs: body.timeoutMs ?? 10000,
      headers: body.headers,
      metadata: body.metadata,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: session.user.id,
      successCount: 0,
      failureCount: 0,
    };

    // Remove secret from webhook object (it's returned separately)
    const { secret: _omitSecret, ...safeWebhook } = webhook;

    return NextResponse.json(
      {
        webhook: safeWebhook,
        secret, // Only shown once on creation
        message: 'Webhook created successfully. Store the secret securely - it will not be shown again.',
        _stub: true, // Flag indicating this is stub data
        _message: 'This webhook was not persisted to the database (stub implementation)',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Webhooks POST error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
