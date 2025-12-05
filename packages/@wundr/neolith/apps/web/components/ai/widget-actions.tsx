'use client';

import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWidgetStore } from '@/lib/stores/widget-store';
import type { QuickAction } from '@/lib/stores/widget-store';

/**
 * Props for WidgetActions component
 */
export interface WidgetActionsProps {
  /**
   * Callback when action is selected
   */
  onActionSelect: (action: QuickAction) => void;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Show only icons (compact mode)
   */
  compact?: boolean;
}

/**
 * Get Lucide icon component by name
 */
function getIconComponent(iconName: string) {
  const Icon = (
    LucideIcons as unknown as Record<
      string,
      React.ComponentType<{ className?: string }>
    >
  )[iconName];
  return Icon || LucideIcons.Circle;
}

/**
 * WidgetActions - Quick action buttons for common AI tasks
 *
 * Features:
 * - Grid layout for quick actions
 * - Icon + label buttons
 * - Customizable actions via store
 * - Category grouping (optional)
 * - Compact mode for minimized view
 *
 * @example
 * ```tsx
 * <WidgetActions
 *   onActionSelect={(action) => console.log(action.prompt)}
 * />
 * ```
 */
export function WidgetActions({
  onActionSelect,
  className,
  compact = false,
}: WidgetActionsProps) {
  const { quickActions, preferences } = useWidgetStore();

  if (!preferences.showQuickActions) {
    return null;
  }

  // Group actions by category
  const groupedActions = quickActions.reduce(
    (acc, action) => {
      const category = action.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(action);
      return acc;
    },
    {} as Record<string, QuickAction[]>
  );

  const handleActionClick = (action: QuickAction) => {
    onActionSelect(action);
  };

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        <TooltipProvider>
          {quickActions.slice(0, 4).map(action => {
            const Icon = getIconComponent(action.icon);
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleActionClick(action)}
                    className='h-8 w-8 p-0'
                  >
                    <Icon className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='top'>
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full w-full', className)}>
      <div className='space-y-4 p-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-muted-foreground'>
            Quick Actions
          </h3>
        </div>

        {Object.entries(groupedActions).map(([category, actions]) => (
          <div key={category} className='space-y-2'>
            {Object.keys(groupedActions).length > 1 && (
              <h4 className='text-xs font-medium capitalize text-muted-foreground'>
                {category}
              </h4>
            )}
            <div className='grid grid-cols-2 gap-2'>
              {actions.map(action => {
                const Icon = getIconComponent(action.icon);
                return (
                  <Button
                    key={action.id}
                    variant='outline'
                    size='sm'
                    onClick={() => handleActionClick(action)}
                    className='h-auto flex-col gap-2 py-3'
                  >
                    <Icon className='h-5 w-5' />
                    <span className='text-xs'>{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * CategoryBadge - Display category with icon
 */
function CategoryBadge({ category }: { category: string }) {
  const categoryConfig: Record<string, { icon: string; color: string }> = {
    development: { icon: 'Code', color: 'text-blue-500' },
    productivity: { icon: 'Zap', color: 'text-yellow-500' },
    creative: { icon: 'Palette', color: 'text-purple-500' },
    analysis: { icon: 'BarChart', color: 'text-green-500' },
    other: { icon: 'MoreHorizontal', color: 'text-gray-500' },
  };

  const config = categoryConfig[category] || categoryConfig.other;
  const Icon = getIconComponent(config.icon);

  return (
    <div className='flex items-center gap-1.5'>
      <Icon className={cn('h-3 w-3', config.color)} />
      <span className='text-xs font-medium capitalize'>{category}</span>
    </div>
  );
}
