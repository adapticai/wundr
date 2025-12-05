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
  Upload,
  Calendar,
  Shield,
  History,
  Link2,
  Download,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Invitation {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  message: string | null;
  token: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface InviteLink {
  link: string;
  invite: Invitation;
  expiresAt: string | Date;
}

interface DomainSettings {
  enableAutoInvite: boolean;
  allowedDomains: string[];
  defaultRole: string;
}

/**
 * Admin Invitations Page
 *
 * Comprehensive invitation management interface with:
 * - Pending/accepted/expired/revoked invitations list
 * - Send new invitation form with role and message
 * - Bulk invite via CSV/email list
 * - Resend/revoke invitation actions
 * - Shareable invitation link management
 * - Invitation history log
 * - Domain-based auto-invite settings
 */
export default function AdminInvitationsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Single invite state
  const [singleEmail, setSingleEmail] = useState('');
  const [singleRole, setSingleRole] = useState('MEMBER');
  const [singleMessage, setSingleMessage] = useState('');
  const [singleExpiryDays, setSingleExpiryDays] = useState('7');
  const [isSendingSingle, setIsSendingSingle] = useState(false);

  // Bulk invite state
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkRole, setBulkRole] = useState('MEMBER');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkExpiryDays, setBulkExpiryDays] = useState('7');
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // Invite link state
  const [inviteLink, setInviteLink] = useState('');
  const [linkRole, setLinkRole] = useState('MEMBER');
  const [linkExpiryDays, setLinkExpiryDays] = useState('7');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Domain settings state
  const [domainSettings, setDomainSettings] = useState<DomainSettings>({
    enableAutoInvite: false,
    allowedDomains: [],
    defaultRole: 'MEMBER',
  });
  const [newDomain, setNewDomain] = useState('');
  const [isSavingDomainSettings, setIsSavingDomainSettings] = useState(false);

  // Load invitations
  useEffect(() => {
    loadInvitations();
    loadDomainSettings();
  }, [workspaceSlug]);

  const loadInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`
      );
      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }
      const data = await response.json();
      setInvitations(data.invites || []);
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

  const loadDomainSettings = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites/domain-settings`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setDomainSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Failed to load domain settings:', error);
    }
  }, [workspaceSlug]);

  const handleSingleInvite = useCallback(async () => {
    if (!singleEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingSingle(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invites: [
              {
                email: singleEmail,
                role: singleRole,
                message: singleMessage || null,
                expiresInDays: parseInt(singleExpiryDays, 10),
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitation');
      }

      const result = await response.json();
      toast({
        title: 'Success',
        description: `Invitation sent to ${singleEmail}`,
      });

      setSingleEmail('');
      setSingleMessage('');
      await loadInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSingle(false);
    }
  }, [
    singleEmail,
    singleRole,
    singleMessage,
    singleExpiryDays,
    workspaceSlug,
    toast,
    loadInvitations,
  ]);

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
          body: JSON.stringify({
            invites: emails.map(email => ({
              email,
              role: bulkRole,
              message: bulkMessage || null,
              expiresInDays: parseInt(bulkExpiryDays, 10),
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitations');
      }

      const result = await response.json();
      const succeeded = result.emailResults?.succeeded || emails.length;
      const failed = result.emailResults?.failed || 0;

      toast({
        title: 'Success',
        description: `Sent ${succeeded} invitation(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      });

      setBulkEmails('');
      setBulkMessage('');
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
  }, [
    bulkEmails,
    bulkRole,
    bulkMessage,
    bulkExpiryDays,
    workspaceSlug,
    toast,
    loadInvitations,
  ]);

  const handleCsvUpload = useCallback(async () => {
    if (!csvFile) {
      toast({
        title: 'Error',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingCsv(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header if present
      const emailLines = lines[0]?.toLowerCase().includes('email')
        ? lines.slice(1)
        : lines;

      const emails = emailLines
        .map(line => {
          const parts = line.split(',');
          return parts[0]?.trim();
        })
        .filter(Boolean);

      if (emails.length === 0) {
        throw new Error('No valid emails found in CSV');
      }

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invites: emails.map(email => ({
              email,
              role: bulkRole,
              message: bulkMessage || null,
              expiresInDays: parseInt(bulkExpiryDays, 10),
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitations');
      }

      const result = await response.json();
      const succeeded = result.emailResults?.succeeded || emails.length;
      const failed = result.emailResults?.failed || 0;

      toast({
        title: 'Success',
        description: `Sent ${succeeded} invitation(s) from CSV${failed > 0 ? `, ${failed} failed` : ''}`,
      });

      setCsvFile(null);
      await loadInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to process CSV',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingCsv(false);
    }
  }, [
    csvFile,
    bulkRole,
    bulkMessage,
    bulkExpiryDays,
    workspaceSlug,
    toast,
    loadInvitations,
  ]);

  const handleGenerateLink = useCallback(async () => {
    setIsGeneratingLink(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: linkRole,
            expiresInDays: parseInt(linkExpiryDays, 10),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate link');
      }

      const result: InviteLink = await response.json();
      setInviteLink(result.link);

      toast({
        title: 'Success',
        description: 'Invite link generated',
      });

      await loadInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to generate link',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLink(false);
    }
  }, [linkRole, linkExpiryDays, workspaceSlug, toast, loadInvitations]);

  const handleCopyLink = useCallback(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: 'Copied',
        description: 'Invite link copied to clipboard',
      });
    }
  }, [inviteLink, toast]);

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

  const handleAddDomain = useCallback(() => {
    if (!newDomain.trim()) {
      return;
    }

    const domain = newDomain.trim().toLowerCase();
    if (!domain.includes('.')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid domain',
        variant: 'destructive',
      });
      return;
    }

    if (domainSettings.allowedDomains.includes(domain)) {
      toast({
        title: 'Error',
        description: 'Domain already added',
        variant: 'destructive',
      });
      return;
    }

    setDomainSettings({
      ...domainSettings,
      allowedDomains: [...domainSettings.allowedDomains, domain],
    });
    setNewDomain('');
  }, [newDomain, domainSettings, toast]);

  const handleRemoveDomain = useCallback(
    (domain: string) => {
      setDomainSettings({
        ...domainSettings,
        allowedDomains: domainSettings.allowedDomains.filter(d => d !== domain),
      });
    },
    [domainSettings]
  );

  const handleSaveDomainSettings = useCallback(async () => {
    setIsSavingDomainSettings(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invites/domain-settings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(domainSettings),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save domain settings');
      }

      toast({
        title: 'Success',
        description: 'Domain settings saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save domain settings',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDomainSettings(false);
    }
  }, [domainSettings, workspaceSlug, toast]);

  const handleExportInvitations = useCallback(() => {
    const csv = [
      ['Email', 'Role', 'Status', 'Created At', 'Expires At', 'Invited By'],
      ...invitations.map(inv => [
        inv.email || 'N/A',
        inv.role,
        inv.status,
        new Date(inv.createdAt).toLocaleString(),
        new Date(inv.expiresAt).toLocaleString(),
        inv.invitedBy.email || inv.invitedBy.name || 'Unknown',
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitations-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [invitations, workspaceSlug]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const pendingInvitations = invitations.filter(
    inv => inv.status === 'PENDING'
  );
  const acceptedInvitations = invitations.filter(
    inv => inv.status === 'ACCEPTED'
  );
  const expiredInvitations = invitations.filter(
    inv => inv.status === 'EXPIRED'
  );
  const revokedInvitations = invitations.filter(
    inv => inv.status === 'REVOKED'
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>
            Invitation Management
          </h1>
          <p className='text-sm text-muted-foreground'>
            Manage workspace invitations and access
          </p>
        </div>
        <Button
          onClick={handleExportInvitations}
          variant='outline'
          disabled={invitations.length === 0}
        >
          <Download className='h-4 w-4 mr-2' />
          Export CSV
        </Button>
      </div>

      <Tabs defaultValue='send' className='w-full'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='send'>Send Invite</TabsTrigger>
          <TabsTrigger value='bulk'>Bulk Invite</TabsTrigger>
          <TabsTrigger value='link'>Invite Link</TabsTrigger>
          <TabsTrigger value='pending'>
            Pending ({pendingInvitations.length})
          </TabsTrigger>
          <TabsTrigger value='history'>History</TabsTrigger>
        </TabsList>

        {/* Send Single Invite Tab */}
        <TabsContent value='send' className='space-y-4'>
          <div className='rounded-lg border bg-card'>
            <div className='border-b px-6 py-4'>
              <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                <Mail className='h-5 w-5' />
                Send Invitation
              </h2>
              <p className='text-sm text-muted-foreground'>
                Invite a new member to the workspace
              </p>
            </div>

            <div className='p-6 space-y-4'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Email Address
                </label>
                <input
                  type='email'
                  value={singleEmail}
                  onChange={e => setSingleEmail(e.target.value)}
                  placeholder='user@example.com'
                  className={cn(
                    'block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm placeholder:text-muted-foreground',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  )}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Role
                  </label>
                  <Select value={singleRole} onValueChange={setSingleRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='MEMBER'>Member</SelectItem>
                      <SelectItem value='ADMIN'>Admin</SelectItem>
                      <SelectItem value='GUEST'>Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Expires In
                  </label>
                  <Select
                    value={singleExpiryDays}
                    onValueChange={setSingleExpiryDays}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='1'>1 day</SelectItem>
                      <SelectItem value='3'>3 days</SelectItem>
                      <SelectItem value='7'>7 days</SelectItem>
                      <SelectItem value='14'>14 days</SelectItem>
                      <SelectItem value='30'>30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Message (Optional)
                </label>
                <Textarea
                  value={singleMessage}
                  onChange={e => setSingleMessage(e.target.value)}
                  placeholder='Add a personal message to the invitation...'
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSingleInvite}
                disabled={isSendingSingle || !singleEmail.trim()}
                className='w-full'
              >
                {isSendingSingle ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4 mr-2' />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Bulk Invite Tab */}
        <TabsContent value='bulk' className='space-y-4'>
          <div className='rounded-lg border bg-card'>
            <div className='border-b px-6 py-4'>
              <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                <UserPlus className='h-5 w-5' />
                Bulk Invite Members
              </h2>
              <p className='text-sm text-muted-foreground'>
                Send invitations to multiple email addresses
              </p>
            </div>

            <div className='p-6 space-y-4'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Email Addresses
                </label>
                <Textarea
                  value={bulkEmails}
                  onChange={e => setBulkEmails(e.target.value)}
                  placeholder='Enter email addresses (one per line or comma-separated)&#10;example1@company.com&#10;example2@company.com, example3@company.com'
                  rows={6}
                />
                <p className='mt-2 text-xs text-muted-foreground'>
                  Separate multiple emails with commas, semicolons, or new lines
                </p>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Role
                  </label>
                  <Select value={bulkRole} onValueChange={setBulkRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='MEMBER'>Member</SelectItem>
                      <SelectItem value='ADMIN'>Admin</SelectItem>
                      <SelectItem value='GUEST'>Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Expires In
                  </label>
                  <Select
                    value={bulkExpiryDays}
                    onValueChange={setBulkExpiryDays}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='1'>1 day</SelectItem>
                      <SelectItem value='3'>3 days</SelectItem>
                      <SelectItem value='7'>7 days</SelectItem>
                      <SelectItem value='14'>14 days</SelectItem>
                      <SelectItem value='30'>30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Message (Optional)
                </label>
                <Textarea
                  value={bulkMessage}
                  onChange={e => setBulkMessage(e.target.value)}
                  placeholder='Add a personal message to all invitations...'
                  rows={3}
                />
              </div>

              <Button
                onClick={handleBulkInvite}
                disabled={isSendingBulk || !bulkEmails.trim()}
                className='w-full'
              >
                {isSendingBulk ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4 mr-2' />
                    Send Bulk Invitations
                  </>
                )}
              </Button>

              <div className='border-t pt-4'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Upload CSV File
                </label>
                <div className='flex items-center gap-2'>
                  <input
                    type='file'
                    accept='.csv'
                    onChange={e => setCsvFile(e.target.files?.[0] || null)}
                    className='flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90'
                  />
                  <Button
                    onClick={handleCsvUpload}
                    disabled={isUploadingCsv || !csvFile}
                  >
                    {isUploadingCsv ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Upload className='h-4 w-4' />
                    )}
                  </Button>
                </div>
                <p className='mt-2 text-xs text-muted-foreground'>
                  CSV should have an email column
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Invite Link Tab */}
        <TabsContent value='link' className='space-y-4'>
          <div className='rounded-lg border bg-card'>
            <div className='border-b px-6 py-4'>
              <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                <Link2 className='h-5 w-5' />
                Shareable Invite Link
              </h2>
              <p className='text-sm text-muted-foreground'>
                Generate a link that anyone can use to request workspace access
              </p>
            </div>

            <div className='p-6 space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Default Role
                  </label>
                  <Select value={linkRole} onValueChange={setLinkRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='MEMBER'>Member</SelectItem>
                      <SelectItem value='ADMIN'>Admin</SelectItem>
                      <SelectItem value='GUEST'>Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Expires In
                  </label>
                  <Select
                    value={linkExpiryDays}
                    onValueChange={setLinkExpiryDays}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='1'>1 day</SelectItem>
                      <SelectItem value='3'>3 days</SelectItem>
                      <SelectItem value='7'>7 days</SelectItem>
                      <SelectItem value='14'>14 days</SelectItem>
                      <SelectItem value='30'>30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleGenerateLink}
                disabled={isGeneratingLink}
                className='w-full'
              >
                {isGeneratingLink ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className='h-4 w-4 mr-2' />
                    Generate New Link
                  </>
                )}
              </Button>

              {inviteLink && (
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-foreground'>
                    Current Link
                  </label>
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
                    <Button onClick={handleCopyLink} variant='outline'>
                      <Copy className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}

              {/* Domain-based auto-invite settings */}
              <div className='border-t pt-4 space-y-4'>
                <div>
                  <h3 className='text-sm font-semibold text-foreground mb-2 flex items-center gap-2'>
                    <Shield className='h-4 w-4' />
                    Domain-Based Auto-Invite
                  </h3>
                  <p className='text-xs text-muted-foreground mb-4'>
                    Automatically approve invites from specific email domains
                  </p>

                  <div className='flex items-center gap-2 mb-4'>
                    <input
                      type='checkbox'
                      id='enableAutoInvite'
                      checked={domainSettings.enableAutoInvite}
                      onChange={e =>
                        setDomainSettings({
                          ...domainSettings,
                          enableAutoInvite: e.target.checked,
                        })
                      }
                      className='rounded border-input'
                    />
                    <label
                      htmlFor='enableAutoInvite'
                      className='text-sm text-foreground'
                    >
                      Enable domain-based auto-approval
                    </label>
                  </div>

                  {domainSettings.enableAutoInvite && (
                    <>
                      <div>
                        <label className='block text-sm font-medium text-foreground mb-2'>
                          Allowed Domains
                        </label>
                        <div className='flex items-center gap-2 mb-2'>
                          <input
                            type='text'
                            value={newDomain}
                            onChange={e => setNewDomain(e.target.value)}
                            placeholder='example.com'
                            className={cn(
                              'flex-1 rounded-md border border-input bg-background',
                              'px-3 py-2 text-sm placeholder:text-muted-foreground',
                              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                            )}
                          />
                          <Button onClick={handleAddDomain} size='sm'>
                            Add
                          </Button>
                        </div>

                        <div className='space-y-2'>
                          {domainSettings.allowedDomains.map(domain => (
                            <div
                              key={domain}
                              className='flex items-center justify-between rounded-md border border-input px-3 py-2'
                            >
                              <span className='text-sm text-foreground'>
                                {domain}
                              </span>
                              <button
                                onClick={() => handleRemoveDomain(domain)}
                                className='text-destructive hover:underline text-sm'
                              >
                                <X className='h-4 w-4' />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className='block text-sm font-medium text-foreground mb-2'>
                          Default Role for Auto-Approved
                        </label>
                        <Select
                          value={domainSettings.defaultRole}
                          onValueChange={role =>
                            setDomainSettings({
                              ...domainSettings,
                              defaultRole: role,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='MEMBER'>Member</SelectItem>
                            <SelectItem value='GUEST'>Guest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleSaveDomainSettings}
                        disabled={isSavingDomainSettings}
                        className='w-full'
                      >
                        {isSavingDomainSettings ? (
                          <>
                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                            Saving...
                          </>
                        ) : (
                          'Save Domain Settings'
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Pending Invitations Tab */}
        <TabsContent value='pending' className='space-y-4'>
          <div className='rounded-lg border bg-card'>
            <div className='border-b px-6 py-4'>
              <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                <Clock className='h-5 w-5' />
                Pending Invitations ({pendingInvitations.length})
              </h2>
              <p className='text-sm text-muted-foreground'>
                Manage outstanding invitation requests
              </p>
            </div>

            <InvitationTable
              invitations={pendingInvitations}
              showActions
              onResend={handleResendInvite}
              onRevoke={handleRevokeInvite}
              isProcessing={isProcessing}
            />
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value='history' className='space-y-4'>
          {/* Accepted */}
          {acceptedInvitations.length > 0 && (
            <div className='rounded-lg border bg-card'>
              <div className='border-b px-6 py-4'>
                <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                  <CheckCircle2 className='h-5 w-5 text-green-500' />
                  Accepted ({acceptedInvitations.length})
                </h2>
              </div>
              <InvitationTable invitations={acceptedInvitations} />
            </div>
          )}

          {/* Expired */}
          {expiredInvitations.length > 0 && (
            <div className='rounded-lg border bg-card'>
              <div className='border-b px-6 py-4'>
                <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                  <XCircle className='h-5 w-5 text-yellow-500' />
                  Expired ({expiredInvitations.length})
                </h2>
              </div>
              <InvitationTable invitations={expiredInvitations} />
            </div>
          )}

          {/* Revoked */}
          {revokedInvitations.length > 0 && (
            <div className='rounded-lg border bg-card'>
              <div className='border-b px-6 py-4'>
                <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                  <XCircle className='h-5 w-5 text-red-500' />
                  Revoked ({revokedInvitations.length})
                </h2>
              </div>
              <InvitationTable invitations={revokedInvitations} />
            </div>
          )}

          {acceptedInvitations.length === 0 &&
            expiredInvitations.length === 0 &&
            revokedInvitations.length === 0 && (
              <div className='rounded-lg border bg-card p-8 text-center'>
                <History className='h-12 w-12 mx-auto text-muted-foreground/50 mb-3' />
                <p className='text-sm text-muted-foreground'>
                  No invitation history
                </p>
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Invitation Table Component
interface InvitationTableProps {
  invitations: Invitation[];
  showActions?: boolean;
  onResend?: (id: string) => void;
  onRevoke?: (id: string) => void;
  isProcessing?: boolean;
}

function InvitationTable({
  invitations,
  showActions = false,
  onResend,
  onRevoke,
  isProcessing = false,
}: InvitationTableProps) {
  if (invitations.length === 0) {
    return (
      <div className='p-8 text-center'>
        <Mail className='h-12 w-12 mx-auto text-muted-foreground/50 mb-3' />
        <p className='text-sm text-muted-foreground'>No invitations found</p>
      </div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead className='bg-muted/50'>
          <tr>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Email
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Role
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Status
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Invited By
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Sent Date
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
              Expires
            </th>
            {showActions && (
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className='divide-y divide-border bg-card'>
          {invitations.map(invitation => (
            <tr key={invitation.id} className='hover:bg-muted/30'>
              <td className='px-6 py-4 whitespace-nowrap'>
                <div className='flex items-center'>
                  <Mail className='h-4 w-4 text-muted-foreground mr-2' />
                  <span className='text-sm font-medium text-foreground'>
                    {invitation.email || '(Invite Link)'}
                  </span>
                </div>
              </td>
              <td className='px-6 py-4 whitespace-nowrap'>
                <span className='inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium'>
                  {invitation.role}
                </span>
              </td>
              <td className='px-6 py-4 whitespace-nowrap'>
                <StatusBadge status={invitation.status} />
              </td>
              <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                {invitation.invitedBy.email || invitation.invitedBy.name}
              </td>
              <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                {new Date(invitation.createdAt).toLocaleDateString()}
              </td>
              <td className='px-6 py-4 whitespace-nowrap text-sm text-muted-foreground'>
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </td>
              {showActions && (
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm'>
                  <div className='flex items-center justify-end gap-2'>
                    {onResend && (
                      <button
                        onClick={() => onResend(invitation.id)}
                        disabled={isProcessing}
                        className={cn(
                          'inline-flex items-center gap-1 text-primary hover:underline',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <Send className='h-3 w-3' />
                        Resend
                      </button>
                    )}
                    {onRevoke && (
                      <button
                        onClick={() => onRevoke(invitation.id)}
                        disabled={isProcessing}
                        className={cn(
                          'inline-flex items-center gap-1 text-destructive hover:underline',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <X className='h-3 w-3' />
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: Invitation['status'] }) {
  const config = {
    PENDING: {
      icon: Clock,
      label: 'Pending',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    ACCEPTED: {
      icon: CheckCircle2,
      label: 'Accepted',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    EXPIRED: {
      icon: XCircle,
      label: 'Expired',
      className:
        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    },
    REVOKED: {
      icon: XCircle,
      label: 'Revoked',
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
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <div className='h-8 w-64 animate-pulse rounded bg-muted' />
          <div className='h-4 w-96 animate-pulse rounded bg-muted' />
        </div>
        <div className='h-10 w-32 animate-pulse rounded bg-muted' />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
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
