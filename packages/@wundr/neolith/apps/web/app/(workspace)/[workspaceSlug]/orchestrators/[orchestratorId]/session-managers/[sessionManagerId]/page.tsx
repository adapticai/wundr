/**
 * Session Manager Detail Page
 *
 * Displays detailed information about a specific session manager including
 * configuration, stats, subagents, and control actions.
 *
 * @module app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/session-managers/[sessionManagerId]/page
 */
'use client';

import {
  Users,
  Play,
  Pause,
  Settings,
  ChevronRight,
  Activity,
  Zap,
  Clock,
  TrendingUp,
  Brain,
  FileText,
  Cpu,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useState, useCallback, useEffect } from 'react';

import { SubagentCreate } from '@/components/orchestrator/subagent-create';
import { SubagentList } from '@/components/orchestrator/subagent-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from '@/lib/utils';

interface SessionManager {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  isGlobal: boolean;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  charterId?: string;
  charterData?: Record<string, unknown>;
  disciplineId?: string;
  worktreeConfig?: Record<string, unknown>;
  globalConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  orchestrator: {
    id: string;
    title: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  };
  subagents: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    capabilities: string[];
    mcpTools: string[];
    scope: string;
    tier: number;
  }>;
}

const statusColors = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  PAUSED: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

const statusTextColors = {
  ACTIVE: 'text-green-700 bg-green-50 border-green-200',
  INACTIVE: 'text-gray-700 bg-gray-50 border-gray-200',
  PAUSED: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  ERROR: 'text-red-700 bg-red-50 border-red-200',
};

export default function SessionManagerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const sessionManagerId = params.sessionManagerId as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [sessionManager, setSessionManager] = useState<SessionManager | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreateSubagentOpen, setIsCreateSubagentOpen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch session manager data
  const fetchSessionManager = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/session-managers/${sessionManagerId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch session manager');
      }

      const { data } = await response.json();
      setSessionManager(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionManagerId]);

  useEffect(() => {
    fetchSessionManager();
  }, [fetchSessionManager]);

  // Set page header
  useEffect(() => {
    if (sessionManager) {
      setPageHeader(
        sessionManager.name,
        sessionManager.description ||
          'Session Manager details and configuration'
      );
    }
  }, [sessionManager, setPageHeader]);

  // Handlers
  const handleBack = useCallback(() => {
    router.push(
      `/${workspaceSlug}/orchestrators/${orchestratorId}?tab=session-managers`
    );
  }, [router, workspaceSlug, orchestratorId]);

  const handleToggleStatus = useCallback(async () => {
    if (!sessionManager) {
      return;
    }

    const action =
      sessionManager.status === 'ACTIVE' ? 'deactivate' : 'activate';
    setIsActivating(true);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/session-managers/${sessionManagerId}/${action}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} session manager`);
      }

      await fetchSessionManager();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${action} session manager`;
      setActionError(message);
      console.error(`Failed to ${action} session manager:`, err);
    } finally {
      setIsActivating(false);
    }
  }, [sessionManager, sessionManagerId, fetchSessionManager]);

  const handleSubagentCreated = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    fetchSessionManager();
  }, [fetchSessionManager]);

  // Loading state
  if (loading) {
    return (
      <div className='space-y-6'>
        <SessionManagerDetailSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !sessionManager) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 max-w-md'>
          <h3 className='text-lg font-semibold text-red-800'>
            Failed to load session manager
          </h3>
          <p className='mt-2 text-sm text-red-600'>
            {error || 'Session manager not found'}
          </p>
          <div className='mt-4 flex gap-2'>
            <Button variant='outline' onClick={handleBack}>
              Go Back
            </Button>
            <Button onClick={fetchSessionManager}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  const activeSubagents = sessionManager.subagents.filter(
    sa => sa.status === 'ACTIVE'
  ).length;

  return (
    <div className='space-y-6'>
      {/* Breadcrumbs */}
      <nav className='flex items-center gap-2 text-sm text-muted-foreground'>
        <button
          type='button'
          onClick={() => router.push(`/${workspaceSlug}/orchestrators`)}
          className='hover:text-foreground transition-colors'
        >
          Orchestrators
        </button>
        <ChevronRight className='h-4 w-4' />
        <button
          type='button'
          onClick={() =>
            router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}`)
          }
          className='hover:text-foreground transition-colors'
        >
          {sessionManager.orchestrator.title}
        </button>
        <ChevronRight className='h-4 w-4' />
        <button
          type='button'
          onClick={() =>
            router.push(
              `/${workspaceSlug}/orchestrators/${orchestratorId}?tab=session-managers`
            )
          }
          className='hover:text-foreground transition-colors'
        >
          Session Managers
        </button>
        <ChevronRight className='h-4 w-4' />
        <span className='text-foreground font-medium'>
          {sessionManager.name}
        </span>
      </nav>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div className='flex items-start gap-4 flex-1'>
              {/* Icon */}
              <div className='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-2xl font-bold'>
                <Users className='h-8 w-8' />
              </div>

              <div className='flex-1'>
                <div className='flex items-center gap-3'>
                  <CardTitle className='text-2xl'>
                    {sessionManager.name}
                  </CardTitle>
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      statusColors[sessionManager.status]
                    )}
                    title={sessionManager.status}
                  />
                </div>

                <CardDescription className='mt-1'>
                  {sessionManager.description || 'No description provided'}
                </CardDescription>

                <div className='mt-3 flex flex-wrap gap-2'>
                  <Badge
                    className={cn(statusTextColors[sessionManager.status])}
                  >
                    {sessionManager.status}
                  </Badge>
                  {sessionManager.isGlobal && (
                    <Badge variant='outline'>Global</Badge>
                  )}
                  <Badge variant='secondary'>
                    <Users className='h-3 w-3 mr-1' />
                    {activeSubagents} / {sessionManager.maxConcurrentSubagents}{' '}
                    Active Subagents
                  </Badge>
                  <Badge variant='secondary'>
                    <Zap className='h-3 w-3 mr-1' />
                    {sessionManager.tokenBudgetPerHour.toLocaleString()}{' '}
                    tokens/hr
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2'>
              <Button
                variant={
                  sessionManager.status === 'ACTIVE' ? 'outline' : 'default'
                }
                onClick={handleToggleStatus}
                disabled={isActivating}
              >
                {sessionManager.status === 'ACTIVE' ? (
                  <>
                    <Pause className='h-4 w-4 mr-2' />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className='h-4 w-4 mr-2' />
                    Activate
                  </>
                )}
              </Button>
              <Button
                variant='outline'
                onClick={() => setActiveTab('configuration')}
              >
                <Settings className='h-4 w-4 mr-2' />
                Configure
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Action Error */}
      {actionError && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between'>
          <p className='text-sm text-red-700'>{actionError}</p>
          <button
            type='button'
            onClick={() => setActionError(null)}
            className='text-red-500 hover:text-red-700 text-xs underline'
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Overview */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <MetricCard
          icon={Users}
          label='Total Subagents'
          value={sessionManager.subagents.length.toString()}
          subtitle={`${activeSubagents} active`}
        />
        <MetricCard
          icon={Cpu}
          label='Capacity Used'
          value={`${Math.round((activeSubagents / sessionManager.maxConcurrentSubagents) * 100)}%`}
          subtitle={`${sessionManager.maxConcurrentSubagents} max`}
        />
        <MetricCard
          icon={Zap}
          label='Token Budget'
          value={`${(sessionManager.tokenBudgetPerHour / 1000).toFixed(0)}K`}
          subtitle='per hour'
        />
        <MetricCard
          icon={Clock}
          label='Last Updated'
          value={new Date(sessionManager.updatedAt).toLocaleDateString()}
          subtitle={new Date(sessionManager.updatedAt).toLocaleTimeString()}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='overview'>
            <Activity className='h-4 w-4 mr-2' />
            Overview
          </TabsTrigger>
          <TabsTrigger value='subagents'>
            <Brain className='h-4 w-4 mr-2' />
            Subagents ({sessionManager.subagents.length})
          </TabsTrigger>
          <TabsTrigger value='configuration'>
            <Settings className='h-4 w-4 mr-2' />
            Configuration
          </TabsTrigger>
          <TabsTrigger value='stats'>
            <TrendingUp className='h-4 w-4 mr-2' />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4 mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Session Manager Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Orchestrator
                  </p>
                  <p className='text-sm font-semibold'>
                    {sessionManager.orchestrator.title}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Organization
                  </p>
                  <p className='text-sm font-semibold'>
                    {sessionManager.orchestrator.organization.name}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Created
                  </p>
                  <p className='text-sm'>
                    {new Date(sessionManager.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Status
                  </p>
                  <Badge
                    className={cn(statusTextColors[sessionManager.status])}
                  >
                    {sessionManager.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className='text-sm font-semibold mb-2 flex items-center gap-2'>
                  <FileText className='h-4 w-4' />
                  Charter
                </h4>
                {sessionManager.charterId ? (
                  <div className='flex items-center gap-2 text-sm'>
                    <span className='inline-block h-2 w-2 rounded-full bg-green-500' />
                    <span className='text-muted-foreground'>
                      Charter assigned
                    </span>
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No charter configured. Assign a charter in the Configuration
                    tab to define operational parameters for this session
                    manager.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resource Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Limits</CardTitle>
              <CardDescription>
                Current resource allocation and usage limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium'>
                      Concurrent Subagents
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {activeSubagents} /{' '}
                      {sessionManager.maxConcurrentSubagents}
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2'>
                    <div
                      className='bg-primary rounded-full h-2 transition-all'
                      style={{
                        width: `${(activeSubagents / sessionManager.maxConcurrentSubagents) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium'>Token Budget</span>
                    <span className='text-sm text-muted-foreground'>
                      {sessionManager.tokenBudgetPerHour.toLocaleString()} /
                      hour
                    </span>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Budget limit per hour for all subagents combined
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='subagents' className='space-y-4 mt-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Subagents</CardTitle>
                  <CardDescription>
                    Specialized workers managed by this session manager
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsCreateSubagentOpen(true)}
                  disabled={
                    activeSubagents >= sessionManager.maxConcurrentSubagents
                  }
                >
                  <Users className='h-4 w-4 mr-2' />
                  Add Subagent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeSubagents >= sessionManager.maxConcurrentSubagents && (
                <div className='mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md'>
                  <p className='text-sm text-yellow-800'>
                    Maximum concurrent subagents reached. Deactivate or remove
                    existing subagents before adding new ones.
                  </p>
                </div>
              )}
              <SubagentList
                key={refreshKey}
                sessionManagerId={sessionManagerId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='configuration' className='space-y-4 mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>General Configuration</CardTitle>
              <CardDescription>
                Core settings for this session manager
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Name
                  </p>
                  <p className='text-sm font-semibold'>{sessionManager.name}</p>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Status
                  </p>
                  <Badge
                    className={cn(statusTextColors[sessionManager.status])}
                  >
                    {sessionManager.status}
                  </Badge>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Scope
                  </p>
                  <p className='text-sm'>
                    {sessionManager.isGlobal
                      ? 'Global — available to all orchestrators'
                      : 'Local — scoped to this orchestrator'}
                  </p>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Max Concurrent Subagents
                  </p>
                  <p className='text-sm font-semibold'>
                    {sessionManager.maxConcurrentSubagents}
                  </p>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Token Budget
                  </p>
                  <p className='text-sm font-semibold'>
                    {sessionManager.tokenBudgetPerHour.toLocaleString()} tokens
                    / hour
                  </p>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Charter
                  </p>
                  <p className='text-sm'>
                    {sessionManager.charterId
                      ? 'Charter assigned'
                      : 'No charter configured'}
                  </p>
                </div>
                {sessionManager.description && (
                  <div className='sm:col-span-2 space-y-1'>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                      Description
                    </p>
                    <p className='text-sm'>{sessionManager.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {sessionManager.worktreeConfig &&
            Object.keys(sessionManager.worktreeConfig).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Worktree Configuration</CardTitle>
                  <CardDescription>
                    Git worktree and file system settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {Object.entries(sessionManager.worktreeConfig).map(
                      ([key, value]) => (
                        <div key={key} className='space-y-1'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                            {key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, s => s.toUpperCase())}
                          </p>
                          <p className='text-sm font-mono break-all'>
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {sessionManager.isGlobal &&
            sessionManager.globalConfig &&
            Object.keys(sessionManager.globalConfig).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Global Settings</CardTitle>
                  <CardDescription>
                    Settings applied when this session manager is used globally
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {Object.entries(sessionManager.globalConfig).map(
                      ([key, value]) => (
                        <div key={key} className='space-y-1'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                            {key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, s => s.toUpperCase())}
                          </p>
                          <p className='text-sm font-mono break-all'>
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        <TabsContent value='stats' className='space-y-4 mt-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle>Subagent Utilization</CardTitle>
                <CardDescription>
                  Active vs total subagent capacity
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <div className='flex justify-between items-center mb-2 text-sm'>
                    <span className='font-medium'>Active Subagents</span>
                    <span className='text-muted-foreground'>
                      {activeSubagents} /{' '}
                      {sessionManager.maxConcurrentSubagents}
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2.5'>
                    <div
                      className='bg-primary rounded-full h-2.5 transition-all'
                      style={{
                        width: `${Math.min(
                          (activeSubagents /
                            sessionManager.maxConcurrentSubagents) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground mt-1'>
                    {Math.round(
                      (activeSubagents /
                        sessionManager.maxConcurrentSubagents) *
                        100
                    )}
                    % capacity in use
                  </p>
                </div>

                <div className='grid grid-cols-2 gap-3 pt-2'>
                  <div className='p-3 border rounded-lg'>
                    <p className='text-xs text-muted-foreground'>
                      Total Subagents
                    </p>
                    <p className='text-xl font-bold mt-0.5'>
                      {sessionManager.subagents.length}
                    </p>
                  </div>
                  <div className='p-3 border rounded-lg'>
                    <p className='text-xs text-muted-foreground'>Active Now</p>
                    <p className='text-xl font-bold mt-0.5 text-green-600'>
                      {activeSubagents}
                    </p>
                  </div>
                  <div className='p-3 border rounded-lg'>
                    <p className='text-xs text-muted-foreground'>Inactive</p>
                    <p className='text-xl font-bold mt-0.5 text-muted-foreground'>
                      {
                        sessionManager.subagents.filter(
                          sa => sa.status !== 'ACTIVE'
                        ).length
                      }
                    </p>
                  </div>
                  <div className='p-3 border rounded-lg'>
                    <p className='text-xs text-muted-foreground'>
                      Capacity Left
                    </p>
                    <p className='text-xl font-bold mt-0.5'>
                      {sessionManager.maxConcurrentSubagents - activeSubagents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Token Budget</CardTitle>
                <CardDescription>
                  Hourly token allocation for this session manager
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-end gap-2'>
                  <p className='text-3xl font-bold'>
                    {sessionManager.tokenBudgetPerHour >= 1_000_000
                      ? `${(sessionManager.tokenBudgetPerHour / 1_000_000).toFixed(1)}M`
                      : sessionManager.tokenBudgetPerHour >= 1_000
                        ? `${(sessionManager.tokenBudgetPerHour / 1_000).toFixed(0)}K`
                        : sessionManager.tokenBudgetPerHour.toLocaleString()}
                  </p>
                  <p className='text-sm text-muted-foreground pb-1'>
                    tokens / hour
                  </p>
                </div>
                <p className='text-sm text-muted-foreground'>
                  This budget is shared across all subagents managed by this
                  session manager. Individual subagents may have additional
                  per-subagent limits configured.
                </p>
                <div className='pt-2 border-t'>
                  <p className='text-xs text-muted-foreground'>
                    Per-subagent average (if evenly distributed)
                  </p>
                  <p className='text-lg font-semibold mt-0.5'>
                    {sessionManager.subagents.length > 0
                      ? Math.floor(
                          sessionManager.tokenBudgetPerHour /
                            sessionManager.subagents.length
                        ).toLocaleString()
                      : sessionManager.tokenBudgetPerHour.toLocaleString()}{' '}
                    <span className='text-sm font-normal text-muted-foreground'>
                      tokens / hr
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subagent Breakdown</CardTitle>
              <CardDescription>
                Status distribution across all subagents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionManager.subagents.length === 0 ? (
                <p className='text-sm text-muted-foreground py-4 text-center'>
                  No subagents configured yet.
                </p>
              ) : (
                <div className='space-y-3'>
                  {Object.entries(
                    sessionManager.subagents.reduce<Record<string, number>>(
                      (acc, sa) => {
                        acc[sa.status] = (acc[sa.status] || 0) + 1;
                        return acc;
                      },
                      {}
                    )
                  ).map(([status, count]) => (
                    <div
                      key={status}
                      className='flex items-center justify-between text-sm'
                    >
                      <div className='flex items-center gap-2'>
                        <span
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            status === 'ACTIVE'
                              ? 'bg-green-500'
                              : status === 'ERROR'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                          )}
                        />
                        <span className='font-medium capitalize'>
                          {status.toLowerCase()}
                        </span>
                      </div>
                      <span className='text-muted-foreground'>
                        {count} subagent{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Subagent Dialog */}
      <SubagentCreate
        sessionManagerId={sessionManagerId}
        open={isCreateSubagentOpen}
        onOpenChange={setIsCreateSubagentOpen}
        onCreated={handleSubagentCreated}
      />
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
}

function MetricCard({ icon: Icon, label, value, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className='pt-6'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Icon className='h-5 w-5' />
          </div>
          <div className='flex-1'>
            <p className='text-xs text-muted-foreground'>{label}</p>
            <p className='text-2xl font-bold'>{value}</p>
            {subtitle && (
              <p className='text-xs text-muted-foreground'>{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton Loader
function SessionManagerDetailSkeleton() {
  return (
    <div className='space-y-6 animate-pulse'>
      <div className='h-8 bg-muted rounded w-1/2' />
      <Card>
        <CardHeader>
          <div className='flex gap-4'>
            <div className='h-16 w-16 bg-muted rounded-full' />
            <div className='flex-1 space-y-2'>
              <div className='h-8 bg-muted rounded w-1/3' />
              <div className='h-4 bg-muted rounded w-1/2' />
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className='grid grid-cols-4 gap-4'>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className='h-24 bg-muted rounded' />
        ))}
      </div>
    </div>
  );
}
