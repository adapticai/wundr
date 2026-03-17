/**
 * Conversational Creator Component
 * LLM-powered conversational interface for creating entities via UnifiedChat
 * @module components/creation/conversational-creator
 */
'use client';

import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';

import type { ChatPersona } from '@/components/ai/unified-chat';
import type { EntityType, EntitySpec } from './types';

export interface ConversationalCreatorProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Workspace ID context */
  workspaceId?: string;
  /** Callback when spec is generated */
  onSpecGenerated: (spec: EntitySpec) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Existing spec for modifications */
  existingSpec?: EntitySpec;
  /** Whether dialog is open */
  open?: boolean;
}

function getPersonaForEntity(entityType: EntityType): ChatPersona {
  const personas: Record<EntityType, ChatPersona> = {
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
        "I'll help you design an orchestrator agent. What role should this agent play in your organization? For example: Customer Support Lead, Research Analyst, or Project Manager.",
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
  return personas[entityType] || personas.workspace;
}

function getRequiredFields(entityType: EntityType): string[] {
  const fields: Record<EntityType, string[]> = {
    workspace: ['name', 'description', 'organizationType'],
    orchestrator: ['name', 'role', 'description'],
    'session-manager': ['name', 'responsibilities', 'context'],
    workflow: ['name', 'description', 'trigger'],
    channel: ['name', 'description', 'type'],
    subagent: ['name', 'description', 'capabilities'],
  };
  return fields[entityType] || ['name', 'description'];
}

/**
 * ConversationalCreator - Chat-based interface for creating entities
 * Uses UnifiedChat for a polished, consistent conversational experience.
 */
export function ConversationalCreator({
  entityType,
  workspaceId,
  onSpecGenerated,
  onCancel,
  existingSpec,
  open = true,
}: ConversationalCreatorProps) {
  if (!open) return null;

  return (
    <div className='flex h-[70vh] flex-col'>
      <UnifiedChat
        apiEndpoint='/api/wizard/chat'
        entityType={entityType}
        variant='embedded'
        persona={getPersonaForEntity(entityType)}
        progress={{
          enabled: true,
          requiredFields: getRequiredFields(entityType),
        }}
        showToolCalls={false}
        enableActions
        requestBody={{ workspaceId }}
        onDataExtracted={() => {
          // Data extraction in progress - handled internally by UnifiedChat
        }}
        onReadyToCreate={data => {
          const spec: EntitySpec = {
            entityType,
            name: (data.name as string) || '',
            description: (data.description as string) || '',
            role: (data.role as string) || undefined,
            confidence: 0.8,
            missingFields: [],
            suggestions: [],
            properties: data,
          };
          onSpecGenerated(spec);
        }}
        onClose={onCancel}
        className='flex-1'
      />
    </div>
  );
}
