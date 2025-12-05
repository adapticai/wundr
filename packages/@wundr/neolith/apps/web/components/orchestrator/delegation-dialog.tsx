/**
 * Delegation Dialog Component
 *
 * Allows orchestrators to delegate tasks to other orchestrators
 * with priority, due date, and note configuration.
 *
 * @module components/orchestrator/delegation-dialog
 */
'use client';

import { useState } from 'react';
import { Calendar, Loader2, Send } from 'lucide-react';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface DelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orchestratorId: string;
  taskId?: string;
  onDelegationSuccess?: () => void;
}

interface OrchestratorOption {
  id: string;
  title: string;
  discipline: string | null;
  status: string;
}

export function DelegationDialog({
  open,
  onOpenChange,
  orchestratorId,
  taskId = '',
  onDelegationSuccess,
}: DelegationDialogProps) {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrchestrators, setIsLoadingOrchestrators] = useState(false);
  const [orchestrators, setOrchestrators] = useState<OrchestratorOption[]>([]);
  const [formData, setFormData] = useState({
    taskId: taskId,
    toOrchestratorId: '',
    priority: 'MEDIUM',
    dueDate: '',
    note: '',
  });

  // Load available orchestrators when dialog opens
  const handleOpenChange = async (open: boolean) => {
    onOpenChange(open);
    if (open && orchestrators.length === 0) {
      await loadOrchestrators();
    }
  };

  const loadOrchestrators = async () => {
    setIsLoadingOrchestrators(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators`,
      );
      if (response.ok) {
        const result = await response.json();
        const allOrchestrators = result.data?.orchestrators || [];
        // Filter out current orchestrator
        const availableOrchestrators = allOrchestrators.filter(
          (o: OrchestratorOption) =>
            o.id !== orchestratorId && o.status === 'ONLINE',
        );
        setOrchestrators(availableOrchestrators);
      }
    } catch (error) {
      console.error('Failed to load orchestrators:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available orchestrators',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOrchestrators(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.taskId || !formData.toOrchestratorId) {
      toast({
        title: 'Validation Error',
        description: 'Task ID and target orchestrator are required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/delegate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: formData.taskId,
            toOrchestratorId: formData.toOrchestratorId,
            priority: formData.priority,
            dueDate: formData.dueDate || undefined,
            note: formData.note || undefined,
          }),
        },
      );

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Task Delegated',
          description:
            result.message || 'Task has been successfully delegated',
        });
        onOpenChange(false);
        onDelegationSuccess?.();
        // Reset form
        setFormData({
          taskId: '',
          toOrchestratorId: '',
          priority: 'MEDIUM',
          dueDate: '',
          note: '',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error?.message || 'Delegation failed');
      }
    } catch (error) {
      console.error('Delegation error:', error);
      toast({
        title: 'Delegation Failed',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Delegate Task</DialogTitle>
          <DialogDescription>
            Delegate a task to another orchestrator for execution
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='taskId'>Task ID</Label>
            <Input
              id='taskId'
              value={formData.taskId}
              onChange={e =>
                setFormData({ ...formData, taskId: e.target.value })
              }
              placeholder='task_123abc...'
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='toOrchestratorId'>Delegate To</Label>
            {isLoadingOrchestrators ? (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='h-4 w-4 animate-spin' />
              </div>
            ) : (
              <Select
                value={formData.toOrchestratorId}
                onValueChange={value =>
                  setFormData({ ...formData, toOrchestratorId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select orchestrator...' />
                </SelectTrigger>
                <SelectContent>
                  {orchestrators.map(orchestrator => (
                    <SelectItem key={orchestrator.id} value={orchestrator.id}>
                      <div className='flex flex-col'>
                        <span className='font-medium'>
                          {orchestrator.title}
                        </span>
                        {orchestrator.discipline && (
                          <span className='text-xs text-muted-foreground'>
                            {orchestrator.discipline}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {orchestrators.length === 0 && (
                    <SelectItem value='none' disabled>
                      No available orchestrators
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='priority'>Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={value =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='LOW'>Low</SelectItem>
                <SelectItem value='MEDIUM'>Medium</SelectItem>
                <SelectItem value='HIGH'>High</SelectItem>
                <SelectItem value='CRITICAL'>Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='dueDate'>Due Date (Optional)</Label>
            <div className='relative'>
              <Input
                id='dueDate'
                type='datetime-local'
                value={formData.dueDate}
                onChange={e =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
              <Calendar className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='note'>Note (Optional)</Label>
            <Textarea
              id='note'
              value={formData.note}
              onChange={e =>
                setFormData({ ...formData, note: e.target.value })
              }
              placeholder='Add delegation context or instructions...'
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Delegating...
                </>
              ) : (
                <>
                  <Send className='mr-2 h-4 w-4' />
                  Delegate Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
