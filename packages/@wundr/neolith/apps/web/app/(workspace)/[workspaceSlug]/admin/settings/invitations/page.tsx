'use client';

import {
  Mail,
  Send,
  X,
  Copy,
  RefreshCw,
  UserPlus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  sentAt: string;
  expiresAt: string;
  sentBy: string;
}

/**
 * Invitations Admin Settings Page
 *
 * Manage workspace invitations:
 * - View pending invitations with status
 * - Resend invitations
 * - Revoke/cancel invitations
 * - Bulk invite via email list
 * - Copy invite link
 */
export default function InvitationsSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Bulk invite state
  const [bulkEmails, setBulkEmails] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // Invite link state
  const [inviteLink, setInviteLink] = useState('');
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);

  // Load invitations
  useEffect(() => {
    loadInvitations();
  }, [workspaceSlug]);

  const loadInvitations = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`
      );
      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }
      const data = await response.json();
      setInvitations(data.invitations || []);
      setInviteLink(data.inviteLink || '');
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, toast]);

  const handleResendInvite = useCallback(
    async (invitationId: string) => {
      setIsProcessing(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/invites/${invitationId}/resend`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to resend invitation');
        }

        toast({
          title: 'Success',
          description: 'Invitation resent successfully',
        });

        await loadInvitations();
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to resend invitation',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [workspaceSlug, toast, loadInvitations]
  );

  const handleRevokeInvite = useCallback(
    async (invitationId: string) => {
      setIsProcessing(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/invites/${invitationId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to revoke invitation');
        }

        toast({
          title: 'Success',
          description: 'Invitation revoked successfully',
        });

        await loadInvitations();
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to revoke invitation',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [workspaceSlug, toast, loadInvitations]
  );

  const handleBulkInvite = useCallback(async () => {
    if (!bulkEmails.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter at least one email address',
        variant: 'destructive',
      });
      return;
    }

    const emails = bulkEmails
      .split(/[\n,;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid email addresses found',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingBulk(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send invitations');
      }

      const result = await response.json();
      toast({
        title: 'Success',
        description: `Sent ${result.count || emails.length} invitation(s) successfully`,
      });

      setBulkEmails('');
      await loadInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send invitations',
        variant: 'destructive',
      });
    } finally {
      setIsSendingBulk(false);
    }
  }, [bulkEmails, workspaceSlug, toast, loadInvitations]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: 'Copied',
      description: 'Invite link copied to clipboard',
    });
  }, [inviteLink, toast]);

  const handleRegenerateLink = useCallback(async () => {
    setIsRegeneratingLink(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites/regenerate-link`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate link');
      }

      const result = await response.json();
      setInviteLink(result.inviteLink);

      toast({
        title: 'Success',
        description: 'New invite link generated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to regenerate link',
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingLink(false);
    }
  }, [workspaceSlug, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const pendingInvitations = invitations.filter(
    inv => inv.status === 'pending'
  );

  const acceptedInvitations = invitations.filter(
    inv => inv.status === 'accepted'
  );

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Invitations</h1>
        <p className='mt-1 text-muted-foreground'>
          Send invitations and manage pending requests to join this workspace
        </p>
      </div>

      {/* Bulk Invite Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
            <UserPlus className='h-5 w-5' />
            Bulk Invite Members
          </h2>
          <p className='text-sm text-muted-foreground'>
            Send invitations to multiple email addresses at once
          </p>
        </div>

        <div className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              Email addresses
            </label>
            <textarea
              value={bulkEmails}
              onChange={e => setBulkEmails(e.target.value)}
              placeholder='Enter email addresses (one per line or comma-separated)&#10;example1@company.com&#10;example2@company.com, example3@company.com'
              rows={6}
              className={cn(
                'block w-full rounded-md border border-input bg-background',
                'px-3 py-2 text-sm placeholder:text-muted-foreground',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              )}
            />
            <p className='mt-2 text-xs text-muted-foreground'>
              Separate multiple emails with commas, semicolons, or new lines
            </p>
          </div>

          <button
            onClick={handleBulkInvite}
            disabled={isSendingBulk || !bulkEmails.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2',
              'text-sm font-medium text-primary-foreground',
              'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isSendingBulk ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Sending...
              </>
            ) : (
              <>
                <Send className='h-4 w-4' />
                Send Invitations
              </>
            )}
          </button>
        </div>
      </div>

      {/* Invite Link Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
            <Copy className='h-5 w-5' />
            Shareable Invite Link
          </h2>
          <p className='text-sm text-muted-foreground'>
            Anyone with this link can request to join the workspace
          </p>
        </div>

        <div className='p-6 space-y-4'>
          {inviteLink ? (
            <>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={inviteLink}
                  readOnly
                  className={cn(
                    'flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm',
                    'focus:outline-none'
                  )}
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm font-medium hover:bg-accent'
                  )}
                >
                  <Copy className='h-4 w-4' />
                  Copy
                </button>
              </div>

              <button
                onClick={handleRegenerateLink}
                disabled={isRegeneratingLink}
                className={cn(
                  'inline-flex items-center gap-2 text-sm text-primary hover:underline',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isRegeneratingLink ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className='h-4 w-4' />
                    Regenerate link
                  </>
                )}
              </button>
              <p className='text-xs text-muted-foreground'>
                Regenerating will immediately invalidate the current link
              </p>
            </>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Shareable invite links are disabled. Enable them in{' '}
              <a
                href={`/${params.workspaceSlug}/admin/settings/members`}
                className='text-primary hover:underline'
              >
                Members settings
              </a>
              .
            </p>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
            <Mail className='h-5 w-5' />
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <p className='text-sm text-muted-foreground'>
            Manage outstanding invitation requests
          </p>
        </div>

        <div className='overflow-x-auto'>
          {pendingInvitations.length === 0 ? (
            <div className='p-8 text-center'>
              <Mail className='h-12 w-12 mx-auto text-muted-foreground/50 mb-3' />
              <p className='text-sm text-muted-foreground'>
                No pending invitations
              </p>
            </div>
          ) : (
            <table className='w-full'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Email
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Sent By
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Sent Date
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Expires
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-card'>
                {pendingInvitations.map(invitation => (
                  <tr key={invitation.id} className='hover:bg-muted/30'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <Mail className='h-4 w-4 text-muted-foreground mr-2' />
                        <span className='text-sm font-medium text-foreground'>
                          {invitation.email}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <StatusBadge status={invitation.status} />
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                      {invitation.sentBy}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                      {new Date(invitation.sentAt).toLocaleDateString()}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm'>
                      <div className='flex items-center justify-end gap-2'>
                        <button
                          onClick={() => handleResendInvite(invitation.id)}
                          disabled={isProcessing}
                          className={cn(
                            'inline-flex items-center gap-1 text-primary hover:underline',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <Send className='h-3 w-3' />
                          Resend
                        </button>
                        <button
                          onClick={() => handleRevokeInvite(invitation.id)}
                          disabled={isProcessing}
                          className={cn(
                            'inline-flex items-center gap-1 text-destructive hover:underline',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <X className='h-3 w-3' />
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Accepted Invitations */}
      {acceptedInvitations.length > 0 && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-500' />
              Accepted Invitations ({acceptedInvitations.length})
            </h2>
            <p className='text-sm text-muted-foreground'>
              Recently accepted invitations
            </p>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Email
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Sent By
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                    Sent Date
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-card'>
                {acceptedInvitations.map(invitation => (
                  <tr key={invitation.id} className='hover:bg-muted/30'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <Mail className='h-4 w-4 text-muted-foreground mr-2' />
                        <span className='text-sm font-medium text-foreground'>
                          {invitation.email}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <StatusBadge status={invitation.status} />
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                      {invitation.sentBy}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                      {new Date(invitation.sentAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: Invitation['status'] }) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    accepted: {
      icon: CheckCircle2,
      label: 'Accepted',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    expired: {
      icon: XCircle,
      label: 'Expired',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      <Icon className='h-3 w-3' />
      {config.label}
    </span>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <div className='h-5 w-48 animate-pulse rounded bg-muted mb-2' />
            <div className='h-4 w-96 animate-pulse rounded bg-muted' />
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              <div className='h-10 w-full animate-pulse rounded bg-muted' />
              <div className='h-10 w-full animate-pulse rounded bg-muted' />
              <div className='h-10 w-full animate-pulse rounded bg-muted' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
