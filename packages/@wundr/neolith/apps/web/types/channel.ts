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
}
