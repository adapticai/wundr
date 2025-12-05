/**
 * Cron Expression Validation Utilities
 *
 * Provides validation and parsing for cron expressions used in scheduled reports.
 * Supports standard cron syntax and common presets.
 *
 * @module lib/cron-validation
 */

import { z } from 'zod';

/**
 * Cron expression format: minute hour day-of-month month day-of-week
 * Examples:
 * - "0 9 * * 1" - Every Monday at 9:00 AM
 * - "0 0 1 * *" - First day of every month at midnight
 * - "0 6 1 1 1" - Every 6 hours (example)
 */
const CRON_REGEX = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/[0-6])$/;

/**
 * Common cron presets for easy scheduling
 */
export const CRON_PRESETS = {
  HOURLY: '0 * * * *',
  DAILY: '0 0 * * *',
  WEEKLY: '0 0 * * 0',
  MONTHLY: '0 0 1 * *',
  QUARTERLY: '0 0 1 */3 *',
  YEARLY: '0 0 1 1 *',
} as const;

/**
 * Frequency type for scheduling
 */
export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';

/**
 * Cron expression validation schema
 */
export const cronExpressionSchema = z.string().refine(
  (value) => {
    // Check if it's a preset
    if (Object.values(CRON_PRESETS).includes(value as any)) {
      return true;
    }
    // Validate against regex
    return CRON_REGEX.test(value);
  },
  {
    message: 'Invalid cron expression format. Use standard cron syntax (e.g., "0 9 * * 1") or a preset.',
  },
);

/**
 * Parse cron expression into components
 */
export interface CronComponents {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

/**
 * Parse a cron expression into its components
 * @param expression - Cron expression to parse
 * @returns Parsed components or null if invalid
 */
export function parseCronExpression(expression: string): CronComponents | null {
  if (!CRON_REGEX.test(expression)) {
    return null;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');

  return {
    minute: minute || '*',
    hour: hour || '*',
    dayOfMonth: dayOfMonth || '*',
    month: month || '*',
    dayOfWeek: dayOfWeek || '*',
  };
}

/**
 * Convert frequency to cron expression
 * @param frequency - Schedule frequency
 * @param options - Additional options (hour, dayOfWeek, dayOfMonth)
 * @returns Cron expression
 */
export function frequencyToCron(
  frequency: ScheduleFrequency,
  options?: {
    hour?: number;
    minute?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  },
): string {
  const hour = options?.hour ?? 0;
  const minute = options?.minute ?? 0;
  const dayOfWeek = options?.dayOfWeek ?? 0;
  const dayOfMonth = options?.dayOfMonth ?? 1;

  switch (frequency) {
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    case 'quarterly':
      return `${minute} ${hour} ${dayOfMonth} */3 *`;
    default:
      return CRON_PRESETS.DAILY;
  }
}

/**
 * Get next execution time for a cron expression
 * @param expression - Cron expression
 * @param fromDate - Starting date (defaults to now)
 * @returns Next execution date or null if invalid
 */
export function getNextExecution(expression: string, fromDate: Date = new Date()): Date | null {
  const components = parseCronExpression(expression);
  if (!components) {
    return null;
  }

  // Simple implementation - calculates next execution based on components
  const next = new Date(fromDate);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // Parse minute
  if (components.minute !== '*') {
    const targetMinute = parseInt(components.minute);
    if (next.getMinutes() >= targetMinute) {
      next.setHours(next.getHours() + 1);
    }
    next.setMinutes(targetMinute);
  }

  // Parse hour
  if (components.hour !== '*') {
    const targetHour = parseInt(components.hour);
    if (next.getHours() >= targetHour && components.minute === '*') {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHour);
  }

  // Parse day of month
  if (components.dayOfMonth !== '*') {
    const targetDay = parseInt(components.dayOfMonth);
    if (next.getDate() >= targetDay) {
      next.setMonth(next.getMonth() + 1);
    }
    next.setDate(targetDay);
  }

  // Parse month
  if (components.month !== '*') {
    const targetMonth = parseInt(components.month) - 1; // JavaScript months are 0-indexed
    if (next.getMonth() >= targetMonth) {
      next.setFullYear(next.getFullYear() + 1);
    }
    next.setMonth(targetMonth);
  }

  // Parse day of week (0 = Sunday, 6 = Saturday)
  if (components.dayOfWeek !== '*' && components.dayOfMonth === '*') {
    const targetDayOfWeek = parseInt(components.dayOfWeek);
    const currentDayOfWeek = next.getDay();
    let daysToAdd = targetDayOfWeek - currentDayOfWeek;

    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    next.setDate(next.getDate() + daysToAdd);
  }

  return next;
}

/**
 * Describe a cron expression in human-readable format
 * @param expression - Cron expression to describe
 * @returns Human-readable description
 */
export function describeCronExpression(expression: string): string {
  // Check presets first
  for (const [name, preset] of Object.entries(CRON_PRESETS)) {
    if (preset === expression) {
      return name.charAt(0) + name.slice(1).toLowerCase();
    }
  }

  const components = parseCronExpression(expression);
  if (!components) {
    return 'Invalid cron expression';
  }

  const parts: string[] = [];

  // Minute
  if (components.minute !== '*') {
    parts.push(`at minute ${components.minute}`);
  }

  // Hour
  if (components.hour !== '*') {
    if (components.hour.includes('/')) {
      const interval = components.hour.split('/')[1];
      parts.push(`every ${interval} hours`);
    } else {
      parts.push(`at ${components.hour}:00`);
    }
  }

  // Day of month
  if (components.dayOfMonth !== '*') {
    parts.push(`on day ${components.dayOfMonth}`);
  }

  // Month
  if (components.month !== '*') {
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    parts.push(`in ${months[parseInt(components.month)]}`);
  }

  // Day of week
  if (components.dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    parts.push(`on ${days[parseInt(components.dayOfWeek)]}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Every minute';
}

/**
 * Validate if a cron expression will execute too frequently
 * @param expression - Cron expression to validate
 * @param maxFrequencyMinutes - Maximum allowed frequency in minutes (default: 60)
 * @returns true if valid, false if too frequent
 */
export function validateFrequencyLimit(expression: string, maxFrequencyMinutes: number = 60): boolean {
  const components = parseCronExpression(expression);
  if (!components) {
    return false;
  }

  // If minute is a step value (e.g., */5), check if it's too frequent
  if (components.minute.includes('/')) {
    const minuteInterval = parseInt(components.minute.split('/')[1]);
    if (minuteInterval < maxFrequencyMinutes) {
      return false;
    }
  }

  // If hour is a step value but minute is *, it runs every minute
  if (components.minute === '*' && components.hour !== '*') {
    return false;
  }

  return true;
}
