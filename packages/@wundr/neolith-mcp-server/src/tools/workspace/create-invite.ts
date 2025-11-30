/**
 * Create Workspace Invite Tool
 * Creates an invitation to join a workspace
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/create-invite
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';
import type { WorkspaceInvite } from '../../types/common';

/**
 * Input schema for create-invite tool
 */
export const CreateInviteInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
  email: z.string().email().describe('Email address to invite'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).default('MEMBER').describe('Role for the invited user'),
  expiresInDays: z.number().int().positive().optional().default(7).describe('Number of days until invite expires'),
});

export type CreateInviteInput = z.infer<typeof CreateInviteInputSchema>;

/**
 * Output from create-invite
 */
export interface CreateInviteOutput {
  invite: WorkspaceInvite;
  inviteUrl?: string;
}

/**
 * Create Workspace Invite Handler
 * Creates an invite via POST /api/workspaces/[slug]/invites
 */
export async function createInviteHandler(
  input: CreateInviteInput,
): Promise<McpToolResult<CreateInviteOutput>> {
  try {
    // Validate input
    const validationResult = CreateInviteInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Build request payload
    const inviteData = {
      email: validInput.email,
      role: validInput.role,
      expiresInDays: validInput.expiresInDays,
    };

    // Make API request - using admin/invites endpoint
    const response = await apiClient.post<{ data: WorkspaceInvite; inviteUrl?: string }>(
      `/api/workspaces/${validInput.workspaceSlug}/admin/invites`,
      inviteData,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to create workspace invite',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' :
        response.status === 403 ? 'PERMISSION_DENIED' :
        response.status === 409 ? 'INVITE_ALREADY_EXISTS' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug, email: validInput.email },
      );
    }

    const output: CreateInviteOutput = {
      invite: response.data.data,
      inviteUrl: response.data.inviteUrl,
    };

    return successResult(
      output,
      `Invite sent to ${validInput.email} for role ${validInput.role}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to create workspace invite: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const createInviteTool = {
  name: 'neolith_create_workspace_invite',
  description: 'Create an invitation to join a workspace. Sends an email with an invite link. Requires admin permissions.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address to invite',
      },
      role: {
        type: 'string',
        enum: ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'],
        default: 'MEMBER',
        description: 'Role for the invited user',
      },
      expiresInDays: {
        type: 'number',
        description: 'Number of days until the invite expires',
        default: 7,
      },
    },
    required: ['workspaceSlug', 'email'],
  },
  category: 'workspace',
  handler: createInviteHandler,
};
