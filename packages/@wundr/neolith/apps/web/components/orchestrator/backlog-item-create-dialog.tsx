/**
 * BacklogItem Create Dialog Component
 *
 * Dialog for creating new backlog items with form validation
 *
 * @module components/orchestrator/backlog-item-create-dialog
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';

/**
 * Form schema
 */
const createBacklogItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']),
  estimatedHours: z.coerce.number().int().positive().max(1000).optional(),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
});

type CreateBacklogItemFormData = z.infer<typeof createBacklogItemSchema>;

/**
 * Props for BacklogItemCreateDialog
 */
interface BacklogItemCreateDialogProps {
  orchestratorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * BacklogItemCreateDialog Component
 */
export function BacklogItemCreateDialog({
  orchestratorId,
  open,
  onOpenChange,
  onCreated,
}: BacklogItemCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateBacklogItemFormData>({
    resolver: zodResolver(createBacklogItemSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      status: 'TODO',
      tags: '',
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: CreateBacklogItemFormData) => {
      setIsSubmitting(true);

      try {
        // Parse tags
        const tags = data.tags
          ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];

        // Prepare payload
        const payload = {
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          status: data.status,
          estimatedHours: data.estimatedHours || null,
          dueDate: data.dueDate || null,
          tags,
        };

        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/backlog`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to create backlog item');
        }

        toast({
          title: 'Success',
          description: 'Backlog item created successfully',
        });

        form.reset();
        onOpenChange(false);
        onCreated?.();
      } catch (error) {
        console.error('[BacklogItemCreateDialog] Error:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to create backlog item',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [orchestratorId, form, onOpenChange, onCreated, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Add Backlog Item</DialogTitle>
          <DialogDescription>
            Create a new task for this orchestrator&apos;s backlog
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            {/* Title */}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Enter task title'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter detailed description'
                      rows={4}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide context and requirements for this task
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority and Status */}
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select priority' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='CRITICAL'>Critical</SelectItem>
                        <SelectItem value='HIGH'>High</SelectItem>
                        <SelectItem value='MEDIUM'>Medium</SelectItem>
                        <SelectItem value='LOW'>Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='TODO'>To Do</SelectItem>
                        <SelectItem value='IN_PROGRESS'>In Progress</SelectItem>
                        <SelectItem value='BLOCKED'>Blocked</SelectItem>
                        <SelectItem value='DONE'>Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Estimated Hours and Due Date */}
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='estimatedHours'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='8'
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Estimated time to complete
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='dueDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type='datetime-local'
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tags */}
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='feature, backend, api'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated tags for categorization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus className='h-4 w-4 mr-2' />
                    Create Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
