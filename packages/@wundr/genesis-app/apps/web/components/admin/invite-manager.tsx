'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

export interface Invite {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
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
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [selectedRole, setSelectedRole] = useState(availableRoles[0]?.id || '');
  const [message, setMessage] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchInvites = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/invites`);
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleSendInvites = async () => {
    const emails = isBulkMode
      ? bulkEmails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
      : [email.trim()];

    if (emails.length === 0) {
return;
}

    setIsSending(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails,
          role: selectedRole,
          message: message || undefined,
        }),
      });

      if (response.ok) {
        setEmail('');
        setBulkEmails('');
        setMessage('');
        setShowInviteForm(false);
        fetchInvites();
      }
    } catch {
      // Handle error
    } finally {
      setIsSending(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/invites/${inviteId}/resend`, {
        method: 'POST',
      });
      fetchInvites();
    } catch {
      // Handle error
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) {
return;
}

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/invites/${inviteId}`, {
        method: 'DELETE',
      });
      fetchInvites();
    } catch {
      // Handle error
    }
  };

  const handleGenerateLink = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/invites/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        setInviteLink(data.link);
      }
    } catch {
      // Handle error
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const STATUS_COLORS = {
    pending: 'bg-yellow-500/10 text-yellow-500',
    accepted: 'bg-green-500/10 text-green-500',
    expired: 'bg-gray-500/10 text-gray-500',
    revoked: 'bg-red-500/10 text-red-500',
  };

  const pendingInvites = invites.filter((i) => i.status === 'pending');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Invitations</h2>
          <p className="text-sm text-muted-foreground">
            Invite new members to your workspace
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
        >
          Invite Members
        </button>
      </div>

      {/* Invite form modal */}
      {showInviteForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setShowInviteForm(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Invite Members</h3>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkMode(false)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium',
                    !isBulkMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkMode(true)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium',
                    isBulkMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  Bulk
                </button>
              </div>

              {/* Email input */}
              {isBulkMode ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Addresses
                  </label>
                  <textarea
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="Enter emails separated by commas or newlines"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                    rows={4}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can also paste from a CSV file
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                  />
                </div>
              )}

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                >
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Personal Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message to the invite email"
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                  rows={2}
                />
              </div>

              {/* Invite link */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground mb-2">
                  Or share an invite link
                </p>
                {inviteLink ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inviteLink)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    className="text-sm text-primary hover:underline"
                  >
                    Generate invite link
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvites}
                disabled={
                  isSending ||
                  (isBulkMode ? !bulkEmails.trim() : !email.trim())
                }
                className={cn(
                  'px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isSending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending invites */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Pending invites section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              Pending Invites ({pendingInvites.length})
            </h3>

            {pendingInvites.length === 0 ? (
              <div className="p-4 text-center bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">No pending invites</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {invite.email}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs rounded capitalize',
                            STATUS_COLORS[invite.status],
                          )}
                        >
                          {invite.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Invited {new Date(invite.invitedAt).toLocaleDateString()} -
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResendInvite(invite.id)}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded text-sm"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All invites table */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              All Invites ({invites.length})
            </h3>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Invited
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No invites found
                      </td>
                    </tr>
                  ) : (
                    invites.map((invite) => (
                      <tr key={invite.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm text-foreground">
                          {invite.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                          {invite.role}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs rounded capitalize',
                              STATUS_COLORS[invite.status],
                            )}
                          >
                            {invite.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(invite.invitedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {invite.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleResendInvite(invite.id)}
                                className="text-sm text-primary hover:underline"
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="text-sm text-destructive hover:underline"
                              >
                                Revoke
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default InviteManager;
