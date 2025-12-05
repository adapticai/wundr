/**
 * Context Menu Wrapper Component
 * Desktop-specific context menu wrapper with keyboard shortcut display
 * @module components/ui/context-menu-wrapper
 */
'use client';

import * as React from 'react';

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
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  onClick?: () => void;
  disabled?: boolean;
  checked?: boolean;
  type?: 'normal' | 'checkbox' | 'separator' | 'label';
  children?: ContextMenuAction[];
}

export interface ContextMenuGroup {
  label?: string;
  actions: ContextMenuAction[];
}

interface ContextMenuWrapperProps {
  children: React.ReactNode;
  items: (ContextMenuAction | ContextMenuGroup)[];
  className?: string;
  disabled?: boolean;
}

function isContextMenuGroup(
  item: ContextMenuAction | ContextMenuGroup,
): item is ContextMenuGroup {
  return 'actions' in item;
}

function formatShortcut(keys: string[]): string {
  const isMac =
    typeof window !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return keys
    .map(key => {
      if (!isMac && key === 'Cmd') {
        return 'Ctrl';
      }
      // Use symbols for common keys on Mac
      if (isMac) {
        switch (key) {
          case 'Cmd':
            return '⌘';
          case 'Shift':
            return '⇧';
          case 'Alt':
            return '⌥';
          case 'Ctrl':
            return '⌃';
          case 'Enter':
            return '↵';
          case 'Delete':
            return '⌫';
          case 'Backspace':
            return '⌫';
          default:
            return key;
        }
      }
      return key;
    })
    .join('');
}

function renderMenuItem(action: ContextMenuAction, index: number) {
  // Separator
  if (action.type === 'separator') {
    return <ContextMenuSeparator key={`separator-${index}`} />;
  }

  // Label
  if (action.type === 'label') {
    return (
      <ContextMenuLabel key={`label-${index}`}>{action.label}</ContextMenuLabel>
    );
  }

  // Checkbox item
  if (action.type === 'checkbox') {
    return (
      <ContextMenuCheckboxItem
        key={`checkbox-${index}`}
        checked={action.checked}
        disabled={action.disabled}
        onSelect={e => {
          if (action.onClick) {
            e.preventDefault();
            action.onClick();
          }
        }}
      >
        {action.icon && <span className='mr-2'>{action.icon}</span>}
        {action.label}
        {action.shortcut && (
          <ContextMenuShortcut>
            {formatShortcut(action.shortcut)}
          </ContextMenuShortcut>
        )}
      </ContextMenuCheckboxItem>
    );
  }

  // Submenu
  if (action.children && action.children.length > 0) {
    return (
      <ContextMenuSub key={`submenu-${index}`}>
        <ContextMenuSubTrigger disabled={action.disabled}>
          {action.icon && <span className='mr-2'>{action.icon}</span>}
          {action.label}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {action.children.map((child, childIndex) =>
            renderMenuItem(child, childIndex),
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
    );
  }

  // Regular menu item
  return (
    <ContextMenuItem
      key={`item-${index}`}
      disabled={action.disabled}
      onSelect={e => {
        if (action.onClick) {
          e.preventDefault();
          action.onClick();
        }
      }}
    >
      {action.icon && (
        <span className='mr-2 flex items-center'>{action.icon}</span>
      )}
      <span className='flex-1'>{action.label}</span>
      {action.shortcut && (
        <ContextMenuShortcut>
          {formatShortcut(action.shortcut)}
        </ContextMenuShortcut>
      )}
    </ContextMenuItem>
  );
}

export function ContextMenuWrapper({
  children,
  items,
  className,
  disabled = false,
}: ContextMenuWrapperProps) {
  // Don't render context menu if disabled or no items
  if (disabled || items.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className={cn('focus:outline-none', className)}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className='w-64'>
        {items.map((item, index) => {
          if (isContextMenuGroup(item)) {
            return (
              <React.Fragment key={`group-${index}`}>
                {index > 0 && <ContextMenuSeparator />}
                {item.label && (
                  <ContextMenuLabel>{item.label}</ContextMenuLabel>
                )}
                {item.actions.map((action, actionIndex) =>
                  renderMenuItem(action, actionIndex),
                )}
              </React.Fragment>
            );
          } else {
            return renderMenuItem(item, index);
          }
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Radio group helper for context menus
 */
interface ContextMenuRadioGroupWrapperProps {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
  }>;
}

export function ContextMenuRadioGroupWrapper({
  value,
  onValueChange,
  items,
}: ContextMenuRadioGroupWrapperProps) {
  return (
    <ContextMenuRadioGroup value={value} onValueChange={onValueChange}>
      {items.map(item => (
        <ContextMenuRadioItem key={item.value} value={item.value}>
          {item.icon && (
            <span className='mr-2 flex items-center'>{item.icon}</span>
          )}
          {item.label}
        </ContextMenuRadioItem>
      ))}
    </ContextMenuRadioGroup>
  );
}
