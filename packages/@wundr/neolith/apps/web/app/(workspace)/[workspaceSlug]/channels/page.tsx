'use client';

import { Hash, Lock, Plus, Users, MessageSquare, Clock } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { usePageHeader } from '@/contexts/page-header-context';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useChannels } from '@/hooks/use-channel';
import { formatDistanceToNow } from 'date-fns';

import type { Channel } from '@/types/channel';

type ChannelType = 'PUBLIC' | 'PRIVATE';

interface CreateChannelFormData {
  name: string;
  description: string;
  type: ChannelType;
}

export default function ChannelsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Channels', 'Communicate with your team');
  }, [setPageHeader]);

  // Fetch channels using the hook
  const { channels, isLoading, error, refetch } = useChannels(workspaceSlug);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateChannelFormData>({
    name: '',
    description: '',
    type: 'PUBLIC',
  });
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    description?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: { name?: string; description?: string } = {};
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Channel name is required';
      isValid = false;
    } else if (formData.name.length > 80) {
      errors.name = 'Channel name must be 80 characters or less';
      isValid = false;
    } else if (!/^[a-zA-Z0-9\s-]+$/.test(formData.name)) {
      errors.name =
        'Channel name can only contain letters, numbers, spaces, and hyphens';
      isValid = false;
    }

    // Validate description (optional but length check if provided)
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/channels`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            type: formData.type,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const result = await response.json();

      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'PUBLIC',
      });
      setValidationErrors({});
      setIsCreateDialogOpen(false);

      // Refetch channels to update the list
      await refetch();

      // Navigate to the new channel
      if (result.data?.id) {
        router.push(`/${workspaceSlug}/channels/${result.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      setFormError(
        error instanceof Error ? error.message : 'Failed to create channel'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    if (!isSubmitting) {
      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        type: 'PUBLIC',
      });
      setValidationErrors({});
      setFormError(null);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <button
          type='button'
          onClick={() => setIsCreateDialogOpen(true)}
          className='inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <Plus className='h-4 w-4' />
          Create Channel
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm text-red-600'>Failed to load channels</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='h-32 animate-pulse rounded-lg bg-muted' />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && channels.length === 0 && (
        <EmptyState
          icon={Hash}
          title='No Channels Yet'
          description='Create your first channel to start organizing conversations. Channels help keep discussions focused and make it easy to find information.'
          action={{
            label: 'Create Your First Channel',
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      )}

      {/* Channel Grid */}
      {!isLoading && !error && channels.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {channels.map((channel: Channel) => (
            <button
              key={channel.id}
              type='button'
              onClick={() =>
                router.push(`/${workspaceSlug}/channels/${channel.id}`)
              }
              className='rounded-lg border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
            >
              {/* Channel Header */}
              <div className='flex items-start justify-between gap-2'>
                <div className='flex items-center gap-2 min-w-0 flex-1'>
                  {channel.type === 'private' ? (
                    <Lock className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
                  ) : (
                    <Hash className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
                  )}
                  <h3 className='font-semibold truncate'>{channel.name}</h3>
                </div>
                {channel.type === 'private' && (
                  <span className='text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 flex-shrink-0'>
                    Private
                  </span>
                )}
              </div>

              {/* Channel Description */}
              {channel.description && (
                <p className='mt-2 text-sm text-muted-foreground line-clamp-2'>
                  {channel.description}
                </p>
              )}

              {/* Channel Stats */}
              <div className='mt-3 flex items-center gap-4 text-xs text-muted-foreground'>
                {/* Member Count */}
                <div className='flex items-center gap-1'>
                  <Users className='h-3.5 w-3.5' />
                  <span>{channel.memberCount || 0}</span>
                </div>

                {/* Message Count or Last Activity */}
                {channel.lastMessage ? (
                  <div className='flex items-center gap-1'>
                    <MessageSquare className='h-3.5 w-3.5' />
                    <span className='truncate flex-1'>
                      {formatDistanceToNow(
                        new Date(channel.lastMessage.createdAt),
                        {
                          addSuffix: true,
                        }
                      )}
                    </span>
                  </div>
                ) : (
                  <div className='flex items-center gap-1'>
                    <Clock className='h-3.5 w-3.5' />
                    <span>No messages</span>
                  </div>
                )}
              </div>

              {/* Last Message Preview */}
              {channel.lastMessage && (
                <div className='mt-2 pt-2 border-t'>
                  <p className='text-xs text-muted-foreground line-clamp-1'>
                    <span className='font-medium'>
                      {channel.lastMessage.author?.name || 'Someone'}
                    </span>
                    : {channel.lastMessage.content}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create Channel Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Create a new channel to organize conversations and collaborate
              with your team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Channel Name */}
            <div className='space-y-2'>
              <Label htmlFor='channel-name' className='required'>
                Channel Name
              </Label>
              <Input
                id='channel-name'
                type='text'
                placeholder='e.g., marketing, engineering, general'
                value={formData.name}
                onChange={e =>
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                }
                disabled={isSubmitting}
                className={validationErrors.name ? 'border-red-500' : ''}
                maxLength={80}
                required
              />
              {validationErrors.name && (
                <p className='text-sm text-red-500'>{validationErrors.name}</p>
              )}
              <p className='text-xs text-muted-foreground'>
                {formData.name.length}/80 characters
              </p>
            </div>

            {/* Channel Type */}
            <div className='space-y-2'>
              <Label>Channel Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value: ChannelType) =>
                  setFormData(prev => ({ ...prev, type: value }))
                }
                disabled={isSubmitting}
              >
                <div className='flex items-start space-x-2'>
                  <RadioGroupItem value='PUBLIC' id='type-public' />
                  <div className='space-y-1'>
                    <Label
                      htmlFor='type-public'
                      className='font-normal cursor-pointer'
                    >
                      Public
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Anyone in the workspace can see and join this channel
                    </p>
                  </div>
                </div>
                <div className='flex items-start space-x-2'>
                  <RadioGroupItem value='PRIVATE' id='type-private' />
                  <div className='space-y-1'>
                    <Label
                      htmlFor='type-private'
                      className='font-normal cursor-pointer'
                    >
                      Private
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Only invited members can see and access this channel
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Channel Description */}
            <div className='space-y-2'>
              <Label htmlFor='channel-description'>
                Description (Optional)
              </Label>
              <Textarea
                id='channel-description'
                placeholder='What is this channel about?'
                value={formData.description}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={isSubmitting}
                className={validationErrors.description ? 'border-red-500' : ''}
                maxLength={500}
                rows={3}
              />
              {validationErrors.description && (
                <p className='text-sm text-red-500'>
                  {validationErrors.description}
                </p>
              )}
              <p className='text-xs text-muted-foreground'>
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* Error Message */}
            {formError && (
              <div className='rounded-md border border-red-200 bg-red-50 p-3'>
                <p className='text-sm text-red-600'>{formError}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleDialogClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Channel'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
