'use client';

/**
 * API Keys Management Component
 *
 * Provides comprehensive UI for managing workspace API keys with:
 * - Key listing with search and filtering
 * - Create new keys with permission configuration
 * - Regenerate/revoke existing keys
 * - Usage analytics and statistics
 * - Rate limit configuration
 * - IP restrictions
 * - Expiry settings
 */

import { formatDistanceToNow } from 'date-fns';
import {
  PlusIcon,
  KeyIcon,
  TrashIcon,
  RefreshCwIcon,
  SettingsIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckIcon,
  MoreVerticalIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastFourChars: string;
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  ipRestrictions: string[];
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  usageStats: {
    totalRequests: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

interface ApiKeysManagementProps {
  workspaceSlug: string;
}

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read', description: 'View data and resources' },
  { value: 'write', label: 'Write', description: 'Create and modify data' },
  { value: 'delete', label: 'Delete', description: 'Delete resources' },
  { value: 'admin', label: 'Admin', description: 'Full administrative access' },
  { value: 'workflows', label: 'Workflows', description: 'Execute workflows' },
  { value: 'agents', label: 'Agents', description: 'Manage AI agents' },
];

export function ApiKeysManagement({ workspaceSlug }: ApiKeysManagementProps) {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyData, setNewKeyData] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Load API keys
  useEffect(() => {
    loadApiKeys();
  }, [workspaceSlug]);

  async function loadApiKeys() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys`);

      if (!response.ok) {
        throw new Error('Failed to load API keys');
      }

      const { data } = await response.json();
      setApiKeys(data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateKey(formData: FormData) {
    try {
      const name = formData.get('name') as string;
      const permissions = formData.getAll('permissions') as string[];
      const requestsPerMinute = parseInt(formData.get('requestsPerMinute') as string) || 60;
      const requestsPerHour = parseInt(formData.get('requestsPerHour') as string) || 3600;
      const requestsPerDay = parseInt(formData.get('requestsPerDay') as string) || 86400;
      const ipRestrictions = (formData.get('ipRestrictions') as string)
        .split(',')
        .map(ip => ip.trim())
        .filter(Boolean);
      const expiresIn = formData.get('expiresIn') as string;

      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          permissions,
          rateLimit: {
            requestsPerMinute,
            requestsPerHour,
            requestsPerDay,
          },
          ipRestrictions,
          expiresIn: expiresIn !== 'never' ? expiresIn : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const { data } = await response.json();
      setNewKeyData(data.key);
      await loadApiKeys();
      toast.success('API key created successfully');
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast.error('Failed to create API key');
    }
  }

  async function handleRegenerateKey(keyId: string) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys/${keyId}/regenerate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate API key');
      }

      const { data } = await response.json();
      setNewKeyData(data.key);
      await loadApiKeys();
      toast.success('API key regenerated successfully');
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
      toast.error('Failed to regenerate API key');
    }
  }

  async function handleRevokeKey(keyId: string) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      await loadApiKeys();
      toast.success('API key revoked successfully');
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      toast.error('Failed to revoke API key');
    }
  }

  async function handleUpdateKey(keyId: string, updates: Partial<ApiKey>) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update API key');
      }

      await loadApiKeys();
      setIsConfigDialogOpen(false);
      toast.success('API key updated successfully');
    } catch (error) {
      console.error('Failed to update API key:', error);
      toast.error('Failed to update API key');
    }
  }

  function toggleKeyVisibility(keyId: string) {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const totalRequests = apiKeys.reduce((sum, key) => sum + key.usageStats.totalRequests, 0);
  const activeKeys = apiKeys.filter(key => key.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
            <KeyIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeKeys} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.reduce((sum, key) => sum + key.usageStats.last24Hours, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              API requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your workspace
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    Configure a new API key with permissions and rate limits
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    await handleCreateKey(formData);
                  }}
                >
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="permissions">Permissions</TabsTrigger>
                      <TabsTrigger value="limits">Limits & Security</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Key Name</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Production API Key"
                          required
                        />
                        <p className="text-sm text-muted-foreground">
                          A descriptive name to identify this key
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expiresIn">Expiration</Label>
                        <Select name="expiresIn" defaultValue="never">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="30d">30 days</SelectItem>
                            <SelectItem value="90d">90 days</SelectItem>
                            <SelectItem value="180d">180 days</SelectItem>
                            <SelectItem value="1y">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="permissions" className="space-y-4">
                      <div className="space-y-3">
                        {PERMISSION_OPTIONS.map((permission) => (
                          <div key={permission.value} className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              name="permissions"
                              value={permission.value}
                              id={`perm-${permission.value}`}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label htmlFor={`perm-${permission.value}`} className="font-medium">
                                {permission.label}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="limits" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Rate Limits</Label>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="requestsPerMinute" className="text-xs">
                              Per Minute
                            </Label>
                            <Input
                              id="requestsPerMinute"
                              name="requestsPerMinute"
                              type="number"
                              defaultValue="60"
                              min="1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="requestsPerHour" className="text-xs">
                              Per Hour
                            </Label>
                            <Input
                              id="requestsPerHour"
                              name="requestsPerHour"
                              type="number"
                              defaultValue="3600"
                              min="1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="requestsPerDay" className="text-xs">
                              Per Day
                            </Label>
                            <Input
                              id="requestsPerDay"
                              name="requestsPerDay"
                              type="number"
                              defaultValue="86400"
                              min="1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ipRestrictions">IP Restrictions</Label>
                        <Input
                          id="ipRestrictions"
                          name="ipRestrictions"
                          placeholder="192.168.1.1, 10.0.0.0/24"
                        />
                        <p className="text-sm text-muted-foreground">
                          Comma-separated list of allowed IP addresses or CIDR ranges (optional)
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create API Key</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCwIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <KeyIcon className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No API keys yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first API key to start accessing the API programmatically
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Usage (24h)</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {visibleKeys.has(apiKey.id)
                            ? apiKey.key
                            : `${'•'.repeat(20)}${apiKey.lastFourChars}`}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                        >
                          {visibleKeys.has(apiKey.id) ? (
                            <EyeOffIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(apiKey.key)}
                        >
                          <CopyIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions.slice(0, 2).map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {apiKey.permissions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{apiKey.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {apiKey.usageStats.last24Hours.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {apiKey.rateLimit.requestsPerDay.toLocaleString()} limit
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {apiKey.lastUsedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {apiKey.isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedKey(apiKey);
                              setIsConfigDialogOpen(true);
                            }}
                          >
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRegenerateKey(apiKey.id)}
                          >
                            <RefreshCwIcon className="mr-2 h-4 w-4" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  'Are you sure you want to revoke this API key? This action cannot be undone.',
                                )
                              ) {
                                handleRevokeKey(apiKey.id);
                              }
                            }}
                          >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Key Display Dialog */}
      <Dialog open={!!newKeyData} onOpenChange={(open) => !open && setNewKeyData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Make sure to copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-4">
              <code className="flex-1 break-all text-sm">{newKeyData}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(newKeyData!)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-amber-500" />
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This is the only time you'll see this key. Store it securely.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyData(null)}>
              <CheckIcon className="mr-2 h-4 w-4" />
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configuration Dialog */}
      {selectedKey && (
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure API Key</DialogTitle>
              <DialogDescription>
                Update permissions, rate limits, and security settings
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="permissions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="limits">Rate Limits</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              <TabsContent value="permissions" className="space-y-4">
                <div className="space-y-3">
                  {PERMISSION_OPTIONS.map((permission) => (
                    <div key={permission.value} className="flex items-start space-x-3">
                      <Switch
                        id={`config-perm-${permission.value}`}
                        checked={selectedKey.permissions.includes(permission.value)}
                        onCheckedChange={(checked) => {
                          const updatedPermissions = checked
                            ? [...selectedKey.permissions, permission.value]
                            : selectedKey.permissions.filter((p) => p !== permission.value);
                          setSelectedKey({
                            ...selectedKey,
                            permissions: updatedPermissions,
                          });
                        }}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`config-perm-${permission.value}`}
                          className="font-medium"
                        >
                          {permission.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="limits" className="space-y-4">
                <div className="space-y-2">
                  <Label>Rate Limits</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="config-rpm" className="text-xs">
                        Per Minute
                      </Label>
                      <Input
                        id="config-rpm"
                        type="number"
                        value={selectedKey.rateLimit.requestsPerMinute}
                        onChange={(e) =>
                          setSelectedKey({
                            ...selectedKey,
                            rateLimit: {
                              ...selectedKey.rateLimit,
                              requestsPerMinute: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="config-rph" className="text-xs">
                        Per Hour
                      </Label>
                      <Input
                        id="config-rph"
                        type="number"
                        value={selectedKey.rateLimit.requestsPerHour}
                        onChange={(e) =>
                          setSelectedKey({
                            ...selectedKey,
                            rateLimit: {
                              ...selectedKey.rateLimit,
                              requestsPerHour: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="config-rpd" className="text-xs">
                        Per Day
                      </Label>
                      <Input
                        id="config-rpd"
                        type="number"
                        value={selectedKey.rateLimit.requestsPerDay}
                        onChange={(e) =>
                          setSelectedKey({
                            ...selectedKey,
                            rateLimit: {
                              ...selectedKey.rateLimit,
                              requestsPerDay: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Usage Statistics</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">Last 24h</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          {selectedKey.usageStats.last24Hours.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">Last 7d</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          {selectedKey.usageStats.last7Days.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">Last 30d</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          {selectedKey.usageStats.last30Days.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="config-ip">IP Restrictions</Label>
                  <Input
                    id="config-ip"
                    placeholder="192.168.1.1, 10.0.0.0/24"
                    value={selectedKey.ipRestrictions.join(', ')}
                    onChange={(e) =>
                      setSelectedKey({
                        ...selectedKey,
                        ipRestrictions: e.target.value
                          .split(',')
                          .map((ip) => ip.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Comma-separated list of allowed IP addresses or CIDR ranges
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Active Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable this API key
                    </p>
                  </div>
                  <Switch
                    checked={selectedKey.isActive}
                    onCheckedChange={(checked) =>
                      setSelectedKey({ ...selectedKey, isActive: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedKey.createdAt).toLocaleString()}
                  </p>
                </div>

                {selectedKey.expiresAt && (
                  <div className="space-y-2">
                    <Label>Expires</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedKey.expiresAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  handleUpdateKey(selectedKey.id, {
                    permissions: selectedKey.permissions,
                    rateLimit: selectedKey.rateLimit,
                    ipRestrictions: selectedKey.ipRestrictions,
                    isActive: selectedKey.isActive,
                  })
                }
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
