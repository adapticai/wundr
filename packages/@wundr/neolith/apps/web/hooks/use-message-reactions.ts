'use client';

import { useCallback, useState, useTransition } from 'react';

import type { ReactionWithUsers } from '@/components/chat/reaction-display';

interface UseMessageReactionsOptions {
  messageId: string;
  initialReactions: readonly ReactionWithUsers[];
  currentUserId: string;
  onReactionToggle?: (emoji: string) => Promise<void>;
}

interface OptimisticReaction extends ReactionWithUsers {
  isOptimistic?: boolean;
}

/**
 * Hook for managing message reactions with optimistic UI updates
 *
 * Provides:
 * - Optimistic reaction updates for instant feedback
 * - Automatic rollback on error
 * - Seamless integration with API calls
 */
export function useMessageReactions({
  messageId,
  initialReactions,
  currentUserId,
  onReactionToggle,
}: UseMessageReactionsOptions) {
  const [reactions, setReactions] = useState<OptimisticReaction[]>([
    ...initialReactions,
  ]);
  const [isPending, startTransition] = useTransition();

  /**
   * Toggle a reaction with optimistic update
   */
  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!onReactionToggle) {
        return;
      }

      // Find existing reaction
      const existingReaction = reactions.find(r => r.emoji === emoji);
      const hasReacted = existingReaction?.hasReacted ?? false;

      // Create optimistic update
      const optimisticReactions = reactions.slice();
      const reactionIndex = optimisticReactions.findIndex(
        r => r.emoji === emoji
      );

      if (hasReacted) {
        // Remove reaction optimistically
        if (reactionIndex >= 0) {
          const reaction = optimisticReactions[reactionIndex];
          const newCount = Math.max(0, reaction.count - 1);

          if (newCount === 0) {
            // Remove reaction entirely if count is 0
            optimisticReactions.splice(reactionIndex, 1);
          } else {
            // Update count and hasReacted
            optimisticReactions[reactionIndex] = {
              ...reaction,
              count: newCount,
              hasReacted: false,
              users: reaction.users?.filter(u => u.id !== currentUserId),
              isOptimistic: true,
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
                  { id: currentUserId, name: 'You', displayName: null },
                ]
              : [{ id: currentUserId, name: 'You', displayName: null }],
            isOptimistic: true,
          };
        } else {
          // Create new reaction
          optimisticReactions.push({
            emoji,
            count: 1,
            userIds: [currentUserId],
            hasReacted: true,
            users: [{ id: currentUserId, name: 'You', displayName: null }],
            isOptimistic: true,
          });
        }
      }

      // Apply optimistic update
      setReactions(optimisticReactions);

      // Perform actual API call
      try {
        await onReactionToggle(emoji);
        // On success, mark as no longer optimistic
        setReactions(prev => prev.map(r => ({ ...r, isOptimistic: false })));
      } catch (error) {
        // Rollback on error
        console.error('Failed to toggle reaction:', error);
        setReactions([...initialReactions]);
      }
    },
    [reactions, currentUserId, onReactionToggle, initialReactions]
  );

  /**
   * Update reactions from server (e.g., real-time updates)
   */
  const updateReactions = useCallback((newReactions: ReactionWithUsers[]) => {
    setReactions(newReactions);
  }, []);

  return {
    reactions,
    toggleReaction,
    updateReactions,
    isPending,
  };
}
