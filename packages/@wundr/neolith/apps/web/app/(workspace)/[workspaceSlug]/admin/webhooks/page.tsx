'use client';

import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Globe,
  RefreshCw,
  Key,
  Copy,
  Check,
  Filter,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'FAILED';
  headers: Record<string, string>;
  retryAttempts: number;
  timeout: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deliveries: number;
  };
  lastDelivery?: {
    createdAt: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRYING';
  } | null;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

const AVAILABLE_EVENTS = [
  { value: 'message.created', label: 'Message Created', category: 'Messages' },
  { value: 'message.updated', label: 'Message Updated', category: 'Messages' },
  { value: 'message.deleted', label: 'Message Deleted', category: 'Messages' },
  { value: 'channel.created', label: 'Channel Created', category: 'Channels' },
  { value: 'channel.updated', label: 'Channel Updated', category: 'Channels' },
  { value: 'channel.deleted', label: 'Channel Deleted', category: 'Channels' },
  {
    value: 'channel.archived',
    label: 'Channel Archived',
    category: 'Channels',
  },
  { value: 'member.joined', label: 'Member Joined', category: 'Members' },
  { value: 'member.left', label: 'Member Left', category: 'Members' },
  { value: 'member.updated', label: 'Member Updated', category: 'Members' },
  { value: 'file.uploaded', label: 'File Uploaded', category: 'Files' },
  { value: 'file.deleted', label: 'File Deleted', category: 'Files' },
  {
    value: 'workspace.updated',
    label: 'Workspace Updated',
    category: 'Workspace',
  },
  { value: 'task.created', label: 'Task Created', category: 'Tasks' },
  { value: 'task.updated', label: 'Task Updated', category: 'Tasks' },
  { value: 'task.completed', label: 'Task Completed', category: 'Tasks' },
];

export default function AdminWebhooksPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Create/Edit Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formHeaders, setFormHeaders] = useState('');
  const [formRetryAttempts, setFormRetryAttempts] = useState('3');
  const [formTimeout, setFormTimeout] = useState('30000');

  // Delivery History Dialog State
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDelivery[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedDelivery, setSelectedDelivery] =
    useState<WebhookDelivery | null>(null);

  // Secret Management State
  const [isSecretDialogOpen, setIsSecretDialogOpen] = useState(false);
  const [secretWebhook, setSecretWebhook] = useState<Webhook | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delete Confirmation State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Load webhooks
  useEffect(() => {
    loadWebhooks();
  }, [workspaceSlug]);

  const loadWebhooks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/webhooks`);
      if (!response.ok) {
        throw new Error('Failed to load webhooks');
      }
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load webhooks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = useCallback(() => {
    setEditingWebhook(null);
    setFormName('');
    setFormUrl('');
    setFormEvents([]);
    setFormSecret(generateSecret());
    setFormStatus('ACTIVE');
    setFormHeaders('');
    setFormRetryAttempts('3');
    setFormTimeout('30000');
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setFormSecret(webhook.secret || '');
    setFormStatus(webhook.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');
    setFormHeaders(JSON.stringify(webhook.headers, null, 2));
    setFormRetryAttempts(webhook.retryAttempts.toString());
    setFormTimeout(webhook.timeout.toString());
    setIsDialogOpen(true);
  }, []);

  const handleSaveWebhook = async () => {
    if (!formName || !formUrl || formEvents.length === 0) {
      toast({
        title: 'Validation Error',
        description:
          'Please provide a name, URL, and select at least one event',
        variant: 'destructive',
      });
      return;
    }

    // Validate URL
    try {
      new URL(formUrl);
    } catch {
      toast({
        title: 'Validation Error',
        description: 'Please provide a valid URL',
        variant: 'destructive',
      });
      return;
    }

    // Validate headers JSON
    let headers = {};
    if (formHeaders.trim()) {
      try {
        headers = JSON.parse(formHeaders);
      } catch {
        toast({
          title: 'Validation Error',
          description: 'Headers must be valid JSON',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const method = editingWebhook ? 'PATCH' : 'POST';
      const url = editingWebhook
        ? `/api/workspaces/${workspaceSlug}/webhooks/${editingWebhook.id}`
        : `/api/workspaces/${workspaceSlug}/webhooks`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          events: formEvents,
          secret: formSecret || null,
          status: formStatus,
          headers,
          retryAttempts: parseInt(formRetryAttempts, 10),
          timeout: parseInt(formTimeout, 10),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save webhook');
      }

      await loadWebhooks();
      setIsDialogOpen(false);
      toast({
        title: 'Success',
        description: editingWebhook
          ? 'Webhook updated successfully'
          : 'Webhook created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save webhook',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/webhooks/${webhookId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete webhook');
      }

      await loadWebhooks();
      toast({
        title: 'Success',
        description: 'Webhook deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete webhook',
        variant: 'destructive',
      });
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test payload');
      }

      const result = await response.json();
      toast({
        title: 'Test Sent',
        description: `Status: ${result.status || 'Unknown'} - Check delivery history for details`,
      });

      // Reload to get updated delivery count
      await loadWebhooks();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to test webhook',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setIsHistoryDialogOpen(true);
    setIsLoadingLogs(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/webhooks/${webhook.id}/deliveries`
      );
      if (!response.ok) {
        throw new Error('Failed to load delivery logs');
      }
      const data = await response.json();
      setDeliveryLogs(data.deliveries || []);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load delivery history',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    if (!selectedWebhook) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/webhooks/${selectedWebhook.id}/deliveries/${deliveryId}/retry`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to retry delivery');
      }

      toast({
        title: 'Success',
        description: 'Delivery retry initiated',
      });

      // Reload deliveries
      await handleViewDeliveries(selectedWebhook);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to retry delivery',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewSecret = (webhook: Webhook) => {
    setSecretWebhook(webhook);
    setIsSecretDialogOpen(true);
    setCopiedSecret(false);
  };

  const handleCopySecret = () => {
    if (secretWebhook?.secret) {
      navigator.clipboard.writeText(secretWebhook.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const toggleAllEvents = () => {
    if (formEvents.length === AVAILABLE_EVENTS.length) {
      setFormEvents([]);
    } else {
      setFormEvents(AVAILABLE_EVENTS.map(e => e.value));
    }
  };

  const generateSecret = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Filter webhooks
  const filteredWebhooks = webhooks.filter(webhook => {
    if (statusFilter !== 'all' && webhook.status !== statusFilter) {
      return false;
    }
    if (eventFilter !== 'all' && !webhook.events.includes(eventFilter)) {
      return false;
    }
    return true;
  });

  // Group events by category
  const eventsByCategory = AVAILABLE_EVENTS.reduce(
    (acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    },
    {} as Record<string, typeof AVAILABLE_EVENTS>
  );

  if (isLoading) {
    return <WebhooksSkeleton />;
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Webhooks</h1>
        <p className='mt-1 text-muted-foreground'>
          Manage outgoing webhooks for workspace events
        </p>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-3'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[180px]'>
            <Filter className='h-4 w-4 mr-2' />
            <SelectValue placeholder='Filter by status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            <SelectItem value='ACTIVE'>Active</SelectItem>
            <SelectItem value='INACTIVE'>Inactive</SelectItem>
            <SelectItem value='FAILED'>Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className='w-[180px]'>
            <Filter className='h-4 w-4 mr-2' />
            <SelectValue placeholder='Filter by event' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Events</SelectItem>
            {AVAILABLE_EVENTS.map(event => (
              <SelectItem key={event.value} value={event.value}>
                {event.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Globe className='h-5 w-5' />
                Configured Webhooks
              </CardTitle>
              <CardDescription>
                Send real-time event notifications to external services
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className='h-4 w-4 mr-2' />
              Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredWebhooks.length === 0 ? (
            <div className='text-center py-12'>
              <Globe className='h-12 w-12 mx-auto text-muted-foreground mb-3' />
              <p className='text-muted-foreground mb-4'>
                {statusFilter !== 'all' || eventFilter !== 'all'
                  ? 'No webhooks match the selected filters'
                  : 'No webhooks configured yet'}
              </p>
              <Button onClick={openCreateDialog} variant='outline'>
                <Plus className='h-4 w-4 mr-2' />
                Create Your First Webhook
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deliveries</TableHead>
                  <TableHead>Last Delivery</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebhooks.map(webhook => (
                  <TableRow key={webhook.id}>
                    <TableCell className='font-medium'>
                      {webhook.name}
                    </TableCell>
                    <TableCell className='font-mono text-sm max-w-xs truncate'>
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {webhook.events.slice(0, 2).map(event => (
                          <Badge
                            key={event}
                            variant='secondary'
                            className='text-xs'
                          >
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Badge variant='outline' className='text-xs'>
                            +{webhook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.status === 'ACTIVE' ? (
                        <Badge variant='default' className='gap-1'>
                          <CheckCircle2 className='h-3 w-3' />
                          Active
                        </Badge>
                      ) : webhook.status === 'FAILED' ? (
                        <Badge variant='destructive' className='gap-1'>
                          <AlertTriangle className='h-3 w-3' />
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant='secondary' className='gap-1'>
                          <XCircle className='h-3 w-3' />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{webhook._count?.deliveries || 0}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {webhook.lastDelivery ? (
                        <div className='flex items-center gap-2'>
                          {webhook.lastDelivery.status === 'SUCCESS' ? (
                            <CheckCircle2 className='h-3 w-3 text-green-600' />
                          ) : (
                            <XCircle className='h-3 w-3 text-red-600' />
                          )}
                          {new Date(
                            webhook.lastDelivery.createdAt
                          ).toLocaleString()}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleViewDeliveries(webhook)}
                          title='View delivery history'
                        >
                          <Eye className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleTestWebhook(webhook.id)}
                          disabled={isSaving}
                          title='Send test payload'
                        >
                          <Send className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleViewSecret(webhook)}
                          title='View secret key'
                        >
                          <Key className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => openEditDialog(webhook)}
                          title='Edit webhook'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setWebhookToDelete(webhook.id);
                            setDeleteDialogOpen(true);
                          }}
                          title='Delete webhook'
                        >
                          <Trash2 className='h-4 w-4 text-red-500' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure webhook endpoint and event subscriptions
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='webhook-name'>Name</Label>
              <Input
                id='webhook-name'
                type='text'
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder='Production API Webhook'
              />
              <p className='text-xs text-muted-foreground'>
                A friendly name to identify this webhook
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='webhook-url'>Webhook URL</Label>
              <Input
                id='webhook-url'
                type='url'
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder='https://api.example.com/webhooks'
              />
              <p className='text-xs text-muted-foreground'>
                The URL that will receive POST requests for subscribed events
              </p>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label>Events</Label>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={toggleAllEvents}
                >
                  {formEvents.length === AVAILABLE_EVENTS.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>
              <div className='border rounded-lg p-4 max-h-64 overflow-y-auto space-y-4'>
                {Object.entries(eventsByCategory).map(([category, events]) => (
                  <div key={category}>
                    <h4 className='text-sm font-medium mb-2'>{category}</h4>
                    <div className='grid grid-cols-2 gap-2'>
                      {events.map(event => (
                        <label
                          key={event.value}
                          className='flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted'
                        >
                          <input
                            type='checkbox'
                            checked={formEvents.includes(event.value)}
                            onChange={() => toggleEvent(event.value)}
                            className='h-4 w-4'
                          />
                          <span className='text-sm'>{event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className='text-xs text-muted-foreground'>
                Select which events should trigger this webhook
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='webhook-secret'>Secret Key</Label>
              <div className='flex gap-2'>
                <Input
                  id='webhook-secret'
                  type='text'
                  value={formSecret}
                  onChange={e => setFormSecret(e.target.value)}
                  className='font-mono text-xs'
                  placeholder='Leave empty for no signature'
                />
                <Button
                  variant='outline'
                  onClick={() => setFormSecret(generateSecret())}
                  type='button'
                >
                  Generate
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Used to sign webhook payloads (HMAC-SHA256) for verification
              </p>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='webhook-status'>Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={v => setFormStatus(v as 'ACTIVE' | 'INACTIVE')}
                >
                  <SelectTrigger id='webhook-status'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ACTIVE'>Active</SelectItem>
                    <SelectItem value='INACTIVE'>Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='webhook-retry'>Retry Attempts</Label>
                <Input
                  id='webhook-retry'
                  type='number'
                  min='0'
                  max='10'
                  value={formRetryAttempts}
                  onChange={e => setFormRetryAttempts(e.target.value)}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='webhook-timeout'>Timeout (ms)</Label>
              <Input
                id='webhook-timeout'
                type='number'
                min='1000'
                max='120000'
                step='1000'
                value={formTimeout}
                onChange={e => setFormTimeout(e.target.value)}
              />
              <p className='text-xs text-muted-foreground'>
                Request timeout in milliseconds (1000-120000)
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='webhook-headers'>Custom Headers (JSON)</Label>
              <Textarea
                id='webhook-headers'
                value={formHeaders}
                onChange={e => setFormHeaders(e.target.value)}
                placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                rows={4}
                className='font-mono text-xs'
              />
              <p className='text-xs text-muted-foreground'>
                Optional custom headers to send with each request
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWebhook} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : editingWebhook ? (
                'Update Webhook'
              ) : (
                'Create Webhook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className='max-w-6xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              Delivery History - {selectedWebhook?.name}
            </DialogTitle>
            <DialogDescription>
              Recent webhook delivery attempts and their responses
            </DialogDescription>
          </DialogHeader>

          <div className='py-4'>
            {isLoadingLogs ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            ) : deliveryLogs.length === 0 ? (
              <div className='text-center py-12'>
                <p className='text-muted-foreground'>No deliveries yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className='text-sm'>
                        {new Date(log.createdAt).toLocaleString()}
                        {log.completedAt && (
                          <div className='text-xs text-muted-foreground'>
                            Completed:{' '}
                            {new Date(log.completedAt).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant='secondary' className='text-xs'>
                          {log.event}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col gap-1'>
                          <Badge
                            variant={
                              log.status === 'SUCCESS'
                                ? 'default'
                                : log.status === 'FAILED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {log.status}
                          </Badge>
                          {log.responseStatus && (
                            <Badge variant='outline' className='text-xs'>
                              HTTP {log.responseStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='max-w-xs'>
                        {log.error ? (
                          <div className='text-xs text-red-600 truncate'>
                            {log.error}
                          </div>
                        ) : log.responseBody ? (
                          <div className='text-xs text-muted-foreground truncate'>
                            {log.responseBody.substring(0, 100)}
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>
                            No response
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <span className='text-sm'>{log.attemptCount}</span>
                          {log.nextRetryAt && (
                            <Clock className='h-3 w-3 text-muted-foreground' />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setSelectedDelivery(log)}
                            title='View details'
                          >
                            <Eye className='h-4 w-4' />
                          </Button>
                          {log.status === 'FAILED' && (
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleRetryDelivery(log.id)}
                              disabled={isSaving}
                              title='Retry delivery'
                            >
                              <RefreshCw className='h-4 w-4' />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Details Dialog */}
      <Dialog
        open={selectedDelivery !== null}
        onOpenChange={() => setSelectedDelivery(null)}
      >
        <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Delivery Details</DialogTitle>
            <DialogDescription>
              Complete information about this delivery attempt
            </DialogDescription>
          </DialogHeader>

          {selectedDelivery && (
            <div className='space-y-4 py-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label className='text-xs text-muted-foreground'>Event</Label>
                  <p className='font-medium'>{selectedDelivery.event}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Status
                  </Label>
                  <p className='font-medium'>{selectedDelivery.status}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Response Status
                  </Label>
                  <p className='font-medium'>
                    {selectedDelivery.responseStatus || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Attempt Count
                  </Label>
                  <p className='font-medium'>{selectedDelivery.attemptCount}</p>
                </div>
              </div>

              <div>
                <Label className='text-xs text-muted-foreground'>Payload</Label>
                <pre className='mt-1 p-4 bg-muted rounded-lg text-xs overflow-x-auto'>
                  {JSON.stringify(selectedDelivery.payload, null, 2)}
                </pre>
              </div>

              {selectedDelivery.responseBody && (
                <div>
                  <Label className='text-xs text-muted-foreground'>
                    Response Body
                  </Label>
                  <pre className='mt-1 p-4 bg-muted rounded-lg text-xs overflow-x-auto'>
                    {selectedDelivery.responseBody}
                  </pre>
                </div>
              )}

              {selectedDelivery.error && (
                <div>
                  <Label className='text-xs text-muted-foreground text-red-600'>
                    Error
                  </Label>
                  <p className='mt-1 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600'>
                    {selectedDelivery.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Secret Key Dialog */}
      <Dialog open={isSecretDialogOpen} onOpenChange={setIsSecretDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret Key</DialogTitle>
            <DialogDescription>
              Use this key to verify webhook signatures
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Secret Key</Label>
              <div className='flex gap-2'>
                <Input
                  type='text'
                  value={secretWebhook?.secret || 'No secret configured'}
                  readOnly
                  className='font-mono text-xs'
                />
                <Button
                  variant='outline'
                  onClick={handleCopySecret}
                  disabled={!secretWebhook?.secret}
                >
                  {copiedSecret ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            <div className='p-4 bg-muted rounded-lg text-xs space-y-2'>
              <p className='font-medium'>Verification Example (Node.js):</p>
              <pre className='overflow-x-auto'>
                {`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return signature === digest;
}

// Usage
const isValid = verifyWebhook(
  req.body,
  req.headers['x-webhook-signature'],
  '${secretWebhook?.secret || 'your-secret-key'}'
);`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This will
              permanently remove the endpoint and all associated delivery
              history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                if (webhookToDelete) {
                  handleDeleteWebhook(webhookToDelete);
                  setDeleteDialogOpen(false);
                  setWebhookToDelete(null);
                }
              }}
            >
              Delete Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WebhooksSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      <Card>
        <CardHeader>
          <div className='h-6 w-48 animate-pulse rounded bg-muted' />
          <div className='h-4 w-full animate-pulse rounded bg-muted' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
          <div className='h-10 w-full animate-pulse rounded bg-muted' />
        </CardContent>
      </Card>
    </div>
  );
}
