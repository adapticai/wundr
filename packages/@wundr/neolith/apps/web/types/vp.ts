/**
 * VP (Virtual Person) types for the Genesis App
 */

export type VPStatus = 'ACTIVE' | 'INACTIVE' | 'PROVISIONING' | 'ERROR' | 'SUSPENDED';

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
  ACTIVE: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
  INACTIVE: { label: 'Inactive', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  PROVISIONING: { label: 'Provisioning', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ERROR: { label: 'Error', color: 'text-red-700', bgColor: 'bg-red-100' },
  SUSPENDED: { label: 'Suspended', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
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
