/**
 * Variable validation utilities for workflow variables
 */

import type { ScopedWorkflowVariable } from './variable-manager';
import type { VariableType } from '@/types/workflow';

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Variable validation result
 */
export interface VariableValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate variable name format
 */
export function isValidVariableName(name: string): boolean {
  // Must start with letter or underscore, contain only alphanumeric and underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Check if variable name is a reserved keyword
 */
export function isReservedKeyword(name: string): boolean {
  const reserved = [
    'trigger',
    'action',
    'workflow',
    'step',
    'result',
    'error',
    'output',
    'input',
    'context',
    'system',
  ];
  return reserved.includes(name.toLowerCase());
}

/**
 * Validate variable name
 */
export function validateVariableName(
  name: string,
  existingNames: string[] = [],
): string | null {
  if (!name) {
    return 'Variable name is required';
  }

  if (!isValidVariableName(name)) {
    return 'Variable name must start with a letter or underscore and contain only letters, numbers, and underscores';
  }

  if (isReservedKeyword(name)) {
    return `"${name}" is a reserved keyword and cannot be used as a variable name`;
  }

  if (existingNames.includes(name)) {
    return 'Variable name already exists';
  }

  if (name.length > 64) {
    return 'Variable name must be 64 characters or less';
  }

  return null;
}

/**
 * Validate default value based on type
 */
export function validateDefaultValue(
  value: string,
  type: VariableType,
): string | null {
  if (!value) {
    return null; // Empty values are allowed
  }

  try {
    switch (type) {
      case 'string':
        // Strings are always valid
        return null;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          return 'Invalid number value';
        }
        if (!isFinite(num)) {
          return 'Number must be finite';
        }
        return null;

      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          return 'Boolean value must be "true" or "false"';
        }
        return null;

      case 'array':
        const arrParsed = JSON.parse(value);
        if (!Array.isArray(arrParsed)) {
          return 'Value must be a valid JSON array';
        }
        return null;

      case 'object':
        const objParsed = JSON.parse(value);
        if (Array.isArray(objParsed) || typeof objParsed !== 'object' || objParsed === null) {
          return 'Value must be a valid JSON object';
        }
        return null;

      default:
        return `Unknown type: ${type}`;
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return `Invalid JSON format: ${error.message}`;
    }
    return `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Validate a complete variable definition
 */
export function validateVariable(
  variable: Partial<ScopedWorkflowVariable>,
  existingVariables: ScopedWorkflowVariable[] = [],
): VariableValidationResult {
  const errors: ValidationError[] = [];

  // Validate name
  const existingNames = existingVariables
    .filter((v) => v.id !== variable.id)
    .map((v) => v.name);
  const nameError = validateVariableName(variable.name || '', existingNames);
  if (nameError) {
    errors.push({ field: 'name', message: nameError });
  }

  // Validate type
  if (!variable.type) {
    errors.push({ field: 'type', message: 'Variable type is required' });
  } else {
    const validTypes: VariableType[] = ['string', 'number', 'boolean', 'array', 'object'];
    if (!validTypes.includes(variable.type)) {
      errors.push({ field: 'type', message: 'Invalid variable type' });
    }
  }

  // Validate default value if provided
  if (variable.defaultValue !== undefined && variable.type) {
    const defaultValueStr = typeof variable.defaultValue === 'string'
      ? variable.defaultValue
      : JSON.stringify(variable.defaultValue);
    const valueError = validateDefaultValue(defaultValueStr, variable.type);
    if (valueError) {
      errors.push({ field: 'defaultValue', message: valueError });
    }
  }

  // Validate scope
  if (!variable.scope) {
    errors.push({ field: 'scope', message: 'Variable scope is required' });
  } else if (variable.scope !== 'global' && variable.scope !== 'step') {
    errors.push({ field: 'scope', message: 'Invalid variable scope' });
  }

  // Validate step ID for step-scoped variables
  if (variable.scope === 'step' && !variable.stepId) {
    errors.push({ field: 'stepId', message: 'Step ID is required for step-scoped variables' });
  }

  // Validate description length
  if (variable.description && variable.description.length > 500) {
    errors.push({ field: 'description', message: 'Description must be 500 characters or less' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Extract variable references from a string
 */
export function extractVariableReferences(text: string): string[] {
  const regex = /\$\{variable\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Validate variable references in a string
 */
export function validateVariableReferences(
  text: string,
  availableVariables: ScopedWorkflowVariable[],
): VariableValidationResult {
  const errors: ValidationError[] = [];
  const references = extractVariableReferences(text);
  const availableNames = availableVariables.map((v) => v.name);

  references.forEach((ref) => {
    if (!availableNames.includes(ref)) {
      errors.push({
        field: 'reference',
        message: `Variable "${ref}" is not defined`,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string contains any variable references
 */
export function hasVariableReferences(text: string): boolean {
  return /\$\{variable\.[a-zA-Z_][a-zA-Z0-9_]*\}/.test(text);
}

/**
 * Replace variable references with their values (for preview/testing)
 */
export function replaceVariableReferences(
  text: string,
  variables: Record<string, any>,
): string {
  return text.replace(
    /\$\{variable\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, varName) => {
      if (varName in variables) {
        const value = variables[varName];
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      }
      return match; // Keep original if not found
    },
  );
}

/**
 * Validate all variables in a workflow
 */
export function validateWorkflowVariables(
  variables: ScopedWorkflowVariable[],
): VariableValidationResult {
  const errors: ValidationError[] = [];
  const names = new Set<string>();

  variables.forEach((variable, index) => {
    // Check for duplicate names
    if (names.has(variable.name)) {
      errors.push({
        field: `variable[${index}].name`,
        message: `Duplicate variable name: ${variable.name}`,
      });
    } else {
      names.add(variable.name);
    }

    // Validate individual variable
    const result = validateVariable(variable, variables);
    result.errors.forEach((error) => {
      errors.push({
        field: `variable[${index}].${error.field}`,
        message: error.message,
      });
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Type guard to check if a value matches a variable type
 */
export function isValueOfType(value: any, type: VariableType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Convert a value to match a variable type (with validation)
 */
export function coerceToType(
  value: any,
  type: VariableType,
): { success: boolean; value?: any; error?: string } {
  try {
    switch (type) {
      case 'string':
        return { success: true, value: String(value) };

      case 'number':
        const num = Number(value);
        if (isNaN(num) || !isFinite(num)) {
          return { success: false, error: 'Cannot convert to valid number' };
        }
        return { success: true, value: num };

      case 'boolean':
        if (typeof value === 'boolean') {
          return { success: true, value };
        }
        if (typeof value === 'string') {
          if (value === 'true') {
return { success: true, value: true };
}
          if (value === 'false') {
return { success: true, value: false };
}
        }
        return { success: false, error: 'Cannot convert to boolean' };

      case 'array':
        if (Array.isArray(value)) {
          return { success: true, value };
        }
        if (typeof value === 'string') {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return { success: true, value: parsed };
          }
        }
        return { success: false, error: 'Cannot convert to array' };

      case 'object':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return { success: true, value };
        }
        if (typeof value === 'string') {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return { success: true, value: parsed };
          }
        }
        return { success: false, error: 'Cannot convert to object' };

      default:
        return { success: false, error: `Unknown type: ${type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Conversion failed',
    };
  }
}
