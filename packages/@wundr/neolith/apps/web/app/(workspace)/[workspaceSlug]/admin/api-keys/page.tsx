'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'revoked';
}

interface CreateKeyPayload {
  name: string;
  scopes: string[];
  expiresIn: string;
}

const SCOPES = [
  {
    value: 'read',
    label: 'Read',
    description: 'Read access to workspace data',
  },
  {
    value: 'write',
    label: 'Write',
    description: 'Create and modify workspace data',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full administrative access',
  },
] as const;

const EXPIRY_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: 'never', label: 'Never' },
] as const;

function getExpirationStatus(
  key: ApiKey
): 'active' | 'expired' | 'expiring-soon' | 'revoked' {
  if (key.status === 'revoked') return 'revoked';
  if (key.status === 'expired') return 'expired';

  if (key.expiresAt) {
    const expiresAt = new Date(key.expiresAt);
    const now = new Date();
    const daysUntilExpiry =
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry <= 0) return 'expired';
    if (daysUntilExpiry <= 14) return 'expiring-soon';
  }

  return 'active';
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatExpiresAt(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString();
}

function StatusBadge({ apiKey }: { apiKey: ApiKey }) {
  const effectiveStatus = getExpirationStatus(apiKey);

  if (effectiveStatus === 'active') {
    return (
      <Badge className='bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300'>
        Active
      </Badge>
    );
  }

  if (effectiveStatus === 'expiring-soon') {
    return (
      <Badge className='bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'>
        Expiring Soon
      </Badge>
    );
  }

  if (effectiveStatus === 'expired') {
    return (
      <Badge className='bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300'>
        Expired
      </Badge>
    );
  }

  return (
    <Badge variant='secondary' className='text-muted-foreground'>
      Revoked
    </Badge>
  );
}

export default function AdminApiKeysPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createScopes, setCreateScopes] = useState<string[]>(['read']);
  const [createExpiresIn, setCreateExpiresIn] = useState('never');

  useEffect(() => {
    setPageHeader('API Keys', 'Manage API keys for programmatic access');
  }, [setPageHeader]);

  const loadApiKeys = useCallback(async () => {
    if (!workspaceSlug) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys`);

      if (!response.ok) {
        // API may not exist yet - show empty state gracefully
        setApiKeys([]);
        return;
      }

      const json = await response.json();
      const keys = json.data ?? json.apiKeys ?? json ?? [];
      setApiKeys(Array.isArray(keys) ? keys : []);
    } catch {
      // API endpoint may not exist yet — degrade gracefully
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleScopeToggle = (scope: string, checked: boolean) => {
    setCreateScopes(prev =>
      checked ? [...prev, scope] : prev.filter(s => s !== scope)
    );
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this API key.',
        variant: 'destructive',
      });
      return;
    }

    if (createScopes.length === 0) {
      toast({
        title: 'Scopes required',
        description: 'Please select at least one scope.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      const payload: CreateKeyPayload = {
        name: createName.trim(),
        scopes: createScopes,
        expiresIn: createExpiresIn,
      };

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const json = await response.json();
      const fullKey: string = json.key ?? json.data?.key ?? '';

      setIsCreateOpen(false);
      setCreateName('');
      setCreateScopes(['read']);
      setCreateExpiresIn('never');

      await loadApiKeys();

      if (fullKey) {
        setNewKeyValue(fullKey);
      } else {
        toast({
          title: 'API key created',
          description: 'Your new API key has been created successfully.',
        });
      }
    } catch {
      toast({
        title: 'Failed to create API key',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    try {
      setIsRevoking(true);

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/api-keys/${revokeTarget.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      toast({
        title: 'API key revoked',
        description: `"${revokeTarget.name}" has been revoked.`,
      });

      setRevokeTarget(null);
      await loadApiKeys();
    } catch {
      toast({
        title: 'Failed to revoke API key',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyPrefix = async (key: ApiKey) => {
    try {
      await navigator.clipboard.writeText(key.prefix);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyFullKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const activeKeys = apiKeys.filter(k => getExpirationStatus(k) === 'active');
  const expiringSoonKeys = apiKeys.filter(
    k => getExpirationStatus(k) === 'expiring-soon'
  );

  return (
    <div className='flex flex-col gap-6'>
      {/* Summary cards */}
      <div className='grid gap-4 sm:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Keys</CardTitle>
            <Key className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>{apiKeys.length}</p>
            <p className='text-xs text-muted-foreground'>
              {activeKeys.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Expiring Soon</CardTitle>
            <AlertTriangle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'text-2xl font-bold',
                expiringSoonKeys.length > 0 && 'text-yellow-600'
              )}
            >
              {expiringSoonKeys.length}
            </p>
            <p className='text-xs text-muted-foreground'>Within 14 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Active Keys</CardTitle>
            <Check className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>{activeKeys.length}</p>
            <p className='text-xs text-muted-foreground'>
              {apiKeys.length - activeKeys.length} inactive
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Keys table */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Keys provide programmatic access to your workspace. Revoke any
                key that is no longer needed.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Key className='mb-4 h-12 w-12 text-muted-foreground' />
              <h3 className='mb-1 text-lg font-semibold'>No API keys</h3>
              <p className='mb-6 max-w-sm text-sm text-muted-foreground'>
                Create an API key to start accessing your workspace
                programmatically.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className='mr-2 h-4 w-4' />
                Create Key
              </Button>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map(apiKey => (
                    <TableRow key={apiKey.id}>
                      <TableCell className='font-medium'>
                        {apiKey.name}
                      </TableCell>

                      <TableCell>
                        <div className='flex items-center gap-1.5'>
                          <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-xs'>
                            {apiKey.prefix}...
                          </code>
                          <button
                            type='button'
                            onClick={() => handleCopyPrefix(apiKey)}
                            className='rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                            title='Copy prefix'
                          >
                            {copiedKeyId === apiKey.id ? (
                              <Check className='h-3.5 w-3.5 text-green-500' />
                            ) : (
                              <Copy className='h-3.5 w-3.5' />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className='flex flex-wrap gap-1'>
                          {apiKey.scopes.map(scope => (
                            <Badge
                              key={scope}
                              variant='outline'
                              className='text-xs'
                            >
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className='text-sm text-muted-foreground'>
                        {formatRelativeDate(apiKey.createdAt)}
                      </TableCell>

                      <TableCell className='text-sm text-muted-foreground'>
                        {apiKey.lastUsedAt
                          ? formatRelativeDate(apiKey.lastUsedAt)
                          : 'Never'}
                      </TableCell>

                      <TableCell className='text-sm text-muted-foreground'>
                        {formatExpiresAt(apiKey.expiresAt)}
                      </TableCell>

                      <TableCell>
                        <StatusBadge apiKey={apiKey} />
                      </TableCell>

                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                          disabled={apiKey.status === 'revoked'}
                          onClick={() => setRevokeTarget(apiKey)}
                        >
                          <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create key dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Configure a new API key for programmatic access.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-5 py-2'>
            <div className='space-y-2'>
              <Label htmlFor='key-name'>Name</Label>
              <Input
                id='key-name'
                placeholder='e.g. Production CI'
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
              <p className='text-xs text-muted-foreground'>
                A descriptive name to identify this key.
              </p>
            </div>

            <div className='space-y-3'>
              <Label>Scopes</Label>
              {SCOPES.map(scope => (
                <div key={scope.value} className='flex items-start gap-3'>
                  <Checkbox
                    id={`scope-${scope.value}`}
                    checked={createScopes.includes(scope.value)}
                    onCheckedChange={checked =>
                      handleScopeToggle(scope.value, !!checked)
                    }
                    className='mt-0.5'
                  />
                  <div className='flex-1'>
                    <label
                      htmlFor={`scope-${scope.value}`}
                      className='cursor-pointer text-sm font-medium leading-none'
                    >
                      {scope.label}
                    </label>
                    <p className='mt-0.5 text-xs text-muted-foreground'>
                      {scope.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='key-expiry'>Expiration</Label>
              <Select
                value={createExpiresIn}
                onValueChange={setCreateExpiresIn}
              >
                <SelectTrigger id='key-expiry'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New key reveal dialog */}
      <Dialog
        open={newKeyValue !== null}
        onOpenChange={open => {
          if (!open) setNewKeyValue(null);
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Save Your API Key</DialogTitle>
            <DialogDescription>
              Copy this key now. For security reasons, it will not be shown
              again.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='flex items-start gap-2 rounded-lg border bg-muted p-3'>
              <code className='flex-1 break-all font-mono text-sm'>
                {newKeyValue}
              </code>
              <Button
                variant='ghost'
                size='icon'
                className='mt-0.5 h-8 w-8 shrink-0'
                onClick={() => newKeyValue && handleCopyFullKey(newKeyValue)}
              >
                <Copy className='h-4 w-4' />
              </Button>
            </div>

            <div
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3',
                'border-yellow-500/40 bg-yellow-500/10'
              )}
            >
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400' />
              <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                Store this key in a secure location such as an environment
                variable or a secrets manager. It cannot be recovered.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewKeyValue(null)}>
              <Check className='mr-2 h-4 w-4' />I have saved my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={open => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Any integrations using this key will
              immediately lose access.
            </DialogDescription>
          </DialogHeader>

          {revokeTarget && (
            <div className='rounded-lg border bg-muted px-3 py-2'>
              <p className='text-sm font-medium'>{revokeTarget.name}</p>
              <code className='font-mono text-xs text-muted-foreground'>
                {revokeTarget.prefix}...
              </code>
            </div>
          )}

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setRevokeTarget(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Revoking...
                </>
              ) : (
                'Revoke Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
