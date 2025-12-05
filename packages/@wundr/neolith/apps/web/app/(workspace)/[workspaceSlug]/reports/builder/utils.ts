/**
 * Report Builder Utilities
 * Helper functions for report builder
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique widget ID
 */
export function generateWidgetId(): string {
  return `widget-${uuidv4()}`;
}

/**
 * Generate a unique data source ID
 */
export function generateDataSourceId(): string {
  return `datasource-${uuidv4()}`;
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: string): boolean {
  // Basic validation - can be enhanced
  const parts = expression.trim().split(/\s+/);
  return parts.length === 5;
}

/**
 * Format cron expression to human-readable text
 */
export function formatCronExpression(expression: string): string {
  try {
    const parts = expression.split(' ');
    if (parts.length !== 5) return expression;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Simple patterns
    if (expression === '0 9 * * *') return 'Daily at 9:00 AM';
    if (expression === '0 9 * * 1') return 'Weekly on Monday at 9:00 AM';
    if (expression === '0 9 1 * *') return 'Monthly on the 1st at 9:00 AM';

    return expression;
  } catch {
    return expression;
  }
}

/**
 * Calculate next run time based on schedule
 */
export function getNextRunTime(schedule: {
  frequency: string;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): Date {
  const now = new Date();
  const [hours, minutes] = (schedule.time || '09:00').split(':').map(Number);

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      const targetDay = schedule.dayOfWeek || 1;
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }
      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      const targetDate = schedule.dayOfMonth || 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }

  return next;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate sample data for charts
 */
export function generateSampleData(
  type: 'timeseries' | 'categorical' | 'pie',
  count: number = 6
): Array<Record<string, string | number>> {
  switch (type) {
    case 'timeseries':
      return Array.from({ length: count }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (count - i - 1));
        return {
          date: date.toISOString().slice(0, 7),
          value: Math.floor(Math.random() * 5000) + 1000,
          target: Math.floor(Math.random() * 5000) + 1000,
        };
      });

    case 'categorical':
      const categories = ['Category A', 'Category B', 'Category C', 'Category D'];
      return categories.map((name) => ({
        name,
        value: Math.floor(Math.random() * 1000) + 100,
      }));

    case 'pie':
      const statuses = ['Completed', 'In Progress', 'Pending', 'Cancelled'];
      return statuses.map((name) => ({
        name,
        value: Math.floor(Math.random() * 500) + 50,
      }));

    default:
      return [];
  }
}

/**
 * Export utilities
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert widget config to exportable format
 */
export function serializeWidgetConfig(widget: any): string {
  return JSON.stringify(widget, null, 2);
}

/**
 * Parse imported widget config
 */
export function deserializeWidgetConfig(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
