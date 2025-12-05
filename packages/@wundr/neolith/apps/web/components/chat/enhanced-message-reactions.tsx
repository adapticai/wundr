'use client';

/**
 * Enhanced Message Reactions Integration
 *
 * This file provides an enhanced message component wrapper that integrates:
 * - Reaction display with user tooltips
 * - Popover-based emoji picker
 * - Optimistic UI updates
 * - API integration for adding/removing reactions
 *
 * Usage:
 * import { EnhancedMessageReactions } from '@/components/chat/enhanced-message-reactions';
 *
 * <EnhancedMessageReactions
 *   message={message}
 *   currentUser={currentUser}
 *   workspaceSlug={workspaceSlug}
 * />
 */

import { useCallback, useMemo, useState, useTransition } from 'react';

import { ReactionDisplay, type ReactionWithUsers } from './reaction-display';
import { ReactionPickerPopover } from './reaction-picker-popover';

import type { Message, User } from '@/types/chat';

interface EnhancedMessageReactionsProps {
  message: Message;
  currentUser: User;
  workspaceSlug?: string;
  className?: string;
}

/**
 * Fetch user details from the API for reactions
 */
async function fetchReactionUsers(
  messageId: string,
  workspaceSlug: string,
): Promise<ReactionWithUsers[]> {
  try {
    const response = await fetch(`/api/messages/${messageId}/reactions`);
    if (!response.ok) {
      throw new Error('Failed to fetch reactions');
    }
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching reaction users:', error);
    return [];
  }
}

/**
 * Add or remove a reaction via API
 */
async function toggleReactionAPI(
  messageId: string,
  emoji: string,
  hasReacted: boolean,
): Promise<void> {
  if (hasReacted) {
    // Remove reaction
    const response = await fetch(
      `/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok) {
      throw new Error('Failed to remove reaction');
    }
  } else {
    // Add reaction
    const response = await fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji }),
    });
    if (!response.ok) {
      throw new Error('Failed to add reaction');
    }
  }
}

export function EnhancedMessageReactions({
  message,
  currentUser,
  workspaceSlug,
  className,
}: EnhancedMessageReactionsProps) {
  // Local state for reactions with optimistic updates
  const [reactions, setReactions] = useState<ReactionWithUsers[]>([]);
  const [isPending, startTransition] = useTransition();

  /**
   * Transform message reactions to include user data
   * This ensures compatibility with the ReactionDisplay component
   */
  const reactionsWithUsers = useMemo((): ReactionWithUsers[] => {
    if (reactions.length > 0) {
      return reactions;
    }

    // Fallback to message reactions if not yet loaded
    return (message.reactions || []).map(reaction => ({
      ...reaction,
      users: reaction.userIds?.map(userId => ({
        id: userId,
        name: userId === currentUser.id ? 'You' : 'User',
        displayName: null,
      })),
    }));
  }, [reactions, message.reactions, currentUser.id]);

  /**
   * Load full reaction data with user details on mount
   */
  useMemo(() => {
    if (workspaceSlug && message.reactions && message.reactions.length > 0) {
      fetchReactionUsers(message.id, workspaceSlug).then(setReactions);
    }
  }, [message.id, message.reactions, workspaceSlug]);

  /**
   * Handle reaction toggle with optimistic update
   */
  const handleToggleReaction = useCallback(
    async (emoji: string) => {
      // Find existing reaction
      const existingReaction = reactionsWithUsers.find(r => r.emoji === emoji);
      const hasReacted = existingReaction?.hasReacted ?? false;

      // Create optimistic update
      const optimisticReactions = reactionsWithUsers.slice();
      const reactionIndex = optimisticReactions.findIndex(
        r => r.emoji === emoji,
      );

      if (hasReacted) {
        // Remove reaction optimistically
        if (reactionIndex >= 0) {
          const reaction = optimisticReactions[reactionIndex];
          const newCount = Math.max(0, reaction.count - 1);

          if (newCount === 0) {
            optimisticReactions.splice(reactionIndex, 1);
          } else {
            optimisticReactions[reactionIndex] = {
              ...reaction,
              count: newCount,
              hasReacted: false,
              users: reaction.users?.filter(u => u.id !== currentUser.id),
            };
          }
        }
      } else {
        // Add reaction optimistically
        if (reactionIndex >= 0) {
          const reaction = optimisticReactions[reactionIndex];
          optimisticReactions[reactionIndex] = {
            ...reaction,
            count: reaction.count + 1,
            hasReacted: true,
            users: reaction.users
              ? [
                  ...reaction.users,
                  {
                    id: currentUser.id,
                    name: currentUser.name || 'You',
                    displayName: null,
                  },
                ]
              : [
                  {
                    id: currentUser.id,
                    name: currentUser.name || 'You',
                    displayName: null,
                  },
                ],
          };
        } else {
          // Create new reaction
          optimisticReactions.push({
            emoji,
            count: 1,
            userIds: [currentUser.id],
            hasReacted: true,
            users: [
              {
                id: currentUser.id,
                name: currentUser.name || 'You',
                displayName: null,
              },
            ],
          });
        }
      }

      // Apply optimistic update
      setReactions(optimisticReactions);

      // Perform actual API call in transition
      startTransition(async () => {
        try {
          await toggleReactionAPI(message.id, emoji, hasReacted);

          // Refresh reactions from server to get updated user data
          if (workspaceSlug) {
            const updatedReactions = await fetchReactionUsers(
              message.id,
              workspaceSlug,
            );
            setReactions(updatedReactions);
          }
        } catch (error) {
          console.error('Failed to toggle reaction:', error);
          // Rollback optimistic update on error
          setReactions(reactionsWithUsers);
        }
      });
    },
    [reactionsWithUsers, currentUser, message.id, workspaceSlug],
  );

  return (
    <div className={className}>
      {/* Reaction Display with Tooltips */}
      {reactionsWithUsers.length > 0 && (
        <div className='mt-2'>
          <ReactionDisplay
            reactions={reactionsWithUsers}
            onToggleReaction={handleToggleReaction}
          />
        </div>
      )}

      {/* Quick Add Reaction Button */}
      <div className='mt-2'>
        <ReactionPickerPopover
          onSelect={handleToggleReaction}
          align='start'
          side='top'
        >
          <button
            type='button'
            className='inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
            aria-label='Add reaction'
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <circle cx='12' cy='12' r='10' />
              <path d='M8 14s1.5 2 4 2 4-2 4-2' />
              <line x1='9' x2='9.01' y1='9' y2='9' />
              <line x1='15' x2='15.01' y1='9' y2='9' />
            </svg>
            <span>Add reaction</span>
          </button>
        </ReactionPickerPopover>
      </div>
    </div>
  );
}
