'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Loader } from '@/components/ai/loader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

const workspaceReviewSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  organizationType: z.string().optional(),
  teamSize: z.enum(['small', 'medium', 'large']).optional(),
  purpose: z.string().optional(),
});

export type WorkspaceReviewData = z.infer<typeof workspaceReviewSchema>;

interface WorkspaceReviewFormProps {
  initialData: Partial<WorkspaceReviewData>;
  onSubmit: (data: WorkspaceReviewData) => void | Promise<void>;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function WorkspaceReviewForm({
  initialData,
  onSubmit,
  onBack,
  isSubmitting = false,
}: WorkspaceReviewFormProps) {
  const form = useForm<WorkspaceReviewData>({
    resolver: zodResolver(workspaceReviewSchema),
    defaultValues: {
      name: initialData.name || '',
      description: initialData.description || '',
      organizationType: initialData.organizationType || '',
      teamSize: initialData.teamSize || undefined,
      purpose: initialData.purpose || '',
    },
  });

  const handleFormSubmit = async (data: WorkspaceReviewData) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Workspace Details</CardTitle>
        <CardDescription>
          Review and edit the information gathered from our conversation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className='space-y-6'
        >
          {/* Name */}
          <div className='space-y-2'>
            <Label htmlFor='name'>Workspace Name *</Label>
            <Input
              id='name'
              {...form.register('name')}
              placeholder='e.g., Acme Corp Workspace'
              disabled={isSubmitting}
            />
            {form.formState.errors.name && (
              <p className='text-sm text-destructive'>
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='description'>Description *</Label>
            <Textarea
              id='description'
              {...form.register('description')}
              placeholder='Describe what this workspace is for...'
              rows={4}
              disabled={isSubmitting}
            />
            {form.formState.errors.description && (
              <p className='text-sm text-destructive'>
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            {/* Organization Type */}
            <div className='space-y-2'>
              <Label htmlFor='organizationType'>Organization Type</Label>
              <Input
                id='organizationType'
                {...form.register('organizationType')}
                placeholder='e.g., Technology, Finance'
                disabled={isSubmitting}
              />
            </div>

            {/* Team Size */}
            <div className='space-y-2'>
              <Label htmlFor='teamSize'>Team Size</Label>
              <Select
                value={form.watch('teamSize') || ''}
                onValueChange={value =>
                  form.setValue(
                    'teamSize',
                    value as 'small' | 'medium' | 'large'
                  )
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id='teamSize'>
                  <SelectValue placeholder='Select team size' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='small'>Small (1-10)</SelectItem>
                  <SelectItem value='medium'>Medium (10-50)</SelectItem>
                  <SelectItem value='large'>Large (50+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Purpose */}
          <div className='space-y-2'>
            <Label htmlFor='purpose'>Purpose / Mission</Label>
            <Textarea
              id='purpose'
              {...form.register('purpose')}
              placeholder='What is the primary goal or mission?'
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Form Actions */}
          <div className='flex justify-between pt-4 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onBack}
              disabled={isSubmitting}
            >
              Back to Conversation
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader size={16} className='mr-2' />
                  Creating Workspace...
                </>
              ) : (
                'Create Workspace'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
