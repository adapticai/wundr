/**
 * AI Feedback Buttons Component
 *
 * Quick thumbs up/down feedback buttons for AI responses
 *
 * @module components/ai/feedback-buttons
 */

'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FeedbackButtonsProps {
  responseId: string;
  workspaceId: string;
  onFeedbackSubmit?: (sentiment: 'POSITIVE' | 'NEGATIVE') => void;
  onDetailedFeedback?: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
}

export function FeedbackButtons({
  responseId,
  workspaceId,
  onFeedbackSubmit,
  onDetailedFeedback,
  className,
  size = 'sm',
  disabled = false,
}: FeedbackButtonsProps) {
  const [sentiment, setSentiment] = useState<'POSITIVE' | 'NEGATIVE' | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (newSentiment: 'POSITIVE' | 'NEGATIVE') => {
    // Toggle if clicking the same sentiment
    const finalSentiment = sentiment === newSentiment ? null : newSentiment;

    setIsSubmitting(true);
    setSentiment(finalSentiment);

    try {
      if (finalSentiment) {
        // Submit feedback
        const response = await fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responseId,
            workspaceId,
            sentiment: finalSentiment,
            isAnonymous: false,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }

        const data = await response.json();
        toast.success('Feedback submitted', {
          description: 'Thank you for helping us improve!',
        });

        onFeedbackSubmit?.(finalSentiment);

        // Prompt for detailed feedback after negative feedback
        if (finalSentiment === 'NEGATIVE' && onDetailedFeedback) {
          setTimeout(() => {
            toast.info('Would you like to provide more details?', {
              action: {
                label: 'Yes',
                onClick: onDetailedFeedback,
              },
              duration: 5000,
            });
          }, 500);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback', {
        description: 'Please try again later',
      });
      setSentiment(sentiment); // Revert on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size={size === 'sm' ? 'icon' : size}
              onClick={() => handleFeedback('POSITIVE')}
              disabled={disabled || isSubmitting}
              className={cn(
                'transition-colors',
                sentiment === 'POSITIVE' &&
                  'text-green-600 hover:text-green-700 dark:text-green-400'
              )}
            >
              <ThumbsUp
                className={cn(
                  size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
                  sentiment === 'POSITIVE' && 'fill-current'
                )}
              />
              <span className='sr-only'>Thumbs up</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {sentiment === 'POSITIVE' ? 'Remove feedback' : 'Good response'}
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size={size === 'sm' ? 'icon' : size}
              onClick={() => handleFeedback('NEGATIVE')}
              disabled={disabled || isSubmitting}
              className={cn(
                'transition-colors',
                sentiment === 'NEGATIVE' &&
                  'text-red-600 hover:text-red-700 dark:text-red-400'
              )}
            >
              <ThumbsDown
                className={cn(
                  size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
                  sentiment === 'NEGATIVE' && 'fill-current'
                )}
              />
              <span className='sr-only'>Thumbs down</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {sentiment === 'NEGATIVE' ? 'Remove feedback' : 'Poor response'}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
