/**
 * Creation Modal Component
 * Modal for creating entities via conversation or form
 * @module components/creation/creation-modal
 */
'use client';

import * as React from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';

import { ConversationalCreator } from './ConversationalCreator';
import { SpecReviewForm } from './spec-review-form';

import type { EntityType, EntitySpec } from './types';

export type CreationMode = 'conversation' | 'form';

export interface CreationModalProps {
  /** Type of entity to create */
  entityType: EntityType;
  /** Workspace ID context */
  workspaceId?: string;
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when entity is successfully created */
  onCreated?: (entity: unknown) => void;
  /** Initial mode (conversation or form) */
  initialMode?: CreationMode;
  /** Existing spec for editing */
  existingSpec?: EntitySpec;
}

/**
 * CreationModal - Main modal for entity creation
 *
 * Features:
 * - Toggle between conversation and form modes
 * - Conversational spec generation via LLM
 * - Form-based spec editing and review
 * - Entity creation API calls
 * - Success/error handling
 * - Loading states
 */
export function CreationModal({
  entityType,
  workspaceId,
  open,
  onOpenChange,
  onCreated,
  initialMode = 'conversation',
  existingSpec,
}: CreationModalProps) {
  const [mode, setMode] = React.useState<CreationMode>(initialMode);
  const [spec, setSpec] = React.useState<EntitySpec | null>(
    existingSpec || null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      // Small delay to avoid jarring visual changes during close animation
      const timeout = setTimeout(() => {
        setMode(initialMode);
        setSpec(existingSpec || null);
        setError(null);
        setIsSubmitting(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open, initialMode, existingSpec]);

  // Handle spec generation from conversation
  const handleSpecGenerated = (generatedSpec: EntitySpec) => {
    setSpec(generatedSpec);
    setMode('form');
  };

  // Handle back to chat from form
  const handleBackToChat = () => {
    setMode('conversation');
  };

  // Handle spec confirmation and entity creation
  const handleConfirmSpec = async (finalSpec: EntitySpec) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Call appropriate creation API based on entity type
      const entity = await createEntity(entityType, finalSpec, workspaceId);

      // Success - notify parent and close modal
      onCreated?.(entity);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entity');
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={mode === 'conversation' ? 'max-w-2xl' : 'max-w-3xl'}
        aria-describedby='creation-modal-description'
      >
        <div id='creation-modal-description' className='sr-only'>
          {mode === 'conversation'
            ? `Create a new ${entityType} through conversational interface`
            : `Review and edit ${entityType} specification`}
        </div>

        {/* Error display */}
        {error && (
          <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
            {error}
          </div>
        )}

        {/* Conversation Mode */}
        {mode === 'conversation' && (
          <ConversationalCreator
            entityType={entityType}
            workspaceId={workspaceId}
            onSpecGenerated={handleSpecGenerated}
            onCancel={handleCancel}
            existingSpec={spec || undefined}
            open={open}
          />
        )}

        {/* Form Mode */}
        {mode === 'form' && spec && (
          <SpecReviewForm
            entityType={entityType}
            spec={spec}
            onConfirm={handleConfirmSpec}
            onBackToChat={handleBackToChat}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Create entity via API
 * This is a placeholder that should be replaced with actual API calls
 */
async function createEntity(
  entityType: EntityType,
  spec: EntitySpec,
  workspaceId?: string
): Promise<unknown> {
  // TODO: Replace with actual API calls to your backend
  const endpoint = getEntityEndpoint(entityType);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...spec,
      workspaceId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to create ${entityType}`);
  }

  return response.json();
}

/**
 * Get API endpoint for entity type
 */
function getEntityEndpoint(entityType: EntityType): string {
  const endpoints: Record<EntityType, string> = {
    workspace: '/api/workspaces',
    orchestrator: '/api/orchestrators',
    'session-manager': '/api/session-managers',
    subagent: '/api/subagents',
    workflow: '/api/workflows',
    channel: '/api/channels',
  };
  return endpoints[entityType] || `/api/${entityType}s`;
}
