/**
 * Broadcast to Channel Tool
 *
 * Broadcasts a custom event to all subscribers in a channel.
 * Used by orchestrators to notify users in real-time about task updates,
 * progress, completions, or other orchestrator-driven events.
 *
 * @module tools/realtime/broadcast-to-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for broadcasting to a channel
 */
export const BroadcastToChannelSchema = z.object({
  channelId: z.string().describe('ID of the channel to broadcast to'),
  eventType: z.string().min(1).max(100).describe('Custom event type identifier (e.g., "task.updated", "orchestrator.progress")'),
  payload: z.record(z.unknown()).describe('Event payload data'),
  metadata: z
    .object({
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Event priority level'),
      ttl: z.number().int().positive().optional().describe('Time-to-live in seconds for the event'),
      sourceId: z.string().optional().describe('ID of the source (orchestrator, agent, etc.)'),
      sourceType: z.string().optional().describe('Type of source (orchestrator, subagent, system)'),
    })
    .optional()
    .describe('Optional event metadata'),
  targetUserIds: z.array(z.string()).optional().describe('Optional array of specific user IDs to target (if not provided, broadcasts to all channel subscribers)'),
});

export type BroadcastToChannelInput = z.infer<typeof BroadcastToChannelSchema>;

/**
 * Response data for broadcast operation
 */
export interface BroadcastResponse {
  /** Event ID for tracking */
  eventId: string;
  /** Channel ID where event was broadcast */
  channelId: string;
  /** Event type */
  eventType: string;
  /** Number of active subscribers who received the event */
  recipientCount: number;
  /** Timestamp when broadcast was sent */
  sentAt: string;
  /** Delivery status */
  deliveryStatus: 'delivered' | 'partial' | 'failed';
  /** Failed recipient IDs if any */
  failedRecipients?: string[];
}

/**
 * Broadcast a custom event to all channel subscribers
 *
 * @param input - Broadcast data including event type and payload
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with broadcast confirmation
 *
 * @example
 * ```typescript
 * const result = await broadcastToChannelHandler({
 *   channelId: 'ch_123',
 *   eventType: 'orchestrator.task.updated',
 *   payload: {
 *     taskId: 'task_456',
 *     status: 'in_progress',
 *     progress: 45,
 *     message: 'Processing data...'
 *   },
 *   metadata: {
 *     priority: 'high',
 *     sourceId: 'orch_789',
 *     sourceType: 'orchestrator'
 *   }
 * }, apiClient);
 * ```
 */
export async function broadcastToChannelHandler(
  input: BroadcastToChannelInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = BroadcastToChannelSchema.parse(input);

    // Prepare broadcast request
    const broadcastData = {
      channelId: validatedInput.channelId,
      eventType: validatedInput.eventType,
      payload: validatedInput.payload,
      metadata: {
        priority: validatedInput.metadata?.priority || 'medium',
        ttl: validatedInput.metadata?.ttl || 300, // Default 5 minutes
        sourceId: validatedInput.metadata?.sourceId,
        sourceType: validatedInput.metadata?.sourceType || 'system',
        timestamp: new Date().toISOString(),
      },
      targetUserIds: validatedInput.targetUserIds,
    };

    // Send broadcast via WebSocket API endpoint
    const response = await apiClient.post(
      '/api/realtime/broadcast',
      broadcastData
    ) as BroadcastResponse;

    return {
      success: true,
      data: response,
      message: `Broadcast sent to ${response.recipientCount} subscriber(s) in channel`,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to broadcast to channel';

    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        code: 'BROADCAST_ERROR',
        message: errorMessage,
        context: { channelId: input.channelId, eventType: input.eventType },
      },
    };
  }
}
