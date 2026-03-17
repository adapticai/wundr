'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UnifiedChat } from '@/components/ai/unified-chat';
import {
  type GenerateOrgInput,
  type OrgGenerationResponse,
} from '@/lib/validations/org-genesis';

import { OrgPreview } from './org-preview';

/**
 * Organization Genesis Wizard
 *
 * Two-phase flow:
 * 1. Conversation - UnifiedChat collects org details through natural conversation
 * 2. Preview + Generate - Shows generated org structure, accept/regenerate buttons
 */
export function OrgGenesisWizard() {
  const router = useRouter();
  const [phase, setPhase] = useState<'conversation' | 'preview'>(
    'conversation'
  );
  const [conversationData, setConversationData] = useState<
    Record<string, unknown>
  >({});
  const [wizardData, setWizardData] = useState<GenerateOrgInput | null>(null);
  const [generatedOrg, setGeneratedOrg] =
    useState<OrgGenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateOrganization = useCallback(async (input: GenerateOrgInput) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces/generate-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || 'Failed to generate organization'
        );
      }

      // API returns { data: workspace, manifest, orchestrators, disciplines, agents, ... }
      const workspaceChannels = result.data?.channels || [];
      const orgData = {
        success: true,
        workspaceId: result.data?.id,
        manifest: result.manifest,
        orchestrators: result.orchestrators || [],
        disciplines: result.disciplines || [],
        agents: result.agents || [],
        metadata: result.metadata || {
          generatedAt: new Date().toISOString(),
          generatorVersion: '1.0.0',
          configHash: '',
          durationMs: result.durationMs || 0,
        },
        channels: workspaceChannels.map(
          (ch: {
            id: string;
            name: string;
            slug: string;
            type: string;
            _count?: { channelMembers?: number };
          }) => ({
            id: ch.id,
            name: ch.name,
            slug: ch.slug,
            type: ch.type,
            memberCount: ch._count?.channelMembers ?? 0,
          })
        ),
      };
      setGeneratedOrg(orgData as OrgGenerationResponse);
      setPhase('preview');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to generate organization:', err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleConversationComplete = useCallback(
    async (data: Record<string, unknown>) => {
      // Map conversation-extracted data to the format expected by generateOrganization()
      const mapped: GenerateOrgInput = {
        basicInfo: {
          name: (data.name as string) || 'My Organization',
          type:
            (data.organizationType as GenerateOrgInput['basicInfo']['type']) ||
            'other',
        },
        description: {
          description:
            (data.description as string) ||
            'Organization created via AI conversation',
          strategy: (data.strategy as string) || undefined,
        },
        config: {
          teamSize:
            (data.teamSize as GenerateOrgInput['config']['teamSize']) || '1-10',
          riskTolerance:
            (data.riskTolerance as GenerateOrgInput['config']['riskTolerance']) ||
            'medium',
        },
        charterData: {
          mission: (data.mission as string) || '',
          vision: (data.vision as string) || '',
          values: Array.isArray(data.values)
            ? (data.values as string[])
            : typeof data.values === 'string'
              ? [data.values as string]
              : [],
          principles: Array.isArray(data.principles)
            ? (data.principles as string[])
            : [],
          governanceStyle: (data.governance as string) || 'collaborative',
          communicationStyle: (data.communicationStyle as string) || 'balanced',
        },
      };

      setWizardData(mapped);
      await generateOrganization(mapped);
    },
    [generateOrganization]
  );

  const handleRegenerate = async () => {
    if (!wizardData) return;
    await generateOrganization(wizardData);
  };

  const handleAccept = async () => {
    if (!generatedOrg) return;

    setIsGenerating(true);
    setError(null);

    try {
      if (generatedOrg.workspaceId) {
        router.push(`/workspace/${generatedOrg.workspaceId}`);
      } else {
        throw new Error('No workspace ID returned from generation');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to navigate to workspace';
      setError(errorMessage);
      console.error('Failed to navigate to workspace:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const progressValue = phase === 'conversation' ? 50 : 100;

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      {/* Progress Header */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold'>Create Organization</h2>
          <Badge variant='outline'>
            {phase === 'conversation' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </Badge>
        </div>
        <Progress value={progressValue} className='h-2' />
      </div>

      {/* Error Display */}
      {error && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Phase Content */}
      {phase === 'conversation' ? (
        <div className='flex flex-col h-[600px]'>
          <UnifiedChat
            apiEndpoint='/api/wizard/chat'
            entityType='workspace'
            variant='embedded'
            persona={{
              name: 'Organization Architect',
              greeting:
                "Let's design your organization. Tell me about your company - what industry are you in, what's your team structure like, and what are your key objectives?",
              suggestions: [
                'Build a tech startup organization',
                'Set up a consulting firm structure',
                'Create a creative agency',
                'Design a research lab organization',
              ],
            }}
            progress={{
              enabled: true,
              requiredFields: [
                'name',
                'description',
                'organizationType',
                'teamSize',
              ],
              optionalFields: [
                'industry',
                'values',
                'governance',
                'riskTolerance',
              ],
            }}
            showToolCalls={false}
            enableActions
            onDataExtracted={data => {
              setConversationData(prev => ({ ...prev, ...data }));
            }}
            onReadyToCreate={data => {
              setConversationData(prev => ({ ...prev, ...data }));
              handleConversationComplete({ ...conversationData, ...data });
            }}
            className='flex-1'
          />
        </div>
      ) : (
        generatedOrg && (
          <OrgPreview
            orgData={generatedOrg}
            onRegenerate={handleRegenerate}
            onAccept={handleAccept}
            isRegenerating={isGenerating}
          />
        )
      )}
    </div>
  );
}
