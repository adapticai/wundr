/**
 * VP (Virtual Person) types for the Genesis App
 */

// Database schema uses: ONLINE | OFFLINE | BUSY | AWAY
// Map these to frontend-friendly display statuses
export type VPStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';

export interface VP {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  discipline: string | null;
  status: VPStatus;
  charter: VPCharter | null;
  capabilities: string[];
  modelConfig: VPModelConfig | null;
  systemPrompt: string | null;
  organizationId: string | null;
  avatarUrl: string | null;
  lastActivityAt: Date | null;
  messageCount: number;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VPCharter {
  mission: string;
  vision: string;
  values: string[];
  personality: VPPersonality;
  expertise: string[];
  communicationPreferences: CommunicationPreferences;
  operationalSettings: OperationalSettings;
}

export interface VPPersonality {
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

export interface VPModelConfig {
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface CreateVPInput {
  title: string;
  discipline: string;
  description?: string;
  charter?: Partial<VPCharter>;
  capabilities?: string[];
  systemPrompt?: string;
  organizationId?: string;
}

export interface UpdateVPInput {
  title?: string;
  description?: string;
  discipline?: string;
  status?: VPStatus;
  charter?: Partial<VPCharter>;
  capabilities?: string[];
  modelConfig?: Partial<VPModelConfig>;
  systemPrompt?: string;
}

export interface VPFilters {
  discipline?: string;
  status?: VPStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const VP_DISCIPLINES = [
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

export type VPDiscipline = (typeof VP_DISCIPLINES)[number];

export const VP_STATUS_CONFIG: Record<VPStatus, { label: string; color: string; bgColor: string }> = {
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
