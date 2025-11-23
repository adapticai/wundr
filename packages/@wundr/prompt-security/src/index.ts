/**
 * @wundr.io/prompt-security
 *
 * Prompt injection defense patterns for AI-powered applications.
 * This package provides tools for protecting against prompt injection attacks,
 * sanitizing user input, filtering sensitive data from outputs, and managing
 * context separation between trusted and untrusted content.
 *
 * @packageDocumentation
 */

// Type exports
// Default configurations

// Import classes for PromptSecurityManager
import { ActionInterceptor } from './action-interceptor';
import { ContextMinimizer } from './context-minimization';
import { OutputFilter } from './output-filter';
import { InputSanitizer } from './sanitizer';

import type {
  BuildPromptOptions,
  ContextValidationResult,
  ContextStats,
} from './context-minimization';
import type { DetectionResult as DetectionResultType } from './output-filter';
import type {
  SecurityConfig,
  SanitizationResult,
  RiskAssessment,
  FilteredOutput,
  Action,
  ActionParameters,
  SeparatedContext,
  ActionDecision,
  ActionType,
  TrustLevel,
  SecureActionResult as SecureActionResultType,
} from './types';

export {
  // Core types
  Severity,
  TrustLevel,
  ActionType,
  ActionDecision,

  // Configuration types
  SecurityConfig,
  SensitiveDataPattern,
  ActionRule,
  ContextSettings,
  AuditConfig,

  // Action types
  Action,
  ActionSource,
  SecureActionResult,
  AuditEntry,

  // Action parameter types (type-safe)
  ActionParameters,
  ActionParameterMap,
  FileReadParameters,
  FileWriteParameters,
  FileDeleteParameters,
  NetworkRequestParameters,
  CodeExecutionParameters,
  DatabaseQueryParameters,
  SystemCommandParameters,
  ApiCallParameters,
  CustomActionParameters,

  // Audit types (type-safe)
  AuditDetails,
  AuditDetailValue,
  ActionMetadata,
  MetadataValue,

  // Context types
  SeparatedContext,
  ContextSection,
  ContextMetadata,

  // Sanitization types
  SanitizationResult,
  SanitizationFinding,
  SanitizationStats,

  // Output filter types
  FilteredOutput,
  Redaction,
  FilterStats,

  // Zod schemas
  SecurityConfigSchema,
  ActionSchema,
  ValidatedSecurityConfig,
  ValidatedAction,
} from './types';

// Action Interceptor exports
export { ActionInterceptor } from './action-interceptor';

// Context Minimization exports
export {
  ContextMinimizer,
  createSeparatedContext,
  BuildPromptOptions,
  ContextStats,
  ContextValidationResult,
} from './context-minimization';

// Output Filter exports
export {
  OutputFilter,
  createOutputFilter,
  FilterOptions,
  DetectionResult,
  DetectedSensitiveData,
  DetectionSummary,
} from './output-filter';

// Sanitizer exports
export {
  InputSanitizer,
  createSanitizer,
  sanitize,
  isHighRisk,
  InjectionPattern,
  DangerousPattern,
  SanitizerOptions,
  RiskAssessment,
} from './sanitizer';

/**
 * Default security configuration for standard use cases
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enabled: true,
  strictMode: false,
  maxInputLength: 100000,
  maxOutputLength: 100000,
  injectionPatterns: [
    'ignore\\s+(?:all\\s+)?(?:previous|above|prior)\\s+instructions?',
    'disregard\\s+(?:everything\\s+)?(?:above|previous|prior)',
    '(?:new|your\\s+real|actual)\\s+instructions?\\s*(?:are|:)',
    '\\[?\\s*(?:system|admin|root)\\s*(?:override|command|prompt)\\s*\\]?',
  ],
  sensitivePatterns: [
    {
      id: 'credit-card',
      name: 'Credit Card Number',
      pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b',
      replacement: '[REDACTED:CREDIT_CARD]',
      enabled: true,
      severity: 'critical',
    },
    {
      id: 'ssn',
      name: 'Social Security Number',
      pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      replacement: '[REDACTED:SSN]',
      enabled: true,
      severity: 'critical',
    },
    {
      id: 'api-key',
      name: 'API Key',
      pattern:
        '\\b(?:api[_-]?key|apikey|api_secret)[\\s:=]+["\']?([a-zA-Z0-9_-]{20,})["\']?',
      replacement: '[REDACTED:API_KEY]',
      enabled: true,
      severity: 'critical',
    },
  ],
  actionRules: [
    {
      id: 'deny-untrusted-system-commands',
      name: 'Deny untrusted system commands',
      actionTypes: ['system_command'],
      decision: 'deny',
      priority: 100,
      enabled: true,
      reason: 'System commands from untrusted sources are not allowed',
    },
    {
      id: 'deny-untrusted-code-execution',
      name: 'Deny untrusted code execution',
      actionTypes: ['code_execution'],
      decision: 'deny',
      priority: 100,
      enabled: true,
      reason: 'Code execution from untrusted sources is not allowed',
    },
  ],
  contextSettings: {
    enableSeparation: true,
    maxContextTokens: 8000,
    contextSeparator: '---CONTEXT_BOUNDARY---',
    trustedTags: ['system', 'verified', 'admin'],
    untrustedTags: ['user', 'external', 'unverified'],
  },
  auditConfig: {
    enabled: true,
    logSecurityEvents: true,
    logActionInterceptions: true,
    logSanitization: true,
    includeContent: false,
  },
};

/**
 * Creates a security configuration with custom overrides
 *
 * @param overrides - Configuration overrides
 * @returns Complete security configuration
 */
export function createSecurityConfig(
  overrides: Partial<SecurityConfig>
): SecurityConfig {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    ...overrides,
    sensitivePatterns:
      overrides.sensitivePatterns ?? DEFAULT_SECURITY_CONFIG.sensitivePatterns,
    actionRules: overrides.actionRules ?? DEFAULT_SECURITY_CONFIG.actionRules,
    contextSettings: {
      ...DEFAULT_SECURITY_CONFIG.contextSettings,
      ...overrides.contextSettings,
    },
    auditConfig: {
      ...DEFAULT_SECURITY_CONFIG.auditConfig,
      ...overrides.auditConfig,
    },
  };
}

/**
 * PromptSecurityManager provides a unified interface for all prompt security features.
 *
 * This class combines action interception, context minimization, output filtering,
 * and input sanitization into a single, easy-to-use API.
 *
 * @example
 * ```typescript
 * import { PromptSecurityManager } from '@wundr.io/prompt-security';
 *
 * const security = new PromptSecurityManager();
 *
 * // Sanitize user input
 * const sanitized = security.sanitizeInput(userInput);
 *
 * // Build safe context
 * security.addSystemPrompt('You are a helpful assistant');
 * security.addUserInput(sanitized.sanitized);
 * const context = security.buildContext();
 *
 * // Filter output
 * const filtered = security.filterOutput(aiResponse);
 * ```
 */
export class PromptSecurityManager {
  private readonly config: SecurityConfig;
  private readonly interceptor: ActionInterceptor;
  private readonly contextMinimizer: ContextMinimizer;
  private readonly outputFilter: OutputFilter;
  private readonly sanitizer: InputSanitizer;

  /**
   * Creates a new PromptSecurityManager instance
   *
   * @param config - Security configuration
   */
  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = createSecurityConfig(config);
    this.interceptor = new ActionInterceptor(this.config);
    this.contextMinimizer = new ContextMinimizer(this.config.contextSettings);
    this.outputFilter = new OutputFilter(this.config.sensitivePatterns);
    this.sanitizer = new InputSanitizer({
      maxLength: this.config.maxInputLength,
    });
  }

  /**
   * Sanitizes user input
   *
   * @param input - The input to sanitize
   * @returns Sanitization result
   */
  sanitizeInput(input: string): SanitizationResult {
    return this.sanitizer.sanitize(input);
  }

  /**
   * Assesses the risk level of input
   *
   * @param input - The input to assess
   * @returns Risk assessment
   */
  assessInputRisk(input: string): RiskAssessment {
    return this.sanitizer.assessRisk(input);
  }

  /**
   * Adds a system prompt to the context
   *
   * @param prompt - The system prompt
   * @param source - Source identifier
   * @returns Section ID
   */
  addSystemPrompt(prompt: string, source = 'system'): string {
    return this.contextMinimizer.addSystem(prompt, source);
  }

  /**
   * Adds trusted content to the context
   *
   * @param content - The content to add
   * @param source - Source identifier
   * @param tags - Tags for categorization
   * @returns Section ID
   */
  addTrustedContent(
    content: string,
    source: string,
    tags: string[] = []
  ): string {
    return this.contextMinimizer.addTrusted(content, source, tags, true);
  }

  /**
   * Adds user input to the context
   *
   * @param input - The user input
   * @param source - Source identifier
   * @param autoSanitize - Whether to auto-sanitize the input
   * @returns Section ID
   */
  addUserInput(input: string, source = 'user', autoSanitize = true): string {
    const content = autoSanitize
      ? this.sanitizer.sanitize(input).sanitized
      : input;
    return this.contextMinimizer.addUntrusted(
      content,
      source,
      ['user', 'external'],
      autoSanitize
    );
  }

  /**
   * Builds the context with clear boundaries
   *
   * @param options - Build options
   * @returns Safe prompt string
   */
  buildContext(options: BuildPromptOptions = {}): string {
    return this.contextMinimizer.buildSafePrompt(options);
  }

  /**
   * Gets the separated context
   *
   * @returns Separated context object
   */
  getSeparatedContext(): SeparatedContext {
    return this.contextMinimizer.getSeparatedContext();
  }

  /**
   * Validates the current context
   *
   * @returns Validation result
   */
  validateContext(): ContextValidationResult {
    return this.contextMinimizer.validate();
  }

  /**
   * Filters sensitive data from output
   *
   * @param output - The output to filter
   * @returns Filtered output
   */
  filterOutput(output: string): FilteredOutput {
    return this.outputFilter.filter(output);
  }

  /**
   * Detects sensitive data in output without filtering
   *
   * @param output - The output to check
   * @returns Detection result
   */
  detectSensitiveData(output: string): DetectionResultType {
    return this.outputFilter.detect(output);
  }

  /**
   * Intercepts an action for security evaluation
   *
   * @param action - The action to intercept
   * @param executor - Function to execute if allowed
   * @returns Secure action result
   */
  async interceptAction<T>(
    action: Action,
    executor: () => Promise<T>
  ): Promise<SecureActionResultType<T>> {
    return this.interceptor.intercept(action, executor);
  }

  /**
   * Evaluates an action without executing it
   *
   * @param action - The action to evaluate
   * @returns Evaluation result
   */
  evaluateAction(action: Action): {
    decision: ActionDecision;
    reason?: string;
    matchedRules: string[];
  } {
    return this.interceptor.evaluate(action);
  }

  /**
   * Creates an action object with type-safe parameters
   *
   * @param type - Action type
   * @param target - Target resource
   * @param parameters - Action parameters (type-safe based on action type)
   * @param source - Action source
   * @returns Action object
   */
  createAction<T extends ActionType>(
    type: T,
    target: string,
    parameters: ActionParameters,
    source: {
      origin: 'user' | 'llm' | 'system' | 'plugin';
      trustLevel: TrustLevel;
    }
  ): Action<T> {
    return this.interceptor.createAction(type, target, parameters, source);
  }

  /**
   * Clears the current context
   */
  clearContext(): void {
    this.contextMinimizer.clear();
  }

  /**
   * Gets context statistics
   *
   * @returns Context stats
   */
  getContextStats(): ContextStats {
    return this.contextMinimizer.getStats();
  }

  /**
   * Gets the underlying action interceptor
   *
   * @returns ActionInterceptor instance
   */
  getInterceptor(): ActionInterceptor {
    return this.interceptor;
  }

  /**
   * Gets the underlying context minimizer
   *
   * @returns ContextMinimizer instance
   */
  getContextMinimizer(): ContextMinimizer {
    return this.contextMinimizer;
  }

  /**
   * Gets the underlying output filter
   *
   * @returns OutputFilter instance
   */
  getOutputFilter(): OutputFilter {
    return this.outputFilter;
  }

  /**
   * Gets the underlying sanitizer
   *
   * @returns InputSanitizer instance
   */
  getSanitizer(): InputSanitizer {
    return this.sanitizer;
  }

  /**
   * Gets the current configuration
   *
   * @returns Security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Export default instance factory
/**
 * Creates a new PromptSecurityManager with the given configuration
 *
 * @param config - Security configuration overrides
 * @returns Configured PromptSecurityManager instance
 */
export function createPromptSecurity(
  config: Partial<SecurityConfig> = {}
): PromptSecurityManager {
  return new PromptSecurityManager(config);
}

// Default export
export default PromptSecurityManager;
