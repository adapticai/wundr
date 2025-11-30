/**
 * Remove Reaction Tool
 *
 * Removes an emoji reaction from a message (user can only remove their own reactions).
 *
 * @module tools/messaging/remove-reaction
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for removing a reaction
 */
export const RemoveReactionSchema = z.object({
  messageId: z.string().describe('ID of the message'),
  emoji: z.string().min(1).describe('Emoji to remove (e.g., "thumbsup", "heart", "fire")'),
});

export type RemoveReactionInput = z.infer<typeof RemoveReactionSchema>;

/**
 * Remove a reaction from a message
 *
 * @param input - Reaction removal data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with removal confirmation
 *
 * @example
 * ```typescript
 * const result = await removeReactionHandler({
 *   messageId: 'msg_123',
 *   emoji: 'thumbsup'
 * }, apiClient);
 * ```
 */
export async function removeReactionHandler(
  input: RemoveReactionInput,
  apiClient: { delete: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = RemoveReactionSchema.parse(input);

    // Remove reaction via API (emoji passed as query parameter)
    const response = await apiClient.delete(
      `/api/messages/${validatedInput.messageId}/reactions`,
      { emoji: validatedInput.emoji }
    );

    return {
      success: true,
      data: response,
      message: 'Reaction removed successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove reaction',
    };
  }
}
