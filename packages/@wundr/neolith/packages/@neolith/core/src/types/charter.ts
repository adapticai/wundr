/**
 * Charter Types for Orchestrator Governance
 *
 * Defines the complete charter structure for orchestrator configuration,
 * capabilities, constraints, and objectives.
 */

export interface OrchestratorCapability {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'development' | 'analysis' | 'automation' | 'management';
  isEnabled: boolean;
  parameters?: Record<string, unknown>;
}

export interface CharterIdentity {
  name: string;
  slug: string;
  persona: string;
  slackHandle?: string;
  email?: string;
  avatarUrl?: string;
}

export interface CharterResourceLimits {
  maxConcurrentSessions: number;
  tokenBudgetPerHour: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
}

export interface CharterObjectives {
  responseTimeTarget: number;  // milliseconds
  taskCompletionRate: number;  // percentage 0-100
  qualityScore: number;        // 0-100
  customMetrics?: Record<string, number>;
}

export interface CharterConstraints {
  forbiddenCommands: string[];
  forbiddenPaths: string[];
  forbiddenActions: string[];
  requireApprovalFor: string[];
}

export interface GovernanceCharter {
  id: string;
  tier: 1;  // Orchestrator tier is always 1
  identity: CharterIdentity;
  coreDirective: string;
  capabilities: OrchestratorCapability[];
  mcpTools: string[];
  resourceLimits: CharterResourceLimits;
  objectives: CharterObjectives;
  constraints: CharterConstraints;
  disciplineIds: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterVersion {
  id: string;
  charterId: string;
  orchestratorId: string;
  version: number;
  charterData: GovernanceCharter;
  changeLog?: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

export interface CreateCharterVersionInput {
  orchestratorId: string;
  charterId: string;
  charterData: Omit<GovernanceCharter, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  changeLog?: string;
}

export interface CharterDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'removed' | 'modified';
}

// Default charter templates
export const DEFAULT_RESOURCE_LIMITS: CharterResourceLimits = {
  maxConcurrentSessions: 10,
  tokenBudgetPerHour: 100000,
  maxMemoryMB: 4096,
  maxCpuPercent: 80,
};

export const DEFAULT_OBJECTIVES: CharterObjectives = {
  responseTimeTarget: 30000,  // 30 seconds
  taskCompletionRate: 95,
  qualityScore: 85,
};

export const DEFAULT_CONSTRAINTS: CharterConstraints = {
  forbiddenCommands: ['rm -rf /', 'sudo rm', 'format', 'fdisk'],
  forbiddenPaths: ['/etc/passwd', '/etc/shadow', '~/.ssh'],
  forbiddenActions: ['delete_production_data', 'expose_secrets'],
  requireApprovalFor: ['deploy_production', 'delete_workspace', 'modify_billing'],
};
