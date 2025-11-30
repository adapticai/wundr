/**
 * Get Workspace Members Tool
 * Lists all members of a specific workspace
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/get-workspace-members
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { WorkspaceMember } from '../../types/common';

/**
 * Input schema for get-workspace-members tool
 */
export const GetWorkspaceMembersInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).optional().describe('Filter by role'),
  limit: z.number().int().positive().optional().default(100).describe('Maximum number of members to return'),
  offset: z.number().int().nonnegative().optional().default(0).describe('Pagination offset'),
});

export type GetWorkspaceMembersInput = z.infer<typeof GetWorkspaceMembersInputSchema>;

/**
 * Output from get-workspace-members
 */
export interface GetWorkspaceMembersOutput {
  members: WorkspaceMember[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get Workspace Members Handler
 * Fetches workspace members via GET /api/workspaces/[slug]/members
 */
export async function getWorkspaceMembersHandler(
  input: GetWorkspaceMembersInput,
): Promise<McpToolResult<GetWorkspaceMembersOutput>> {
  try {
    // Validate input
    const validationResult = GetWorkspaceMembersInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Build query parameters
    const queryParams: Record<string, string> = {
      limit: validInput.limit.toString(),
      offset: validInput.offset.toString(),
    };

    if (validInput.role) {
      queryParams.role = validInput.role;
    }

    // Make API request
    const response = await apiClient.get<{ data: WorkspaceMember[]; total: number }>(
      `/api/workspaces/${validInput.workspaceSlug}/members`,
      queryParams,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to fetch workspace members',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug },
      );
    }

    const output: GetWorkspaceMembersOutput = {
      members: response.data.data || [],
      total: response.data.total || 0,
      limit: validInput.limit,
      offset: validInput.offset,
    };

    return successResult(output, `Found ${output.members.length} member(s) in workspace`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to get workspace members: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const getWorkspaceMembersTool = {
  name: 'neolith_get_workspace_members',
  description: 'List all members of a workspace with optional role filtering and pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      role: {
        type: 'string',
        enum: ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'],
        description: 'Filter members by role',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of members to return',
        default: 100,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        default: 0,
      },
    },
    required: ['workspaceSlug'],
  },
  category: 'workspace',
  handler: getWorkspaceMembersHandler,
};
