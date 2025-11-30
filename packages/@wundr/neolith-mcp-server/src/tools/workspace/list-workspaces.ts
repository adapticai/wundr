/**
 * List Workspaces Tool
 * Lists all accessible workspaces for the authenticated user
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/list-workspaces
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { Workspace } from '../../types/common';

/**
 * Input schema for list-workspaces tool
 */
export const ListWorkspacesInputSchema = z.object({
  organizationId: z.string().optional().describe('Filter by organization ID'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of workspaces to return'),
  offset: z.number().int().nonnegative().optional().default(0).describe('Pagination offset'),
});

export type ListWorkspacesInput = z.infer<typeof ListWorkspacesInputSchema>;

/**
 * Output from list-workspaces
 */
export interface ListWorkspacesOutput {
  workspaces: Workspace[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * List Workspaces Handler
 * Fetches all accessible workspaces via GET /api/workspaces
 */
export async function listWorkspacesHandler(
  input: ListWorkspacesInput,
): Promise<McpToolResult<ListWorkspacesOutput>> {
  try {
    // Validate input
    const validationResult = ListWorkspacesInputSchema.safeParse(input);
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

    if (validInput.organizationId) {
      queryParams.organizationId = validInput.organizationId;
    }

    // Make API request
    const response = await apiClient.get<{ data: Workspace[]; total: number }>(
      '/api/workspaces',
      queryParams,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to fetch workspaces',
        'API_ERROR',
        { status: response.status },
      );
    }

    const output: ListWorkspacesOutput = {
      workspaces: response.data.data || [],
      total: response.data.total || 0,
      limit: validInput.limit,
      offset: validInput.offset,
    };

    return successResult(output, `Found ${output.workspaces.length} workspace(s)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to list workspaces: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const listWorkspacesTool = {
  name: 'neolith_list_workspaces',
  description: 'List all accessible workspaces for the authenticated user. Supports filtering by organization and pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Filter workspaces by organization ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of workspaces to return',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        default: 0,
      },
    },
  },
  category: 'workspace',
  handler: listWorkspacesHandler,
};
