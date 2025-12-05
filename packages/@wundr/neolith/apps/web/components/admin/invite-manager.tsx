'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface Invite {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  message?: string;
}

/**
 * Props for the InviteManager component.
 */
export interface InviteManagerProps {
  /** The workspace ID to manage invites for */
  workspaceId: string;
  /** List of available roles for invitations */
  availableRoles: { id: string; name: string }[];
  /** Additional CSS classes to apply */
  className?: string;
}

export function InviteManager({
  workspaceId,
  availableRoles,
  className,
}: InviteManagerProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [message, setMessage] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchInvites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch invites');
      }
      const data = await response.json();
      setInvites(data.invites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
      console.error('Failed to fetch invites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleSendInvites = async () => {
    const emails = isBulkMode
      ? bulkEmails
          .split(/[,\n]/)
          .map(e => e.trim())
          .filter(Boolean)
      : [email.trim()];

    if (emails.length === 0 || !selectedRole) {
      setError('Please fill in all required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails,
            role: selectedRole,
            message: message || undefined,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to send invites');
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
          `${succeeded} invitation${succeeded !== 1 ? 's' : ''} sent, ${failed} failed`,
        );
      } else {
        // All succeeded
        if (emails.length === 1) {
          toast.success(`Invitation sent to ${emails[0]}`);
        } else {
          toast.success(`${emails.length} invitations sent successfully`);
        }
      }

      setEmail('');
      setBulkEmails('');
      setMessage('');
      setShowInviteForm(false);
      fetchInvites();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send invites';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to send invites:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites/${inviteId}/resend`,
        {
          method: 'POST',
        },
      );
      if (!response.ok) {
        throw new Error('Failed to resend invite');
      }
      toast.success('Invitation resent successfully');
      fetchInvites();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to resend invite';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to resend invite:', err);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites/${inviteId}`,
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        throw new Error('Failed to revoke invite');
      }
      toast.success('Invitation revoked successfully');
      fetchInvites();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to revoke invite';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to revoke invite:', err);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedRole) {
      setError('Please select a role first');
      toast.error('Please select a role first');
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        },
      );
      if (!response.ok) {
        throw new Error('Failed to generate invite link');
      }
      const data = await response.json();
      setInviteLink(data.link);
      toast.success('Invite link generated successfully');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate invite link';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to generate invite link:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Invite link copied to clipboard');
  };

  const pendingInvites = invites.filter(i => i.status === 'PENDING');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold text-foreground'>Invitations</h2>
          <p className='text-sm text-muted-foreground'>
            Invite new members to your workspace
          </p>
        </div>
        <Button onClick={() => setShowInviteForm(true)}>Invite Members</Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-lg'>
          <p className='text-sm text-destructive'>{error}</p>
        </div>
      )}

      {/* Invite form modal */}
      <ResponsiveModal open={showInviteForm} onOpenChange={setShowInviteForm}>
        <ResponsiveModalContent className='max-w-md'>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Invite Members</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className='space-y-4 px-4 md:px-0'>
            {/* Mode toggle */}
            <div className='flex gap-2'>
              <Button
                variant={!isBulkMode ? 'default' : 'outline'}
                onClick={() => setIsBulkMode(false)}
                className='flex-1'
              >
                Single
              </Button>
              <Button
                variant={isBulkMode ? 'default' : 'outline'}
                onClick={() => setIsBulkMode(true)}
                className='flex-1'
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
                  placeholder='Enter emails separated by commas or newlines'
                  rows={4}
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  You can also paste from a CSV file
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

            {/* Invite link */}
            <div className='p-3 bg-muted rounded-lg'>
              <p className='text-sm text-foreground mb-2'>
                Or share an invite link
              </p>
              {inviteLink ? (
                <div className='flex gap-2'>
                  <Input
                    type='text'
                    value={inviteLink}
                    readOnly
                    className='flex-1 font-mono text-sm'
                  />
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => copyToClipboard(inviteLink)}
                  >
                    Copy
                  </Button>
                </div>
              ) : (
                <Button
                  variant='link'
                  size='sm'
                  onClick={handleGenerateLink}
                  className='h-auto p-0'
                >
                  Generate invite link
                </Button>
              )}
            </div>
          </div>

          <ResponsiveModalFooter className='px-4 md:px-0'>
            <Button variant='outline' onClick={() => setShowInviteForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={
                isSending ||
                !selectedRole ||
                (isBulkMode ? !bulkEmails.trim() : !email.trim())
              }
            >
              {isSending ? 'Sending...' : 'Send Invite'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Pending invites */}
      {isLoading ? (
        <div className='flex items-center justify-center py-12'>
          <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
        </div>
      ) : (
        <>
          {/* Pending invites section */}
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-foreground'>
              Pending Invites ({pendingInvites.length})
            </h3>

            {pendingInvites.length === 0 ? (
              <div className='p-4 text-center bg-muted/50 rounded-lg'>
                <p className='text-sm text-muted-foreground'>
                  No pending invites
                </p>
              </div>
            ) : (
              <div className='space-y-2'>
                {pendingInvites.map(invite => (
                  <Card key={invite.id} className='p-3'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-medium text-foreground'>
                            {invite.email}
                          </span>
                          <Badge variant='secondary'>{invite.status}</Badge>
                        </div>
                        <div className='text-xs text-muted-foreground mt-0.5'>
                          Invited{' '}
                          {new Date(invite.invitedAt).toLocaleDateString()} -
                          Expires{' '}
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleResendInvite(invite.id)}
                        >
                          Resend
                        </Button>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* All invites table */}
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-foreground'>
              All Invites ({invites.length})
            </h3>

            <div className='rounded-lg border border-border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='text-center text-muted-foreground'
                      >
                        No invites found
                      </TableCell>
                    </TableRow>
                  ) : (
                    invites.map(invite => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell className='capitalize'>
                          {invite.role}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invite.status === 'PENDING'
                                ? 'default'
                                : invite.status === 'ACCEPTED'
                                  ? 'secondary'
                                  : invite.status === 'EXPIRED'
                                    ? 'outline'
                                    : 'destructive'
                            }
                          >
                            {invite.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {new Date(invite.invitedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className='text-right'>
                          {invite.status === 'PENDING' && (
                            <div className='flex justify-end gap-2'>
                              <Button
                                variant='link'
                                size='sm'
                                onClick={() => handleResendInvite(invite.id)}
                                className='h-auto p-0'
                              >
                                Resend
                              </Button>
                              <Button
                                variant='link'
                                size='sm'
                                onClick={() => handleRevokeInvite(invite.id)}
                                className='h-auto p-0 text-destructive'
                              >
                                Revoke
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InviteManager;
