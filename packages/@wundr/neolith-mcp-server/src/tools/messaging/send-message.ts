/**
 * Send Message Tool
 *
 * Sends a message to a channel in Neolith.
 * Supports text messages with optional file attachments and mentions.
 *
 * @module tools/messaging/send-message
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for sending a message
 */
export const SendMessageSchema = z.object({
  channelId: z.string().describe('ID of the channel to send the message to'),
  content: z.string().min(1).max(4000).describe('Message content (1-4000 characters)'),
  parentId: z.string().optional().describe('Optional parent message ID for thread replies'),
  mentions: z.array(z.string()).optional().describe('Array of user IDs to mention'),
  attachmentIds: z.array(z.string()).optional().describe('Array of file IDs to attach (pre-uploaded files)'),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

/**
 * Send a message to a channel
 *
 * @param input - Message data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with created message
 *
 * @example
 * ```typescript
 * const result = await sendMessageHandler({
 *   channelId: 'ch_123',
 *   content: 'Hello, team!',
 *   mentions: ['user_456']
 * }, apiClient);
 * ```
 */
export async function sendMessageHandler(
  input: SendMessageInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = SendMessageSchema.parse(input);

    // Prepare FormData for the API request
    const formData = new FormData();
    formData.append('content', validatedInput.content);
    formData.append('channelId', validatedInput.channelId);

    if (validatedInput.parentId) {
      formData.append('parentId', validatedInput.parentId);
    }

    if (validatedInput.mentions && validatedInput.mentions.length > 0) {
      formData.append('mentions', JSON.stringify(validatedInput.mentions));
    }

    if (validatedInput.attachmentIds && validatedInput.attachmentIds.length > 0) {
      formData.append('attachmentIds', JSON.stringify(validatedInput.attachmentIds));
    }

    // Send message via API
    const response = await apiClient.post('/api/messages', formData);

    return {
      success: true,
      data: response,
      message: 'Message sent successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
