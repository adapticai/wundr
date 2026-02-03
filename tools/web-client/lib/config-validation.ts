import { AppConfig } from './contexts/config/config-context';

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validate?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class ConfigValidator {
  private rules: Record<string, ValidationRule> = {
    // General settings validation
    theme: { required: true },
    language: { required: true, pattern: /^[a-z]{2}$/ },

    // Analysis settings validation
    duplicateThreshold: {
      required: true,
      min: 0,
      max: 1,
      validate: (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) {
          return 'Must be a valid number';
        }
        if (value < 0 || value > 1) {
          return 'Must be between 0.0 and 1.0';
        }
        return null;
      },
    },
    complexityThreshold: {
      required: true,
      min: 1,
      max: 100,
      validate: (value: number) => {
        if (
          typeof value !== 'number' ||
          isNaN(value) ||
          !Number.isInteger(value)
        ) {
          return 'Must be a valid integer';
        }
        return null;
      },
    },
    minFileSize: {
      required: true,
      min: 0,
      validate: (value: number) => {
        if (
          typeof value !== 'number' ||
          isNaN(value) ||
          !Number.isInteger(value)
        ) {
          return 'Must be a valid integer';
        }
        if (value < 0) {
          return 'Must be greater than or equal to 0';
        }
        return null;
      },
    },
    analysisDepth: {
      required: true,
      validate: (value: string) => {
        if (!['shallow', 'medium', 'deep'].includes(value)) {
          return 'Must be shallow, medium, or deep';
        }
        return null;
      },
    },

    // URL validation for webhooks
    'webhookUrls.onAnalysisComplete': {
      validate: (value: string) => {
        if (value && !this.isValidUrl(value)) {
          return 'Must be a valid URL';
        }
        return null;
      },
    },
    'webhookUrls.onReportGenerated': {
      validate: (value: string) => {
        if (value && !this.isValidUrl(value)) {
          return 'Must be a valid URL';
        }
        return null;
      },
    },
    'webhookUrls.onError': {
      validate: (value: string) => {
        if (value && !this.isValidUrl(value)) {
          return 'Must be a valid URL';
        }
        return null;
      },
    },

    // Export settings validation
    maxFileSize: {
      required: true,
      min: 1,
      max: 1000,
      validate: (value: number) => {
        if (
          typeof value !== 'number' ||
          isNaN(value) ||
          !Number.isInteger(value)
        ) {
          return 'Must be a valid integer';
        }
        return null;
      },
    },
    defaultPath: {
      validate: (value: string) => {
        if (
          value &&
          (value.includes('..') || value.includes('<') || value.includes('>'))
        ) {
          return 'Invalid path format';
        }
        return null;
      },
    },
  };

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  validate(field: string, value: any): ValidationResult {
    const rule = this.rules[field];
    if (!rule) {
      return { isValid: true };
    }

    // Check required
    if (
      rule.required &&
      (value === null || value === undefined || value === '')
    ) {
      return { isValid: false, error: 'This field is required' };
    }

    // Check custom validation function
    if (rule.validate) {
      const error = rule.validate(value);
      if (error) {
        return { isValid: false, error };
      }
    }

    // Check min/max for numbers
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return { isValid: false, error: `Must be at least ${rule.min}` };
      }
      if (rule.max !== undefined && value > rule.max) {
        return { isValid: false, error: `Must be at most ${rule.max}` };
      }
    }

    // Check pattern for strings
    if (
      typeof value === 'string' &&
      rule.pattern &&
      !rule.pattern.test(value)
    ) {
      return { isValid: false, error: 'Invalid format' };
    }

    return { isValid: true };
  }

  validateConfig(config: Partial<AppConfig>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate individual fields
    for (const [field, value] of Object.entries(config)) {
      const result = this.validate(field, value);
      if (!result.isValid && result.error) {
        errors[field] = result.error;
      }
    }

    // Validate nested objects
    if (config.webhookUrls) {
      for (const [key, value] of Object.entries(config.webhookUrls)) {
        const result = this.validate(`webhookUrls.${key}`, value);
        if (!result.isValid && result.error) {
          errors[`webhookUrls.${key}`] = result.error;
        }
      }
    }

    if (config.apiKeys) {
      for (const [key, value] of Object.entries(config.apiKeys)) {
        const result = this.validate(`apiKeys.${key}`, value);
        if (!result.isValid && result.error) {
          errors[`apiKeys.${key}`] = result.error;
        }
      }
    }

    if (config.automations) {
      for (const [key, value] of Object.entries(config.automations)) {
        const result = this.validate(`automations.${key}`, value);
        if (!result.isValid && result.error) {
          errors[`automations.${key}`] = result.error;
        }
      }
    }

    return errors;
  }

  validateField(field: string, value: any): ValidationResult {
    return this.validate(field, value);
  }

  validateFieldWithSection(
    section: string,
    field: string,
    value: any
  ): ValidationResult {
    const fieldPath = section ? `${section}.${field}` : field;
    return this.validate(fieldPath, value);
  }
}

export const configValidator = new ConfigValidator();

// Export config type for TypeScript imports
export type ConfigType = {
  theme: string;
  language: string;
  duplicateThreshold: number;
  complexityThreshold: number;
  minFileSize: number;
  maxFileSize: number;
  analysisDepth: string;
  defaultPath: string;
  'webhookUrls.onAnalysisComplete': string;
  'webhookUrls.onReportGenerated': string;
  'webhookUrls.onError': string;
};
