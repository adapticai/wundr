/**
 * Channel Summarization API Route
 *
 * Generates AI-powered summaries of channel conversations for quick context understanding.
 * Supports time-based filtering and caching for performance.
 *
 * Routes:
 * - GET /api/channels/:channelId/summarize - Generate channel summary
 * - POST /api/channels/:channelId/summarize - Generate summary with streaming
 *
 * Query Parameters:
 * - timeRange: 'hour' | 'today' | 'week' | 'custom' (default: 'today')
 * - since: ISO timestamp for custom range start
 * - until: ISO timestamp for custom range end
 * - limit: Max messages to analyze (default: 100, max: 500)
 * - stream: Enable streaming response (default: false)
 *
 * @module app/api/channels/[channelId]/summarize/route
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@neolith/database';
import { streamText, generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Time range presets for message filtering
 */
const TIME_RANGES = {
  hour: 60 * 60 * 1000, // 1 hour in ms
  today: 24 * 60 * 60 * 1000, // 24 hours in ms
  week: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
} as const;

/**
 * Query parameter schema
 */
const summarizeQuerySchema = z.object({
  timeRange: z.enum(['hour', 'today', 'week', 'custom']).default('today'),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  stream: z.coerce.boolean().default(false),
});

type SummarizeQuery = z.infer<typeof summarizeQuerySchema>;

/**
 * Cache key generation for summaries
 */
function generateCacheKey(
  channelId: string,
  timeRange: string,
  since?: string,
  until?: string,
): string {
  const params = [channelId, timeRange, since, until].filter(Boolean).join(':');
  return `channel:summary:${params}`;
}

/**
 * Simple in-memory cache for summaries (TTL: 5 minutes)
 * In production, replace with Redis or similar
 */
const summaryCache = new Map<
  string,
  { summary: string; timestamp: number; messageCount: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached summary if available and not expired
 */
function getCachedSummary(cacheKey: string) {
  const cached = summaryCache.get(cacheKey);
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
  if (isExpired) {
    summaryCache.delete(cacheKey);
    return null;
  }

  return cached;
}

/**
 * Store summary in cache
 */
function setCachedSummary(
  cacheKey: string,
  summary: string,
  messageCount: number,
) {
  summaryCache.set(cacheKey, {
    summary,
    timestamp: Date.now(),
    messageCount,
  });

  // Cleanup old entries (simple LRU: keep only last 100)
  if (summaryCache.size > 100) {
    const oldestKey = summaryCache.keys().next().value;
    if (oldestKey) {
      summaryCache.delete(oldestKey);
    }
  }
}

/**
 * Calculate time range boundaries
 */
function getTimeRangeBoundaries(query: SummarizeQuery): {
  since: Date;
  until: Date;
} {
  const now = new Date();

  if (query.timeRange === 'custom') {
    return {
      since: query.since ? new Date(query.since) : new Date(0),
      until: query.until ? new Date(query.until) : now,
    };
  }

  const rangeMs = TIME_RANGES[query.timeRange];
  return {
    since: new Date(now.getTime() - rangeMs),
    until: now,
  };
}

/**
 * Helper function to check if user is a member of the channel
 */
async function checkChannelMembership(channelId: string, userId: string) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
          workspaceId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * Fetch messages for summarization
 */
async function fetchMessagesForSummary(
  channelId: string,
  since: Date,
  until: Date,
  limit: number,
) {
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      isDeleted: false,
      createdAt: {
        gte: since,
        lte: until,
      },
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
          displayName: true,
          isOrchestrator: true,
        },
      },
      _count: {
        select: {
          replies: true,
        },
      },
    },
  });

  // Return in chronological order for better summarization
  return messages.reverse();
}

/**
 * Format messages for AI summarization
 */
function formatMessagesForAI(
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: {
      name: string | null;
      displayName: string | null;
      isOrchestrator: boolean;
    };
    _count: {
      replies: number;
    };
  }>,
  channelName: string,
): string {
  if (messages.length === 0) {
    return `No messages in the specified time range for channel "${channelName}".`;
  }

  const formattedMessages = messages
    .map(msg => {
      const authorName = msg.author.displayName || msg.author.name || 'Unknown';
      const authorType = msg.author.isOrchestrator ? ' (AI)' : '';
      const timestamp = msg.createdAt.toLocaleString();
      const replyInfo =
        msg._count.replies > 0 ? ` [${msg._count.replies} replies]` : '';

      return `[${timestamp}] ${authorName}${authorType}${replyInfo}: ${msg.content}`;
    })
    .join('\n');

  return `Channel: ${channelName}\nMessages (${messages.length} total):\n\n${formattedMessages}`;
}

/**
 * Generate system prompt for summarization
 */
function getSystemPrompt(
  channelName: string,
  timeRange: string,
  messageCount: number,
): string {
  return `You are an AI assistant helping users understand channel conversations at a glance.

Your task is to summarize the conversation in the channel "${channelName}" based on ${messageCount} messages from the ${timeRange === 'custom' ? 'specified time period' : `last ${timeRange}`}.

Generate a concise, structured summary that includes:

1. **Main Topics**: Key themes or subjects discussed (2-4 bullet points)
2. **Key Decisions**: Important decisions made or action items identified
3. **Active Participants**: Who were the main contributors (mention 2-3 key participants)
4. **Highlights**: Notable insights, questions, or important information shared
5. **Sentiment**: Overall tone of the conversation (collaborative, technical, casual, etc.)

Guidelines:
- Be concise but informative
- Highlight actionable items or decisions
- Note any AI orchestrator contributions separately if present
- Use bullet points for readability
- Avoid verbatim quotes unless particularly significant
- If the conversation is minimal or off-topic, say so clearly

Keep the summary under 500 words.`;
}

/**
 * GET /api/channels/:channelId/summarize
 *
 * Generate a summary of channel messages.
 * Returns cached summary if available and not expired.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing channel ID
 * @returns Summary object with metadata
 *
 * @example
 * ```
 * GET /api/channels/ch_123/summarize?timeRange=today&limit=100
 * ```
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
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = summarizeQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query = queryResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(
      params.channelId,
      query.timeRange,
      query.since,
      query.until,
    );

    // Check cache
    const cached = getCachedSummary(cacheKey);
    if (cached) {
      return NextResponse.json({
        data: {
          summary: cached.summary,
          metadata: {
            channelId: params.channelId,
            channelName: membership.channel.name,
            timeRange: query.timeRange,
            messageCount: cached.messageCount,
            cached: true,
            generatedAt: new Date(cached.timestamp).toISOString(),
          },
        },
      });
    }

    // Calculate time boundaries
    const { since, until } = getTimeRangeBoundaries(query);

    // Fetch messages
    const messages = await fetchMessagesForSummary(
      params.channelId,
      since,
      until,
      query.limit,
    );

    if (messages.length === 0) {
      const noMessagesSummary = `No messages found in the ${query.timeRange === 'custom' ? 'specified time period' : `last ${query.timeRange}`}. The channel appears to be quiet during this time.`;

      return NextResponse.json({
        data: {
          summary: noMessagesSummary,
          metadata: {
            channelId: params.channelId,
            channelName: membership.channel.name,
            timeRange: query.timeRange,
            messageCount: 0,
            cached: false,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Format messages for AI
    const messagesText = formatMessagesForAI(
      messages,
      membership.channel.name,
    );

    // Determine which model to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    // Validate API key for selected provider
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[GET /api/channels/:channelId/summarize] OPENAI_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'AI service not configured',
          MESSAGE_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[GET /api/channels/:channelId/summarize] ANTHROPIC_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'AI service not configured',
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

    // Generate summary using AI
    const systemPrompt = getSystemPrompt(
      membership.channel.name,
      query.timeRange,
      messages.length,
    );

    const { text: summary } = await generateText({
      model,
      system: systemPrompt,
      prompt: messagesText,
    });

    // Cache the summary
    setCachedSummary(cacheKey, summary, messages.length);

    return NextResponse.json({
      data: {
        summary,
        metadata: {
          channelId: params.channelId,
          channelName: membership.channel.name,
          timeRange: query.timeRange,
          since: since.toISOString(),
          until: until.toISOString(),
          messageCount: messages.length,
          cached: false,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/summarize] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/channels/:channelId/summarize
 *
 * Generate a streaming summary of channel messages.
 * Returns a streaming AI response for real-time summary generation.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing channel ID
 * @returns Streaming AI response
 *
 * @example
 * ```
 * POST /api/channels/ch_123/summarize
 * Content-Type: application/json
 *
 * {
 *   "timeRange": "today",
 *   "limit": 100
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // If no body, use query params
      body = Object.fromEntries(request.nextUrl.searchParams);
    }

    // Validate query parameters
    const queryResult = summarizeQuerySchema.safeParse(body);
    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query = queryResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Calculate time boundaries
    const { since, until } = getTimeRangeBoundaries(query);

    // Fetch messages
    const messages = await fetchMessagesForSummary(
      params.channelId,
      since,
      until,
      query.limit,
    );

    if (messages.length === 0) {
      const noMessagesSummary = `No messages found in the ${query.timeRange === 'custom' ? 'specified time period' : `last ${query.timeRange}`}. The channel appears to be quiet during this time.`;

      return new Response(noMessagesSummary, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Format messages for AI
    const messagesText = formatMessagesForAI(
      messages,
      membership.channel.name,
    );

    // Determine which model to use
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';

    // Validate API key
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      console.error(
        '[POST /api/channels/:channelId/summarize] OPENAI_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'AI service not configured',
          MESSAGE_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }
    if (provider !== 'openai' && !process.env.ANTHROPIC_API_KEY) {
      console.error(
        '[POST /api/channels/:channelId/summarize] ANTHROPIC_API_KEY not configured',
      );
      return NextResponse.json(
        createErrorResponse(
          'AI service not configured',
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

    // Generate streaming summary
    const systemPrompt = getSystemPrompt(
      membership.channel.name,
      query.timeRange,
      messages.length,
    );

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: messagesText,
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/channels/:channelId/summarize] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
