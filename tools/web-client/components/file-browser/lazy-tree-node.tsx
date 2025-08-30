'use client';

import React, { useState, useCallback } from 'react';
import { TreeItem } from '@/components/ui/tree-view';
import { FolderIcon, FileIcon, Loader2 } from 'lucide-react';
import { FileSystemItem, getFileTypeInfo } from '@/lib/file-system';
import { cn } from '@/lib/utils';

export interface LazyTreeNodeProps {
  item: FileSystemItem;
  level?: number;
  onSelect: (item: FileSystemItem) => void;
  onDoubleClick: (item: FileSystemItem) => void;
  onLoadChildren?: (item: FileSystemItem) => Promise<FileSystemItem[]>;
  children?: React.ReactNode;
}

export function LazyTreeNode({
  item,
  level = 0,
  onSelect,
  onDoubleClick,
  onLoadChildren,
  children,
}: LazyTreeNodeProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedChildren, setLoadedChildren] = useState<FileSystemItem[]>(
    item.children || []
  );
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const typeInfo = getFileTypeInfo(item.name);
  const hasChildren = item.type === 'directory' && (!hasLoadedOnce || loadedChildren.length > 0);

  const handleSelect = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  const handleDoubleClick = useCallback(async () => {
    if (item.type === 'directory' && !hasLoadedOnce && onLoadChildren) {
      setIsLoading(true);
      try {
        const children = await onLoadChildren(item);
        setLoadedChildren(children);
        setHasLoadedOnce(true);
      } catch (error) {
        console.error('Failed to load children:', error);
      } finally {
        setIsLoading(false);
      }
    }
    onDoubleClick(item);
  }, [item, hasLoadedOnce, onLoadChildren, onDoubleClick]);

  const renderIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (item.type === 'directory') {
      return <FolderIcon className={cn('h-4 w-4', typeInfo.color)} />;
    }
    const IconComponent = typeInfo.icon;
    return <IconComponent className={cn('h-4 w-4', typeInfo.color)} />;
  };

  return (
    <TreeItem
      id={item.id}
      label={item.name}
      icon={renderIcon()}
      hasChildren={hasChildren}
      level={level}
      onClick={handleSelect}
      onDoubleClick={handleDoubleClick}
      disabled={isLoading}
    >
      {children ||
        (hasLoadedOnce &&
          loadedChildren.map(child => (
            <LazyTreeNode
              key={child.id}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onLoadChildren={onLoadChildren}
            />
          )))}
    </TreeItem>
  );
}

export default LazyTreeNode;