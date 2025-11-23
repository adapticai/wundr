/**
 * @wundr.io/typechat-output - Correction Prompt Generator
 *
 * Generates intelligent correction prompts from validation errors to help
 * LLMs fix their output and conform to the expected TypeScript schema.
 */

import { formatErrorPath, DEFAULT_CORRECTION_PROMPT_CONFIG } from './types';

import type {
  TypeChatError,
  CorrectionPromptConfig,
  CorrectionContext,
} from './types';

// ============================================================================
// Correction Prompt Generator
// ============================================================================

/**
 * Generator for TypeChat correction prompts
 *
 * Creates detailed, actionable correction prompts based on validation errors
 * to guide LLMs toward producing valid output.
 *
 * @example
 * ```typescript
 * const generator = new CorrectionPromptGenerator();
 *
 * const prompt = generator.generate({
 *   errors: [
 *     { path: ['user', 'age'], message: 'Expected number, received string', code: 'invalid_type' }
 *   ],
 *   originalResponse: '{"user": {"age": "thirty"}}',
 *   schemaSource: 'interface User { age: number; }',
 *   schemaName: 'User',
 *   previousAttempts: 0,
 * });
 * ```
 */
export class CorrectionPromptGenerator {
  private readonly config: CorrectionPromptConfig;

  constructor(config: Partial<CorrectionPromptConfig> = {}) {
    this.config = { ...DEFAULT_CORRECTION_PROMPT_CONFIG, ...config };
  }

  /**
   * Generate a correction prompt from validation context
   *
   * @param context - Validation context with errors and original response
   * @returns Generated correction prompt string
   */
  generate(context: CorrectionContext): string {
    // Use custom template if provided
    if (this.config.template) {
      return this.applyTemplate(this.config.template, context);
    }

    // Build default correction prompt
    return this.buildDefaultPrompt(context);
  }

  /**
   * Generate a minimal correction hint (for appending to prompts)
   *
   * @param errors - Validation errors
   * @returns Short correction hint
   */
  generateHint(errors: TypeChatError[]): string {
    if (errors.length === 0) {
      return '';
    }

    const hints = errors.slice(0, 3).map(error => {
      const path = formatErrorPath(error.path);
      return `- ${path}: ${error.message}`;
    });

    return `Please fix these validation errors:\n${hints.join('\n')}`;
  }

  /**
   * Generate error summary for retry context
   *
   * @param errors - Validation errors
   * @returns Formatted error summary
   */
  generateErrorSummary(errors: TypeChatError[]): string {
    if (errors.length === 0) {
      return 'No validation errors.';
    }

    const lines = ['Validation Errors:'];

    for (const error of errors.slice(0, this.config.maxErrors)) {
      const path = formatErrorPath(error.path);
      const expected = error.expected ? ` (expected: ${error.expected})` : '';
      lines.push(`  - ${path}: ${error.message}${expected}`);
    }

    if (errors.length > this.config.maxErrors) {
      lines.push(
        `  ... and ${errors.length - this.config.maxErrors} more errors`
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate field-specific correction instructions
   *
   * @param error - Single validation error
   * @returns Detailed correction instruction for the field
   */
  generateFieldCorrection(error: TypeChatError): string {
    const path = formatErrorPath(error.path);
    const parts: string[] = [];

    parts.push(`Field "${path}" has an error:`);
    parts.push(`  Problem: ${error.message}`);

    if (error.expected) {
      parts.push(`  Expected type: ${error.expected}`);
    }

    if (error.received !== undefined) {
      parts.push(`  Received value: ${this.formatValue(error.received)}`);
    }

    if (error.typeInfo) {
      parts.push(`  TypeScript type: ${error.typeInfo.typeName}`);
      if (error.typeInfo.typeDefinition) {
        parts.push(`  Definition: ${error.typeInfo.typeDefinition}`);
      }
      if (error.typeInfo.examples && error.typeInfo.examples.length > 0) {
        parts.push(
          `  Valid examples: ${error.typeInfo.examples.map(this.formatValue).join(', ')}`
        );
      }
    }

    parts.push(this.suggestFix(error));

    return parts.join('\n');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build the default correction prompt
   */
  private buildDefaultPrompt(context: CorrectionContext): string {
    const sections: string[] = [];

    // Header
    sections.push(this.buildHeader(context));

    // Error details
    sections.push(this.buildErrorSection(context.errors));

    // Original response (if configured)
    if (this.config.includeOriginalResponse && context.originalResponse) {
      sections.push(
        this.buildOriginalResponseSection(context.originalResponse)
      );
    }

    // Schema source (if configured)
    if (this.config.includeSchemaSource && context.schemaSource) {
      sections.push(
        this.buildSchemaSection(context.schemaSource, context.schemaName)
      );
    }

    // Examples (if configured)
    if (
      this.config.includeExamples &&
      context.examples &&
      context.examples.length > 0
    ) {
      sections.push(this.buildExamplesSection(context.examples));
    }

    // Instructions
    sections.push(this.buildInstructions(context));

    return sections.join('\n\n');
  }

  /**
   * Build the prompt header
   */
  private buildHeader(context: CorrectionContext): string {
    const attemptInfo =
      context.previousAttempts > 0
        ? ` (Attempt ${context.previousAttempts + 1})`
        : '';

    return `# Correction Required${attemptInfo}\n\nYour previous response did not match the expected TypeScript type${context.schemaName ? ` "${context.schemaName}"` : ''}. Please correct the errors below and provide a valid JSON response.`;
  }

  /**
   * Build the error details section
   */
  private buildErrorSection(errors: TypeChatError[]): string {
    const lines = ['## Validation Errors\n'];

    const displayErrors = errors.slice(0, this.config.maxErrors);

    for (let i = 0; i < displayErrors.length; i++) {
      const error = displayErrors[i];
      if (error) {
        lines.push(`### Error ${i + 1}`);
        lines.push(this.generateFieldCorrection(error));
        lines.push('');
      }
    }

    if (errors.length > this.config.maxErrors) {
      lines.push(
        `*Note: ${errors.length - this.config.maxErrors} additional errors not shown.*`
      );
    }

    return lines.join('\n');
  }

  /**
   * Build the original response section
   */
  private buildOriginalResponseSection(response: string): string {
    return `## Your Previous Response\n\n\`\`\`json\n${this.truncateResponse(response)}\n\`\`\``;
  }

  /**
   * Build the schema section
   */
  private buildSchemaSection(source: string, name?: string): string {
    const header = name
      ? `## Expected Type: ${name}`
      : '## Expected TypeScript Type';

    return `${header}\n\n\`\`\`typescript\n${source}\n\`\`\``;
  }

  /**
   * Build the examples section
   */
  private buildExamplesSection(examples: unknown[]): string {
    const lines = ['## Valid Examples\n'];

    for (let i = 0; i < Math.min(examples.length, 3); i++) {
      lines.push(`Example ${i + 1}:`);
      lines.push('```json');
      lines.push(JSON.stringify(examples[i], null, 2));
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build the instructions section
   */
  private buildInstructions(context: CorrectionContext): string {
    const lines = ['## Instructions\n'];

    lines.push('Please provide a corrected JSON response that:');
    lines.push('1. Fixes all the validation errors listed above');
    lines.push('2. Matches the expected TypeScript type exactly');
    lines.push('3. Contains only valid JSON with no additional text');
    lines.push('4. Uses the exact field names and types specified');

    if (context.previousAttempts >= 2) {
      lines.push(
        '\n**Important:** This is attempt ' +
          (context.previousAttempts + 1) +
          '. Please carefully review all error messages and ensure each field matches the expected type exactly.'
      );
    }

    return lines.join('\n');
  }

  /**
   * Apply a custom template
   */
  private applyTemplate(template: string, context: CorrectionContext): string {
    return template
      .replace(/\{\{errors\}\}/g, this.generateErrorSummary(context.errors))
      .replace(/\{\{errorCount\}\}/g, String(context.errors.length))
      .replace(/\{\{originalResponse\}\}/g, context.originalResponse)
      .replace(/\{\{schemaSource\}\}/g, context.schemaSource ?? '')
      .replace(/\{\{schemaName\}\}/g, context.schemaName ?? 'Unknown')
      .replace(/\{\{attemptNumber\}\}/g, String(context.previousAttempts + 1))
      .replace(
        /\{\{examples\}\}/g,
        context.examples ? JSON.stringify(context.examples, null, 2) : ''
      );
  }

  /**
   * Suggest a fix based on the error
   */
  private suggestFix(error: TypeChatError): string {
    const suggestions: string[] = ['  Suggestion: '];

    switch (error.code) {
      case 'invalid_type':
        if (error.expected === 'number' && typeof error.received === 'string') {
          suggestions.push('Convert the string value to a number');
        } else if (
          error.expected === 'string' &&
          typeof error.received === 'number'
        ) {
          suggestions.push('Convert the number value to a string');
        } else if (error.expected === 'array') {
          suggestions.push('Wrap the value in an array []');
        } else if (error.expected === 'object') {
          suggestions.push('Provide an object with the required properties');
        } else {
          suggestions.push(`Ensure the value is of type ${error.expected}`);
        }
        break;

      case 'invalid_literal':
        suggestions.push(`Use exactly: ${error.expected}`);
        break;

      case 'invalid_enum_value':
        suggestions.push(`Use one of the allowed values: ${error.expected}`);
        break;

      case 'invalid_string':
        if (error.message.includes('email')) {
          suggestions.push(
            'Provide a valid email address (e.g., user@example.com)'
          );
        } else if (error.message.includes('url')) {
          suggestions.push('Provide a valid URL (e.g., https://example.com)');
        } else if (error.message.includes('uuid')) {
          suggestions.push(
            'Provide a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)'
          );
        } else {
          suggestions.push('Ensure the string matches the required format');
        }
        break;

      case 'too_small':
        if (error.message.includes('Array')) {
          suggestions.push('Add more items to the array');
        } else if (error.message.includes('String')) {
          suggestions.push('Provide a longer string value');
        } else {
          suggestions.push('Provide a larger value');
        }
        break;

      case 'too_big':
        if (error.message.includes('Array')) {
          suggestions.push('Remove items from the array');
        } else if (error.message.includes('String')) {
          suggestions.push('Provide a shorter string value');
        } else {
          suggestions.push('Provide a smaller value');
        }
        break;

      case 'invalid_union':
        suggestions.push(
          'Ensure the value matches one of the allowed union types'
        );
        break;

      case 'unrecognized_keys':
        suggestions.push(
          'Remove the extra fields that are not defined in the type'
        );
        break;

      case 'required':
        suggestions.push(
          `Provide a value for the required field "${formatErrorPath(error.path)}"`
        );
        break;

      default:
        suggestions.push(
          'Review the error message and adjust the value accordingly'
        );
    }

    return suggestions.join('');
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  }

  /**
   * Truncate long responses for display
   */
  private truncateResponse(response: string, maxLength = 1000): string {
    if (response.length <= maxLength) {
      return response;
    }
    return response.substring(0, maxLength) + '\n... (truncated)';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a correction prompt generator with default options
 *
 * @param config - Optional configuration overrides
 * @returns Configured CorrectionPromptGenerator instance
 */
export function createCorrectionPromptGenerator(
  config?: Partial<CorrectionPromptConfig>
): CorrectionPromptGenerator {
  return new CorrectionPromptGenerator(config);
}

/**
 * Generate a correction prompt from errors
 *
 * @param errors - Validation errors
 * @param originalResponse - Original LLM response
 * @param schemaSource - TypeScript schema source
 * @param schemaName - Schema name
 * @returns Generated correction prompt
 */
export function generateCorrectionPrompt(
  errors: TypeChatError[],
  originalResponse: string,
  schemaSource?: string,
  schemaName?: string
): string {
  const generator = new CorrectionPromptGenerator();
  return generator.generate({
    errors,
    originalResponse,
    schemaSource,
    schemaName,
    previousAttempts: 0,
  });
}

/**
 * Generate a short correction hint
 *
 * @param errors - Validation errors
 * @returns Short correction hint string
 */
export function generateCorrectionHint(errors: TypeChatError[]): string {
  const generator = new CorrectionPromptGenerator();
  return generator.generateHint(errors);
}

/**
 * Format validation errors as a readable string
 *
 * @param errors - Validation errors
 * @returns Formatted error string
 */
export function formatValidationErrors(errors: TypeChatError[]): string {
  const generator = new CorrectionPromptGenerator();
  return generator.generateErrorSummary(errors);
}
