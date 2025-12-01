/**
 * Get User Tool
 *
 * Retrieves a user's profile by their ID.
 * Maps to: GET /api/users/[id]
 *
 * @module @wundr/neolith-mcp-server/tools/users/get-user
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';
interface McpToolResult<T = unknown> { success: boolean; data?: T; message?: string; error?: string; }

/**
 * Input schema for get-user tool
 */
export const GetUserInputSchema = z.object({
  userId: z.string().describe('The ID of the user to retrieve'),
});

export type GetUserInput = z.infer<typeof GetUserInputSchema>;

/**
 * User profile response (public fields)
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  status: string;
  isOrchestrator: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  // Additional fields if viewing own profile
  preferences?: Record<string, unknown>;
  updatedAt?: string;
}

/**
 * Get user profile by ID
 *
 * @param apiClient - Neolith API client instance
 * @param input - User ID to retrieve
 * @returns User profile data
 *
 * @example
 * ```typescript
 * const result = await getUser(apiClient, { userId: 'user_123' });
 * console.log(result.data.name);
 * ```
 */
export async function getUser(
  apiClient: NeolithApiClient,
  input: GetUserInput,
): Promise<McpToolResult<UserProfile>> {
  try {
    const { userId } = input;

    if (!userId || typeof userId !== 'string') {
      return {
        success: false,
        error: 'User ID is required and must be a string',
        message: 'Invalid input',
      };
    }

    const response = await apiClient.get<UserProfile>(`/api/users/${userId}`);

    // Check for API errors
    if (response.error || !response.data) {
      return {
        success: false,
        error: response.error || 'No user data returned',
        message: 'Failed to retrieve user profile',
      };
    }

    return {
      success: true,
      message: `Successfully retrieved user profile for ${userId}`,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to retrieve user profile',
    };
  }
}

/**
 * Tool definition for MCP registration
 */
export const getUserTool = {
  name: 'neolith_get_user',
  description: 'Get a user profile by their ID',
  inputSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The ID of the user to retrieve',
      },
    },
    required: ['userId'],
  },
};
