/**
 * @wundr.io/structured-output - Retry Strategies
 *
 * Different retry strategies with error feedback for LLM output validation.
 * Implements simple, exponential backoff, adaptive, error-targeted, and schema-guided strategies.
 */

import { z } from 'zod';

import type {
  RetryStrategy,
  RetryStrategyType,
  RetryContext,
  RetryConfig,
  RetryStrategyResult,
  ValidationError,
} from './types';
import type { ZodSchema } from 'zod';

/**
 * Creates a placeholder Zod schema for contexts where schema isn't available
 * This is used in executeWithRetry where the function doesn't have access to the actual schema
 */
function createPlaceholderSchema(): ZodSchema {
  return z.unknown();
}

// ============================================================================
// Base Retry Strategy
// ============================================================================

/**
 * Abstract base class for retry strategies
 */
abstract class BaseRetryStrategy implements RetryStrategy {
  abstract readonly name: RetryStrategyType;

  /**
   * Evaluate whether to retry and how
   */
  abstract evaluate(
    context: RetryContext,
    config: RetryConfig
  ): RetryStrategyResult;

  /**
   * Generate error feedback for retry prompt
   */
  generateErrorFeedback(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    const errorLines = errors.map(error => {
      const path = error.path.length > 0 ? error.path.join('.') : 'root';
      let message = `- Field "${path}": ${error.message}`;
      if (error.expected) {
        message += ` (expected: ${error.expected})`;
      }
      return message;
    });

    return `
The previous response failed validation with the following errors:
${errorLines.join('\n')}

Please correct these issues and provide a valid response.`;
  }

  /**
   * Calculate delay with optional jitter
   */
  protected calculateDelay(
    baseDelay: number,
    maxDelay: number,
    jitter: boolean
  ): number {
    let delay = Math.min(baseDelay, maxDelay);
    if (jitter) {
      // Add random jitter of +/- 25%
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    return Math.max(0, Math.round(delay));
  }
}

// ============================================================================
// Simple Retry Strategy
// ============================================================================

/**
 * Simple retry strategy with fixed delay
 */
export class SimpleRetryStrategy extends BaseRetryStrategy {
  readonly name: RetryStrategyType = 'simple';

  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult {
    const shouldRetry = context.attemptNumber <= config.maxRetries;

    return {
      shouldRetry,
      delayMs: this.calculateDelay(
        config.initialDelayMs,
        config.maxDelayMs,
        config.jitter
      ),
      reason: shouldRetry
        ? `Simple retry attempt ${context.attemptNumber}/${config.maxRetries}`
        : `Max retries (${config.maxRetries}) exceeded`,
    };
  }
}

// ============================================================================
// Exponential Backoff Retry Strategy
// ============================================================================

/**
 * Exponential backoff retry strategy
 * Increases delay exponentially between retries
 */
export class ExponentialBackoffRetryStrategy extends BaseRetryStrategy {
  readonly name: RetryStrategyType = 'exponential-backoff';

  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult {
    const shouldRetry = context.attemptNumber <= config.maxRetries;
    const baseDelay =
      config.initialDelayMs *
      Math.pow(config.backoffMultiplier, context.attemptNumber - 1);
    const delayMs = this.calculateDelay(
      baseDelay,
      config.maxDelayMs,
      config.jitter
    );

    return {
      shouldRetry,
      delayMs,
      reason: shouldRetry
        ? `Exponential backoff retry ${context.attemptNumber}/${config.maxRetries}, delay: ${delayMs}ms`
        : `Max retries (${config.maxRetries}) exceeded after exponential backoff`,
    };
  }
}

// ============================================================================
// Adaptive Retry Strategy
// ============================================================================

/**
 * Adaptive retry strategy
 * Adjusts behavior based on error types and patterns
 */
export class AdaptiveRetryStrategy extends BaseRetryStrategy {
  readonly name: RetryStrategyType = 'adaptive';

  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult {
    const shouldRetry = context.attemptNumber <= config.maxRetries;

    // Analyze error patterns
    const errorAnalysis = this.analyzeErrors(context.previousErrors);

    // Calculate adaptive delay based on error severity
    const severityMultiplier = this.calculateSeverityMultiplier(errorAnalysis);
    const baseDelay = config.initialDelayMs * severityMultiplier;
    const delayMs = this.calculateDelay(
      baseDelay,
      config.maxDelayMs,
      config.jitter
    );

    // Generate targeted instructions based on error types
    const additionalInstructions =
      this.generateAdaptiveInstructions(errorAnalysis);

    return {
      shouldRetry,
      delayMs,
      additionalInstructions,
      reason: shouldRetry
        ? `Adaptive retry ${context.attemptNumber}/${config.maxRetries} (${errorAnalysis.primaryErrorType})`
        : 'Max retries exceeded with adaptive strategy',
    };
  }

  /**
   * Generate error feedback tailored to the error patterns
   */
  override generateErrorFeedback(errors: ValidationError[]): string {
    const analysis = this.analyzeErrors(errors);
    const baseFeeback = super.generateErrorFeedback(errors);

    let additionalGuidance = '';

    if (analysis.hasTypeErrors) {
      additionalGuidance +=
        '\nPay special attention to data types. Ensure numbers are numbers, not strings.';
    }

    if (analysis.hasMissingFields) {
      additionalGuidance +=
        '\nEnsure all required fields are present in your response.';
    }

    if (analysis.hasFormatErrors) {
      additionalGuidance +=
        '\nVerify the format of string fields (dates, emails, URLs, etc.).';
    }

    return baseFeeback + additionalGuidance;
  }

  private analyzeErrors(errors: ValidationError[]): ErrorAnalysis {
    const analysis: ErrorAnalysis = {
      primaryErrorType: 'unknown',
      hasTypeErrors: false,
      hasMissingFields: false,
      hasFormatErrors: false,
      hasEnumErrors: false,
      errorCount: errors.length,
      uniquePaths: new Set<string>(),
    };

    for (const error of errors) {
      const pathStr = error.path.join('.');
      analysis.uniquePaths.add(pathStr);

      switch (error.code) {
        case 'invalid_type':
          analysis.hasTypeErrors = true;
          if (analysis.primaryErrorType === 'unknown') {
            analysis.primaryErrorType = 'type_mismatch';
          }
          break;
        case 'invalid_literal':
        case 'invalid_enum_value':
          analysis.hasEnumErrors = true;
          if (analysis.primaryErrorType === 'unknown') {
            analysis.primaryErrorType = 'enum_violation';
          }
          break;
        case 'invalid_string':
          analysis.hasFormatErrors = true;
          if (analysis.primaryErrorType === 'unknown') {
            analysis.primaryErrorType = 'format_error';
          }
          break;
        case 'too_small':
        case 'too_big':
          if (error.message.includes('Required')) {
            analysis.hasMissingFields = true;
            if (analysis.primaryErrorType === 'unknown') {
              analysis.primaryErrorType = 'missing_field';
            }
          }
          break;
        default:
          break;
      }
    }

    return analysis;
  }

  private calculateSeverityMultiplier(analysis: ErrorAnalysis): number {
    // More errors or diverse error types = higher severity = longer delay
    let multiplier = 1;

    if (analysis.errorCount > 5) {
      multiplier *= 2;
    }

    if (analysis.uniquePaths.size > 3) {
      multiplier *= 1.5;
    }

    // Type errors often indicate fundamental misunderstanding
    if (analysis.hasTypeErrors) {
      multiplier *= 1.3;
    }

    return Math.min(multiplier, 4); // Cap at 4x
  }

  private generateAdaptiveInstructions(analysis: ErrorAnalysis): string {
    const instructions: string[] = [];

    if (analysis.hasTypeErrors) {
      instructions.push(
        'Use correct data types (number vs string, boolean vs string).'
      );
    }

    if (analysis.hasMissingFields) {
      instructions.push('Include all required fields.');
    }

    if (analysis.hasEnumErrors) {
      instructions.push('Use only values from the allowed enum options.');
    }

    if (analysis.hasFormatErrors) {
      instructions.push(
        'Ensure string formats match requirements (dates, emails, etc.).'
      );
    }

    return instructions.length > 0
      ? 'Key corrections needed: ' + instructions.join(' ')
      : '';
  }
}

interface ErrorAnalysis {
  primaryErrorType: string;
  hasTypeErrors: boolean;
  hasMissingFields: boolean;
  hasFormatErrors: boolean;
  hasEnumErrors: boolean;
  errorCount: number;
  uniquePaths: Set<string>;
}

// ============================================================================
// Error-Targeted Retry Strategy
// ============================================================================

/**
 * Error-targeted retry strategy
 * Focuses retry prompts on specific error locations
 */
export class ErrorTargetedRetryStrategy extends BaseRetryStrategy {
  readonly name: RetryStrategyType = 'error-targeted';

  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult {
    const shouldRetry = context.attemptNumber <= config.maxRetries;

    // Use shorter delays since we're being very targeted
    const delayMs = this.calculateDelay(
      config.initialDelayMs * 0.5,
      config.maxDelayMs * 0.5,
      config.jitter
    );

    // Generate targeted modification of the prompt
    const targetedInstructions = this.generateTargetedInstructions(
      context.previousErrors
    );

    return {
      shouldRetry,
      delayMs,
      additionalInstructions: targetedInstructions,
      reason: shouldRetry
        ? `Error-targeted retry ${context.attemptNumber}/${config.maxRetries}, focusing on ${context.previousErrors.length} error(s)`
        : 'Max retries exceeded with error-targeted strategy',
    };
  }

  override generateErrorFeedback(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    // Group errors by path
    const errorsByPath = new Map<string, ValidationError[]>();
    for (const error of errors) {
      const pathStr = error.path.join('.') || 'root';
      const existing = errorsByPath.get(pathStr) ?? [];
      existing.push(error);
      errorsByPath.set(pathStr, existing);
    }

    const sections: string[] = ['The previous response had validation errors:'];

    for (const [path, pathErrors] of errorsByPath) {
      sections.push(`\n**Field: ${path}**`);
      for (const error of pathErrors) {
        let line = `  - ${error.message}`;
        if (error.expected && error.received !== undefined) {
          line += ` (expected ${error.expected}, got ${JSON.stringify(error.received)})`;
        }
        sections.push(line);
      }
    }

    sections.push('\nFocus on fixing these specific fields.');

    return sections.join('\n');
  }

  private generateTargetedInstructions(errors: ValidationError[]): string {
    const errorPaths = [
      ...new Set(errors.map(e => e.path.join('.') || 'root')),
    ];

    if (errorPaths.length === 1) {
      return `Fix the "${errorPaths[0]}" field.`;
    }

    return `Fix these fields: ${errorPaths.join(', ')}.`;
  }
}

// ============================================================================
// Schema-Guided Retry Strategy
// ============================================================================

/**
 * Schema-guided retry strategy
 * Uses schema information to provide detailed guidance
 */
export class SchemaGuidedRetryStrategy extends BaseRetryStrategy {
  readonly name: RetryStrategyType = 'schema-guided';

  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult {
    const shouldRetry = context.attemptNumber <= config.maxRetries;

    // Progressive delays as we provide more schema guidance
    const delayMs = this.calculateDelay(
      config.initialDelayMs * context.attemptNumber,
      config.maxDelayMs,
      config.jitter
    );

    // Generate schema-aware instructions
    const schemaInstructions = this.generateSchemaInstructions(
      context.previousErrors,
      context.attemptNumber
    );

    return {
      shouldRetry,
      delayMs,
      additionalInstructions: schemaInstructions,
      reason: shouldRetry
        ? `Schema-guided retry ${context.attemptNumber}/${config.maxRetries}`
        : 'Max retries exceeded with schema-guided strategy',
    };
  }

  override generateErrorFeedback(errors: ValidationError[]): string {
    const baseFeeback = super.generateErrorFeedback(errors);

    // Add schema hints
    const schemaHints: string[] = [];

    for (const error of errors) {
      if (error.expected) {
        const path = error.path.join('.') || 'root';
        schemaHints.push(`"${path}" must be ${error.expected}`);
      }
    }

    if (schemaHints.length > 0) {
      return (
        baseFeeback + '\n\nSchema requirements:\n- ' + schemaHints.join('\n- ')
      );
    }

    return baseFeeback;
  }

  private generateSchemaInstructions(
    errors: ValidationError[],
    attemptNumber: number
  ): string {
    // Progressively more detailed instructions on each retry
    const instructions: string[] = [];

    if (attemptNumber >= 2) {
      instructions.push('Output must be valid JSON.');
    }

    if (attemptNumber >= 3) {
      instructions.push('Carefully match the exact schema structure.');

      // Add specific field requirements
      for (const error of errors.slice(0, 3)) {
        if (error.expected) {
          const path = error.path.join('.') || 'value';
          instructions.push(`Field "${path}": expected ${error.expected}`);
        }
      }
    }

    return instructions.join(' ');
  }
}

// ============================================================================
// Factory and Utilities
// ============================================================================

/**
 * Create a retry strategy by type
 */
export function createRetryStrategy(type: RetryStrategyType): RetryStrategy {
  switch (type) {
    case 'simple':
      return new SimpleRetryStrategy();
    case 'exponential-backoff':
      return new ExponentialBackoffRetryStrategy();
    case 'adaptive':
      return new AdaptiveRetryStrategy();
    case 'error-targeted':
      return new ErrorTargetedRetryStrategy();
    case 'schema-guided':
      return new SchemaGuidedRetryStrategy();
    default:
      throw new Error(`Unknown retry strategy: ${type}`);
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute with retry using the specified strategy
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  strategy: RetryStrategy,
  config: RetryConfig,
  onRetry?: (context: RetryContext) => void
): Promise<T> {
  let lastError: Error | undefined;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Create a minimal retry context for generic retry execution
      // The schema field uses a placeholder since executeWithRetry doesn't have access to the actual schema
      const context: RetryContext = {
        attemptNumber: attempt,
        previousErrors: [],
        rawResponse: '',
        originalPrompt: '',
        schema: createPlaceholderSchema(),
        elapsedTime: Date.now() - startTime,
      };

      const result = strategy.evaluate(context, config);

      if (!result.shouldRetry || attempt > config.maxRetries) {
        break;
      }

      onRetry?.(context);
      await sleep(result.delayMs);
    }
  }

  throw lastError ?? new Error('Retry failed');
}

// ============================================================================
// Exports
// ============================================================================

export { BaseRetryStrategy };
