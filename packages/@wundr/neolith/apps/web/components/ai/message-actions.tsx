'use client';

import {
  Check,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  MoreHorizontal,
  Bookmark,
  Flag,
} from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy?: () => void;
  onShare?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  onBookmark?: () => void;
  onReport?: () => void;
  className?: string;
  variant?: 'inline' | 'compact';
  showFeedback?: boolean;
  showRegenerate?: boolean;
  showBookmark?: boolean;
  showReport?: boolean;
}

export function MessageActions({
  messageId,
  content,
  onCopy,
  onShare,
  onRegenerate,
  onFeedback,
  onBookmark,
  onReport,
  className,
  variant = 'inline',
  showFeedback = true,
  showRegenerate = true,
  showBookmark = true,
  showReport = true,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(
    null
  );
  const [bookmarked, setBookmarked] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: content,
          title: 'Shared from Chat',
        });
        onShare?.();
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback?.(type);
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  const handleRegenerate = () => {
    onRegenerate?.();
  };

  const handleReport = () => {
    onReport?.();
  };

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
          className
        )}
      >
        <ActionButton
          icon={copied ? Check : Copy}
          label={copied ? 'Copied!' : 'Copy'}
          onClick={handleCopy}
          variant='ghost'
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <MoreHorizontal className='h-3.5 w-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {showFeedback && (
              <>
                <DropdownMenuItem onClick={() => handleFeedback('positive')}>
                  <ThumbsUp className='mr-2 h-4 w-4' />
                  Good response
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFeedback('negative')}>
                  <ThumbsDown className='mr-2 h-4 w-4' />
                  Bad response
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {showRegenerate && onRegenerate && (
              <DropdownMenuItem onClick={handleRegenerate}>
                <RefreshCw className='mr-2 h-4 w-4' />
                Regenerate
              </DropdownMenuItem>
            )}
            {showBookmark && (
              <DropdownMenuItem onClick={handleBookmark}>
                <Bookmark
                  className={cn('mr-2 h-4 w-4', bookmarked && 'fill-current')}
                />
                {bookmarked ? 'Remove bookmark' : 'Bookmark'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className='mr-2 h-4 w-4' />
              Share
            </DropdownMenuItem>
            {showReport && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleReport}
                  className='text-destructive'
                >
                  <Flag className='mr-2 h-4 w-4' />
                  Report
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 mt-2 flex-wrap', className)}>
      <ActionButton
        icon={copied ? Check : Copy}
        label={copied ? 'Copied!' : 'Copy'}
        onClick={handleCopy}
        active={copied}
      />

      {showFeedback && (
        <>
          <ActionButton
            icon={ThumbsUp}
            label='Good response'
            onClick={() => handleFeedback('positive')}
            active={feedback === 'positive'}
          />
          <ActionButton
            icon={ThumbsDown}
            label='Bad response'
            onClick={() => handleFeedback('negative')}
            active={feedback === 'negative'}
          />
        </>
      )}

      {showRegenerate && onRegenerate && (
        <ActionButton
          icon={RefreshCw}
          label='Regenerate'
          onClick={handleRegenerate}
        />
      )}

      {showBookmark && (
        <ActionButton
          icon={Bookmark}
          label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          onClick={handleBookmark}
          active={bookmarked}
        />
      )}

      <ActionButton icon={Share2} label='Share' onClick={handleShare} />

      {showReport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-8 px-2'>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={handleReport}
              className='text-destructive'
            >
              <Flag className='mr-2 h-4 w-4' />
              Report issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: 'ghost' | 'outline';
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  variant = 'ghost',
}: ActionButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size='sm'
            onClick={onClick}
            className={cn(
              'h-8 px-2',
              active && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MessageActions;
