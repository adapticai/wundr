/**
 * Charter type definitions
 */

export interface CharterIdentity {
  name: string;
  description: string;
  personality: string;
}

export interface CharterResourceLimits {
  maxSessions: number;
  maxTokensPerSession: number;
  maxConcurrentTasks: number;
  tokenBudget: {
    hourly: number;
    daily: number;
  };
}

export interface CharterSafetyHeuristics {
  autoApprove: string[];
  requireConfirmation: string[];
  alwaysReject: string[];
  escalate: string[];
}

export interface CharterOperationalSettings {
  defaultModel: string;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface Charter {
  name: string;
  role: string;
  tier: number;
  identity: CharterIdentity;
  capabilities: string[];
  responsibilities: string[];
  resourceLimits: CharterResourceLimits;
  safetyHeuristics: CharterSafetyHeuristics;
  operationalSettings: CharterOperationalSettings;
}

export type CharterTier = 1 | 2 | 3;

export interface CharterLoadOptions {
  useEnvOverrides?: boolean;
}

export interface OrganizationCharter {
  id: string;
  name: string;
  mission: string;
  vision?: string;
  values: string[];
  principles: string[];
  governance: {
    style: 'democratic' | 'hierarchical' | 'consensus' | 'delegated' | 'hybrid';
    decisionMaking?: string;
    escalationPolicy?: string;
    reviewCadence?: string;
  };
  security: {
    dataClassification?: string;
    accessControl?: string;
    complianceRequirements?: string[];
  };
  communication: {
    style: 'formal' | 'casual' | 'balanced' | 'technical' | 'creative';
    preferredChannels?: string[];
    responseTimeExpectation?: string;
    escalationThreshold?: string;
  };
  organizationId: string;
  version: number;
  isActive: boolean;
}
