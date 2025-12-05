'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn, getInitials } from '@/lib/utils';

import type { User } from '@/types/chat';

/**
 * Role configuration for invitations
 */
export interface InviteRole {
  id: string;
  name: string;
  description?: string;
}

/**
 * Context types for invitations
 */
export type InviteContext = 'workspace' | 'channel' | 'dm';

/**
 * Props for the InviteMembersModal component
 */
export interface InviteMembersModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onOpenChange: (open: boolean) => void;
  /** Callback fired when inviting existing workspace members */
  onInviteMembers?: (userIds: string[], role: string) => Promise<void>;
  /** Callback fired when inviting by email */
  onInviteByEmail?: (
    emails: string[],
    role: string,
    message?: string
  ) => Promise<void>;
  /** The context of the invitation (workspace, channel, or dm) */
  context: InviteContext;
  /** The workspace ID for user search */
  workspaceId: string;
  /** Name of the context (workspace name, channel name, etc.) */
  contextName: string;
  /** Available roles for the invitation */
  availableRoles: InviteRole[];
  /** IDs of existing members to exclude from search results */
  existingMemberIds?: string[];
  /** External loading state */
  isLoading?: boolean;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
}

/**
 * Validates a single email address
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parses multiple emails from text (comma or newline separated)
 */
function parseEmails(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(Boolean);
}

/**
 * InviteMembersModal - A comprehensive reusable modal for inviting members
 *
 * Features:
 * - Responsive (Dialog on desktop, Drawer on mobile/tablet)
 * - Two modes: "From Workspace" and "Invite by Email"
 * - Role selection with descriptions
 * - Email validation (single and bulk)
 * - Custom message field
 * - Multi-context support (workspace, channel, DM)
 * - Loading and error states
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <InviteMembersModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   context="channel"
 *   workspaceId="workspace-123"
 *   contextName="general"
 *   availableRoles={[
 *     { id: 'admin', name: 'Admin', description: 'Full access' },
 *     { id: 'member', name: 'Member', description: 'Standard access' },
 *   ]}
 *   onInviteMembers={handleInviteMembers}
 *   onInviteByEmail={handleInviteByEmail}
 * />
 * ```
 */
export function InviteMembersModal({
  open,
  onOpenChange,
  onInviteMembers,
  onInviteByEmail,
  context,
  workspaceId,
  contextName,
  availableRoles,
  existingMemberIds = [],
  isLoading = false,
  title,
  description,
}: InviteMembersModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'workspace' | 'email'>(
    'workspace',
  );

  // Workspace members state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Email invites state
  const [emailInput, setEmailInput] = useState('');
  const [bulkEmailInput, setBulkEmailInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  // Common state
  const [selectedRole, setSelectedRole] = useState(availableRoles[0]?.id || '');
  const [customMessage, setCustomMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedUsers([]);
      setEmailInput('');
      setBulkEmailInput('');
      setIsBulkMode(false);
      setEmailErrors([]);
      setCustomMessage('');
      setError(null);
      setActiveTab('workspace');
      setSelectedRole(availableRoles[0]?.id || '');
    }
  }, [open, availableRoles]);

  // Fetch workspace users
  const fetchWorkspaceUsers = useCallback(
    async (query?: string) => {
      setIsSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) {
          params.append('q', query);
        }

        const response = await fetch(
          `/api/workspaces/${workspaceId}/users?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch workspace users');
        }

        const data = await response.json();
        setWorkspaceUsers(data.users || []);
      } catch (err) {
        console.error('Failed to fetch workspace users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceId],
  );

  // Search users when query changes
  useEffect(() => {
    if (activeTab === 'workspace' && open) {
      const timer = setTimeout(() => {
        fetchWorkspaceUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab, open, fetchWorkspaceUsers]);

  // Filter available users (exclude existing members and selected users)
  const availableUsers = workspaceUsers.filter(
    u =>
      !existingMemberIds.includes(u.id) &&
      !selectedUsers.some(s => s.id === u.id),
  );

  // Handle adding a user to selection
  const handleAddUser = useCallback((user: User) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
  }, []);

  // Handle removing a user from selection
  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  // Validate emails
  const validateEmails = useCallback((emails: string[]): boolean => {
    const errors: string[] = [];

    emails.forEach(email => {
      if (!isValidEmail(email)) {
        errors.push(email);
      }
    });

    setEmailErrors(errors);
    return errors.length === 0;
  }, []);

  // Handle invite from workspace
  const handleInviteFromWorkspace = useCallback(async () => {
    if (selectedUsers.length === 0 || isSubmitting || !onInviteMembers) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onInviteMembers(
        selectedUsers.map(u => u.id),
        selectedRole,
      );
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to invite members:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedUsers,
    selectedRole,
    isSubmitting,
    onInviteMembers,
    onOpenChange,
  ]);

  // Handle invite by email
  const handleInviteByEmail = useCallback(async () => {
    if (isSubmitting || !onInviteByEmail) {
      return;
    }

    const emails = isBulkMode
      ? parseEmails(bulkEmailInput)
      : [emailInput.trim()];

    if (emails.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    if (!validateEmails(emails)) {
      setError('Please fix invalid email addresses');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onInviteByEmail(emails, selectedRole, customMessage || undefined);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to send email invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isBulkMode,
    bulkEmailInput,
    emailInput,
    selectedRole,
    customMessage,
    isSubmitting,
    onInviteByEmail,
    onOpenChange,
    validateEmails,
  ]);

  // Determine context-specific text
  const getContextText = () => {
    switch (context) {
      case 'workspace':
        return {
          title: title || `Invite people to ${contextName}`,
          description: description || 'Add new members to your workspace',
          workspaceTabLabel: 'From Organization',
          submitLabel: 'Add to Workspace',
        };
      case 'channel':
        return {
          title: title || `Invite people to #${contextName}`,
          description: description || 'Add members to this channel',
          workspaceTabLabel: 'From Workspace',
          submitLabel: 'Add to Channel',
        };
      case 'dm':
        return {
          title: title || 'Add people to conversation',
          description: description || 'Invite more people to this conversation',
          workspaceTabLabel: 'From Workspace',
          submitLabel: 'Add to Conversation',
        };
      default:
        return {
          title: title || 'Invite Members',
          description: description || 'Add new members',
          workspaceTabLabel: 'From Workspace',
          submitLabel: 'Send Invite',
        };
    }
  };

  const contextText = getContextText();
  const selectedRoleObj = availableRoles.find(r => r.id === selectedRole);

  // Determine if submit should be enabled
  const canSubmit =
    !isSubmitting &&
    !isLoading &&
    (activeTab === 'workspace'
      ? selectedUsers.length > 0
      : isBulkMode
        ? bulkEmailInput.trim().length > 0
        : emailInput.trim().length > 0);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className='max-w-2xl'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{contextText.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {contextText.description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {/* Main Content */}
        <div className='space-y-4 px-6 pb-4'>
          {/* Error Display */}
          {error && (
            <div className='rounded-md bg-destructive/10 border border-destructive/20 p-3'>
              <p className='text-sm text-destructive'>{error}</p>
            </div>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={v => setActiveTab(v as 'workspace' | 'email')}
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger
                value='workspace'
                disabled={isLoading || isSubmitting}
              >
                {contextText.workspaceTabLabel}
              </TabsTrigger>
              <TabsTrigger value='email' disabled={isLoading || isSubmitting}>
                Invite by Email
              </TabsTrigger>
            </TabsList>

            {/* From Workspace Tab */}
            <TabsContent value='workspace' className='space-y-4'>
              {/* Search Input */}
              <div className='space-y-2'>
                <Label htmlFor='user-search'>Search members</Label>
                <div className='relative'>
                  <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    id='user-search'
                    type='text'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search by name or email...'
                    className='pl-9'
                    disabled={isLoading || isSubmitting}
                    autoComplete='off'
                  />
                  {isSearching && (
                    <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                      <LoadingSpinner className='h-4 w-4' />
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className='space-y-2'>
                  <Label>Selected ({selectedUsers.length})</Label>
                  <div className='flex flex-wrap gap-2'>
                    {selectedUsers.map(user => (
                      <Badge
                        key={user.id}
                        variant='secondary'
                        className='gap-1.5 pl-1 pr-2'
                      >
                        <Avatar className='h-5 w-5'>
                          <AvatarImage
                            src={user.image || undefined}
                            alt={user.name}
                          />
                          <AvatarFallback className='text-xs'>
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className='text-xs font-medium'>{user.name}</span>
                        <button
                          type='button'
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={isLoading || isSubmitting}
                          className='ml-0.5 rounded-full p-0.5 hover:bg-secondary-foreground/10'
                          aria-label={`Remove ${user.name}`}
                        >
                          <XIcon className='h-3 w-3' />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchQuery && (
                <div className='space-y-2'>
                  <Label>Results</Label>
                  <div className='max-h-60 overflow-y-auto rounded-md border bg-background'>
                    {availableUsers.length === 0 ? (
                      <p className='px-4 py-8 text-center text-sm text-muted-foreground'>
                        {isSearching ? 'Searching...' : 'No users found'}
                      </p>
                    ) : (
                      <div className='divide-y'>
                        {availableUsers.map(user => (
                          <button
                            key={user.id}
                            type='button'
                            onClick={() => handleAddUser(user)}
                            className='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent'
                          >
                            <Avatar className='h-9 w-9'>
                              <AvatarImage
                                src={user.image || undefined}
                                alt={user.name}
                              />
                              <AvatarFallback className='text-sm'>
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
                            <PlusIcon className='h-4 w-4 text-muted-foreground' />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Invite by Email Tab */}
            <TabsContent value='email' className='space-y-4'>
              {/* Bulk/Single Toggle */}
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant={!isBulkMode ? 'default' : 'outline'}
                  onClick={() => setIsBulkMode(false)}
                  disabled={isLoading || isSubmitting}
                  className='flex-1'
                  size='sm'
                >
                  Single Email
                </Button>
                <Button
                  type='button'
                  variant={isBulkMode ? 'default' : 'outline'}
                  onClick={() => setIsBulkMode(true)}
                  disabled={isLoading || isSubmitting}
                  className='flex-1'
                  size='sm'
                >
                  Bulk Emails
                </Button>
              </div>

              {/* Email Input */}
              <div className='space-y-2'>
                <Label htmlFor={isBulkMode ? 'bulk-emails' : 'email'}>
                  {isBulkMode ? 'Email Addresses' : 'Email Address'}
                </Label>
                {isBulkMode ? (
                  <>
                    <Textarea
                      id='bulk-emails'
                      value={bulkEmailInput}
                      onChange={e => {
                        setBulkEmailInput(e.target.value);
                        setEmailErrors([]);
                      }}
                      placeholder='Enter emails separated by commas or newlines&#10;e.g., user1@example.com, user2@example.com'
                      rows={5}
                      disabled={isLoading || isSubmitting}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Separate multiple emails with commas or newlines
                    </p>
                  </>
                ) : (
                  <Input
                    id='email'
                    type='email'
                    value={emailInput}
                    onChange={e => {
                      setEmailInput(e.target.value);
                      setEmailErrors([]);
                    }}
                    placeholder='colleague@example.com'
                    disabled={isLoading || isSubmitting}
                  />
                )}
                {emailErrors.length > 0 && (
                  <div className='rounded-md bg-destructive/10 border border-destructive/20 p-2'>
                    <p className='text-xs text-destructive font-medium mb-1'>
                      Invalid email addresses:
                    </p>
                    <ul className='text-xs text-destructive space-y-0.5 pl-4 list-disc'>
                      {emailErrors.map((email, idx) => (
                        <li key={idx}>{email}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Custom Message */}
              <div className='space-y-2'>
                <Label htmlFor='custom-message'>
                  Personal Message (optional)
                </Label>
                <Textarea
                  id='custom-message'
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder='Add a personal message to include in the invitation email...'
                  rows={3}
                  disabled={isLoading || isSubmitting}
                />
                <p className='text-xs text-muted-foreground'>
                  This message will be included in the invitation email
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Role Selection (shown for both tabs) */}
          <div className='space-y-2'>
            <Label htmlFor='role-select'>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={setSelectedRole}
              disabled={isLoading || isSubmitting}
            >
              <SelectTrigger id='role-select'>
                <SelectValue placeholder='Select a role' />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className='flex items-start gap-2'>
                      <div>
                        <div className='font-medium'>{role.name}</div>
                        {role.description && (
                          <div className='text-xs text-muted-foreground'>
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleObj?.description && (
              <p className='text-xs text-muted-foreground'>
                {selectedRoleObj.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <ResponsiveModalFooter className='flex-col gap-2 sm:flex-row'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isLoading || isSubmitting}
            className='w-full sm:w-auto'
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={
              activeTab === 'workspace'
                ? handleInviteFromWorkspace
                : handleInviteByEmail
            }
            disabled={!canSubmit}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner className='mr-2 h-4 w-4' />
                Sending...
              </>
            ) : (
              <>
                {activeTab === 'workspace'
                  ? `${contextText.submitLabel} (${selectedUsers.length})`
                  : contextText.submitLabel}
              </>
            )}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

// Icon Components

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

function PlusIcon({ className }: { className?: string }) {
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
      <path d='M5 12h14' />
      <path d='M12 5v14' />
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

export default InviteMembersModal;
