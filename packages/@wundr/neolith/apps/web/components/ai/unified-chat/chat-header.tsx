'use client';

import { Minus, X } from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ChatPersona, ChatVariant } from './types';

interface ChatHeaderProps {
  persona: ChatPersona;
  variant: ChatVariant;
  onClose?: () => void;
  onMinimize?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function ChatHeader({
  persona,
  variant,
  onClose,
  onMinimize,
  actions,
  className,
}: ChatHeaderProps) {
  if (variant !== 'panel' && variant !== 'dialog') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-border',
        className
      )}
    >
      <div className='flex items-center gap-3'>
        <Avatar className='h-8 w-8'>
          {persona.avatar?.src && (
            <AvatarImage src={persona.avatar.src} alt={persona.name} />
          )}
          <AvatarFallback className='bg-primary/10 text-primary text-xs'>
            {persona.avatar?.fallback ?? persona.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className='text-sm font-medium text-foreground'>
          {persona.name}
        </span>
      </div>

      <div className='flex items-center gap-1'>
        {actions}
        {onMinimize && (
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={onMinimize}
            aria-label='Minimize'
          >
            <Minus className='h-4 w-4' />
          </Button>
        )}
        {onClose && (
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={onClose}
            aria-label='Close'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>
    </div>
  );
}
