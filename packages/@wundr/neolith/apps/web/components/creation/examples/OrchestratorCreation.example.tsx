/**
 * Example: Creating an Orchestrator using ConversationalCreator
 *
 * This example shows how to integrate the ConversationalCreator
 * component with a form view for creating orchestrators.
 */

'use client';

import * as React from 'react';

import { ConversationalCreator } from '../ConversationalCreator';
import type { EntitySpec } from '../types';

/**
 * Example component showing orchestrator creation flow
 */
export function OrchestratorCreationExample() {
  const [mode, setMode] = React.useState<'chat' | 'form' | 'idle'>('idle');
  const [spec, setSpec] = React.useState<EntitySpec | null>(null);

  const handleStartCreation = () => {
    setMode('chat');
  };

  const handleSpecGenerated = (generatedSpec: EntitySpec) => {
    setSpec(generatedSpec);
    setMode('form');
  };

  const handleCancel = () => {
    setMode('idle');
    setSpec(null);
  };

  const handleFormSubmit = async (formData: EntitySpec) => {
    console.log('Creating orchestrator with data:', formData);
    // Call API to create orchestrator
    try {
      const response = await fetch('/api/orchestrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const created = await response.json();
        console.log('Orchestrator created:', created);
        handleCancel();
      }
    } catch (error) {
      console.error('Failed to create orchestrator:', error);
    }
  };

  return (
    <div>
      {/* Trigger button */}
      {mode === 'idle' && (
        <button
          onClick={handleStartCreation}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Create New Orchestrator
        </button>
      )}

      {/* Conversational creation dialog */}
      {mode === 'chat' && (
        <ConversationalCreator
          entityType="orchestrator"
          workspaceId="workspace-123"
          onSpecGenerated={handleSpecGenerated}
          onCancel={handleCancel}
          open={mode === 'chat'}
        />
      )}

      {/* Form view (placeholder) */}
      {mode === 'form' && spec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6">
            <h2 className="mb-4 text-2xl font-bold">
              Review Orchestrator Configuration
            </h2>

            {/* This would be replaced with your actual form component */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  defaultValue={spec.name}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Role</label>
                <input
                  type="text"
                  defaultValue={spec.role}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Charter</label>
                <textarea
                  defaultValue={spec.charter}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>

              {/* Missing fields warning */}
              {spec.missingFields.length > 0 && (
                <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  <strong>Missing fields:</strong>{' '}
                  {spec.missingFields.join(', ')}
                </div>
              )}

              {/* Suggestions */}
              {spec.suggestions.length > 0 && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Suggestions:</strong>
                  <ul className="mt-1 list-inside list-disc">
                    {spec.suggestions.map((suggestion, i) => (
                      <li key={i}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setMode('chat')}
                className="rounded-md border px-4 py-2 hover:bg-accent"
              >
                Back to Chat
              </button>
              <div className="space-x-2">
                <button
                  onClick={handleCancel}
                  className="rounded-md border px-4 py-2 hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFormSubmit(spec)}
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                >
                  Create Orchestrator
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Multiple entity types
 */
export function MultiEntityCreationExample() {
  const [entityType, setEntityType] = React.useState<
    'orchestrator' | 'workflow' | 'channel' | null
  >(null);

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => setEntityType('orchestrator')}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Create Orchestrator
        </button>
        <button
          onClick={() => setEntityType('workflow')}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Create Workflow
        </button>
        <button
          onClick={() => setEntityType('channel')}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Create Channel
        </button>
      </div>

      {entityType && (
        <ConversationalCreator
          entityType={entityType}
          workspaceId="workspace-123"
          onSpecGenerated={(spec) => {
            console.log('Generated spec:', spec);
            setEntityType(null);
          }}
          onCancel={() => setEntityType(null)}
          open={entityType !== null}
        />
      )}
    </div>
  );
}

/**
 * Example: Editing existing entity
 */
export function EditEntityExample() {
  const existingOrchestratorSpec: EntitySpec = {
    entityType: 'orchestrator',
    name: 'Support Agent Sarah',
    description: 'Customer support orchestrator for tier 1 tickets',
    role: 'Customer Support Lead',
    charter:
      'Handle tier 1 support tickets via #support channel. Escalate complex issues to human supervisors.',
    confidence: 1.0,
    missingFields: [],
    suggestions: [],
  };

  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => setIsEditing(true)}
        className="rounded-md border px-4 py-2 hover:bg-accent"
      >
        Modify Orchestrator with AI
      </button>

      {isEditing && (
        <ConversationalCreator
          entityType="orchestrator"
          workspaceId="workspace-123"
          existingSpec={existingOrchestratorSpec}
          onSpecGenerated={(spec) => {
            console.log('Updated spec:', spec);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          open={isEditing}
        />
      )}
    </div>
  );
}
