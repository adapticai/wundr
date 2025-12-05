'use client';

import { Bot, Sparkles } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OrchestratorMessageIndicatorProps {
  avatarUrl?: string | null;
  orchestratorName: string;
  variant?: 'badge' | 'icon' | 'label' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    avatar: 'h-6 w-6',
    badge: 'h-3 w-3 -bottom-0.5 -right-0.5',
    icon: 'h-2.5 w-2.5',
    label: 'text-xs px-1.5 py-0.5',
  },
  md: {
    avatar: 'h-8 w-8',
    badge: 'h-4 w-4 -bottom-1 -right-1',
    icon: 'h-3 w-3',
    label: 'text-xs px-2 py-1',
  },
  lg: {
    avatar: 'h-10 w-10',
    badge: 'h-5 w-5 -bottom-1 -right-1',
    icon: 'h-3.5 w-3.5',
    label: 'text-sm px-2.5 py-1',
  },
};

export function OrchestratorMessageIndicator({
  avatarUrl,
  orchestratorName,
  variant = 'badge',
  size = 'md',
  showLabel = false,
  className,
}: OrchestratorMessageIndicatorProps) {
  const initials = orchestratorName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizes = sizeClasses[size];

  // Badge variant - Bot icon badge on avatar
  if (variant === 'badge') {
    return (
      <div className={cn('relative inline-flex', className)}>
        <Avatar className={sizes.avatar}>
          <AvatarImage src={avatarUrl || undefined} alt={orchestratorName} />
          <AvatarFallback className='bg-primary/10 text-primary'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-primary ring-2 ring-background',
            sizes.badge,
          )}
        >
          <Bot className={cn('text-primary-foreground', sizes.icon)} />
        </div>
        {showLabel && (
          <Badge
            variant='secondary'
            className={cn('absolute -top-1 left-full ml-1', sizes.label)}
          >
            AI
          </Badge>
        )}
      </div>
    );
  }

  // Icon variant - Just the bot icon
  if (variant === 'icon') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/10 p-1',
          className,
        )}
      >
        <Bot className={cn('text-primary', sizes.icon)} />
      </div>
    );
  }

  // Label variant - AI label with sparkles
  if (variant === 'label') {
    return (
      <Badge
        variant='secondary'
        className={cn(
          'inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20',
          sizes.label,
          className,
        )}
      >
        <Sparkles className={sizes.icon} />
        <span>AI</span>
      </Badge>
    );
  }

  // Subtle variant - Small dot indicator
  if (variant === 'subtle') {
    return (
      <div className={cn('relative inline-flex', className)}>
        <Avatar className={sizes.avatar}>
          <AvatarImage src={avatarUrl || undefined} alt={orchestratorName} />
          <AvatarFallback className='bg-primary/10 text-primary'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-3 w-3')}>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75' />
          <span className='relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-background' />
        </span>
      </div>
    );
  }

  return null;
}

// Message wrapper that applies Orchestrator-specific styling
interface OrchestratorMessageWrapperProps {
  children: React.ReactNode;
  isOrchestrator?: boolean;
  className?: string;
}

export function OrchestratorMessageWrapper({
  children,
  isOrchestrator = false,
  className,
}: OrchestratorMessageWrapperProps) {
  if (!isOrchestrator) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border border-primary/20 bg-primary/5',
        'before:absolute before:-left-1 before:top-0 before:h-full before:w-1 before:rounded-full before:bg-primary',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Compact indicator for message lists
export function OrchestratorMessageBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
        className,
      )}
    >
      <Bot className='h-3 w-3' />
      <span>AI</span>
    </div>
  );
}
