/**
 * Conversational Workflow Creation Page
 * @module app/(workspace)/[workspaceId]/workflows/new
 */
'use client';

import { AlertCircle, CheckCircle, GitBranch } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';
import { Button } from '@/components/ui/button';
import { WorkflowPreview } from '@/components/workflows/workflow-preview';

import type {
  TriggerConfig,
  ActionConfig,
  ActionId,
  CreateWorkflowInput,
} from '@/types/workflow';

interface WorkflowSpec {
  name: string;
  description: string;
  trigger: TriggerConfig | null;
  actions: Omit<ActionConfig, 'id' | 'order'>[];
  confidence: number;
  missingFields: string[];
  suggestions: string[];
}

/**
 * ConversationalWorkflowCreation - Chat-based workflow creation using UnifiedChat
 */
export default function ConversationalWorkflowCreationPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = (params?.workspaceSlug ?? '') as string;

  const [generatedSpec, setGeneratedSpec] = React.useState<WorkflowSpec | null>(
    null
  );
  const [showReview, setShowReview] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCreateWorkflow = async () => {
    if (!generatedSpec || !generatedSpec.trigger) {
      setError('Workflow specification is incomplete');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const workflowInput: CreateWorkflowInput = {
        name: generatedSpec.name,
        description: generatedSpec.description,
        trigger: generatedSpec.trigger,
        actions: generatedSpec.actions.map((action, index) => ({
          ...action,
          order: index,
        })),
      };

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowInput),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create workflow');
      }

      await response.json();
      router.push(`/${workspaceSlug}/workflows`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create workflow'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/${workspaceSlug}/workflows`);
  };

  // Review phase
  if (showReview && generatedSpec) {
    return (
      <div className='flex h-screen flex-col'>
        <div className='border-b bg-background px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-xl font-semibold'>Review Workflow</h1>
              <p className='text-sm text-muted-foreground'>
                Review and finalize your workflow before creating
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowReview(false)}
              >
                Back to Chat
              </Button>
              <Button type='button' onClick={handleCancel} variant='ghost'>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        <div className='flex-1 overflow-auto p-6'>
          <div className='mx-auto max-w-4xl space-y-6'>
            {/* Confidence & Status */}
            <div className='rounded-lg border bg-card p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {generatedSpec.confidence >= 0.7 ? (
                    <CheckCircle className='h-5 w-5 text-green-600' />
                  ) : (
                    <AlertCircle className='h-5 w-5 text-yellow-600' />
                  )}
                  <div>
                    <p className='font-medium'>
                      Specification Confidence:{' '}
                      {Math.round(generatedSpec.confidence * 100)}%
                    </p>
                    {generatedSpec.missingFields.length > 0 && (
                      <p className='text-sm text-muted-foreground'>
                        Missing: {generatedSpec.missingFields.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {generatedSpec.suggestions.length > 0 && (
                <div className='mt-3 rounded-md bg-muted/50 p-3'>
                  <p className='text-sm font-medium'>Suggestions:</p>
                  <ul className='mt-1 space-y-1'>
                    {generatedSpec.suggestions.map((suggestion, idx) => (
                      <li key={idx} className='text-sm text-muted-foreground'>
                        &bull; {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Workflow Details */}
            <div className='rounded-lg border bg-card p-6'>
              <h2 className='mb-4 text-lg font-semibold'>Workflow Details</h2>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground'>
                    Name
                  </label>
                  <input
                    type='text'
                    value={generatedSpec.name}
                    onChange={e =>
                      setGeneratedSpec({
                        ...generatedSpec,
                        name: e.target.value,
                      })
                    }
                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    placeholder='My Workflow'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-foreground'>
                    Description
                  </label>
                  <textarea
                    value={generatedSpec.description}
                    onChange={e =>
                      setGeneratedSpec({
                        ...generatedSpec,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    placeholder='Describe what this workflow does...'
                  />
                </div>
              </div>
            </div>

            {/* Visual Workflow Preview */}
            {generatedSpec.trigger && (
              <WorkflowPreview
                name={generatedSpec.name}
                description={generatedSpec.description}
                trigger={generatedSpec.trigger}
                actions={generatedSpec.actions.map(
                  (action, index) =>
                    ({
                      ...action,
                      id: `preview-${index}` as ActionId,
                      order: index,
                    }) as ActionConfig
                )}
              />
            )}

            {/* Error Display */}
            {error && (
              <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className='flex justify-end gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowReview(false)}
                disabled={isSaving}
              >
                Back to Chat
              </Button>
              <Button
                type='button'
                onClick={handleCreateWorkflow}
                disabled={
                  isSaving ||
                  !generatedSpec.name.trim() ||
                  !generatedSpec.trigger ||
                  generatedSpec.actions.length === 0
                }
              >
                {isSaving ? 'Creating...' : 'Create Workflow'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Conversation phase
  return (
    <div className='flex h-screen flex-col'>
      {/* Header */}
      <div className='border-b bg-background px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-xl font-semibold'>Create Workflow</h1>
            <p className='text-sm text-muted-foreground'>
              Describe what you want to automate and we will build it for you
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {generatedSpec && generatedSpec.trigger && (
              <div className='flex items-center gap-2 text-sm text-muted-foreground mr-2'>
                <GitBranch className='h-4 w-4' />
                <span>
                  {generatedSpec.actions.length} action
                  {generatedSpec.actions.length !== 1 ? 's' : ''} configured
                </span>
              </div>
            )}
            <Button type='button' onClick={handleCancel} variant='ghost'>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Chat */}
      <UnifiedChat
        apiEndpoint='/api/wizard/chat'
        entityType='workflow'
        variant='embedded'
        persona={{
          name: 'Workflow Builder',
          greeting:
            'I\'ll help you create a new workflow. Describe what you want to automate. For example:\n- "Send a welcome message when someone joins a channel"\n- "Notify my team when a specific keyword is mentioned"\n- "Post a daily summary every morning at 9 AM"\n\nWhat would you like your workflow to do?',
          suggestions: [
            'Send a welcome message on channel join',
            'Daily summary notification at 9 AM',
            'Alert team on keyword mention',
          ],
        }}
        progress={{
          enabled: true,
          requiredFields: ['name', 'description', 'trigger'],
        }}
        showToolCalls={false}
        enableActions
        requestBody={{ workspaceId: workspaceSlug }}
        onDataExtracted={data => {
          setGeneratedSpec(prev => ({
            name: (data.name as string) || prev?.name || '',
            description:
              (data.description as string) || prev?.description || '',
            trigger: (data.trigger as TriggerConfig) || prev?.trigger || null,
            actions:
              (data.actions as Omit<ActionConfig, 'id' | 'order'>[]) ||
              prev?.actions ||
              [],
            confidence: 0.7,
            missingFields: [],
            suggestions: [],
          }));
        }}
        onReadyToCreate={data => {
          setGeneratedSpec({
            name: (data.name as string) || '',
            description: (data.description as string) || '',
            trigger: (data.trigger as TriggerConfig) || null,
            actions:
              (data.actions as Omit<ActionConfig, 'id' | 'order'>[]) || [],
            confidence: 0.8,
            missingFields: [],
            suggestions: [],
          });
          setShowReview(true);
        }}
        className='flex-1'
      />
    </div>
  );
}
