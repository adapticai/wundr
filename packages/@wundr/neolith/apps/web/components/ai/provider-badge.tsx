/**
 * Provider Badge Component
 * Displays provider name with icon and color coding
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { getProviderColor, getProviderName } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { Brain, Sparkles, Zap } from 'lucide-react';

import type { AIProvider } from '@/lib/ai/models';

interface ProviderBadgeProps {
  provider: AIProvider;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const providerIcons: Record<AIProvider, typeof Brain> = {
  openai: Sparkles,
  anthropic: Brain,
  deepseek: Zap,
};

const providerColors: Record<AIProvider, string> = {
  openai:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300',
  anthropic:
    'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
  deepseek:
    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function ProviderBadge({
  provider,
  variant = 'default',
  size = 'md',
  showIcon = true,
  className,
}: ProviderBadgeProps) {
  const Icon = providerIcons[provider];
  const providerName = getProviderName(provider);

  return (
    <Badge
      variant={variant === 'default' ? 'secondary' : variant}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        variant === 'default' && providerColors[provider],
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            size === 'sm' && 'h-3 w-3',
            size === 'md' && 'h-3.5 w-3.5',
            size === 'lg' && 'h-4 w-4'
          )}
        />
      )}
      {providerName}
    </Badge>
  );
}
