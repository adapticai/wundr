'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import {
  MessageList,
  MessageInput,
  ThreadPanel,
  TypingIndicator,
} from '@/components/chat';
import { DMHeader } from '@/components/channel/dm-header';
import { DMDetailsPanel } from '@/components/channel/dm-details-panel';
import { AddPeopleDialog } from '@/components/channel/add-people-dialog';
import { ConversationDetailsDialog } from '@/components/channel/conversation-details-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';
import {
  useMessages,
  useSendMessage,
  useChannel,
  useTypingIndicator,
  useThread,
} from '@/hooks/use-chat';
import { useHuddle } from '@/hooks/use-call';

import type { Message, User } from '@/types/chat';

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
  const [activeTab, setActiveTab] = useState<'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks'>('messages');
  // isStarred is derived from channel data, with local state for optimistic updates
  const [localIsStarred, setLocalIsStarred] = useState<boolean | null>(null);
  const [isStarring, setIsStarring] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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
  const isStarred = localIsStarred ?? (channel as any)?.isStarred ?? false;

  // Sync local starred state when channel data loads
  useEffect(() => {
    if (channel && localIsStarred === null) {
      setLocalIsStarred((channel as any).isStarred ?? false);
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
  const {
    activeHuddle,
    createHuddle,
    joinHuddle,
  } = useHuddle(workspaceSlug);

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
    if (!channel?.members || !currentUser) return [];
    // Cast members to any[] to handle various member formats from API
    const members = channel.members as any[];
    return members
      .filter((m) => {
        const memberId = m.userId || m.user?.id || m.id;
        return memberId !== currentUser.id;
      })
      .map((m) => ({
        id: m.userId || m.user?.id || m.id,
        name: m.displayName || m.name || m.user?.displayName || m.user?.name || 'Unknown',
        email: m.email || m.user?.email || '',
        image: m.avatarUrl || m.image || m.user?.avatarUrl || m.user?.image,
        status: 'online' as const,
        isOrchestrator: m.isOrchestrator || m.user?.isOrchestrator || false,
      }));
  }, [channel, currentUser]);

  // Get all members for details panel (including current user)
  const allMembers = useMemo(() => {
    if (!channel?.members || !currentUser) return [];
    const members = channel.members as any[];
    return members.map((m) => ({
      id: m.userId || m.user?.id || m.id,
      name: m.displayName || m.name || m.user?.displayName || m.user?.name || 'Unknown',
      email: m.email || m.user?.email || '',
      image: m.avatarUrl || m.image || m.user?.avatarUrl || m.user?.image,
      status: 'online' as const,
      isOrchestrator: m.isOrchestrator || m.user?.isOrchestrator || false,
    }));
  }, [channel, currentUser]);

  // Check if there's an active huddle for this conversation
  const conversationHuddle = useMemo(() => {
    if (!activeHuddle) return null;
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

      const { optimisticId, message } = await sendMessage(
        { content, channelId: dmId, mentions, attachments },
        currentUser,
      );

      // Add optimistic message
      addOptimisticMessage({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId: dmId,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: [],
      });

      // Replace optimistic message with real one
      if (message) {
        updateOptimisticMessage(optimisticId, { ...message, id: message.id });
      } else {
        // Remove on failure
        removeOptimisticMessage(optimisticId);
      }
    },
    [dmId, currentUser, sendMessage, addOptimisticMessage, updateOptimisticMessage, removeOptimisticMessage],
  );

  // Handle send thread reply
  const handleSendThreadReply = useCallback(
    async (content: string, mentions: string[], attachments: File[]) => {
      if (!activeThreadId || !currentUser) {
        return;
      }

      const { optimisticId } = await sendMessage(
        { content, channelId: dmId, parentId: activeThreadId, mentions, attachments },
        currentUser,
      );

      // Add optimistic reply
      addOptimisticReply({
        id: optimisticId,
        content,
        authorId: currentUser.id,
        author: currentUser,
        channelId: dmId,
        parentId: activeThreadId,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
        replyCount: 0,
        mentions: [],
        attachments: [],
      });

      // Update reply count on parent
      updateOptimisticMessage(activeThreadId, {
        replyCount: (messages.find((m) => m.id === activeThreadId)?.replyCount || 0) + 1,
      });
    },
    [activeThreadId, dmId, currentUser, sendMessage, addOptimisticReply, updateOptimisticMessage, messages],
  );

  // Handle edit message
  const handleEditMessage = useCallback(
    async (message: Message) => {
      const result = await editMessage(message.id, { content: message.content });
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
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        return;
      }

      const existingReaction = message.reactions.find((r) => r.emoji === emoji);
      let updatedReactions = [...message.reactions];

      if (existingReaction) {
        if (existingReaction.hasReacted) {
          // Remove user's reaction
          if (existingReaction.count === 1) {
            updatedReactions = updatedReactions.filter((r) => r.emoji !== emoji);
          } else {
            updatedReactions = updatedReactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.count - 1,
                    hasReacted: false,
                    users: r.users.filter((u) => u.id !== currentUser.id),
                  }
                : r,
            );
          }
        } else {
          // Add user's reaction
          updatedReactions = updatedReactions.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count + 1,
                  hasReacted: true,
                  users: [...r.users, currentUser],
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
          users: [currentUser],
        });
      }

      updateOptimisticMessage(messageId, { reactions: updatedReactions });

      // Send to server
      try {
        await fetch(`/api/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      } catch {
        // Revert on error
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
      const participantNames = participants.map((p) => p.name).slice(0, 2).join(', ');
      const huddleName = participants.length > 2
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

  // Handle search
  const handleSearch = useCallback(() => {
    // TODO: Implement search in conversation
    toast.info('Search in conversation coming soon');
  }, []);

  // Handle star toggle
  const handleToggleStar = useCallback(async () => {
    if (isStarring) return;

    const previousValue = isStarred;
    const newValue = !isStarred;

    // Optimistic update
    setIsStarring(true);
    setLocalIsStarred(newValue);

    try {
      const method = previousValue ? 'DELETE' : 'POST';
      const response = await fetch(`/api/conversations/${dmId}/star`, { method });
      if (!response.ok) {
        // Revert on failure
        console.error('Failed to toggle star, reverting');
        setLocalIsStarred(previousValue);
        toast.error('Failed to update star status');
      } else {
        toast.success(newValue ? 'Conversation starred' : 'Conversation unstarred');
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
    setIsMuted((prev) => !prev);
    try {
      await fetch(`/api/channels/${dmId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: isMuted ? 'all' : 'muted' }),
      });
      toast.success(isMuted ? 'Notifications enabled' : 'Conversation muted');
    } catch {
      setIsMuted((prev) => !prev); // Revert on error
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
    const names = participants.map((p) => p.name).join(', ');
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
  const handleNotificationChange = useCallback(async (setting: 'all' | 'mentions' | 'nothing' | 'muted') => {
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
  }, [dmId]);

  // Handle add people
  const handleAddPeople = useCallback(async (userIds: string[], includeHistory: boolean) => {
    try {
      await fetch(`/api/channels/${dmId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, includeHistory }),
      });
      toast.success(`Added ${userIds.length} ${userIds.length === 1 ? 'person' : 'people'} to the conversation`);
    } catch {
      toast.error('Failed to add people to conversation');
    }
  }, [dmId]);

  // Handle start DM with member
  const handleStartDMWithMember = useCallback((userId: string) => {
    router.push(`/${workspaceSlug}/messages/new?to=${userId}`);
  }, [router, workspaceSlug]);

  // Handle tab change
  const handleTabChange = useCallback((tab: 'messages' | 'canvas' | 'files' | 'lists' | 'workflows' | 'bookmarks') => {
    setActiveTab(tab);
    // TODO: Load content for the selected tab
  }, []);

  // Handle add tab
  const handleAddTab = useCallback((tabType: string) => {
    // TODO: Implement add tab functionality
    toast.info(`Adding ${tabType} tab coming soon`);
  }, []);

  const isLoading = isChannelLoading || isMessagesLoading || isAuthLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Require authentication
  if (!currentUser) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view this conversation.</p>
      </div>
    );
  }

  // Get conversation display name for placeholder
  const conversationDisplayName = participants.length === 1
    ? participants[0].name
    : participants.length > 1
    ? `${participants[0].name} and ${participants.length - 1} other${participants.length > 2 ? 's' : ''}`
    : 'this conversation';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
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
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <MessageList
            messages={messages}
            currentUser={currentUser}
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

        {/* Thread panel */}
        <ThreadPanel
          thread={thread}
          currentUser={currentUser}
          channelId={dmId}
          isLoading={isThreadLoading}
          isOpen={!!activeThreadId}
          onClose={handleCloseThread}
          onSendReply={handleSendThreadReply}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReaction={handleReaction}
        />

        {/* Details panel */}
        <DMDetailsPanel
          isOpen={isDetailsPanelOpen}
          members={allMembers}
          currentUserId={currentUser.id}
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
        existingMemberIds={allMembers.map((m) => m.id)}
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
        onViewProfile={(userId) => {
          router.push(`/${workspaceSlug}/profile/${userId}`);
        }}
        onStartDM={handleStartDMWithMember}
        onToggleStar={handleToggleStar}
        onToggleMute={handleToggleMute}
        onArchive={handleArchive}
        onLeave={handleLeave}
      />
    </div>
  );
}
