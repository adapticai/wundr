'use client';

import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
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
        <Button onClick={() => setShowInviteForm(true)}>
          Invite Members
        </Button>
      </div>

      {/* Invite form modal */}
      <Dialog open={showInviteForm} onOpenChange={setShowInviteForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Members</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={!isBulkMode ? 'default' : 'outline'}
                onClick={() => setIsBulkMode(false)}
                className="flex-1"
              >
                Single
              </Button>
              <Button
                variant={isBulkMode ? 'default' : 'outline'}
                onClick={() => setIsBulkMode(true)}
                className="flex-1"
              >
                Bulk
              </Button>
            </div>

            {/* Email input */}
            {isBulkMode ? (
              <div>
                <Label htmlFor="bulk-emails">Email Addresses</Label>
                <Textarea
                  id="bulk-emails"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder="Enter emails separated by commas or newlines"
                  rows={4}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  You can also paste from a CSV file
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                />
              </div>
            )}

            {/* Role selector */}
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom message */}
            <div>
              <Label htmlFor="message">Personal Message (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message to the invite email"
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
                  <Input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(inviteLink)}
                  >
                    Copy
                  </Button>
                </div>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleGenerateLink}
                  className="h-auto p-0"
                >
                  Generate invite link
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteForm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={
                isSending ||
                (isBulkMode ? !bulkEmails.trim() : !email.trim())
              }
            >
              {isSending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <Card key={invite.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {invite.email}
                          </span>
                          <Badge variant="secondary">
                            {invite.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Invited {new Date(invite.invitedAt).toLocaleDateString()} -
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvite(invite.id)}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
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
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              All Invites ({invites.length})
            </h3>

            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No invites found
                      </TableCell>
                    </TableRow>
                  ) : (
                    invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell className="capitalize">{invite.role}</TableCell>
                        <TableCell>
                          <Badge variant={
                            invite.status === 'pending' ? 'default' :
                            invite.status === 'accepted' ? 'secondary' :
                            invite.status === 'expired' ? 'outline' :
                            'destructive'
                          }>
                            {invite.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(invite.invitedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {invite.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleResendInvite(invite.id)}
                                className="h-auto p-0"
                              >
                                Resend
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="h-auto p-0 text-destructive"
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
