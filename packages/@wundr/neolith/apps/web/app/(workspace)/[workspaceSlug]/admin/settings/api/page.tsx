'use client';

import {
  Key,
  Copy,
  Trash2,
  ExternalLink,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
}

interface ApiUsage {
  dailyLimit: number;
  dailyUsed: number;
  monthlyLimit: number;
  monthlyUsed: number;
  resetDate: string;
}

const AVAILABLE_SCOPES = [
  {
    value: 'read:files',
    label: 'Read Files',
    description: 'Read file contents and metadata',
  },
  {
    value: 'write:files',
    label: 'Write Files',
    description: 'Create, update, and delete files',
  },
  {
    value: 'read:messages',
    label: 'Read Messages',
    description: 'Access message history',
  },
  {
    value: 'write:messages',
    label: 'Write Messages',
    description: 'Send messages',
  },
  {
    value: 'read:members',
    label: 'Read Members',
    description: 'View workspace members',
  },
  {
    value: 'write:members',
    label: 'Manage Members',
    description: 'Invite and manage members',
  },
];

/**
 * API Settings Admin Page
 *
 * Manage API access for the workspace:
 * - Create and manage API keys
 * - Configure scopes and permissions
 * - Monitor API usage and limits
 */
export default function ApiSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  // Set page header
  useEffect(() => {
    setPageHeader('API Settings', 'Manage API keys and access permissions');
  }, [setPageHeader]);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Load API keys and usage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [keysRes, usageRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceSlug}/api-keys`),
          fetch(`/api/workspaces/${workspaceSlug}/api-keys/usage`),
        ]);

        if (!keysRes.ok || !usageRes.ok) {
          throw new Error('Failed to load API data');
        }

        const [keysData, usageData] = await Promise.all([
          keysRes.json(),
          usageRes.json(),
        ]);

        setApiKeys(Array.isArray(keysData) ? keysData : keysData.data || []);
        setUsage(usageData);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load API data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [workspaceSlug, toast]);

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim() || selectedScopes.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and select at least one scope',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newKeyName,
            permissions: selectedScopes,
            rateLimit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000,
              requestsPerDay: 10000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const data = await response.json();

      const newKey = data.apiKey || data.data || data;
      setApiKeys(prev => [...prev, newKey]);
      setCreatedKey(newKey.key);
      setNewKeyName('');
      setSelectedScopes([]);

      toast({
        title: 'Success',
        description: 'API key created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }, [newKeyName, selectedScopes, workspaceSlug, toast]);

  const handleRevokeKey = useCallback(
    async (keyId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/api-keys/${keyId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to revoke API key');
        }

        setApiKeys(prev => prev.filter(key => key.id !== keyId));

        toast({
          title: 'Success',
          description: 'API key revoked successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to revoke API key',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast]
  );

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
      });
    },
    [toast]
  );

  const toggleScope = useCallback((scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const usagePercentageDaily = usage
    ? (usage.dailyUsed / usage.dailyLimit) * 100
    : 0;
  const usagePercentageMonthly = usage
    ? (usage.monthlyUsed / usage.monthlyLimit) * 100
    : 0;

  return (
    <div className='space-y-6'>
      {/* API Usage Statistics */}
      {usage && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <div className='flex items-center gap-2'>
              <BarChart3 className='h-5 w-5 text-muted-foreground' />
              <h2 className='text-lg font-semibold text-foreground'>
                API Usage
              </h2>
            </div>
            <p className='text-sm text-muted-foreground'>
              Monitor your API request usage and limits
            </p>
          </div>

          <div className='grid gap-6 p-6 sm:grid-cols-2'>
            {/* Daily Usage */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-foreground'>
                  Daily Usage
                </span>
                <span className='text-sm text-muted-foreground'>
                  {usage.dailyUsed.toLocaleString()} /{' '}
                  {usage.dailyLimit.toLocaleString()}
                </span>
              </div>
              <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn(
                    'h-full transition-all',
                    usagePercentageDaily > 90
                      ? 'bg-red-500'
                      : usagePercentageDaily > 70
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(usagePercentageDaily, 100)}%` }}
                />
              </div>
            </div>

            {/* Monthly Usage */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-foreground'>
                  Monthly Usage
                </span>
                <span className='text-sm text-muted-foreground'>
                  {usage.monthlyUsed.toLocaleString()} /{' '}
                  {usage.monthlyLimit.toLocaleString()}
                </span>
              </div>
              <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn(
                    'h-full transition-all',
                    usagePercentageMonthly > 90
                      ? 'bg-red-500'
                      : usagePercentageMonthly > 70
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(usagePercentageMonthly, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <Key className='h-5 w-5 text-muted-foreground' />
                <h2 className='text-lg font-semibold text-foreground'>
                  API Keys
                </h2>
              </div>
              <p className='text-sm text-muted-foreground'>
                Create and manage API keys for workspace access
              </p>
            </div>
            <button
              type='button'
              onClick={() => setShowCreateForm(!showCreateForm)}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'
            >
              Create API Key
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className='border-b bg-muted/30 p-6'>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Key Name
                </label>
                <input
                  type='text'
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder='e.g., Production API Key'
                  className={cn(
                    'block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm placeholder:text-muted-foreground',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  )}
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground mb-3'>
                  Scopes
                </label>
                <div className='space-y-2'>
                  {AVAILABLE_SCOPES.map(scope => (
                    <label
                      key={scope.value}
                      className='flex items-start gap-3 rounded-md border bg-card p-3 cursor-pointer hover:bg-accent'
                    >
                      <input
                        type='checkbox'
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className='mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary'
                      />
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground'>
                          {scope.label}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {scope.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className='flex items-center gap-3 pt-2'>
                <button
                  type='button'
                  onClick={handleCreateKey}
                  disabled={
                    isCreating ||
                    !newKeyName.trim() ||
                    selectedScopes.length === 0
                  }
                  className={cn(
                    'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                    'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {isCreating ? 'Creating...' : 'Create Key'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewKeyName('');
                    setSelectedScopes([]);
                    setCreatedKey(null);
                  }}
                  className='rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent'
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Show created key */}
            {createdKey && (
              <div className='mt-4 rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-900/10'>
                <div className='flex items-start gap-3'>
                  <AlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                      Save your API key
                    </p>
                    <p className='mt-1 text-sm text-yellow-700 dark:text-yellow-300'>
                      This is the only time you'll see this key. Store it
                      securely.
                    </p>
                    <div className='mt-3 flex items-center gap-2'>
                      <code className='flex-1 rounded bg-yellow-100 px-3 py-2 text-sm font-mono dark:bg-yellow-900/30'>
                        {createdKey}
                      </code>
                      <button
                        type='button'
                        onClick={() => copyToClipboard(createdKey, 'API key')}
                        className='rounded-md border border-yellow-600 bg-yellow-50 px-3 py-2 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50'
                      >
                        <Copy className='h-4 w-4 text-yellow-700 dark:text-yellow-300' />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Keys List */}
        <div className='p-6'>
          {apiKeys.length === 0 ? (
            <div className='py-12 text-center'>
              <Key className='mx-auto h-12 w-12 text-muted-foreground/50' />
              <p className='mt-4 text-sm text-muted-foreground'>
                No API keys yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='border-b'>
                  <tr>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Name
                    </th>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Key
                    </th>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Created
                    </th>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Last Used
                    </th>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Usage
                    </th>
                    <th className='pb-3 text-left font-medium text-foreground'>
                      Scopes
                    </th>
                    <th className='pb-3 text-right font-medium text-foreground'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(key => (
                    <tr key={key.id} className='border-b last:border-0'>
                      <td className='py-4'>
                        <span className='font-medium text-foreground'>
                          {key.name}
                        </span>
                      </td>
                      <td className='py-4'>
                        <div className='flex items-center gap-2'>
                          <code className='rounded bg-muted px-2 py-1 text-xs font-mono'>
                            {key.key.slice(0, 8)}...{key.key.slice(-4)}
                          </code>
                          <button
                            type='button'
                            onClick={() => copyToClipboard(key.key, 'API key')}
                            className='text-muted-foreground hover:text-foreground'
                          >
                            <Copy className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                      <td className='py-4 text-muted-foreground'>
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className='py-4 text-muted-foreground'>
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className='py-4 text-muted-foreground'>
                        {key.usageCount.toLocaleString()}
                      </td>
                      <td className='py-4'>
                        <div className='flex flex-wrap gap-1'>
                          {key.scopes.slice(0, 2).map(scope => (
                            <span
                              key={scope}
                              className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                            >
                              {scope}
                            </span>
                          ))}
                          {key.scopes.length > 2 && (
                            <span className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
                              +{key.scopes.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className='py-4 text-right'>
                        <button
                          type='button'
                          onClick={() => handleRevokeKey(key.id)}
                          className='inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='text-sm'>Revoke</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Documentation Link */}
      <div className='rounded-lg border bg-card p-6'>
        <div className='flex items-start gap-4'>
          <ExternalLink className='h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5' />
          <div className='flex-1'>
            <h3 className='font-semibold text-foreground'>API Documentation</h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              Learn how to integrate with our API, explore endpoints, and view
              code examples.
            </p>
            <a
              href='https://docs.wundr.ai/api'
              target='_blank'
              rel='noopener noreferrer'
              className='mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline'
            >
              View API Documentation
              <ExternalLink className='h-4 w-4' />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-6'>
          <div className='h-5 w-48 animate-pulse rounded bg-muted mb-4' />
          <div className='space-y-4'>
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}
