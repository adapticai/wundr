'use client';

import { format } from 'date-fns';
import { Plus, Trash2, Calendar, User } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedToId?: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface DMListsProps {
  channelId: string;
  workspaceSlug: string;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    image?: string | null | undefined;
    [key: string]: any; // Allow additional properties
  }>;
  currentUserId: string;
}

const priorityConfig = {
  CRITICAL: { label: 'Critical', color: 'destructive' as const },
  HIGH: { label: 'High', color: 'destructive' as const },
  MEDIUM: { label: 'Medium', color: 'default' as const },
  LOW: { label: 'Low', color: 'secondary' as const },
};

export function DMListsTab({
  channelId,
  workspaceSlug,
  participants,
  currentUserId,
}: DMListsProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load tasks for this DM conversation
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tasks?channelId=${channelId}&workspaceId=${workspaceSlug}&includeCompleted=true`,
      );

      if (!response.ok) {
        throw new Error('Failed to load tasks');
      }

      const data = await response.json();
      setTasks(data.data || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [channelId, workspaceSlug]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Create a new task
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          status: 'TODO',
          priority: 'MEDIUM',
          workspaceId: workspaceSlug,
          channelId,
          orchestratorId: 'system', // Use a system orchestrator or create one
          creatorId: currentUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const { data } = await response.json();
      setTasks(prev => [data, ...prev]);
      setNewTaskTitle('');
      setIsDialogOpen(false);
      toast.success('Task created');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle task completion
  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          completedAt: newStatus === 'DONE' ? new Date().toISOString() : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const { data } = await response.json();
      setTasks(prev => prev.map(t => (t.id === task.id ? data : t)));
      toast.success(
        newStatus === 'DONE' ? 'Task completed' : 'Task reopened',
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  // Assign task to a participant
  const handleAssignTask = async (taskId: string, userId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign task');
      }

      const { data } = await response.json();
      setTasks(prev => prev.map(t => (t.id === taskId ? data : t)));
      toast.success('Task assigned');
    } catch (error) {
      console.error('Failed to assign task:', error);
      toast.error('Failed to assign task');
    }
  };

  // Update task due date
  const handleUpdateDueDate = async (taskId: string, date: Date | undefined) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: date ? date.toISOString() : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update due date');
      }

      const { data } = await response.json();
      setTasks(prev => prev.map(t => (t.id === taskId ? data : t)));
      toast.success('Due date updated');
    } catch (error) {
      console.error('Failed to update due date:', error);
      toast.error('Failed to update due date');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const completedTasks = tasks.filter(t => t.status === 'DONE' || t.status === 'CANCELLED');

  return (
    <div className='flex h-full flex-col p-4'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='font-semibold text-lg'>Shared Lists</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='task-title'>Task Title</Label>
                <Input
                  id='task-title'
                  placeholder='Enter task title...'
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCreateTask();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleCreateTask}
                disabled={isCreating || !newTaskTitle.trim()}
                className='w-full'
              >
                {isCreating ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className='flex-1 space-y-6 overflow-y-auto'>
        {/* Active Tasks */}
        {activeTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Active Tasks ({activeTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {activeTasks.map(task => (
                <div
                  key={task.id}
                  className='flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50'
                >
                  <Checkbox
                    checked={task.status === 'DONE'}
                    onCheckedChange={() => handleToggleComplete(task)}
                    className='mt-1'
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <p
                        className={`font-medium text-sm ${
                          task.status === 'DONE'
                            ? 'text-muted-foreground line-through'
                            : ''
                        }`}
                      >
                        {task.title}
                      </p>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleDeleteTask(task.id)}
                        className='h-6 w-6 p-0'
                      >
                        <Trash2 className='h-3 w-3 text-muted-foreground' />
                      </Button>
                    </div>
                    {task.description && (
                      <p className='mt-1 text-muted-foreground text-xs'>
                        {task.description}
                      </p>
                    )}
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      {/* Priority Badge */}
                      <Badge
                        variant={priorityConfig[task.priority].color}
                        className='text-xs'
                      >
                        {priorityConfig[task.priority].label}
                      </Badge>

                      {/* Assignee Selector */}
                      <Select
                        value={task.assignedToId || 'unassigned'}
                        onValueChange={value =>
                          handleAssignTask(
                            task.id,
                            value === 'unassigned' ? '' : value,
                          )
                        }
                      >
                        <SelectTrigger className='h-7 w-auto gap-2 border-dashed text-xs'>
                          <User className='h-3 w-3' />
                          <SelectValue placeholder='Assign...' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='unassigned'>Unassigned</SelectItem>
                          {participants.map(participant => (
                            <SelectItem key={participant.id} value={participant.id}>
                              <div className='flex items-center gap-2'>
                                <Avatar className='h-4 w-4'>
                                  <AvatarImage src={participant.image || undefined} />
                                  <AvatarFallback className='text-xs'>
                                    {participant.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                {participant.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Due Date Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            size='sm'
                            className='h-7 gap-2 border-dashed text-xs'
                          >
                            <Calendar className='h-3 w-3' />
                            {task.dueDate
                              ? format(new Date(task.dueDate), 'MMM d')
                              : 'Due date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0' align='start'>
                          <CalendarComponent
                            mode='single'
                            selected={
                              task.dueDate ? new Date(task.dueDate) : undefined
                            }
                            onSelect={date => handleUpdateDueDate(task.id, date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Completed ({completedTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {completedTasks.map(task => (
                <div
                  key={task.id}
                  className='flex items-start gap-3 rounded-md border p-3 opacity-60'
                >
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => handleToggleComplete(task)}
                    className='mt-1'
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <p className='font-medium text-muted-foreground text-sm line-through'>
                        {task.title}
                      </p>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleDeleteTask(task.id)}
                        className='h-6 w-6 p-0'
                      >
                        <Trash2 className='h-3 w-3 text-muted-foreground' />
                      </Button>
                    </div>
                    {task.assignedTo && (
                      <div className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
                        <Avatar className='h-3 w-3'>
                          <AvatarImage src={task.assignedTo.image || undefined} />
                          <AvatarFallback className='text-xs'>
                            {task.assignedTo.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {task.assignedTo.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <Card className='p-12 text-center'>
            <p className='text-muted-foreground'>
              No tasks yet. Create one to get started!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
