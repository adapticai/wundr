'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentStatus {
  id: string;
  name: string;
  discipline: string;
  seniority: string;
  status: 'available' | 'busy' | 'offline' | 'maintenance';
  currentLoad: number;
  messagesHandled: number;
  lastActiveAt: string | null;
}

interface TrafficMetrics {
  totalMessagesRouted: number;
  averageRoutingLatencyMs: number;
  messagesPerMinute: number;
  escalationRate: number;
  fallbackRate: number;
  routingMethodDistribution: Record<string, number>;
  agentUtilization: Record<string, number>;
}

interface RecentDecision {
  id: string;
  timestamp: string;
  channelId: string;
  senderId: string;
  agentName: string;
  confidence: number;
  matchedBy: string;
}

interface TrafficDashboardProps {
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
  maintenance: 'bg-blue-500',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Online',
  busy: 'Busy',
  offline: 'Offline',
  maintenance: 'Maintenance',
};

const METHOD_COLORS: Record<string, string> = {
  direct_mention: 'bg-purple-500',
  thread_continuity: 'bg-blue-500',
  binding_rule: 'bg-indigo-500',
  discipline_match: 'bg-green-500',
  seniority_escalation: 'bg-orange-500',
  load_balance: 'bg-teal-500',
  fallback: 'bg-gray-500',
};

const METHOD_LABELS: Record<string, string> = {
  direct_mention: 'Direct Mention',
  thread_continuity: 'Thread Continuity',
  binding_rule: 'Binding Rule',
  discipline_match: 'Discipline Match',
  seniority_escalation: 'Escalation',
  load_balance: 'Load Balance',
  fallback: 'Fallback',
};

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8)
    return <Badge variant="default" className="bg-green-600">{(confidence * 100).toFixed(0)}%</Badge>;
  if (confidence >= 0.5)
    return <Badge variant="default" className="bg-yellow-600">{(confidence * 100).toFixed(0)}%</Badge>;
  return <Badge variant="destructive">{(confidence * 100).toFixed(0)}%</Badge>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrafficDashboard({ workspaceId }: TrafficDashboardProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [metrics, setMetrics] = useState<TrafficMetrics | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, metricsRes] = await Promise.all([
        fetch(`/api/traffic-manager/agents?workspaceId=${workspaceId}`),
        fetch(`/api/traffic-manager/metrics?workspaceId=${workspaceId}`),
      ]);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.data ?? []);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.data ?? null);
        setRecentDecisions(metricsData.data?.recentDecisions ?? []);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading traffic manager...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalDistribution = metrics
    ? Object.values(metrics.routingMethodDistribution).reduce(
        (a, b) => a + b,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Messages / min</CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.messagesPerMinute.toFixed(1) ?? '0'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Latency</CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.averageRoutingLatencyMs.toFixed(0) ?? '0'}ms
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Escalation Rate</CardDescription>
            <CardTitle className="text-2xl">
              {((metrics?.escalationRate ?? 0) * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fallback Rate</CardDescription>
            <CardTitle className="text-2xl">
              {((metrics?.fallbackRate ?? 0) * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Agent Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
          <CardDescription>
            {agents.filter((a) => a.status === 'available').length} of{' '}
            {agents.length} agents online
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div
                  className={`h-3 w-3 rounded-full ${STATUS_COLORS[agent.status] ?? 'bg-gray-400'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {agent.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {agent.discipline}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress
                      value={agent.currentLoad * 100}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-xs text-muted-foreground">
                      {(agent.currentLoad * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{STATUS_LABELS[agent.status]}</span>
                    <span>&middot;</span>
                    <span>{agent.messagesHandled} handled</span>
                  </div>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No agents registered
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Routing Distribution */}
      {metrics && totalDistribution > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Routing Distribution</CardTitle>
            <CardDescription>
              How messages are being routed ({metrics.totalMessagesRouted} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(metrics.routingMethodDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([method, count]) => {
                  const pct =
                    totalDistribution > 0
                      ? (count / totalDistribution) * 100
                      : 0;
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <span className="w-36 text-sm truncate">
                        {METHOD_LABELS[method] ?? method}
                      </span>
                      <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded ${METHOD_COLORS[method] ?? 'bg-gray-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm text-muted-foreground">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Decisions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Routing Decisions</CardTitle>
          <CardDescription>Last 20 message routing decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Routed To</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDecisions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(d.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.channelId}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.agentName}</TableCell>
                  <TableCell>{confidenceBadge(d.confidence)}</TableCell>
                  <TableCell className="text-xs">
                    {METHOD_LABELS[d.matchedBy] ?? d.matchedBy}
                  </TableCell>
                </TableRow>
              ))}
              {recentDecisions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No routing decisions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
