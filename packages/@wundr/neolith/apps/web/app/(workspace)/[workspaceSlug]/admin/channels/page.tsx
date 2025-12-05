'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useAdminChannels,
  useChannelDefaults,
  type ChannelInfo,
  type ChannelType,
  type BulkOperation,
} from '@/hooks/use-admin-channels';
import { cn } from '@/lib/utils';

type FilterType = 'all' | ChannelType;
type FilterArchived = 'all' | 'active' | 'archived';

/**
 * Admin Channels Management Page
 *
 * Comprehensive channel management with list, analytics, and bulk operations
 */
export default function AdminChannelsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Channels', 'Manage workspace channels and settings');
  }, [setPageHeader]);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterArchived, setFilterArchived] =
    useState<FilterArchived>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelInfo | null>(
    null
  );
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set()
  );
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<BulkOperation | null>(
    null
  );

  const {
    channels,
    total,
    isLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    bulkOperation: performBulkOperation,
  } = useAdminChannels(workspaceSlug, {
    type: filterType === 'all' ? undefined : filterType,
    archived:
      filterArchived === 'all' ? undefined : filterArchived === 'archived',
    search: searchQuery || undefined,
  });

  const { defaults, updateDefaults } = useChannelDefaults(workspaceSlug);

  // Filter channels client-side for search
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          channel.name.toLowerCase().includes(query) ||
          channel.description?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [channels, searchQuery]);

  const handleCreateChannel = useCallback(
    async (data: {
      name: string;
      description?: string;
      type?: ChannelType;
    }) => {
      await createChannel(data);
      setShowCreateModal(false);
    },
    [createChannel]
  );

  const handleUpdateChannel = useCallback(
    async (updates: Partial<ChannelInfo>) => {
      if (!editingChannel) {
        return;
      }
      await updateChannel(editingChannel.id, updates);
      setShowEditModal(false);
      setEditingChannel(null);
    },
    [editingChannel, updateChannel]
  );

  const handleDeleteChannel = useCallback(async () => {
    if (!channelToDelete) {
      return;
    }
    await deleteChannel(channelToDelete);
    setChannelToDelete(null);
  }, [channelToDelete, deleteChannel]);

  const handleBulkOperation = useCallback(
    async (operation: BulkOperation, data?: { type?: ChannelType }) => {
      if (selectedChannels.size === 0) {
        return;
      }
      await performBulkOperation(Array.from(selectedChannels), operation, data);
      setSelectedChannels(new Set());
      setShowBulkDialog(false);
      setBulkOperation(null);
    },
    [selectedChannels, performBulkOperation]
  );

  const toggleChannelSelection = useCallback((channelId: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedChannels.size === filteredChannels.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(filteredChannels.map(c => c.id)));
    }
  }, [selectedChannels, filteredChannels]);

  const typeOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'PUBLIC', label: 'Public' },
    { value: 'PRIVATE', label: 'Private' },
    { value: 'DM', label: 'Direct Messages' },
    { value: 'HUDDLE', label: 'Huddles' },
  ];

  const archivedOptions: { value: FilterArchived; label: string }[] = [
    { value: 'all', label: 'All Channels' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className='space-y-6'>
      {/* Header with channel count and actions */}
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {total} channel{total !== 1 ? 's' : ''} in this workspace
        </p>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setShowDefaultsModal(true)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-input px-4 py-2',
              'text-sm font-medium hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <SettingsIcon className='h-4 w-4' />
            Default Settings
          </button>
          <button
            type='button'
            onClick={() => setShowCreateModal(true)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2',
              'text-sm font-medium text-primary-foreground hover:bg-primary/90'
            )}
          >
            <PlusIcon className='h-4 w-4' />
            Create Channel
          </button>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          {/* Type Filter */}
          <div className='flex flex-wrap gap-2'>
            {typeOptions.map(option => (
              <button
                key={option.value}
                type='button'
                onClick={() => setFilterType(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  filterType === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Archived Filter */}
          <div className='flex flex-wrap gap-2'>
            {archivedOptions.map(option => (
              <button
                key={option.value}
                type='button'
                onClick={() => setFilterArchived(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  filterArchived === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className='relative'>
          <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            placeholder='Search channels...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-md border border-input bg-background py-2 pl-9 pr-4',
              'text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          />
        </div>

        {/* Bulk Actions */}
        {selectedChannels.size > 0 && (
          <div className='flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3'>
            <span className='text-sm font-medium'>
              {selectedChannels.size} selected
            </span>
            <div className='ml-auto flex gap-2'>
              <button
                type='button'
                onClick={() => {
                  setBulkOperation('archive');
                  setShowBulkDialog(true);
                }}
                className='rounded-md px-3 py-1.5 text-sm hover:bg-accent'
              >
                Archive
              </button>
              <button
                type='button'
                onClick={() => {
                  setBulkOperation('change_visibility');
                  setShowBulkDialog(true);
                }}
                className='rounded-md px-3 py-1.5 text-sm hover:bg-accent'
              >
                Change Visibility
              </button>
              <button
                type='button'
                onClick={() => {
                  setBulkOperation('delete');
                  setShowBulkDialog(true);
                }}
                className='rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Channels Table */}
      <div className='rounded-lg border bg-card'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left'>
                  <Checkbox
                    checked={selectedChannels.size === filteredChannels.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className='px-4 py-3 text-left text-sm font-medium text-muted-foreground'>
                  Channel
                </th>
                <th className='px-4 py-3 text-left text-sm font-medium text-muted-foreground'>
                  Type
                </th>
                <th className='px-4 py-3 text-left text-sm font-medium text-muted-foreground'>
                  Members
                </th>
                <th className='px-4 py-3 text-left text-sm font-medium text-muted-foreground'>
                  Activity (30d)
                </th>
                <th className='px-4 py-3 text-left text-sm font-medium text-muted-foreground'>
                  Created
                </th>
                <th className='px-4 py-3 text-right text-sm font-medium text-muted-foreground'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {isLoading ? (
                <ChannelRowSkeleton count={5} />
              ) : filteredChannels.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className='px-4 py-8 text-center text-muted-foreground'
                  >
                    No channels found
                  </td>
                </tr>
              ) : (
                filteredChannels.map(channel => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannels.has(channel.id)}
                    onSelect={() => toggleChannelSelection(channel.id)}
                    onEdit={() => {
                      setEditingChannel(channel);
                      setShowEditModal(true);
                    }}
                    onDelete={() => setChannelToDelete(channel.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Channel Modal */}
      <CreateChannelModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateChannel}
      />

      {/* Edit Channel Modal */}
      <EditChannelModal
        channel={editingChannel}
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingChannel(null);
        }}
        onUpdate={handleUpdateChannel}
      />

      {/* Default Settings Modal */}
      <DefaultSettingsModal
        open={showDefaultsModal}
        defaults={defaults}
        onClose={() => setShowDefaultsModal(false)}
        onUpdate={updateDefaults}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={channelToDelete !== null}
        onOpenChange={open => !open && setChannelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this channel? This will
              permanently delete all messages and files. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChannelToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              className='bg-red-600 hover:bg-red-700'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Operation Dialog */}
      <BulkOperationDialog
        open={showBulkDialog}
        operation={bulkOperation}
        count={selectedChannels.size}
        onClose={() => {
          setShowBulkDialog(false);
          setBulkOperation(null);
        }}
        onConfirm={handleBulkOperation}
      />
    </div>
  );
}

// =============================================================================
// Channel Row Component
// =============================================================================

interface ChannelRowProps {
  channel: ChannelInfo;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ChannelRow({
  channel,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: ChannelRowProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <tr
      className={cn(
        'hover:bg-muted/50',
        channel.isArchived && 'opacity-60',
        isSelected && 'bg-muted/30'
      )}
    >
      <td className='px-4 py-3'>
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </td>
      <td className='px-4 py-3'>
        <div>
          <div className='flex items-center gap-2'>
            <p className='font-medium text-foreground'>{channel.name}</p>
            {channel.isArchived && (
              <span className='rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'>
                Archived
              </span>
            )}
          </div>
          {channel.description && (
            <p className='text-sm text-muted-foreground line-clamp-1'>
              {channel.description}
            </p>
          )}
        </div>
      </td>
      <td className='px-4 py-3'>
        <ChannelTypeBadge type={channel.type} />
      </td>
      <td className='px-4 py-3 text-sm'>
        <div>
          <p className='font-medium'>{channel.memberCount}</p>
          <p className='text-xs text-muted-foreground'>
            {channel.activeMembers} active
          </p>
        </div>
      </td>
      <td className='px-4 py-3 text-sm'>
        <div>
          <p className='font-medium'>{channel.recentMessages} messages</p>
          <p className='text-xs text-muted-foreground'>
            {channel.totalMessages} total
          </p>
        </div>
      </td>
      <td className='px-4 py-3 text-sm text-muted-foreground'>
        {new Date(channel.createdAt).toLocaleDateString()}
      </td>
      <td className='px-4 py-3'>
        <div className='relative flex justify-end'>
          <button
            type='button'
            onClick={() => setShowMenu(!showMenu)}
            className='rounded-md p-1 hover:bg-muted'
          >
            <MoreIcon className='h-5 w-5 text-muted-foreground' />
          </button>

          {showMenu && (
            <>
              <div
                className='fixed inset-0 z-10'
                onClick={() => setShowMenu(false)}
              />
              <div className='absolute right-0 top-8 z-20 w-40 rounded-md border bg-card py-1 shadow-lg'>
                <button
                  type='button'
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className='flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted'
                >
                  <EditIcon className='h-4 w-4' />
                  Edit
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className='flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-muted'
                >
                  <TrashIcon className='h-4 w-4' />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ChannelRowSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td className='px-4 py-3'>
            <div className='h-4 w-4 animate-pulse rounded bg-muted' />
          </td>
          <td className='px-4 py-3'>
            <div className='space-y-2'>
              <div className='h-4 w-32 animate-pulse rounded bg-muted' />
              <div className='h-3 w-48 animate-pulse rounded bg-muted' />
            </div>
          </td>
          <td className='px-4 py-3'>
            <div className='h-5 w-16 animate-pulse rounded-full bg-muted' />
          </td>
          <td className='px-4 py-3'>
            <div className='h-4 w-12 animate-pulse rounded bg-muted' />
          </td>
          <td className='px-4 py-3'>
            <div className='h-4 w-20 animate-pulse rounded bg-muted' />
          </td>
          <td className='px-4 py-3'>
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
          </td>
          <td className='px-4 py-3'>
            <div className='h-8 w-8 animate-pulse rounded bg-muted' />
          </td>
        </tr>
      ))}
    </>
  );
}

// =============================================================================
// Channel Type Badge
// =============================================================================

function ChannelTypeBadge({ type }: { type: ChannelType }) {
  const config = {
    PUBLIC: {
      label: 'Public',
      className:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    PRIVATE: {
      label: 'Private',
      className:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    },
    DM: {
      label: 'DM',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    HUDDLE: {
      label: 'Huddle',
      className:
        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    },
  };

  const { label, className } = config[type];

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  );
}

// =============================================================================
// Create Channel Modal
// =============================================================================

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    type?: ChannelType;
  }) => Promise<void>;
}

function CreateChannelModal({
  open,
  onClose,
  onCreate,
}: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChannelType>('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({ name, description, type });
      setName('');
      setDescription('');
      setType('PUBLIC');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onClose}>
      <ResponsiveModalContent className='sm:max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Create Channel</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Create a new channel for your workspace
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <Label htmlFor='name'>Channel Name</Label>
            <Input
              id='name'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g., general, announcements'
              required
            />
          </div>

          <div>
            <Label htmlFor='description'>Description (optional)</Label>
            <Textarea
              id='description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='What is this channel about?'
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor='type'>Channel Type</Label>
            <Select value={type} onValueChange={v => setType(v as ChannelType)}>
              <SelectTrigger id='type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PUBLIC'>Public</SelectItem>
                <SelectItem value='PRIVATE'>Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ResponsiveModalFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

// =============================================================================
// Edit Channel Modal
// =============================================================================

interface EditChannelModalProps {
  channel: ChannelInfo | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<ChannelInfo>) => Promise<void>;
}

function EditChannelModal({
  channel,
  open,
  onClose,
  onUpdate,
}: EditChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<ChannelType>('PUBLIC');
  const [isArchived, setIsArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
      setTopic(channel.topic || '');
      setType(channel.type);
      setIsArchived(channel.isArchived);
    }
  }, [channel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({ name, description, topic, type, isArchived });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!channel) {
    return null;
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onClose}>
      <ResponsiveModalContent className='sm:max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit Channel</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update channel settings and visibility
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <Label htmlFor='edit-name'>Channel Name</Label>
            <Input
              id='edit-name'
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor='edit-description'>Description</Label>
            <Textarea
              id='edit-description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor='edit-topic'>Topic</Label>
            <Input
              id='edit-topic'
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder='Channel topic or purpose'
            />
          </div>

          <div>
            <Label htmlFor='edit-type'>Channel Type</Label>
            <Select value={type} onValueChange={v => setType(v as ChannelType)}>
              <SelectTrigger id='edit-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PUBLIC'>Public</SelectItem>
                <SelectItem value='PRIVATE'>Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox
              id='edit-archived'
              checked={isArchived}
              onCheckedChange={checked => setIsArchived(!!checked)}
            />
            <Label htmlFor='edit-archived' className='cursor-pointer'>
              Archive this channel
            </Label>
          </div>

          <ResponsiveModalFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

// =============================================================================
// Default Settings Modal
// =============================================================================

interface DefaultSettingsModalProps {
  open: boolean;
  defaults: {
    autoJoinPublic: boolean;
    defaultType: ChannelType;
    allowMemberCreation: boolean;
    requireApproval: boolean;
    maxChannelsPerUser: number;
    notificationDefaults: {
      muteByDefault: boolean;
      desktopNotifications: boolean;
      emailNotifications: boolean;
    };
  } | null;
  onClose: () => void;
  onUpdate: (
    updates: Partial<{
      autoJoinPublic: boolean;
      allowMemberCreation: boolean;
      requireApproval: boolean;
    }>
  ) => Promise<void>;
}

function DefaultSettingsModal({
  open,
  defaults,
  onClose,
  onUpdate,
}: DefaultSettingsModalProps) {
  const [autoJoinPublic, setAutoJoinPublic] = useState(true);
  const [allowMemberCreation, setAllowMemberCreation] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaults) {
      setAutoJoinPublic(defaults.autoJoinPublic);
      setAllowMemberCreation(defaults.allowMemberCreation);
      setRequireApproval(defaults.requireApproval);
    }
  }, [defaults]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({
        autoJoinPublic,
        allowMemberCreation,
        requireApproval,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onClose}>
      <ResponsiveModalContent className='sm:max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Default Channel Settings</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Configure default settings for new channels
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='flex items-center space-x-2'>
            <Checkbox
              id='autoJoin'
              checked={autoJoinPublic}
              onCheckedChange={checked => setAutoJoinPublic(!!checked)}
            />
            <Label htmlFor='autoJoin' className='cursor-pointer'>
              Auto-join public channels
            </Label>
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox
              id='allowCreation'
              checked={allowMemberCreation}
              onCheckedChange={checked => setAllowMemberCreation(!!checked)}
            />
            <Label htmlFor='allowCreation' className='cursor-pointer'>
              Allow members to create channels
            </Label>
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox
              id='requireApproval'
              checked={requireApproval}
              onCheckedChange={checked => setRequireApproval(!!checked)}
            />
            <Label htmlFor='requireApproval' className='cursor-pointer'>
              Require admin approval for new channels
            </Label>
          </div>

          <ResponsiveModalFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

// =============================================================================
// Bulk Operation Dialog
// =============================================================================

interface BulkOperationDialogProps {
  open: boolean;
  operation: BulkOperation | null;
  count: number;
  onClose: () => void;
  onConfirm: (op: BulkOperation, data?: { type?: ChannelType }) => void;
}

function BulkOperationDialog({
  open,
  operation,
  count,
  onClose,
  onConfirm,
}: BulkOperationDialogProps) {
  const [newType, setNewType] = useState<ChannelType>('PUBLIC');

  const handleConfirm = () => {
    if (!operation) {
      return;
    }
    if (operation === 'change_visibility') {
      onConfirm(operation, { type: newType });
    } else {
      onConfirm(operation);
    }
  };

  const getTitle = () => {
    switch (operation) {
      case 'archive':
        return 'Archive Channels';
      case 'unarchive':
        return 'Unarchive Channels';
      case 'delete':
        return 'Delete Channels';
      case 'change_visibility':
        return 'Change Visibility';
      default:
        return 'Confirm Action';
    }
  };

  const getDescription = () => {
    switch (operation) {
      case 'archive':
        return `Are you sure you want to archive ${count} channel${count !== 1 ? 's' : ''}? Archived channels can be restored later.`;
      case 'unarchive':
        return `Are you sure you want to unarchive ${count} channel${count !== 1 ? 's' : ''}?`;
      case 'delete':
        return `Are you sure you want to delete ${count} channel${count !== 1 ? 's' : ''}? This will permanently delete all messages and files. This action cannot be undone.`;
      case 'change_visibility':
        return `Change the visibility of ${count} channel${count !== 1 ? 's' : ''} to:`;
      default:
        return '';
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
        </AlertDialogHeader>

        {operation === 'change_visibility' && (
          <div className='py-4'>
            <Select
              value={newType}
              onValueChange={v => setNewType(v as ChannelType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PUBLIC'>Public</SelectItem>
                <SelectItem value='PRIVATE'>Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              operation === 'delete' && 'bg-red-600 hover:bg-red-700'
            )}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M5 12h14' />
      <path d='M12 5v14' />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='1' />
      <circle cx='12' cy='5' r='1' />
      <circle cx='12' cy='19' r='1' />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M3 6h18' />
      <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
      <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
    </svg>
  );
}
