'use client';

import { clsx } from 'clsx';
import { useState, useEffect, useCallback } from 'react';

interface DaemonCredential {
  id: string;
  vpId: string;
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

export interface DaemonManagerProps {
  workspaceId: string;
  vpId: string;
  vpName: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  connected: 'bg-green-400',
  authenticated: 'bg-blue-500',
  idle: 'bg-yellow-500',
  connecting: 'bg-blue-400',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
};

export function DaemonManager({
  workspaceId,
  vpId,
  vpName,
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
        `/api/workspaces/${workspaceId}/admin/daemons?vpId=${vpId}`,
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
  }, [workspaceId, vpId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch sessions and metrics for each credential
  useEffect(() => {
    const fetchSessionsAndMetrics = async () => {
      for (const cred of credentials) {
        try {
          const [sessionsRes, metricsRes] = await Promise.all([
            fetch(`/api/workspaces/${workspaceId}/admin/daemons/${cred.id}/sessions`),
            fetch(`/api/workspaces/${workspaceId}/admin/daemons/${cred.id}/metrics`),
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
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/daemons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vpId,
          hostname: 'pending-setup',
          version: '1.0.0',
          capabilities: ['messaging', 'presence'],
        }),
      });

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
    if (!confirm('Are you sure you want to revoke this daemon? This action cannot be undone.')) {
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

  const handleTerminateSession = async (daemonId: string, sessionId: string) => {
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
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Daemon Credentials</h3>
          <p className="text-sm text-muted-foreground">
            Manage machine authentication for {vpName}
          </p>
        </div>
        <button
          onClick={handleRegister}
          disabled={isRegistering}
          className={clsx(
            'px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium',
            'disabled:opacity-50',
          )}
        >
          {isRegistering ? 'Registering...' : 'Register New Daemon'}
        </button>
      </div>

      {/* New credential modal */}
      {showNewCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Daemon Registered Successfully
            </h3>
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
              <p className="text-sm text-destructive font-medium">
                Save these credentials now! The API Secret will not be shown again.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">API Key</label>
                <div className="mt-1 p-2 bg-muted rounded font-mono text-sm break-all">
                  {showNewCredential.apiKey}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">API Secret</label>
                <div className="mt-1 p-2 bg-muted rounded font-mono text-sm break-all">
                  {showNewCredential.apiSecret}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowNewCredential(null)}
              className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              I&apos;ve saved these credentials
            </button>
          </div>
        </div>
      )}

      {/* Credentials list */}
      {credentials.length === 0 ? (
        <div className="p-8 text-center bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">No daemon credentials registered</p>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{cred.apiKey}</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 text-xs rounded',
                        cred.isActive
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {cred.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {cred.hostname && <span>Host: {cred.hostname} • </span>}
                    {cred.version && <span>v{cred.version} • </span>}
                    Created: {new Date(cred.createdAt).toLocaleDateString()}
                    {cred.lastUsedAt && (
                      <span> • Last used: {new Date(cred.lastUsedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(cred.id, cred.isActive)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm"
                  >
                    {cred.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleRevoke(cred.id)}
                    className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded text-sm"
                  >
                    Revoke
                  </button>
                </div>
              </div>

              {/* Capabilities */}
              {cred.capabilities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cred.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              {/* Sessions */}
              {sessions[cred.id]?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-2">Active Sessions</h4>
                  <div className="space-y-2">
                    {sessions[cred.id].map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={clsx(
                              'w-2 h-2 rounded-full',
                              STATUS_COLORS[session.status] || 'bg-gray-400',
                            )}
                          />
                          <div>
                            <span className="text-sm text-foreground">{session.hostname}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {session.ipAddress && `(${session.ipAddress})`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            Last heartbeat: {new Date(session.lastHeartbeat).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={() => handleTerminateSession(cred.id, session.id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Terminate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics */}
              {metrics[cred.id] && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-2">Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {metrics[cred.id].cpuUsage !== undefined && (
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">CPU</p>
                        <p className="text-sm font-medium text-foreground">
                          {metrics[cred.id].cpuUsage?.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {metrics[cred.id].memoryUsage !== undefined && (
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Memory</p>
                        <p className="text-sm font-medium text-foreground">
                          {metrics[cred.id].memoryUsage?.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {metrics[cred.id].messagesProcessed !== undefined && (
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Messages</p>
                        <p className="text-sm font-medium text-foreground">
                          {metrics[cred.id].messagesProcessed?.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {metrics[cred.id].errorCount !== undefined && (
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Errors</p>
                        <p className="text-sm font-medium text-foreground">
                          {metrics[cred.id].errorCount}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DaemonManager;
