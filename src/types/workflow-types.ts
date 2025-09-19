/**
 * Enterprise-grade TypeScript type definitions for Workflow Engine
 * Replaces all 'any' types with proper type safety
 */

// Base workflow value types - no more 'any'
export type WorkflowPrimitiveValue = string | number | boolean | null;
export type WorkflowArrayValue = WorkflowValue[];
export type WorkflowObjectValue = { [key: string]: WorkflowValue };
export type WorkflowValue = WorkflowPrimitiveValue | WorkflowArrayValue | WorkflowObjectValue;

// Workflow variables with strict typing
export interface WorkflowVariables {
  readonly [key: string]: WorkflowValue;
}

// Step results with typed responses
export interface StepResults {
  readonly [stepId: string]: TypedStepExecutionResult;
}

// Workflow context with proper typing
export interface TypedWorkflowContext {
  readonly executionId: string;
  readonly variables: WorkflowVariables;
  readonly stepResults: StepResults;
  readonly metadata: WorkflowMetadata;
}

export interface WorkflowMetadata {
  readonly startedAt: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly tags?: readonly string[];
  readonly version?: string;
  readonly priority?: WorkflowPriority;
  readonly environment?: WorkflowEnvironment;
}

export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum WorkflowEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

// Step execution result with proper typing
export interface TypedStepExecutionResult {
  readonly stepId: string;
  readonly success: boolean;
  readonly result?: WorkflowValue;
  readonly error?: WorkflowError;
  readonly executionTime: number;
  readonly retryCount: number;
  readonly timestamp: number;
  readonly logs?: readonly string[];
}

// Workflow error with comprehensive error information
export interface WorkflowError {
  readonly code: string;
  readonly message: string;
  readonly details?: WorkflowObjectValue;
  readonly stack?: string;
  readonly timestamp: number;
  readonly retryable: boolean;
  readonly category: ErrorCategory;
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  SYSTEM = 'system',
  USER = 'user',
  EXTERNAL_SERVICE = 'external_service'
}

// Tool-specific parameter types
export interface FirecrawlParameters {
  readonly url?: string;
  readonly urls?: readonly string[];
  readonly requests?: readonly FirecrawlCrawlRequest[];
  readonly options?: FirecrawlCrawlOptions;
}

export interface FirecrawlCrawlRequest {
  readonly url: string;
  readonly options?: FirecrawlCrawlOptions;
}

export interface FirecrawlCrawlOptions {
  readonly formats?: readonly ('text' | 'markdown' | 'json' | 'structured' | 'html')[];
  readonly onlyMainContent?: boolean;
  readonly includePDFs?: boolean;
  readonly maxDepth?: number;
  readonly excludePatterns?: readonly string[];
  readonly followRedirects?: boolean;
  readonly timeout?: number;
  readonly headers?: { readonly [key: string]: string };
  readonly userAgent?: string;
  readonly respectRobotsTxt?: boolean;
  readonly delay?: number;
}

export interface Context7Parameters {
  readonly data?: WorkflowValue;
  readonly query?: string;
  readonly options?: Context7Options;
  readonly filters?: Context7Filters;
}

export interface Context7Options {
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly priority?: number;
  readonly ttl?: number;
  readonly metadata?: WorkflowObjectValue;
}

export interface Context7Filters {
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly dateRange?: {
    readonly start: string;
    readonly end: string;
  };
  readonly limit?: number;
  readonly offset?: number;
}

export interface PlaywrightParameters {
  readonly url?: string;
  readonly selector?: string;
  readonly text?: string;
  readonly options?: PlaywrightOptions;
  readonly actions?: readonly PlaywrightAction[];
}

export interface PlaywrightOptions {
  readonly headless?: boolean;
  readonly timeout?: number;
  readonly waitForSelector?: string;
  readonly viewport?: {
    readonly width: number;
    readonly height: number;
  };
  readonly userAgent?: string;
  readonly ignoreHTTPSErrors?: boolean;
}

export interface PlaywrightAction {
  readonly type: 'click' | 'type' | 'navigate' | 'screenshot' | 'waitFor';
  readonly selector?: string;
  readonly text?: string;
  readonly url?: string;
  readonly options?: WorkflowObjectValue;
}

export interface BrowserMCPParameters {
  readonly action: 'navigate' | 'click' | 'type' | 'screenshot' | 'evaluate';
  readonly target?: string;
  readonly value?: string;
  readonly options?: BrowserMCPOptions;
}

export interface BrowserMCPOptions {
  readonly timeout?: number;
  readonly waitForNavigation?: boolean;
  readonly fullPage?: boolean;
  readonly quality?: number;
  readonly format?: 'png' | 'jpeg';
}

export interface SequentialThinkingParameters {
  readonly data?: WorkflowValue;
  readonly reasoning_model?: 'tree-of-thought' | 'chain-of-thought' | 'step-by-step';
  readonly validation?: boolean;
  readonly iterations?: number;
  readonly confidence_threshold?: number;
  readonly options?: SequentialThinkingOptions;
}

export interface SequentialThinkingOptions {
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly frequency_penalty?: number;
  readonly presence_penalty?: number;
  readonly stop_sequences?: readonly string[];
}

// Union type for all tool parameters
export type ToolParameters =
  | FirecrawlParameters
  | Context7Parameters
  | PlaywrightParameters
  | BrowserMCPParameters
  | SequentialThinkingParameters;

// Tool-specific response types
export interface FirecrawlResponse {
  readonly success: boolean;
  readonly data?: {
    readonly content: string;
    readonly markdown?: string;
    readonly structured?: WorkflowObjectValue;
    readonly metadata?: FirecrawlMetadata;
  };
  readonly error?: string;
}

export interface FirecrawlMetadata {
  readonly title?: string;
  readonly description?: string;
  readonly url: string;
  readonly statusCode: number;
  readonly contentType?: string;
  readonly lastModified?: string;
  readonly size?: number;
}

export interface Context7Response {
  readonly success: boolean;
  readonly data?: WorkflowValue;
  readonly id?: string;
  readonly count?: number;
  readonly error?: string;
}

export interface PlaywrightResponse {
  readonly success: boolean;
  readonly data?: {
    readonly screenshot?: string;
    readonly content?: string;
    readonly result?: WorkflowValue;
  };
  readonly error?: string;
}

export interface BrowserMCPResponse {
  readonly success: boolean;
  readonly data?: WorkflowValue;
  readonly error?: string;
}

export interface SequentialThinkingResponse {
  readonly success: boolean;
  readonly data?: {
    readonly analysis: string;
    readonly reasoning_steps: readonly string[];
    readonly confidence: number;
    readonly validation_result?: boolean;
  };
  readonly error?: string;
}

// Union type for all tool responses
export type ToolResponse =
  | FirecrawlResponse
  | Context7Response
  | PlaywrightResponse
  | BrowserMCPResponse
  | SequentialThinkingResponse;

// Workflow step with proper typing
export interface TypedWorkflowStep {
  readonly id: string;
  readonly tool: 'firecrawl' | 'context7' | 'playwright' | 'browserMCP' | 'sequentialThinking';
  readonly action: string;
  readonly parameters: ToolParameters;
  readonly dependencies: readonly string[];
  readonly timeout?: number;
  readonly retryPolicy?: StepRetryPolicy;
  readonly condition?: StepCondition;
}

export interface StepRetryPolicy {
  readonly maxRetries: number;
  readonly backoffMultiplier: number;
  readonly initialDelay: number;
  readonly maxDelay?: number;
  readonly retryableErrors?: readonly string[];
}

export interface StepCondition {
  readonly expression: string;
  readonly variables: readonly string[];
}

// Complete workflow with proper typing
export interface TypedWorkflow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly TypedWorkflowStep[];
  readonly metadata: WorkflowMetadata;
  readonly configuration?: WorkflowConfiguration;
}

export interface WorkflowConfiguration {
  readonly maxConcurrentSteps: number;
  readonly defaultTimeout: number;
  readonly retryPolicy: StepRetryPolicy;
  readonly logging: LoggingConfiguration;
  readonly security?: SecurityConfiguration;
}

export interface LoggingConfiguration {
  readonly enabled: boolean;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly includeStepResults: boolean;
  readonly maskSensitiveData: boolean;
}

export interface SecurityConfiguration {
  readonly allowedDomains?: readonly string[];
  readonly blockedDomains?: readonly string[];
  readonly maxExecutionTime?: number;
  readonly resourceLimits?: ResourceLimits;
}

export interface ResourceLimits {
  readonly maxMemoryMB?: number;
  readonly maxCpuPercent?: number;
  readonly maxNetworkRequests?: number;
  readonly maxFileSize?: number;
}

// Workflow execution with proper typing
export interface TypedWorkflowExecution {
  readonly id: string;
  readonly workflowId: string;
  readonly status: WorkflowExecutionStatus;
  readonly context: TypedWorkflowContext;
  readonly results: readonly TypedStepExecutionResult[];
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly error?: WorkflowError;
  readonly performance: ExecutionPerformance;
}

export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export interface ExecutionPerformance {
  readonly totalExecutionTime: number;
  readonly stepExecutionTimes: { readonly [stepId: string]: number };
  readonly resourceUsage: ResourceUsage;
  readonly bottlenecks?: readonly string[];
}

export interface ResourceUsage {
  readonly memoryPeakMB: number;
  readonly cpuPeakPercent: number;
  readonly networkRequests: number;
  readonly bytesTransferred: number;
}

// Type guards for runtime type checking
export const isWorkflowValue = (value: unknown): value is WorkflowValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isWorkflowValue);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(isWorkflowValue);
  }
  return false;
};

export const isWorkflowError = (value: unknown): value is WorkflowError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value &&
    'retryable' in value &&
    'category' in value
  );
};

export const isStepExecutionResult = (value: unknown): value is TypedStepExecutionResult => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stepId' in value &&
    'success' in value &&
    'executionTime' in value &&
    'retryCount' in value &&
    'timestamp' in value
  );
};

// Testing and monitoring specific types
export interface TestSuiteConfig {
  readonly name: string;
  readonly tests: readonly TestCase[];
  readonly environment: WorkflowEnvironment;
  readonly timeout?: number;
  readonly retries?: number;
  readonly parallel?: boolean;
}

export interface TestCase {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly assertions: readonly TestAssertion[];
  readonly setup?: TestSetup;
  readonly teardown?: TestTeardown;
}

export interface TestAssertion {
  readonly type: 'status' | 'content' | 'element' | 'performance';
  readonly selector?: string;
  readonly expected: WorkflowValue;
  readonly operator?: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}

export interface TestSetup {
  readonly actions: readonly PlaywrightAction[];
  readonly data?: WorkflowObjectValue;
}

export interface TestTeardown {
  readonly actions: readonly PlaywrightAction[];
  readonly cleanup?: boolean;
}

export interface AlertCriteria {
  readonly responseTime?: {
    readonly threshold: number;
    readonly unit: 'ms' | 's';
  };
  readonly statusCodes?: readonly number[];
  readonly contentChecks?: readonly ContentCheck[];
  readonly availability?: {
    readonly threshold: number;
    readonly window: string;
  };
  readonly notifications?: NotificationConfig;
}

export interface ContentCheck {
  readonly type: 'contains' | 'notContains' | 'matches';
  readonly pattern: string;
  readonly critical?: boolean;
}

export interface NotificationConfig {
  readonly email?: readonly string[];
  readonly webhook?: string;
  readonly slack?: {
    readonly channel: string;
    readonly token: string;
  };
}

// Utility types for extracting parameter types
export type ExtractToolParameters<T extends TypedWorkflowStep['tool']> =
  T extends 'firecrawl' ? FirecrawlParameters :
  T extends 'context7' ? Context7Parameters :
  T extends 'playwright' ? PlaywrightParameters :
  T extends 'browserMCP' ? BrowserMCPParameters :
  T extends 'sequentialThinking' ? SequentialThinkingParameters :
  never;

export type ExtractToolResponse<T extends TypedWorkflowStep['tool']> =
  T extends 'firecrawl' ? FirecrawlResponse :
  T extends 'context7' ? Context7Response :
  T extends 'playwright' ? PlaywrightResponse :
  T extends 'browserMCP' ? BrowserMCPResponse :
  T extends 'sequentialThinking' ? SequentialThinkingResponse :
  never;