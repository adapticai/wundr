/**
 * Create DM Tool
 *
 * Creates a new DM or group DM conversation with optional initial message.
 * For existing 1:1 DMs, returns the existing conversation.
 *
 * @module tools/messaging/create-dm
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for creating a DM
 */
export const CreateDMSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug where the DM will be created'),
  recipientIds: z.array(z.string()).min(1).describe('Array of user IDs to include in the DM (excluding yourself)'),
  initialMessage: z.string().optional().describe('Optional initial message to send'),
  mentions: z.array(z.string()).optional().describe('Optional user IDs to mention in the initial message'),
});

export type CreateDMInput = z.infer<typeof CreateDMSchema>;

/**
 * Create a DM or group DM conversation
 *
 * @param input - DM creation data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with created or existing DM channel
 *
 * @example
 * ```typescript
 * // Create 1:1 DM
 * const result = await createDMHandler({
 *   workspaceSlug: 'my-workspace',
 *   recipientIds: ['user_456'],
 *   initialMessage: 'Hey, can we discuss the project?'
 * }, apiClient);
 *
 * // Create group DM
 * const result = await createDMHandler({
 *   workspaceSlug: 'my-workspace',
 *   recipientIds: ['user_456', 'user_789'],
 *   initialMessage: 'Let\'s coordinate on this task'
 * }, apiClient);
 * ```
 */
export async function createDMHandler(
  input: CreateDMInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = CreateDMSchema.parse(input);

    // Prepare request body
    const requestBody = {
      workspaceSlug: validatedInput.workspaceSlug,
      recipientIds: validatedInput.recipientIds,
      initialMessage: validatedInput.initialMessage,
      mentions: validatedInput.mentions,
    };

    // Create DM via API
    const response = await apiClient.post('/api/conversations', requestBody);

    return {
      success: true,
      data: response,
      message: 'DM conversation created successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create DM conversation',
    };
  }
}
