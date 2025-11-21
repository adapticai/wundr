/**
 * Deployment Configuration Types
 * Types for Railway and Netlify deployment monitoring
 *
 * @module deployment-types
 */

// Platform Types
export type DeploymentPlatform = 'railway' | 'netlify';

export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'deploying'
  | 'success'
  | 'failed'
  | 'crashed'
  | 'cancelled';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AutoFixCategory =
  | 'type_errors'
  | 'null_checks'
  | 'import_errors'
  | 'connection_retries'
  | 'memory_optimization'
  | 'build_errors'
  | 'missing_dependencies';

// Configuration Types
export interface RailwayPlatformConfig {
  enabled: boolean;
  project_id?: string;
  poll_interval: number;
  timeout: number;
  services?: string[];
}

export interface NetlifyPlatformConfig {
  enabled: boolean;
  site_id?: string;
  poll_interval: number;
  timeout: number;
}

export interface AutoFixConfig {
  enabled: boolean;
  max_cycles: number;
  categories: AutoFixCategory[];
}

export interface NotificationConfig {
  on_deploy_start: boolean;
  on_deploy_complete: boolean;
  on_error_detected: boolean;
  on_fix_applied: boolean;
  on_cycle_complete: boolean;
}

export interface EscalationConfig {
  after_iterations: number;
  on_repeated_failure: boolean;
}

export interface DeploymentConfig {
  version: string;
  platforms: {
    railway?: RailwayPlatformConfig;
    netlify?: NetlifyPlatformConfig;
  };
  auto_monitor: boolean;
  auto_fix: AutoFixConfig;
  notifications?: NotificationConfig;
  escalation?: EscalationConfig;
}

// Runtime Types
export interface DeploymentState {
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  deploymentId: string;
  startedAt: Date;
  finishedAt?: Date;
  logs: string[];
  errors: DeploymentError[];
  fixes: AppliedFix[];
  cycleCount: number;
}

export interface DeploymentError {
  id: string;
  severity: ErrorSeverity;
  category: string;
  message: string;
  timestamp: Date;
  file?: string;
  line?: number;
  stackTrace?: string;
  autoFixable: boolean;
}

export interface AppliedFix {
  id: string;
  error: DeploymentError;
  file: string;
  oldCode: string;
  newCode: string;
  appliedAt: Date;
  verified: boolean;
}

export interface DeploymentResult {
  success: boolean;
  platform: DeploymentPlatform;
  cycles: number;
  duration: number;
  errors: DeploymentError[];
  fixes: AppliedFix[];
  reason?: string;
}

// Log Analysis Types
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface LogAnalysisResult {
  platform: DeploymentPlatform;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalEntries: number;
  errors: DeploymentError[];
  warnings: LogEntry[];
  recommendations: string[];
}

// Error Pattern Types
export interface ErrorPattern {
  pattern: string | RegExp;
  classification: string;
  severity: ErrorSeverity;
  autoFixable: boolean;
  commonCauses: string[];
  suggestedFix?: string;
}

export interface ErrorPatternMatch {
  pattern: ErrorPattern;
  match: string;
  context: string[];
  file?: string;
  line?: number;
}

// Workflow Types
export interface DeploymentWorkflowPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface DeploymentWorkflow {
  id: string;
  platform: DeploymentPlatform;
  phases: DeploymentWorkflowPhase[];
  currentPhase: string;
  startedAt: Date;
  completedAt?: Date;
  result?: DeploymentResult;
}

// Default Configuration
export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  version: '1.0.0',
  platforms: {},
  auto_monitor: true,
  auto_fix: {
    enabled: true,
    max_cycles: 5,
    categories: ['type_errors', 'null_checks', 'import_errors', 'connection_retries'],
  },
  notifications: {
    on_deploy_start: true,
    on_deploy_complete: true,
    on_error_detected: true,
    on_fix_applied: true,
    on_cycle_complete: true,
  },
  escalation: {
    after_iterations: 3,
    on_repeated_failure: true,
  },
};

export const DEFAULT_RAILWAY_CONFIG: RailwayPlatformConfig = {
  enabled: false,
  poll_interval: 5000,
  timeout: 300000,
};

export const DEFAULT_NETLIFY_CONFIG: NetlifyPlatformConfig = {
  enabled: false,
  poll_interval: 10000,
  timeout: 600000,
};
