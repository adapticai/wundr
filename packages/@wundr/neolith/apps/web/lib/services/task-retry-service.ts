/**
 * Task Retry Service
 *
 * Handles retry logic for failed tasks with exponential backoff.
 * Manages retry attempts, error tracking, and automatic blocking.
 *
 * @module lib/services/task-retry-service
 */

import { prisma } from '@neolith/database';

import type { Prisma } from '@prisma/client';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  backoffMultiplier: 2,
};

/**
 * Task retry metadata structure
 */
interface TaskRetryMetadata {
  retryCount?: number;
  lastError?: string;
  lastErrorAt?: string;
  nextRetryAt?: string;
  retryHistory?: Array<{
    attempt: number;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Calculate next retry delay using exponential backoff
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber),
    config.maxDelayMs,
  );
  return delay;
}

/**
 * Calculate next retry timestamp
 */
export function calculateNextRetryTime(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Date {
  const delayMs = calculateRetryDelay(attemptNumber, config);
  return new Date(Date.now() + delayMs);
}

/**
 * Record a task execution failure
 *
 * @param taskId - Task identifier
 * @param error - Error message
 * @param config - Retry configuration
 * @returns Updated retry metadata
 */
export async function recordTaskFailure(
  taskId: string,
  error: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<{ shouldRetry: boolean; nextRetryAt?: Date; retryCount: number }> {
  // Get current task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { metadata: true, status: true },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Extract retry metadata
  const currentMetadata = (task.metadata as TaskRetryMetadata) || {};
  const retryCount = (currentMetadata.retryCount || 0) + 1;
  const retryHistory = currentMetadata.retryHistory || [];

  // Add to retry history
  retryHistory.push({
    attempt: retryCount,
    error,
    timestamp: new Date().toISOString(),
  });

  // Determine if we should retry
  const shouldRetry = retryCount < config.maxRetries;
  const nextRetryAt = shouldRetry ? calculateNextRetryTime(retryCount, config) : undefined;

  // Update task metadata
  const updatedMetadata: Prisma.JsonObject = {
    ...(currentMetadata as Prisma.JsonObject),
    retryCount,
    lastError: error,
    lastErrorAt: new Date().toISOString(),
    ...(nextRetryAt && { nextRetryAt: nextRetryAt.toISOString() }),
    retryHistory,
  };

  // Update task status
  const newStatus = shouldRetry ? 'TODO' : 'BLOCKED';

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      metadata: updatedMetadata,
      updatedAt: new Date(),
    },
  });

  return {
    shouldRetry,
    nextRetryAt,
    retryCount,
  };
}

/**
 * Check if a task is ready for retry
 *
 * @param taskId - Task identifier
 * @returns True if task can be retried now
 */
export async function isTaskReadyForRetry(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { metadata: true, status: true },
  });

  if (!task || task.status !== 'TODO') {
    return false;
  }

  const metadata = task.metadata as TaskRetryMetadata;
  if (!metadata?.nextRetryAt) {
    return true; // No retry scheduled, can execute
  }

  const nextRetryTime = new Date(metadata.nextRetryAt);
  return new Date() >= nextRetryTime;
}

/**
 * Get tasks ready for retry
 *
 * @param orchestratorId - Optional Orchestrator filter
 * @param workspaceId - Optional workspace filter
 * @returns Tasks ready to be retried
 */
export async function getTasksReadyForRetry(orchestratorId?: string, workspaceId?: string) {
  const where: Prisma.taskWhereInput = {
    status: 'TODO',
    metadata: {
      path: ['retryCount'],
      gt: 0,
    },
  };

  if (orchestratorId) {
    where.orchestratorId = orchestratorId;
  }
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      metadata: true,
      orchestratorId: true,
      workspaceId: true,
    },
  });

  // Filter to only tasks where retry time has passed
  const now = new Date();
  return tasks.filter((task) => {
    const metadata = task.metadata as TaskRetryMetadata;
    if (!metadata.nextRetryAt) {
      return true;
    }
    return new Date(metadata.nextRetryAt) <= now;
  });
}

/**
 * Reset retry count for a task (manual intervention)
 *
 * @param taskId - Task identifier
 */
export async function resetTaskRetry(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { metadata: true },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const currentMetadata = (task.metadata as Prisma.JsonObject) || {};
  const updatedMetadata: Prisma.JsonObject = {
    ...currentMetadata,
    retryCount: 0,
    lastError: undefined,
    lastErrorAt: undefined,
    nextRetryAt: undefined,
    retryHistory: [],
  };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      metadata: updatedMetadata,
      status: 'TODO',
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark task as blocked due to max retries exceeded
 *
 * @param taskId - Task identifier
 * @param reason - Block reason
 */
export async function blockTaskAfterMaxRetries(
  taskId: string,
  reason?: string,
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { metadata: true },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const currentMetadata = (task.metadata as Prisma.JsonObject) || {};
  const updatedMetadata: Prisma.JsonObject = {
    ...currentMetadata,
    blockedReason: reason || 'Maximum retry attempts exceeded',
    blockedAt: new Date().toISOString(),
  };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'BLOCKED',
      metadata: updatedMetadata,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get retry statistics for a task
 */
export async function getTaskRetryStats(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { metadata: true, status: true },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const metadata = task.metadata as TaskRetryMetadata;

  return {
    retryCount: metadata.retryCount || 0,
    lastError: metadata.lastError,
    lastErrorAt: metadata.lastErrorAt,
    nextRetryAt: metadata.nextRetryAt,
    retryHistory: metadata.retryHistory || [],
    isBlocked: task.status === 'BLOCKED',
  };
}
