/**
 * Tests for Cron Validation Utilities
 *
 * @module tests/lib/cron-validation.test
 */

import { describe, expect, it } from 'vitest';

import {
  CRON_PRESETS,
  describeCronExpression,
  frequencyToCron,
  getNextExecution,
  parseCronExpression,
  validateFrequencyLimit,
} from '@/lib/cron-validation';

describe('Cron Validation', () => {
  describe('parseCronExpression', () => {
    it('should parse valid cron expressions', () => {
      const result = parseCronExpression('0 9 * * 1');
      expect(result).toEqual({
        minute: '0',
        hour: '9',
        dayOfMonth: '*',
        month: '*',
        dayOfWeek: '1',
      });
    });

    it('should parse expressions with step values', () => {
      const result = parseCronExpression('*/15 */2 * * *');
      expect(result).toEqual({
        minute: '*/15',
        hour: '*/2',
        dayOfMonth: '*',
        month: '*',
        dayOfWeek: '*',
      });
    });

    it('should return null for invalid expressions', () => {
      expect(parseCronExpression('invalid')).toBeNull();
      expect(parseCronExpression('0 25 * * *')).toBeNull(); // Invalid hour
      expect(parseCronExpression('60 0 * * *')).toBeNull(); // Invalid minute
    });
  });

  describe('CRON_PRESETS', () => {
    it('should have correct preset values', () => {
      expect(CRON_PRESETS.HOURLY).toBe('0 * * * *');
      expect(CRON_PRESETS.DAILY).toBe('0 0 * * *');
      expect(CRON_PRESETS.WEEKLY).toBe('0 0 * * 0');
      expect(CRON_PRESETS.MONTHLY).toBe('0 0 1 * *');
      expect(CRON_PRESETS.QUARTERLY).toBe('0 0 1 */3 *');
      expect(CRON_PRESETS.YEARLY).toBe('0 0 1 1 *');
    });
  });

  describe('frequencyToCron', () => {
    it('should convert hourly frequency', () => {
      expect(frequencyToCron('hourly')).toBe('0 * * * *');
      expect(frequencyToCron('hourly', { minute: 30 })).toBe('30 * * * *');
    });

    it('should convert daily frequency', () => {
      expect(frequencyToCron('daily')).toBe('0 0 * * *');
      expect(frequencyToCron('daily', { hour: 9, minute: 30 })).toBe(
        '30 9 * * *'
      );
    });

    it('should convert weekly frequency', () => {
      expect(frequencyToCron('weekly')).toBe('0 0 * * 0');
      expect(frequencyToCron('weekly', { hour: 9, dayOfWeek: 1 })).toBe(
        '0 9 * * 1'
      );
    });

    it('should convert monthly frequency', () => {
      expect(frequencyToCron('monthly')).toBe('0 0 1 * *');
      expect(frequencyToCron('monthly', { hour: 9, dayOfMonth: 15 })).toBe(
        '0 9 15 * *'
      );
    });

    it('should convert quarterly frequency', () => {
      expect(frequencyToCron('quarterly')).toBe('0 0 1 */3 *');
      expect(frequencyToCron('quarterly', { hour: 12 })).toBe('0 12 1 */3 *');
    });
  });

  describe('describeCronExpression', () => {
    it('should describe preset expressions', () => {
      expect(describeCronExpression('0 * * * *')).toBe('Hourly');
      expect(describeCronExpression('0 0 * * *')).toBe('Daily');
      expect(describeCronExpression('0 0 * * 0')).toBe('Weekly');
      expect(describeCronExpression('0 0 1 * *')).toBe('Monthly');
    });

    it('should describe custom expressions', () => {
      const desc1 = describeCronExpression('0 9 * * 1');
      expect(desc1).toContain('9:00');
      expect(desc1).toContain('Monday');

      const desc2 = describeCronExpression('30 14 15 * *');
      expect(desc2).toContain('minute 30');
      expect(desc2).toContain('14:00');
      expect(desc2).toContain('day 15');
    });

    it('should handle step values', () => {
      const desc = describeCronExpression('0 */6 * * *');
      expect(desc).toContain('every 6 hours');
    });

    it('should return error for invalid expressions', () => {
      expect(describeCronExpression('invalid')).toBe('Invalid cron expression');
    });
  });

  describe('getNextExecution', () => {
    it('should calculate next execution for daily schedule', () => {
      const baseDate = new Date('2024-12-06T08:00:00Z');
      const next = getNextExecution('0 9 * * *', baseDate);

      expect(next).not.toBeNull();
      expect(next?.getHours()).toBe(9);
      expect(next?.getMinutes()).toBe(0);
    });

    it('should advance to next day if time has passed', () => {
      const baseDate = new Date('2024-12-06T10:00:00Z');
      const next = getNextExecution('0 9 * * *', baseDate);

      expect(next).not.toBeNull();
      expect(next!.getDate()).toBe(7); // Next day
    });

    it('should calculate next execution for weekly schedule', () => {
      const baseDate = new Date('2024-12-06T08:00:00Z'); // Friday
      const next = getNextExecution('0 9 * * 1', baseDate); // Every Monday

      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(1); // Monday
      expect(next!.getHours()).toBe(9);
    });

    it('should return null for invalid expression', () => {
      const next = getNextExecution('invalid', new Date());
      expect(next).toBeNull();
    });
  });

  describe('validateFrequencyLimit', () => {
    it('should allow hourly frequency', () => {
      expect(validateFrequencyLimit('0 * * * *', 60)).toBe(true);
    });

    it('should reject too frequent schedules', () => {
      expect(validateFrequencyLimit('*/30 * * * *', 60)).toBe(true);
      expect(validateFrequencyLimit('*/15 * * * *', 60)).toBe(false);
      expect(validateFrequencyLimit('*/5 * * * *', 60)).toBe(false);
    });

    it('should reject minute-level schedules', () => {
      expect(validateFrequencyLimit('* * * * *', 60)).toBe(false);
    });

    it('should allow daily and less frequent schedules', () => {
      expect(validateFrequencyLimit('0 0 * * *', 60)).toBe(true);
      expect(validateFrequencyLimit('0 0 * * 0', 60)).toBe(true);
      expect(validateFrequencyLimit('0 0 1 * *', 60)).toBe(true);
    });

    it('should return false for invalid expressions', () => {
      expect(validateFrequencyLimit('invalid', 60)).toBe(false);
    });
  });
});
