/**
 * Create Channel Tool
 *
 * MCP tool for creating a new channel in a Neolith workspace
 *
 * @module tools/channels/create-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const CreateChannelInputSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug or ID'),
  name: z
    .string()
    .min(1)
    .max(80)
    .describe('Channel name (max 80 characters)'),
  type: z
    .enum(['PUBLIC', 'PRIVATE'])
    .default('PUBLIC')
    .describe('Channel type (PUBLIC or PRIVATE)'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('Channel description (max 500 characters)'),
  topic: z
    .string()
    .max(250)
    .optional()
    .describe('Channel topic (max 250 characters)'),
  memberIds: z
    .array(z.string())
    .default([])
    .describe('Array of user IDs to add as initial members'),
});

export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface CreatedChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  type: 'PUBLIC' | 'PRIVATE';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  createdById: string;
  creator: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
  memberCount: number;
  messageCount: number;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Create a new channel in a workspace
 *
 * @param input - Create channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Created channel details
 */
export async function createChannelHandler(
  input: CreateChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<CreatedChannel>> {
  try {
    // Validate input
    const validated = CreateChannelInputSchema.parse(input);

    // Make API request
    const url = `${apiBaseUrl}/api/workspaces/${validated.workspaceSlug}/channels`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const body = {
      name: validated.name,
      type: validated.type,
      description: validated.description,
      topic: validated.topic,
      memberIds: validated.memberIds,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || `Failed to create channel: ${response.statusText}`,
        errorDetails: {
          code: responseData.error?.code || 'API_ERROR',
          message: responseData.error?.message || response.statusText,
          context: { status: response.status },
        },
      };
    }

    return {
      success: true,
      data: responseData.data,
      message: responseData.message || `Channel "${validated.name}" created successfully`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

export const createChannelTool = {
  name: 'create_channel',
  description: 'Create a new PUBLIC or PRIVATE channel in a Neolith workspace',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      name: {
        type: 'string',
        description: 'Channel name (max 80 characters)',
        minLength: 1,
        maxLength: 80,
      },
      type: {
        type: 'string',
        enum: ['PUBLIC', 'PRIVATE'],
        description: 'Channel type (PUBLIC or PRIVATE)',
        default: 'PUBLIC',
      },
      description: {
        type: 'string',
        description: 'Channel description (max 500 characters)',
        maxLength: 500,
      },
      topic: {
        type: 'string',
        description: 'Channel topic (max 250 characters)',
        maxLength: 250,
      },
      memberIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of user IDs to add as initial members',
        default: [],
      },
    },
    required: ['workspaceSlug', 'name'],
  },
  handler: createChannelHandler,
} as const;
