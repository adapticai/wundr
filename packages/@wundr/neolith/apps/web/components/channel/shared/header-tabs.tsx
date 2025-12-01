'use client';

import {
  Plus,
  MessageSquare,
  FileText,
  FolderOpen,
  LayoutList,
  Workflow,
  Bookmark,
  Link2,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

/**
 * Available tab types for conversation headers
 */
export type ConversationTab =
  | 'messages'
  | 'files'
  | 'canvas'
  | 'lists'
  | 'workflows'
  | 'bookmarks';

/**
 * Tab configuration
 */
export interface TabConfig {
  id: ConversationTab;
  label: string;
  icon: ReactNode;
}

/**
 * Default tabs available for all conversation types
 */
export const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'messages',
    label: 'Messages',
    icon: <MessageSquare className='h-4 w-4' />,
  },
  { id: 'files', label: 'Files', icon: <FolderOpen className='h-4 w-4' /> },
  { id: 'canvas', label: 'Canvas', icon: <FileText className='h-4 w-4' /> },
];

/**
 * Extended tabs for DMs/group conversations
 */
export const EXTENDED_TABS: TabConfig[] = [
  ...DEFAULT_TABS,
  { id: 'lists', label: 'Lists', icon: <LayoutList className='h-4 w-4' /> },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: <Workflow className='h-4 w-4' />,
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    icon: <Bookmark className='h-4 w-4' />,
  },
];

/**
 * Props for the HeaderTabs component
 */
interface HeaderTabsProps {
  /** Currently active tab */
  activeTab: ConversationTab;
  /** Callback when tab changes */
  onTabChange?: (tab: ConversationTab) => void;
  /** Callback when add tab is clicked */
  onAddTab?: (tabType: string) => void;
  /** Which tabs to show */
  tabs?: TabConfig[];
  /** Whether to show the add button */
  showAddButton?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Shared header tabs component for Channels and DMs
 */
export function HeaderTabs({
  activeTab,
  onTabChange,
  onAddTab,
  tabs = DEFAULT_TABS,
  showAddButton = true,
  className,
}: HeaderTabsProps) {
  return (
    <div className={cn('flex items-center gap-1 border-b px-2', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type='button'
          onClick={() => onTabChange?.(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative',
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.icon}
          {tab.label}
          {activeTab === tab.id && (
            <span className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary' />
          )}
        </button>
      ))}

      {/* Add tab dropdown */}
      {showAddButton && onAddTab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-8 w-8 p-0 ml-1'>
              <Plus className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Add a tab
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAddTab('link')}>
              <Link2 className='mr-2 h-4 w-4' />
              Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddTab('folder')}>
              <FolderOpen className='mr-2 h-4 w-4' />
              Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAddTab('canvas')}>
              <FileText className='mr-2 h-4 w-4' />
              Canvas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddTab('list')}>
              <LayoutList className='mr-2 h-4 w-4' />
              List
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddTab('workflow')}>
              <Workflow className='mr-2 h-4 w-4' />
              Workflow
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAddTab('customize')}>
              <Settings className='mr-2 h-4 w-4' />
              Customise tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default HeaderTabs;
