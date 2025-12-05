import { z } from 'zod';

import type { EntityType } from './types';

export const ENTITY_SCHEMAS = {
  workspace: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    organizationType: z.string().optional(),
    teamSize: z.enum(['small', 'medium', 'large']).optional(),
    purpose: z.string().optional(),
  }),

  orchestrator: z.object({
    name: z.string().min(1, 'Name is required'),
    role: z.string().min(1, 'Role is required'),
    description: z.string().min(1, 'Description is required'),
    capabilities: z.array(z.string()).optional(),
    communicationStyle: z.string().optional(),
    goals: z.array(z.string()).optional(),
  }),

  'session-manager': z.object({
    name: z.string().min(1, 'Name is required'),
    responsibilities: z.string().min(1, 'Responsibilities are required'),
    parentOrchestrator: z.string().optional(),
    context: z.string().optional(),
    escalationCriteria: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
  }),

  workflow: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    trigger: z.object({
      type: z.enum(['schedule', 'event', 'manual', 'webhook']),
      config: z.record(z.unknown()).optional(),
    }),
    steps: z
      .array(
        z.object({
          action: z.string(),
          description: z.string(),
        }),
      )
      .min(1, 'At least one step is required'),
  }),

  channel: z.object({
    name: z.string().min(1),
    type: z.enum(['public', 'private', 'direct']),
    description: z.string().optional(),
  }),

  subagent: z.object({
    name: z.string().min(1),
    capability: z.string().min(1),
    description: z.string().optional(),
    parentOrchestrator: z.string().optional(),
  }),
} as const;

export function validateEntityData<T extends EntityType>(
  entityType: T,
  data: unknown,
):
  | { success: true; data: z.infer<(typeof ENTITY_SCHEMAS)[T]> }
  | { success: false; errors: z.ZodError } {
  const schema = ENTITY_SCHEMAS[entityType];
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function getRequiredFields(entityType: EntityType): string[] {
  const required: Record<EntityType, string[]> = {
    workspace: ['name', 'description'],
    orchestrator: ['name', 'role', 'description'],
    'session-manager': ['name', 'responsibilities'],
    workflow: ['name', 'description', 'trigger', 'steps'],
    channel: ['name', 'type'],
    subagent: ['name', 'capability'],
  };
  return required[entityType];
}

export function getOptionalFields(entityType: EntityType): string[] {
  const optional: Record<EntityType, string[]> = {
    workspace: ['organizationType', 'teamSize', 'purpose'],
    orchestrator: ['capabilities', 'communicationStyle', 'goals'],
    'session-manager': [
      'parentOrchestrator',
      'context',
      'escalationCriteria',
      'channels',
    ],
    workflow: [],
    channel: ['description'],
    subagent: ['description', 'parentOrchestrator'],
  };
  return optional[entityType];
}
