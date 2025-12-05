'use client';

import * as React from 'react';
import {
  Sparkles,
  Wand2,
  Languages,
  FileText,
  Copy,
  Edit3,
  Trash2,
  Share2,
  Download,
  RefreshCw,
  Zap,
  Brain,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';

export interface AIContextAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  isAI?: boolean;
  disabled?: boolean;
  submenu?: AIContextAction[];
  onClick?: () => void | Promise<void>;
}

export interface ContextMenuAIProps {
  children: React.ReactNode;
  actions: AIContextAction[];
  selectedText?: string;
  onAIAction?: (actionId: string) => void;
  className?: string;
}

const defaultAIActions: AIContextAction[] = [
  {
    id: 'improve',
    label: 'Improve writing',
    icon: Sparkles,
    isAI: true,
    onClick: () => {},
  },
  {
    id: 'fix-grammar',
    label: 'Fix grammar',
    icon: CheckCircle2,
    isAI: true,
    onClick: () => {},
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: Languages,
    isAI: true,
    submenu: [
      { id: 'translate-es', label: 'Spanish', onClick: () => {} },
      { id: 'translate-fr', label: 'French', onClick: () => {} },
      { id: 'translate-de', label: 'German', onClick: () => {} },
      { id: 'translate-ja', label: 'Japanese', onClick: () => {} },
      { id: 'translate-zh', label: 'Chinese', onClick: () => {} },
    ] as AIContextAction[],
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    isAI: true,
    onClick: () => {},
  },
  {
    id: 'expand',
    label: 'Expand on this',
    icon: Wand2,
    isAI: true,
    onClick: () => {},
  },
  {
    id: 'change-tone',
    label: 'Change tone',
    icon: Brain,
    isAI: true,
    submenu: [
      { id: 'tone-professional', label: 'Professional', onClick: () => {} },
      { id: 'tone-casual', label: 'Casual', onClick: () => {} },
      { id: 'tone-friendly', label: 'Friendly', onClick: () => {} },
      { id: 'tone-formal', label: 'Formal', onClick: () => {} },
      { id: 'tone-concise', label: 'Concise', onClick: () => {} },
    ] as AIContextAction[],
  },
];

export function ContextMenuAI({
  children,
  actions,
  selectedText,
  onAIAction,
  className,
}: ContextMenuAIProps) {
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  const handleAction = async (action: AIContextAction) => {
    if (action.disabled || loadingAction || !action.onClick) return;

    setLoadingAction(action.id);
    try {
      await action.onClick();
      onAIAction?.(action.id);
    } catch (error) {
      console.error(`Action ${action.id} failed:`, error);
    } finally {
      setLoadingAction(null);
    }
  };

  const renderMenuItem = (action: AIContextAction) => {
    const Icon = action.icon;
    const isLoading = loadingAction === action.id;

    if (action.submenu) {
      return (
        <ContextMenuSub key={action.id}>
          <ContextMenuSubTrigger
            disabled={action.disabled}
            className={cn(action.isAI && 'text-primary')}
          >
            {Icon && (
              <Icon
                className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')}
              />
            )}
            {action.label}
            {action.isAI && (
              <Sparkles className='ml-auto h-3 w-3 text-primary' />
            )}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {action.submenu.map(subAction => {
              const SubIcon = subAction.icon;
              return (
                <ContextMenuItem
                  key={subAction.id}
                  onClick={() => handleAction(subAction)}
                  disabled={subAction.disabled}
                >
                  {SubIcon && <SubIcon className='mr-2 h-4 w-4' />}
                  {subAction.label}
                  {subAction.shortcut && (
                    <ContextMenuShortcut>
                      {subAction.shortcut}
                    </ContextMenuShortcut>
                  )}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    return (
      <ContextMenuItem
        key={action.id}
        onClick={() => handleAction(action)}
        disabled={action.disabled || isLoading}
        className={cn(action.isAI && 'text-primary')}
      >
        {Icon && (
          <Icon className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
        )}
        {action.label}
        {action.isAI && <Sparkles className='ml-auto h-3 w-3 text-primary' />}
        {action.shortcut && (
          <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  };

  // Separate AI actions from regular actions
  const aiActions = actions.filter(a => a.isAI);
  const regularActions = actions.filter(a => !a.isAI);

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>{children}</ContextMenuTrigger>
      <ContextMenuContent className='w-64'>
        {selectedText && (
          <>
            <div className='px-2 py-1.5 text-xs text-muted-foreground'>
              <span className='font-medium'>Selected:</span>{' '}
              <span className='italic'>
                {selectedText.length > 30
                  ? `${selectedText.slice(0, 30)}...`
                  : selectedText}
              </span>
            </div>
            <ContextMenuSeparator />
          </>
        )}

        {/* AI Actions */}
        {aiActions.length > 0 && (
          <>
            <div className='px-2 py-1.5 text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1'>
              <Sparkles className='h-3 w-3' />
              AI Actions
            </div>
            {aiActions.map(renderMenuItem)}
            {regularActions.length > 0 && <ContextMenuSeparator />}
          </>
        )}

        {/* Regular Actions */}
        {regularActions.map(renderMenuItem)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Smart context menu that shows different actions based on selection type
export function SmartContextMenu({
  children,
  onAction,
  className,
}: {
  children: React.ReactNode;
  onAction?: (actionId: string) => void;
  className?: string;
}) {
  const [selectedText, setSelectedText] = React.useState<string>('');
  const [selectionType, setSelectionType] = React.useState<
    'text' | 'code' | 'link' | 'empty'
  >('empty');

  React.useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString() || '';
      setSelectedText(text);

      // Detect selection type
      if (!text) {
        setSelectionType('empty');
      } else if (text.includes('http://') || text.includes('https://')) {
        setSelectionType('link');
      } else if (
        text.includes('function') ||
        text.includes('const') ||
        text.includes('import')
      ) {
        setSelectionType('code');
      } else {
        setSelectionType('text');
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const getContextActions = (): AIContextAction[] => {
    const baseActions: AIContextAction[] = [
      {
        id: 'copy',
        label: 'Copy',
        icon: Copy,
        shortcut: '⌘C',
        onClick: () => navigator.clipboard.writeText(selectedText),
      },
    ];

    if (selectionType === 'empty') {
      return [
        ...baseActions,
        {
          id: 'paste',
          label: 'Paste',
          icon: Edit3,
          shortcut: '⌘V',
          onClick: async () => {
            const text = await navigator.clipboard.readText();
            document.execCommand('insertText', false, text);
          },
        },
      ];
    }

    const textActions: AIContextAction[] = [
      ...defaultAIActions.map(action => ({
        ...action,
        onClick: () => onAction?.(action.id),
      })),
      {
        id: 'share',
        label: 'Share',
        icon: Share2,
        onClick: () => onAction?.('share'),
      },
    ];

    if (selectionType === 'code') {
      return [
        ...baseActions,
        {
          id: 'explain-code',
          label: 'Explain code',
          icon: Brain,
          isAI: true,
          onClick: () => onAction?.('explain-code'),
        },
        {
          id: 'optimize-code',
          label: 'Optimize code',
          icon: Zap,
          isAI: true,
          onClick: () => onAction?.('optimize-code'),
        },
        {
          id: 'add-comments',
          label: 'Add comments',
          icon: FileText,
          isAI: true,
          onClick: () => onAction?.('add-comments'),
        },
        {
          id: 'find-bugs',
          label: 'Find bugs',
          icon: CheckCircle2,
          isAI: true,
          onClick: () => onAction?.('find-bugs'),
        },
      ];
    }

    if (selectionType === 'link') {
      return [
        ...baseActions,
        {
          id: 'open-link',
          label: 'Open link',
          onClick: () => {
            window.open(selectedText, '_blank');
          },
        },
        {
          id: 'summarize-page',
          label: 'Summarize page',
          icon: FileText,
          isAI: true,
          onClick: () => onAction?.('summarize-page'),
        },
      ];
    }

    return [...baseActions, ...textActions];
  };

  return (
    <ContextMenuAI
      actions={getContextActions()}
      selectedText={selectedText}
      onAIAction={onAction}
      className={className}
    >
      {children}
    </ContextMenuAI>
  );
}
