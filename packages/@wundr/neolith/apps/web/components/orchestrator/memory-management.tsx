/**
 * Orchestrator Memory Management Component
 *
 * Provides a complete UI for managing orchestrator memory entries:
 * - View all memories in a table
 * - Search and filter memories
 * - Edit existing memories
 * - Delete memories
 * - View memory details
 *
 * @module components/orchestrator/memory-management
 */
'use client';

import {
  Search,
  Trash2,
  Edit,
  Eye,
  Filter,
  RefreshCw,
  Database,
  Clock,
  Tag,
  AlertCircle,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import React, { useState, useCallback, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Memory entry interface matching API response
 */
interface MemoryEntry {
  id: string;
  orchestratorId: string;
  memoryType: string;
  content: string;
  importance: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Memory type configuration for visual styling
 */
const MEMORY_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  conversation: {
    label: 'Conversation',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  task: { label: 'Task', color: 'text-green-700', bgColor: 'bg-green-100' },
  agent: { label: 'Agent', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  global: { label: 'Global', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  workspace: {
    label: 'Workspace',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  learned_pattern: {
    label: 'Learned Pattern',
    color: 'text-pink-700',
    bgColor: 'bg-pink-100',
  },
  preference: {
    label: 'Preference',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
  task_completion: {
    label: 'Task Completion',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
};

interface MemoryManagementProps {
  orchestratorId: string;
}

export function MemoryManagement({ orchestratorId }: MemoryManagementProps) {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  // State
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(
    null,
  );

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    content: '',
    importance: 0.5,
    expiresAt: '',
  });

  /**
   * Fetch memories from API
   */
  const fetchMemories = useCallback(
    async (searchTerm?: string) => {
      if (!workspaceSlug || !orchestratorId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (searchTerm) {
          params.set('search', searchTerm);
        }

        if (memoryTypeFilter && memoryTypeFilter !== 'all') {
          params.set('memoryType', memoryTypeFilter);
        }

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch memories: ${response.status}`);
        }

        const result = await response.json();
        setMemories(result.data || []);
        setTotalPages(result.pagination?.pages || 1);
        setTotalCount(result.pagination?.total || 0);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to fetch memories');
        setError(error);
        console.error('[MemoryManagement] Error fetching memories:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceSlug, orchestratorId, page, memoryTypeFilter],
  );

  /**
   * Search memories
   */
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '20',
      });

      if (memoryTypeFilter && memoryTypeFilter !== 'all') {
        params.set('memoryType', memoryTypeFilter);
      }

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const result = await response.json();
      setMemories(result.data || []);
      setTotalCount(result.meta?.totalResults || 0);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Search failed');
      setError(error);
      console.error('[MemoryManagement] Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, workspaceSlug, orchestratorId, memoryTypeFilter]);

  /**
   * Clear search and filters
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setMemoryTypeFilter('all');
    setPage(1);
    fetchMemories();
  }, [fetchMemories]);

  /**
   * View memory details
   */
  const handleViewMemory = useCallback((memory: MemoryEntry) => {
    setSelectedMemory(memory);
    setViewDialogOpen(true);
  }, []);

  /**
   * Open edit dialog
   */
  const handleEditMemory = useCallback((memory: MemoryEntry) => {
    setSelectedMemory(memory);
    setEditFormData({
      content: memory.content,
      importance: memory.importance,
      expiresAt: memory.expiresAt
        ? new Date(memory.expiresAt).toISOString().slice(0, 16)
        : '',
    });
    setEditDialogOpen(true);
  }, []);

  /**
   * Save memory edits
   */
  const handleSaveEdit = useCallback(async () => {
    if (!selectedMemory || !workspaceSlug || !orchestratorId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory/${selectedMemory.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editFormData.content,
            importance: editFormData.importance,
            expiresAt: editFormData.expiresAt || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update memory: ${response.status}`);
      }

      setEditDialogOpen(false);
      setSelectedMemory(null);
      fetchMemories();
    } catch (err) {
      console.error('[MemoryManagement] Update error:', err);
      alert('Failed to update memory. Please try again.');
    }
  }, [
    selectedMemory,
    workspaceSlug,
    orchestratorId,
    editFormData,
    fetchMemories,
  ]);

  /**
   * Open delete confirmation
   */
  const handleDeleteMemory = useCallback((memory: MemoryEntry) => {
    setSelectedMemory(memory);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Confirm delete
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedMemory || !workspaceSlug || !orchestratorId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory/${selectedMemory.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.status}`);
      }

      setDeleteDialogOpen(false);
      setSelectedMemory(null);
      fetchMemories();
    } catch (err) {
      console.error('[MemoryManagement] Delete error:', err);
      alert('Failed to delete memory. Please try again.');
    }
  }, [selectedMemory, workspaceSlug, orchestratorId, fetchMemories]);

  /**
   * Format relative time
   */
  const formatRelativeTime = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return (
    <div className='space-y-6'>
      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Database className='h-5 w-5' />
            Memory Overview
          </CardTitle>
          <CardDescription>
            Manage orchestrator memory entries and context
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='border rounded-lg p-4'>
              <p className='text-xs text-muted-foreground mb-1'>
                Total Memories
              </p>
              <p className='text-2xl font-bold'>{totalCount}</p>
            </div>
            <div className='border rounded-lg p-4'>
              <p className='text-xs text-muted-foreground mb-1'>
                Current Page
              </p>
              <p className='text-2xl font-bold'>
                {page} / {totalPages}
              </p>
            </div>
            <div className='border rounded-lg p-4'>
              <p className='text-xs text-muted-foreground mb-1'>
                Active Filters
              </p>
              <p className='text-2xl font-bold'>
                {(searchQuery ? 1 : 0) + (memoryTypeFilter !== 'all' ? 1 : 0)}
              </p>
            </div>
            <div className='border rounded-lg p-4'>
              <p className='text-xs text-muted-foreground mb-1'>Page Size</p>
              <p className='text-2xl font-bold'>20</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Search &amp; Filter
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-3'>
            <div className='flex-1'>
              <Label htmlFor='search-input' className='sr-only'>
                Search memories
              </Label>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  id='search-input'
                  placeholder='Search memory content...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className='pl-9'
                />
              </div>
            </div>
            <Select value={memoryTypeFilter} onValueChange={setMemoryTypeFilter}>
              <SelectTrigger className='w-48'>
                <SelectValue placeholder='All Types' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Types</SelectItem>
                <SelectItem value='conversation'>Conversation</SelectItem>
                <SelectItem value='task'>Task</SelectItem>
                <SelectItem value='agent'>Agent</SelectItem>
                <SelectItem value='workspace'>Workspace</SelectItem>
                <SelectItem value='global'>Global</SelectItem>
                <SelectItem value='learned_pattern'>Learned Pattern</SelectItem>
                <SelectItem value='preference'>Preference</SelectItem>
                <SelectItem value='task_completion'>Task Completion</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isLoading}>
              <Search className='h-4 w-4 mr-2' />
              Search
            </Button>
            {(searchQuery || memoryTypeFilter !== 'all') && (
              <Button
                variant='outline'
                onClick={handleClearSearch}
                disabled={isLoading}
              >
                <X className='h-4 w-4 mr-2' />
                Clear
              </Button>
            )}
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => fetchMemories()}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Memories Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Entries</CardTitle>
          <CardDescription>
            All memory entries for this orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              {[1, 2, 3].map(i => (
                <div key={i} className='flex gap-3 items-start animate-pulse'>
                  <div className='h-16 w-full bg-muted rounded' />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className='flex flex-col items-center justify-center py-12'>
              <div className='rounded-lg border border-red-200 bg-red-50 p-6 max-w-md text-center'>
                <AlertCircle className='h-8 w-8 text-red-600 mx-auto mb-3' />
                <p className='text-sm text-red-800 font-medium'>
                  Failed to load memories
                </p>
                <p className='text-xs text-red-600 mt-1'>{error.message}</p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => fetchMemories()}
                  className='mt-3'
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : memories.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Database className='h-12 w-12 text-muted-foreground/50 mb-4' />
              <p className='text-sm font-medium text-muted-foreground'>
                No memories found
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                {searchQuery || memoryTypeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Memory entries will appear here as the orchestrator learns'}
              </p>
            </div>
          ) : (
            <>
              <div className='rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Importance</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memories.map(memory => {
                      const typeConfig =
                        MEMORY_TYPE_CONFIG[memory.memoryType] ||
                        MEMORY_TYPE_CONFIG.global;

                      return (
                        <TableRow key={memory.id}>
                          <TableCell>
                            <Badge
                              variant='outline'
                              className={cn(typeConfig.bgColor, typeConfig.color)}
                            >
                              <Tag className='h-3 w-3 mr-1' />
                              {typeConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className='max-w-md'>
                            <p className='text-sm truncate'>{memory.content}</p>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <div className='w-24 h-2 bg-muted rounded-full overflow-hidden'>
                                <div
                                  className='h-full bg-primary'
                                  style={{
                                    width: `${memory.importance * 100}%`,
                                  }}
                                />
                              </div>
                              <span className='text-xs text-muted-foreground'>
                                {(memory.importance * 100).toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                              <Clock className='h-3 w-3' />
                              {formatRelativeTime(memory.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {memory.expiresAt ? (
                              <span className='text-xs text-muted-foreground'>
                                {new Date(memory.expiresAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className='text-xs text-muted-foreground'>
                                Never
                              </span>
                            )}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex justify-end gap-1'>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleViewMemory(memory)}
                              >
                                <Eye className='h-4 w-4' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleEditMemory(memory)}
                              >
                                <Edit className='h-4 w-4' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleDeleteMemory(memory)}
                                className='text-red-600 hover:text-red-700 hover:bg-red-50'
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing page {page} of {totalPages}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Memory Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Memory Details</DialogTitle>
            <DialogDescription>
              Detailed information about this memory entry
            </DialogDescription>
          </DialogHeader>
          {selectedMemory && (
            <div className='space-y-4'>
              <div>
                <Label className='text-xs text-muted-foreground'>Type</Label>
                <Badge
                  variant='outline'
                  className={cn(
                    'mt-1',
                    MEMORY_TYPE_CONFIG[selectedMemory.memoryType]?.bgColor,
                    MEMORY_TYPE_CONFIG[selectedMemory.memoryType]?.color,
                  )}
                >
                  {MEMORY_TYPE_CONFIG[selectedMemory.memoryType]?.label}
                </Badge>
              </div>
              <div>
                <Label className='text-xs text-muted-foreground'>Content</Label>
                <p className='mt-1 text-sm bg-muted p-3 rounded-md'>
                  {selectedMemory.content}
                </p>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Importance
                  </Label>
                  <p className='mt-1 text-sm font-medium'>
                    {(selectedMemory.importance * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Created At
                  </Label>
                  <p className='mt-1 text-sm'>
                    {new Date(selectedMemory.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Expires At
                  </Label>
                  <p className='mt-1 text-sm'>
                    {selectedMemory.expiresAt
                      ? new Date(selectedMemory.expiresAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Memory ID
                  </Label>
                  <p className='mt-1 text-xs font-mono text-muted-foreground truncate'>
                    {selectedMemory.id}
                  </p>
                </div>
              </div>
              {selectedMemory.metadata &&
                Object.keys(selectedMemory.metadata).length > 0 && (
                  <div>
                    <Label className='text-xs text-muted-foreground'>
                      Metadata
                    </Label>
                    <pre className='mt-1 text-xs bg-muted p-3 rounded-md overflow-auto max-h-32'>
                      {JSON.stringify(selectedMemory.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Memory Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
            <DialogDescription>
              Update the content and metadata of this memory entry
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='edit-content'>Content</Label>
              <Textarea
                id='edit-content'
                value={editFormData.content}
                onChange={e =>
                  setEditFormData({ ...editFormData, content: e.target.value })
                }
                rows={6}
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='edit-importance'>
                Importance: {(editFormData.importance * 100).toFixed(0)}%
              </Label>
              <input
                id='edit-importance'
                type='range'
                min='0'
                max='1'
                step='0.01'
                value={editFormData.importance}
                onChange={e =>
                  setEditFormData({
                    ...editFormData,
                    importance: parseFloat(e.target.value),
                  })
                }
                className='w-full mt-1'
              />
            </div>
            <div>
              <Label htmlFor='edit-expires'>Expires At (Optional)</Label>
              <Input
                id='edit-expires'
                type='datetime-local'
                value={editFormData.expiresAt}
                onChange={e =>
                  setEditFormData({
                    ...editFormData,
                    expiresAt: e.target.value,
                  })
                }
                className='mt-1'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Memory</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this memory entry? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedMemory && (
            <div className='bg-muted p-3 rounded-md'>
              <p className='text-sm text-muted-foreground mb-1'>Content:</p>
              <p className='text-sm font-medium'>{selectedMemory.content}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete}>
              Delete Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
