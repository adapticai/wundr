/**
 * Get Workspace Tool
 * Retrieves details for a specific workspace by slug or ID
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/get-workspace
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { Workspace } from '../../types/common';

/**
 * Input schema for get-workspace tool
 */
export const GetWorkspaceInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
});

export type GetWorkspaceInput = z.infer<typeof GetWorkspaceInputSchema>;

/**
 * Output from get-workspace
 */
export interface GetWorkspaceOutput {
  workspace: Workspace;
}

/**
 * Get Workspace Handler
 * Fetches workspace details via GET /api/workspaces/[slug]
 */
export async function getWorkspaceHandler(
  input: GetWorkspaceInput,
): Promise<McpToolResult<GetWorkspaceOutput>> {
  try {
    // Validate input
    const validationResult = GetWorkspaceInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Make API request
    const response = await apiClient.get<{ data: Workspace }>(
      `/api/workspaces/${validInput.workspaceSlug}`,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to fetch workspace',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug },
      );
    }

    const output: GetWorkspaceOutput = {
      workspace: response.data.data,
    };

    return successResult(output, `Workspace '${output.workspace.name}' retrieved successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to get workspace: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const getWorkspaceTool = {
  name: 'neolith_get_workspace',
  description: 'Get detailed information about a specific workspace by its slug or ID.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
    },
    required: ['workspaceSlug'],
  },
  category: 'workspace',
  handler: getWorkspaceHandler,
};
