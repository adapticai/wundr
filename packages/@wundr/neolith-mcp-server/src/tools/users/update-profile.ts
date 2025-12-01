/**
 * Update Profile Tool
 *
 * Update the current user's profile information.
 * Maps to: PATCH /api/users/me
 *
 * @module @wundr/neolith-mcp-server/tools/users/update-profile
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';
interface McpToolResult<T = unknown> { success: boolean; data?: T; message?: string; error?: string; }
import type { CurrentUserProfile } from './get-current-user';

/**
 * Input schema for update-profile tool
 */
export const UpdateProfileInputSchema = z.object({
  name: z.string().optional().describe('Full name'),
  displayName: z.string().optional().describe('Display name / nickname'),
  bio: z.string().optional().describe('User biography / about me'),
  avatarUrl: z.string().url().optional().describe('URL to avatar image'),
  preferences: z.record(z.unknown()).optional().describe('User preferences object'),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

/**
 * Update current user's profile
 *
 * @param apiClient - Neolith API client instance
 * @param input - Profile fields to update
 * @returns Updated user profile
 *
 * @example
 * ```typescript
 * const result = await updateProfile(apiClient, {
 *   name: 'John Doe',
 *   bio: 'Software engineer and open source contributor'
 * });
 * console.log(result.data);
 * ```
 */
export async function updateProfile(
  apiClient: NeolithApiClient,
  input: UpdateProfileInput,
): Promise<McpToolResult<CurrentUserProfile>> {
  try {
    // Validate that at least one field is being updated
    if (Object.keys(input).length === 0) {
      return {
        success: false,
        error: 'At least one profile field must be provided',
        message: 'No fields to update',
      };
    }

    const response = await apiClient.patch<CurrentUserProfile>(
      '/api/users/me',
      input,
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to update profile',
    };
  }
}

/**
 * Tool definition for MCP registration
 */
export const updateProfileTool = {
  name: 'neolith_update_profile',
  description: 'Update the current user\'s profile information',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Full name',
      },
      displayName: {
        type: 'string',
        description: 'Display name / nickname',
      },
      bio: {
        type: 'string',
        description: 'User biography / about me',
      },
      avatarUrl: {
        type: 'string',
        description: 'URL to avatar image',
      },
      preferences: {
        type: 'object',
        description: 'User preferences object',
      },
    },
    required: [],
  },
};
