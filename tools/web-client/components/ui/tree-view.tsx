'use client';

import * as React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Tree view context
const TreeViewContext = React.createContext<{
  selectedItems: Set<string>;
  onSelectItem: (id: string, selected: boolean) => void;
  expandedItems: Set<string>;
  onToggleExpanded: (id: string) => void;
  multiSelect?: boolean;
}>(
  {} as {
    selectedItems: Set<string>;
    onSelectItem: (id: string, selected: boolean) => void;
    expandedItems: Set<string>;
    onToggleExpanded: (id: string) => void;
    multiSelect?: boolean;
  }
);

export interface TreeViewProps {
  children: React.ReactNode;
  className?: string;
  selectedItems?: string[];
  onSelectedItemsChange?: (items: string[]) => void;
  expandedItems?: string[];
  onExpandedItemsChange?: (items: string[]) => void;
  multiSelect?: boolean;
}

export function TreeView({
  children,
  className,
  selectedItems = [],
  onSelectedItemsChange,
  expandedItems = [],
  onExpandedItemsChange,
  multiSelect = false,
}: TreeViewProps) {
  const [internalSelectedItems, setInternalSelectedItems] = React.useState(
    new Set(selectedItems)
  );
  const [internalExpandedItems, setInternalExpandedItems] = React.useState(
    new Set(expandedItems)
  );

  const selectedItemsSet = React.useMemo(
    () => new Set(selectedItems),
    [selectedItems]
  );
  const expandedItemsSet = React.useMemo(
    () => new Set(expandedItems),
    [expandedItems]
  );

  const handleSelectItem = React.useCallback(
    (id: string, selected: boolean) => {
      if (onSelectedItemsChange) {
        const newSelected = new Set(selectedItemsSet);
        if (selected) {
          if (multiSelect) {
            newSelected.add(id);
          } else {
            newSelected.clear();
            newSelected.add(id);
          }
        } else {
          newSelected.delete(id);
        }
        onSelectedItemsChange(Array.from(newSelected));
      } else {
        setInternalSelectedItems((prev) => {
          const newSelected = new Set(prev);
          if (selected) {
            if (multiSelect) {
              newSelected.add(id);
            } else {
              newSelected.clear();
              newSelected.add(id);
            }
          } else {
            newSelected.delete(id);
          }
          return newSelected;
        });
      }
    },
    [selectedItemsSet, onSelectedItemsChange, multiSelect]
  );

  const handleToggleExpanded = React.useCallback(
    (id: string) => {
      if (onExpandedItemsChange) {
        const newExpanded = new Set(expandedItemsSet);
        if (newExpanded.has(id)) {
          newExpanded.delete(id);
        } else {
          newExpanded.add(id);
        }
        onExpandedItemsChange(Array.from(newExpanded));
      } else {
        setInternalExpandedItems((prev) => {
          const newExpanded = new Set(prev);
          if (newExpanded.has(id)) {
            newExpanded.delete(id);
          } else {
            newExpanded.add(id);
          }
          return newExpanded;
        });
      }
    },
    [expandedItemsSet, onExpandedItemsChange]
  );

  const contextValue = React.useMemo(
    () => ({
      selectedItems: onSelectedItemsChange ? selectedItemsSet : internalSelectedItems,
      onSelectItem: handleSelectItem,
      expandedItems: onExpandedItemsChange ? expandedItemsSet : internalExpandedItems,
      onToggleExpanded: handleToggleExpanded,
      multiSelect,
    }),
    [
      selectedItemsSet,
      internalSelectedItems,
      handleSelectItem,
      expandedItemsSet,
      internalExpandedItems,
      handleToggleExpanded,
      multiSelect,
      onSelectedItemsChange,
      onExpandedItemsChange,
    ]
  );

  return (
    <TreeViewContext.Provider value={contextValue}>
      <div className={cn('tree-view', className)} role="tree">
        {children}
      </div>
    </TreeViewContext.Provider>
  );
}

export interface TreeItemProps {
  id: string;
  children?: React.ReactNode;
  label: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  hasChildren?: boolean;
  level?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function TreeItem({
  id,
  children,
  label,
  icon,
  className,
  disabled = false,
  hasChildren = false,
  level = 0,
  onClick,
  onDoubleClick,
}: TreeItemProps) {
  const context = React.useContext(TreeViewContext);
  if (!context) {
    throw new Error('TreeItem must be used within a TreeView');
  }

  const { selectedItems, onSelectItem, expandedItems, onToggleExpanded } = context;
  const isSelected = selectedItems.has(id);
  const isExpanded = expandedItems.has(id);
  const hasChildrenToRender = hasChildren && children;

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      onSelectItem(id, !isSelected);
      onClick?.();
    }
  }, [disabled, onSelectItem, id, isSelected, onClick]);

  const handleToggle = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasChildren && !disabled) {
        onToggleExpanded(id);
      }
    },
    [hasChildren, disabled, onToggleExpanded, id]
  );

  const handleDoubleClick = React.useCallback(() => {
    if (!disabled) {
      onDoubleClick?.();
    }
  }, [disabled, onDoubleClick]);

  return (
    <div className={cn('tree-item', className)}>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ paddingLeft: `${(level + 1) * 12}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={level + 1}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={handleToggle}
            disabled={disabled}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="h-4 w-4" />
        )}
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <span className="flex-1 truncate text-sm">{label}</span>
      </div>
      {hasChildrenToRender && isExpanded && (
        <div className="tree-item-children" role="group">
          {children}
        </div>
      )}
    </div>
  );
}

export { TreeViewContext };