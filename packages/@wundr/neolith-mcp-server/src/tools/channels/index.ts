/**
 * Channel Tools Module
 *
 * Exports all channel-related MCP tools for Neolith
 *
 * @module tools/channels
 */

// Export all channel tools
export * from './list-channels';
export * from './get-channel';
export * from './create-channel';
export * from './update-channel';
export * from './archive-channel';
export * from './join-channel';
export * from './leave-channel';
export * from './get-channel-members';

// Re-export tool definitions for easy registration
import { listChannelsTool } from './list-channels';
import { getChannelTool } from './get-channel';
import { createChannelTool } from './create-channel';
import { updateChannelTool } from './update-channel';
import { archiveChannelTool } from './archive-channel';
import { joinChannelTool } from './join-channel';
import { leaveChannelTool } from './leave-channel';
import { getChannelMembersTool } from './get-channel-members';

/**
 * All channel tools for easy registration
 */
export const channelTools = [
  listChannelsTool,
  getChannelTool,
  createChannelTool,
  updateChannelTool,
  archiveChannelTool,
  joinChannelTool,
  leaveChannelTool,
  getChannelMembersTool,
] as const;

/**
 * Channel tool names
 */
export const CHANNEL_TOOL_NAMES = {
  LIST_CHANNELS: 'list_channels',
  GET_CHANNEL: 'get_channel',
  CREATE_CHANNEL: 'create_channel',
  UPDATE_CHANNEL: 'update_channel',
  ARCHIVE_CHANNEL: 'archive_channel',
  JOIN_CHANNEL: 'join_channel',
  LEAVE_CHANNEL: 'leave_channel',
  GET_CHANNEL_MEMBERS: 'get_channel_members',
} as const;

/**
 * Channel tool descriptions
 */
export const CHANNEL_TOOL_DESCRIPTIONS = {
  [CHANNEL_TOOL_NAMES.LIST_CHANNELS]:
    'List channels in a workspace with filtering and pagination',
  [CHANNEL_TOOL_NAMES.GET_CHANNEL]: 'Get detailed information about a specific channel',
  [CHANNEL_TOOL_NAMES.CREATE_CHANNEL]: 'Create a new PUBLIC or PRIVATE channel in a workspace',
  [CHANNEL_TOOL_NAMES.UPDATE_CHANNEL]:
    'Update channel settings including name, description, and topic',
  [CHANNEL_TOOL_NAMES.ARCHIVE_CHANNEL]: 'Archive or unarchive a channel',
  [CHANNEL_TOOL_NAMES.JOIN_CHANNEL]: 'Join a public channel',
  [CHANNEL_TOOL_NAMES.LEAVE_CHANNEL]: 'Leave a channel',
  [CHANNEL_TOOL_NAMES.GET_CHANNEL_MEMBERS]: 'List members of a channel',
} as const;
