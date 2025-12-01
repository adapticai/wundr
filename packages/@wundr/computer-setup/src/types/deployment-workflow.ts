/**
 * Deployment Workflow Types
 * Types for deployment monitoring workflows and agent coordination
 *
 * @module deployment-workflow-types
 */

import type {
  DeploymentPlatform,
  DeploymentStatus,
  DeploymentError,
  AppliedFix,
} from './deployment';

// Workflow Phase Types
export type WorkflowPhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type WorkflowPhaseName =
  | 'detect-platform'
  | 'monitor-deployment'
  | 'analyze-logs'
  | 'classify-errors'
  | 'generate-fixes'
  | 'apply-fixes'
  | 'validate-locally'
  | 'commit-changes'
  | 'push-changes'
  | 'verify-resolution';

// Agent Types
export type DeploymentAgent =
  | 'deployment-monitor'
  | 'log-analyzer'
  | 'debug-refactor';

export interface AgentTask {
  id: string;
  agent: DeploymentAgent;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Workflow Definition
export interface WorkflowPhase {
  name: WorkflowPhaseName;
  description: string;
  status: WorkflowPhaseStatus;
  agents?: DeploymentAgent[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  result?: PhaseResult;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface PhaseResult {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  nextPhase?: WorkflowPhaseName;
  shouldTerminate?: boolean;
}

// Workflow Instance
export interface DeploymentWorkflowInstance {
  id: string;
  platform: DeploymentPlatform;
  branch: string;
  commitHash?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  phases: WorkflowPhase[];
  currentPhase: WorkflowPhaseName;
  cycle: number;
  maxCycles: number;
  startedAt: Date;
  completedAt?: Date;
  result?: WorkflowResult;
  metrics: WorkflowMetrics;
}

export interface WorkflowResult {
  success: boolean;
  platform: DeploymentPlatform;
  totalCycles: number;
  totalDuration: number;
  errorsFound: number;
  errorsFixed: number;
  errors: DeploymentError[];
  fixes: AppliedFix[];
  finalStatus: DeploymentStatus;
  message: string;
}

export interface WorkflowMetrics {
  totalPhases: number;
  completedPhases: number;
  failedPhases: number;
  totalDuration: number;
  deploymentDuration?: number;
  analysisCount: number;
  fixAttempts: number;
}

// Workflow Configuration
export interface WorkflowConfig {
  maxCycles: number;
  timeout: number;
  phases: {
    [K in WorkflowPhaseName]?: PhaseConfig;
  };
  errorHandling: {
    retryFailedPhases: boolean;
    maxRetries: number;
    escalateAfter: number;
  };
  notifications: {
    onPhaseComplete: boolean;
    onError: boolean;
    onCycleComplete: boolean;
  };
}

export interface PhaseConfig {
  enabled: boolean;
  timeout?: number;
  retries?: number;
  skipOnError?: boolean;
}

// Workflow Events
export type WorkflowEventType =
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'phase:started'
  | 'phase:completed'
  | 'phase:failed'
  | 'cycle:started'
  | 'cycle:completed'
  | 'error:detected'
  | 'fix:applied'
  | 'deployment:started'
  | 'deployment:completed';

export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: string;
  timestamp: Date;
  phase?: WorkflowPhaseName;
  cycle?: number;
  data?: Record<string, unknown>;
}

// Workflow Trigger
export interface WorkflowTrigger {
  type: 'git-push' | 'manual' | 'webhook' | 'schedule';
  branch?: string;
  commit?: string;
  user?: string;
  triggeredAt: Date;
  metadata?: Record<string, unknown>;
}

// Workflow Context
export interface WorkflowContext {
  workflow: DeploymentWorkflowInstance;
  platform: DeploymentPlatform;
  config: WorkflowConfig;
  state: {
    deploymentId?: string;
    serviceId?: string;
    logs: string[];
    errors: DeploymentError[];
    fixes: AppliedFix[];
  };
  environment: {
    projectPath: string;
    branch: string;
    commit?: string;
  };
}

// Default Workflow Configuration
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxCycles: 5,
  timeout: 600000, // 10 minutes
  phases: {
    'detect-platform': { enabled: true, timeout: 5000 },
    'monitor-deployment': { enabled: true, timeout: 300000 },
    'analyze-logs': { enabled: true, timeout: 30000 },
    'classify-errors': { enabled: true, timeout: 10000 },
    'generate-fixes': { enabled: true, timeout: 30000 },
    'apply-fixes': { enabled: true, timeout: 60000 },
    'validate-locally': { enabled: true, timeout: 120000 },
    'commit-changes': { enabled: true, timeout: 10000 },
    'push-changes': { enabled: true, timeout: 30000 },
    'verify-resolution': { enabled: true, timeout: 60000 },
  },
  errorHandling: {
    retryFailedPhases: true,
    maxRetries: 3,
    escalateAfter: 3,
  },
  notifications: {
    onPhaseComplete: false,
    onError: true,
    onCycleComplete: true,
  },
};

// Workflow Phase Order
export const WORKFLOW_PHASE_ORDER: WorkflowPhaseName[] = [
  'detect-platform',
  'monitor-deployment',
  'analyze-logs',
  'classify-errors',
  'generate-fixes',
  'apply-fixes',
  'validate-locally',
  'commit-changes',
  'push-changes',
  'verify-resolution',
];
