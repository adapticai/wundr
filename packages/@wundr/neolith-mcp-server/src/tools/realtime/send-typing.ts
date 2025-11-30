/**
 * Send Typing Indicator Tool
 *
 * Sends a typing indicator to a channel to show that the user (or orchestrator) is composing a message.
 * Auto-expires after 3 seconds if not refreshed.
 *
 * @module tools/realtime/send-typing
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for sending typing indicator
 */
export const SendTypingSchema = z.object({
  channelId: z.string().describe('ID of the channel to send typing indicator to'),
  userId: z.string().optional().describe('ID of the user typing (defaults to authenticated user)'),
  isTyping: z.boolean().default(true).describe('Whether user is typing (true) or stopped typing (false)'),
  metadata: z
    .object({
      sourceType: z.enum(['user', 'orchestrator', 'subagent']).optional().describe('Source of the typing indicator'),
      sourceId: z.string().optional().describe('ID of the source (orchestrator ID, subagent ID, etc.)'),
      composingMessageType: z.enum(['text', 'thread_reply', 'file_upload']).optional().describe('Type of message being composed'),
    })
    .optional()
    .describe('Optional metadata about the typing action'),
});

export type SendTypingInput = z.infer<typeof SendTypingSchema>;

/**
 * Response data for typing indicator
 */
export interface TypingResponse {
  /** Channel ID */
  channelId: string;
  /** User ID who is typing */
  userId: string;
  /** Whether typing indicator was set or cleared */
  isTyping: boolean;
  /** Timestamp when indicator was sent */
  timestamp: string;
  /** Auto-expiry time in seconds */
  expiresIn: number;
  /** Current typing users in the channel */
  currentTypingUsers: Array<{
    userId: string;
    displayName: string;
    startedAt: string;
  }>;
}

/**
 * Send typing indicator to a channel
 *
 * @param input - Typing indicator data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with typing status
 *
 * @example
 * ```typescript
 * // Start typing
 * const result = await sendTypingHandler({
 *   channelId: 'ch_123',
 *   isTyping: true,
 *   metadata: {
 *     sourceType: 'orchestrator',
 *     sourceId: 'orch_456'
 *   }
 * }, apiClient);
 *
 * // Stop typing
 * const result = await sendTypingHandler({
 *   channelId: 'ch_123',
 *   isTyping: false
 * }, apiClient);
 * ```
 */
export async function sendTypingHandler(
  input: SendTypingInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = SendTypingSchema.parse(input);

    // Prepare typing indicator request
    const typingData = {
      channelId: validatedInput.channelId,
      userId: validatedInput.userId,
      isTyping: validatedInput.isTyping,
      metadata: {
        sourceType: validatedInput.metadata?.sourceType || 'user',
        sourceId: validatedInput.metadata?.sourceId,
        composingMessageType: validatedInput.metadata?.composingMessageType || 'text',
        timestamp: new Date().toISOString(),
      },
      // Typing indicators auto-expire after 3 seconds
      expiresIn: 3,
    };

    // Send typing indicator via WebSocket API endpoint
    const response = await apiClient.post(
      '/api/realtime/typing',
      typingData
    ) as TypingResponse;

    const action = validatedInput.isTyping ? 'started' : 'stopped';
    const message = validatedInput.isTyping
      ? `Typing indicator sent (auto-expires in ${response.expiresIn}s)`
      : 'Typing indicator cleared';

    return {
      success: true,
      data: response,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send typing indicator';

    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        code: 'TYPING_ERROR',
        message: errorMessage,
        context: { channelId: input.channelId },
      },
    };
  }
}

/**
 * Helper function to send typing start
 */
export async function startTyping(
  channelId: string,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> },
  metadata?: SendTypingInput['metadata']
): Promise<McpToolResult> {
  return sendTypingHandler(
    {
      channelId,
      isTyping: true,
      metadata,
    },
    apiClient
  );
}

/**
 * Helper function to send typing stop
 */
export async function stopTyping(
  channelId: string,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> },
  userId?: string
): Promise<McpToolResult> {
  return sendTypingHandler(
    {
      channelId,
      isTyping: false,
      userId,
    },
    apiClient
  );
}
