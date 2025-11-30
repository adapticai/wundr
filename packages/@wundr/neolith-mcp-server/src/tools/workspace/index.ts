/**
 * Workspace Tools Module
 * Exports all workspace-related MCP tools
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace
 */

export * from './list-workspaces';
export * from './get-workspace';
export * from './get-workspace-members';
export * from './get-workspace-settings';
export * from './update-workspace';
export * from './create-invite';
export * from './search-workspace';

import { listWorkspacesTool } from './list-workspaces';
import { getWorkspaceTool } from './get-workspace';
import { getWorkspaceMembersTool } from './get-workspace-members';
import { getWorkspaceSettingsTool } from './get-workspace-settings';
import { updateWorkspaceTool } from './update-workspace';
import { createInviteTool } from './create-invite';
import { searchWorkspaceTool } from './search-workspace';

/**
 * Array of all workspace tools for registration
 */
export const workspaceTools = [
  listWorkspacesTool,
  getWorkspaceTool,
  getWorkspaceMembersTool,
  getWorkspaceSettingsTool,
  updateWorkspaceTool,
  createInviteTool,
  searchWorkspaceTool,
];

/**
 * Workspace tools by name map
 */
export const workspaceToolsMap = {
  neolith_list_workspaces: listWorkspacesTool,
  neolith_get_workspace: getWorkspaceTool,
  neolith_get_workspace_members: getWorkspaceMembersTool,
  neolith_get_workspace_settings: getWorkspaceSettingsTool,
  neolith_update_workspace: updateWorkspaceTool,
  neolith_create_workspace_invite: createInviteTool,
  neolith_search_workspace: searchWorkspaceTool,
};
