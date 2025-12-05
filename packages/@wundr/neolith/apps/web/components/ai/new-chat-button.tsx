'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NewChatButtonProps {
  workspaceSlug: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function NewChatButton({
  workspaceSlug,
  variant = 'default',
  size = 'default',
  showLabel = true,
  className,
}: NewChatButtonProps) {
  const router = useRouter();

  const handleNewChat = () => {
    router.push(`/${workspaceSlug}/ai`);
  };

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleNewChat}
              className={className}
            >
              <MessageSquarePlus className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>New AI conversation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleNewChat}
      className={className}
    >
      <MessageSquarePlus className='h-4 w-4' />
      New Chat
    </Button>
  );
}
