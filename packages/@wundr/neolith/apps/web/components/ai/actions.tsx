'use client';

import {
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  showCopy?: boolean;
  showRegenerate?: boolean;
  showFeedback?: boolean;
}

export function Actions({
  content,
  onCopy,
  onRegenerate,
  onFeedback,
  showCopy = true,
  showRegenerate = true,
  showFeedback = true,
  className,
  children,
  ...props
}: ActionsProps) {
  return (
    <ActionsContainer className={className} {...props}>
      {showCopy && content && <ActionCopy content={content} onCopy={onCopy} />}
      {showRegenerate && onRegenerate && (
        <ActionRegenerate onRegenerate={onRegenerate} />
      )}
      {showFeedback && onFeedback && <ActionFeedback onFeedback={onFeedback} />}
      {children}
    </ActionsContainer>
  );
}

export function ActionsContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ActionButton({
  tooltip,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className={cn('h-8 w-8 p-0', className)}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom' className='text-xs'>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ActionCopy({
  content,
  onCopy,
}: {
  content: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ActionButton tooltip={copied ? 'Copied!' : 'Copy'} onClick={handleCopy}>
      {copied ? (
        <Check className='h-4 w-4 text-green-500' />
      ) : (
        <Copy className='h-4 w-4' />
      )}
    </ActionButton>
  );
}

export function ActionRegenerate({
  onRegenerate,
}: {
  onRegenerate: () => void;
}) {
  return (
    <ActionButton tooltip='Regenerate' onClick={onRegenerate}>
      <RotateCcw className='h-4 w-4' />
    </ActionButton>
  );
}

export function ActionFeedback({
  onFeedback,
}: {
  onFeedback: (type: 'positive' | 'negative') => void;
}) {
  const [feedback, setFeedback] = React.useState<
    'positive' | 'negative' | null
  >(null);

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback(type);
  };

  return (
    <>
      <ActionButton
        tooltip='Good response'
        onClick={() => handleFeedback('positive')}
        className={feedback === 'positive' ? 'text-green-500' : ''}
      >
        <ThumbsUp className='h-4 w-4' />
      </ActionButton>
      <ActionButton
        tooltip='Bad response'
        onClick={() => handleFeedback('negative')}
        className={feedback === 'negative' ? 'text-red-500' : ''}
      >
        <ThumbsDown className='h-4 w-4' />
      </ActionButton>
    </>
  );
}

// More actions dropdown
export function ActionMore({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
          <MoreHorizontal className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DropdownMenuItem as ActionMenuItem };
