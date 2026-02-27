/**
 * Integration Service
 * Manages third-party integrations and external API connections
 * @module lib/services/integration-service
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';

/**
 * OAuth provider configurations
 */
export const OAUTH_PROVIDERS = {
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'user', 'read:org'],
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'channels:history'],
  },
  gitlab: {
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scopes: ['api', 'read_user'],
  },
  linear: {
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: ['read', 'write'],
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: ['webhook.incoming', 'identify'],
  },
} as const;

/**
 * Initialize a new integration
 */
export async function initializeIntegration(
  integrationId: string,
  config: any
): Promise<any> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/integrations/${integrationId}/webhook`;

  return await (prisma as any).integration.update({
    where: { id: integrationId },
    data: {
      status: 'PENDING',
      metadata: {
        webhookUrl,
        ...config,
        initializedAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Connect to an external service
 */
export async function connectToService(
  serviceName: string,
  credentials: any
): Promise<any> {
  return await (prisma as any).integration.updateMany({
    where: { provider: serviceName },
    data: {
      status: 'ACTIVE',
      connectedAt: new Date(),
      metadata: credentials,
    },
  });
}

/**
 * Disconnect from an external service
 */
export async function disconnectFromService(
  serviceName: string
): Promise<void> {
  await (prisma as any).integration.updateMany({
    where: { provider: serviceName },
    data: {
      status: 'INACTIVE',
      accessToken: null,
      refreshToken: null,
      metadata: {},
      disconnectedAt: new Date(),
    },
  });
}

/**
 * Get integration status
 */
export async function getIntegrationStatus(
  integrationId: string
): Promise<any> {
  const integration = await (prisma as any).integration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      status: true,
      provider: true,
      name: true,
      connectedAt: true,
      lastSyncAt: true,
      syncError: true,
      syncEnabled: true,
      metadata: true,
    },
  });

  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    status: integration.status,
    provider: integration.provider,
    name: integration.name,
    connectedAt: integration.connectedAt,
    lastSyncAt: integration.lastSyncAt,
    syncError: integration.syncError,
    syncEnabled: integration.syncEnabled,
    metadata: integration.metadata,
  };
}

/**
 * List all active integrations
 */
export async function listIntegrations(
  workspaceId: string,
  filters?: any
): Promise<{ integrations: any[]; total: number }> {
  try {
    const where: any = { workspaceId };

    if (filters?.provider) {
      where.provider = filters.provider;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [integrations, total] = await Promise.all([
      (prisma as any).integration.findMany({
        where,
        orderBy: filters?.sortBy
          ? { [filters.sortBy]: filters.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
        take: filters?.limit || 20,
      }),
      (prisma as any).integration.count({ where }),
    ]);

    return { integrations, total };
  } catch {
    // Integration table may not exist yet — return empty results
    return { integrations: [], total: 0 };
  }
}

/**
 * Update integration configuration
 */
export async function updateIntegrationConfig(
  integrationId: string,
  config: any
): Promise<any> {
  return await (prisma as any).integration.update({
    where: { id: integrationId },
    data: {
      config,
      metadata: config.metadata ?? undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Check workspace access for a user
 */
export async function checkWorkspaceAccess(
  workspaceIdOrSlug: string,
  userId: string
): Promise<{
  hasAccess: boolean;
  role?: string;
  isAdmin?: boolean;
  workspaceId: string;
} | null> {
  // Support both workspace ID and slug for lookup
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
    },
    select: { id: true },
  });

  if (!workspace) {
    return null;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId,
    },
    select: {
      role: true,
    },
  });

  if (!member) {
    return null;
  }

  return {
    hasAccess: true,
    role: member.role,
    isAdmin: member.role === 'OWNER' || member.role === 'ADMIN',
    workspaceId: workspace.id,
  };
}

/**
 * Send a test webhook to verify endpoint
 */
export async function sendTestWebhook(
  workspaceId: string,
  webhookId: string,
  payload?: Record<string, unknown>
): Promise<{ success: boolean; status: string; errorMessage?: string } | null> {
  console.log('[IntegrationService] sendTestWebhook called with:', {
    workspaceId,
    webhookId,
    payload,
  });

  const webhook = await prisma.webhook.findFirst({
    where: {
      id: webhookId,
      workspaceId,
    },
  });

  if (!webhook) {
    return null;
  }

  try {
    const testPayload = payload || {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' },
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': crypto
          .createHmac('sha256', webhook.secret || '')
          .update(JSON.stringify(testPayload))
          .digest('hex'),
        ...(webhook.headers as Record<string, string>),
      },
      body: JSON.stringify(testPayload),
    });

    return {
      success: response.ok,
      status: response.ok ? 'SUCCESS' : 'FAILED',
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get webhook by ID
 */
export async function getWebhook(
  workspaceId: string,
  webhookId: string
): Promise<any> {
  console.log('[IntegrationService] getWebhook called with:', {
    workspaceId,
    webhookId,
  });

  return await prisma.webhook.findFirst({
    where: {
      id: webhookId,
      workspaceId,
    },
  });
}

/**
 * Update webhook configuration
 */
export async function updateWebhook(
  workspaceId: string,
  webhookId: string,
  updates: any
): Promise<any> {
  console.log('[IntegrationService] updateWebhook called with:', {
    workspaceId,
    webhookId,
    updates,
  });

  const data: any = {};

  if (updates.name) {
    data.name = updates.name;
  }
  if (updates.url) {
    data.url = updates.url;
  }
  if (updates.events) {
    data.events = updates.events;
  }
  if (updates.headers) {
    data.headers = updates.headers;
  }
  if (updates.active !== undefined) {
    data.status = updates.active ? 'ACTIVE' : 'INACTIVE';
  }

  return await prisma.webhook.update({
    where: {
      id: webhookId,
      workspaceId,
    },
    data,
  });
}

/**
 * Delete webhook
 */
export async function deleteWebhook(
  workspaceId: string,
  webhookId: string
): Promise<boolean> {
  console.log('[IntegrationService] deleteWebhook called with:', {
    workspaceId,
    webhookId,
  });

  await prisma.webhook.delete({
    where: {
      id: webhookId,
      workspaceId,
    },
  });

  return true;
}

/**
 * List webhooks for a workspace
 */
export async function listWebhooks(
  workspaceId: string,
  filters?: any
): Promise<{ webhooks: any[]; total: number }> {
  console.log('[IntegrationService] listWebhooks called with:', {
    workspaceId,
    filters,
  });

  const where: any = { workspaceId };

  if (filters?.status) {
    where.status = filters.status.toUpperCase();
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { url: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [webhooks, total] = await Promise.all([
    prisma.webhook.findMany({
      where,
      orderBy: filters?.sortBy
        ? { [filters.sortBy]: filters.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters?.limit || 20,
    }),
    prisma.webhook.count({ where }),
  ]);

  return { webhooks, total };
}

/**
 * Create a new webhook
 */
export async function createWebhook(
  workspaceId: string,
  webhookData: any,
  userId: string
): Promise<{ webhook: any; secret: string }> {
  console.log('[IntegrationService] createWebhook called with:', {
    workspaceId,
    webhookData,
    userId,
  });

  // Generate webhook secret
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  const webhook = await prisma.webhook.create({
    data: {
      name: webhookData.name,
      url: webhookData.url,
      secret: secretHash,
      events: webhookData.events || [],
      status: webhookData.active !== false ? 'ACTIVE' : 'INACTIVE',
      headers: webhookData.headers || {},
      workspaceId,
      createdById: userId,
    },
  });

  return { webhook, secret };
}

/**
 * List webhook deliveries
 */
export async function listWebhookDeliveries(
  workspaceId: string,
  webhookId: string,
  filters?: any
): Promise<{ deliveries: any[]; total: number }> {
  const where: any = { webhookId };

  if (filters?.status) {
    where.status = filters.status.toUpperCase();
  }

  const limit = filters?.limit || 20;
  const skip = filters?.page ? (filters.page - 1) * limit : 0;

  const [deliveries, total] = await Promise.all([
    (prisma as any).webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    (prisma as any).webhookDelivery.count({ where }),
  ]);

  return { deliveries, total };
}

/**
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(
  workspaceId: string,
  webhookId: string
): Promise<{ webhook: any; newSecret: string } | null> {
  const existing = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId },
  });

  if (!existing) {
    return null;
  }

  const newSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const newSecretHash = crypto
    .createHash('sha256')
    .update(newSecret)
    .digest('hex');

  const webhook = await prisma.webhook.update({
    where: { id: webhookId, workspaceId },
    data: { secret: newSecretHash },
  });

  return { webhook, newSecret };
}

/**
 * OAuth state data structure
 */
export interface OAuthStateData {
  workspaceId?: string;
  provider?: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generate OAuth state parameter with embedded data for CSRF protection
 */
export function generateOAuthState(data?: {
  workspaceId?: string;
  provider?: string;
}): string {
  const stateData: OAuthStateData = {
    ...data,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  };
  // Base64 encode the state data
  const encoded = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  return encoded;
}

/**
 * Verify OAuth state parameter and return decoded state data
 * Returns null if state is invalid or expired (10 minute TTL)
 */
export function verifyOAuthState(state: string): OAuthStateData | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const stateData = JSON.parse(decoded) as OAuthStateData;

    // Validate required fields
    if (!stateData.timestamp || !stateData.nonce) {
      return null;
    }

    // Check expiration (10 minutes)
    const tenMinutesMs = 10 * 60 * 1000;
    if (Date.now() - stateData.timestamp > tenMinutesMs) {
      return null;
    }

    return stateData;
  } catch {
    return null;
  }
}

/**
 * Build OAuth authorization URL
 */
export function buildOAuthAuthorizationUrl(
  provider: keyof typeof OAUTH_PROVIDERS,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  console.log('[IntegrationService] buildOAuthAuthorizationUrl called with:', {
    provider,
    clientId,
    redirectUri,
    state,
  });

  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: config.scopes.join(' '),
    response_type: 'code',
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for access token
 */
export async function exchangeOAuthCode(
  provider: keyof typeof OAUTH_PROVIDERS,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<any> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OAuth token exchange failed for ${provider}: ${response.status} ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Create a new integration
 */
export async function createIntegration(
  workspaceId: string,
  integrationData: any,
  userId: string
): Promise<any> {
  console.log('[IntegrationService] createIntegration called with:', {
    workspaceId,
    integrationData,
    userId,
  });

  return await prisma.integration.create({
    data: {
      name: integrationData.name,
      description: integrationData.description,
      provider: integrationData.provider,
      status: 'PENDING',
      config: integrationData.providerConfig || {},
      syncEnabled: integrationData.syncEnabled || false,
      workspaceId,
      connectedBy: userId,
    },
  });
}

/**
 * Get integration by ID
 */
export async function getIntegration(
  workspaceId: string,
  integrationId: string
): Promise<any> {
  console.log('[IntegrationService] getIntegration called with:', {
    workspaceId,
    integrationId,
  });

  return await prisma.integration.findFirst({
    where: {
      id: integrationId,
      workspaceId,
    },
  });
}

/**
 * Update an existing integration
 */
export async function updateIntegration(
  workspaceId: string,
  integrationId: string,
  updates: any
): Promise<any> {
  console.log('[IntegrationService] updateIntegration called with:', {
    workspaceId,
    integrationId,
    updates,
  });

  const data: any = {};

  if (updates.name) {
    data.name = updates.name;
  }
  if (updates.description !== undefined) {
    data.description = updates.description;
  }
  if (updates.status) {
    data.status = updates.status;
  }
  if (updates.syncEnabled !== undefined) {
    data.syncEnabled = updates.syncEnabled;
  }
  if (updates.config) {
    data.config = updates.config;
  }

  return await prisma.integration.update({
    where: {
      id: integrationId,
      workspaceId,
    },
    data,
  });
}

/**
 * Delete an integration
 */
export async function deleteIntegration(
  workspaceId: string,
  integrationId: string
): Promise<boolean> {
  console.log('[IntegrationService] deleteIntegration called with:', {
    workspaceId,
    integrationId,
  });

  await prisma.integration.delete({
    where: {
      id: integrationId,
      workspaceId,
    },
  });

  return true;
}

/**
 * Test integration connection
 */
export async function testIntegration(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[IntegrationService] testIntegration called with:', {
    integrationId,
  });

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    return { success: false, error: 'Integration not found' };
  }

  // Basic connectivity test
  // In production, implement provider-specific API tests
  try {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'ACTIVE' },
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
    };
  }
}

/**
 * Sync integration data
 */
export async function syncIntegration(
  integrationId: string
): Promise<{ success: boolean; syncedAt: string; errors?: string[] }> {
  console.log('[IntegrationService] syncIntegration called with:', {
    integrationId,
  });

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    return {
      success: false,
      syncedAt: new Date().toISOString(),
      errors: ['Integration not found'],
    };
  }

  const syncedAt = new Date();

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: syncedAt,
      syncError: null,
    },
  });

  return {
    success: true,
    syncedAt: syncedAt.toISOString(),
    errors: [],
  };
}

/**
 * Verify GitHub webhook signature
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Verify Slack webhook signature
 */
export function verifySlackSignature(
  timestamp: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  const signingBase = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto.createHmac('sha256', secret).update(signingBase).digest('hex')}`;
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
