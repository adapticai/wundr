/**
 * VP Status Service
 *
 * Handles posting status updates to channels for VP work execution.
 * Manages task progress notifications and error reporting.
 *
 * @module lib/services/vp-status-service
 */

import { prisma } from '@neolith/database';

import type { StatusUpdateType } from '@/lib/validations/work-session';

/**
 * Status update input
 */
export interface StatusUpdateInput {
  vpId: string;
  channelId: string;
  message: string;
  type: StatusUpdateType;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Format status message based on type
 */
function formatStatusMessage(
  type: StatusUpdateType,
  message: string,
  vpRole: string,
  taskTitle?: string,
): string {
  const emoji: Record<StatusUpdateType, string> = {
    task_started: '🚀',
    progress: '⏳',
    task_completed: '✅',
    blocked: '🚫',
    error: '❌',
    info: 'ℹ️',
  };

  const prefix = emoji[type] || '';
  const taskContext = taskTitle ? ` **${taskTitle}**` : '';

  return `${prefix} **${vpRole}**${taskContext}: ${message}`;
}

/**
 * Post a status update to a channel
 *
 * @param input - Status update details
 * @returns Created message
 */
export async function postStatusUpdate(input: StatusUpdateInput) {
  const { vpId, channelId, message, type, taskId, metadata } = input;

  // Verify VP exists
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  if (!vp) {
    throw new Error(`VP not found: ${vpId}`);
  }

  // Verify channel exists and VP has access
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      workspaceId: true,
    },
  });

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  // Get task title if taskId provided
  let taskTitle: string | undefined;
  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });
    taskTitle = task?.title;
  }

  // Format the message
  const formattedMessage = formatStatusMessage(type, message, vp.role, taskTitle);

  // Create message metadata
  const messageMetadata = {
    type: 'vp_status_update',
    statusType: type,
    vpId,
    ...(taskId && { taskId }),
    ...(metadata && { ...metadata }),
  };

  // Create the message in the channel
  const createdMessage = await prisma.message.create({
    data: {
      content: formattedMessage,
      type: 'SYSTEM',
      channelId,
      authorId: vp.user.id,
      metadata: messageMetadata,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return createdMessage;
}

/**
 * Post task started notification
 */
export async function postTaskStarted(
  vpId: string,
  taskId: string,
  channelId: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, priority: true },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return postStatusUpdate({
    vpId,
    channelId,
    message: `Started working on task (Priority: ${task.priority})`,
    type: 'task_started',
    taskId,
    metadata: { priority: task.priority },
  });
}

/**
 * Post task progress update
 */
export async function postTaskProgress(
  vpId: string,
  taskId: string,
  channelId: string,
  progress: number,
  statusMessage?: string,
) {
  const message = statusMessage || `Progress: ${progress}%`;

  return postStatusUpdate({
    vpId,
    channelId,
    message,
    type: 'progress',
    taskId,
    metadata: { progress },
  });
}

/**
 * Post task completed notification
 */
export async function postTaskCompleted(
  vpId: string,
  taskId: string,
  channelId: string,
  result?: Record<string, unknown>,
) {
  return postStatusUpdate({
    vpId,
    channelId,
    message: 'Task completed successfully',
    type: 'task_completed',
    taskId,
    metadata: result,
  });
}

/**
 * Post task blocked notification
 */
export async function postTaskBlocked(
  vpId: string,
  taskId: string,
  channelId: string,
  reason: string,
) {
  return postStatusUpdate({
    vpId,
    channelId,
    message: `Task blocked: ${reason}`,
    type: 'blocked',
    taskId,
    metadata: { blockReason: reason },
  });
}

/**
 * Post error notification
 */
export async function postTaskError(
  vpId: string,
  taskId: string,
  channelId: string,
  error: string,
) {
  return postStatusUpdate({
    vpId,
    channelId,
    message: `Error occurred: ${error}`,
    type: 'error',
    taskId,
    metadata: { error },
  });
}

/**
 * Post informational update
 */
export async function postInfoUpdate(
  vpId: string,
  channelId: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  return postStatusUpdate({
    vpId,
    channelId,
    message,
    type: 'info',
    metadata,
  });
}
