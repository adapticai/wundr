'use client';

/**
 * Orchestrator Settings Form Component
 *
 * Main form component for orchestrator settings management.
 * Contains multiple sections with tabs for different settings categories.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import { CapabilitySettings } from './CapabilitySettings';
import { GeneralSettings } from './GeneralSettings';
import { IntegrationSettings } from './IntegrationSettings';
import { ModelSelector } from './ModelSelector';
import { ResponseTemplates } from './ResponseTemplates';
import { TriggerSettings } from './TriggerSettings';

import type { Prisma } from '@neolith/database';

type OrchestratorWithConfig = Prisma.orchestratorGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        displayName: true;
        avatarUrl: true;
        bio: true;
      };
    };
    organization: {
      select: {
        id: true;
        name: true;
        slug: true;
      };
    };
    config: true;
  };
}>;

interface OrchestratorSettingsFormProps {
  orchestrator: OrchestratorWithConfig;
  isAdmin: boolean;
  workspaceSlug: string;
}

export function OrchestratorSettingsForm({
  orchestrator,
  isAdmin,
}: OrchestratorSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState('general');

  const isLocked = orchestrator.config?.isLocked && !isAdmin;

  const handleSave = async (section: string, data: Record<string, unknown>) => {
    if (isLocked) {
      toast({
        title: 'Configuration Locked',
        description: 'This configuration is locked by an administrator.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestrator.id}/config`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update configuration');
      }

      toast({
        title: 'Settings Updated',
        description: `${section} settings have been saved successfully.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='space-y-6'>
      {isLocked && (
        <Card className='border-yellow-500 bg-yellow-50 dark:bg-yellow-950'>
          <CardHeader>
            <CardTitle className='text-yellow-800 dark:text-yellow-200'>
              Configuration Locked
            </CardTitle>
            <CardDescription className='text-yellow-700 dark:text-yellow-300'>
              These settings have been locked by an administrator. You can view
              but not modify them.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='space-y-6'
      >
        <TabsList className='grid w-full grid-cols-6 lg:w-auto'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='capabilities'>Capabilities</TabsTrigger>
          <TabsTrigger value='triggers'>Triggers</TabsTrigger>
          <TabsTrigger value='templates'>Templates</TabsTrigger>
          <TabsTrigger value='model'>Model</TabsTrigger>
          <TabsTrigger value='integrations'>Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='space-y-4'>
          <GeneralSettings
            config={orchestrator.config}
            user={orchestrator.user}
            onSave={data => handleSave('General', data)}
            disabled={isLocked || isPending}
          />
        </TabsContent>

        <TabsContent value='capabilities' className='space-y-4'>
          <CapabilitySettings
            orchestratorId={orchestrator.id}
            onSave={data => handleSave('Capabilities', data)}
            disabled={isLocked || isPending}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value='triggers' className='space-y-4'>
          <TriggerSettings
            config={orchestrator.config}
            orchestratorId={orchestrator.id}
            onSave={data => handleSave('Triggers', data)}
            disabled={isLocked || isPending}
          />
        </TabsContent>

        <TabsContent value='templates' className='space-y-4'>
          <ResponseTemplates
            config={orchestrator.config}
            onSave={data => handleSave('Response Templates', data)}
            disabled={isLocked || isPending}
          />
        </TabsContent>

        <TabsContent value='model' className='space-y-4'>
          <ModelSelector
            config={orchestrator.config}
            onSave={data => handleSave('Model', data)}
            disabled={isLocked || isPending}
          />
        </TabsContent>

        <TabsContent value='integrations' className='space-y-4'>
          <IntegrationSettings
            config={orchestrator.config}
            onSave={data => handleSave('Integrations', data)}
            disabled={isLocked || isPending}
          />
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <Card className='border-blue-500 bg-blue-50 dark:bg-blue-950'>
          <CardHeader>
            <CardTitle className='text-blue-800 dark:text-blue-200'>
              Admin Controls
            </CardTitle>
            <CardDescription className='text-blue-700 dark:text-blue-300'>
              As an administrator, you can lock or unlock this configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant={
                orchestrator.config?.isLocked ? 'destructive' : 'default'
              }
              onClick={() =>
                handleSave('Admin', {
                  isLocked: !orchestrator.config?.isLocked,
                })
              }
              disabled={isPending}
            >
              {orchestrator.config?.isLocked
                ? 'Unlock Configuration'
                : 'Lock Configuration'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
