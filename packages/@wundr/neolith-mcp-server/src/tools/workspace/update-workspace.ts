/**
 * Update Workspace Tool
 * Updates properties of a workspace
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/update-workspace
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { Workspace } from '../../types/common';

/**
 * Input schema for update-workspace tool
 */
export const UpdateWorkspaceInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
  name: z.string().min(1).max(100).optional().describe('New workspace name'),
  description: z.string().max(500).optional().describe('New workspace description'),
  settings: z.record(z.unknown()).optional().describe('Workspace settings to update'),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInputSchema>;

/**
 * Output from update-workspace
 */
export interface UpdateWorkspaceOutput {
  workspace: Workspace;
}

/**
 * Update Workspace Handler
 * Updates workspace via PATCH /api/workspaces/[slug]
 */
export async function updateWorkspaceHandler(
  input: UpdateWorkspaceInput,
): Promise<McpToolResult<UpdateWorkspaceOutput>> {
  try {
    // Validate input
    const validationResult = UpdateWorkspaceInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Build update payload - only include fields that are provided
    const updateData: Record<string, unknown> = {};
    if (validInput.name !== undefined) {
      updateData.name = validInput.name;
    }
    if (validInput.description !== undefined) {
      updateData.description = validInput.description;
    }
    if (validInput.settings !== undefined) {
      updateData.settings = validInput.settings;
    }

    // Check that at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return errorResult(
        'At least one field must be provided to update',
        'VALIDATION_ERROR',
        { providedFields: Object.keys(validInput) },
      );
    }

    // Make API request
    const response = await apiClient.patch<{ data: Workspace }>(
      `/api/workspaces/${validInput.workspaceSlug}`,
      updateData,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to update workspace',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' :
        response.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug },
      );
    }

    const output: UpdateWorkspaceOutput = {
      workspace: response.data.data,
    };

    return successResult(output, `Workspace '${output.workspace.name}' updated successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to update workspace: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const updateWorkspaceTool = {
  name: 'neolith_update_workspace',
  description: 'Update properties of a workspace including name, description, and settings. Requires admin permissions.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      name: {
        type: 'string',
        description: 'New workspace name (1-100 characters)',
      },
      description: {
        type: 'string',
        description: 'New workspace description (max 500 characters)',
      },
      settings: {
        type: 'object',
        description: 'Workspace settings object to update',
      },
    },
    required: ['workspaceSlug'],
  },
  category: 'workspace',
  handler: updateWorkspaceHandler,
};
