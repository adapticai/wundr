'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Pause, Play, Trash2 } from 'lucide-react';

import { usePageHeader } from '@/contexts/page-header-context';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

import { OrchestratorStatusBadge } from '@/components/admin/orchestrators/orchestrator-status';
import { OrchestratorMetrics } from '@/components/admin/orchestrators/orchestrator-metrics';
import { OrchestratorActivity } from '@/components/admin/orchestrators/orchestrator-activity';
import { OrchestratorConfig } from '@/components/admin/orchestrators/orchestrator-config';

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
    if (!orchestrator) return;
    await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
    refetch();
  }, [orchestrator, toggleOrchestratorStatus, refetch]);

  const handleSaveConfig = useCallback(
    async (updates: Partial<Orchestrator>) => {
      if (!orchestrator) return;
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
    if (!orchestrator) return;
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

  const mockActivities = [
    {
      id: '1',
      type: 'message' as const,
      description: 'Processed 15 new messages in #engineering channel',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: '2',
      type: 'config' as const,
      description: 'System prompt updated',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: '3',
      type: 'assignment' as const,
      description: 'Assigned to 3 new channels',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ];

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
              <div className='mt-4 flex flex-wrap gap-2'>
                {orchestrator.capabilities?.map((capability, index) => (
                  <Badge key={index} variant='secondary'>
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='activity'>Activity</TabsTrigger>
          <TabsTrigger value='configuration'>Configuration</TabsTrigger>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
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
          <OrchestratorActivity
            orchestratorId={orchestrator.id}
            activities={mockActivities}
          />
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
            avgResponseTime='2.3s'
            successRate='98.5%'
          />
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
