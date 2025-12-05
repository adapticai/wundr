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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      console.error(`Failed to ${action} session manager:`, err);
      alert(`Failed to ${action} session manager`);
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
              <Button variant='outline'>
                <Settings className='h-4 w-4 mr-2' />
                Configure
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

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
                  Charter Configuration
                </h4>
                {sessionManager.charterId ? (
                  <div className='text-sm text-muted-foreground'>
                    <p>Charter ID: {sessionManager.charterId}</p>
                    {sessionManager.charterData && (
                      <pre className='mt-2 text-xs bg-muted p-3 rounded-md overflow-auto max-h-32'>
                        {JSON.stringify(sessionManager.charterData, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No charter configured
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
                    Estimated usage: ~
                    {Math.round(activeSubagents * 5000).toLocaleString()}{' '}
                    tokens/hr
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
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Session manager settings and parameters
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <h4 className='text-sm font-semibold mb-2'>Global Settings</h4>
                {sessionManager.isGlobal && sessionManager.globalConfig ? (
                  <pre className='text-xs bg-muted p-3 rounded-md overflow-auto max-h-48'>
                    {JSON.stringify(sessionManager.globalConfig, null, 2)}
                  </pre>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    Not configured as global session manager
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <h4 className='text-sm font-semibold mb-2'>
                  Worktree Configuration
                </h4>
                {sessionManager.worktreeConfig ? (
                  <pre className='text-xs bg-muted p-3 rounded-md overflow-auto max-h-48'>
                    {JSON.stringify(sessionManager.worktreeConfig, null, 2)}
                  </pre>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No worktree configuration
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='stats' className='space-y-4 mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Performance Statistics</CardTitle>
              <CardDescription>
                Usage metrics and performance data (Coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-center py-12 text-muted-foreground'>
                <TrendingUp className='h-12 w-12 mx-auto mb-4 opacity-50' />
                <p className='text-sm'>Performance statistics coming soon</p>
                <p className='text-xs mt-1'>
                  Track token usage, task completion rates, and more
                </p>
              </div>
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
