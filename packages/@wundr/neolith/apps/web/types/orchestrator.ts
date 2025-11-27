/**
 * Orchestrator types for the Genesis App
 */

// Database schema uses: ONLINE | OFFLINE | BUSY | AWAY
// Map these to frontend-friendly display statuses
export type OrchestratorStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';

export interface Orchestrator {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  discipline: string | null;
  status: OrchestratorStatus;
  charter: OrchestratorCharter | null;
  capabilities: string[];
  modelConfig: OrchestratorModelConfig | null;
  systemPrompt: string | null;
  organizationId: string | null;
  avatarUrl: string | null;
  lastActivityAt: Date | null;
  messageCount: number;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrchestratorCharter {
  mission: string;
  vision: string;
  values: string[];
  personality: OrchestratorPersonality;
  expertise: string[];
  communicationPreferences: CommunicationPreferences;
  operationalSettings: OperationalSettings;
}

export interface OrchestratorPersonality {
  traits: string[];
  communicationStyle: string;
  decisionMakingStyle: string;
  background: string;
}

export interface CommunicationPreferences {
  tone: 'formal' | 'casual' | 'professional' | 'friendly';
  responseLength: 'concise' | 'detailed' | 'balanced';
  formality: 'high' | 'medium' | 'low';
  useEmoji: boolean;
}

export interface OperationalSettings {
  workHours: {
    start: string;
    end: string;
    timezone: string;
  };
  responseTimeTarget: number; // in minutes
  autoEscalation: boolean;
  escalationThreshold: number; // in minutes
}

export interface OrchestratorModelConfig {
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface CreateOrchestratorInput {
  title: string;
  discipline: string;
  description?: string;
  charter?: Partial<OrchestratorCharter>;
  capabilities?: string[];
  systemPrompt?: string;
  organizationId?: string;
}

export interface UpdateOrchestratorInput {
  title?: string;
  description?: string;
  discipline?: string;
  status?: OrchestratorStatus;
  charter?: Partial<OrchestratorCharter>;
  capabilities?: string[];
  modelConfig?: Partial<OrchestratorModelConfig>;
  systemPrompt?: string;
}

export interface OrchestratorFilters {
  discipline?: string;
  status?: OrchestratorStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const ORCHESTRATOR_DISCIPLINES = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Operations',
  'Finance',
  'Human Resources',
  'Customer Success',
  'Legal',
  'Research',
  'Data Science',
] as const;

export type OrchestratorDiscipline = (typeof ORCHESTRATOR_DISCIPLINES)[number];

export const ORCHESTRATOR_STATUS_CONFIG: Record<OrchestratorStatus, { label: string; color: string; bgColor: string }> = {
  ONLINE: { label: 'Online', color: 'text-green-700', bgColor: 'bg-green-100' },
  OFFLINE: { label: 'Offline', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  BUSY: { label: 'Busy', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  AWAY: { label: 'Away', color: 'text-orange-700', bgColor: 'bg-orange-100' },
};

export const PERSONALITY_TRAITS = [
  'Analytical',
  'Creative',
  'Detail-oriented',
  'Empathetic',
  'Innovative',
  'Methodical',
  'Persuasive',
  'Proactive',
  'Strategic',
  'Supportive',
  'Technical',
  'Visionary',
] as const;

export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];
