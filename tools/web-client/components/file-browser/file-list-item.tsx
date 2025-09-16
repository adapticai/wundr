'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Download, 
  Copy, 
  Eye, 
  Edit,
  FolderIcon 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileSystemItem, getFileTypeInfo, formatFileSize, formatDate } from '@/lib/file-system';
import { cn } from '@/lib/utils';

export interface FileListItemProps {
  item: FileSystemItem;
  isSelected: boolean;
  viewMode: 'list' | 'grid';
  onSelect: (item: FileSystemItem) => void;
  onDoubleClick: (item: FileSystemItem) => void;
  onDownload?: (item: FileSystemItem) => void;
  onCopyPath?: (item: FileSystemItem) => void;
  onView?: (item: FileSystemItem) => void;
  onEdit?: (item: FileSystemItem) => void;
  className?: string;
}

export function FileListItem({
  item,
  isSelected,
  viewMode,
  onSelect,
  onDoubleClick,
  onDownload,
  onCopyPath,
  onView,
  onEdit,
  className,
}: FileListItemProps) {
  const typeInfo = getFileTypeInfo(item.name);
  const IconComponent = item.type === 'directory' ? FolderIcon : typeInfo.icon;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(item.path);
      onCopyPath?.(item);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  const handleDownload = () => {
    onDownload?.(item);
  };

  const handleView = () => {
    onView?.(item);
  };

  const handleEdit = () => {
    onEdit?.(item);
  };

  if (viewMode === 'grid') {
    return (
      <div
        className={cn(
          'group relative flex flex-col items-center gap-3 p-4 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground border transition-colors',
          isSelected && 'bg-accent text-accent-foreground border-primary',
          !isSelected && 'border-transparent',
          className
        )}
        onClick={() => onSelect(item)}
        onDoubleClick={() => onDoubleClick(item)}
      >
        <div className="relative">
          <IconComponent className={cn('h-10 w-10', typeInfo.color)} />
          {item.type === 'file' && (
            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleView}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCopyPath}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Path
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        <div className="text-center w-full">
          <div className="font-medium text-sm truncate max-w-24" title={item.name}>
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {item.type === 'file' && item.size !== undefined && (
              <span>{formatFileSize(item.size)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground border transition-colors',
        isSelected && 'bg-accent text-accent-foreground border-primary',
        !isSelected && 'border-transparent',
        className
      )}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick(item)}
    >
      <IconComponent className={cn('h-5 w-5 flex-shrink-0', typeInfo.color)} />
      
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.name}</div>
        <div className="text-sm text-muted-foreground flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {item.type === 'directory' ? 'Folder' : typeInfo.category}
          </Badge>
          {item.size !== undefined && (
            <span>{formatFileSize(item.size)}</span>
          )}
          {item.modifiedAt && (
            <span>{formatDate(item.modifiedAt)}</span>
          )}
        </div>
      </div>
      
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.type === 'file' && (
              <DropdownMenuItem onClick={handleView}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
            )}
            {item.type === 'file' && (
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {item.type === 'file' && (
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyPath}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Path
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default FileListItem;