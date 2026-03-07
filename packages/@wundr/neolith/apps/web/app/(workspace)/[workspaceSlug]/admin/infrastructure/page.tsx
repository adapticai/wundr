'use client';

import {
  AlertCircle,
  CheckCircle2,
  Network,
  Plus,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DaemonNodeCard } from '@/components/infrastructure/daemon-node-card';
import { FederationTopology } from '@/components/infrastructure/federation-topology';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
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

import type { DaemonNodeStatus } from '@/components/infrastructure/daemon-node-card';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DaemonNode {
  id: string;
  name: string;
  hostname: string;
  port: number;
  status: DaemonNodeStatus;
  capabilities: string[];
  region: string;
  orchestratorIds: string[];
  health: {
    cpuUsage: number;
    memoryUsage: number;
    activeSessions: number;
  };
  lastHeartbeat: string | null;
  createdAt: string;
}

interface TaskDelegation {
  id: string;
  fromOrchestratorId: string;
  toOrchestratorId: string;
  taskType: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface RegisterFormState {
  hostname: string;
  port: string;
  name: string;
  region: string;
  capabilities: string;
}

const EMPTY_FORM: RegisterFormState = {
  hostname: '',
  port: '8080',
  name: '',
  region: 'default',
  capabilities: '',
};

// ─── Status summary ────────────────────────────────────────────────────────────

function statusCounts(nodes: DaemonNode[]) {
  return nodes.reduce(
    (acc, n) => {
      acc[n.status] = (acc[n.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

function DelegationStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    COMPLETED: 'default',
    PENDING: 'outline',
    IN_PROGRESS: 'secondary',
    FAILED: 'destructive',
    CANCELLED: 'secondary',
  };
  return (
    <Badge variant={variants[status] ?? 'secondary'} className='text-xs'>
      {status}
    </Badge>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InfrastructurePage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  // State
  const [nodes, setNodes] = useState<DaemonNode[]>([]);
  const [delegations, setDelegations] = useState<TaskDelegation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDelegations, setIsLoadingDelegations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);
  const [isRegistering, setIsRegistering] = useState(false);
  const [healthCheckId, setHealthCheckId] = useState<string | null>(null);

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Infrastructure',
      'Manage federated orchestrator daemon nodes and task delegations'
    );
  }, [setPageHeader]);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchNodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/daemons`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? 'Failed to load daemon nodes'
        );
      }
      const data = await res.json();
      setNodes((data as { data: DaemonNode[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug]);

  const fetchDelegations = useCallback(async () => {
    setIsLoadingDelegations(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/federation/delegations?limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setDelegations((data as { data: TaskDelegation[] }).data ?? []);
      }
    } catch {
      // Delegations are secondary — don't block the page on failure
    } finally {
      setIsLoadingDelegations(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void fetchNodes();
    void fetchDelegations();
  }, [fetchNodes, fetchDelegations]);

  // ── Health check ────────────────────────────────────────────────────────────

  const handleCheckHealth = useCallback(
    async (nodeId: string) => {
      setHealthCheckId(nodeId);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/daemons/${nodeId}/health`
        );
        const data = (await res.json()) as {
          reachable?: boolean;
          latencyMs?: number | null;
          error?: string;
        };

        if (data.reachable) {
          toast({
            title: 'Health check passed',
            description: `Node is reachable${data.latencyMs != null ? ` (${data.latencyMs}ms)` : ''}`,
          });
          // Refresh to pick up updated lastHeartbeat
          void fetchNodes();
        } else {
          toast({
            variant: 'destructive',
            title: 'Health check failed',
            description: data.error ?? 'Node did not respond',
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Health check error',
          description: 'Could not reach the daemon health endpoint',
        });
      } finally {
        setHealthCheckId(null);
      }
    },
    [workspaceSlug, fetchNodes, toast]
  );

  // ── Deregister ──────────────────────────────────────────────────────────────

  const handleDeregister = useCallback(
    async (nodeId: string) => {
      if (
        !confirm('Deregister this daemon node? This action cannot be undone.')
      ) {
        return;
      }
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/daemons/${nodeId}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? 'Failed to deregister'
          );
        }
        toast({ title: 'Daemon node deregistered' });
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Deregister failed',
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [workspaceSlug, toast, selectedNodeId]
  );

  // ── Register form ───────────────────────────────────────────────────────────

  const handleRegister = useCallback(async () => {
    if (!form.hostname.trim()) {
      toast({ variant: 'destructive', title: 'Hostname is required' });
      return;
    }
    const portNum = parseInt(form.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast({
        variant: 'destructive',
        title: 'Port must be between 1 and 65535',
      });
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/daemons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: form.hostname.trim(),
          port: portNum,
          name: form.name.trim() || undefined,
          region: form.region.trim() || 'default',
          capabilities: form.capabilities
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? 'Registration failed'
        );
      }

      toast({ title: 'Daemon node registered successfully' });
      setRegisterOpen(false);
      setForm(EMPTY_FORM);
      void fetchNodes();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsRegistering(false);
    }
  }, [form, workspaceSlug, fetchNodes, toast]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const counts = statusCounts(nodes);
  const onlineCount = counts['ONLINE'] ?? 0;
  const degradedCount = counts['DEGRADED'] ?? 0;
  const offlineCount = (counts['OFFLINE'] ?? 0) + (counts['MAINTENANCE'] ?? 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className='space-y-6'>
      {/* Header actions */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              void fetchNodes();
              void fetchDelegations();
            }}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
        <Button size='sm' onClick={() => setRegisterOpen(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Register Daemon
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      <div className='grid gap-4 sm:grid-cols-3'>
        <Card>
          <CardContent className='flex items-center gap-4 p-5'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950'>
              <CheckCircle2 className='h-5 w-5 text-green-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-foreground'>
                {onlineCount}
              </p>
              <p className='text-sm text-muted-foreground'>Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center gap-4 p-5'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950'>
              <AlertCircle className='h-5 w-5 text-yellow-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-foreground'>
                {degradedCount}
              </p>
              <p className='text-sm text-muted-foreground'>Degraded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center gap-4 p-5'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
              <XCircle className='h-5 w-5 text-muted-foreground' />
            </div>
            <div>
              <p className='text-2xl font-bold text-foreground'>
                {offlineCount}
              </p>
              <p className='text-sm text-muted-foreground'>
                Offline / Maintenance
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Federation topology */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Network className='h-4 w-4' />
            Federation Topology
          </CardTitle>
          <CardDescription>
            Visual representation of daemon nodes and their interconnections.
            Nodes sharing orchestrators are connected with lines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className='h-72 w-full' />
          ) : (
            <FederationTopology
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onNodeClick={setSelectedNodeId}
            />
          )}
        </CardContent>
      </Card>

      {/* Daemon node list */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Server className='h-4 w-4' />
            Daemon Nodes
            <Badge variant='secondary' className='ml-1'>
              {nodes.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Registered orchestrator daemon nodes across all machines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className='h-64 w-full' />
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className='rounded-lg border border-dashed border-border p-10 text-center'>
              <Server className='mx-auto mb-3 h-8 w-8 text-muted-foreground' />
              <p className='text-sm font-medium text-foreground'>
                No daemon nodes registered
              </p>
              <p className='mt-1 text-sm text-muted-foreground'>
                Register a daemon to connect remote orchestrator infrastructure.
              </p>
              <Button
                variant='outline'
                size='sm'
                className='mt-4'
                onClick={() => setRegisterOpen(true)}
              >
                <Plus className='mr-2 h-4 w-4' />
                Register Daemon
              </Button>
            </div>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {nodes.map(node => (
                <DaemonNodeCard
                  key={node.id}
                  {...node}
                  onCheckHealth={
                    healthCheckId === node.id ? undefined : handleCheckHealth
                  }
                  onDeregister={handleDeregister}
                  className={
                    selectedNodeId === node.id
                      ? 'ring-2 ring-primary ring-offset-2'
                      : ''
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task delegation history */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            Task Delegation History
            <Badge variant='secondary' className='ml-1'>
              {delegations.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Recent task delegations between federated orchestrator nodes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDelegations ? (
            <Skeleton className='h-40 w-full' />
          ) : delegations.length === 0 ? (
            <p className='py-8 text-center text-sm text-muted-foreground'>
              No task delegations recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className='font-mono text-xs'>
                      {d.taskType}
                    </TableCell>
                    <TableCell className='font-mono text-xs text-muted-foreground'>
                      {d.fromOrchestratorId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className='font-mono text-xs text-muted-foreground'>
                      {d.toOrchestratorId.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <DelegationStatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {new Date(d.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {d.completedAt
                        ? new Date(d.completedAt).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Register daemon dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Register Daemon Node</DialogTitle>
            <DialogDescription>
              Add a new orchestrator daemon running on a remote machine to this
              organisation&apos;s federation.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='grid grid-cols-4 items-center gap-3'>
              <Label className='text-right text-sm' htmlFor='reg-name'>
                Name
              </Label>
              <Input
                id='reg-name'
                className='col-span-3'
                placeholder='prod-daemon-01'
                value={form.name}
                onChange={e =>
                  setForm(prev => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-3'>
              <Label className='text-right text-sm' htmlFor='reg-host'>
                Hostname
                <span className='text-destructive'> *</span>
              </Label>
              <Input
                id='reg-host'
                className='col-span-3'
                placeholder='192.168.1.10 or daemon.example.com'
                value={form.hostname}
                onChange={e =>
                  setForm(prev => ({ ...prev, hostname: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-3'>
              <Label className='text-right text-sm' htmlFor='reg-port'>
                Port
                <span className='text-destructive'> *</span>
              </Label>
              <Input
                id='reg-port'
                type='number'
                min={1}
                max={65535}
                className='col-span-3'
                value={form.port}
                onChange={e =>
                  setForm(prev => ({ ...prev, port: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-3'>
              <Label className='text-right text-sm' htmlFor='reg-region'>
                Region
              </Label>
              <Input
                id='reg-region'
                className='col-span-3'
                placeholder='us-east-1'
                value={form.region}
                onChange={e =>
                  setForm(prev => ({ ...prev, region: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-3'>
              <Label className='text-right text-sm' htmlFor='reg-caps'>
                Capabilities
              </Label>
              <Input
                id='reg-caps'
                className='col-span-3'
                placeholder='code-generation, analysis (comma-separated)'
                value={form.capabilities}
                onChange={e =>
                  setForm(prev => ({ ...prev, capabilities: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setRegisterOpen(false);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleRegister();
              }}
              disabled={isRegistering}
            >
              {isRegistering ? 'Registering…' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
