'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';

/**
 * Props for the WorkspaceInviteModal component.
 */
export interface WorkspaceInviteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** The workspace ID */
  workspaceId: string;
  /** The workspace slug for API calls */
  workspaceSlug: string;
  /** List of available roles for invitations */
  availableRoles: { id: string; name: string }[];
  /** Optional callback when invitation succeeds */
  onSuccess?: () => void;
}

/**
 * Workspace-specific invite modal for inviting users to join the workspace.
 *
 * Features:
 * - Single and bulk email input modes
 * - Role selection (Admin, Member, Guest)
 * - Custom invitation message
 * - Invite link generation
 * - API integration with /api/workspaces/[workspaceSlug]/admin/invites
 *
 * @example
 * ```tsx
 * <WorkspaceInviteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   workspaceId="workspace-123"
 *   workspaceSlug="my-workspace"
 *   availableRoles={[
 *     { id: 'admin', name: 'Admin' },
 *     { id: 'member', name: 'Member' },
 *     { id: 'guest', name: 'Guest' }
 *   ]}
 *   onSuccess={() => console.log('Invite sent!')}
 * />
 * ```
 */
export function WorkspaceInviteModal({
  isOpen,
  onClose,
  workspaceId: _workspaceId,
  workspaceSlug,
  availableRoles,
  onSuccess,
}: WorkspaceInviteModalProps) {
  // Form state
  const [email, setEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [message, setMessage] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Reset form when modal closes
  const handleClose = () => {
    setEmail('');
    setBulkEmails('');
    setSelectedRole('');
    setMessage('');
    setInviteLink(null);
    setIsBulkMode(false);
    onClose();
  };

  // Handle sending invitations
  const handleSendInvites = async () => {
    const emails = isBulkMode
      ? bulkEmails
          .split(/[,\n]/)
          .map(e => e.trim())
          .filter(Boolean)
      : [email.trim()];

    if (emails.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails,
            role: selectedRole,
            message: message || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send invites');
      }

      const data = await response.json();

      // Show warning if some emails failed
      if (data.emailResults && data.emailResults.failed > 0) {
        const succeeded = data.emailResults.succeeded || 0;
        const failed = data.emailResults.failed;
        const failedEmails = data.emailResults.details
          .filter((r: any) => !r.success)
          .map((r: any) => r.email)
          .join(', ');
        console.warn(`Some invitation emails failed: ${failedEmails}`);
        toast.warning(
          `${succeeded} invitation${succeeded !== 1 ? 's' : ''} sent, ${failed} failed`
        );
      } else {
        // All succeeded
        if (emails.length === 1) {
          toast.success(`Invitation sent to ${emails[0]}`);
        } else {
          toast.success(`${emails.length} invitations sent successfully`);
        }
      }

      // Call success callback
      onSuccess?.();

      // Reset and close
      handleClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send invites';
      toast.error(errorMessage);
      console.error('Failed to send invites:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle generating invite link
  const handleGenerateLink = async () => {
    if (!selectedRole) {
      toast.error('Please select a role first');
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate invite link');
      }

      const data = await response.json();
      setInviteLink(data.link);
      toast.success('Invite link generated successfully');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate invite link';
      toast.error(errorMessage);
      console.error('Failed to generate invite link:', err);
    }
  };

  // Copy invite link to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Invite link copied to clipboard');
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={handleClose}>
      <ResponsiveModalContent className='max-w-md'>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            Invite Members to Workspace
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className='space-y-4 px-4 md:px-0'>
          {/* Mode toggle */}
          <div className='flex gap-2'>
            <Button
              variant={!isBulkMode ? 'default' : 'outline'}
              onClick={() => setIsBulkMode(false)}
              className='flex-1'
              type='button'
            >
              Single
            </Button>
            <Button
              variant={isBulkMode ? 'default' : 'outline'}
              onClick={() => setIsBulkMode(true)}
              className='flex-1'
              type='button'
            >
              Bulk
            </Button>
          </div>

          {/* Email input */}
          {isBulkMode ? (
            <div>
              <Label htmlFor='bulk-emails'>Email Addresses</Label>
              <Textarea
                id='bulk-emails'
                value={bulkEmails}
                onChange={e => setBulkEmails(e.target.value)}
                placeholder='Enter emails separated by commas or newlines&#10;example@company.com, another@company.com'
                rows={4}
                className='font-mono text-sm'
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Separate multiple emails with commas or line breaks
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='colleague@example.com'
              />
            </div>
          )}

          {/* Role selector */}
          <div>
            <Label htmlFor='role'>Role *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id='role'>
                <SelectValue placeholder='Select a role' />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom message */}
          <div>
            <Label htmlFor='message'>Personal Message (optional)</Label>
            <Textarea
              id='message'
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder='Add a personal message to the invite email'
              rows={2}
            />
          </div>

          {/* Invite link section */}
          <div className='p-3 bg-muted rounded-lg space-y-2'>
            <p className='text-sm text-foreground font-medium'>
              Or share an invite link
            </p>
            {inviteLink ? (
              <div className='flex gap-2'>
                <Input
                  type='text'
                  value={inviteLink}
                  readOnly
                  className='flex-1 font-mono text-xs'
                />
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => copyToClipboard(inviteLink)}
                  type='button'
                >
                  Copy
                </Button>
              </div>
            ) : (
              <Button
                variant='outline'
                size='sm'
                onClick={handleGenerateLink}
                className='w-full'
                type='button'
                disabled={!selectedRole}
              >
                Generate invite link
              </Button>
            )}
            <p className='text-xs text-muted-foreground'>
              Invite links can be shared with anyone and allow them to join with
              the selected role
            </p>
          </div>
        </div>

        <ResponsiveModalFooter className='px-4 md:px-0'>
          <Button variant='outline' onClick={handleClose} type='button'>
            Cancel
          </Button>
          <Button
            onClick={handleSendInvites}
            disabled={
              isSending ||
              !selectedRole ||
              (isBulkMode ? !bulkEmails.trim() : !email.trim())
            }
            type='button'
          >
            {isSending ? 'Sending...' : 'Send Invite'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default WorkspaceInviteModal;
