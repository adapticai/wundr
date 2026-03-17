'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';
import type { ChatPersona } from '@/components/ai/unified-chat';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { EntitySpec, EntityType } from './types';

/**
 * Props for the ConversationalCreator component
 */
export interface ConversationalCreatorProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Callback when spec is generated and ready for form view */
  onSpecGenerated: (spec: EntitySpec) => void;
  /** Callback when user cancels creation */
  onCancel: () => void;
  /** Optional existing spec for modifications */
  existingSpec?: EntitySpec;
  /** Optional workspace context */
  workspaceId?: string;
  /** Whether dialog is open */
  open?: boolean;
}

function getPersonaForEntity(type: EntityType): ChatPersona {
  const personas: Record<string, ChatPersona> = {
    workspace: {
      name: 'Workspace Assistant',
      greeting: "Let's create your workspace. What will it be used for?",
      suggestions: [
        'Engineering team workspace',
        'Project management',
        'Client collaboration',
      ],
    },
    orchestrator: {
      name: 'Agent Architect',
      greeting:
        "I'll help you design an orchestrator agent. What role should this agent play in your organization?",
      suggestions: [
        'Team lead agent',
        'Process coordinator',
        'Quality reviewer',
      ],
    },
    'session-manager': {
      name: 'Session Designer',
      greeting:
        "Let's configure a session manager. What context should it manage?",
      suggestions: [
        'Engineering sessions',
        'Client meetings',
        'Sprint planning',
      ],
    },
    workflow: {
      name: 'Workflow Builder',
      greeting:
        "I'll help you build a workflow. What process do you want to automate?",
      suggestions: [
        'Approval workflow',
        'Onboarding process',
        'Code review pipeline',
      ],
    },
    channel: {
      name: 'Channel Setup',
      greeting: "Let's create a channel. What topic or team is it for?",
      suggestions: [
        'Team discussion channel',
        'Project updates',
        'Announcements',
      ],
    },
    subagent: {
      name: 'Agent Builder',
      greeting:
        "I'll help you create a specialized sub-agent. What capabilities does it need?",
      suggestions: ['Code reviewer', 'Data analyst', 'Content writer'],
    },
  };
  return personas[type] || personas.workspace;
}

function getRequiredFields(type: string): string[] {
  const fields: Record<string, string[]> = {
    workspace: ['name', 'description', 'organizationType'],
    orchestrator: ['name', 'role', 'description'],
    'session-manager': ['name', 'responsibilities', 'context'],
    workflow: ['name', 'description', 'trigger'],
    channel: ['name', 'description', 'type'],
    subagent: ['name', 'description', 'capabilities'],
  };
  return fields[type] || ['name', 'description'];
}

/**
 * ConversationalCreator - Chat-based component for creating entities via LLM conversation
 *
 * Wraps UnifiedChat in a Dialog with entity-specific personas and progress tracking.
 */
export function ConversationalCreator({
  entityType,
  onSpecGenerated,
  onCancel,
  workspaceId,
  open = true,
}: ConversationalCreatorProps) {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onCancel()}>
      <DialogContent className='flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0'>
        <DialogHeader className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <DialogTitle>
              Create New {getEntityDisplayName(entityType)}
            </DialogTitle>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6'
              onClick={onCancel}
            >
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </Button>
          </div>
        </DialogHeader>

        <UnifiedChat
          apiEndpoint='/api/wizard/chat'
          entityType={entityType}
          variant='dialog'
          persona={getPersonaForEntity(entityType)}
          progress={{
            enabled: true,
            requiredFields: getRequiredFields(entityType),
          }}
          showToolCalls={false}
          enableActions
          requestBody={workspaceId ? { workspaceId } : undefined}
          onDataExtracted={_data => {
            // Update the spec with extracted data
          }}
          onReadyToCreate={data => {
            onSpecGenerated(data as any);
          }}
          className='h-[500px]'
        />

        <DialogFooter className='border-t px-6 py-3'>
          <div className='flex w-full items-center justify-end'>
            <Button variant='ghost' onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get entity display name for UI
 */
function getEntityDisplayName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    workspace: 'Workspace',
    orchestrator: 'Orchestrator',
    'session-manager': 'Session Manager',
    subagent: 'Subagent',
    workflow: 'Workflow',
    channel: 'Channel',
  };
  return names[entityType] || entityType;
}
