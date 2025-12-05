'use client';

import { useState, useCallback, useEffect } from 'react';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn, getInitials } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Props for the CreateChannelDialog component
 */
interface CreateChannelDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback fired when creating a channel */
  onCreate: (input: {
    name: string;
    type: 'public' | 'private';
    description?: string;
    memberIds?: string[];
  }) => Promise<void>;
  /** The workspace ID for the new channel */
  workspaceId: string;
  /** External loading state */
  isLoading?: boolean;
}

export function CreateChannelDialog({
  isOpen,
  onClose,
  onCreate,
  workspaceId,
  isLoading = false,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [emailInvites, setEmailInvites] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    users,
    searchUsers,
    isLoading: isSearchingUsers,
  } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (memberSearch.trim()) {
      searchUsers(memberSearch);
    }
  }, [memberSearch, searchUsers]);

  const resetForm = useCallback(() => {
    setName('');
    setType('public');
    setDescription('');
    setSelectedMembers([]);
    setMemberSearch('');
    setEmailInvites([]);
    setEmailInput('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
        description: description.trim() || undefined,
        memberIds: type === 'private' ? selectedMembers.map(m => m.id) : [],
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create channel:', error);
      // Error handling is done by parent component
    } finally {
      setIsSubmitting(false);
    }
  }, [
    name,
    type,
    description,
    selectedMembers,
    isSubmitting,
    onCreate,
    resetForm,
    onClose,
  ]);

  const handleAddMember = useCallback((user: User) => {
    setSelectedMembers(prev => {
      if (prev.some(m => m.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
    setMemberSearch('');
  }, []);

  const handleRemoveMember = useCallback((userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== userId));
  }, []);

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim().toLowerCase();
    if (email && isValidEmail(email) && !emailInvites.includes(email)) {
      setEmailInvites(prev => [...prev, email]);
      setEmailInput('');
    }
  }, [emailInput, emailInvites]);

  const handleRemoveEmail = useCallback((email: string) => {
    setEmailInvites(prev => prev.filter(e => e !== email));
  }, []);

  const handleEmailKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail],
  );

  // Format channel name as user types
  const displayName = name.trim().toLowerCase().replace(/\s+/g, '-');

  // Validation
  const nameError =
    name.length > 0 && name.trim().length === 0
      ? 'Channel name cannot be empty'
      : name.length > 80
        ? 'Channel name must be less than 80 characters'
        : null;
  const isValid =
    name.trim().length > 0 &&
    !nameError &&
    (type === 'public' || selectedMembers.length > 0);

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={open => !open && handleClose()}
    >
      <ResponsiveModalContent className='max-w-lg'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Create a channel</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Channels are where your team communicates. They&apos;re best when
            organized around a topic.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className='max-h-[60vh] overflow-y-auto px-6 py-4 md:px-0 md:py-0'>
          {/* Name input */}
          <div className='mb-4'>
            <label
              htmlFor='channel-name'
              className='mb-1 block text-sm font-medium text-foreground'
            >
              Name
            </label>
            <div className='relative'>
              <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>
                #
              </span>
              <input
                id='channel-name'
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g. marketing'
                className='w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={isLoading || isSubmitting}
                maxLength={80}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'name-error' : undefined}
              />
            </div>
            {nameError && (
              <p
                id='name-error'
                className='mt-1 text-xs text-destructive'
                role='alert'
              >
                {nameError}
              </p>
            )}
            {name && !nameError && (
              <p className='mt-1 text-xs text-muted-foreground'>
                Channel will be created as:{' '}
                <span className='font-medium text-foreground'>
                  #{displayName}
                </span>
              </p>
            )}
          </div>

          {/* Type selector */}
          <div className='mb-4'>
            <label className='mb-2 block text-sm font-medium text-foreground'>
              Visibility
            </label>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setType('public')}
                disabled={isLoading || isSubmitting}
                className={cn(
                  'flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  type === 'public'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                    type === 'public'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground',
                  )}
                >
                  {type === 'public' && (
                    <span className='h-2 w-2 rounded-full bg-primary-foreground' />
                  )}
                </div>
                <div>
                  <div className='flex items-center gap-2'>
                    <HashIcon className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Public</span>
                  </div>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Anyone in the workspace can view and join
                  </p>
                </div>
              </button>

              <button
                type='button'
                onClick={() => setType('private')}
                disabled={isLoading || isSubmitting}
                className={cn(
                  'flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  type === 'private'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                    type === 'private'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground',
                  )}
                >
                  {type === 'private' && (
                    <span className='h-2 w-2 rounded-full bg-primary-foreground' />
                  )}
                </div>
                <div>
                  <div className='flex items-center gap-2'>
                    <LockIcon className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Private</span>
                  </div>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Only specific people can view and join
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className='mb-4'>
            <label
              htmlFor='channel-description'
              className='mb-1 block text-sm font-medium text-foreground'
            >
              Description{' '}
              <span className='font-normal text-muted-foreground'>
                (optional)
              </span>
            </label>
            <textarea
              id='channel-description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={2}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              disabled={isLoading || isSubmitting}
              maxLength={250}
            />
          </div>

          {/* Add members */}
          <div>
            <label className='mb-1 block text-sm font-medium text-foreground'>
              Add members{' '}
              {type === 'private' ? (
                <span className='font-normal text-destructive'>
                  (required for private channels)
                </span>
              ) : (
                <span className='font-normal text-muted-foreground'>
                  (optional)
                </span>
              )}
            </label>

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className='mb-2 flex flex-wrap gap-2'>
                {selectedMembers.map(member => (
                  <span
                    key={member.id}
                    className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-sm text-secondary-foreground'
                  >
                    {member.name}
                    <button
                      type='button'
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isLoading || isSubmitting}
                      className='ml-0.5 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                      aria-label={`Remove ${member.name}`}
                    >
                      <XIcon className='h-3 w-3' />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className='relative'>
              <input
                type='text'
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder='Search by name...'
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={isLoading || isSubmitting}
              />
              {isSearchingUsers && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                  <LoadingSpinner className='h-4 w-4' />
                </div>
              )}
            </div>

            {/* Search results */}
            {memberSearch && users.length > 0 && (
              <div className='mt-2 max-h-40 overflow-y-auto rounded-md border bg-background'>
                {users
                  .filter(u => !selectedMembers.some(m => m.id === u.id))
                  .map(user => (
                    <button
                      key={user.id}
                      type='button'
                      onClick={() => handleAddMember(user)}
                      className='flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent'
                    >
                      <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-medium'>
                        {/* eslint-disable-next-line @next/next/no-img-element */}

                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name}
                            className='h-full w-full rounded-lg object-cover'
                          />
                        ) : (
                          getInitials(user.name)
                        )}
                      </div>
                      <div>
                        <p className='text-sm font-medium text-foreground'>
                          {user.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {user.email}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {memberSearch && users.length === 0 && !isSearchingUsers && (
              <p className='mt-2 text-sm text-muted-foreground'>
                No users found
              </p>
            )}

            {/* Validation message for private channels */}
            {type === 'private' && selectedMembers.length === 0 && (
              <p className='mt-2 text-xs text-destructive'>
                Private channels require at least one member
              </p>
            )}
          </div>

          {/* Invite by email */}
          <div className='mt-6 border-t pt-4'>
            <label className='mb-1 block text-sm font-medium text-foreground'>
              Invite by email{' '}
              <span className='font-normal text-muted-foreground'>
                (optional)
              </span>
            </label>
            <p className='mb-2 text-xs text-muted-foreground'>
              Invite people who aren&apos;t in the workspace yet. They&apos;ll
              be invited to both the workspace and this channel.
            </p>

            {/* Email invites */}
            {emailInvites.length > 0 && (
              <div className='mb-2 flex flex-wrap gap-2'>
                {emailInvites.map(email => (
                  <span
                    key={email}
                    className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-sm text-secondary-foreground'
                  >
                    {email}
                    <button
                      type='button'
                      onClick={() => handleRemoveEmail(email)}
                      disabled={isLoading || isSubmitting}
                      className='ml-0.5 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                      aria-label={`Remove ${email}`}
                    >
                      <XIcon className='h-3 w-3' />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Email input */}
            <div className='flex gap-2'>
              <input
                type='email'
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyPress={handleEmailKeyPress}
                placeholder='email@example.com'
                className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={isLoading || isSubmitting}
              />
              <button
                type='button'
                onClick={handleAddEmail}
                disabled={
                  !emailInput.trim() ||
                  !isValidEmail(emailInput.trim()) ||
                  isLoading ||
                  isSubmitting
                }
                className='rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <ResponsiveModalFooter className='flex-col gap-2 sm:flex-row'>
          <button
            type='button'
            onClick={handleClose}
            disabled={isLoading || isSubmitting}
            className='w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:w-auto'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={!isValid || isLoading || isSubmitting}
            className='w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto'
          >
            {isSubmitting ? 'Creating...' : 'Create Channel'}
          </button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M4 9h16' />
      <path d='M4 15h16' />
      <path d='M10 3 8 21' />
      <path d='M16 3 14 21' />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
      <path d='M7 11V7a5 5 0 0 1 10 0v4' />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
    </svg>
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
