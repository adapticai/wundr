'use client';

import * as React from 'react';
import {
  Wand2,
  Sparkles,
  RefreshCw,
  Copy,
  Trash2,
  FileText,
  Download,
  Share2,
  Edit3,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  category?: string;
  shortcut?: string;
  isAI?: boolean;
  isPremium?: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}

export interface QuickActionsProps {
  actions: QuickAction[];
  variant?: 'default' | 'floating' | 'compact' | 'toolbar';
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  showTooltips?: boolean;
  className?: string;
  maxVisible?: number;
}

const defaultIcons = {
  generate: Wand2,
  enhance: Sparkles,
  regenerate: RefreshCw,
  copy: Copy,
  delete: Trash2,
  summarize: FileText,
  download: Download,
  share: Share2,
  edit: Edit3,
  optimize: Zap,
};

export function QuickActions({
  actions,
  variant = 'default',
  orientation = 'horizontal',
  showLabels = true,
  showTooltips = true,
  className,
  maxVisible = 8,
}: QuickActionsProps) {
  const [loadingActions, setLoadingActions] = React.useState<Set<string>>(
    new Set()
  );
  const [visibleActions, setVisibleActions] = React.useState<QuickAction[]>([]);

  React.useEffect(() => {
    setVisibleActions(actions.slice(0, maxVisible));
  }, [actions, maxVisible]);

  const handleAction = async (action: QuickAction) => {
    if (action.disabled || loadingActions.has(action.id)) return;

    setLoadingActions(prev => new Set(prev).add(action.id));
    try {
      await action.onClick();
    } catch (error) {
      console.error(`Action ${action.id} failed:`, error);
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    }
  };

  const variantStyles = {
    default: 'gap-2',
    floating:
      'gap-1 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border p-2',
    compact: 'gap-1',
    toolbar: 'gap-1 border-b pb-2',
  };

  const orientationStyles = {
    horizontal: 'flex-row',
    vertical: 'flex-col',
  };

  const buttonVariants = {
    default: 'default',
    floating: 'ghost',
    compact: 'ghost',
    toolbar: 'ghost',
  } as const;

  const buttonSizes = {
    default: 'default',
    floating: 'sm',
    compact: 'sm',
    toolbar: 'sm',
  } as const;

  return (
    <div
      className={cn(
        'flex items-center',
        variantStyles[variant],
        orientationStyles[orientation],
        className
      )}
      role='toolbar'
      aria-label='Quick actions'
    >
      {visibleActions.map(action => {
        const Icon = action.icon || defaultIcons.generate;
        const isLoading = loadingActions.has(action.id);
        const buttonContent = (
          <Button
            key={action.id}
            variant={buttonVariants[variant]}
            size={buttonSizes[variant]}
            onClick={() => handleAction(action)}
            disabled={action.disabled || isLoading}
            className={cn(
              'relative',
              !showLabels && 'aspect-square',
              action.isAI &&
                'bg-gradient-to-r from-blue-500/10 to-purple-500/10',
              variant === 'floating' && 'hover:scale-110 transition-transform'
            )}
            aria-label={action.label}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                showLabels && 'mr-2',
                isLoading && 'animate-spin'
              )}
            />
            {showLabels && <span>{action.label}</span>}
            {action.isAI && (
              <Sparkles className='absolute -top-1 -right-1 h-3 w-3 text-primary' />
            )}
            {action.isPremium && (
              <Badge
                variant='secondary'
                className='absolute -top-1 -right-1 h-4 px-1 text-[10px]'
              >
                PRO
              </Badge>
            )}
          </Button>
        );

        if (showTooltips) {
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
              <TooltipContent
                side={orientation === 'horizontal' ? 'bottom' : 'right'}
              >
                <div className='space-y-1'>
                  <p className='font-medium'>{action.label}</p>
                  {action.description && (
                    <p className='text-xs text-muted-foreground'>
                      {action.description}
                    </p>
                  )}
                  {action.shortcut && (
                    <p className='text-xs text-muted-foreground'>
                      <kbd className='px-1 py-0.5 rounded bg-muted'>
                        {action.shortcut}
                      </kbd>
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        return buttonContent;
      })}
    </div>
  );
}

// Categorized quick actions
export function CategorizedQuickActions({
  actions,
  className,
}: {
  actions: QuickAction[];
  className?: string;
}) {
  const categorizedActions = React.useMemo(() => {
    const categories: Record<string, QuickAction[]> = {};
    actions.forEach(action => {
      const category = action.category || 'General';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(action);
    });
    return categories;
  }, [actions]);

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(categorizedActions).map(([category, categoryActions]) => (
        <div key={category} className='space-y-2'>
          <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
            {category}
          </h4>
          <QuickActions
            actions={categoryActions}
            variant='compact'
            showLabels={true}
            showTooltips={true}
          />
        </div>
      ))}
    </div>
  );
}

// Floating action button (FAB) with expandable menu
export function FloatingQuickActions({
  actions,
  className,
}: {
  actions: QuickAction[];
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      <div className='relative'>
        {/* Expanded actions */}
        {isExpanded && (
          <div className='absolute bottom-16 right-0 flex flex-col-reverse gap-2 animate-in slide-in-from-bottom-2 fade-in'>
            {actions.map(action => {
              const Icon = action.icon || defaultIcons.generate;
              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant='secondary'
                      size='icon'
                      onClick={() => {
                        action.onClick();
                        setIsExpanded(false);
                      }}
                      disabled={action.disabled}
                      className='h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform'
                    >
                      <Icon className='h-5 w-5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='left'>
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Main FAB */}
        <Button
          size='icon'
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'h-14 w-14 rounded-full shadow-lg transition-all',
            'bg-gradient-to-r from-blue-500 to-purple-500',
            'hover:scale-110 hover:shadow-xl',
            isExpanded && 'rotate-45'
          )}
        >
          <Sparkles className='h-6 w-6' />
        </Button>
      </div>
    </div>
  );
}

// Context-aware actions that appear based on selection/context
export function ContextualQuickActions({
  actions,
  visible,
  position = { x: 0, y: 0 },
  className,
}: {
  actions: QuickAction[];
  visible: boolean;
  position?: { x: number; y: number };
  className?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn('fixed z-50 animate-in fade-in zoom-in-95', className)}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <QuickActions
        actions={actions}
        variant='floating'
        orientation='horizontal'
        showLabels={false}
        showTooltips={true}
      />
    </div>
  );
}
