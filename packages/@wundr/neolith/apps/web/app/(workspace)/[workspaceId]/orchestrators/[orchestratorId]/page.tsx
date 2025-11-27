/**
 * OrchestratorDetail Page
 *
 * Displays detailed information about a specific orchestrator with
 * editing capabilities, activity history, and quick actions.
 *
 * @module app/(workspace)/[workspaceId]/orchestrators/[orchestratorId]/page
 */
'use client';

import {
  Users,
  Edit,
  PenLine,
  Pause,
  Play,
  Settings,
  Activity,
  Clock,
  MessageSquare,
  Tag,
  TrendingUp,
  Brain,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useOrchestrator, useOrchestratorMutations } from '@/hooks/use-orchestrator';
import { cn } from '@/lib/utils';
import { ORCHESTRATOR_STATUS_CONFIG } from '@/types/orchestrator';

import type { UpdateOrchestratorInput } from '@/types/orchestrator';

export default function OrchestratorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editFormData, setEditFormData] = useState<UpdateOrchestratorInput>({});
  const [activeTab, setActiveTab] = useState('overview');

  // Hooks
  const { orchestrator, isLoading, error, refetch } = useOrchestrator(orchestratorId);
  const { updateOrchestrator, toggleOrchestratorStatus, isLoading: isMutating } = useOrchestratorMutations();

  // Set page header
  useEffect(() => {
    if (orchestrator) {
      setPageHeader(orchestrator.title, orchestrator.description || 'Orchestrator details and configuration');
    }
  }, [orchestrator, setPageHeader]);

  // Initialize edit form when orchestrator loads
  useEffect(() => {
    if (orchestrator && !isEditingMode) {
      setEditFormData({
        title: orchestrator.title,
        description: orchestrator.description || '',
        discipline: orchestrator.discipline || '',
        systemPrompt: orchestrator.systemPrompt || '',
        capabilities: orchestrator.capabilities || [],
      });
    }
  }, [orchestrator, isEditingMode]);

  // Handlers
  const handleEditWithAI = useCallback(() => {
    // TODO: Implement DualModeEditor integration
    alert('AI-powered editing coming soon! This will open a conversational editor.');
  }, []);

  const handleToggleEditMode = useCallback(() => {
    setIsEditingMode((prev) => !prev);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!orchestrator) return;

    const result = await updateOrchestrator(orchestrator.id, editFormData);
    if (result) {
      setIsEditingMode(false);
      refetch();
    }
  }, [orchestrator, editFormData, updateOrchestrator, refetch]);

  const handleCancelEdit = useCallback(() => {
    if (orchestrator) {
      setEditFormData({
        title: orchestrator.title,
        description: orchestrator.description || '',
        discipline: orchestrator.discipline || '',
        systemPrompt: orchestrator.systemPrompt || '',
        capabilities: orchestrator.capabilities || [],
      });
    }
    setIsEditingMode(false);
  }, [orchestrator]);

  const handleToggleStatus = useCallback(async () => {
    if (!orchestrator) return;
    await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
    refetch();
  }, [orchestrator, toggleOrchestratorStatus, refetch]);

  const handlePause = useCallback(async () => {
    if (!orchestrator) return;
    await updateOrchestrator(orchestrator.id, { status: 'BUSY' });
    refetch();
  }, [orchestrator, updateOrchestrator, refetch]);

  const handleConfigure = useCallback(() => {
    router.push(`/${workspaceId}/orchestrators/${orchestratorId}/settings`);
  }, [router, workspaceId, orchestratorId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <OrchestratorDetailSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !orchestrator) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-md">
          <div className="flex items-center gap-2 text-red-800">
            <AlertIcon className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Failed to load orchestrator</h3>
          </div>
          <p className="mt-2 text-sm text-red-600">
            {error?.message || 'The orchestrator could not be found.'}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
            <Button onClick={refetch}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = ORCHESTRATOR_STATUS_CONFIG[orchestrator.status];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => router.push(`/${workspaceId}/orchestrators`)}
          className="hover:text-foreground transition-colors"
        >
          Orchestrators
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{orchestrator.title}</span>
      </nav>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold">
                {orchestrator.avatarUrl ? (
                  <img
                    src={orchestrator.avatarUrl}
                    alt={orchestrator.title}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  orchestrator.title.substring(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex-1">
                {isEditingMode ? (
                  <input
                    type="text"
                    value={editFormData.title || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="text-2xl font-bold border-b-2 border-primary bg-transparent focus:outline-none w-full"
                  />
                ) : (
                  <CardTitle className="text-2xl">{orchestrator.title}</CardTitle>
                )}

                {isEditingMode ? (
                  <textarea
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="mt-2 w-full border rounded-md p-2 text-sm bg-muted"
                    rows={2}
                    placeholder="Add a description..."
                  />
                ) : (
                  <CardDescription className="mt-1">
                    {orchestrator.description || 'No description provided'}
                  </CardDescription>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={cn(statusConfig.bgColor, statusConfig.color)}>
                    {statusConfig.label}
                  </Badge>
                  {isEditingMode && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                      <Edit className="h-3 w-3 mr-1" />
                      Editing Mode
                    </Badge>
                  )}
                  {orchestrator.discipline && (
                    <Badge variant="outline">
                      <Tag className="h-3 w-3 mr-1" />
                      {orchestrator.discipline}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {orchestrator.messageCount} messages
                  </Badge>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {orchestrator.agentCount} agents
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isEditingMode ? (
                <>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isMutating}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveChanges} disabled={isMutating}>
                    {isMutating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleEditWithAI}>
                    <Brain className="h-4 w-4 mr-2" />
                    Edit with AI
                  </Button>
                  <Button variant="outline" onClick={handleToggleEditMode}>
                    <PenLine className="h-4 w-4 mr-2" />
                    Edit Directly
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={orchestrator.status === 'ONLINE' ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={isMutating}
            >
              {orchestrator.status === 'ONLINE' ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Set Offline
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Set Online
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handlePause} disabled={isMutating}>
              <Clock className="h-4 w-4 mr-2" />
              Mark as Busy
            </Button>
            <Button variant="outline" onClick={handleConfigure}>
              <Settings className="h-4 w-4 mr-2" />
              Advanced Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="activity">
            <TrendingUp className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="capabilities">
            <Zap className="h-4 w-4 mr-2" />
            Capabilities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Total Messages" value={orchestrator.messageCount.toString()} />
                <MetricCard label="Managed Agents" value={orchestrator.agentCount.toString()} />
                <MetricCard
                  label="Last Active"
                  value={
                    orchestrator.lastActivityAt
                      ? new Date(orchestrator.lastActivityAt).toLocaleDateString()
                      : 'Never'
                  }
                />
                <MetricCard
                  label="Created"
                  value={new Date(orchestrator.createdAt).toLocaleDateString()}
                />
              </div>
            </CardContent>
          </Card>

          {orchestrator.charter && (
            <Card>
              <CardHeader>
                <CardTitle>Charter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Mission</h4>
                  <p className="text-sm text-muted-foreground">{orchestrator.charter.mission}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Vision</h4>
                  <p className="text-sm text-muted-foreground">{orchestrator.charter.vision}</p>
                </div>
                {orchestrator.charter.values && orchestrator.charter.values.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Values</h4>
                      <div className="flex flex-wrap gap-2">
                        {orchestrator.charter.values.map((value, index) => (
                          <Badge key={index} variant="secondary">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Technical settings and model configuration for this orchestrator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">System Prompt</h4>
                {isEditingMode ? (
                  <textarea
                    value={editFormData.systemPrompt || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, systemPrompt: e.target.value })}
                    className="w-full border rounded-md p-3 text-sm bg-muted font-mono"
                    rows={8}
                    placeholder="Define the orchestrator's system prompt..."
                  />
                ) : (
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                    {orchestrator.systemPrompt || 'No system prompt configured'}
                  </pre>
                )}
              </div>

              {orchestrator.modelConfig && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Model Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Model ID</span>
                        <p className="text-sm font-mono">{orchestrator.modelConfig.modelId}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Temperature</span>
                        <p className="text-sm font-mono">{orchestrator.modelConfig.temperature}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Max Tokens</span>
                        <p className="text-sm font-mono">{orchestrator.modelConfig.maxTokens}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Top P</span>
                        <p className="text-sm font-mono">{orchestrator.modelConfig.topP}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>Recent actions and events for this orchestrator</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityLog orchestratorId={orchestrator.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>
                Skills and abilities enabled for this orchestrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orchestrator.capabilities && orchestrator.capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {orchestrator.capabilities.map((capability, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      <Zap className="h-3 w-3 mr-1" />
                      {capability}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No capabilities configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Metric Card Component
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

/**
 * Activity type configuration for visual styling
 */
const ACTIVITY_TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  TASK_STARTED: { icon: Play, color: 'text-green-600', bgColor: 'bg-green-100' },
  TASK_COMPLETED: { icon: Zap, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  TASK_UPDATED: { icon: Activity, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  STATUS_CHANGE: { icon: Clock, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  MESSAGE_SENT: { icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  CHANNEL_JOINED: { icon: Users, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  CHANNEL_LEFT: { icon: Users, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  DECISION_MADE: { icon: Brain, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  LEARNING_RECORDED: { icon: TrendingUp, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  CONVERSATION_INITIATED: { icon: MessageSquare, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  TASK_DELEGATED: { icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  TASK_ESCALATED: { icon: TrendingUp, color: 'text-red-600', bgColor: 'bg-red-100' },
  ERROR_OCCURRED: { icon: AlertIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
  SYSTEM_EVENT: { icon: Settings, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

/**
 * OrchestratorActivity entry interface
 */
interface OrchestratorActivityEntry {
  id: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  channelId?: string;
  taskId?: string;
  importance: number;
  keywords: string[];
  timestamp: string;
  updatedAt: string;
}

/**
 * Activity Log Component - Production-ready activity feed for Orchestrators
 *
 * Fetches real activity data from the orchestrator activity API with:
 * - Cursor-based pagination
 * - Loading states
 * - Error handling with retry
 * - Activity type icons and color coding
 * - Relative time formatting
 */
function ActivityLog({ orchestratorId }: { orchestratorId: string }) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [activities, setActivities] = useState<OrchestratorActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * Format relative time for activity timestamps
   */
  const formatRelativeTime = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(async (append = false) => {
    if (!workspaceId || !orchestratorId) return;

    if (!append) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '20',
      });
      if (append && cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/orchestrators/${orchestratorId}/activity?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const result = await response.json();
      const newActivities = result.data?.activities || [];
      const pagination = result.data?.pagination || {};

      if (append) {
        setActivities(prev => [...prev, ...newActivities]);
      } else {
        setActivities(newActivities);
      }

      setCursor(pagination.cursor || null);
      setHasMore(pagination.hasMore || false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch activities');
      setError(error);
      console.error('[ActivityLog] Error fetching activities:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [workspaceId, orchestratorId, cursor]);

  /**
   * Load more activities (pagination)
   */
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchActivities(true);
  }, [hasMore, isLoadingMore, fetchActivities]);

  /**
   * Retry after error
   */
  const handleRetry = useCallback(() => {
    setCursor(null);
    fetchActivities(false);
  }, [fetchActivities]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchActivities(false);
  }, [orchestratorId, workspaceId]); // Re-fetch when IDs change

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 max-w-sm text-center">
          <AlertIcon className="h-6 w-6 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-800 font-medium">Failed to load activity</p>
          <p className="text-xs text-red-600 mt-1">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Activity will appear here as this orchestrator performs actions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {activities.map((activity) => {
          const config = ACTIVITY_TYPE_CONFIG[activity.type] || ACTIVITY_TYPE_CONFIG.SYSTEM_EVENT;
          const IconComponent = config.icon;

          return (
            <div
              key={activity.id}
              className="flex gap-3 items-start p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                config.bgColor
              )}>
                <IconComponent className={cn('h-4 w-4', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{activity.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                  {activity.importance >= 7 && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      High Priority
                    </Badge>
                  )}
                </div>
                {activity.keywords && activity.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activity.keywords.slice(0, 3).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-muted px-1.5 py-0.5 rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Skeleton Loader
function OrchestratorDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/3" />
      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <div className="h-16 w-16 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  );
}

// Icons
function AlertIcon({ className }: { className?: string }) {
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
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
