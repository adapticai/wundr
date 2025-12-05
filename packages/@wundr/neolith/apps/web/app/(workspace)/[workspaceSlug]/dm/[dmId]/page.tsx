'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import { AddPeopleDialog } from '@/components/channel/add-people-dialog';
import { ConversationDetailsDialog } from '@/components/channel/conversation-details-dialog';
import { DMDetailsPanel } from '@/components/channel/dm-details-panel';
import { DMHeader } from '@/components/channel/dm-header';
import { FilesTab } from '@/components/channel/files-tab';
import {
  MessageList,
  MessageInput,
  ThreadPanel,
  TypingIndicator,
} from '@/components/chat';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import { useHuddle } from '@/hooks/use-call';
import {
  useMessages,
  useSendMessage,
  useChannel,
  useTypingIndicator,
  useThread,
} from '@/hooks/use-chat';

import type { ChannelMember } from '@/types/channel';
import type { Message, User } from '@/types/chat';

/**
 * Flexible member type that can represent various API response formats
 */
type FlexibleMember = ChannelMember | (User & Partial<ChannelMember>);

/**
 * Type guard and transformer for channel member data
 * Handles both ChannelMember format and various API response formats
 */
function normalizeChannelMember(
  member: FlexibleMember,
  currentUser: User | null,
): User & { isOrchestrator: boolean } {
  // Type-safe extraction with fallbacks
  const memberId =
    'userId' in member
      ? member.userId
      : 'user' in member &&
          typeof member.user === 'object' &&
          member.user !== null &&
          'id' in member.user
        ? member.user.id
        : 'id' in member
          ? member.id
          : '';

  const memberUser =
    'user' in member && typeof member.user === 'object' && member.user !== null
      ? member.user
      : member;

  const displayName =
    'displayName' in memberUser && typeof memberUser.displayName === 'string'
      ? memberUser.displayName
      : 'name' in memberUser && typeof memberUser.name === 'string'
        ? memberUser.name
        : 'Unknown';

  const email =
    'email' in memberUser && typeof memberUser.email === 'string'
      ? memberUser.email
      : '';

  const avatarUrl =
    'avatarUrl' in memberUser && typeof memberUser.avatarUrl === 'string'
      ? memberUser.avatarUrl
      : 'image' in memberUser && typeof memberUser.image === 'string'
        ? memberUser.image
        : undefined;

  const isOrchestrator =
    ('isOrchestrator' in member && member.isOrchestrator === true) ||
    ('isOrchestrator' in memberUser && memberUser.isOrchestrator === true) ||
    false;

  return {
    id: typeof memberId === 'string' ? memberId : String(memberId || ''),
    name: displayName,
    email,
    image: avatarUrl,
    status: 'online' as const,
    isOrchestrator,
  };
}

export default function DMPage() {
  const params = useParams();
  const router = useRouter();
  const dmId = params.dmId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  // UI state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks'
  >('messages');
  // isStarred is derived from channel data, with local state for optimistic updates
  const [localIsStarred, setLocalIsStarred] = useState<boolean | null>(null);
  const [isStarring, setIsStarring] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Convert auth user to chat User type
  const currentUser = useMemo<User | null>(() => {
    if (!authUser) {
      return null;
    }
    return {
      id: authUser.id,
      name: authUser.name || 'Unknown User',
      email: authUser.email || '',
      image: authUser.image,
      status: 'online',
    };
  }, [authUser]);

  // Fetch DM channel details (DMs are channels with type 'direct')
  const { channel, isLoading: isChannelLoading } = useChannel(dmId);

  // Derive isStarred: use local state for optimistic updates, fallback to channel data
  const isStarred = localIsStarred ?? channel?.isStarred ?? false;

  // Sync local starred state when channel data loads
  useEffect(() => {
    if (channel && localIsStarred === null) {
      setLocalIsStarred(channel.isStarred ?? false);
    }
  }, [channel, localIsStarred]);

  // Fetch messages
  const {
    messages,
    isLoading: isMessagesLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  } = useMessages(dmId);

  // Send message hook
  const { sendMessage, editMessage, deleteMessage } = useSendMessage();

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    dmId,
    currentUser?.id || '',
  );

  // Thread state
  const {
    thread,
    isLoading: isThreadLoading,
    addOptimisticReply,
  } = useThread(activeThreadId || '');

  // Huddle state
  const { activeHuddle, createHuddle, joinHuddle } = useHuddle(workspaceSlug);

  // Mark channel as read when opened
  useEffect(() => {
    if (dmId && currentUser && !isMessagesLoading) {
      fetch(`/api/channels/${dmId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(console.error);
    }
  }, [dmId, currentUser, isMessagesLoading]);

  // Get all participants (other users in the DM, excluding current user)
  const participants = useMemo(() => {
    if (!channel?.members || !currentUser) {
      return [];
    }
    return channel.members
      .map(m => normalizeChannelMember(m, currentUser))
      .filter(user => user.id !== currentUser.id);
  }, [channel, currentUser]);

  // Get all members for details panel (including current user)
  const allMembers = useMemo(() => {
    if (!channel?.members || !currentUser) {
      return [];
    }
    return channel.members.map(m => normalizeChannelMember(m, currentUser));
  }, [channel, currentUser]);

  // Check if there's an active huddle for this conversation
  const conversationHuddle = useMemo(() => {
    if (!activeHuddle) {
      return null;
    }
    // Check if the huddle is for this DM channel
    if (activeHuddle.channelId === dmId) {
      return activeHuddle;
    }
    return null;
  }, [activeHuddle, dmId]);

  // Handle send message
  const handleSendMessage = useCallback(
    async (content: string, mentions: string[], attachments: File[]) => {
      if (!currentUser) {
        return;
      }

      // Generate optimistic ID upfront
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create optimistic attachments for immediate display
      const optimisticAttachments = attachments.map((file, index) => ({
        id: `optimistic-attachment-${index}`,
        name: file.name,
        url: URL.createObjectURL(file), // Temporary URL for preview
        type: file.type.startsWith('image/')
          ? ('image' as const)
          : file.type.startsWith('video/')
            ? ('video' as const)
            : file.type.startsWith('audio/')
              ? ('audio' as const)
              : ('file' as const),
        size: file.size,
        mimeType: file.type,
      }));

      // Add optimistic message FIRST for immediate feedback
      const now = new Date().toISOString();
      addOptimisticMessage({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId: dmId,
        parentId: null,
        createdAt: now,
        updatedAt: now,
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: optimisticAttachments,
      });

      try {
        // Upload files if any
        let uploadedFileIds: string[] = [];
        if (attachments.length > 0) {
          const uploadPromises = attachments.map(async file => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('workspaceId', workspaceSlug);
            formData.append('channelId', dmId);

            const response = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
              const errorMessage =
                result?.message ||
                result?.error ||
                `Failed to upload ${file.name}`;
              console.error('[DM File Upload Error]', {
                file: file.name,
                status: response.status,
                result,
              });
              throw new Error(errorMessage);
            }

            return result.data.file.id;
          });

          uploadedFileIds = await Promise.all(uploadPromises);
        }

        // Send message with file IDs
        const { message } = await sendMessage(
          {
            content,
            channelId: dmId,
            mentions,
            attachmentIds: uploadedFileIds,
          },
          currentUser,
        );

        // Replace optimistic message with real one
        if (message) {
          updateOptimisticMessage(optimisticId, { ...message, id: message.id });
        } else {
          // Remove on failure
          removeOptimisticMessage(optimisticId);
        }

        // Cleanup temporary blob URLs
        optimisticAttachments.forEach(att => {
          if (att.url.startsWith('blob:')) {
            URL.revokeObjectURL(att.url);
          }
        });
      } catch (error) {
        console.error('Failed to send DM:', error);
        // Remove optimistic message on error
        removeOptimisticMessage(optimisticId);
        toast.error(
          error instanceof Error ? error.message : 'Failed to send message',
        );
      }
    },
    [
      dmId,
      workspaceSlug,
      currentUser,
      sendMessage,
      addOptimisticMessage,
      updateOptimisticMessage,
      removeOptimisticMessage,
    ],
  );

  // Handle send thread reply
  const handleSendThreadReply = useCallback(
    async (content: string, mentions: string[], attachments: File[]) => {
      if (!activeThreadId || !currentUser) {
        return;
      }

      // Generate optimistic ID upfront
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create optimistic attachments for immediate display
      const optimisticAttachments = attachments.map((file, index) => ({
        id: `optimistic-attachment-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/')
          ? ('image' as const)
          : file.type.startsWith('video/')
            ? ('video' as const)
            : file.type.startsWith('audio/')
              ? ('audio' as const)
              : ('file' as const),
        size: file.size,
        mimeType: file.type,
      }));

      // Add optimistic reply FIRST for immediate feedback
      const now = new Date().toISOString();
      addOptimisticReply({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId: dmId,
        parentId: activeThreadId,
        createdAt: now,
        updatedAt: now,
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: optimisticAttachments,
      });

      // Update reply count on parent optimistically
      updateOptimisticMessage(activeThreadId, {
        replyCount:
          (messages.find(m => m.id === activeThreadId)?.replyCount || 0) + 1,
      });

      try {
        // Upload files if any
        let uploadedFileIds: string[] = [];
        if (attachments.length > 0) {
          const uploadPromises = attachments.map(async file => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('workspaceId', workspaceSlug);
            formData.append('channelId', dmId);

            const response = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
              const errorMessage =
                result?.message ||
                result?.error ||
                `Failed to upload ${file.name}`;
              console.error('[DM Thread File Upload Error]', {
                file: file.name,
                status: response.status,
                result,
              });
              throw new Error(errorMessage);
            }

            return result.data.file.id;
          });

          uploadedFileIds = await Promise.all(uploadPromises);
        }

        // Send message with file IDs
        await sendMessage(
          {
            content,
            channelId: dmId,
            parentId: activeThreadId,
            mentions,
            attachmentIds: uploadedFileIds,
          },
          currentUser,
        );

        // Cleanup temporary blob URLs
        optimisticAttachments.forEach(att => {
          if (att.url.startsWith('blob:')) {
            URL.revokeObjectURL(att.url);
          }
        });
      } catch (error) {
        console.error('Failed to send DM thread reply:', error);
        // Revert reply count on error
        updateOptimisticMessage(activeThreadId, {
          replyCount: Math.max(
            0,
            (messages.find(m => m.id === activeThreadId)?.replyCount || 1) - 1,
          ),
        });
        toast.error(
          error instanceof Error ? error.message : 'Failed to send reply',
        );
      }
    },
    [
      activeThreadId,
      dmId,
      workspaceSlug,
      currentUser,
      sendMessage,
      addOptimisticReply,
      updateOptimisticMessage,
      messages,
    ],
  );

  // Handle edit message
  const handleEditMessage = useCallback(
    async (message: Message) => {
      const result = await editMessage(message.id, {
        content: message.content,
      });
      if (result) {
        updateOptimisticMessage(message.id, result);
      }
    },
    [editMessage, updateOptimisticMessage],
  );

  // Handle delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const success = await deleteMessage(messageId);
      if (success) {
        removeOptimisticMessage(messageId);
      }
    },
    [deleteMessage, removeOptimisticMessage],
  );

  // Handle reaction toggle
  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUser) {
        return;
      }

      // Optimistic update
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        return;
      }

      const existingReaction = message.reactions.find(r => r.emoji === emoji);
      let updatedReactions = [...message.reactions];

      if (existingReaction) {
        if (existingReaction.hasReacted) {
          // Remove user's reaction
          if (existingReaction.count === 1) {
            updatedReactions = updatedReactions.filter(r => r.emoji !== emoji);
          } else {
            updatedReactions = updatedReactions.map(r =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: (r.count || 1) - 1,
                    hasReacted: false,
                    userIds: (r.userIds || []).filter(
                      id => id !== currentUser.id,
                    ),
                  }
                : r,
            );
          }
        } else {
          // Add user's reaction
          updatedReactions = updatedReactions.map(r =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: (r.count || 0) + 1,
                  hasReacted: true,
                  userIds: [...(r.userIds || []), currentUser.id],
                }
              : r,
          );
        }
      } else {
        // New reaction
        updatedReactions.push({
          emoji,
          count: 1,
          hasReacted: true,
          userIds: [currentUser.id],
        });
      }

      updateOptimisticMessage(messageId, { reactions: updatedReactions });

      // Send to server - use DELETE if removing, POST if adding
      const isRemoving = existingReaction?.hasReacted;
      try {
        let response: Response;
        if (isRemoving) {
          response = await fetch(
            `/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
            {
              method: 'DELETE',
            },
          );
        } else {
          response = await fetch(`/api/messages/${messageId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji }),
          });
        }
        // Handle 409 Conflict (already reacted) - no need to revert, state is already correct
        if (!response.ok && response.status !== 409) {
          // Revert on actual error (not conflict)
          updateOptimisticMessage(messageId, { reactions: message.reactions });
        }
      } catch {
        // Revert on network error
        updateOptimisticMessage(messageId, { reactions: message.reactions });
      }
    },
    [currentUser, messages, updateOptimisticMessage],
  );

  // Handle reply (open thread)
  const handleReply = useCallback((message: Message) => {
    setActiveThreadId(message.id);
  }, []);

  // Handle open thread
  const handleOpenThread = useCallback((message: Message) => {
    console.log(
      '[DM] handleOpenThread called with message:',
      message.id,
      'replyCount:',
      message.replyCount,
    );
    setActiveThreadId(message.id);
  }, []);

  // Handle close thread
  const handleCloseThread = useCallback(() => {
    setActiveThreadId(null);
  }, []);

  // Handle start/join huddle
  const handleStartHuddle = useCallback(async () => {
    if (conversationHuddle) {
      // Join existing huddle
      await joinHuddle(conversationHuddle.id);
    } else {
      // Create new huddle for this conversation
      const participantNames = participants
        .map(p => p.name)
        .slice(0, 2)
        .join(', ');
      const huddleName =
        participants.length > 2
          ? `${participantNames} +${participants.length - 2}`
          : participantNames || 'Huddle';
      await createHuddle(huddleName, dmId);
    }
  }, [conversationHuddle, joinHuddle, createHuddle, dmId, participants]);

  // Handle copy huddle link
  const handleCopyHuddleLink = useCallback(() => {
    const huddleUrl = `${window.location.origin}/${workspaceSlug}/dm/${dmId}/huddle`;
    navigator.clipboard.writeText(huddleUrl);
    toast.success('Huddle link copied to clipboard');
  }, [workspaceSlug, dmId]);

  // Search filtered messages
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const query = searchQuery.toLowerCase();
    return messages
      .filter(msg => {
        // Search in message content
        if (msg.content.toLowerCase().includes(query)) {
          return true;
        }
        // Search in author name
        if (msg.author?.name?.toLowerCase().includes(query)) {
          return true;
        }
        // Search in attachments
        if (
          msg.attachments?.some(att => att.name.toLowerCase().includes(query))
        ) {
          return true;
        }
        return false;
      })
      .map(msg => {
        // Get snippet context
        const contentLower = msg.content.toLowerCase();
        const queryIndex = contentLower.indexOf(query);
        let snippet = msg.content;
        if (queryIndex !== -1 && msg.content.length > 100) {
          const start = Math.max(0, queryIndex - 40);
          const end = Math.min(msg.content.length, queryIndex + query.length + 40);
          snippet =
            (start > 0 ? '...' : '') +
            msg.content.slice(start, end) +
            (end < msg.content.length ? '...' : '');
        }
        return {
          message: msg,
          snippet: snippet.slice(0, 150),
        };
      });
  }, [messages, searchQuery]);

  // Handle search
  const handleSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Handle scroll to message
  const handleScrollToMessage = useCallback((messageId: string) => {
    // Close search dialog
    setIsSearchOpen(false);
    setSearchQuery('');

    // Find message element and scroll to it
    setTimeout(() => {
      const messageElement = document.querySelector(
        `[data-message-id="${messageId}"]`,
      );
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message temporarily
        messageElement.classList.add('bg-accent/50');
        setTimeout(() => {
          messageElement.classList.remove('bg-accent/50');
        }, 2000);
      }
    }, 100);
  }, []);

  // Handle star toggle
  const handleToggleStar = useCallback(async () => {
    if (isStarring) {
      return;
    }

    const previousValue = isStarred;
    const newValue = !isStarred;

    // Optimistic update
    setIsStarring(true);
    setLocalIsStarred(newValue);

    try {
      const method = previousValue ? 'DELETE' : 'POST';
      const response = await fetch(`/api/conversations/${dmId}/star`, {
        method,
      });
      if (!response.ok) {
        // Revert on failure
        console.error('Failed to toggle star, reverting');
        setLocalIsStarred(previousValue);
        toast.error('Failed to update star status');
      } else {
        toast.success(
          newValue ? 'Conversation starred' : 'Conversation unstarred',
        );
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle star:', error);
      setLocalIsStarred(previousValue);
      toast.error('Failed to update star status');
    } finally {
      setIsStarring(false);
    }
  }, [dmId, isStarred, isStarring]);

  // Handle mute toggle
  const handleToggleMute = useCallback(async () => {
    setIsMuted(prev => !prev);
    try {
      await fetch(`/api/channels/${dmId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: isMuted ? 'all' : 'muted' }),
      });
      toast.success(isMuted ? 'Notifications enabled' : 'Conversation muted');
    } catch {
      setIsMuted(prev => !prev); // Revert on error
      toast.error('Failed to update notification settings');
    }
  }, [dmId, isMuted]);

  // Handle archive conversation
  const handleArchive = useCallback(async () => {
    try {
      await fetch(`/api/channels/${dmId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Conversation archived');
      router.push(`/${workspaceSlug}/messages`);
    } catch {
      toast.error('Failed to archive conversation');
    }
  }, [dmId, workspaceSlug, router]);

  // Handle leave conversation
  const handleLeave = useCallback(async () => {
    try {
      await fetch(`/api/channels/${dmId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Left conversation');
      router.push(`/${workspaceSlug}/messages`);
    } catch {
      toast.error('Failed to leave conversation');
    }
  }, [dmId, workspaceSlug, router]);

  // Handle copy name
  const handleCopyName = useCallback(() => {
    const names = participants.map(p => p.name).join(', ');
    navigator.clipboard.writeText(names);
    toast.success('Name copied to clipboard');
  }, [participants]);

  // Handle copy link
  const handleCopyLink = useCallback(() => {
    const conversationUrl = `${window.location.origin}/${workspaceSlug}/dm/${dmId}`;
    navigator.clipboard.writeText(conversationUrl);
    toast.success('Link copied to clipboard');
  }, [workspaceSlug, dmId]);

  // Handle open in new window
  const handleOpenInNewWindow = useCallback(() => {
    const conversationUrl = `${window.location.origin}/${workspaceSlug}/dm/${dmId}`;
    window.open(conversationUrl, '_blank', 'noopener,noreferrer');
  }, [workspaceSlug, dmId]);

  // Handle AI summarize
  const handleSummarize = useCallback(() => {
    // TODO: Implement AI summarize
    toast.info('AI summarization coming soon');
  }, []);

  // Handle notification change
  const handleNotificationChange = useCallback(
    async (setting: 'all' | 'mentions' | 'nothing' | 'muted') => {
      try {
        await fetch(`/api/channels/${dmId}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setting }),
        });
        toast.success('Notification preferences updated');
      } catch {
        toast.error('Failed to update notification preferences');
      }
    },
    [dmId],
  );

  // Handle add people
  const handleAddPeople = useCallback(
    async (userIds: string[], includeHistory: boolean) => {
      try {
        await fetch(`/api/channels/${dmId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, includeHistory }),
        });
        toast.success(
          `Added ${userIds.length} ${userIds.length === 1 ? 'person' : 'people'} to the conversation`,
        );
      } catch {
        toast.error('Failed to add people to conversation');
      }
    },
    [dmId],
  );

  // Handle start DM with member
  const handleStartDMWithMember = useCallback(
    (userId: string) => {
      router.push(`/${workspaceSlug}/messages/new?to=${userId}`);
    },
    [router, workspaceSlug],
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (
      tab: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks',
    ) => {
      setActiveTab(tab);
      // TODO: Load content for the selected tab
    },
    [],
  );

  // Handle add tab
  const handleAddTab = useCallback((tabType: string) => {
    // TODO: Implement add tab functionality
    toast.info(`Adding ${tabType} tab coming soon`);
  }, []);

  // Debug: log thread state changes
  useEffect(() => {
    console.log('[DM] Thread state:', {
      activeThreadId,
      thread,
      isThreadLoading,
    });
  }, [activeThreadId, thread, isThreadLoading]);

  const isLoading = isChannelLoading || isMessagesLoading || isAuthLoading;

  if (isLoading) {
    return (
      <div className='flex h-[calc(100vh-4rem)] items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  // Require authentication
  if (!currentUser) {
    return (
      <div className='flex h-[calc(100vh-4rem)] items-center justify-center'>
        <p className='text-muted-foreground'>
          Please sign in to view this conversation.
        </p>
      </div>
    );
  }

  // Get conversation display name for placeholder
  const conversationDisplayName =
    participants.length === 1
      ? participants[0].name
      : participants.length > 1
        ? `${participants[0].name} and ${participants.length - 1} other${participants.length > 2 ? 's' : ''}`
        : 'this conversation';

  return (
    <div className='flex h-[calc(100vh-4rem)] flex-col'>
      {/* DM Header */}
      <DMHeader
        participants={participants}
        workspaceId={workspaceSlug}
        conversationId={dmId}
        hasActiveHuddle={!!conversationHuddle}
        huddleParticipantCount={conversationHuddle?.participants.length || 0}
        isStarred={isStarred}
        isStarring={isStarring}
        activeTab={activeTab}
        onStartHuddle={handleStartHuddle}
        onCopyHuddleLink={handleCopyHuddleLink}
        onNotificationChange={handleNotificationChange}
        onSearch={handleSearch}
        onViewDetails={() => setIsDetailsDialogOpen(true)}
        onToggleStar={handleToggleStar}
        onCopyName={handleCopyName}
        onCopyLink={handleCopyLink}
        onOpenInNewWindow={handleOpenInNewWindow}
        onSummarize={handleSummarize}
        onTabChange={handleTabChange}
        onAddTab={handleAddTab}
      />

      {/* Main content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Tab content */}
        {activeTab === 'messages' && (
          <div className='flex flex-1 flex-col'>
            <MessageList
              messages={messages}
              currentUser={currentUser}
              workspaceSlug={workspaceSlug}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onReply={handleReply}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onReaction={handleReaction}
              onOpenThread={handleOpenThread}
            />

            {/* Typing indicator */}
            <TypingIndicator typingUsers={typingUsers} />

            {/* Message input */}
            <MessageInput
              channelId={dmId}
              currentUser={currentUser}
              placeholder={`Message ${conversationDisplayName}...`}
              onSend={handleSendMessage}
              onTyping={startTyping}
              onStopTyping={stopTyping}
            />
          </div>
        )}

        {activeTab === 'files' && (
          <FilesTab
            channelId={dmId}
            workspaceSlug={workspaceSlug}
            currentUserId={currentUser?.id}
            mode='conversation'
            className='flex-1'
          />
        )}

        {activeTab === 'canvas' && (
          <div className='flex flex-1 items-center justify-center text-muted-foreground'>
            Canvas tab coming soon
          </div>
        )}

        {(activeTab === 'lists' ||
          activeTab === 'workflows' ||
          activeTab === 'bookmarks') && (
          <div className='flex flex-1 items-center justify-center text-muted-foreground'>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab coming
            soon
          </div>
        )}

        {/* Thread panel - only show on messages tab */}
        {activeTab === 'messages' && (
          <ThreadPanel
            thread={thread}
            currentUser={currentUser}
            channelId={dmId}
            workspaceSlug={workspaceSlug}
            isLoading={isThreadLoading}
            isOpen={!!activeThreadId}
            onClose={handleCloseThread}
            onSendReply={handleSendThreadReply}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onReaction={handleReaction}
          />
        )}

        {/* Details panel */}
        <DMDetailsPanel
          isOpen={isDetailsPanelOpen}
          members={allMembers}
          currentUserId={currentUser.id}
          workspaceId={channel?.workspaceId || workspaceSlug}
          channelId={dmId}
          conversationName={channel?.name}
          onClose={() => setIsDetailsPanelOpen(false)}
          onAddPeople={() => setIsAddPeopleOpen(true)}
          onStartDM={handleStartDMWithMember}
        />
      </div>

      {/* Add people dialog */}
      <AddPeopleDialog
        isOpen={isAddPeopleOpen}
        workspaceSlug={workspaceSlug}
        conversationId={dmId}
        existingMemberIds={allMembers.map(m => m.id)}
        onClose={() => setIsAddPeopleOpen(false)}
        onAddPeople={handleAddPeople}
      />

      {/* Conversation details dialog (modal with tabs) */}
      <ConversationDetailsDialog
        isOpen={isDetailsDialogOpen}
        conversationId={dmId}
        members={allMembers}
        currentUserId={currentUser.id}
        isStarred={isStarred}
        isMuted={isMuted}
        onClose={() => setIsDetailsDialogOpen(false)}
        onAddPeople={() => {
          setIsDetailsDialogOpen(false);
          setIsAddPeopleOpen(true);
        }}
        onViewProfile={userId => {
          router.push(`/${workspaceSlug}/profile/${userId}`);
        }}
        onStartDM={handleStartDMWithMember}
        onToggleStar={handleToggleStar}
        onToggleMute={handleToggleMute}
        onArchive={handleArchive}
        onLeave={handleLeave}
      />

      {/* Search dialog */}
      <CommandDialog
        open={isSearchOpen}
        onOpenChange={open => {
          setIsSearchOpen(open);
          if (!open) {
            setSearchQuery('');
          }
        }}
      >
        <CommandInput
          placeholder='Search messages...'
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No messages found.</CommandEmpty>
          <CommandGroup heading='Messages'>
            {searchResults.map(({ message, snippet }) => {
              const timestamp = new Date(message.createdAt).toLocaleString(
                undefined,
                {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                },
              );
              return (
                <CommandItem
                  key={message.id}
                  value={message.id}
                  onSelect={() => handleScrollToMessage(message.id)}
                  className='flex flex-col items-start gap-1 py-3'
                >
                  <div className='flex w-full items-center justify-between gap-2'>
                    <span className='font-medium text-sm'>
                      {message.author?.name || 'Unknown'}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {timestamp}
                    </span>
                  </div>
                  <p className='text-sm text-muted-foreground line-clamp-2'>
                    {snippet}
                  </p>
                  {message.attachments && message.attachments.length > 0 && (
                    <span className='text-xs text-muted-foreground'>
                      {message.attachments.length}{' '}
                      {message.attachments.length === 1
                        ? 'attachment'
                        : 'attachments'}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
