/**
 * Orchestrator AI Chat API Route
 *
 * Provides AI-powered chat interface for orchestrators including:
 * - Interactive chat with orchestrator context
 * - Configuration assistance
 * - Charter guidance
 * - Capability recommendations
 *
 * Routes:
 * - POST /api/orchestrators/:orchestratorId/ai - Stream AI responses for orchestrator chat
 *
 * @module app/api/orchestrators/[orchestratorId]/ai/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@neolith/database';
import { convertToModelMessages, streamText } from 'ai';

import { auth } from '@/lib/auth';

import type { UIMessage } from '@ai-sdk/react';

/**
 * Route context with orchestrator ID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper to check if user owns orchestrator
 */
async function checkOrchestratorAccess(orchestratorId: string, userId: string) {
  const orchestrator = await prisma.orchestrator.findFirst({
    where: {
      id: orchestratorId,
      userId,
    },
  });

  return !!orchestrator;
}

/**
 * Get orchestrator details for context
 */
async function getOrchestratorContext(orchestratorId: string) {
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      _count: {
        select: {
          sessionManagers: true,
        },
      },
      config: true,
      charterVersions: {
        orderBy: {
          version: 'desc',
        },
        take: 1,
      },
    },
  });

  return orchestrator;
}

/**
 * Generate system prompt for orchestrator chat
 */
function getSystemPrompt(
  role: string,
  discipline: string,
  capabilities: any,
  charter: any,
  config: any,
  sessionManagerCount: number
): string {
  const baseContext = `You are an AI assistant helping manage the "${role}" orchestrator${discipline ? ` specializing in ${discipline}` : ''}.`;

  // Parse capabilities from JSON
  const capabilitiesList = Array.isArray(capabilities)
    ? capabilities
    : typeof capabilities === 'string'
      ? JSON.parse(capabilities)
      : [];

  const orchestratorInfo = `

## Orchestrator Information

**Role**: ${role}
**Discipline**: ${discipline || 'Not specified'}
**Session Managers**: ${sessionManagerCount}
**Capabilities**: ${capabilitiesList.length > 0 ? capabilitiesList.join(', ') : 'None configured'}

${
  charter
    ? `
## Charter

**Mission**: ${charter.mission}
**Vision**: ${charter.vision}
**Values**: ${charter.values?.join(', ') || 'Not defined'}
${charter.expertise ? `**Expertise**: ${charter.expertise.join(', ')}` : ''}

## Communication Preferences
- **Tone**: ${charter.communicationPreferences?.tone || 'Professional'}
- **Response Length**: ${charter.communicationPreferences?.responseLength || 'Balanced'}
- **Formality**: ${charter.communicationPreferences?.formality || 'Medium'}

## Operational Settings
${charter.operationalSettings?.workHours ? `- **Work Hours**: ${charter.operationalSettings.workHours.start} - ${charter.operationalSettings.workHours.end} (${charter.operationalSettings.workHours.timezone})` : ''}
${charter.operationalSettings?.responseTimeTarget ? `- **Response Target**: ${charter.operationalSettings.responseTimeTarget} minutes` : ''}
${charter.operationalSettings?.autoEscalation !== undefined ? `- **Auto-Escalation**: ${charter.operationalSettings.autoEscalation ? 'Enabled' : 'Disabled'}` : ''}
`
    : '**Charter**: Not configured yet'
}

${
  config
    ? `
## Configuration

- **Auto Reply**: ${config.autoReply ? 'Enabled' : 'Disabled'}
- **Reply Delay**: ${config.replyDelay}ms
- **Mention Only**: ${config.mentionOnly ? 'Yes' : 'No'}
${config.maxDailyActions ? `- **Max Daily Actions**: ${config.maxDailyActions}` : ''}
${config.maxHourlyActions ? `- **Max Hourly Actions**: ${config.maxHourlyActions}` : ''}
${config.watchedChannels?.length > 0 ? `- **Watched Channels**: ${config.watchedChannels.length}` : ''}
${config.keywordTriggers?.length > 0 ? `- **Keyword Triggers**: ${config.keywordTriggers.join(', ')}` : ''}
`
    : ''
}
`;

  return `${baseContext}

${orchestratorInfo}

## Your Role

You can help with:
- Explaining the orchestrator's configuration and capabilities
- Suggesting improvements to the charter, mission, or values
- Recommending new capabilities based on the discipline
- Advising on communication preferences and operational settings
- Answering questions about how to best configure this orchestrator
- Providing guidance on Session Manager setup and subagent coordination
- Optimizing triggers, rate limits, and automation settings

Be helpful, context-aware, and provide actionable advice. Reference the orchestrator's existing configuration when making suggestions.`;
}

/**
 * POST /api/orchestrators/:orchestratorId/ai
 *
 * Stream AI chat responses for orchestrator management
 *
 * @param req - Next.js request with messages
 * @param context - Route context with orchestratorId
 * @returns Streaming AI response
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get orchestrator ID from params
    const { orchestratorId } = await context.params;

    // Verify orchestrator access
    const hasAccess = await checkOrchestratorAccess(
      orchestratorId,
      session.user.id
    );
    if (!hasAccess) {
      return new Response('Access denied', { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { messages: uiMessages } = body as {
      messages: UIMessage[];
    };

    // Validate messages
    if (!Array.isArray(uiMessages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get orchestrator details
    const orchestrator = await getOrchestratorContext(orchestratorId);

    if (!orchestrator) {
      return new Response('Orchestrator not found', { status: 404 });
    }

    // Extract charter from latest version
    const latestCharter =
      orchestrator.charterVersions.length > 0
        ? orchestrator.charterVersions[0].charterData
        : null;

    // Build system prompt with orchestrator context
    const systemPrompt = getSystemPrompt(
      orchestrator.role,
      orchestrator.discipline,
      orchestrator.capabilities,
      latestCharter,
      orchestrator.config,
      orchestrator._count.sessionManagers
    );

    // Convert UI messages to model messages
    const modelMessages = convertToModelMessages(uiMessages);

    // Determine provider
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    // Validate API keys
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[POST /api/orchestrators/:orchestratorId/ai] OPENAI_API_KEY not configured'
      );
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[POST /api/orchestrators/:orchestratorId/ai] ANTHROPIC_API_KEY not configured'
      );
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Select model
    const model =
      provider === 'openai'
        ? openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')
        : anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
    });

    // Return streaming response in AI SDK UI message stream format (for useChat/DefaultChatTransport)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[POST /api/orchestrators/:orchestratorId/ai] Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An internal error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
