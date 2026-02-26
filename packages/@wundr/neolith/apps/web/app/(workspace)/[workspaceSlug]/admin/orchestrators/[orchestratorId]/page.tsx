'use client';

import {
  ArrowLeft,
  GitBranch,
  MessageSquare,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import { OrchestratorActivity } from '@/components/admin/orchestrators/orchestrator-activity';
import { OrchestratorConfig } from '@/components/admin/orchestrators/orchestrator-config';
import { OrchestratorMetrics } from '@/components/admin/orchestrators/orchestrator-metrics';
import { OrchestratorStatusBadge } from '@/components/admin/orchestrators/orchestrator-status';
import { AgentActivityTimeline } from '@/components/orchestrator/agent-activity-timeline';
import { DaemonStatusWidget } from '@/components/orchestrator/daemon-status-widget';
import { DelegationChainVisualization } from '@/components/orchestrator/delegation-chain-visualization';
import { OrchestratorConversationThread } from '@/components/orchestrator/orchestrator-conversation-thread';
import { SessionManagerCreate } from '@/components/orchestrator/session-manager-create';
import { SessionManagerList } from '@/components/orchestrator/session-manager-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useOrchestrator,
  useOrchestratorMutations,
} from '@/hooks/use-orchestrator';

import type { Orchestrator } from '@/types/orchestrator';

export default function AdminOrchestratorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateSessionManager, setShowCreateSessionManager] =
    useState(false);

  const { orchestrator, isLoading, error, refetch } =
    useOrchestrator(orchestratorId);
  const {
    updateOrchestrator,
    deleteOrchestrator,
    toggleOrchestratorStatus,
    isLoading: isMutating,
  } = useOrchestratorMutations();

  useEffect(() => {
    if (orchestrator) {
      setPageHeader(
        orchestrator.title,
        'Manage orchestrator configuration and monitor activity'
      );
    }
  }, [orchestrator, setPageHeader]);

  const handleBack = useCallback(() => {
    router.push(`/${workspaceSlug}/admin/orchestrators`);
  }, [router, workspaceSlug]);

  const handleToggleStatus = useCallback(async () => {
    if (!orchestrator) {
      return;
    }
    await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
    refetch();
  }, [orchestrator, toggleOrchestratorStatus, refetch]);

  const handleSaveConfig = useCallback(
    async (updates: Partial<Orchestrator>) => {
      if (!orchestrator) {
        return;
      }
      // Convert Orchestrator partial to UpdateOrchestratorInput
      const updateInput = {
        title: updates.title,
        description: updates.description ?? undefined,
        discipline: updates.discipline ?? undefined,
        status: updates.status,
        systemPrompt: updates.systemPrompt ?? undefined,
        capabilities: updates.capabilities,
      };
      await updateOrchestrator(orchestrator.id, updateInput);
      refetch();
    },
    [orchestrator, updateOrchestrator, refetch]
  );

  const handleDelete = useCallback(async () => {
    if (!orchestrator) {
      return;
    }
    await deleteOrchestrator(orchestrator.id);
    router.push(`/${workspaceSlug}/admin/orchestrators`);
  }, [orchestrator, deleteOrchestrator, router, workspaceSlug]);

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <div className='h-8 w-8 animate-pulse rounded bg-muted' />
          <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        </div>
        <div className='h-96 animate-pulse rounded-lg bg-muted' />
      </div>
    );
  }

  if (error || !orchestrator) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 max-w-md'>
          <h3 className='text-lg font-semibold text-red-800'>
            Failed to load orchestrator
          </h3>
          <p className='mt-2 text-sm text-red-600'>
            {error?.message || 'Orchestrator not found'}
          </p>
          <div className='mt-4 flex gap-2'>
            <Button variant='outline' onClick={handleBack}>
              Go Back
            </Button>
            <Button onClick={refetch}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' onClick={handleBack}>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-2xl font-bold'>{orchestrator.title}</h1>
            <p className='text-sm text-muted-foreground'>
              {orchestrator.discipline || 'No discipline set'}
            </p>
          </div>
          <OrchestratorStatusBadge status={orchestrator.status} />
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
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
            variant='destructive'
            onClick={() => setShowDeleteDialog(true)}
            disabled={isMutating}
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Delete
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className='flex items-start gap-4'>
            <div className='flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary text-2xl font-bold'>
              {orchestrator.avatarUrl ? (
                <img
                  src={orchestrator.avatarUrl}
                  alt={orchestrator.title}
                  className='h-full w-full rounded-lg object-cover'
                />
              ) : (
                orchestrator.title.substring(0, 2).toUpperCase()
              )}
            </div>
            <div className='flex-1'>
              <CardTitle>{orchestrator.title}</CardTitle>
              <CardDescription className='mt-2'>
                {orchestrator.description || 'No description provided'}
              </CardDescription>
              {Array.isArray(orchestrator.capabilities) &&
                orchestrator.capabilities.length > 0 && (
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {orchestrator.capabilities.map((capability, index) => (
                      <Badge key={index} variant='secondary'>
                        {capability}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-7'>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='activity'>Activity</TabsTrigger>
          <TabsTrigger value='configuration'>Configuration</TabsTrigger>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
          <TabsTrigger value='daemon'>Daemon &amp; Sessions</TabsTrigger>
          <TabsTrigger value='conversations'>Conversations</TabsTrigger>
          <TabsTrigger value='delegation'>Delegation</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6 mt-6'>
          <div className='grid gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Discipline
                  </p>
                  <p className='text-sm'>
                    {orchestrator.discipline || 'Not set'}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Created
                  </p>
                  <p className='text-sm'>
                    {new Date(orchestrator.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Last Active
                  </p>
                  <p className='text-sm'>
                    {orchestrator.lastActivityAt
                      ? new Date(
                          orchestrator.lastActivityAt
                        ).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Messages
                    </p>
                    <p className='text-2xl font-bold'>
                      {orchestrator.messageCount}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Agents
                    </p>
                    <p className='text-2xl font-bold'>
                      {orchestrator.agentCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {orchestrator.charter && (
            <Card>
              <CardHeader>
                <CardTitle>Charter</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <p className='text-sm font-semibold'>Mission</p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    {orchestrator.charter.mission}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className='text-sm font-semibold'>Vision</p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    {orchestrator.charter.vision}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='activity' className='mt-6'>
          <OrchestratorActivity orchestratorId={orchestrator.id} />
        </TabsContent>

        <TabsContent value='configuration' className='mt-6'>
          <OrchestratorConfig
            orchestrator={orchestrator}
            onSave={handleSaveConfig}
            isLoading={isMutating}
          />
        </TabsContent>

        <TabsContent value='performance' className='mt-6'>
          <OrchestratorMetrics
            orchestratorId={orchestrator.id}
            totalMessages={orchestrator.messageCount}
            activeConversations={orchestrator.agentCount}
          />
        </TabsContent>

        <TabsContent value='daemon' className='mt-6 space-y-6'>
          {/* Daemon Status */}
          <DaemonStatusWidget workspaceId={workspaceSlug} />

          <div className='grid gap-6 lg:grid-cols-2'>
            {/* Session Managers */}
            <SessionManagerList
              orchestratorId={orchestrator.id}
              onCreateNew={() => setShowCreateSessionManager(true)}
            />

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>
                  Recent agent routing and task events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentActivityTimeline
                  workspaceId={workspaceSlug}
                  orchestratorId={orchestrator.id}
                  limit={20}
                />
              </CardContent>
            </Card>
          </div>

          <SessionManagerCreate
            orchestratorId={orchestrator.id}
            open={showCreateSessionManager}
            onOpenChange={setShowCreateSessionManager}
            onCreated={() => setShowCreateSessionManager(false)}
          />
        </TabsContent>
        <TabsContent value='conversations' className='mt-6'>
          <section className='space-y-3'>
            <div className='flex items-center gap-2'>
              <MessageSquare className='h-5 w-5 text-muted-foreground' />
              <h2 className='text-base font-semibold'>Conversations</h2>
            </div>
            <OrchestratorConversationThread
              orchestratorId={orchestratorId}
              maxHeight='500px'
            />
          </section>
        </TabsContent>

        <TabsContent value='delegation' className='mt-6'>
          <section className='space-y-3'>
            <div className='flex items-center gap-2'>
              <GitBranch className='h-5 w-5 text-muted-foreground' />
              <h2 className='text-base font-semibold'>Delegation Chain</h2>
            </div>
            <DelegationChainVisualization
              workspaceId={workspaceSlug}
              orchestratorId={orchestratorId}
            />
          </section>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orchestrator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {orchestrator.title}? This action
              cannot be undone. All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
