/**
 * New OrchestratorCreation Page
 *
 * Conversational wizard for creating new Orchestrators (VPs).
 * Guides users through defining role, goals, capabilities, personality, and communication style.
 *
 * @module app/(workspace)/[workspaceId]/orchestrators/new/page
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { usePageHeader } from '@/contexts/page-header-context';
import { ConversationalCreator } from '@/components/creation/conversational-creator';
import { SpecReviewForm } from '@/components/creation/spec-review-form';
import { Button } from '@/components/ui/button';
import type { EntitySpec } from '@/components/creation/types';
import type { CreateOrchestratorInput } from '@/types/orchestrator';

type ViewMode = 'conversation' | 'review';

export default function NewOrchestratorPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [viewMode, setViewMode] = useState<ViewMode>('conversation');
  const [spec, setSpec] = useState<EntitySpec | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set page header
  useEffect(() => {
    setPageHeader('Create New Orchestrator', 'Define an AI-powered orchestrator through conversation');
  }, [setPageHeader]);

  // Handle spec generation from conversation
  const handleSpecGenerated = useCallback((generatedSpec: EntitySpec) => {
    setSpec(generatedSpec);
    setViewMode('review');
  }, []);

  // Handle back to conversation
  const handleBackToConversation = useCallback(() => {
    setViewMode('conversation');
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push(`/${workspaceSlug}/orchestrators`);
  }, [router, workspaceSlug]);

  // Handle orchestrator creation
  const handleCreateOrchestrator = useCallback(
    async (finalSpec: EntitySpec) => {
      setIsCreating(true);
      setError(null);

      try {
        // Transform the spec into CreateOrchestratorInput format
        const input: CreateOrchestratorInput = {
          title: finalSpec.name,
          discipline: extractDiscipline(finalSpec),
          description: finalSpec.description,
          charter: {
            mission: finalSpec.role || '',
            vision: finalSpec.charter || '',
            values: extractValues(finalSpec),
            personality: {
              traits: extractTraits(finalSpec),
              communicationStyle: extractCommunicationStyle(finalSpec),
              decisionMakingStyle: extractDecisionMakingStyle(finalSpec),
              background: finalSpec.charter || '',
            },
            expertise: extractExpertise(finalSpec),
            communicationPreferences: {
              tone: 'professional',
              responseLength: 'balanced',
              formality: 'medium',
              useEmoji: false,
            },
            operationalSettings: {
              workHours: {
                start: '09:00',
                end: '17:00',
                timezone: 'UTC',
              },
              responseTimeTarget: 30,
              autoEscalation: false,
              escalationThreshold: 60,
            },
          },
          capabilities: extractCapabilities(finalSpec),
        };

        // Create the orchestrator via API
        const response = await fetch(`/api/workspaces/${workspaceSlug}/orchestrators`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create orchestrator');
        }

        const result = await response.json();

        // Navigate to the new orchestrator's page
        router.push(`/${workspaceSlug}/orchestrators/${result.data.id}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create orchestrator';
        setError(errorMessage);
        console.error('Failed to create orchestrator:', err);
        setIsCreating(false);
      }
    },
    [workspaceSlug, router],
  );

  return (
    <div className="mx-auto h-full max-w-5xl">
      {/* Header with Back Button */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          disabled={isCreating}
          aria-label="Back to orchestrators list"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'conversation'
              ? 'Chat with AI to define your orchestrator'
              : 'Review and finalize your orchestrator configuration'}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="rounded-lg border bg-card shadow-sm">
        {viewMode === 'conversation' && (
          <ConversationalCreator
            entityType="orchestrator"
            workspaceId={workspaceSlug}
            onSpecGenerated={handleSpecGenerated}
            onCancel={handleCancel}
            existingSpec={spec || undefined}
            open={true}
          />
        )}

        {viewMode === 'review' && spec && (
          <SpecReviewForm
            entityType="orchestrator"
            spec={spec}
            onConfirm={handleCreateOrchestrator}
            onBackToChat={handleBackToConversation}
            onCancel={handleCancel}
            isSubmitting={isCreating}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-3 rounded-lg bg-card p-6 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Creating orchestrator...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions to extract data from EntitySpec

function extractDiscipline(spec: EntitySpec): string {
  // Try to extract from properties or role
  if (spec.properties?.discipline && typeof spec.properties.discipline === 'string') {
    return spec.properties.discipline;
  }

  // Default disciplines based on role keywords
  const role = (spec.role || '').toLowerCase();
  if (role.includes('engineer') || role.includes('technical')) {
    return 'Engineering';
  }
  if (role.includes('product')) {
    return 'Product';
  }
  if (role.includes('design')) {
    return 'Design';
  }
  if (role.includes('marketing')) {
    return 'Marketing';
  }
  if (role.includes('sales')) {
    return 'Sales';
  }
  if (role.includes('support') || role.includes('customer')) {
    return 'Customer Success';
  }

  return 'Operations';
}

function extractValues(spec: EntitySpec): string[] {
  if (
    spec.properties?.values &&
    Array.isArray(spec.properties.values) &&
    spec.properties.values.every((item): item is string => typeof item === 'string')
  ) {
    return spec.properties.values;
  }
  return ['Collaboration', 'Excellence', 'Innovation'];
}

function extractTraits(spec: EntitySpec): string[] {
  if (
    spec.properties?.traits &&
    Array.isArray(spec.properties.traits) &&
    spec.properties.traits.every((item): item is string => typeof item === 'string')
  ) {
    return spec.properties.traits;
  }

  // Extract from charter or role
  const text = `${spec.role} ${spec.charter}`.toLowerCase();
  const traits: string[] = [];

  if (text.includes('analytical') || text.includes('data')) {
    traits.push('Analytical');
  }
  if (text.includes('creative') || text.includes('innovative')) {
    traits.push('Creative', 'Innovative');
  }
  if (text.includes('detail') || text.includes('precise')) {
    traits.push('Detail-oriented');
  }
  if (text.includes('empathetic') || text.includes('supportive')) {
    traits.push('Empathetic', 'Supportive');
  }
  if (text.includes('strategic')) {
    traits.push('Strategic');
  }
  if (text.includes('technical')) {
    traits.push('Technical');
  }

  // Ensure at least one trait
  if (traits.length === 0) {
    traits.push('Proactive', 'Strategic');
  }

  return traits;
}

function extractCommunicationStyle(spec: EntitySpec): string {
  if (spec.properties?.communicationStyle && typeof spec.properties.communicationStyle === 'string') {
    return spec.properties.communicationStyle;
  }

  const role = (spec.role || '').toLowerCase();
  if (role.includes('executive') || role.includes('lead')) {
    return 'Direct and authoritative, providing clear guidance and decisions';
  }
  if (role.includes('support') || role.includes('customer')) {
    return 'Friendly and empathetic, focused on understanding and helping';
  }
  if (role.includes('technical') || role.includes('engineer')) {
    return 'Precise and detailed, with technical depth when needed';
  }

  return 'Professional and collaborative, adapting to context';
}

function extractDecisionMakingStyle(spec: EntitySpec): string {
  if (spec.properties?.decisionMakingStyle && typeof spec.properties.decisionMakingStyle === 'string') {
    return spec.properties.decisionMakingStyle;
  }

  const role = (spec.role || '').toLowerCase();
  if (role.includes('analyst') || role.includes('data')) {
    return 'Data-driven and analytical';
  }
  if (role.includes('creative') || role.includes('design')) {
    return 'Intuitive and innovative';
  }

  return 'Balanced approach considering multiple factors';
}

function extractExpertise(spec: EntitySpec): string[] {
  if (
    spec.properties?.expertise &&
    Array.isArray(spec.properties.expertise) &&
    spec.properties.expertise.every((item): item is string => typeof item === 'string')
  ) {
    return spec.properties.expertise;
  }

  const role = (spec.role || '').toLowerCase();
  const charter = (spec.charter || '').toLowerCase();
  const text = `${role} ${charter}`;
  const expertise: string[] = [];

  // Extract expertise based on keywords
  if (text.includes('leader') || text.includes('management')) {
    expertise.push('Leadership', 'Team Management');
  }
  if (text.includes('strategy') || text.includes('planning')) {
    expertise.push('Strategic Planning');
  }
  if (text.includes('technical') || text.includes('engineering')) {
    expertise.push('Technical Architecture', 'System Design');
  }
  if (text.includes('customer') || text.includes('support')) {
    expertise.push('Customer Relations', 'Support Operations');
  }
  if (text.includes('product')) {
    expertise.push('Product Strategy', 'Roadmap Planning');
  }
  if (text.includes('data') || text.includes('analytics')) {
    expertise.push('Data Analysis', 'Business Intelligence');
  }

  // Ensure at least some expertise
  if (expertise.length === 0) {
    expertise.push('Cross-functional Collaboration', 'Process Optimization');
  }

  return expertise;
}

function extractCapabilities(spec: EntitySpec): string[] {
  if (
    spec.properties?.capabilities &&
    Array.isArray(spec.properties.capabilities) &&
    spec.properties.capabilities.every((item): item is string => typeof item === 'string')
  ) {
    return spec.properties.capabilities;
  }

  // Default capabilities for orchestrators
  return [
    'Task Planning',
    'Team Coordination',
    'Decision Making',
    'Communication Management',
    'Progress Tracking',
  ];
}
