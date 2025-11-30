/**
 * Get Presence Tool
 *
 * Returns presence status for users in a channel.
 * Shows who is online, away, busy, offline, and their typing status.
 *
 * @module tools/realtime/get-presence
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for getting presence
 */
export const GetPresenceSchema = z.object({
  channelId: z.string().describe('ID of the channel to get presence for'),
  userIds: z.array(z.string()).optional().describe('Optional array of specific user IDs to check (if not provided, returns all channel members)'),
  includeTyping: z.boolean().optional().default(true).describe('Include typing indicator status'),
  includeLastSeen: z.boolean().optional().default(true).describe('Include last seen timestamp'),
  includeDeviceInfo: z.boolean().optional().default(false).describe('Include device information'),
});

export type GetPresenceInput = z.infer<typeof GetPresenceSchema>;

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/**
 * User presence information
 */
export interface UserPresence {
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Current presence status */
  status: PresenceStatus;
  /** Custom status message */
  statusMessage?: string;
  /** Whether user is currently typing in this channel */
  isTyping: boolean;
  /** Last seen timestamp (ISO 8601) */
  lastSeenAt?: string;
  /** Last active timestamp (ISO 8601) */
  lastActiveAt?: string;
  /** Device information */
  devices?: Array<{
    type: 'web' | 'mobile' | 'desktop';
    platform: string;
    isActive: boolean;
  }>;
}

/**
 * Response data for presence query
 */
export interface PresenceResponse {
  /** Channel ID */
  channelId: string;
  /** Array of user presence information */
  users: UserPresence[];
  /** Total user count in channel */
  totalUsers: number;
  /** Online user count */
  onlineCount: number;
  /** Away user count */
  awayCount: number;
  /** Busy user count */
  busyCount: number;
  /** Offline user count */
  offlineCount: number;
  /** Users currently typing */
  typingUserIds: string[];
  /** Timestamp of this presence snapshot */
  timestamp: string;
}

/**
 * Get presence status for users in a channel
 *
 * @param input - Presence query parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with presence information
 *
 * @example
 * ```typescript
 * const result = await getPresenceHandler({
 *   channelId: 'ch_123',
 *   includeTyping: true,
 *   includeLastSeen: true
 * }, apiClient);
 * ```
 */
export async function getPresenceHandler(
  input: GetPresenceInput,
  apiClient: { get: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = GetPresenceSchema.parse(input);

    // Prepare query parameters
    const params: Record<string, unknown> = {
      includeTyping: validatedInput.includeTyping,
      includeLastSeen: validatedInput.includeLastSeen,
      includeDeviceInfo: validatedInput.includeDeviceInfo,
    };

    if (validatedInput.userIds && validatedInput.userIds.length > 0) {
      params.userIds = validatedInput.userIds.join(',');
    }

    // Fetch presence data via API
    const response = await apiClient.get(
      `/api/realtime/presence/channels/${validatedInput.channelId}`,
      params
    ) as PresenceResponse;

    // Calculate summary counts
    const onlineCount = response.users.filter(u => u.status === 'online').length;
    const awayCount = response.users.filter(u => u.status === 'away').length;
    const busyCount = response.users.filter(u => u.status === 'busy').length;
    const offlineCount = response.users.filter(u => u.status === 'offline').length;
    const typingUserIds = response.users.filter(u => u.isTyping).map(u => u.userId);

    const enrichedResponse: PresenceResponse = {
      ...response,
      onlineCount,
      awayCount,
      busyCount,
      offlineCount,
      typingUserIds,
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: enrichedResponse,
      message: `Retrieved presence for ${response.users.length} user(s) in channel`,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get presence';

    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        code: 'PRESENCE_ERROR',
        message: errorMessage,
        context: { channelId: input.channelId },
      },
    };
  }
}
