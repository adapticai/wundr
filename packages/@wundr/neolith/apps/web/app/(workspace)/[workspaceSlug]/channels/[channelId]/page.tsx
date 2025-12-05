'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';

import { ChannelHeader } from '@/components/channel';
import { CanvasTab } from '@/components/channel/canvas-tab';
import { ChannelDetailsPanel } from '@/components/channel/channel-details-panel';
import { EditChannelDialog } from '@/components/channel/edit-channel-dialog';
import { FilesTab } from '@/components/channel/files-tab';
import { InviteDialog } from '@/components/channel/invite-dialog';
import { NotificationsDialog } from '@/components/channel/notifications-dialog';
import {
  MessageList,
  MessageInput,
  ThreadPanel,
  TypingIndicator,
} from '@/components/chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import { useChannelPermissions } from '@/hooks/use-channel';
import {
  useMessages,
  useSendMessage,
  useChannel,
  useTypingIndicator,
  useThread,
} from '@/hooks/use-chat';
import { useToast } from '@/hooks/use-toast';

import type { ConversationTab } from '@/components/channel/shared';
import type { Channel, ChannelPermissions } from '@/types/channel';
import type { Message, User } from '@/types/chat';

// For channels, we currently support a subset of tabs
type ChannelTab = Extract<ConversationTab, 'messages' | 'canvas' | 'files'>;

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.channelId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChannelTab>('messages');

  // Dialog and panel states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  // isStarred is derived from channel data, with local state for optimistic updates
  const [localIsStarred, setLocalIsStarred] = useState<boolean | null>(null);

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

  // Fetch channel details
  const {
    channel,
    isLoading: isChannelLoading,
    refetch: refetchChannel,
  } = useChannel(channelId);

  // Fetch channel permissions
  const {
    permissions,
    isLoading: isPermissionsLoading,
  } = useChannelPermissions(channelId, currentUser?.id || '');

  // Derive isStarred: use local state for optimistic updates, fallback to channel data
  const channelWithStarred = channel as typeof channel & {
    isStarred?: boolean;
  };
  const isStarred = localIsStarred ?? channelWithStarred?.isStarred ?? false;

  // Sync local starred state when channel data loads
  useEffect(() => {
    if (channel && localIsStarred === null) {
      const channelData = channel as typeof channel & { isStarred?: boolean };
      setLocalIsStarred(channelData.isStarred ?? false);
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
  } = useMessages(channelId);

  // Send message hook
  const { sendMessage, editMessage, deleteMessage } = useSendMessage();

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    channelId,
    currentUser?.id || '',
  );

  // Thread state
  const {
    thread,
    isLoading: isThreadLoading,
    addOptimisticReply,
  } = useThread(activeThreadId || '');

  // Debug: log thread state changes
  useEffect(() => {
    console.log('[Channel] Thread state:', {
      activeThreadId,
      thread: thread
        ? {
            parentId: thread.parentMessage?.id,
            messagesCount: thread.messages?.length,
          }
        : null,
      isThreadLoading,
    });
  }, [activeThreadId, thread, isThreadLoading]);

  // Mark channel as read when opened
  useEffect(() => {
    if (channelId && currentUser && !isMessagesLoading) {
      fetch(`/api/channels/${channelId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(console.error);
    }
  }, [channelId, currentUser, isMessagesLoading]);

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
      addOptimisticMessage({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId,
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
            formData.append('channelId', channelId);

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
              console.error('[File Upload Error]', {
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
          { content, channelId, mentions, attachmentIds: uploadedFileIds },
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
        console.error('Failed to send message:', error);
        // Remove optimistic message on error
        removeOptimisticMessage(optimisticId);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to send message',
          variant: 'destructive',
        });
      }
    },
    [
      channelId,
      workspaceSlug,
      currentUser,
      sendMessage,
      addOptimisticMessage,
      updateOptimisticMessage,
      removeOptimisticMessage,
      toast,
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
      addOptimisticReply({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId,
        parentId: activeThreadId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
            formData.append('channelId', channelId);

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
              console.error('[Thread File Upload Error]', {
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
            channelId,
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
        console.error('Failed to send thread reply:', error);
        // Revert reply count on error
        updateOptimisticMessage(activeThreadId, {
          replyCount: Math.max(
            0,
            (messages.find(m => m.id === activeThreadId)?.replyCount || 1) - 1,
          ),
        });
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to send reply',
          variant: 'destructive',
        });
      }
    },
    [
      activeThreadId,
      channelId,
      workspaceSlug,
      currentUser,
      sendMessage,
      addOptimisticReply,
      updateOptimisticMessage,
      messages,
      toast,
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
                    count: r.count - 1,
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
                  count: r.count + 1,
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
      '[Channel] handleOpenThread called with message:',
      message.id,
      'replyCount:',
      message.replyCount,
      'content:',
      message.content?.slice(0, 50),
    );
    setActiveThreadId(message.id);
  }, []);

  // Handle close thread
  const handleCloseThread = useCallback(() => {
    setActiveThreadId(null);
  }, []);

  // Star toggle handler - must be before conditional returns
  const handleToggleStar = useCallback(async () => {
    const previousValue = isStarred;
    const newValue = !isStarred;

    // Optimistic update
    setLocalIsStarred(newValue);

    try {
      const method = previousValue ? 'DELETE' : 'POST';
      const response = await fetch(`/api/channels/${channelId}/star`, {
        method,
      });
      if (!response.ok) {
        // Revert on failure
        console.error('Failed to toggle star, reverting');
        setLocalIsStarred(previousValue);
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle star:', error);
      setLocalIsStarred(previousValue);
    }
  }, [channelId, isStarred]);

  // Leave channel handler - must be before conditional returns
  const handleLeaveChannel = useCallback(async () => {
    try {
      const response = await fetch(`/api/channels/${channelId}/members/leave`, {
        method: 'POST',
      });
      if (response.ok) {
        router.push(`/${workspaceSlug}/channels`);
      }
    } catch (error) {
      console.error('Failed to leave channel:', error);
    }
  }, [channelId, workspaceSlug, router]);

  // Edit channel handler - must be before conditional returns
  const handleEditChannel = useCallback(
    async (updates: { name?: string; description?: string }) => {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update channel');
      }
      // Refetch channel data
      await refetchChannel();
    },
    [channelId, refetchChannel],
  );

  // Remove member handler - must be before conditional returns
  const handleRemoveMember = useCallback(
    async (userId: string) => {
      const response = await fetch(
        `/api/channels/${channelId}/members/${userId}`,
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        throw new Error('Failed to remove member');
      }
    },
    [channelId],
  );

  // Change member role handler - must be before conditional returns
  const handleChangeMemberRole = useCallback(
    async (userId: string, role: 'admin' | 'member') => {
      const response = await fetch(
        `/api/channels/${channelId}/members/${userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: role.toUpperCase() }),
        },
      );
      if (!response.ok) {
        throw new Error('Failed to change member role');
      }
    },
    [channelId],
  );

  // Invite members handler - must be before conditional returns
  const handleInviteMembers = useCallback(
    async (userIds: string[], role: 'admin' | 'member') => {
      try {
        const response = await fetch(`/api/channels/${channelId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, role: role.toUpperCase() }),
        });

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: 'Failed to invite members' }));
          throw new Error(error.message || 'Failed to invite members');
        }

        // Refetch channel data to update member count
        await refetchChannel();

        // Show success toast
        toast({
          title: 'Success',
          description: `Successfully invited ${userIds.length} ${userIds.length === 1 ? 'member' : 'members'} to the channel`,
        });
      } catch (error) {
        // Show error toast
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to invite members',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [channelId, refetchChannel, toast],
  );

  // Invite members by email handler - must be before conditional returns
  const handleInviteByEmail = useCallback(
    async (emails: string[], role: 'admin' | 'member') => {
      try {
        const response = await fetch(`/api/channels/${channelId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails, role: role.toUpperCase() }),
        });

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: 'Failed to send email invites' }));
          throw new Error(error.message || 'Failed to send email invites');
        }

        // Show success toast
        toast({
          title: 'Success',
          description: `Successfully sent ${emails.length} email ${emails.length === 1 ? 'invite' : 'invites'}`,
        });
      } catch (error) {
        // Show error toast
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to send email invites',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [channelId, toast],
  );

  // Tab change handler - filter to only supported tabs for channels
  const handleTabChange = useCallback((tab: ConversationTab) => {
    // Channels only support messages, canvas, and files tabs for now
    if (tab === 'messages' || tab === 'canvas' || tab === 'files') {
      setActiveTab(tab);
    }
  }, []);

  const isLoading = isChannelLoading || isMessagesLoading || isAuthLoading || isPermissionsLoading;

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
          Please sign in to view this channel.
        </p>
      </div>
    );
  }

  // Transform channel data for ChannelHeader component
  type ChannelMemberRaw = {
    id?: string;
    userId?: string;
    displayName?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    image?: string;
    role?: string;
    user?: {
      id?: string;
      displayName?: string;
      name?: string;
      email?: string;
      avatarUrl?: string;
      image?: string;
    };
  };

  const channelForHeader: Channel | null = channel
    ? {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type as 'public' | 'private' | 'direct',
        workspaceId: workspaceSlug,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: '',
        members: ((channel.members || []) as ChannelMemberRaw[]).map(m => ({
          id: m.id || m.userId || '',
          userId: m.userId || m.id || '',
          user: {
            id: m.userId || m.user?.id || m.id || '',
            name:
              m.displayName ||
              m.name ||
              m.user?.displayName ||
              m.user?.name ||
              'Unknown',
            email: m.email || m.user?.email || '',
            image: m.avatarUrl || m.image || m.user?.avatarUrl || m.user?.image,
            status: 'online' as const,
          },
          channelId: channel.id,
          role: (m.role || 'member') as 'admin' | 'member',
          joinedAt: new Date(),
        })),
        memberCount: channel.members?.length || 0,
        unreadCount: 0,
        isStarred: isStarred,
        isArchived: false,
      }
    : null;

  // Permissions are now fetched from API via useChannelPermissions hook
  // Default to restrictive permissions if not loaded yet
  const effectivePermissions: ChannelPermissions = isPermissionsLoading
    ? {
        canEdit: false,
        canDelete: false,
        canArchive: false,
        canInvite: false,
        canRemoveMembers: false,
        canChangeRoles: false,
      }
    : permissions;

  return (
    <div className='flex h-[calc(100vh-4rem)] flex-col'>
      {/* Slack-like Channel Header */}
      {channelForHeader && (
        <ChannelHeader
          channel={channelForHeader}
          permissions={effectivePermissions}
          workspaceId={workspaceSlug}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onToggleStar={handleToggleStar}
          onLeave={handleLeaveChannel}
          onOpenDetails={() => setShowDetailsPanel(true)}
          onOpenSettings={() => setShowEditDialog(true)}
          onSummarize={() =>
            console.log('Summarize channel - AI feature coming soon')
          }
          onEditNotifications={() => setShowNotificationsDialog(true)}
          onAddTemplate={() =>
            console.log('Add template - feature coming soon')
          }
          onAddWorkflow={() =>
            console.log('Add workflow - feature coming soon')
          }
          onSearchInChannel={() =>
            console.log('Search in channel - feature coming soon')
          }
          onInvite={() => setShowDetailsPanel(true)}
          onStartHuddle={() =>
            toast({
              title: 'Coming Soon',
              description: 'Huddle feature is under development. Stay tuned!',
            })
          }
          onStartCall={type =>
            toast({
              title: 'Coming Soon',
              description: `${type === 'video' ? 'Video' : 'Audio'} calls are under development. Stay tuned!`,
            })
          }
        />
      )}

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
              channelId={channelId}
              currentUser={currentUser}
              placeholder={`Message #${channel?.name || 'channel'}...`}
              onSend={handleSendMessage}
              onTyping={startTyping}
              onStopTyping={stopTyping}
            />
          </div>
        )}

        {activeTab === 'canvas' && (
          <CanvasTab channelId={channelId} className='flex-1' />
        )}

        {activeTab === 'files' && (
          <FilesTab
            channelId={channelId}
            workspaceSlug={workspaceSlug}
            currentUserId={currentUser?.id}
            className='flex-1'
          />
        )}

        {/* Thread panel */}
        {activeTab === 'messages' && (
          <ThreadPanel
            thread={thread}
            currentUser={currentUser}
            channelId={channelId}
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
      </div>

      {/* Dialogs and Panels */}
      {channelForHeader && (
        <>
          <EditChannelDialog
            channel={channelForHeader}
            isOpen={showEditDialog}
            onClose={() => setShowEditDialog(false)}
            onSave={handleEditChannel}
          />

          <NotificationsDialog
            channelId={channelId}
            channelName={channelForHeader.name}
            isOpen={showNotificationsDialog}
            onClose={() => setShowNotificationsDialog(false)}
          />

          <ChannelDetailsPanel
            channel={channelForHeader}
            permissions={effectivePermissions}
            isOpen={showDetailsPanel}
            onClose={() => setShowDetailsPanel(false)}
            onEditChannel={() => {
              setShowDetailsPanel(false);
              setShowEditDialog(true);
            }}
            onEditNotifications={() => {
              setShowDetailsPanel(false);
              setShowNotificationsDialog(true);
            }}
            onInvite={() => {
              setShowDetailsPanel(false);
              setShowInviteDialog(true);
            }}
            onRemoveMember={handleRemoveMember}
            onChangeMemberRole={handleChangeMemberRole}
            currentUserId={currentUser?.id || ''}
          />

          <InviteDialog
            isOpen={showInviteDialog}
            onClose={() => setShowInviteDialog(false)}
            onInvite={handleInviteMembers}
            onInviteByEmail={handleInviteByEmail}
            workspaceId={workspaceSlug}
            channelId={channelId}
            channelName={channelForHeader.name}
            existingMemberIds={channelForHeader.members.map(m => m.userId)}
          />
        </>
      )}
    </div>
  );
}
