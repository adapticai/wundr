/**
 * Get Current User Tool
 *
 * Retrieves the profile of the currently authenticated user.
 * Maps to: GET /api/users/me
 *
 * @module @wundr/neolith-mcp-server/tools/users/get-current-user
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';

/**
 * MCP Tool Result interface
 */
interface McpToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Input schema for get-current-user tool
 * No input required - uses authenticated session
 */
export const GetCurrentUserInputSchema = z.object({});

export type GetCurrentUserInput = z.infer<typeof GetCurrentUserInputSchema>;

/**
 * Current user profile response
 */
export interface CurrentUserProfile {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  status: string;
  isOrchestrator: boolean;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

/**
 * Get current authenticated user's profile
 *
 * @param apiClient - Neolith API client instance
 * @param _input - No input required
 * @returns User profile data
 *
 * @example
 * ```typescript
 * const result = await getCurrentUser(apiClient, {});
 * console.log(result.data.email);
 * ```
 */
export async function getCurrentUser(
  apiClient: NeolithApiClient,
  _input: GetCurrentUserInput,
): Promise<McpToolResult<CurrentUserProfile>> {
  try {
    const response = await apiClient.get<CurrentUserProfile>('/api/users/me');

    // Check for API errors
    if (response.error || !response.data) {
      return {
        success: false,
        error: response.error || 'No user data returned from API',
        message: 'Failed to retrieve current user profile',
      };
    }

    return {
      success: true,
      message: 'Successfully retrieved current user profile',
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to retrieve current user profile',
    };
  }
}

/**
 * Tool definition for MCP registration
 */
export const getCurrentUserTool = {
  name: 'neolith_get_current_user',
  description: 'Get the profile of the currently authenticated user',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};
