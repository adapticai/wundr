'use client';

import { clsx } from 'clsx';
import { useState, useEffect, useCallback } from 'react';

interface RetentionPolicy {
  id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isDefault: boolean;
  rules: Array<{
    id: string;
    resourceType: string;
    action: 'delete' | 'archive' | 'anonymize';
    retentionDays: number;
  }>;
}

interface RetentionStats {
  totalStorageBytes: number;
  itemCounts: Record<string, number>;
  pendingDeletions: number;
  lastJobRun?: string;
}

/**
 * Props for the RetentionSettings component.
 */
export interface RetentionSettingsProps {
  /** The workspace ID to manage retention policies for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

const RESOURCE_TYPES = [
  { value: 'message', label: 'Messages' },
  { value: 'file', label: 'Files' },
  { value: 'channel', label: 'Archived Channels' },
  { value: 'thread', label: 'Threads' },
  { value: 'call_recording', label: 'Call Recordings' },
  { value: 'audit_log', label: 'Audit Logs' },
];

const ACTIONS = [
  { value: 'delete', label: 'Delete permanently' },
  { value: 'archive', label: 'Archive' },
  { value: 'anonymize', label: 'Anonymize (remove PII)' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
return `${bytes} B`;
}
  if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
  if (bytes < 1024 * 1024 * 1024) {
return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function RetentionSettings({ workspaceId, className }: RetentionSettingsProps) {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [policiesRes, statsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/admin/retention/policies`),
        fetch(`/api/workspaces/${workspaceId}/admin/retention/stats`),
      ]);

      if (policiesRes.ok) {
        const data = await policiesRes.json();
        setPolicies(data.policies || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePolicy = async (policy: Partial<RetentionPolicy>) => {
    const url = policy.id
      ? `/api/workspaces/${workspaceId}/admin/retention/policies/${policy.id}`
      : `/api/workspaces/${workspaceId}/admin/retention/policies`;

    const response = await fetch(url, {
      method: policy.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });

    if (response.ok) {
      setEditingPolicy(null);
      setIsCreating(false);
      fetchData();
    }
  };

  const handleRunJob = async (policyId: string) => {
    await fetch(`/api/workspaces/${workspaceId}/admin/retention/policies/${policyId}/run`, {
      method: 'POST',
    });
    fetchData();
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
      {/* Storage Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Total Storage</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatBytes(stats.totalStorageBytes)}
            </p>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Messages</p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.itemCounts.message?.toLocaleString() || 0}
            </p>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Files</p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.itemCounts.file?.toLocaleString() || 0}
            </p>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Pending Deletions</p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.pendingDeletions.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Policies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Retention Policies</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            Create Policy
          </button>
        </div>

        {policies.length === 0 ? (
          <div className="p-8 text-center bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">No retention policies configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="p-4 bg-card border border-border rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{policy.name}</h4>
                      {policy.isDefault && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          Default
                        </span>
                      )}
                      <span
                        className={clsx(
                          'px-2 py-0.5 text-xs rounded',
                          policy.isEnabled
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {policy.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRunJob(policy.id)}
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={() => setEditingPolicy(policy)}
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Rules */}
                <div className="mt-4 space-y-2">
                  {policy.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-4 text-sm text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {RESOURCE_TYPES.find((t) => t.value === rule.resourceType)?.label || rule.resourceType}
                      </span>
                      <span>-&gt;</span>
                      <span>{ACTIONS.find((a) => a.value === rule.action)?.label || rule.action}</span>
                      <span>after {rule.retentionDays} days</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Policy Editor Modal */}
      {(editingPolicy || isCreating) && (
        <PolicyEditor
          policy={editingPolicy}
          onSave={handleSavePolicy}
          onCancel={() => {
            setEditingPolicy(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

function PolicyEditor({
  policy,
  onSave,
  onCancel,
}: {
  policy: RetentionPolicy | null;
  onSave: (policy: Partial<RetentionPolicy>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(policy?.name || '');
  const [description, setDescription] = useState(policy?.description || '');
  const [isEnabled, setIsEnabled] = useState(policy?.isEnabled ?? true);
  const [rules, setRules] = useState(policy?.rules || []);

  const addRule = () => {
    setRules([
      ...rules,
      { id: `new-${Date.now()}`, resourceType: 'message', action: 'delete' as const, retentionDays: 90 },
    ]);
  };

  const updateRule = (index: number, updates: Partial<typeof rules[number]>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-lg">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {policy ? 'Edit Policy' : 'Create Policy'}
          </h3>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-auto">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="isEnabled" className="text-sm text-foreground">
              Policy is active
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Rules</label>
              <button
                onClick={addRule}
                className="text-sm text-primary hover:underline"
              >
                + Add Rule
              </button>
            </div>

            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={rule.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <select
                    value={rule.resourceType}
                    onChange={(e) => updateRule(index, { resourceType: e.target.value })}
                    className="px-2 py-1 bg-background border border-border rounded text-sm"
                  >
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>

                  <select
                    value={rule.action}
                    onChange={(e) => updateRule(index, { action: e.target.value as 'delete' | 'archive' | 'anonymize' })}
                    className="px-2 py-1 bg-background border border-border rounded text-sm"
                  >
                    {ACTIONS.map((action) => (
                      <option key={action.value} value={action.value}>{action.label}</option>
                    ))}
                  </select>

                  <span className="text-sm text-muted-foreground">after</span>

                  <input
                    type="number"
                    value={rule.retentionDays}
                    onChange={(e) => updateRule(index, { retentionDays: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-background border border-border rounded text-sm"
                    min={1}
                  />

                  <span className="text-sm text-muted-foreground">days</span>

                  <button
                    onClick={() => removeRule(index)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ id: policy?.id, name, description, isEnabled, rules })}
            disabled={!name || rules.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default RetentionSettings;
