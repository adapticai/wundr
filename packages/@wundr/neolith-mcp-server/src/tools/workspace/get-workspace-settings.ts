/**
 * Get Workspace Settings Tool
 * Retrieves configuration settings for a workspace
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/get-workspace-settings
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { WorkspaceSettings } from '../../types/common';

/**
 * Input schema for get-workspace-settings tool
 */
export const GetWorkspaceSettingsInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
});

export type GetWorkspaceSettingsInput = z.infer<typeof GetWorkspaceSettingsInputSchema>;

/**
 * Output from get-workspace-settings
 */
export interface GetWorkspaceSettingsOutput {
  settings: WorkspaceSettings;
}

/**
 * Get Workspace Settings Handler
 * Fetches workspace settings via GET /api/workspaces/[slug]/settings
 * Note: This assumes a settings endpoint exists. Adjust based on actual API.
 */
export async function getWorkspaceSettingsHandler(
  input: GetWorkspaceSettingsInput,
): Promise<McpToolResult<GetWorkspaceSettingsOutput>> {
  try {
    // Validate input
    const validationResult = GetWorkspaceSettingsInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Make API request - using admin/settings endpoint
    const response = await apiClient.get<{ data: WorkspaceSettings }>(
      `/api/workspaces/${validInput.workspaceSlug}/admin/settings`,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to fetch workspace settings',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' :
        response.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug },
      );
    }

    const output: GetWorkspaceSettingsOutput = {
      settings: response.data.data || {},
    };

    return successResult(output, 'Workspace settings retrieved successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to get workspace settings: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const getWorkspaceSettingsTool = {
  name: 'neolith_get_workspace_settings',
  description: 'Get configuration settings for a workspace. Requires admin permissions.',
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
  handler: getWorkspaceSettingsHandler,
};
