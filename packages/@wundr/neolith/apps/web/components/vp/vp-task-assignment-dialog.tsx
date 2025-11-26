'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import type { VP } from '@/types/vp';

// Task priority levels
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Task assignment form schema
const taskAssignmentSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be 1000 characters or less'),
  priority: z.enum(TASK_PRIORITIES),
  vpId: z.string().min(1, 'Please select a VP'),
});

type TaskAssignmentFormValues = z.infer<typeof taskAssignmentSchema>;

interface VPTaskAssignmentDialogProps {
  vps: VP[];
  onAssignTask?: (task: TaskAssignmentFormValues) => Promise<void>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function VPTaskAssignmentDialog({
  vps,
  onAssignTask,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: VPTaskAssignmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const form = useForm<TaskAssignmentFormValues>({
    resolver: zodResolver(taskAssignmentSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      vpId: '',
    },
  });

  const handleSubmit = async (values: TaskAssignmentFormValues) => {
    if (!onAssignTask) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onAssignTask(values);
      form.reset();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to assign task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter only active VPs
  const activeVPs = vps.filter((vp) => vp.status === 'ACTIVE');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Assign Task to VP</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to a virtual person. Only active VPs are available for assignment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Task Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Review user feedback"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Task Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed information about the task..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide clear instructions and context for the VP
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-gray-500" />
                          Low
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-orange-500" />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Urgent
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* VP Selector */}
            <FormField
              control={form.control}
              name="vpId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to VP</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a VP" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeVPs.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No active VPs available
                        </div>
                      ) : (
                        activeVPs.map((vp) => (
                          <SelectItem key={vp.id} value={vp.id}>
                            <div className="flex items-center gap-2">
                              {vp.avatarUrl ? (
                                <img
                                  src={vp.avatarUrl}
                                  alt={vp.title}
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {vp.title.charAt(0)}
                                </div>
                              )}
                              <span className="truncate">
                                {vp.title}
                                {vp.discipline && (
                                  <span className="ml-1 text-muted-foreground">
                                    ({vp.discipline})
                                  </span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {activeVPs.length === 0
                      ? 'No VPs are currently active. Please activate a VP first.'
                      : 'Choose which VP should handle this task'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || activeVPs.length === 0}
              >
                {isSubmitting ? 'Assigning...' : 'Assign Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Priority badge component for reuse
export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = {
    low: { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' },
    medium: { label: 'Medium', color: 'text-blue-700', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
    high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
    urgent: { label: 'Urgent', color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
  }[priority];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${config.bgColor} ${config.color}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}
