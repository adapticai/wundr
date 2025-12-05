/**
 * Channel AI Assistant API Route
 *
 * Provides AI-powered features for channels including:
 * - Channel summarization
 * - Message suggestions
 * - Contextual assistance
 *
 * Routes:
 * - POST /api/channels/:channelId/ai - Stream AI responses for channel assistance
 *
 * @module app/api/channels/[channelId]/ai/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@neolith/database';
import { convertToModelMessages, streamText } from 'ai';

import { auth } from '@/lib/auth';

import type { UIMessage } from '@ai-sdk/react';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Helper to check if user has access to channel
 */
async function checkChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      OR: [
        { type: 'PUBLIC' },
        {
          channelMembers: {
            some: {
              userId,
            },
          },
        },
      ],
    },
  });

  return !!channel;
}

/**
 * Fetch recent messages for context
 */
async function getRecentMessages(channelId: string, limit: number = 50) {
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return messages.reverse(); // Return in chronological order
}

/**
 * Generate system prompt based on action type
 */
function getSystemPrompt(
  action: string,
  channelName: string,
  channelDescription: string | null
): string {
  const baseContext = `You are an AI assistant for the "${channelName}" channel${channelDescription ? ` (${channelDescription})` : ''}.`;

  switch (action) {
    case 'summarize':
      return `${baseContext}
Your task is to provide a concise, helpful summary of the recent channel activity.

Guidelines:
- Identify key topics and discussions
- Highlight important decisions or action items
- Note any unresolved questions or ongoing discussions
- Keep the summary clear and actionable
- Use bullet points for better readability
- Mention relevant participants when helpful`;

    case 'suggest':
      return `${baseContext}
Your task is to suggest helpful messages or responses based on the conversation context.

Guidelines:
- Provide 2-3 relevant message suggestions
- Match the tone of the conversation
- Make suggestions actionable and context-appropriate
- Keep suggestions concise and professional
- Consider the flow of the discussion`;

    case 'chat':
    default:
      return `${baseContext}
You are a helpful AI assistant for this channel. You can:
- Answer questions about the channel's discussion history
- Provide insights about the conversation
- Help users find information
- Suggest relevant actions or responses

Be concise, helpful, and context-aware. Use the message history to provide informed responses.`;
  }
}

/**
 * Format messages for context
 */
function formatMessagesForContext(
  messages: Array<{
    content: string;
    author: { name: string | null; email: string };
    createdAt: Date;
  }>
): string {
  if (messages.length === 0) {
    return 'No messages in this channel yet.';
  }

  return messages
    .map(msg => {
      const author = msg.author.name || msg.author.email;
      const timestamp = msg.createdAt.toLocaleString();
      return `[${timestamp}] ${author}: ${msg.content}`;
    })
    .join('\n');
}

/**
 * POST /api/channels/:channelId/ai
 *
 * Stream AI assistance for channel-related queries
 *
 * @param req - Next.js request with messages and action type
 * @param context - Route context with channelId
 * @returns Streaming AI response
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get channel ID from params
    const { channelId } = await context.params;

    // Verify channel access
    const hasAccess = await checkChannelAccess(channelId, session.user.id);
    if (!hasAccess) {
      return new Response('Access denied', { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { messages: uiMessages, action = 'chat' } = body as {
      messages: UIMessage[];
      action?: 'summarize' | 'suggest' | 'chat';
    };

    // Validate messages
    if (!Array.isArray(uiMessages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get channel details
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        name: true,
        description: true,
      },
    });

    if (!channel) {
      return new Response('Channel not found', { status: 404 });
    }

    // Fetch recent messages for context
    const recentMessages = await getRecentMessages(channelId);
    const messageContext = formatMessagesForContext(recentMessages);

    // Build system prompt
    const systemPrompt = getSystemPrompt(
      action,
      channel.name,
      channel.description
    );

    // Add context message about recent channel activity
    const contextMessage = `Recent channel activity (${recentMessages.length} messages):\n${messageContext}`;

    // Convert UI messages to model messages
    const modelMessages = convertToModelMessages(uiMessages);

    // Prepend context as system message if this is a summarization or first chat
    if (action === 'summarize' || modelMessages.length === 0) {
      modelMessages.unshift({
        role: 'user',
        content: contextMessage,
      });
    }

    // Determine provider
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    // Validate API keys
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[POST /api/channels/:channelId/ai] OPENAI_API_KEY not configured'
      );
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[POST /api/channels/:channelId/ai] ANTHROPIC_API_KEY not configured'
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

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/channels/:channelId/ai] Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'An internal error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
