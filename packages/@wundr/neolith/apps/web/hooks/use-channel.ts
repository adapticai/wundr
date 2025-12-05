'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';

import type {
  Channel,
  ChannelMember,
  CreateChannelInput,
  UpdateChannelInput,
  ChannelPermissions,
  DirectMessageChannel,
  WorkspaceMemberForDM,
} from '@/types/channel';
import type { User } from '@/types/chat';

// =============================================================================
// API Response Types
// =============================================================================

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface ChannelApiResponse {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  createdById?: string;
  description?: string;
  memberCount?: number;
  unreadCount?: number;
  isStarred?: boolean;
  isArchived?: boolean;
  members?: ChannelMemberApiResponse[];
  [key: string]: unknown;
}

interface ChannelMemberApiResponse {
  id: string;
  userId: string;
  joinedAt: string;
  role?: string;
  user: {
    id: string;
    displayName?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    image?: string;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface WorkspaceMemberApiResponse {
  id?: string;
  userId?: string;
  user?: {
    id?: string;
    displayName?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    image?: string;
    status?: string;
    isOrchestrator?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for the useChannels hook
 */
export interface UseChannelsReturn {
  /** All channels */
  channels: Channel[];
  /** Public channels (excluding starred) */
  publicChannels: Channel[];
  /** Private channels (excluding starred) */
  privateChannels: Channel[];
  /** Starred channels */
  starredChannels: Channel[];
  /** Whether channels are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch channels */
  refetch: () => Promise<void>;
}

/**
 * Return type for the useChannel hook
 */
export interface UseChannelReturn {
  /** Channel data */
  channel: Channel | null;
  /** Whether channel is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch channel */
  refetch: () => Promise<void>;
  /** Set channel data (for optimistic updates) */
  setChannel: React.Dispatch<React.SetStateAction<Channel | null>>;
}

/**
 * Return type for the useChannelMembers hook
 */
export interface UseChannelMembersReturn {
  /** All members */
  members: ChannelMember[];
  /** Online members */
  onlineMembers: ChannelMember[];
  /** Offline members */
  offlineMembers: ChannelMember[];
  /** Whether members are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch members */
  refetch: () => Promise<void>;
}

/**
 * Return type for the useChannelMutations hook
 */
export interface UseChannelMutationsReturn {
  /** Create a new channel */
  createChannel: (
    workspaceId: string,
    input: CreateChannelInput
  ) => Promise<Channel | null>;
  /** Update a channel */
  updateChannel: (
    channelId: string,
    input: UpdateChannelInput
  ) => Promise<Channel | null>;
  /** Delete a channel */
  deleteChannel: (channelId: string) => Promise<boolean>;
  /** Archive a channel */
  archiveChannel: (channelId: string) => Promise<boolean>;
  /** Toggle star on a channel */
  toggleStar: (channelId: string, isStarred: boolean) => Promise<boolean>;
  /** Leave a channel */
  leaveChannel: (channelId: string) => Promise<boolean>;
  /** Invite members to a channel */
  inviteMembers: (
    channelId: string,
    userIds: string[],
    role?: 'admin' | 'member'
  ) => Promise<boolean>;
  /** Remove a member from a channel */
  removeMember: (channelId: string, userId: string) => Promise<boolean>;
  /** Change a member's role */
  changeMemberRole: (
    channelId: string,
    userId: string,
    role: 'admin' | 'member'
  ) => Promise<boolean>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error if mutation failed */
  error: Error | null;
}

/**
 * Return type for the useChannelPermissions hook
 */
export interface UseChannelPermissionsReturn {
  /** User permissions for the channel */
  permissions: ChannelPermissions;
  /** Whether permissions are loading */
  isLoading: boolean;
}

/**
 * Return type for the useDirectMessages hook
 */
export interface UseDirectMessagesReturn {
  /** List of direct message channels */
  directMessages: DirectMessageChannel[];
  /** Whether loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch direct messages */
  refetch: () => Promise<void>;
  /** Create a new direct message channel */
  createDirectMessage: (
    userIds: string[]
  ) => Promise<DirectMessageChannel | null>;
}

/**
 * Return type for the useWorkspaceUsers hook
 */
export interface UseWorkspaceUsersReturn {
  /** List of users */
  users: User[];
  /** Search for users */
  searchUsers: (query: string) => Promise<void>;
  /** Fetch all users */
  fetchAllUsers: () => Promise<void>;
  /** Whether loading */
  isLoading: boolean;
}

/**
 * Return type for the useWorkspaceMembersForDM hook
 */
export interface UseWorkspaceMembersForDMReturn {
  /** All workspace members combined with their DM status */
  members: WorkspaceMemberForDM[];
  /** Current user (for self-DM at top) */
  currentUserMember: WorkspaceMemberForDM | null;
  /** Members with existing DMs, sorted by most recent */
  membersWithDM: WorkspaceMemberForDM[];
  /** Members without existing DMs, sorted alphabetically */
  membersWithoutDM: WorkspaceMemberForDM[];
  /** Whether loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch data */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching workspace channels
 */
export function useChannels(workspaceId: string): UseChannelsReturn {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch channels' }));
        throw new Error(
          errorData.error || errorData.message || 'Failed to fetch channels',
        );
      }

      const result: ApiResponse<ChannelApiResponse[]> = await response.json();
      const channelsData = result.data || [];

      // Normalize API response to match frontend types
      // API returns uppercase types (PUBLIC, PRIVATE), frontend expects lowercase (public, private)
      setChannels(
        channelsData.map(
          (c): Channel => ({
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type?.toLowerCase() as Channel['type'],
            workspaceId: c.workspaceId || workspaceId,
            createdById: c.createdById || '',
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            memberCount: c.memberCount ?? c.members?.length ?? 0,
            unreadCount: c.unreadCount ?? 0,
            isStarred: c.isStarred,
            isArchived: c.isArchived,
            members: (c.members || []).map(
              (m): ChannelMember => ({
                id: m.id,
                userId: m.userId,
                channelId: c.id,
                role: (m.role as ChannelMember['role']) || 'member',
                joinedAt: new Date(m.joinedAt),
                user: {
                  id: m.user.id,
                  name: m.user.displayName || m.user.name || 'Unknown',
                  image: m.user.avatarUrl || m.user.image,
                  email: m.user.email || '',
                  status: (m.user.status as User['status']) || 'offline',
                },
              }),
            ),
          }),
        ),
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Categorize channels
  const { publicChannels, privateChannels, starredChannels } = useMemo(() => {
    const starred = channels.filter(c => c.isStarred);
    const publicCh = channels.filter(c => c.type === 'public' && !c.isStarred);
    const privateCh = channels.filter(
      c => c.type === 'private' && !c.isStarred,
    );

    return {
      starredChannels: starred,
      publicChannels: publicCh,
      privateChannels: privateCh,
    };
  }, [channels]);

  return {
    channels,
    publicChannels,
    privateChannels,
    starredChannels,
    isLoading,
    error,
    refetch: fetchChannels,
  };
}

/**
 * Hook for fetching a single channel with members
 */
export function useChannel(channelId: string): UseChannelReturn {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChannel = useCallback(async () => {
    if (!channelId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch channel' }));
        throw new Error(
          errorData.error || errorData.message || 'Failed to fetch channel',
        );
      }

      const result: ApiResponse<ChannelApiResponse> = await response.json();
      const channelData = result.data;

      if (!channelData || typeof channelData !== 'object') {
        throw new Error('Invalid channel data received');
      }

      const c = channelData;
      setChannel({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type?.toLowerCase() as Channel['type'],
        workspaceId: c.workspaceId || channelId.split('/')[0] || '',
        createdById: c.createdById || '',
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        memberCount: c.memberCount ?? c.members?.length ?? 0,
        unreadCount: c.unreadCount ?? 0,
        isStarred: c.isStarred,
        isArchived: c.isArchived,
        members: (c.members || []).map(
          (m): ChannelMember => ({
            id: m.id,
            userId: m.userId,
            channelId: c.id,
            role: (m.role as ChannelMember['role']) || 'member',
            joinedAt: new Date(m.joinedAt),
            user: {
              id: m.user.id,
              name: m.user.displayName || m.user.name || 'Unknown',
              image: m.user.avatarUrl || m.user.image,
              email: m.user.email || '',
              status: (m.user.status as User['status']) || 'offline',
            },
          }),
        ),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [channelId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  return {
    channel,
    isLoading,
    error,
    refetch: fetchChannel,
    setChannel,
  };
}

/**
 * Hook for fetching channel members
 */
export function useChannelMembers(channelId: string): UseChannelMembersReturn {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!channelId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const response = await fetch(`/api/channels/${channelId}/members`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch members' }));
        throw new Error(
          errorData.error || errorData.message || 'Failed to fetch members',
        );
      }

      const result: ApiResponse<ChannelMemberApiResponse[]> & {
        members?: ChannelMemberApiResponse[];
      } = await response.json();
      const membersData = result.data || result.members || [];

      setMembers(
        membersData.map(
          (m): ChannelMember => ({
            id: m.id,
            userId: m.userId,
            channelId: channelId,
            role: (m.role as ChannelMember['role']) || 'member',
            joinedAt: new Date(m.joinedAt),
            user: {
              id: m.user.id,
              name: m.user.displayName || m.user.name || 'Unknown',
              image: m.user.avatarUrl || m.user.image,
              email: m.user.email || '',
              status: (m.user.status as User['status']) || 'offline',
            },
          }),
        ),
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [channelId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Separate online and offline members
  const { onlineMembers, offlineMembers } = useMemo(() => {
    const online = members.filter(
      m =>
        m.user.status === 'online' ||
        m.user.status === 'busy' ||
        m.user.status === 'away',
    );
    const offline = members.filter(
      m => m.user.status === 'offline' || !m.user.status,
    );

    return { onlineMembers: online, offlineMembers: offline };
  }, [members]);

  return {
    members,
    onlineMembers,
    offlineMembers,
    isLoading,
    error,
    refetch: fetchMembers,
  };
}

/**
 * Hook for channel mutations (create, update, delete, archive)
 */
export function useChannelMutations(): UseChannelMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createChannel = useCallback(
    async (
      workspaceId: string,
      input: CreateChannelInput,
    ): Promise<Channel | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Transform type to uppercase for API
        const apiInput = {
          ...input,
          type: input.type?.toUpperCase() as
            | 'PUBLIC'
            | 'PRIVATE'
            | 'DM'
            | 'HUDDLE',
          workspaceId,
        };

        const response = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiInput),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Failed to create channel' }));
          throw new Error(
            errorData.error || errorData.message || 'Failed to create channel',
          );
        }

        const result: ApiResponse<ChannelApiResponse> = await response.json();
        const channelData = result.data;

        if (!channelData || typeof channelData !== 'object') {
          throw new Error('Invalid channel data received');
        }

        const channel: Channel = {
          id: channelData.id,
          name: channelData.name,
          description: channelData.description,
          type:
            (channelData.type?.toLowerCase() as Channel['type']) || 'public',
          workspaceId: channelData.workspaceId || workspaceId,
          createdById: channelData.createdById || '',
          createdAt: new Date(channelData.createdAt),
          updatedAt: new Date(channelData.updatedAt),
          memberCount:
            channelData.memberCount ?? channelData.members?.length ?? 0,
          unreadCount: channelData.unreadCount ?? 0,
          isStarred: channelData.isStarred,
          isArchived: channelData.isArchived,
          members: (channelData.members || []).map(
            (m): ChannelMember => ({
              id: m.id,
              userId: m.userId,
              channelId: channelData.id,
              role: (m.role as ChannelMember['role']) || 'member',
              joinedAt: new Date(m.joinedAt),
              user: {
                id: m.user.id,
                name: m.user.displayName || m.user.name || 'Unknown',
                image: m.user.avatarUrl || m.user.image,
                email: m.user.email || '',
                status: (m.user.status as User['status']) || 'offline',
              },
            }),
          ),
        };
        return channel;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const updateChannel = useCallback(
    async (
      channelId: string,
      input: UpdateChannelInput,
    ): Promise<Channel | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/channels/${channelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Failed to update channel' }));
          throw new Error(
            errorData.error || errorData.message || 'Failed to update channel',
          );
        }

        const result: ApiResponse<ChannelApiResponse> = await response.json();
        const channelData = result.data;

        if (!channelData || typeof channelData !== 'object') {
          throw new Error('Invalid channel data received');
        }

        const channel: Channel = {
          id: channelData.id,
          name: channelData.name,
          description: channelData.description,
          type:
            (channelData.type?.toLowerCase() as Channel['type']) || 'public',
          workspaceId: channelData.workspaceId || '',
          createdById: channelData.createdById || '',
          createdAt: new Date(channelData.createdAt),
          updatedAt: new Date(channelData.updatedAt),
          memberCount:
            channelData.memberCount ?? channelData.members?.length ?? 0,
          unreadCount: channelData.unreadCount ?? 0,
          isStarred: channelData.isStarred,
          isArchived: channelData.isArchived,
          members: (channelData.members || []).map(
            (m): ChannelMember => ({
              id: m.id,
              userId: m.userId,
              channelId: channelData.id,
              role: (m.role as ChannelMember['role']) || 'member',
              joinedAt: new Date(m.joinedAt),
              user: {
                id: m.user.id,
                name: m.user.displayName || m.user.name || 'Unknown',
                image: m.user.avatarUrl || m.user.image,
                email: m.user.email || '',
                status: (m.user.status as User['status']) || 'offline',
              },
            }),
          ),
        };
        return channel;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err; // Throw to maintain consistency with createChannel
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const deleteChannel = useCallback(
    async (channelId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/channels/${channelId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete channel');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const archiveChannel = useCallback(
    async (channelId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Archive via PATCH to update isArchived field
        const response = await fetch(`/api/channels/${channelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isArchived: true }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to archive channel');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const toggleStar = useCallback(
    async (channelId: string, isStarred: boolean): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/channels/${channelId}/star`, {
          method: isStarred ? 'DELETE' : 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to toggle star');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const leaveChannel = useCallback(
    async (channelId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/channels/${channelId}/leave`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to leave channel');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const inviteMembers = useCallback(
    async (
      channelId: string,
      userIds: string[],
      role: 'admin' | 'member' = 'member',
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // API expects single userId, so we need to make multiple requests
        const promises = userIds.map(userId =>
          fetch(`/api/channels/${channelId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role }),
          }),
        );

        const responses = await Promise.all(promises);

        // Check if all succeeded
        const allSucceeded = responses.every(r => r.ok);
        if (!allSucceeded) {
          const failedResponses = responses.filter(r => !r.ok);
          const errors = await Promise.all(failedResponses.map(r => r.json()));
          throw new Error(
            errors[0]?.message || 'Failed to invite some members',
          );
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const removeMember = useCallback(
    async (channelId: string, userId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/channels/${channelId}/members/${userId}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to remove member');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const changeMemberRole = useCallback(
    async (
      channelId: string,
      userId: string,
      role: 'admin' | 'member',
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert lowercase role to uppercase for API
        const apiRole = role.toUpperCase() as 'ADMIN' | 'MEMBER';

        const response = await fetch(
          `/api/channels/${channelId}/members/${userId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: apiRole }),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to change member role');
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    createChannel,
    updateChannel,
    deleteChannel,
    archiveChannel,
    toggleStar,
    leaveChannel,
    inviteMembers,
    removeMember,
    changeMemberRole,
    isLoading,
    error,
  };
}

/**
 * Hook for user permissions in a channel
 */
export function useChannelPermissions(
  channelId: string,
  currentUserId: string,
): UseChannelPermissionsReturn {
  const [permissions, setPermissions] = useState<ChannelPermissions>({
    canEdit: false,
    canDelete: false,
    canArchive: false,
    canInvite: false,
    canRemoveMembers: false,
    canChangeRoles: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!channelId || !currentUserId) {
      setIsLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/channels/${channelId}/permissions`);
        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json();
        setPermissions(data);
      } catch {
        // Default to no permissions on error
        setPermissions({
          canEdit: false,
          canDelete: false,
          canArchive: false,
          canInvite: false,
          canRemoveMembers: false,
          canChangeRoles: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [channelId, currentUserId]);

  return {
    permissions,
    isLoading,
  };
}

/**
 * Hook for direct messages
 */
export function useDirectMessages(
  workspaceId: string,
): UseDirectMessagesReturn {
  const [directMessages, setDirectMessages] = useState<DirectMessageChannel[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDirectMessages = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/dm`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch direct messages' }));
        throw new Error(
          errorData.error ||
            errorData.message ||
            'Failed to fetch direct messages',
        );
      }

      const result: ApiResponse<DirectMessageChannel[]> = await response.json();
      setDirectMessages(result.data || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchDirectMessages();
  }, [fetchDirectMessages]);

  const createDirectMessage = useCallback(
    async (userIds: string[]): Promise<DirectMessageChannel | null> => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/dm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userIds[0] }),
        });

        if (!response.ok) {
          throw new Error('Failed to create direct message');
        }

        const result = await response.json();
        const dmChannel = result.data;
        setDirectMessages(prev => [dmChannel, ...prev]);
        return dmChannel;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workspaceId],
  );

  return {
    directMessages,
    isLoading,
    error,
    refetch: fetchDirectMessages,
    createDirectMessage,
  };
}

/**
 * Hook for searching workspace users
 */
export function useWorkspaceUsers(
  workspaceId: string,
): UseWorkspaceUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchUsers = useCallback(
    async (query: string) => {
      if (!workspaceId || query.length < 1) {
        setUsers([]);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/users?search=${encodeURIComponent(query)}`,
        );
        if (!response.ok) {
          throw new Error('Failed to search users');
        }

        const data = await response.json();
        setUsers(data.users);
      } catch {
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId],
  );

  const fetchAllUsers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  return {
    users,
    searchUsers,
    fetchAllUsers,
    isLoading,
  };
}

/**
 * Hook for fetching all workspace members with their DM status
 * Combines workspace members with existing DM channels for a unified DM list
 */
export function useWorkspaceMembersForDM(
  workspaceId: string,
  currentUserId: string | undefined,
): UseWorkspaceMembersForDMReturn {
  const [members, setMembers] = useState<WorkspaceMemberForDM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId || !currentUserId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      // Fetch both workspace members and existing DMs in parallel
      const [membersResponse, dmsResponse] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`, {
          signal: abortController.signal,
        }),
        fetch(`/api/workspaces/${workspaceId}/dm`, {
          signal: abortController.signal,
        }),
      ]);

      if (!membersResponse.ok) {
        const errorData = await membersResponse
          .json()
          .catch(() => ({ error: 'Failed to fetch workspace members' }));
        throw new Error(
          errorData.error ||
            errorData.message ||
            'Failed to fetch workspace members',
        );
      }

      const membersData: ApiResponse<WorkspaceMemberApiResponse[]> =
        await membersResponse.json();
      const dmsData: ApiResponse<DirectMessageChannel[]> = dmsResponse.ok
        ? await dmsResponse.json()
        : { data: [] };

      const workspaceMembers = membersData.data || [];
      const existingDMs: DirectMessageChannel[] = dmsData.data || [];

      // Create a map of userId -> DM channel info
      const dmByUserId = new Map<
        string,
        {
          dmId: string;
          lastMessageAt: Date | null;
          unreadCount: number;
          isSelfDM: boolean;
        }
      >();

      for (const dm of existingDMs) {
        const dmInfo = {
          dmId: dm.id,
          lastMessageAt: dm.lastMessage?.createdAt
            ? new Date(dm.lastMessage.createdAt)
            : null,
          unreadCount: dm.unreadCount || 0,
          isSelfDM: dm.isSelfDM || false,
        };

        // Map ALL participants of this DM to the DM info
        // This handles both 1:1 DMs and group DMs
        if (dm.participants && dm.participants.length > 0) {
          // New API format: participants array contains flat objects with id
          for (const p of dm.participants) {
            // Work with the raw data structure - p may have id directly or via user object
            const pData = p as { id?: string; user?: { id?: string } };
            const pId = pData.id || pData.user?.id;
            if (pId) {
              dmByUserId.set(pId, dmInfo);
            }
          }
        }
        // Also handle the singular participant field (for backwards compatibility)
        if (dm.participant?.id) {
          dmByUserId.set(dm.participant.id, dmInfo);
        }
      }

      // Transform workspace members to WorkspaceMemberForDM format
      const transformedMembers: WorkspaceMemberForDM[] = workspaceMembers.map(
        (member): WorkspaceMemberForDM => {
          const user = member.user || member;
          const userId = (user.id || member.userId || '') as string;
          const dmInfo = dmByUserId.get(userId);

          return {
            id: (member.id || `member-${userId}`) as string,
            userId,
            name: (user.displayName || user.name || 'Unknown') as string,
            displayName: user.displayName as string | undefined,
            email: user.email as string | undefined,
            avatarUrl: (user.avatarUrl || user.image) as string | undefined,
            status: user.status as string | undefined,
            isOrchestrator: (user.isOrchestrator || false) as boolean,
            existingDMId: dmInfo?.dmId || null,
            lastMessageAt: dmInfo?.lastMessageAt || null,
            unreadCount: dmInfo?.unreadCount || 0,
          };
        },
      );

      setMembers(transformedMembers);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [workspaceId, currentUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categorize members
  const { currentUserMember, membersWithDM, membersWithoutDM } = useMemo(() => {
    // Find current user
    const currentUser = members.find(m => m.userId === currentUserId) || null;

    // Other members (excluding current user)
    const otherMembers = members.filter(m => m.userId !== currentUserId);

    // Members with existing DMs - sorted by most recent message
    const withDM = otherMembers
      .filter(m => m.existingDMId)
      .sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) {
          return 0;
        }
        if (!a.lastMessageAt) {
          return 1;
        }
        if (!b.lastMessageAt) {
          return -1;
        }
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      });

    // Members without existing DMs - sorted alphabetically by name
    const withoutDM = otherMembers
      .filter(m => !m.existingDMId)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      currentUserMember: currentUser,
      membersWithDM: withDM,
      membersWithoutDM: withoutDM,
    };
  }, [members, currentUserId]);

  return {
    members,
    currentUserMember,
    membersWithDM,
    membersWithoutDM,
    isLoading,
    error,
    refetch: fetchData,
  };
}
