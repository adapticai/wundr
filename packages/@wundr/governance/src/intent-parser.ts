/**
 * Strategic Intent Parser for the Wundr Governance System
 *
 * Parses and validates strategic intent definitions from YAML/JSON formats
 * and converts them into structured data for governance enforcement.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration options for the IntentParser
 */
export interface IntentParserConfig {
  /** Whether to enforce strict validation (default: true) */
  readonly strict?: boolean;
  /** Custom conflict detection rules */
  readonly conflictRules?: ConflictRule[];
  /** Maximum number of values allowed (default: unlimited) */
  readonly maxValues?: number;
  /** Maximum number of constraints allowed (default: unlimited) */
  readonly maxConstraints?: number;
  /** Maximum number of goals allowed (default: unlimited) */
  readonly maxGoals?: number;
}

/**
 * Rule for detecting conflicting constraints
 */
export interface ConflictRule {
  readonly name: string;
  readonly patterns: [string, string];
  readonly message: string;
}

/**
 * Strategic intent structure
 */
export interface Intent {
  /** The organization's mission statement */
  readonly mission: string;
  /** Core values that guide decision-making */
  readonly values: string[];
  /** Constraints or boundaries that must be respected */
  readonly constraints?: string[];
  /** Strategic goals to achieve */
  readonly goals?: string[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  readonly path: string[];
  readonly message: string;
  readonly code: string;
}

/**
 * Result of intent validation
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
}

/**
 * Validation warning (non-fatal)
 */
export interface ValidationWarning {
  readonly path: string[];
  readonly message: string;
  readonly code: string;
}

/**
 * JSON Schema for Intent validation
 * Exported for use with JSON Schema validators like ajv
 */
export const INTENT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['mission', 'values'],
  properties: {
    mission: {
      type: 'string',
      minLength: 1,
      description: "The organization's mission statement",
    },
    values: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      description: 'Core values that guide decision-making',
    },
    constraints: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Constraints or boundaries that must be respected',
    },
    goals: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Strategic goals to achieve',
    },
  },
  additionalProperties: false,
} as const;

/**
 * Default conflict detection rules
 */
const DEFAULT_CONFLICT_RULES: ConflictRule[] = [
  {
    name: 'speed-vs-quality',
    patterns: ['fast', 'thorough'],
    message: 'Potential conflict between speed and thoroughness constraints',
  },
  {
    name: 'cost-vs-quality',
    patterns: ['cost-effective', 'premium'],
    message:
      'Potential conflict between cost-effectiveness and premium quality',
  },
  {
    name: 'open-vs-closed',
    patterns: ['open-source', 'proprietary'],
    message:
      'Potential conflict between open-source and proprietary approaches',
  },
];

/**
 * IntentParser class for parsing and validating strategic intent definitions
 */
export class IntentParser {
  private readonly config: Required<IntentParserConfig>;

  /**
   * Creates a new IntentParser instance
   * @param config - Optional configuration options
   */
  constructor(config?: IntentParserConfig) {
    this.config = {
      strict: config?.strict ?? true,
      conflictRules: config?.conflictRules ?? DEFAULT_CONFLICT_RULES,
      maxValues: config?.maxValues ?? Infinity,
      maxConstraints: config?.maxConstraints ?? Infinity,
      maxGoals: config?.maxGoals ?? Infinity,
    };
  }

  /**
   * Parses strategic intent from YAML content
   * @param yamlContent - YAML string containing intent definition
   * @returns Parsed Intent object
   * @throws Error if parsing fails or content is invalid
   */
  parseFromYAML(yamlContent: string): Intent {
    if (!yamlContent || typeof yamlContent !== 'string') {
      throw new IntentParseError(
        'YAML content must be a non-empty string',
        'INVALID_INPUT'
      );
    }

    const trimmedContent = yamlContent.trim();
    if (trimmedContent.length === 0) {
      throw new IntentParseError('YAML content is empty', 'EMPTY_CONTENT');
    }

    try {
      const parsed = this.parseYAML(trimmedContent);
      return this.normalizeIntent(parsed);
    } catch (error) {
      if (error instanceof IntentParseError) {
        throw error;
      }
      throw new IntentParseError(
        `Failed to parse YAML content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'YAML_PARSE_ERROR'
      );
    }
  }

  /**
   * Parses strategic intent from JSON content
   * @param jsonContent - JSON string containing intent definition
   * @returns Parsed Intent object
   * @throws Error if parsing fails or content is invalid
   */
  parseFromJSON(jsonContent: string): Intent {
    if (!jsonContent || typeof jsonContent !== 'string') {
      throw new IntentParseError(
        'JSON content must be a non-empty string',
        'INVALID_INPUT'
      );
    }

    const trimmedContent = jsonContent.trim();
    if (trimmedContent.length === 0) {
      throw new IntentParseError('JSON content is empty', 'EMPTY_CONTENT');
    }

    try {
      const parsed = JSON.parse(trimmedContent) as unknown;
      return this.normalizeIntent(parsed);
    } catch (error) {
      if (error instanceof IntentParseError) {
        throw error;
      }
      throw new IntentParseError(
        `Failed to parse JSON content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'JSON_PARSE_ERROR'
      );
    }
  }

  /**
   * Parses strategic intent from a file (supports .yaml, .yml, and .json)
   * @param filePath - Path to the intent definition file
   * @returns Promise resolving to parsed Intent object
   * @throws Error if file cannot be read or parsed
   */
  async parseFromFile(filePath: string): Promise<Intent> {
    if (!filePath || typeof filePath !== 'string') {
      throw new IntentParseError(
        'File path must be a non-empty string',
        'INVALID_INPUT'
      );
    }

    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.yaml', '.yml', '.json'];

    if (!supportedExtensions.includes(ext)) {
      throw new IntentParseError(
        `Unsupported file extension: ${ext}. Supported: ${supportedExtensions.join(', ')}`,
        'UNSUPPORTED_FORMAT'
      );
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (ext === '.json') {
        return this.parseFromJSON(content);
      } else {
        return this.parseFromYAML(content);
      }
    } catch (error) {
      if (error instanceof IntentParseError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new IntentParseError(
        `Failed to read file: ${errorMessage}`,
        'FILE_READ_ERROR'
      );
    }
  }

  /**
   * Validates an Intent object
   * @param intent - Intent object to validate
   * @returns ValidationResult with valid flag and any errors/warnings
   */
  validate(intent: Intent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check mission is defined and non-empty
    if (!intent.mission) {
      errors.push({
        path: ['mission'],
        message: 'Mission is required and must be non-empty',
        code: 'MISSION_REQUIRED',
      });
    } else if (typeof intent.mission !== 'string') {
      errors.push({
        path: ['mission'],
        message: 'Mission must be a string',
        code: 'MISSION_INVALID_TYPE',
      });
    } else if (intent.mission.trim().length === 0) {
      errors.push({
        path: ['mission'],
        message: 'Mission cannot be empty or whitespace only',
        code: 'MISSION_EMPTY',
      });
    }

    // Check values array has at least one entry
    if (!intent.values) {
      errors.push({
        path: ['values'],
        message: 'Values array is required',
        code: 'VALUES_REQUIRED',
      });
    } else if (!Array.isArray(intent.values)) {
      errors.push({
        path: ['values'],
        message: 'Values must be an array',
        code: 'VALUES_INVALID_TYPE',
      });
    } else if (intent.values.length === 0) {
      errors.push({
        path: ['values'],
        message: 'Values array must contain at least one entry',
        code: 'VALUES_EMPTY',
      });
    } else {
      // Validate individual values
      intent.values.forEach((value, index) => {
        if (typeof value !== 'string') {
          errors.push({
            path: ['values', String(index)],
            message: `Value at index ${index} must be a string`,
            code: 'VALUE_INVALID_TYPE',
          });
        } else if (value.trim().length === 0) {
          errors.push({
            path: ['values', String(index)],
            message: `Value at index ${index} cannot be empty`,
            code: 'VALUE_EMPTY',
          });
        }
      });

      // Check max values limit
      if (intent.values.length > this.config.maxValues) {
        errors.push({
          path: ['values'],
          message: `Values array exceeds maximum allowed length of ${this.config.maxValues}`,
          code: 'VALUES_EXCEEDS_MAX',
        });
      }

      // Check for duplicate values
      const uniqueValues = new Set(
        intent.values.map(v => v.toLowerCase().trim())
      );
      if (uniqueValues.size !== intent.values.length) {
        warnings.push({
          path: ['values'],
          message: 'Values array contains duplicate entries',
          code: 'VALUES_DUPLICATES',
        });
      }
    }

    // Validate constraints if present
    if (intent.constraints !== undefined) {
      if (!Array.isArray(intent.constraints)) {
        errors.push({
          path: ['constraints'],
          message: 'Constraints must be an array',
          code: 'CONSTRAINTS_INVALID_TYPE',
        });
      } else {
        // Validate individual constraints
        intent.constraints.forEach((constraint, index) => {
          if (typeof constraint !== 'string') {
            errors.push({
              path: ['constraints', String(index)],
              message: `Constraint at index ${index} must be a string`,
              code: 'CONSTRAINT_INVALID_TYPE',
            });
          } else if (constraint.trim().length === 0) {
            errors.push({
              path: ['constraints', String(index)],
              message: `Constraint at index ${index} cannot be empty`,
              code: 'CONSTRAINT_EMPTY',
            });
          }
        });

        // Check max constraints limit
        if (intent.constraints.length > this.config.maxConstraints) {
          errors.push({
            path: ['constraints'],
            message: `Constraints array exceeds maximum allowed length of ${this.config.maxConstraints}`,
            code: 'CONSTRAINTS_EXCEEDS_MAX',
          });
        }

        // Check for conflicting constraints
        const conflictWarnings = this.detectConflicts(intent.constraints);
        warnings.push(...conflictWarnings);
      }
    }

    // Validate goals if present
    if (intent.goals !== undefined) {
      if (!Array.isArray(intent.goals)) {
        errors.push({
          path: ['goals'],
          message: 'Goals must be an array',
          code: 'GOALS_INVALID_TYPE',
        });
      } else {
        // Validate individual goals
        intent.goals.forEach((goal, index) => {
          if (typeof goal !== 'string') {
            errors.push({
              path: ['goals', String(index)],
              message: `Goal at index ${index} must be a string`,
              code: 'GOAL_INVALID_TYPE',
            });
          } else if (goal.trim().length === 0) {
            errors.push({
              path: ['goals', String(index)],
              message: `Goal at index ${index} cannot be empty`,
              code: 'GOAL_EMPTY',
            });
          }
        });

        // Check max goals limit
        if (intent.goals.length > this.config.maxGoals) {
          errors.push({
            path: ['goals'],
            message: `Goals array exceeds maximum allowed length of ${this.config.maxGoals}`,
            code: 'GOALS_EXCEEDS_MAX',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extracts values from an Intent object
   * @param intent - Intent object to extract values from
   * @returns Array of value strings
   */
  extractValues(intent: Intent): string[] {
    if (!intent.values || !Array.isArray(intent.values)) {
      return [];
    }
    return [...intent.values];
  }

  /**
   * Extracts mission from an Intent object
   * @param intent - Intent object to extract mission from
   * @returns Mission string or empty string if not defined
   */
  extractMission(intent: Intent): string {
    return intent.mission ?? '';
  }

  /**
   * Converts an Intent object to a system prompt context fragment
   * @param intent - Intent object to convert
   * @returns Formatted string suitable for inclusion in system prompts
   */
  toPromptContext(intent: Intent): string {
    const sections: string[] = [];

    // Mission section
    if (intent.mission) {
      sections.push(`## Mission\n${intent.mission}`);
    }

    // Values section
    if (intent.values && intent.values.length > 0) {
      const valuesFormatted = intent.values
        .map(value => `- ${value}`)
        .join('\n');
      sections.push(`## Core Values\n${valuesFormatted}`);
    }

    // Constraints section
    if (intent.constraints && intent.constraints.length > 0) {
      const constraintsFormatted = intent.constraints
        .map(constraint => `- ${constraint}`)
        .join('\n');
      sections.push(`## Constraints\n${constraintsFormatted}`);
    }

    // Goals section
    if (intent.goals && intent.goals.length > 0) {
      const goalsFormatted = intent.goals.map(goal => `- ${goal}`).join('\n');
      sections.push(`## Strategic Goals\n${goalsFormatted}`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `# Strategic Intent\n\n${sections.join('\n\n')}`;
  }

  /**
   * Simple YAML parser for intent files
   * Handles basic YAML structures without external dependencies
   */
  private parseYAML(content: string): unknown {
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    let currentKey: string | null = null;
    let currentArray: string[] | null = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }

      // Check for array item
      const arrayMatch = line.match(/^(\s*)-\s+(.*)$/);
      if (
        arrayMatch &&
        arrayMatch[2] !== undefined &&
        currentKey &&
        currentArray !== null
      ) {
        const value = this.parseYAMLValue(arrayMatch[2].trim());
        currentArray.push(String(value));
        continue;
      }

      // Check for key-value pair
      const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
      if (
        keyValueMatch &&
        keyValueMatch[1] !== undefined &&
        keyValueMatch[2] !== undefined
      ) {
        const key = keyValueMatch[1];
        const value = keyValueMatch[2].trim();

        if (value === '' || value === '|' || value === '>') {
          // Start of an array or multiline string
          currentKey = key;
          currentArray = [];
          result[key] = currentArray;
        } else {
          // Simple key-value
          result[key] = this.parseYAMLValue(value);
          currentKey = null;
          currentArray = null;
        }
      }
    }

    return result;
  }

  /**
   * Parses a YAML value, handling strings, numbers, and booleans
   */
  private parseYAMLValue(value: string): string | number | boolean {
    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Check for boolean
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }

    // Check for number
    const num = Number(value);
    if (!isNaN(num) && value !== '') {
      return num;
    }

    return value;
  }

  /**
   * Normalizes parsed content into an Intent object
   */
  private normalizeIntent(parsed: unknown): Intent {
    if (!parsed || typeof parsed !== 'object') {
      throw new IntentParseError(
        'Parsed content must be an object',
        'INVALID_STRUCTURE'
      );
    }

    const obj = parsed as Record<string, unknown>;

    // Validate mission
    if (!obj.mission) {
      throw new IntentParseError('Mission is required', 'MISSION_REQUIRED');
    }
    if (typeof obj.mission !== 'string') {
      throw new IntentParseError(
        'Mission must be a string',
        'MISSION_INVALID_TYPE'
      );
    }

    // Validate values
    if (!obj.values) {
      throw new IntentParseError('Values array is required', 'VALUES_REQUIRED');
    }
    if (!Array.isArray(obj.values)) {
      throw new IntentParseError(
        'Values must be an array',
        'VALUES_INVALID_TYPE'
      );
    }
    if (obj.values.length === 0) {
      throw new IntentParseError(
        'Values array must contain at least one entry',
        'VALUES_EMPTY'
      );
    }

    // Build the intent object with optional properties only if defined
    const baseIntent = {
      mission: obj.mission.trim(),
      values: obj.values.map(v => String(v).trim()),
    };

    const intent: Intent =
      obj.constraints && obj.goals
        ? {
            ...baseIntent,
            constraints: (obj.constraints as unknown[]).map(c =>
              String(c).trim()
            ),
            goals: (obj.goals as unknown[]).map(g => String(g).trim()),
          }
        : obj.constraints
          ? {
              ...baseIntent,
              constraints: (obj.constraints as unknown[]).map(c =>
                String(c).trim()
              ),
            }
          : obj.goals
            ? {
                ...baseIntent,
                goals: (obj.goals as unknown[]).map(g => String(g).trim()),
              }
            : baseIntent;

    // Run validation in strict mode
    if (this.config.strict) {
      const validation = this.validate(intent);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => e.message).join('; ');
        throw new IntentParseError(
          `Validation failed: ${errorMessages}`,
          'VALIDATION_FAILED'
        );
      }
    }

    return intent;
  }

  /**
   * Detects potential conflicts between constraints
   */
  private detectConflicts(constraints: string[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const lowercaseConstraints = constraints.map(c => c.toLowerCase());

    for (const rule of this.config.conflictRules) {
      const [pattern1, pattern2] = rule.patterns;
      const hasPattern1 = lowercaseConstraints.some(c =>
        c.includes(pattern1.toLowerCase())
      );
      const hasPattern2 = lowercaseConstraints.some(c =>
        c.includes(pattern2.toLowerCase())
      );

      if (hasPattern1 && hasPattern2) {
        warnings.push({
          path: ['constraints'],
          message: rule.message,
          code: `CONFLICT_${rule.name.toUpperCase().replace(/-/g, '_')}`,
        });
      }
    }

    return warnings;
  }
}

/**
 * Custom error class for intent parsing errors
 */
export class IntentParseError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'IntentParseError';
    this.code = code;
    Object.setPrototypeOf(this, IntentParseError.prototype);
  }
}

/**
 * Factory function to create an IntentParser instance
 * @param config - Optional configuration options
 * @returns New IntentParser instance
 */
export function createIntentParser(config?: IntentParserConfig): IntentParser {
  return new IntentParser(config);
}
