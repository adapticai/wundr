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
  FileText,
  History,
  RotateCcw,
  AlertCircle,
  ListTodo,
  GitBranch,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useState, useCallback, useEffect } from 'react';

import { CharterEditor, CharterDiff } from '@/components/charter';
import { OrchestratorActivityFeed } from '@/components/orchestrator/activity-feed';
import { BacklogList } from '@/components/orchestrator/backlog-list';
import { DelegationDialog } from '@/components/orchestrator/delegation-dialog';
import { DelegationHistory } from '@/components/orchestrator/delegation-history';
import { DelegationRules } from '@/components/orchestrator/delegation-rules';
import { SessionManagerCreate } from '@/components/orchestrator/session-manager-create';
import { SessionManagerList } from '@/components/orchestrator/session-manager-list';
import { SubagentCreate } from '@/components/orchestrator/subagent-create';
import { SubagentList } from '@/components/orchestrator/subagent-list';
import { OrchestratorChat } from '@/components/orchestrators/orchestrator-chat';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useOrchestrator,
  useOrchestratorMutations,
} from '@/hooks/use-orchestrator';
import { cn } from '@/lib/utils';
import { ORCHESTRATOR_STATUS_CONFIG } from '@/types/orchestrator';

import type {
  UpdateOrchestratorInput,
  OrchestratorCharter,
  Orchestrator,
} from '@/types/orchestrator';

export default function OrchestratorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editFormData, setEditFormData] = useState<UpdateOrchestratorInput>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [isCharterEditorOpen, setIsCharterEditorOpen] = useState(false);
  const [charterVersions, setCharterVersions] = useState<
    Array<{ version: number; charter: OrchestratorCharter; createdAt: string }>
  >([]);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] = useState(false);
  const [delegationRefreshTrigger, setDelegationRefreshTrigger] = useState(0);

  // Hooks
  const { orchestrator, isLoading, error, refetch } =
    useOrchestrator(orchestratorId);
  const {
    updateOrchestrator,
    toggleOrchestratorStatus,
    isLoading: isMutating,
  } = useOrchestratorMutations();

  // Set page header
  useEffect(() => {
    if (orchestrator) {
      setPageHeader(
        orchestrator.title,
        orchestrator.description || 'Orchestrator details and configuration'
      );
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
    setIsAIChatOpen(true);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    setIsEditingMode(prev => !prev);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!orchestrator) {
      return;
    }

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
    if (!orchestrator) {
      return;
    }
    await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
    refetch();
  }, [orchestrator, toggleOrchestratorStatus, refetch]);

  const handlePause = useCallback(async () => {
    if (!orchestrator) {
      return;
    }
    await updateOrchestrator(orchestrator.id, { status: 'BUSY' });
    refetch();
  }, [orchestrator, updateOrchestrator, refetch]);

  const handleConfigure = useCallback(() => {
    router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}/settings`);
  }, [router, workspaceSlug, orchestratorId]);

  // Charter handlers
  const handleOpenCharterEditor = useCallback(() => {
    setIsCharterEditorOpen(true);
  }, []);

  const handleCloseCharterEditor = useCallback(() => {
    setIsCharterEditorOpen(false);
  }, []);

  const handleSaveCharter = useCallback(
    async (charter: OrchestratorCharter) => {
      if (!orchestrator) {
        return;
      }
      await updateOrchestrator(orchestrator.id, { charter });
      setIsCharterEditorOpen(false);
      refetch();
    },
    [orchestrator, updateOrchestrator, refetch]
  );

  // Fetch charter versions
  const fetchCharterVersions = useCallback(async () => {
    if (!orchestratorId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/charter/versions`
      );
      if (response.ok) {
        const data = await response.json();
        setCharterVersions(data.data?.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch charter versions:', error);
    }
  }, [orchestratorId]);

  // Rollback to a specific charter version
  const handleRollbackCharter = useCallback(
    async (version: number) => {
      if (!orchestrator) {
        return;
      }

      const confirmRollback = window.confirm(
        `Are you sure you want to rollback to version ${version}? This will create a new version with the previous charter.`
      );

      if (!confirmRollback) {
        return;
      }

      const versionData = charterVersions.find(v => v.version === version);
      if (!versionData) {
        return;
      }

      await updateOrchestrator(orchestrator.id, {
        charter: versionData.charter,
      });
      refetch();
      fetchCharterVersions();
    },
    [
      orchestrator,
      charterVersions,
      updateOrchestrator,
      refetch,
      fetchCharterVersions,
    ]
  );

  // Load charter versions when on charter tab
  useEffect(() => {
    if (activeTab === 'charter') {
      fetchCharterVersions();
    }
  }, [activeTab, fetchCharterVersions]);

  // Loading state
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <OrchestratorDetailSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !orchestrator) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 max-w-md'>
          <div className='flex items-center gap-2 text-red-800'>
            <AlertCircle className='h-5 w-5' />
            <h3 className='text-lg font-semibold'>
              Failed to load orchestrator
            </h3>
          </div>
          <p className='mt-2 text-sm text-red-600'>
            {error?.message || 'The orchestrator could not be found.'}
          </p>
          <div className='mt-4 flex gap-2'>
            <Button variant='outline' onClick={() => router.back()}>
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
    <div className='flex gap-6'>
      {/* Main Content */}
      <div className='flex-1 space-y-6'>
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
          <span className='text-foreground font-medium'>
            {orchestrator.title}
          </span>
        </nav>

        {/* Header Section */}
        <Card>
          <CardHeader>
            <div className='flex items-start justify-between'>
              <div className='flex items-start gap-4'>
                {/* Avatar */}
                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold'>
                  {orchestrator.avatarUrl ? (
                    <img
                      src={orchestrator.avatarUrl}
                      alt={orchestrator.title}
                      className='h-full w-full rounded-full object-cover'
                    />
                  ) : (
                    orchestrator.title.substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className='flex-1'>
                  {isEditingMode ? (
                    <input
                      type='text'
                      value={editFormData.title || ''}
                      onChange={e =>
                        setEditFormData({
                          ...editFormData,
                          title: e.target.value,
                        })
                      }
                      className='text-2xl font-bold border-b-2 border-primary bg-transparent focus:outline-none w-full'
                    />
                  ) : (
                    <CardTitle className='text-2xl'>
                      {orchestrator.title}
                    </CardTitle>
                  )}

                  {isEditingMode ? (
                    <textarea
                      value={editFormData.description || ''}
                      onChange={e =>
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        })
                      }
                      className='mt-2 w-full border rounded-md p-2 text-sm bg-muted'
                      rows={2}
                      placeholder='Add a description...'
                    />
                  ) : (
                    <CardDescription className='mt-1'>
                      {orchestrator.description || 'No description provided'}
                    </CardDescription>
                  )}

                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Badge
                      className={cn(statusConfig.bgColor, statusConfig.color)}
                    >
                      {statusConfig.label}
                    </Badge>
                    {isEditingMode && (
                      <Badge
                        variant='outline'
                        className='text-amber-600 border-amber-400 bg-amber-50'
                      >
                        <Edit className='h-3 w-3 mr-1' />
                        Editing Mode
                      </Badge>
                    )}
                    {orchestrator.discipline && (
                      <Badge variant='outline'>
                        <Tag className='h-3 w-3 mr-1' />
                        {orchestrator.discipline}
                      </Badge>
                    )}
                    <Badge variant='secondary'>
                      <MessageSquare className='h-3 w-3 mr-1' />
                      {orchestrator.messageCount} messages
                    </Badge>
                    <Badge variant='secondary'>
                      <Users className='h-3 w-3 mr-1' />
                      {orchestrator.agentCount} agents
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='flex gap-2'>
                {isEditingMode ? (
                  <>
                    <Button
                      variant='outline'
                      onClick={handleCancelEdit}
                      disabled={isMutating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isMutating}>
                      {isMutating ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant='outline' onClick={handleEditWithAI}>
                      <Brain className='h-4 w-4 mr-2' />
                      Edit with AI
                    </Button>
                    <Button variant='outline' onClick={handleToggleEditMode}>
                      <PenLine className='h-4 w-4 mr-2' />
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
            <CardTitle className='text-lg'>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant={
                  orchestrator.status === 'ONLINE' ? 'destructive' : 'default'
                }
                onClick={handleToggleStatus}
                disabled={isMutating}
              >
                {orchestrator.status === 'ONLINE' ? (
                  <>
                    <Pause className='h-4 w-4 mr-2' />
                    Set Offline
                  </>
                ) : (
                  <>
                    <Play className='h-4 w-4 mr-2' />
                    Set Online
                  </>
                )}
              </Button>
              <Button
                variant='outline'
                onClick={handlePause}
                disabled={isMutating || orchestrator.status === 'BUSY'}
              >
                <Pause className='h-4 w-4 mr-2' />
                Pause Activity
              </Button>
              <Button variant='outline' onClick={handleConfigure}>
                <Settings className='h-4 w-4 mr-2' />
                Advanced Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className='flex w-full flex-wrap gap-1 h-auto p-1'>
            <TabsTrigger value='overview' className='flex items-center gap-1.5'>
              <Activity className='h-4 w-4' />
              Overview
            </TabsTrigger>
            <TabsTrigger value='backlog' className='flex items-center gap-1.5'>
              <ListTodo className='h-4 w-4' />
              Backlog
            </TabsTrigger>
            <TabsTrigger
              value='delegation'
              className='flex items-center gap-1.5'
            >
              <GitBranch className='h-4 w-4' />
              Delegation
            </TabsTrigger>
            <TabsTrigger value='charter' className='flex items-center gap-1.5'>
              <FileText className='h-4 w-4' />
              Charter
            </TabsTrigger>
            <TabsTrigger
              value='session-managers'
              className='flex items-center gap-1.5'
            >
              <Users className='h-4 w-4' />
              Session Managers
            </TabsTrigger>
            <TabsTrigger
              value='subagents'
              className='flex items-center gap-1.5'
            >
              <Brain className='h-4 w-4' />
              Subagents
            </TabsTrigger>
            <TabsTrigger
              value='configuration'
              className='flex items-center gap-1.5'
            >
              <Settings className='h-4 w-4' />
              Configuration
            </TabsTrigger>
            <TabsTrigger value='activity' className='flex items-center gap-1.5'>
              <TrendingUp className='h-4 w-4' />
              Activity
            </TabsTrigger>
            <TabsTrigger
              value='capabilities'
              className='flex items-center gap-1.5'
            >
              <Zap className='h-4 w-4' />
              Capabilities
            </TabsTrigger>
          </TabsList>

          <TabsContent value='backlog' className='space-y-4 mt-6'>
            <BacklogList orchestratorId={orchestrator.id} />
          </TabsContent>

          <TabsContent value='delegation' className='space-y-4 mt-6'>
            <DelegationTab
              orchestratorId={orchestrator.id}
              onOpenDelegationDialog={() => setIsDelegationDialogOpen(true)}
              refreshTrigger={delegationRefreshTrigger}
            />
          </TabsContent>

          <TabsContent value='charter' className='space-y-4 mt-6'>
            <CharterTab
              orchestrator={orchestrator}
              onOpenEditor={handleOpenCharterEditor}
              versions={charterVersions}
              onRollback={handleRollbackCharter}
              compareVersion={compareVersion}
              onCompareVersion={setCompareVersion}
            />
          </TabsContent>

          <TabsContent value='session-managers' className='space-y-4 mt-6'>
            <SessionManagersTab orchestratorId={orchestrator.id} />
          </TabsContent>

          <TabsContent value='subagents' className='space-y-4 mt-6'>
            <SubagentsTab />
          </TabsContent>

          <TabsContent value='overview' className='space-y-4 mt-6'>
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  <MetricCard
                    label='Total Messages'
                    value={orchestrator.messageCount.toString()}
                  />
                  <MetricCard
                    label='Managed Agents'
                    value={orchestrator.agentCount.toString()}
                  />
                  <MetricCard
                    label='Last Active'
                    value={
                      orchestrator.lastActivityAt
                        ? new Date(
                            orchestrator.lastActivityAt
                          ).toLocaleDateString()
                        : 'Never'
                    }
                  />
                  <MetricCard
                    label='Created'
                    value={new Date(
                      orchestrator.createdAt
                    ).toLocaleDateString()}
                  />
                </div>
              </CardContent>
            </Card>

            {orchestrator.charter && (
              <Card>
                <CardHeader>
                  <CardTitle>Charter</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <h4 className='font-semibold text-sm mb-1'>Mission</h4>
                    <p className='text-sm text-muted-foreground'>
                      {orchestrator.charter.mission}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className='font-semibold text-sm mb-1'>Vision</h4>
                    <p className='text-sm text-muted-foreground'>
                      {orchestrator.charter.vision}
                    </p>
                  </div>
                  {orchestrator.charter.values &&
                    orchestrator.charter.values.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className='font-semibold text-sm mb-2'>Values</h4>
                          <div className='flex flex-wrap gap-2'>
                            {orchestrator.charter.values.map((value, index) => (
                              <Badge key={index} variant='secondary'>
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

          <TabsContent value='configuration' className='space-y-4 mt-6'>
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Technical settings and model configuration for this
                  orchestrator
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h4 className='font-semibold text-sm mb-2'>System Prompt</h4>
                  {isEditingMode ? (
                    <textarea
                      value={editFormData.systemPrompt || ''}
                      onChange={e =>
                        setEditFormData({
                          ...editFormData,
                          systemPrompt: e.target.value,
                        })
                      }
                      className='w-full border rounded-md p-3 text-sm bg-muted font-mono'
                      rows={8}
                      placeholder="Define the orchestrator's system prompt..."
                    />
                  ) : (
                    <pre className='text-xs bg-muted p-3 rounded-md overflow-auto max-h-64'>
                      {orchestrator.systemPrompt ||
                        'No system prompt configured'}
                    </pre>
                  )}
                </div>

                {orchestrator.modelConfig && (
                  <>
                    <Separator />
                    <div>
                      <h4 className='font-semibold text-sm mb-2'>
                        Model Configuration
                      </h4>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <span className='text-xs text-muted-foreground'>
                            Model ID
                          </span>
                          <p className='text-sm font-mono'>
                            {orchestrator.modelConfig.modelId}
                          </p>
                        </div>
                        <div>
                          <span className='text-xs text-muted-foreground'>
                            Temperature
                          </span>
                          <p className='text-sm font-mono'>
                            {orchestrator.modelConfig.temperature}
                          </p>
                        </div>
                        <div>
                          <span className='text-xs text-muted-foreground'>
                            Max Tokens
                          </span>
                          <p className='text-sm font-mono'>
                            {orchestrator.modelConfig.maxTokens}
                          </p>
                        </div>
                        <div>
                          <span className='text-xs text-muted-foreground'>
                            Top P
                          </span>
                          <p className='text-sm font-mono'>
                            {orchestrator.modelConfig.topP}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='activity' className='space-y-4 mt-6'>
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>
                  Recent actions and events for this orchestrator with real-time
                  updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrchestratorActivityFeed
                  orchestratorId={orchestrator.id}
                  workspaceSlug={workspaceSlug}
                  autoRefresh={orchestrator.status === 'ONLINE'}
                  refreshInterval={30000}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='capabilities' className='space-y-4 mt-6'>
            <Card>
              <CardHeader>
                <CardTitle>Capabilities</CardTitle>
                <CardDescription>
                  Skills and abilities enabled for this orchestrator
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orchestrator.capabilities &&
                orchestrator.capabilities.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {orchestrator.capabilities.map((capability, index) => (
                      <Badge key={index} variant='outline' className='text-sm'>
                        <Zap className='h-3 w-3 mr-1' />
                        {capability}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No capabilities configured
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Charter Editor Dialog */}
        <Dialog
          open={isCharterEditorOpen}
          onOpenChange={setIsCharterEditorOpen}
        >
          <DialogContent className='max-w-5xl max-h-[90vh] overflow-hidden'>
            <DialogHeader>
              <DialogTitle>Edit Charter</DialogTitle>
            </DialogHeader>
            <CharterEditor
              orchestratorId={orchestrator.id}
              initialCharter={orchestrator.charter || undefined}
              onSave={handleSaveCharter}
              onCancel={handleCloseCharterEditor}
            />
          </DialogContent>
        </Dialog>

        {/* Delegation Dialog */}
        <DelegationDialog
          open={isDelegationDialogOpen}
          onOpenChange={setIsDelegationDialogOpen}
          orchestratorId={orchestrator.id}
          onDelegationSuccess={() => {
            setDelegationRefreshTrigger(prev => prev + 1);
            refetch();
          }}
        />
      </div>

      {/* AI Chat Sidebar */}
      {isAIChatOpen && (
        <OrchestratorChat
          orchestrator={orchestrator}
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
        />
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='border rounded-lg p-4'>
      <p className='text-xs text-muted-foreground mb-1'>{label}</p>
      <p className='text-2xl font-bold'>{value}</p>
    </div>
  );
}

/**
 * Activity type configuration for visual styling
 */
const ACTIVITY_TYPE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  TASK_STARTED: {
    icon: Play,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  TASK_COMPLETED: { icon: Zap, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  TASK_UPDATED: {
    icon: Activity,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  STATUS_CHANGE: {
    icon: Clock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  MESSAGE_SENT: {
    icon: MessageSquare,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  CHANNEL_JOINED: {
    icon: Users,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  CHANNEL_LEFT: { icon: Users, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  DECISION_MADE: {
    icon: Brain,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  LEARNING_RECORDED: {
    icon: TrendingUp,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  CONVERSATION_INITIATED: {
    icon: MessageSquare,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
  },
  TASK_DELEGATED: {
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  TASK_ESCALATED: {
    icon: TrendingUp,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  ERROR_OCCURRED: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  SYSTEM_EVENT: {
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
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
  const workspaceSlug = params.workspaceSlug as string;

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

    if (diffSecs < 60) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

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
  const fetchActivities = useCallback(
    async (append = false) => {
      if (!workspaceSlug || !orchestratorId) {
        return;
      }

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
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/activity?${params.toString()}`
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
        const error =
          err instanceof Error ? err : new Error('Failed to fetch activities');
        setError(error);
        console.error('[ActivityLog] Error fetching activities:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [workspaceSlug, orchestratorId, cursor]
  );

  /**
   * Load more activities (pagination)
   */
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestratorId, workspaceSlug]); // Re-fetch when IDs change

  // Loading state
  if (isLoading) {
    return (
      <div className='space-y-3'>
        {[1, 2, 3].map(i => (
          <div key={i} className='flex gap-3 items-start animate-pulse'>
            <div className='h-8 w-8 rounded-full bg-muted' />
            <div className='flex-1 space-y-2'>
              <div className='h-4 bg-muted rounded w-3/4' />
              <div className='h-3 bg-muted rounded w-1/2' />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex flex-col items-center justify-center py-8'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 max-w-sm text-center'>
          <AlertCircle className='h-6 w-6 text-red-600 mx-auto mb-2' />
          <p className='text-sm text-red-800 font-medium'>
            Failed to load activity
          </p>
          <p className='text-xs text-red-600 mt-1'>{error.message}</p>
          <Button
            variant='outline'
            size='sm'
            onClick={handleRetry}
            className='mt-3'
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
      <div className='flex flex-col items-center justify-center py-12 text-center'>
        <Activity className='h-12 w-12 text-muted-foreground/50 mb-4' />
        <p className='text-sm font-medium text-muted-foreground'>
          No activity recorded yet
        </p>
        <p className='text-xs text-muted-foreground mt-1'>
          Activity will appear here as this orchestrator performs actions
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-3'>
        {activities.map(activity => {
          const config =
            ACTIVITY_TYPE_CONFIG[activity.type] ||
            ACTIVITY_TYPE_CONFIG.SYSTEM_EVENT;
          const IconComponent = config.icon;

          return (
            <div
              key={activity.id}
              className='flex gap-3 items-start p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  config.bgColor
                )}
              >
                <IconComponent className={cn('h-4 w-4', config.color)} />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium leading-tight'>
                  {activity.description}
                </p>
                <div className='flex items-center gap-2 mt-1'>
                  <span className='text-xs text-muted-foreground'>
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                  {activity.importance >= 7 && (
                    <Badge variant='outline' className='text-xs h-5 px-1.5'>
                      High Priority
                    </Badge>
                  )}
                </div>
                {activity.keywords && activity.keywords.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-2'>
                    {activity.keywords.slice(0, 3).map((keyword, idx) => (
                      <span
                        key={idx}
                        className='text-xs bg-muted px-1.5 py-0.5 rounded'
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
        <div className='flex justify-center pt-2'>
          <Button
            variant='outline'
            size='sm'
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
    <div className='space-y-6 animate-pulse'>
      <div className='h-8 bg-muted rounded w-1/3' />
      <Card>
        <CardHeader>
          <div className='flex gap-4'>
            <div className='h-16 w-16 bg-muted rounded-full' />
            <div className='flex-1 space-y-2'>
              <div className='h-8 bg-muted rounded w-1/2' />
              <div className='h-4 bg-muted rounded w-3/4' />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className='h-6 bg-muted rounded w-1/4' />
        </CardHeader>
        <CardContent>
          <div className='h-32 bg-muted rounded' />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Session Managers Tab Component
 *
 * Manages Session Managers for the Orchestrator with create/edit capabilities
 */
function SessionManagersTab({ orchestratorId }: { orchestratorId: string }) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // TODO: Use selectedSessionManager for detail view
  const [_selectedSessionManager, _setSelectedSessionManager] = useState<
    unknown | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateNew = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSelect = (sessionManager: unknown) => {
    _setSelectedSessionManager(sessionManager);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Session Manager Overview</CardTitle>
          <CardDescription>
            Session Managers orchestrate Claude Code/Flow sessions with up to 20
            subagents. They manage task distribution, token budgets, and
            coordination between subagents.
          </CardDescription>
        </CardHeader>
      </Card>

      <SessionManagerList
        key={refreshKey}
        orchestratorId={orchestratorId}
        onSelect={handleSelect}
        onCreateNew={handleCreateNew}
      />

      <SessionManagerCreate
        orchestratorId={orchestratorId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

/**
 * Subagents Tab Component
 *
 * Displays universal subagents and session-specific subagents
 */
function SubagentsTab() {
  const [selectedSessionManager, _setSelectedSessionManager] = useState<
    string | null
  >(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateNew = () => {
    if (!selectedSessionManager) {
      return;
    }
    setIsCreateDialogOpen(true);
  };

  const handleCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Subagent Management</CardTitle>
          <CardDescription>
            Subagents are specialized workers that perform tasks under Session
            Manager coordination. Universal subagents are available to all
            orchestrators.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Universal Subagents */}
      <div>
        <h3 className='text-lg font-semibold mb-4'>Universal Subagents</h3>
        <SubagentList key={`universal-${refreshKey}`} showUniversal={true} />
      </div>

      <Separator className='my-6' />

      {/* Session Manager Specific Subagents */}
      <div>
        <h3 className='text-lg font-semibold mb-4'>
          Session Manager Subagents
        </h3>
        {selectedSessionManager ? (
          <>
            <SubagentList
              key={`sm-${selectedSessionManager}-${refreshKey}`}
              sessionManagerId={selectedSessionManager}
              onCreateNew={handleCreateNew}
            />
            <SubagentCreate
              sessionManagerId={selectedSessionManager}
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onCreated={handleCreated}
            />
          </>
        ) : (
          <Card>
            <CardContent className='pt-6 text-center text-muted-foreground'>
              Select a Session Manager from the Session Managers tab to view and
              manage its subagents.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * Delegation Tab Component
 *
 * Displays delegation history, delegation form, and delegation rules
 */
interface DelegationTabProps {
  orchestratorId: string;
  onOpenDelegationDialog: () => void;
  refreshTrigger: number;
}

function DelegationTab({
  orchestratorId,
  onOpenDelegationDialog,
  refreshTrigger,
}: DelegationTabProps) {
  return (
    <>
      {/* Delegation Actions Card */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle>Task Delegation</CardTitle>
              <CardDescription>
                Delegate tasks to other orchestrators for distributed execution
              </CardDescription>
            </div>
            <Button onClick={onOpenDelegationDialog}>
              <GitBranch className='h-4 w-4 mr-2' />
              New Delegation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-3 gap-4'>
            <MetricCard label='Total Delegations' value='0' />
            <MetricCard label='Active Delegations' value='0' />
            <MetricCard label='Success Rate' value='0%' />
          </div>
        </CardContent>
      </Card>

      {/* Delegation History */}
      <DelegationHistory
        orchestratorId={orchestratorId}
        refreshTrigger={refreshTrigger}
      />

      {/* Delegation Rules */}
      <DelegationRules orchestratorId={orchestratorId} />
    </>
  );
}

/**
 * Charter Tab Component
 *
 * Displays charter information, version history, and management options
 */
interface CharterTabProps {
  orchestrator: Orchestrator;
  onOpenEditor: () => void;
  versions: Array<{
    version: number;
    charter: OrchestratorCharter;
    createdAt: string;
  }>;
  onRollback: (version: number) => void;
  compareVersion: number | null;
  onCompareVersion: (version: number | null) => void;
}

function CharterTab({
  orchestrator,
  onOpenEditor,
  versions,
  onRollback,
  compareVersion,
  onCompareVersion,
}: CharterTabProps) {
  const charter = orchestrator.charter;

  // Calculate charter stats
  const charterStats = React.useMemo(() => {
    if (!charter) {
      return null;
    }

    return {
      concurrentSessions: charter.operationalSettings?.autoEscalation
        ? 'Unlimited'
        : '20',
      tokenBudget: charter.operationalSettings?.responseTimeTarget
        ? `${charter.operationalSettings.responseTimeTarget}min target`
        : 'No limit',
      expertise: charter.expertise?.length || 0,
      values: charter.values?.length || 0,
    };
  }, [charter]);

  return (
    <>
      {/* Charter Status Card */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle>Charter Status</CardTitle>
              <CardDescription>
                Current charter configuration and operational parameters
              </CardDescription>
            </div>
            <Button onClick={onOpenEditor} disabled={!orchestrator}>
              <Edit className='h-4 w-4 mr-2' />
              Edit Charter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {charter ? (
            <div className='space-y-6'>
              {/* Quick Stats */}
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <MetricCard
                  label='Version'
                  value={
                    versions.length > 0 ? `v${versions[0]?.version || 1}` : 'v1'
                  }
                />
                <MetricCard
                  label='Last Modified'
                  value={
                    versions.length > 0
                      ? new Date(versions[0]?.createdAt).toLocaleDateString()
                      : new Date(orchestrator.updatedAt).toLocaleDateString()
                  }
                />
                <MetricCard
                  label='Expertise Areas'
                  value={charterStats?.expertise.toString() || '0'}
                />
                <MetricCard
                  label='Core Values'
                  value={charterStats?.values.toString() || '0'}
                />
              </div>

              <Separator />

              {/* Charter Summary */}
              <div className='space-y-4'>
                <div>
                  <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                    <FileText className='h-4 w-4' />
                    Mission Statement
                  </h4>
                  <p className='text-sm text-muted-foreground'>
                    {charter.mission}
                  </p>
                </div>

                <div>
                  <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                    <TrendingUp className='h-4 w-4' />
                    Vision
                  </h4>
                  <p className='text-sm text-muted-foreground'>
                    {charter.vision}
                  </p>
                </div>

                {charter.values && charter.values.length > 0 && (
                  <div>
                    <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                      <Tag className='h-4 w-4' />
                      Core Values
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      {charter.values.map((value: string, index: number) => (
                        <Badge key={index} variant='secondary'>
                          {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {charter.expertise && charter.expertise.length > 0 && (
                  <div>
                    <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                      <Brain className='h-4 w-4' />
                      Expertise
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      {charter.expertise.map((item: string, index: number) => (
                        <Badge key={index} variant='outline'>
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resource Limits */}
                <div>
                  <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                    <Settings className='h-4 w-4' />
                    Resource Limits
                  </h4>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <span className='text-muted-foreground'>
                        Concurrent Sessions:
                      </span>
                      <span className='ml-2 font-medium'>
                        {charterStats?.concurrentSessions}
                      </span>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>
                        Response Target:
                      </span>
                      <span className='ml-2 font-medium'>
                        {charterStats?.tokenBudget}
                      </span>
                    </div>
                    {charter.operationalSettings?.workHours && (
                      <>
                        <div>
                          <span className='text-muted-foreground'>
                            Work Hours:
                          </span>
                          <span className='ml-2 font-medium'>
                            {charter.operationalSettings.workHours.start} -{' '}
                            {charter.operationalSettings.workHours.end}
                          </span>
                        </div>
                        <div>
                          <span className='text-muted-foreground'>
                            Timezone:
                          </span>
                          <span className='ml-2 font-medium'>
                            {charter.operationalSettings.workHours.timezone}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Communication Preferences */}
                {charter.communicationPreferences && (
                  <div>
                    <h4 className='font-semibold text-sm mb-2 flex items-center gap-2'>
                      <MessageSquare className='h-4 w-4' />
                      Communication Preferences
                    </h4>
                    <div className='grid grid-cols-2 gap-3 text-sm'>
                      <div>
                        <span className='text-muted-foreground'>Tone:</span>
                        <span className='ml-2 font-medium capitalize'>
                          {charter.communicationPreferences.tone}
                        </span>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>
                          Response Length:
                        </span>
                        <span className='ml-2 font-medium capitalize'>
                          {charter.communicationPreferences.responseLength}
                        </span>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>
                          Formality:
                        </span>
                        <span className='ml-2 font-medium capitalize'>
                          {charter.communicationPreferences.formality}
                        </span>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>
                          Use Emoji:
                        </span>
                        <span className='ml-2 font-medium'>
                          {charter.communicationPreferences.useEmoji
                            ? 'Yes'
                            : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <FileText className='h-12 w-12 text-muted-foreground/50 mb-4' />
              <p className='text-sm font-medium text-muted-foreground'>
                No charter configured
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Create a charter to define mission, values, and operational
                parameters
              </p>
              <Button onClick={onOpenEditor} className='mt-4'>
                <FileText className='h-4 w-4 mr-2' />
                Create Charter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      {charter && versions.length > 0 && (
        <Card>
          <CardHeader>
            <div className='flex items-start justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <History className='h-5 w-5' />
                  Version History
                </CardTitle>
                <CardDescription>
                  Track changes and rollback to previous charter versions
                </CardDescription>
              </div>
              {compareVersion !== null && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onCompareVersion(null)}
                >
                  Clear Comparison
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {versions.map((versionData, index) => (
                <div
                  key={versionData.version}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  )}
                >
                  <div className='flex items-center gap-3'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium'>
                      v{versionData.version}
                    </div>
                    <div>
                      <p className='text-sm font-medium'>
                        Version {versionData.version}
                        {index === 0 && (
                          <Badge variant='default' className='ml-2'>
                            Current
                          </Badge>
                        )}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {new Date(versionData.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    {index > 0 && (
                      <>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => onCompareVersion(versionData.version)}
                        >
                          Compare
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => onRollback(versionData.version)}
                        >
                          <RotateCcw className='h-3 w-3 mr-1' />
                          Rollback
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version Comparison */}
      {compareVersion !== null && charter && (
        <Card>
          <CardHeader>
            <CardTitle>Version Comparison</CardTitle>
            <CardDescription>
              Comparing current version with version {compareVersion}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const oldVersion = versions.find(
                v => v.version === compareVersion
              );
              if (!oldVersion) {
                return (
                  <p className='text-sm text-muted-foreground'>
                    Version not found
                  </p>
                );
              }
              return (
                <CharterDiff
                  oldCharter={oldVersion.charter}
                  newCharter={charter}
                  oldVersion={compareVersion}
                  newVersion={versions[0]?.version || 1}
                />
              );
            })()}
          </CardContent>
        </Card>
      )}
    </>
  );
}
