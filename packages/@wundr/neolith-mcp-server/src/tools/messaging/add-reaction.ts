/**
 * Add Reaction Tool
 *
 * Adds an emoji reaction to a message.
 *
 * @module tools/messaging/add-reaction
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for adding a reaction
 */
export const AddReactionSchema = z.object({
  messageId: z.string().describe('ID of the message to react to'),
  emoji: z.string().min(1).describe('Emoji to react with (e.g., "thumbsup", "heart", "fire")'),
});

export type AddReactionInput = z.infer<typeof AddReactionSchema>;

/**
 * Add a reaction to a message
 *
 * @param input - Reaction data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with created reaction
 *
 * @example
 * ```typescript
 * const result = await addReactionHandler({
 *   messageId: 'msg_123',
 *   emoji: 'thumbsup'
 * }, apiClient);
 * ```
 */
export async function addReactionHandler(
  input: AddReactionInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = AddReactionSchema.parse(input);

    // Prepare request body
    const requestBody = {
      emoji: validatedInput.emoji,
    };

    // Add reaction via API
    const response = await apiClient.post(
      `/api/messages/${validatedInput.messageId}/reactions`,
      requestBody
    );

    return {
      success: true,
      data: response,
      message: 'Reaction added successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add reaction',
    };
  }
}
