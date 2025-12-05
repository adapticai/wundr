/**
 * OrchestratorBacklog List Component
 *
 * Displays and manages backlog items for an orchestrator with:
 * - Drag-and-drop reordering
 * - Filtering by status and priority
 * - Creating new backlog items
 * - Editing and completing items
 *
 * @module components/orchestrator/backlog-list
 */
'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  GripVertical,
  Edit,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import React, { useState, useCallback, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { BacklogItemCreateDialog } from './backlog-item-create-dialog';
import { BacklogItemEditDialog } from './backlog-item-edit-dialog';

/**
 * Task status configuration
 */
const TASK_STATUS_CONFIG = {
  TODO: {
    icon: Circle,
    label: 'To Do',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  IN_PROGRESS: {
    icon: Clock,
    label: 'In Progress',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  BLOCKED: {
    icon: AlertCircle,
    label: 'Blocked',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  DONE: {
    icon: CheckCircle2,
    label: 'Done',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
} as const;

/**
 * Priority configuration
 */
const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
  HIGH: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  LOW: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
} as const;

/**
 * Task interface
 */
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: keyof typeof TASK_STATUS_CONFIG;
  priority: keyof typeof PRIORITY_CONFIG;
  dueDate: string | null;
  tags: string[];
  estimatedHours: number | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Backlog item interface
 */
interface BacklogItem {
  id: string;
  position: number;
  task: Task;
}

/**
 * Props for BacklogList
 */
interface BacklogListProps {
  orchestratorId: string;
  onCreateNew?: () => void;
}

/**
 * Sortable backlog item component
 */
function SortableBacklogItem({
  item,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  item: BacklogItem;
  onEdit: (item: BacklogItem) => void;
  onDelete: (itemId: string) => void;
  onStatusChange: (itemId: string, status: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = TASK_STATUS_CONFIG[item.task.status];
  const priorityConfig = PRIORITY_CONFIG[item.task.priority];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border bg-card p-4 transition-all',
        isDragging && 'opacity-50 shadow-lg',
        !isDragging && 'hover:border-primary/50 hover:shadow-sm',
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className='absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity'
      >
        <GripVertical className='h-5 w-5 text-muted-foreground' />
      </div>

      <div className='pl-6 pr-24'>
        {/* Header */}
        <div className='flex items-start gap-3'>
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full shrink-0 mt-0.5',
              statusConfig.bgColor,
            )}
          >
            <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
          </div>
          <div className='flex-1 min-w-0'>
            <h4 className='font-semibold text-sm leading-tight mb-1'>
              {item.task.title}
            </h4>
            {item.task.description && (
              <p className='text-sm text-muted-foreground line-clamp-2'>
                {item.task.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className='flex flex-wrap gap-2 mt-3 pl-9'>
          <Badge className={cn(priorityConfig.bgColor, priorityConfig.color, 'text-xs')}>
            {priorityConfig.label}
          </Badge>
          <Badge variant='outline' className='text-xs'>
            {statusConfig.label}
          </Badge>
          {item.task.estimatedHours && (
            <Badge variant='secondary' className='text-xs'>
              <Clock className='h-3 w-3 mr-1' />
              {item.task.estimatedHours}h
            </Badge>
          )}
          {item.task.dueDate && (
            <Badge variant='secondary' className='text-xs'>
              Due: {new Date(item.task.dueDate).toLocaleDateString()}
            </Badge>
          )}
          {item.task.tags.length > 0 && (
            <div className='flex gap-1'>
              {item.task.tags.slice(0, 2).map((tag, idx) => (
                <Badge key={idx} variant='outline' className='text-xs'>
                  {tag}
                </Badge>
              ))}
              {item.task.tags.length > 2 && (
                <Badge variant='outline' className='text-xs'>
                  +{item.task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className='absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
              <ChevronDown className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={item.task.status === status}
                onCheckedChange={() => onStatusChange(item.id, status)}
              >
                {config.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0'
          onClick={() => onEdit(item)}
        >
          <Edit className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
}

/**
 * BacklogList Component
 *
 * Main component for displaying and managing orchestrator backlog
 */
export function BacklogList({ orchestratorId }: BacklogListProps) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /**
   * Fetch backlog items
   */
  const fetchItems = useCallback(async () => {
    if (!orchestratorId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter.length > 0) {
        params.set('status', statusFilter.join(','));
      }
      if (priorityFilter.length > 0) {
        params.set('priority', priorityFilter.join(','));
      }
      params.set('includeCompleted', includeCompleted.toString());
      params.set('limit', '100');

      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/backlog?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch backlog: ${response.status}`);
      }

      const result = await response.json();
      const tasks = result.data || [];

      // Convert tasks to backlog items format
      const backlogItems: BacklogItem[] = tasks.map((task: Task, index: number) => ({
        id: task.id,
        position: index,
        task,
      }));

      setItems(backlogItems);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch backlog');
      setError(error);
      console.error('[BacklogList] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orchestratorId, statusFilter, priorityFilter, includeCompleted]);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });

      // TODO: Persist order to backend via API call
      // PATCH /api/orchestrators/{id}/backlog/reorder
    }
  }, []);

  /**
   * Handle status change
   */
  const handleStatusChange = useCallback(async (itemId: string, status: string) => {
    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/backlog/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchItems();
    } catch (err) {
      console.error('[BacklogList] Status update error:', err);
    }
  }, [orchestratorId, fetchItems]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item from the backlog?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/backlog/${itemId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      await fetchItems();
    } catch (err) {
      console.error('[BacklogList] Delete error:', err);
    }
  }, [orchestratorId, fetchItems]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='h-20 bg-muted rounded-lg animate-pulse' />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
            <p className='text-sm font-medium text-red-800'>Failed to load backlog</p>
            <p className='text-xs text-red-600 mt-1'>{error.message}</p>
            <Button variant='outline' size='sm' onClick={fetchItems} className='mt-4'>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle>Backlog</CardTitle>
              <CardDescription>
                Manage tasks and priorities for this orchestrator
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              {/* Filters */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm'>
                    <Filter className='h-4 w-4 mr-2' />
                    Filters
                    {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                      <Badge variant='secondary' className='ml-2'>
                        {statusFilter.length + priorityFilter.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilter.includes(status)}
                      onCheckedChange={(checked) => {
                        setStatusFilter((prev) =>
                          checked
                            ? [...prev, status]
                            : prev.filter((s) => s !== status),
                        );
                      }}
                    >
                      {config.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Priority</DropdownMenuLabel>
                  {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                    <DropdownMenuCheckboxItem
                      key={priority}
                      checked={priorityFilter.includes(priority)}
                      onCheckedChange={(checked) => {
                        setPriorityFilter((prev) =>
                          checked
                            ? [...prev, priority]
                            : prev.filter((p) => p !== priority),
                        );
                      }}
                    >
                      {config.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={includeCompleted}
                    onCheckedChange={setIncludeCompleted}
                  >
                    Include Completed
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Create Button */}
              <Button size='sm' onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className='h-4 w-4 mr-2' />
                Add Task
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className='text-center py-12'>
              <Circle className='h-12 w-12 text-muted-foreground/50 mx-auto mb-4' />
              <p className='text-sm font-medium text-muted-foreground'>
                No backlog items
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Create your first task to get started
              </p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsCreateDialogOpen(true)}
                className='mt-4'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Task
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className='space-y-2'>
                  {items.map((item) => (
                    <SortableBacklogItem
                      key={item.id}
                      item={item}
                      onEdit={setEditingItem}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <BacklogItemCreateDialog
        orchestratorId={orchestratorId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={fetchItems}
      />

      {/* Edit Dialog */}
      {editingItem && (
        <BacklogItemEditDialog
          orchestratorId={orchestratorId}
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          onUpdated={fetchItems}
        />
      )}
    </>
  );
}
