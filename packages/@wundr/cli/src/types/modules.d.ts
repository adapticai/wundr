/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Ambient module declarations for workspace packages that may not be built.
 *
 * These declarations provide type stubs so the CLI package compiles
 * independently of whether sibling workspace packages have been built.
 * When the real packages are built and resolvable, TypeScript will prefer
 * their actual declarations over these ambient ones.
 */

// ---------------------------------------------------------------------------
// @wundr.io/computer-setup
// ---------------------------------------------------------------------------

declare module '@wundr.io/computer-setup' {
  import { EventEmitter } from 'events';

  export interface DeveloperProfile {
    name: string;
    email?: string;
    role: string;
    team?: string;
    company?: string;
    preferences?: ProfilePreferences;
    languages?: Record<string, boolean>;
    frameworks?: Record<string, boolean>;
    tools: {
      packageManagers?: Record<string, boolean>;
      containers?: Record<string, boolean>;
      editors?: Record<string, boolean>;
      databases?: Record<string, boolean>;
      cloud?: Record<string, boolean>;
      ci?: Record<string, boolean>;
      languages?: Record<string, boolean>;
      cloudCLIs?: Record<string, boolean>;
      monitoring?: Record<string, boolean>;
      communication?: Record<string, boolean>;
    };
  }

  export interface ProfilePreferences {
    shell: 'bash' | 'zsh' | 'fish';
    editor: 'vscode' | 'vim' | 'neovim' | 'sublime' | 'intellij';
    theme: 'dark' | 'light' | 'auto';
    gitConfig: {
      userName: string;
      userEmail: string;
      signCommits: boolean;
      gpgKey?: string;
      sshKey?: string;
      defaultBranch: string;
      aliases: Record<string, string>;
    };
    aiTools: {
      claudeCode: boolean;
      claudeFlow: boolean;
      mcpTools: string[];
      swarmAgents: string[];
    };
  }

  export interface SetupPlatform {
    os: 'darwin' | 'linux' | 'win32';
    arch: 'x64' | 'arm64';
    distro?: string;
    version?: string;
    node?: string;
    shell?: string;
  }

  export interface SetupResult {
    success: boolean;
    completedSteps: string[];
    failedSteps: string[];
    skippedSteps: string[];
    warnings: string[];
    errors: Error[];
    duration: number;
    report?: any;
  }

  export interface SetupProgress {
    totalSteps: number;
    completedSteps: number;
    currentStep: string;
    percentage: number;
    estimatedTimeRemaining: number;
    logs: string[];
  }

  export interface SetupProfile {
    name: string;
    description: string;
    estimatedTimeMinutes: number;
    [key: string]: any;
  }

  export class RealSetupOrchestrator extends EventEmitter {
    constructor(platform: SetupPlatform);
    runSetup(profile: DeveloperProfile, options?: any): Promise<SetupResult>;
    orchestrate(
      profileName: string,
      options?: any,
      progressCallback?: (progress: SetupProgress) => void,
    ): Promise<SetupResult>;
    canResume(): Promise<boolean>;
    resume(progressCallback?: (progress: SetupProgress) => void): Promise<SetupResult>;
    getAvailableProfiles(): SetupProfile[];
    getProgress(): SetupProgress;
    cancel(): void;
    onProgress(callback: (progress: SetupProgress) => void): void;
  }

  export class ComputerSetupManager extends EventEmitter {
    static getInstance(): ComputerSetupManager;
    initialize(): Promise<void>;
    validateSetup(profile?: any): Promise<boolean>;
    cleanup(): Promise<void>;
    getProfile(name: string): Promise<DeveloperProfile>;
    getDefaultProfile(): Promise<DeveloperProfile>;
    getAvailableProfiles(): Promise<DeveloperProfile[]>;
    setup(options: any): Promise<SetupResult>;
    on(event: string, callback: Function): this;
  }

  export class SetupOrchestrator extends EventEmitter {
    constructor(platform: SetupPlatform);
    runSetup(profile: DeveloperProfile, options?: any): Promise<SetupResult>;
  }
}

// ---------------------------------------------------------------------------
// @wundr.io/core (supplement missing RAG exports)
// ---------------------------------------------------------------------------

declare module '@wundr.io/core' {
  // Core exports that exist in built dist
  export interface WundrError extends Error {
    code?: string;
  }
  export interface EventBusEvent {
    type: string;
    payload?: unknown;
  }
  export type EventHandler = (event: EventBusEvent) => void | Promise<void>;
  export interface EventBus {
    emit(event: EventBusEvent): void;
    on(type: string, handler: EventHandler): void;
    off(type: string, handler: EventHandler): void;
  }
  export interface ValidationResult {
    valid: boolean;
    errors: string[];
  }
  export type UtilityFunction = (...args: any[]) => any;
  export type AsyncUtilityFunction = (...args: any[]) => Promise<any>;
  export interface Result<T> {
    success: boolean;
    data?: T;
    error?: Error;
  }
  export interface BaseConfig {
    [key: string]: unknown;
  }
  export type CoreEventType = string;
  export const CORE_EVENTS: Record<string, string>;

  // Logging
  export function getLogger(name: string): any;
  export function log(level: string, message: string, ...args: any[]): void;

  // Events
  export function getEventBus(): EventBus;

  // Errors
  export function success<T>(data: T): Result<T>;
  export function failure(error: Error): Result<never>;
  export function isSuccess<T>(result: Result<T>): boolean;
  export function isFailure<T>(result: Result<T>): boolean;
  export class BaseWundrError extends Error {
    code: string;
    constructor(message: string, code: string);
  }

  // RAG (not yet in built dist)
  export interface RagInitOptions {
    projectPath?: string;
    projectName?: string;
    force?: boolean;
    skipIndexing?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingModel?: string;
  }

  export interface RagInitResult {
    success: boolean;
    filesIndexed: number;
    chunksCreated: number;
    storePath: string;
    configPath: string;
    excludePath: string;
    errors: string[];
    warnings: string[];
    framework: {
      name: string;
      projectType: string;
    };
  }

  export function initProjectRag(
    projectPathOrOptions: string | RagInitOptions,
    options?: RagInitOptions,
  ): Promise<RagInitResult>;
  export function isRagInitialized(projectPath: string): Promise<boolean>;
  export function removeRag(projectPath: string): Promise<void>;
  export function reindexProject(projectPath: string): Promise<RagInitResult>;

  export const version: string;
  export const name: string;
}

// ---------------------------------------------------------------------------
// @wundr.io/governance
// ---------------------------------------------------------------------------

declare module '@wundr.io/governance' {
  export interface EvaluationContext {
    projectPath?: string;
    configPath?: string;
    environment?: string;
    evaluationId?: string;
    timestamp?: Date;
    source?: string;
    repository?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface EvaluationResult {
    passed: boolean;
    score: number;
    overallScore: number;
    violations: PolicyViolation[];
    warnings: string[];
    details: EvaluationDetail[];
    results: EvaluationResult[];
    criticalIssues: string[];
    issues: any[];
    recommendations: any[];
  }

  export interface EvaluationDetail {
    evaluator: string;
    passed: boolean;
    score: number;
    message: string;
  }

  export interface PolicyViolation {
    rule: string;
    severity: string;
    message: string;
    description: string;
    policyName: string;
    policyId: string;
    file?: string;
    line?: number;
    location: string;
    suggestion?: string;
    suggestedFix: string;
  }

  export interface ComplianceResult {
    compliant: boolean;
    score: number;
    violations: PolicyViolation[];
    recommendations: string[];
    passedPolicies: any[];
    skippedPolicies: any[];
  }

  export interface IPREConfig {
    version: string;
    metadata?: {
      name?: string;
      description?: string;
      author?: string;
    };
    intent?: any;
    policies?: any;
    rewards?: any;
    evaluators?: any;
  }

  export interface PolicyRule {
    name: string;
    description: string;
    severity: string;
    check: (context: EvaluationContext) => Promise<boolean>;
  }

  export interface EvaluatorSuite {
    policyCompliance: EvaluatorAgent & {
      checkPolicyCompliance(context: EvaluationContext): Promise<ComplianceResult>;
    };
    rewardAlignment: EvaluatorAgent;
    driftDetection: EvaluatorAgent;
    [key: string]: any;
  }

  export class EvaluatorAgent {
    constructor(config: any);
    evaluate(context: EvaluationContext): Promise<EvaluationResult>;
  }

  export function createEvaluator(config: any): EvaluatorAgent;
  export function createEvaluatorSuite(configs?: any): EvaluatorSuite;
  export function runEvaluatorSuite(
    suite: EvaluatorAgent[] | EvaluatorSuite,
    context: EvaluationContext,
  ): Promise<EvaluationResult>;

  export class PolicyEngine {
    constructor(config?: any);
    loadPolicies(path: string): Promise<void>;
    check(context: EvaluationContext): Promise<ComplianceResult>;
    addRule(rule: PolicyRule): void;
    getViolationStats(): {
      total: number;
      bySeverity: Record<string, number>;
      byCategory: Record<string, number>;
    };
  }

  export const version: string;
  export const name: string;
}

// ---------------------------------------------------------------------------
// @wundr.io/guardian-dashboard
// ---------------------------------------------------------------------------

declare module '@wundr.io/guardian-dashboard' {
  export type HealthStatus =
    | 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
    | 'HEALTHY' | 'CONCERNING' | 'CRITICAL' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  export type InterventionSeverity = 'critical' | 'high' | 'medium' | 'low';

  export interface SessionDriftData {
    sessionId: string;
    driftScore: number;
    timestamp: Date;
    metrics: Record<string, number>;
  }

  export interface AggregatedDriftReport {
    averageDrift: number;
    averageScore: number;
    maxDrift: number;
    minScore: number;
    maxScore: number;
    sessionCount: number;
    totalSessions: number;
    overallStatus: HealthStatus;
    trend: string;
    trendDirection: 'improving' | 'stable' | 'degrading';
    sessions: SessionDriftData[];
    criticalSessions: SessionDriftData[];
    concerningSessions: SessionDriftData[];
    timestamp: Date;
  }

  export interface InterventionRecommendation {
    id: string;
    severity: InterventionSeverity;
    title: string;
    description: string;
    suggestedAction: string;
    estimatedImpact: number;
    dimension: string;
    action: string;
    rationale: string;
    urgency: number;
  }

  export interface AlignmentDriftMetrics {
    overallDrift: number;
    componentDrifts: Record<string, number>;
    healthStatus: HealthStatus;
  }

  export class AlignmentDebtCalculator {
    constructor(config?: any);
    calculate(metrics: AlignmentDriftMetrics): number;
    getDebtTrend(history: AlignmentDriftMetrics[]): string;
  }

  export class DriftScoreAggregator {
    constructor(config?: any);
    aggregate(sessions: SessionDriftData[]): AggregatedDriftReport;
    addSessions(sessions: SessionDriftData[]): void;
    aggregateSessionScores(sessions: SessionDriftData[]): AggregatedDriftReport;
    getHealthStatus(score: number): HealthStatus;
  }

  export class InterventionRecommender {
    constructor(config?: any);
    recommend(report: AggregatedDriftReport): InterventionRecommendation[];
    recommendInterventions(data: any): InterventionRecommendation[];
    prioritize(
      recommendations: InterventionRecommendation[],
    ): InterventionRecommendation[];
  }
}

// ---------------------------------------------------------------------------
// @wundr/computer-setup (legacy without .io)
// ---------------------------------------------------------------------------

declare module '@wundr/computer-setup' {
  export class ComputerSetupManager {
    static getInstance(): ComputerSetupManager;
    initialize(): Promise<void>;
    validateSetup(profile?: any): Promise<boolean>;
    cleanup(): Promise<void>;
    getProfile(name: string): Promise<any>;
    getDefaultProfile(): Promise<any>;
    getAvailableProfiles(): Promise<any[]>;
    setup(profile: any): Promise<{
      success: boolean;
      completedSteps?: any[];
      skippedSteps?: any[];
      failedSteps?: any[];
      warnings?: string[];
      errors?: string[];
      report?: any;
    }>;
    on(event: string, callback: Function): void;
  }
}

// ---------------------------------------------------------------------------
// @wundr/core (legacy without .io)
// ---------------------------------------------------------------------------

declare module '@wundr/core' {
  export interface CoreConfig {
    [key: string]: any;
  }
  export const defaultConfig: CoreConfig;
  export function getLogger(name: string): any;
}

// ---------------------------------------------------------------------------
// @wundr/project-templates
// ---------------------------------------------------------------------------

declare module '@wundr/project-templates' {
  export interface TemplateConfig {
    name: string;
    description: string;
    files: Array<{ path: string; content: string }>;
    [key: string]: any;
  }
  export function getTemplate(name: string): TemplateConfig | null;
  export function listTemplates(): string[];
  export const projectTemplates: Record<string, any>;
}

// ---------------------------------------------------------------------------
// open
// ---------------------------------------------------------------------------

declare module 'open' {
  interface Options {
    app?: string | string[];
    wait?: boolean;
    background?: boolean;
    url?: boolean;
  }
  function open(
    target: string,
    options?: Options,
  ): Promise<import('child_process').ChildProcess>;
  export = open;
}
