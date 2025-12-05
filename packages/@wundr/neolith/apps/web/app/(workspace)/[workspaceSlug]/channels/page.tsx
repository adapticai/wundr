'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Hash,
  Lock,
  Plus,
  Users,
  MessageSquare,
  Clock,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePageHeader } from '@/contexts/page-header-context';
import { useChannels } from '@/hooks/use-channel';
import { useDebouncedValue } from '@/hooks/use-performance';
import { useToast } from '@/hooks/use-toast';

import type { Channel } from '@/types/channel';

type ChannelType = 'PUBLIC' | 'PRIVATE';
type ChannelFilter = 'all' | 'public' | 'private';

type SortOption =
  | 'recent-activity'
  | 'alphabetical-asc'
  | 'alphabetical-desc'
  | 'member-count'
  | 'created-date';

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
  const { toast } = useToast();

  // Set page header
  useEffect(() => {
    setPageHeader('Channels', 'Communicate with your team');
  }, [setPageHeader]);

  // Fetch channels using the hook
  const { channels, isLoading, error, refetch } = useChannels(workspaceSlug);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

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

  // Real-time updates via polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousChannelIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const [animatingChannels, setAnimatingChannels] = useState<Set<string>>(
    new Set(),
  );

  // Sort state with localStorage persistence
  const [sortOption, setSortOption] = useState<SortOption>('recent-activity');

  // Load sort preference from localStorage on mount
  useEffect(() => {
    const savedSort = localStorage.getItem('channels-sort-preference');
    if (
      savedSort &&
      [
        'recent-activity',
        'alphabetical-asc',
        'alphabetical-desc',
        'member-count',
        'created-date',
      ].includes(savedSort)
    ) {
      setSortOption(savedSort as SortOption);
    }
  }, []);

  // Save sort preference to localStorage when it changes
  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    localStorage.setItem('channels-sort-preference', value);
  };

  // Track channel IDs for change detection
  useEffect(() => {
    const currentChannelIds = new Set(channels.map(c => c.id));

    // Detect new channels (created by other users)
    if (previousChannelIdsRef.current.size > 0) {
      const newChannels = channels.filter(
        c => !previousChannelIdsRef.current.has(c.id),
      );

      if (newChannels.length > 0) {
        // Add to animating set
        setAnimatingChannels(prev => {
          const next = new Set(prev);
          newChannels.forEach(c => next.add(c.id));
          return next;
        });

        // Show toast for new channels
        newChannels.forEach(channel => {
          toast({
            title: 'New Channel Created',
            description: `${channel.name} was created by another user`,
            duration: 5000,
          });
        });

        // Remove from animating set after animation completes
        setTimeout(() => {
          setAnimatingChannels(prev => {
            const next = new Set(prev);
            newChannels.forEach(c => next.delete(c.id));
            return next;
          });
        }, 1000);
      }

      // Detect deleted channels
      const deletedChannelIds = Array.from(
        previousChannelIdsRef.current,
      ).filter(id => !currentChannelIds.has(id));

      if (deletedChannelIds.length > 0) {
        toast({
          title: 'Channel Deleted',
          description: `${deletedChannelIds.length} channel(s) removed`,
          duration: 3000,
        });
      }
    }

    previousChannelIdsRef.current = currentChannelIds;
  }, [channels, toast]);

  // Setup polling for real-time updates
  const pollForUpdates = useCallback(async () => {
    if (!mountedRef.current || isLoading) {
      return;
    }

    try {
      await refetch();
    } catch (error) {
      console.error('[ChannelsPage] Polling error:', error);
    }
  }, [refetch, isLoading]);

  useEffect(() => {
    // Start polling every 30 seconds
    pollingIntervalRef.current = setInterval(() => {
      pollForUpdates();
    }, 30000);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollForUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        },
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
        error instanceof Error ? error.message : 'Failed to create channel',
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

  // Filter, search, and sort channels
  const filteredAndSortedChannels = useMemo(() => {
    let result = [...channels];

    // Apply channel type filter
    if (channelFilter === 'public') {
      result = result.filter(c => c.type !== 'private');
    } else if (channelFilter === 'private') {
      result = result.filter(c => c.type === 'private');
    }

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          (c.description && c.description.toLowerCase().includes(query)),
      );
    }

    // Apply sorting
    switch (sortOption) {
      case 'recent-activity':
        return result.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt
            ? new Date(a.lastMessage.createdAt).getTime()
            : 0;
          const bTime = b.lastMessage?.createdAt
            ? new Date(b.lastMessage.createdAt).getTime()
            : 0;
          return bTime - aTime; // Most recent first
        });

      case 'alphabetical-asc':
        return result.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        );

      case 'alphabetical-desc':
        return result.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }),
        );

      case 'member-count':
        return result.sort((a, b) => {
          const aCount = a.memberCount || 0;
          const bCount = b.memberCount || 0;
          return bCount - aCount; // Most members first
        });

      case 'created-date':
        return result.sort((a, b) => {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          return bDate - aDate; // Newest first
        });

      default:
        return result;
    }
  }, [channels, channelFilter, debouncedSearchQuery, sortOption]);

  return (
    <div className='space-y-6'>
      {/* Search and Action Bar */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        {/* Search Input */}
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='text'
            placeholder='Search channels...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9'
          />
        </div>

        {/* Sort and Create Button */}
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-2'>
            <ArrowUpDown className='h-4 w-4 text-muted-foreground' />
            <Select value={sortOption} onValueChange={handleSortChange}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Sort channels' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='recent-activity'>Recent Activity</SelectItem>
                <SelectItem value='alphabetical-asc'>
                  Alphabetical (A-Z)
                </SelectItem>
                <SelectItem value='alphabetical-desc'>
                  Alphabetical (Z-A)
                </SelectItem>
                <SelectItem value='member-count'>Member Count</SelectItem>
                <SelectItem value='created-date'>Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setIsCreateDialogOpen(true)} className='gap-2'>
            <Plus className='h-4 w-4' />
            Create Channel
          </Button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className='flex flex-wrap gap-2'>
        <Badge
          variant={channelFilter === 'all' ? 'default' : 'outline'}
          className='cursor-pointer transition-colors'
          onClick={() => setChannelFilter('all')}
        >
          All Channels ({channels.length})
        </Badge>
        <Badge
          variant={channelFilter === 'public' ? 'default' : 'outline'}
          className='cursor-pointer transition-colors'
          onClick={() => setChannelFilter('public')}
        >
          <Hash className='h-3 w-3 mr-1' />
          Public ({channels.filter(c => c.type !== 'private').length})
        </Badge>
        <Badge
          variant={channelFilter === 'private' ? 'default' : 'outline'}
          className='cursor-pointer transition-colors'
          onClick={() => setChannelFilter('private')}
        >
          <Lock className='h-3 w-3 mr-1' />
          Private ({channels.filter(c => c.type === 'private').length})
        </Badge>
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

      {/* Empty State - No Channels */}
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

      {/* Empty State - No Search Results */}
      {!isLoading &&
        !error &&
        channels.length > 0 &&
        filteredAndSortedChannels.length === 0 && (
          <EmptyState
            icon={Search}
            title='No Channels Found'
            description={
              debouncedSearchQuery
                ? `No channels matching "${debouncedSearchQuery}"`
                : `No ${channelFilter} channels found`
            }
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setChannelFilter('all');
              },
            }}
          />
        )}

      {/* Channel Grid */}
      {!isLoading && !error && filteredAndSortedChannels.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredAndSortedChannels.map((channel: Channel) => {
            const isAnimating = animatingChannels.has(channel.id);
            return (
              <button
                key={channel.id}
                type='button'
                onClick={() =>
                  router.push(`/${workspaceSlug}/channels/${channel.id}`)
                }
                className={`rounded-lg border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isAnimating
                    ? 'animate-in fade-in slide-in-from-top-4 duration-500'
                    : ''
                }`}
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
                          },
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
            );
          })}
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
