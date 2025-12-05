'use client';

import { X, Search, Mail, UserPlus, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceUsers } from '@/hooks/use-channel';
import { getInitials } from '@/lib/utils';

import type { User } from '@/types/chat';

export interface DMAddPeopleModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback fired when adding members from workspace */
  onAddMembers: (userIds: string[]) => Promise<void>;
  /** Callback fired when inviting by email (optional) */
  onInviteByEmail?: (emails: string[]) => Promise<void>;
  /** The workspace ID for user search */
  workspaceId: string;
  /** IDs of existing members to exclude from search results */
  existingMemberIds: string[];
  /** Optional conversation name for display */
  conversationName?: string;
}

/**
 * DM Add People Modal
 *
 * Modal for adding people to a DM conversation with two methods:
 * 1. From Workspace: Search and select existing workspace members
 * 2. Invite by Email: Enter email addresses to invite new people
 *
 * Features:
 * - Responsive modal (Dialog on desktop, Drawer on mobile)
 * - Tabbed interface for different invitation methods
 * - Real-time search for workspace members
 * - Selected people shown as removable chips
 * - Email validation for email invites
 * - Proper loading and error states
 */
export function DMAddPeopleModal({
  isOpen,
  onClose,
  onAddMembers,
  onInviteByEmail,
  workspaceId,
  existingMemberIds,
  conversationName,
}: DMAddPeopleModalProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'email'>(
    'workspace'
  );
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const availableUsers = useMemo(() => {
    return users.filter(
      u =>
        !existingMemberIds.includes(u.id) &&
        !selectedUsers.some(s => s.id === u.id)
    );
  }, [users, existingMemberIds, selectedUsers]);

  const resetForm = useCallback(() => {
    setSelectedUsers([]);
    setEmailInput('');
    setEmailList([]);
    setSearchQuery('');
    setError(null);
    setActiveTab('workspace');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleAddUser = useCallback((user: User) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim();
    if (!email) {
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (emailList.includes(email)) {
      setError('This email has already been added');
      return;
    }

    setEmailList(prev => [...prev, email]);
    setEmailInput('');
    setError(null);
  }, [emailInput, emailList]);

  const handleRemoveEmail = useCallback((email: string) => {
    setEmailList(prev => prev.filter(e => e !== email));
  }, []);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail]
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setError(null);

    try {
      if (activeTab === 'workspace') {
        if (selectedUsers.length === 0) {
          setError('Please select at least one person to add');
          return;
        }

        setIsSubmitting(true);
        await onAddMembers(selectedUsers.map(u => u.id));
        handleClose();
      } else if (activeTab === 'email') {
        if (emailList.length === 0) {
          setError('Please add at least one email address');
          return;
        }

        if (!onInviteByEmail) {
          setError('Email invitations are not supported for this conversation');
          return;
        }

        setIsSubmitting(true);
        await onInviteByEmail(emailList);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add people');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeTab,
    selectedUsers,
    emailList,
    isSubmitting,
    onAddMembers,
    onInviteByEmail,
    handleClose,
  ]);

  const canSubmit = useMemo(() => {
    if (activeTab === 'workspace') {
      return selectedUsers.length > 0;
    } else {
      return emailList.length > 0 && !!onInviteByEmail;
    }
  }, [activeTab, selectedUsers.length, emailList.length, onInviteByEmail]);

  const submitButtonText = useMemo(() => {
    if (isSubmitting) {
      return 'Adding...';
    }

    if (activeTab === 'workspace') {
      const count = selectedUsers.length;
      return count === 0
        ? 'Add People'
        : `Add ${count} ${count === 1 ? 'Person' : 'People'}`;
    } else {
      const count = emailList.length;
      return count === 0
        ? 'Send Invites'
        : `Send ${count} ${count === 1 ? 'Invite' : 'Invites'}`;
    }
  }, [activeTab, isSubmitting, selectedUsers.length, emailList.length]);

  return (
    <ResponsiveModal open={isOpen} onOpenChange={handleClose}>
      <ResponsiveModalContent className='sm:max-w-lg'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            Add people{conversationName ? ` to ${conversationName}` : ''}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Add people from your workspace or invite new people by email
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className='px-6 py-4 space-y-4'>
          <Tabs
            value={activeTab}
            onValueChange={v => setActiveTab(v as 'workspace' | 'email')}
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='workspace'>
                <UserPlus className='h-4 w-4 mr-2' />
                From Workspace
              </TabsTrigger>
              <TabsTrigger value='email' disabled={!onInviteByEmail}>
                <Mail className='h-4 w-4 mr-2' />
                Invite by Email
              </TabsTrigger>
            </TabsList>

            {/* From Workspace Tab */}
            <TabsContent value='workspace' className='space-y-4'>
              {/* Search input */}
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  type='text'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder='Search by name or email...'
                  className='pl-9'
                  disabled={isSubmitting}
                  autoComplete='off'
                />
                {isSearchingUsers && (
                  <Loader2 className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground' />
                )}
              </div>

              {/* Selected users */}
              {selectedUsers.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  {selectedUsers.map(user => (
                    <Badge
                      key={user.id}
                      variant='secondary'
                      className='flex items-center gap-1.5 pl-1 pr-1.5 py-1'
                    >
                      <Avatar className='h-5 w-5'>
                        <AvatarImage
                          src={user.image || undefined}
                          alt={user.name}
                        />
                        <AvatarFallback className='text-[10px]'>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className='max-w-[120px] truncate'>
                        {user.name}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleRemoveUser(user.id)}
                        disabled={isSubmitting}
                        className='rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50'
                        aria-label={`Remove ${user.name}`}
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Search results */}
              {searchQuery && (
                <div className='max-h-64 overflow-y-auto rounded-md border bg-background'>
                  {availableUsers.length === 0 ? (
                    <p className='px-3 py-8 text-center text-sm text-muted-foreground'>
                      {isSearchingUsers ? 'Searching...' : 'No users found'}
                    </p>
                  ) : (
                    <div className='divide-y'>
                      {availableUsers.map(user => (
                        <button
                          key={user.id}
                          type='button'
                          onClick={() => handleAddUser(user)}
                          disabled={isSubmitting}
                          className='flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent disabled:opacity-50'
                        >
                          <Avatar className='h-9 w-9'>
                            <AvatarImage
                              src={user.image || undefined}
                              alt={user.name}
                            />
                            <AvatarFallback>
                              {getInitials(user.name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-foreground truncate'>
                              {user.name}
                            </p>
                            <p className='text-xs text-muted-foreground truncate'>
                              {user.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Invite by Email Tab */}
            <TabsContent value='email' className='space-y-4'>
              {/* Email input */}
              <div className='flex gap-2'>
                <div className='relative flex-1'>
                  <Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    type='email'
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    placeholder='Enter email address...'
                    className='pl-9'
                    disabled={isSubmitting}
                    autoComplete='off'
                  />
                </div>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleAddEmail}
                  disabled={!emailInput.trim() || isSubmitting}
                >
                  Add
                </Button>
              </div>

              <p className='text-xs text-muted-foreground'>
                Press Enter or click Add to add each email address
              </p>

              {/* Email list */}
              {emailList.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-sm font-medium'>
                    Email addresses to invite:
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {emailList.map(email => (
                      <Badge
                        key={email}
                        variant='secondary'
                        className='flex items-center gap-1.5 px-2.5 py-1'
                      >
                        <Mail className='h-3 w-3' />
                        <span className='max-w-[200px] truncate'>{email}</span>
                        <button
                          type='button'
                          onClick={() => handleRemoveEmail(email)}
                          disabled={isSubmitting}
                          className='rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50'
                          aria-label={`Remove ${email}`}
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!onInviteByEmail && (
                <div className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                  Email invitations are not supported for this conversation
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Error message */}
          {error && (
            <div className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {error}
            </div>
          )}
        </div>

        <ResponsiveModalFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
            {submitButtonText}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
