/**
 * AI Configuration API Routes
 *
 * Manages AI/ML configuration settings for a workspace.
 * Stores configuration in workspace.settings.aiConfig JSON field.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/ai-config - Get AI configuration
 * - PATCH /api/workspaces/:workspaceId/ai-config - Update AI configuration
 *
 * @module app/api/workspaces/[workspaceId]/ai-config/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Zod schema for AI Configuration validation
 */
const aiConfigSchema = z.object({
  defaultModel: z.string().default('claude-3-opus'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  systemPrompt: z.string().nullable().default(null),
  customPrompts: z.record(z.string()).default({}),
  enabledFeatures: z.array(z.string()).default([
    'summarization',
    'suggestions',
    'codeCompletion',
    'autoTagging'
  ]),
  rateLimits: z.object({
    requestsPerMinute: z.number().default(60),
    tokensPerDay: z.number().default(100000),
  }).default({
    requestsPerMinute: 60,
    tokensPerDay: 100000,
  }),
});

/**
 * AI Configuration type
 */
type AIConfig = z.infer<typeof aiConfigSchema>;

/**
 * Response structure for AI configuration
 */
interface AIConfigResponse {
  id: string;
  workspaceId: string;
  config: AIConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/workspaces/:workspaceId/ai-config
 *
 * Fetches AI configuration from workspace settings.
 *
 * @param _request - Next.js request (unused)
 * @param context - Route context containing workspace ID
 * @returns AI configuration object
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<{ data: AIConfigResponse } | { error: string }>> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Fetch workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Extract aiConfig from settings, apply defaults if not set
    const settings = workspace.settings as Record<string, unknown> | null;
    const rawAiConfig = settings && typeof settings === 'object' && 'aiConfig' in settings
      ? settings.aiConfig
      : {};
    const aiConfig = aiConfigSchema.parse(rawAiConfig);

    const response: AIConfigResponse = {
      id: workspace.id,
      workspaceId: workspace.id,
      config: aiConfig,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/ai-config] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/ai-config
 *
 * Updates AI configuration in workspace settings.
 * Only ADMIN and OWNER roles can update configuration.
 *
 * @param request - Next.js request with JSON body containing config updates
 * @param context - Route context containing workspace ID
 * @returns Updated configuration object
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<{ data: AIConfigResponse } | { error: string }>> {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify workspace access and admin permissions
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Only ADMIN and OWNER can update AI configuration
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can update AI configuration' },
        { status: 403 },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    // Validate with Zod schema (partial update allowed)
    const updateSchema = aiConfigSchema.partial();
    const validatedConfig = updateSchema.parse(body);

    // Get current workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Merge with existing config
    const currentSettings = workspace.settings as Record<string, unknown> | null;
    const currentConfig =
      currentSettings && typeof currentSettings === 'object' && 'aiConfig' in currentSettings
        ? (currentSettings.aiConfig as Partial<AIConfig>)
        : {};
    const mergedConfig = { ...currentConfig, ...validatedConfig };

    // Update workspace settings
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...(currentSettings || {}),
          aiConfig: mergedConfig,
        },
        updatedAt: new Date(),
      },
      select: {
        id: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Parse final config with defaults
    const finalSettings = updatedWorkspace.settings as Record<string, unknown> | null;
    const rawFinalConfig =
      finalSettings && typeof finalSettings === 'object' && 'aiConfig' in finalSettings
        ? finalSettings.aiConfig
        : {};
    const finalConfig = aiConfigSchema.parse(rawFinalConfig);

    const response: AIConfigResponse = {
      id: updatedWorkspace.id,
      workspaceId: updatedWorkspace.id,
      config: finalConfig,
      createdAt: updatedWorkspace.createdAt.toISOString(),
      updatedAt: updatedWorkspace.updatedAt.toISOString(),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/ai-config] Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
