'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VPConfigForm } from '@/components/vp/vp-config-form';
import { VPStatusBadge } from '@/components/vp/vp-status-badge';
import { useVP, useVPMutations } from '@/hooks/use-vp';
import { useVPTasks } from '@/hooks/use-vp-tasks';
import { cn } from '@/lib/utils';

import type { UpdateVPInput } from '@/types/vp';

type Tab = 'overview' | 'tasks' | 'configuration' | 'activity' | 'agents';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'activity', label: 'Activity' },
  { id: 'agents', label: 'Agents' },
];

export default function VPDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vpId = params.vpId as string;
  const workspaceId = params.workspaceId as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { vp, isLoading, error, refetch } = useVP(vpId);
  const { updateVP, toggleVPStatus, rotateAPIKey, deleteVP, isLoading: isMutating } = useVPMutations();
  const { tasks, metrics, isLoading: tasksLoading } = useVPTasks(vpId, {
    includeCompleted: false,
    limit: 10,
  });

  const handleUpdateVP = useCallback(
    async (input: UpdateVPInput) => {
      await updateVP(vpId, input);
      refetch();
    },
    [vpId, updateVP, refetch],
  );

  const handleToggleStatus = useCallback(async () => {
    if (!vp) {
return;
}
    await toggleVPStatus(vpId, vp.status);
    refetch();
  }, [vpId, vp, toggleVPStatus, refetch]);

  const handleRotateApiKey = useCallback(async () => {
    const result = await rotateAPIKey(vpId);
    if (result) {
      setApiKey(result.apiKey);
      setShowApiKey(true);
    }
  }, [vpId, rotateAPIKey]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this VP? This action cannot be undone.')) {
      return;
    }
    const success = await deleteVP(vpId);
    if (success) {
      router.push(`/${workspaceId}/vps`);
    }
  }, [vpId, workspaceId, deleteVP, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">Failed to load VP</h2>
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  // Not found state
  if (!vp) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">VP not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The VP you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link
          href={`/${workspaceId}/vps`}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to VPs
        </Link>
      </div>
    );
  }

  const isOnline = vp.status === 'ONLINE';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${workspaceId}/vps`} className="hover:text-foreground">
          VPs
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <span className="text-foreground">{vp.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
            {vp.avatarUrl ? (
              <Image
                src={vp.avatarUrl}
                alt={vp.title}
                width={64}
                height={64}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              getInitials(vp.title)
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vp.title}</h1>
              <VPStatusBadge status={vp.status} />
            </div>
            {vp.discipline && (
              <p className="text-sm text-muted-foreground">{vp.discipline}</p>
            )}
            {vp.description && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{vp.description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isMutating}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              isOnline
                ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
            )}
          >
            {isOnline ? 'Set Offline' : 'Set Online'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isMutating}
            className="rounded-md border border-red-200 bg-background px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stats Card */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatItem label="Messages" value={vp.messageCount.toLocaleString()} />
                <StatItem label="Agents" value={vp.agentCount.toString()} />
                <StatItem
                  label="Active Tasks"
                  value={metrics ? (metrics.byStatus.todo + metrics.byStatus.inProgress).toString() : '0'}
                />
                <StatItem
                  label="Completion Rate"
                  value={metrics ? `${metrics.completionRate}%` : '0%'}
                />
                <StatItem
                  label="Last Activity"
                  value={
                    vp.lastActivityAt
                      ? formatDate(new Date(vp.lastActivityAt))
                      : 'Never'
                  }
                />
                <StatItem
                  label="Created"
                  value={formatDate(new Date(vp.createdAt))}
                />
              </div>
            </div>

            {/* Charter Summary */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Charter Summary</h3>
              {vp.charter ? (
                <div className="space-y-3">
                  {vp.charter.personality?.traits && vp.charter.personality.traits.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Personality</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {vp.charter.personality.traits.map((trait) => (
                          <span
                            key={trait}
                            className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {vp.charter.expertise && vp.charter.expertise.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Expertise</p>
                      <p className="mt-1 text-sm text-foreground">
                        {vp.charter.expertise.join(', ')}
                      </p>
                    </div>
                  )}
                  {vp.charter.operationalSettings && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Work Hours</p>
                      <p className="mt-1 text-sm text-foreground">
                        {vp.charter.operationalSettings.workHours.start} -{' '}
                        {vp.charter.operationalSettings.workHours.end} (
                        {vp.charter.operationalSettings.workHours.timezone})
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No charter configured</p>
              )}
            </div>

            {/* API Key Management */}
            <div className="rounded-lg border bg-card p-6 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-foreground">API Key Management</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      API Key
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey || 'vp_****************************'}
                        readOnly
                        className="flex-1 rounded-md border border-input bg-muted px-3 py-2 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="rounded-md border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? (
                          <EyeOffIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(apiKey)}
                          className="rounded-md border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Copy API key"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRotateApiKey}
                    disabled={isMutating}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isMutating ? 'Rotating...' : 'Rotate Key'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Rotating the key will invalidate the current key immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Assigned Tasks</h3>
              <Link
                href={`/${workspaceId}/tasks?vpId=${vpId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all tasks
              </Link>
            </div>

            {metrics && (
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">To Do</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{metrics.byStatus.todo}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">In Progress</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{metrics.byStatus.inProgress}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Blocked</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-600">{metrics.byStatus.blocked}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Done</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">{metrics.byStatus.done}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-card">
              {tasksLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <TaskIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No tasks assigned yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 hover:bg-accent/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">{task.title}</h4>
                            <TaskPriorityBadge priority={task.priority} />
                          </div>
                          {task.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <TaskStatusBadge status={task.status} />
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {formatDate(new Date(task.dueDate))}
                              </span>
                            )}
                            {task.assignedTo && (
                              <span>Assigned to: {task.assignedTo.name || task.assignedTo.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="max-w-3xl">
            <VPConfigForm
              vp={vp}
              onSave={handleUpdateVP}
              isLoading={isMutating}
            />
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Activity</h3>
            <div className="text-center py-8 text-muted-foreground">
              <ClockIcon className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Activity log coming soon</p>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Managed Agents</h3>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                {vp.agentCount} agents
              </span>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              <AgentIcon className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Agent management coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility Components
function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-yellow-100 text-yellow-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  const statusLabels: Record<string, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    BLOCKED: 'Blocked',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColors[status])}>
      {statusLabels[status] || status}
    </span>
  );
}

function TaskPriorityBadge({ priority }: { priority: string }) {
  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', priorityColors[priority])}>
      {priority}
    </span>
  );
}

// Utility Functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Icons
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
