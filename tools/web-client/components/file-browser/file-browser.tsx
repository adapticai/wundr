'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TreeView, TreeItem } from '@/components/ui/tree-view';
import { FileContentViewer } from '@/components/markdown/FileContentViewer';
import {
  Search,
  Grid3x3,
  List,
  FolderIcon,
  RefreshCw,
  Settings,
  ChevronRight,
  Home,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  FileSystemItem,
  getFileTypeInfo,
  formatFileSize,
  formatDate,
  sortFileSystemItems,
  filterFileSystemItems,
} from '@/lib/file-system';
import { cn } from '@/lib/utils';

export interface FileBrowserProps {
  rootPath?: string;
  onFileSelect?: (file: FileSystemItem) => void;
  onFileDoubleClick?: (file: FileSystemItem) => void;
  className?: string;
  showPreview?: boolean;
  defaultViewMode?: 'list' | 'grid';
}

type SortBy = 'name' | 'size' | 'modified' | 'type';
type SortOrder = 'asc' | 'desc';

// Mock file system for development
const generateMockFileSystem = (): FileSystemItem => ({
  id: 'root',
  name: 'root',
  type: 'directory' as const,
  path: '/',
  size: 0,
  modifiedAt: new Date(),
  children: [
    {
      id: 'src',
      name: 'src',
      type: 'directory' as const,
      path: '/src',
      size: 0,
      modifiedAt: new Date(),
      children: [
        {
          id: 'index-ts',
          name: 'index.ts',
          type: 'file' as const,
          path: '/src/index.ts',
          extension: 'ts',
          size: 2048,
          modifiedAt: new Date(),
        },
        {
          id: 'app-tsx',
          name: 'App.tsx',
          type: 'file' as const,
          path: '/src/App.tsx',
          extension: 'tsx',
          size: 4096,
          modifiedAt: new Date(),
        },
      ],
    },
    {
      id: 'package-json',
      name: 'package.json',
      type: 'file' as const,
      path: '/package.json',
      extension: 'json',
      size: 1024,
      modifiedAt: new Date(),
    },
    {
      id: 'readme',
      name: 'README.md',
      type: 'file' as const,
      path: '/README.md',
      extension: 'md',
      size: 3072,
      modifiedAt: new Date(),
    },
  ]
});

export function FileBrowser({
  rootPath: _rootPath = '/',
  onFileSelect,
  onFileDoubleClick,
  className,
  showPreview = true,
  defaultViewMode = 'list',
}: FileBrowserProps) {
  // State management
  const [fileSystem, setFileSystem] = useState<FileSystemItem>(generateMockFileSystem());
  const [selectedFile, setSelectedFile] = useState<FileSystemItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>(['root', 'src']);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(defaultViewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPath, setCurrentPath] = useState<string[]>(['monorepo-refactoring-toolkit']);
  const [isLoading, setIsLoading] = useState(false);

  // Get all file types from the current directory
  const availableFileTypes = useMemo(() => {
    const types = new Set<string>();
    const addTypes = (items: FileSystemItem[]) => {
      items.forEach(item => {
        if (item.type === 'file' && item.extension) {
          types.add(item.extension);
        }
        if (item.children) {
          addTypes(item.children);
        }
      });
    };
    if (fileSystem.children) {
      addTypes(fileSystem.children);
    }
    return Array.from(types).sort();
  }, [fileSystem]);

  // Get current directory items
  const currentDirectoryItems = useMemo(() => {
    let current = fileSystem;
    for (let i = 1; i < currentPath.length; i++) {
      const pathSegment = currentPath[i];
      current = current.children?.find(item => item.name === pathSegment) || current;
    }
    return current.children || [];
  }, [fileSystem, currentPath]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    // Use the filterFileSystemItems utility function
    let filtered = filterFileSystemItems(currentDirectoryItems, searchQuery, showHidden);
    
    // Then filter by file types if any are selected
    if (selectedFileTypes.length > 0) {
      filtered = filtered.filter(item => {
        if (item.type === 'directory') return true;
        const ext = item.extension || '';
        return selectedFileTypes.includes(ext);
      });
    }
    
    // Sort items
    const supportedSortBy = sortBy === 'type' ? 'name' : sortBy;
    const sorted = sortFileSystemItems(filtered, supportedSortBy as 'name' | 'size' | 'modified', sortOrder);
    return sorted;
  }, [currentDirectoryItems, searchQuery, selectedFileTypes, showHidden, sortBy, sortOrder]);

  // Breadcrumb navigation
  const breadcrumbs = useMemo(() => {
    return currentPath.map((segment, index) => ({
      name: segment,
      path: currentPath.slice(0, index + 1).join('/'),
      isLast: index === currentPath.length - 1,
    }));
  }, [currentPath]);

  // Handlers
  const handleFileSelect = useCallback((item: FileSystemItem) => {
    setSelectedFile(item);
    onFileSelect?.(item);
  }, [onFileSelect]);

  const handleFileDoubleClick = useCallback((item: FileSystemItem) => {
    if (item.type === 'directory') {
      setCurrentPath(prev => [...prev, item.name]);
      // Expand the directory in tree view
      setExpandedItems(prev => [...prev, item.id]);
    } else {
      onFileDoubleClick?.(item);
    }
  }, [onFileDoubleClick]);

  const handleBreadcrumbClick = useCallback((pathSegments: string[]) => {
    setCurrentPath(pathSegments);
  }, []);

  const handleTreeItemSelect = useCallback((items: string[]) => {
    setSelectedItems(items);
    if (items.length === 1) {
      const findItem = (nodes: FileSystemItem[], id: string): FileSystemItem | null => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findItem(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const item = findItem([fileSystem], items[0]);
      if (item) {
        handleFileSelect(item);
      }
    }
  }, [fileSystem, handleFileSelect]);

  const handleTreeItemDoubleClick = useCallback((item: FileSystemItem) => {
    handleFileDoubleClick(item);
  }, [handleFileDoubleClick]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setFileSystem(generateMockFileSystem());
    setIsLoading(false);
  }, []);

  const handleSortChange = useCallback((newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  }, [sortBy]);

  // Render tree node
  const renderTreeNode = useCallback((item: FileSystemItem, level: number = 0) => {
    const typeInfo = getFileTypeInfo(item.name);
    const IconComponent = item.type === 'directory' ? FolderIcon : typeInfo.icon;
    
    return (
      <TreeItem
        key={item.id}
        id={item.id}
        label={item.name}
        icon={<IconComponent className={cn('h-4 w-4', typeInfo.color)} />}
        hasChildren={item.type === 'directory' && (item.children?.length || 0) > 0}
        level={level}
        onClick={() => handleFileSelect(item)}
        onDoubleClick={() => handleTreeItemDoubleClick(item)}
      >
        {item.children?.map(child => renderTreeNode(child, level + 1))}
      </TreeItem>
    );
  }, [handleFileSelect, handleTreeItemDoubleClick]);

  // Render file item
  const renderFileItem = useCallback((item: FileSystemItem) => {
    const typeInfo = getFileTypeInfo(item.name);
    const IconComponent = item.type === 'directory' ? FolderIcon : typeInfo.icon;
    const isSelected = selectedFile?.id === item.id;
    
    return (
      <div
        key={item.id}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground border transition-colors',
          isSelected && 'bg-accent text-accent-foreground border-primary',
          !isSelected && 'border-transparent'
        )}
        onClick={() => handleFileSelect(item)}
        onDoubleClick={() => handleFileDoubleClick(item)}
      >
        <IconComponent className={cn('h-5 w-5 flex-shrink-0', typeInfo.color)} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {typeInfo.category}
            </Badge>
            {item.size !== undefined && (
              <span>{formatFileSize(item.size)}</span>
            )}
            {(item.modified || item.modifiedAt) && (
              <span>{formatDate(item.modified || item.modifiedAt)}</span>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedFile, handleFileSelect, handleFileDoubleClick]);

  // Render grid item
  const renderGridItem = useCallback((item: FileSystemItem) => {
    const typeInfo = getFileTypeInfo(item.name);
    const IconComponent = item.type === 'directory' ? FolderIcon : typeInfo.icon;
    const isSelected = selectedFile?.id === item.id;
    
    return (
      <div
        key={item.id}
        className={cn(
          'flex flex-col items-center gap-2 p-4 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground border transition-colors',
          isSelected && 'bg-accent text-accent-foreground border-primary',
          !isSelected && 'border-transparent'
        )}
        onClick={() => handleFileSelect(item)}
        onDoubleClick={() => handleFileDoubleClick(item)}
      >
        <IconComponent className={cn('h-8 w-8', typeInfo.color)} />
        <div className="text-center">
          <div className="font-medium truncate text-sm max-w-24">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            {item.size !== undefined && formatFileSize(item.size)}
          </div>
        </div>
      </div>
    );
  }, [selectedFile, handleFileSelect, handleFileDoubleClick]);

  return (
    <div className={cn('file-browser flex h-full', className)}>
      {/* Sidebar with tree view */}
      <div className="w-1/3 border-r bg-muted/20">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">File Explorer</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHidden(!showHidden)}
              className="text-xs"
            >
              {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showHidden ? 'Hide' : 'Show'} Hidden
            </Button>
          </div>
        </div>
        <div className="p-2 h-[calc(100%-80px)] overflow-y-auto">
          <TreeView
            selectedItems={selectedItems}
            onSelectedItemsChange={handleTreeItemSelect}
            expandedItems={expandedItems}
            onExpandedItemsChange={setExpandedItems}
          >
            {renderTreeNode(fileSystem)}
          </TreeView>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b bg-background p-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 mb-3">
            <Home className="h-4 w-4 text-muted-foreground" />
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 px-2 text-sm',
                    crumb.isLast ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => !crumb.isLast && handleBreadcrumbClick(crumb.path.split('/'))}
                  disabled={crumb.isLast}
                >
                  {crumb.name}
                </Button>
              </React.Fragment>
            ))}
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* File type filters */}
          {availableFileTypes.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground">Filter by type:</span>
              <div className="flex flex-wrap gap-1">
                {availableFileTypes.map(type => (
                  <Badge
                    key={type}
                    variant={selectedFileTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedFileTypes(prev => 
                        prev.includes(type)
                          ? prev.filter(t => t !== type)
                          : [...prev, type]
                      );
                    }}
                  >
                    .{type}
                  </Badge>
                ))}
                {selectedFileTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFileTypes([])}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* File listing */}
        <div className="flex-1 flex">
          <div className={cn(
            'flex-1 p-4 overflow-y-auto',
            !showPreview && 'border-r-0'
          )}>
            <div className="mb-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{filteredAndSortedItems.length} items</span>
                <Separator orientation="vertical" className="h-4" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSortChange('name')}
                  className="h-6 px-2 text-xs"
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSortChange('size')}
                  className="h-6 px-2 text-xs"
                >
                  Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSortChange('modified')}
                  className="h-6 px-2 text-xs"
                >
                  Modified {sortBy === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </div>
            </div>
            
            {filteredAndSortedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No files found</p>
                {(searchQuery || selectedFileTypes.length > 0) && (
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                )}
              </div>
            ) : (
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-4 gap-3'
                  : 'space-y-2'
              )}>
                {filteredAndSortedItems.map(item => 
                  viewMode === 'grid' ? renderGridItem(item) : renderFileItem(item)
                )}
              </div>
            )}
          </div>

          {/* File preview */}
          {showPreview && (
            <div className="w-1/2 border-l bg-muted/20">
              {selectedFile && selectedFile.type === 'file' ? (
                <FileContentViewer
                  filePath={selectedFile.path}
                  fileName={selectedFile.name}
                  fileSize={selectedFile.size}
                  content={selectedFile.name === 'README.md' ? '# Sample README\n\nThis is a sample README file content.' : undefined}
                  className="h-full border-0 rounded-none"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a file to preview</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileBrowser;