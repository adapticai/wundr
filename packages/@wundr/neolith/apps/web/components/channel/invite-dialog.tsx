'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspaceUsers } from '@/hooks/use-channel';
import { cn, getInitials } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Props for the InviteDialog component
 */
interface InviteDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback fired when inviting users with a specific role */
  onInvite: (userIds: string[], role: 'admin' | 'member') => Promise<void>;
  /** Callback fired when inviting by email with a specific role */
  onInviteByEmail?: (
    emails: string[],
    role: 'admin' | 'member'
  ) => Promise<void>;
  /** The workspace ID for user search */
  workspaceId: string;
  /** The channel ID for email invites */
  channelId?: string;
  /** The channel name for display */
  channelName: string;
  /** IDs of existing members to exclude from search results */
  existingMemberIds: string[];
  /** External loading state */
  isLoading?: boolean;
}

export function InviteDialog({
  isOpen,
  onClose,
  onInvite,
  onInviteByEmail,
  workspaceId,
  channelId: _channelId,
  channelName,
  existingMemberIds,
  isLoading = false,
}: InviteDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteMode, setInviteMode] = useState<'users' | 'email'>('users');
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);

  const {
    users,
    searchUsers,
    isLoading: isSearchingUsers,
  } = useWorkspaceUsers(workspaceId);

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }, [searchQuery, searchUsers]);

  // Filter out existing members and already selected users
  const availableUsers = users.filter(
    u =>
      !existingMemberIds.includes(u.id) &&
      !selectedUsers.some(s => s.id === u.id),
  );

  const resetForm = useCallback(() => {
    setSelectedUsers([]);
    setRole('member');
    setSearchQuery('');
    setInviteMode('users');
    setEmailInput('');
    setEmailList([]);
    setEmailError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (inviteMode === 'users' && selectedUsers.length === 0) {
      return;
    }

    if (inviteMode === 'email' && emailList.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (inviteMode === 'users') {
        await onInvite(
          selectedUsers.map(u => u.id),
          role,
        );

        // Show success toast for user invites
        if (selectedUsers.length === 1) {
          toast.success(`Invitation sent to ${selectedUsers[0].name}`);
        } else {
          toast.success(
            `${selectedUsers.length} invitations sent successfully`,
          );
        }
      } else if (inviteMode === 'email' && onInviteByEmail) {
        await onInviteByEmail(emailList, role);

        // Show success toast for email invites
        if (emailList.length === 1) {
          toast.success(`Invitation sent to ${emailList[0]}`);
        } else {
          toast.success(`${emailList.length} invitations sent successfully`);
        }
      }
      handleClose();
    } catch (err) {
      // Show error toast
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send invitation';
      toast.error(errorMessage);
      console.error('Failed to send invite:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    inviteMode,
    selectedUsers,
    emailList,
    role,
    isSubmitting,
    onInvite,
    onInviteByEmail,
    handleClose,
  ]);

  const handleAddUser = useCallback((user: User) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = useCallback(() => {
    const trimmedEmail = emailInput.trim();

    if (!trimmedEmail) {
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (emailList.includes(trimmedEmail)) {
      setEmailError('This email has already been added');
      return;
    }

    setEmailList(prev => [...prev, trimmedEmail]);
    setEmailInput('');
    setEmailError(null);
  }, [emailInput, emailList]);

  const handleRemoveEmail = useCallback((email: string) => {
    setEmailList(prev => prev.filter(e => e !== email));
  }, []);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail],
  );

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={open => !open && handleClose()}
    >
      <ResponsiveModalContent className='sm:max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            Invite people to #{channelName}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className='space-y-4 px-6 py-4'>
          {/* Mode toggle */}
          {onInviteByEmail && (
            <div className='flex gap-2 rounded-md border border-input bg-muted/30 p-1'>
              <button
                type='button'
                onClick={() => setInviteMode('users')}
                className={cn(
                  'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  inviteMode === 'users'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Workspace Members
              </button>
              <button
                type='button'
                onClick={() => setInviteMode('email')}
                className={cn(
                  'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  inviteMode === 'email'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Invite by Email
              </button>
            </div>
          )}

          {/* Search input for users */}
          {inviteMode === 'users' && (
            <div className='relative'>
              <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <input
                type='text'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search by name or email...'
                className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                disabled={isLoading || isSubmitting}
                aria-label='Search users to invite'
                autoComplete='off'
              />
              {isSearchingUsers && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                  <LoadingSpinner className='h-4 w-4' />
                </div>
              )}
            </div>
          )}

          {/* Email input for email invites */}
          {inviteMode === 'email' && (
            <div className='space-y-2'>
              <div className='relative'>
                <MailIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <input
                  type='email'
                  value={emailInput}
                  onChange={e => {
                    setEmailInput(e.target.value);
                    setEmailError(null);
                  }}
                  onKeyDown={handleEmailKeyDown}
                  placeholder='Enter email address...'
                  className={cn(
                    'w-full rounded-md border bg-background py-2 pl-9 pr-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1',
                    emailError
                      ? 'border-destructive focus:border-destructive focus:ring-destructive'
                      : 'border-input focus:border-primary focus:ring-primary',
                  )}
                  disabled={isLoading || isSubmitting}
                  aria-label='Enter email address'
                  autoComplete='off'
                />
                <Button
                  type='button'
                  size='sm'
                  onClick={handleAddEmail}
                  disabled={!emailInput.trim() || isLoading || isSubmitting}
                  className='absolute right-2 top-1/2 h-7 -translate-y-1/2'
                >
                  Add
                </Button>
              </div>
              {emailError && (
                <p className='text-xs text-destructive'>{emailError}</p>
              )}
            </div>
          )}

          {/* Selected users */}
          {inviteMode === 'users' && selectedUsers.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-2'>
              {selectedUsers.map(user => (
                <span
                  key={user.id}
                  className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-sm text-primary'
                >
                  <span className='flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'>
                    {getInitials(user.name)}
                  </span>
                  {user.name}
                  <button
                    type='button'
                    onClick={() => handleRemoveUser(user.id)}
                    disabled={isLoading || isSubmitting}
                    className='ml-0.5 rounded-full p-0.5 hover:bg-primary/20'
                    aria-label={`Remove ${user.name}`}
                  >
                    <XIcon className='h-3 w-3' />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Selected emails */}
          {inviteMode === 'email' && emailList.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-2'>
              {emailList.map(email => (
                <span
                  key={email}
                  className='inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary'
                >
                  <MailIcon className='h-3 w-3' />
                  {email}
                  <button
                    type='button'
                    onClick={() => handleRemoveEmail(email)}
                    disabled={isLoading || isSubmitting}
                    className='ml-0.5 rounded-full p-0.5 hover:bg-primary/20'
                    aria-label={`Remove ${email}`}
                  >
                    <XIcon className='h-3 w-3' />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search results */}
          {inviteMode === 'users' && searchQuery && (
            <div className='mt-3 max-h-48 overflow-y-auto rounded-md border bg-background'>
              {availableUsers.length === 0 ? (
                <p className='px-3 py-4 text-center text-sm text-muted-foreground'>
                  {isSearchingUsers ? 'Searching...' : 'No users found'}
                </p>
              ) : (
                availableUsers.map(user => (
                  <button
                    key={user.id}
                    type='button'
                    onClick={() => handleAddUser(user)}
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
                        getInitials(user.name || user.email)
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
                ))
              )}
            </div>
          )}

          {/* Role selection */}
          {(selectedUsers.length > 0 || emailList.length > 0) && (
            <div className='space-y-2'>
              <label
                htmlFor='role-select'
                className='text-sm font-medium text-foreground'
              >
                Invite as
              </label>
              <Select
                value={role}
                onValueChange={(value: 'admin' | 'member') => setRole(value)}
                disabled={isLoading || isSubmitting}
              >
                <SelectTrigger
                  id='role-select'
                  className='w-full'
                  aria-label='Select role'
                >
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='member'>
                    <div className='flex items-center gap-2'>
                      <MemberIcon className='h-4 w-4' />
                      <span>Member</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='admin'>
                    <div className='flex items-center gap-2'>
                      <ShieldIcon className='h-4 w-4' />
                      <span>Admin</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <ResponsiveModalFooter className='flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'>
          <Button
            type='button'
            variant='outline'
            onClick={handleClose}
            disabled={isLoading || isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={
              (inviteMode === 'users' && selectedUsers.length === 0) ||
              (inviteMode === 'email' && emailList.length === 0) ||
              isLoading ||
              isSubmitting
            }
          >
            {isSubmitting
              ? 'Sending...'
              : inviteMode === 'users'
                ? `Send Invite${selectedUsers.length > 1 ? 's' : ''}`
                : `Send Invite${emailList.length > 1 ? 's' : ''}`}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function MemberIcon({ className }: { className?: string }) {
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
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
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
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' />
      <path d='m9 12 2 2 4-4' />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
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
      <rect width='20' height='16' x='2' y='4' rx='2' />
      <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
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
