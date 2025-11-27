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
  Calendar,
  TrendingUp,
  Brain,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
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

import type { Orchestrator, UpdateOrchestratorInput } from '@/types/orchestrator';

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

// Activity Log Component
function ActivityLog({ orchestratorId }: { orchestratorId: string }) {
  // TODO: Implement actual activity fetching from API
  const mockActivities = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      type: 'status_change',
      description: 'Status changed to Online',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      type: 'message',
      description: 'Processed 15 messages',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      type: 'configuration',
      description: 'System prompt updated',
    },
  ];

  return (
    <div className="space-y-4">
      {mockActivities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet</p>
      ) : (
        <div className="space-y-3">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="flex gap-3 items-start border-l-2 border-primary pl-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-muted-foreground">
                  {activity.timestamp.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
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
