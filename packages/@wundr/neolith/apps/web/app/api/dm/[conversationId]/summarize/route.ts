/**
 * DM Conversation Summarization API Route (Streaming)
 *
 * LLM-powered streaming summarization of direct message conversations.
 * Uses Vercel AI SDK to generate intelligent summaries of conversation history.
 *
 * Routes:
 * - POST /api/dm/:conversationId/summarize - Stream AI summary of DM conversation
 *
 * @module app/api/dm/[conversationId]/summarize/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@neolith/database';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { NextRequest } from 'next/server';

/**
 * Route context with conversation ID parameter
 */
interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

/**
 * Time period options for summarization
 */
const TIME_PERIODS = {
  '1h': 1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: null,
} as const;

type TimePeriod = keyof typeof TIME_PERIODS;

/**
 * Helper function to check if user is a member of the conversation
 */
async function checkConversationMembership(
  conversationId: string,
  userId: string,
) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId: conversationId,
        userId,
      },
    },
    include: {
      channel: {
        select: {
          id: true,
          type: true,
          workspaceId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * Format messages for AI summarization
 */
function formatMessagesForSummary(
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: {
      id: string;
      name: string | null;
      displayName: string | null;
      isOrchestrator: boolean;
    } | null;
    messageAttachments: Array<{
      file: {
        filename: string;
        mimeType: string | null;
      } | null;
    }>;
  }>,
): string {
  return messages
    .map(msg => {
      const authorName =
        msg.author?.displayName ||
        msg.author?.name ||
        (msg.author?.isOrchestrator ? 'AI Assistant' : 'Unknown');
      const timestamp = msg.createdAt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      let content = `[${timestamp}] ${authorName}: ${msg.content}`;

      // Add attachment info if present
      if (msg.messageAttachments && msg.messageAttachments.length > 0) {
        const attachmentNames = msg.messageAttachments
          .filter(a => a.file)
          .map(a => a.file!.filename)
          .join(', ');
        if (attachmentNames) {
          content += ` [Attachments: ${attachmentNames}]`;
        }
      }

      return content;
    })
    .join('\n');
}

/**
 * Generate system prompt for summarization
 */
function getSummarizationPrompt(
  messageCount: number,
  timePeriod: TimePeriod,
): string {
  const timeDesc =
    timePeriod === 'all'
      ? 'entire conversation history'
      : timePeriod === '1h'
        ? 'last hour'
        : timePeriod === '24h'
          ? 'last 24 hours'
          : timePeriod === '7d'
            ? 'last 7 days'
            : 'last 30 days';

  return `You are an intelligent conversation summarizer. Your task is to analyze and summarize direct message conversations.

Context: This is a summary of ${messageCount} messages from the ${timeDesc}.

Please provide a comprehensive summary that includes:

1. **Main Topics**: Key subjects discussed (2-4 bullet points)
2. **Key Points**: Important information, decisions, or agreements (3-5 bullet points)
3. **Action Items**: Any tasks, to-dos, or follow-ups mentioned (if any)
4. **Notable Attachments**: Files or media shared (if any)
5. **Sentiment**: Overall tone of the conversation (brief)

Format your response in clear, concise markdown. Focus on the most important information and maintain context.
Be objective and avoid editorializing. If there are no messages or minimal content, simply state that.`;
}

/**
 * POST /api/dm/:conversationId/summarize
 *
 * Generate a streaming AI summary of a DM conversation.
 * Supports different time periods for focused summaries.
 *
 * @param request - Next.js request with summarization options
 * @param context - Route context containing conversation ID
 * @returns Streaming AI summary
 *
 * @example
 * ```
 * POST /api/dm/ch_123/summarize
 * Content-Type: application/json
 *
 * {
 *   "period": "24h",
 *   "maxMessages": 100
 * }
 *
 * Response: Streaming text summary
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse | Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { conversationId } = params;

    // Parse request body
    let body: { period?: TimePeriod; maxMessages?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Use defaults if no body provided
    }

    const period: TimePeriod = body.period || '24h';
    const maxMessages = Math.min(body.maxMessages || 200, 500); // Cap at 500

    // Validate period
    if (!TIME_PERIODS.hasOwnProperty(period)) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid period. Must be one of: ${Object.keys(TIME_PERIODS).join(', ')}`,
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check conversation membership
    const membership = await checkConversationMembership(
      conversationId,
      session.user.id,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this conversation',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Build time filter
    const timeFilter =
      TIME_PERIODS[period] !== null
        ? {
            createdAt: {
              gte: new Date(Date.now() - TIME_PERIODS[period]!),
            },
          }
        : {};

    // Fetch messages from the conversation
    const messages = await prisma.message.findMany({
      where: {
        channelId: conversationId,
        isDeleted: false,
        parentId: null, // Only top-level messages, not thread replies
        ...timeFilter,
      },
      take: maxMessages,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            isOrchestrator: true,
          },
        },
        messageAttachments: {
          include: {
            file: {
              select: {
                filename: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    // Reverse to chronological order
    messages.reverse();

    // Check if there are messages to summarize
    if (messages.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'No messages found in the specified time period',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Format messages for AI
    const conversationText = formatMessagesForSummary(messages);
    const systemPrompt = getSummarizationPrompt(messages.length, period);

    // Select AI provider and model
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
    console.log(
      `[POST /api/dm/:conversationId/summarize] Using provider: ${provider}`,
    );

    // Validate API key
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[POST /api/dm/:conversationId/summarize] OPENAI_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'OpenAI API key not configured',
          MESSAGE_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[POST /api/dm/:conversationId/summarize] ANTHROPIC_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'Anthropic API key not configured',
          MESSAGE_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Select model
    const model =
      provider === 'openai'
        ? openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')
        : anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');

    // Stream the summary
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: `Please summarize this conversation:\n\n${conversationText}`,
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/dm/:conversationId/summarize] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        error instanceof Error ? error.message : 'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
