/**
 * Scheduling module for the orchestrator daemon
 *
 * Exports the CronScheduler along with a factory that pre-registers all
 * default daemon schedules:
 *
 *   - Every 15 minutes : PROACTIVE_SCAN
 *   - Every 30 minutes : CHARTER_SYNC
 *   - Every hour       : BACKLOG_REVIEW
 *   - Every 6 hours    : STATUS_REPORT
 *   - Daily midnight   : MAINTENANCE
 *   - Daily 3am        : MEMORY_CLEANUP
 */

export { CronScheduler } from './cron-scheduler';
export type {
  ScheduledTask,
  ScheduledTaskType,
  SchedulerEventMap,
  ScheduledRunInfo,
} from './cron-scheduler';

import { CronScheduler } from './cron-scheduler';
import type { ScheduledTask } from './cron-scheduler';

/**
 * Default daemon scheduled tasks.
 */
export const DEFAULT_SCHEDULES: ScheduledTask[] = [
  {
    id: 'default:proactive-scan',
    name: 'Proactive Scan',
    cronExpression: '*/15 * * * *', // Every 15 minutes
    taskType: 'PROACTIVE_SCAN',
    config: {},
    enabled: true,
    runCount: 0,
  },
  {
    id: 'default:charter-sync',
    name: 'Charter Sync',
    cronExpression: '*/30 * * * *', // Every 30 minutes
    taskType: 'CHARTER_SYNC',
    config: {},
    enabled: true,
    runCount: 0,
  },
  {
    id: 'default:backlog-review',
    name: 'Backlog Review',
    cronExpression: '0 * * * *', // Every hour, on the hour
    taskType: 'BACKLOG_REVIEW',
    config: {},
    enabled: true,
    runCount: 0,
  },
  {
    id: 'default:status-report',
    name: 'Status Report',
    cronExpression: '0 */6 * * *', // Every 6 hours
    taskType: 'STATUS_REPORT',
    config: {},
    enabled: true,
    runCount: 0,
  },
  {
    id: 'default:maintenance',
    name: 'Daily Maintenance',
    cronExpression: '0 0 * * *', // Daily at midnight
    taskType: 'MAINTENANCE',
    config: {},
    enabled: true,
    runCount: 0,
  },
  {
    id: 'default:memory-cleanup',
    name: 'Memory Cleanup',
    cronExpression: '0 3 * * *', // Daily at 3am
    taskType: 'MEMORY_CLEANUP',
    config: {},
    enabled: true,
    runCount: 0,
  },
];

/**
 * Create a CronScheduler pre-loaded with all default daemon schedules.
 *
 * @example
 * ```typescript
 * import { createDefaultScheduler } from './core/scheduling';
 *
 * const scheduler = createDefaultScheduler();
 * scheduler.on('task:triggered', ({ task, firedAt }) => {
 *   console.log(`[cron] ${task.name} fired at ${firedAt.toISOString()}`);
 * });
 * scheduler.start();
 * ```
 */
export function createDefaultScheduler(): CronScheduler {
  const scheduler = new CronScheduler();

  for (const task of DEFAULT_SCHEDULES) {
    scheduler.registerTask(task);
  }

  return scheduler;
}
