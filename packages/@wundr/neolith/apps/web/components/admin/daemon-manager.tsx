'use client';

import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DaemonCredential {
  id: string;
  orchestratorId: string;
  apiKey: string;
  hostname?: string;
  version?: string;
  capabilities: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

interface DaemonSession {
  id: string;
  daemonId: string;
  status: string;
  connectedAt: string;
  lastHeartbeat: string;
  hostname: string;
  version: string;
  ipAddress?: string;
}

interface DaemonMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  messagesProcessed?: number;
  activeConnections?: number;
  uptime?: number;
  errorCount?: number;
}

/**
 * Props for the DaemonManager component.
 */
export interface DaemonManagerProps {
  /** The workspace ID for daemon management */
  workspaceId: string;
  /** The Orchestrator ID to manage daemons for */
  orchestratorId: string;
  /** Display name of the Orchestrator */
  orchestratorName: string;
  /** Additional CSS classes to apply */
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  connected: 'bg-green-400',
  authenticated: 'bg-stone-500',
  idle: 'bg-yellow-500',
  connecting: 'bg-stone-400',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
};

export function DaemonManager({
  workspaceId,
  orchestratorId,
  orchestratorName,
  className,
}: DaemonManagerProps) {
  const [credentials, setCredentials] = useState<DaemonCredential[]>([]);
  const [sessions, setSessions] = useState<Record<string, DaemonSession[]>>({});
  const [metrics, setMetrics] = useState<Record<string, DaemonMetrics>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showNewCredential, setShowNewCredential] = useState<{
    apiKey: string;
    apiSecret: string;
  } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/daemons?orchestratorId=${orchestratorId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCredentials(data.credentials || []);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, orchestratorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch sessions and metrics for each credential
  useEffect(() => {
    const fetchSessionsAndMetrics = async () => {
      for (const cred of credentials) {
        try {
          const [sessionsRes, metricsRes] = await Promise.all([
            fetch(
              `/api/workspaces/${workspaceId}/admin/daemons/${cred.id}/sessions`,
            ),
            fetch(
              `/api/workspaces/${workspaceId}/admin/daemons/${cred.id}/metrics`,
            ),
          ]);

          if (sessionsRes.ok) {
            const data = await sessionsRes.json();
            setSessions(prev => ({ ...prev, [cred.id]: data.sessions || [] }));
          }
          if (metricsRes.ok) {
            const data = await metricsRes.json();
            setMetrics(prev => ({ ...prev, [cred.id]: data }));
          }
        } catch {
          // Handle error
        }
      }
    };

    if (credentials.length > 0) {
      fetchSessionsAndMetrics();
    }
  }, [credentials, workspaceId]);

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/daemons`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orchestratorId,
            hostname: 'pending-setup',
            version: '1.0.0',
            capabilities: ['messaging', 'presence'],
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setShowNewCredential({
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
        });
        fetchData();
      }
    } catch {
      // Handle error
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRevoke = async (daemonId: string) => {
    if (
      !confirm(
        'Are you sure you want to revoke this daemon? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/daemons/${daemonId}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleToggleActive = async (daemonId: string, isActive: boolean) => {
    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/daemons/${daemonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleTerminateSession = async (
    daemonId: string,
    sessionId: string,
  ) => {
    try {
      await fetch(
        `/api/workspaces/${workspaceId}/admin/daemons/${daemonId}/sessions/${sessionId}`,
        { method: 'DELETE' },
      );
      setSessions(prev => ({
        ...prev,
        [daemonId]: prev[daemonId]?.filter(s => s.id !== sessionId) || [],
      }));
    } catch {
      // Handle error
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold text-foreground'>
            Daemon Credentials
          </h3>
          <p className='text-sm text-muted-foreground'>
            Manage machine authentication for {orchestratorName}
          </p>
        </div>
        <Button onClick={handleRegister} disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register New Daemon'}
        </Button>
      </div>

      {/* New credential modal */}
      <Dialog
        open={!!showNewCredential}
        onOpenChange={open => !open && setShowNewCredential(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daemon Registered Successfully</DialogTitle>
          </DialogHeader>
          <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4'>
            <p className='text-sm text-destructive font-medium'>
              Save these credentials now! The API Secret will not be shown
              again.
            </p>
          </div>
          <div className='space-y-3'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                API Key
              </label>
              <div className='mt-1 p-2 bg-muted rounded font-mono text-sm break-all'>
                {showNewCredential?.apiKey}
              </div>
            </div>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                API Secret
              </label>
              <div className='mt-1 p-2 bg-muted rounded font-mono text-sm break-all'>
                {showNewCredential?.apiSecret}
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowNewCredential(null)}
            className='mt-4 w-full'
          >
            I&apos;ve saved these credentials
          </Button>
        </DialogContent>
      </Dialog>

      {/* Credentials list */}
      {credentials.length === 0 ? (
        <div className='p-8 text-center bg-muted/50 rounded-lg'>
          <p className='text-muted-foreground'>
            No daemon credentials registered
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {credentials.map(cred => (
            <Card key={cred.id}>
              <CardContent className='pt-6'>
                <div className='flex items-start justify-between'>
                  <div>
                    <div className='flex items-center gap-2'>
                      <span className='font-mono text-sm text-foreground'>
                        {cred.apiKey}
                      </span>
                      <Badge variant={cred.isActive ? 'default' : 'secondary'}>
                        {cred.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className='mt-1 text-xs text-muted-foreground'>
                      {cred.hostname && <span>Host: {cred.hostname} • </span>}
                      {cred.version && <span>v{cred.version} • </span>}
                      Created: {new Date(cred.createdAt).toLocaleDateString()}
                      {cred.lastUsedAt && (
                        <span>
                          {' '}
                          • Last used:{' '}
                          {new Date(cred.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleToggleActive(cred.id, cred.isActive)}
                    >
                      {cred.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleRevoke(cred.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>

                {/* Capabilities */}
                {cred.capabilities.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {cred.capabilities.map(cap => (
                      <Badge key={cap} variant='secondary'>
                        {cap}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Sessions */}
                {sessions[cred.id]?.length > 0 && (
                  <div className='mt-4 pt-4 border-t border-border'>
                    <h4 className='text-sm font-medium text-foreground mb-2'>
                      Active Sessions
                    </h4>
                    <div className='space-y-2'>
                      {sessions[cred.id].map(session => (
                        <div
                          key={session.id}
                          className='flex items-center justify-between p-2 bg-muted rounded'
                        >
                          <div className='flex items-center gap-3'>
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                STATUS_COLORS[session.status] || 'bg-gray-400',
                              )}
                            />
                            <div>
                              <span className='text-sm text-foreground'>
                                {session.hostname}
                              </span>
                              <span className='text-xs text-muted-foreground ml-2'>
                                {session.ipAddress && `(${session.ipAddress})`}
                              </span>
                            </div>
                          </div>
                          <div className='flex items-center gap-3'>
                            <span className='text-xs text-muted-foreground'>
                              Last heartbeat:{' '}
                              {new Date(
                                session.lastHeartbeat,
                              ).toLocaleTimeString()}
                            </span>
                            <Button
                              variant='link'
                              size='sm'
                              onClick={() =>
                                handleTerminateSession(cred.id, session.id)
                              }
                              className='h-auto p-0 text-destructive'
                            >
                              Terminate
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {metrics[cred.id] && (
                  <div className='mt-4 pt-4 border-t border-border'>
                    <h4 className='text-sm font-medium text-foreground mb-2'>
                      Metrics
                    </h4>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                      {metrics[cred.id].cpuUsage !== undefined && (
                        <div className='p-2 bg-muted rounded'>
                          <p className='text-xs text-muted-foreground'>CPU</p>
                          <p className='text-sm font-medium text-foreground'>
                            {metrics[cred.id].cpuUsage?.toFixed(1)}%
                          </p>
                        </div>
                      )}
                      {metrics[cred.id].memoryUsage !== undefined && (
                        <div className='p-2 bg-muted rounded'>
                          <p className='text-xs text-muted-foreground'>
                            Memory
                          </p>
                          <p className='text-sm font-medium text-foreground'>
                            {metrics[cred.id].memoryUsage?.toFixed(1)}%
                          </p>
                        </div>
                      )}
                      {metrics[cred.id].messagesProcessed !== undefined && (
                        <div className='p-2 bg-muted rounded'>
                          <p className='text-xs text-muted-foreground'>
                            Messages
                          </p>
                          <p className='text-sm font-medium text-foreground'>
                            {metrics[
                              cred.id
                            ].messagesProcessed?.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {metrics[cred.id].errorCount !== undefined && (
                        <div className='p-2 bg-muted rounded'>
                          <p className='text-xs text-muted-foreground'>
                            Errors
                          </p>
                          <p className='text-sm font-medium text-foreground'>
                            {metrics[cred.id].errorCount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default DaemonManager;
