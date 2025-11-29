/**
 * Channel Types for Genesis App
 *
 * This module defines all types related to channels, channel members,
 * direct messages, and workspace members for the messaging system.
 */

import type { User } from './chat';

/**
 * Types of channels supported in the workspace
 * - `public`: Visible to all workspace members
 * - `private`: Only visible to invited members
 * - `direct`: One-on-one or group direct message
 */
export type ChannelType = 'public' | 'private' | 'direct';

/**
 * Roles that can be assigned to channel members
 * - `admin`: Can manage channel settings, members, and permissions
 * - `member`: Standard participant with basic permissions
 */
export type ChannelMemberRole = 'admin' | 'member';

/**
 * Represents a member of a channel with their role and metadata
 */
export interface ChannelMember {
  /** Unique identifier for this membership record */
  id: string;
  /** ID of the user who is a member */
  userId: string;
  /** Full user object for this member */
  user: User;
  /** ID of the channel this membership belongs to */
  channelId: string;
  /** Role assigned to this member in the channel */
  role: ChannelMemberRole;
  /** Timestamp when the member joined the channel */
  joinedAt: Date;
}

/**
 * Last message preview for a channel
 */
export interface ChannelLastMessage {
  /** Message content/text */
  content: string;
  /** When the message was sent */
  createdAt: Date;
  /** User who sent the message */
  author: User;
}

/**
 * Complete channel object with all metadata and relationships
 */
export interface Channel {
  /** Unique identifier for the channel */
  id: string;
  /** Display name of the channel */
  name: string;
  /** Optional description of the channel's purpose */
  description?: string;
  /** Type of channel (public, private, or direct) */
  type: ChannelType;
  /** ID of the workspace this channel belongs to */
  workspaceId: string;
  /** When the channel was created */
  createdAt: Date;
  /** When the channel was last updated */
  updatedAt: Date;
  /** ID of the user who created the channel */
  createdById: string;
  /** Full user object of the channel creator */
  createdBy?: User;
  /** List of channel members with their roles */
  members: ChannelMember[];
  /** Total count of members in the channel */
  memberCount: number;
  /** Count of unread messages for the current user */
  unreadCount: number;
  /** Whether the channel is starred by the current user */
  isStarred?: boolean;
  /** Whether the channel has been archived */
  isArchived?: boolean;
  /** Preview of the most recent message in the channel */
  lastMessage?: ChannelLastMessage;
}

/**
 * Input data required to create a new channel
 */
export interface CreateChannelInput {
  /** Name of the new channel */
  name: string;
  /** Type of channel to create */
  type: ChannelType;
  /** Optional description of the channel's purpose */
  description?: string;
  /** Optional list of user IDs to add as initial members */
  memberIds?: string[];
}

/**
 * Input data for updating channel properties
 */
export interface UpdateChannelInput {
  /** Updated channel name */
  name?: string;
  /** Updated channel description */
  description?: string;
}

/**
 * Permission flags for what the current user can do in a channel
 */
export interface ChannelPermissions {
  /** Whether the user can edit channel settings */
  canEdit: boolean;
  /** Whether the user can delete the channel */
  canDelete: boolean;
  /** Whether the user can archive the channel */
  canArchive: boolean;
  /** Whether the user can invite new members */
  canInvite: boolean;
  /** Whether the user can remove members from the channel */
  canRemoveMembers: boolean;
  /** Whether the user can change member roles */
  canChangeRoles: boolean;
}

/**
 * Participant in a direct message conversation
 */
export interface DirectMessageParticipant {
  /** Unique identifier for this participant record */
  id: string;
  /** Full user object for this participant */
  user: User;
  /** Whether this participant is an AI orchestrator */
  isOrchestrator?: boolean;
}

/**
 * Information about the primary participant to display in a DM
 */
export interface DirectMessageParticipantInfo {
  /** Participant's unique identifier */
  id: string;
  /** Display name of the participant */
  name: string;
  /** URL to the participant's avatar image */
  avatarUrl?: string | null;
  /** Current online/offline status */
  status?: string | null;
  /** Whether this participant is an AI orchestrator */
  isOrchestrator?: boolean;
}

/**
 * Direct message channel for one-on-one or group conversations
 */
export interface DirectMessageChannel {
  /** Unique identifier for this DM channel */
  id: string;
  /** List of all participants in this conversation */
  participants: DirectMessageParticipant[];
  /** Preview of the most recent message */
  lastMessage?: ChannelLastMessage;
  /** Count of unread messages for the current user */
  unreadCount: number;
  /** Whether this conversation is starred by the current user */
  isStarred?: boolean;
  /** Whether this is a self-DM (notes to self) */
  isSelfDM?: boolean;
  /** Whether this is a group DM (3+ participants) */
  isGroupDM?: boolean;
  /** The primary participant to display (the "other" user, or self for self-DM) */
  participant?: DirectMessageParticipantInfo;
  /** When this DM channel was created */
  createdAt?: Date;
  /** When this DM channel was last updated */
  updatedAt?: Date;
}

/**
 * Workspace member data optimized for direct message list display
 */
export interface WorkspaceMemberForDM {
  /** Unique identifier for this workspace member record */
  id: string;
  /** ID of the underlying user */
  userId: string;
  /** User's name */
  name: string;
  /** User's preferred display name */
  displayName?: string | null;
  /** User's email address */
  email?: string | null;
  /** URL to the user's avatar image */
  avatarUrl?: string | null;
  /** Current online/offline status */
  status?: string | null;
  /** Whether this member is an AI orchestrator */
  isOrchestrator?: boolean;
  /** Whether this member has an existing DM with the current user */
  existingDMId?: string | null;
  /** Last message timestamp for sorting (if DM exists) */
  lastMessageAt?: Date | null;
  /** Unread count for existing DM */
  unreadCount?: number;
}
