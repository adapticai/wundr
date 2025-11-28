/**
 * Channel Types for Genesis App
 */

import type { User } from './chat';

export type ChannelType = 'public' | 'private' | 'direct';

export type ChannelMemberRole = 'admin' | 'member';

export interface ChannelMember {
  id: string;
  userId: string;
  user: User;
  channelId: string;
  role: ChannelMemberRole;
  joinedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdBy?: User;
  members: ChannelMember[];
  memberCount: number;
  unreadCount: number;
  isStarred?: boolean;
  isArchived?: boolean;
  lastMessage?: {
    content: string;
    createdAt: Date;
    author: User;
  };
}

export interface CreateChannelInput {
  name: string;
  type: ChannelType;
  description?: string;
  memberIds?: string[];
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
}

export interface ChannelPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canArchive: boolean;
  canInvite: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
}

export interface DirectMessageParticipant {
  id: string;
  user: User;
  isOrchestrator?: boolean;
}

export interface DirectMessageChannel {
  id: string;
  participants: DirectMessageParticipant[];
  lastMessage?: {
    content: string;
    createdAt: Date;
    author: User;
  };
  unreadCount: number;
  /** Whether this conversation is starred by the current user */
  isStarred?: boolean;
  /** Whether this is a self-DM (notes to self) */
  isSelfDM?: boolean;
  /** Whether this is a group DM (3+ participants) */
  isGroupDM?: boolean;
  /** The primary participant to display (the "other" user, or self for self-DM) */
  participant?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    status?: string | null;
    isOrchestrator?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Workspace member for DM list display
 */
export interface WorkspaceMemberForDM {
  id: string;
  userId: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  isOrchestrator?: boolean;
  /** Whether this member has an existing DM with the current user */
  existingDMId?: string | null;
  /** Last message timestamp for sorting (if DM exists) */
  lastMessageAt?: Date | null;
  /** Unread count for existing DM */
  unreadCount?: number;
}
