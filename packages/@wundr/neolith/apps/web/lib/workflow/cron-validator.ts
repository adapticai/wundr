/**
 * Cron Expression Validator
 *
 * Validates cron expressions for scheduled workflow triggers.
 *
 * @module lib/workflow/cron-validator
 */

/**
 * Validate a cron expression
 * Supports standard 5-field cron format: minute hour day month weekday
 * Also supports extended 6-field format: second minute hour day month weekday
 */
export function validateCronExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Cron expression must be a non-empty string' };
  }

  const fields = expression.trim().split(/\s+/);

  // Support 5-field (standard) or 6-field (with seconds) format
  if (fields.length !== 5 && fields.length !== 6) {
    return {
      valid: false,
      error: 'Cron expression must have 5 or 6 fields',
    };
  }

  const ranges = fields.length === 6
    ? [
        { name: 'second', min: 0, max: 59 },
        { name: 'minute', min: 0, max: 59 },
        { name: 'hour', min: 0, max: 23 },
        { name: 'day', min: 1, max: 31 },
        { name: 'month', min: 1, max: 12 },
        { name: 'weekday', min: 0, max: 7 },
      ]
    : [
        { name: 'minute', min: 0, max: 59 },
        { name: 'hour', min: 0, max: 23 },
        { name: 'day', min: 1, max: 31 },
        { name: 'month', min: 1, max: 12 },
        { name: 'weekday', min: 0, max: 7 },
      ];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const range = ranges[i];

    const validation = validateCronField(field, range.min, range.max);
    if (!validation.valid) {
      return {
        valid: false,
        error: `Invalid ${range.name} field: ${validation.error}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate a single cron field
 */
function validateCronField(
  field: string,
  min: number,
  max: number,
): { valid: boolean; error?: string } {
  // Wildcard
  if (field === '*') {
    return { valid: true };
  }

  // Step values
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    if (!range || !step) {
      return { valid: false, error: 'Invalid step syntax' };
    }

    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1) {
      return { valid: false, error: 'Step must be a positive number' };
    }

    if (range !== '*') {
      const rangeValidation = validateCronField(range, min, max);
      if (!rangeValidation.valid) {
        return rangeValidation;
      }
    }

    return { valid: true };
  }

  // Range values
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    if (!start || !end) {
      return { valid: false, error: 'Invalid range syntax' };
    }

    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (isNaN(startNum) || isNaN(endNum)) {
      return { valid: false, error: 'Range values must be numbers' };
    }

    if (startNum < min || startNum > max || endNum < min || endNum > max) {
      return { valid: false, error: `Range must be between ${min} and ${max}` };
    }

    if (startNum >= endNum) {
      return { valid: false, error: 'Range start must be less than end' };
    }

    return { valid: true };
  }

  // List values
  if (field.includes(',')) {
    const values = field.split(',');
    for (const value of values) {
      const validation = validateCronField(value.trim(), min, max);
      if (!validation.valid) {
        return validation;
      }
    }
    return { valid: true };
  }

  // Single value
  const num = parseInt(field, 10);
  if (isNaN(num)) {
    return { valid: false, error: 'Value must be a number' };
  }

  if (num < min || num > max) {
    return { valid: false, error: `Value must be between ${min} and ${max}` };
  }

  return { valid: true };
}

/**
 * Get next execution time for a cron expression
 * This is a simplified implementation - in production, use a library like 'cron-parser'
 */
export function getNextExecutionTime(cronExpression: string): Date | null {
  const validation = validateCronExpression(cronExpression);
  if (!validation.valid) {
    return null;
  }

  // For now, return 1 minute in the future as a placeholder
  // In production, use a proper cron parser library
  const next = new Date();
  next.setMinutes(next.getMinutes() + 1);
  return next;
}

/**
 * Common cron expression presets
 */
export const CRON_PRESETS: Record<string, { expression: string; description: string }> = {
  'every-minute': {
    expression: '* * * * *',
    description: 'Every minute',
  },
  'every-5-minutes': {
    expression: '*/5 * * * *',
    description: 'Every 5 minutes',
  },
  'every-15-minutes': {
    expression: '*/15 * * * *',
    description: 'Every 15 minutes',
  },
  'every-30-minutes': {
    expression: '*/30 * * * *',
    description: 'Every 30 minutes',
  },
  'every-hour': {
    expression: '0 * * * *',
    description: 'Every hour',
  },
  'every-day': {
    expression: '0 0 * * *',
    description: 'Every day at midnight',
  },
  'every-week': {
    expression: '0 0 * * 0',
    description: 'Every Sunday at midnight',
  },
  'every-month': {
    expression: '0 0 1 * *',
    description: 'First day of every month at midnight',
  },
  'weekdays-9am': {
    expression: '0 9 * * 1-5',
    description: 'Weekdays at 9 AM',
  },
};
