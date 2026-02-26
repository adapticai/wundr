'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { TrafficDashboard } from '@/components/traffic-manager/traffic-dashboard';
import { RoutingPanel } from '@/components/traffic-manager/routing-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Orchestrator {
  id: string;
  name: string;
  discipline: string;
}

interface TrafficConfig {
  defaultAgentId: string;
  enableContentAnalysis: boolean;
  enableLoadBalancing: boolean;
  maxRoutingLatencyMs: number;
  escalationThreshold: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  fallbackBehavior: 'default_agent' | 'round_robin' | 'queue';
}

const ESCALATION_LEVELS = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'] as const;
const FALLBACK_OPTIONS = [
  { value: 'default_agent', label: 'Default Agent' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'queue', label: 'Queue' },
] as const;

const DEFAULT_CONFIG: TrafficConfig = {
  defaultAgentId: '',
  enableContentAnalysis: true,
  enableLoadBalancing: true,
  maxRoutingLatencyMs: 500,
  escalationThreshold: 'HIGH',
  fallbackBehavior: 'default_agent',
};

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

function SettingsTab({
  workspaceId,
  orchestrators,
}: {
  workspaceId: string;
  orchestrators: Orchestrator[];
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<TrafficConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/traffic-manager?workspaceId=${workspaceId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.data) setConfig({ ...DEFAULT_CONFIG, ...data.data });
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/traffic-manager?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ title: 'Settings saved', description: 'Traffic manager configuration updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Manager Configuration</CardTitle>
        <CardDescription>
          Configure how messages are routed across your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Agent */}
        <div className="space-y-2">
          <Label htmlFor="default-agent">Default Agent</Label>
          <Select
            value={config.defaultAgentId}
            onValueChange={val => setConfig(prev => ({ ...prev, defaultAgentId: val }))}
          >
            <SelectTrigger id="default-agent">
              <SelectValue placeholder="Select default agent" />
            </SelectTrigger>
            <SelectContent>
              {orchestrators.map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.discipline && (
                    <span className="ml-1 text-xs text-muted-foreground">({o.discipline})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Content Analysis</Label>
              <p className="text-sm text-muted-foreground">
                Analyse message content to improve routing accuracy.
              </p>
            </div>
            <Switch
              checked={config.enableContentAnalysis}
              onCheckedChange={val =>
                setConfig(prev => ({ ...prev, enableContentAnalysis: val }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Load Balancing</Label>
              <p className="text-sm text-muted-foreground">
                Distribute messages evenly across available agents.
              </p>
            </div>
            <Switch
              checked={config.enableLoadBalancing}
              onCheckedChange={val =>
                setConfig(prev => ({ ...prev, enableLoadBalancing: val }))
              }
            />
          </div>
        </div>

        {/* Max Latency */}
        <div className="space-y-2">
          <Label htmlFor="max-latency">Max Routing Latency (ms)</Label>
          <Input
            id="max-latency"
            type="number"
            min={0}
            value={config.maxRoutingLatencyMs}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                maxRoutingLatencyMs: Number(e.target.value),
              }))
            }
            className="max-w-xs"
          />
        </div>

        {/* Escalation Threshold */}
        <div className="space-y-2">
          <Label htmlFor="escalation-threshold">Escalation Threshold</Label>
          <Select
            value={config.escalationThreshold}
            onValueChange={val =>
              setConfig(prev => ({
                ...prev,
                escalationThreshold: val as TrafficConfig['escalationThreshold'],
              }))
            }
          >
            <SelectTrigger id="escalation-threshold" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESCALATION_LEVELS.map(level => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fallback Behavior */}
        <div className="space-y-2">
          <Label htmlFor="fallback-behavior">Fallback Behavior</Label>
          <Select
            value={config.fallbackBehavior}
            onValueChange={val =>
              setConfig(prev => ({
                ...prev,
                fallbackBehavior: val as TrafficConfig['fallbackBehavior'],
              }))
            }
          >
            <SelectTrigger id="fallback-behavior" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FALLBACK_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrafficManagerPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspaceId, setWorkspaceId] = useState('');
  const [orchestrators, setOrchestrators] = useState<Orchestrator[]>([]);

  useEffect(() => {
    if (!workspaceSlug) return;
    fetch(`/api/workspaces/${workspaceSlug}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const id = data?.data?.id ?? data?.id ?? '';
        setWorkspaceId(id);
        if (id) {
          fetch(`/api/traffic-manager/agents?workspaceId=${id}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => setOrchestrators(d?.data ?? []))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [workspaceSlug]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Traffic Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor routing activity, manage rules, and configure how messages are
          dispatched to agents across your workspace.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          {workspaceId ? (
            <TrafficDashboard workspaceId={workspaceId} />
          ) : (
            <div className="flex items-center justify-center p-12">
              <div className="text-muted-foreground">Loading workspace...</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="routing" className="mt-6">
          {workspaceId ? (
            <RoutingPanel workspaceId={workspaceId} agents={orchestrators} />
          ) : (
            <div className="flex items-center justify-center p-12">
              <div className="text-muted-foreground">Loading workspace...</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTab workspaceId={workspaceId} orchestrators={orchestrators} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
