/**
 * AI Token Tracking and Usage Logging
 *
 * Tracks token usage, costs, and provides audit logging for AI requests.
 * Integrates with workspace quotas and rate limiting.
 *
 * @module lib/ai/token-tracking
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';

import { estimateCost } from './providers';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UsageLogEntry {
  workspaceId: string;
  userId: string;
  model: string;
  provider: string;
  endpoint: string;
  usage: TokenUsage;
  cost: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log AI request usage to database
 */
export async function logTokenUsage(entry: UsageLogEntry): Promise<void> {
  try {
    // Store in workspace settings for now (could be separate table in production)
    const workspace = await prisma.workspace.findUnique({
      where: { id: entry.workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      console.error(`[logTokenUsage] Workspace ${entry.workspaceId} not found`);
      return;
    }

    const settings = (workspace.settings || {}) as Record<string, unknown>;
    const usageLogs = ((settings.aiUsageLogs || []) as UsageLogEntry[]).slice(
      -1000
    ); // Keep last 1000 entries

    usageLogs.push({
      ...entry,
      metadata: {
        ...entry.metadata,
        timestamp: new Date().toISOString(),
      },
    });

    await prisma.workspace.update({
      where: { id: entry.workspaceId },
      data: {
        settings: {
          ...settings,
          aiUsageLogs: usageLogs,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[logTokenUsage] Logged ${entry.usage.totalTokens} tokens for workspace ${entry.workspaceId}`
    );
  } catch (error) {
    console.error('[logTokenUsage] Error:', error);
  }
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  model: string,
  usage: TokenUsage
): { cost: number; breakdown: { input: number; output: number } } {
  const totalCost = estimateCost(
    model,
    usage.promptTokens,
    usage.completionTokens
  );
  const inputCost = estimateCost(model, usage.promptTokens, 0);
  const outputCost = estimateCost(model, 0, usage.completionTokens);

  return {
    cost: totalCost,
    breakdown: {
      input: inputCost,
      output: outputCost,
    },
  };
}

/**
 * Check workspace token quota
 */
export async function checkWorkspaceQuota(
  workspaceId: string,
  requestedTokens: number
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate?: Date;
}> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const settings = (workspace.settings || {}) as Record<string, unknown>;
    const aiConfig = (settings.aiConfig || {}) as {
      rateLimits?: {
        tokensPerDay?: number;
      };
    };

    const dailyLimit = aiConfig.rateLimits?.tokensPerDay || 100000;
    const usageLogs = (settings.aiUsageLogs || []) as UsageLogEntry[];

    // Calculate usage in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsage = usageLogs
      .filter(log => {
        const logTime = new Date(
          (log.metadata as { timestamp?: string })?.timestamp || 0
        );
        return logTime > oneDayAgo;
      })
      .reduce((sum, log) => sum + log.usage.totalTokens, 0);

    const remaining = Math.max(0, dailyLimit - recentUsage);
    const allowed = recentUsage + requestedTokens <= dailyLimit;

    return {
      allowed,
      remaining,
      limit: dailyLimit,
      resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    console.error('[checkWorkspaceQuota] Error:', error);
    // Fail open
    return { allowed: true, remaining: 100000, limit: 100000 };
  }
}

/**
 * Get usage statistics for workspace
 */
export async function getWorkspaceUsageStats(
  workspaceId: string,
  days: number = 7
): Promise<{
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  byModel: Record<string, { tokens: number; cost: number; count: number }>;
  byEndpoint: Record<string, { tokens: number; cost: number; count: number }>;
}> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return {
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        byModel: {},
        byEndpoint: {},
      };
    }

    const settings = (workspace.settings || {}) as Record<string, unknown>;
    const usageLogs = (settings.aiUsageLogs || []) as UsageLogEntry[];

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentLogs = usageLogs.filter(log => {
      const logTime = new Date(
        (log.metadata as { timestamp?: string })?.timestamp || 0
      );
      return logTime > cutoffDate;
    });

    const stats = {
      totalTokens: 0,
      totalCost: 0,
      requestCount: recentLogs.length,
      byModel: {} as Record<
        string,
        { tokens: number; cost: number; count: number }
      >,
      byEndpoint: {} as Record<
        string,
        { tokens: number; cost: number; count: number }
      >,
    };

    for (const log of recentLogs) {
      stats.totalTokens += log.usage.totalTokens;
      stats.totalCost += log.cost;

      // By model
      if (!stats.byModel[log.model]) {
        stats.byModel[log.model] = { tokens: 0, cost: 0, count: 0 };
      }
      stats.byModel[log.model].tokens += log.usage.totalTokens;
      stats.byModel[log.model].cost += log.cost;
      stats.byModel[log.model].count += 1;

      // By endpoint
      if (!stats.byEndpoint[log.endpoint]) {
        stats.byEndpoint[log.endpoint] = { tokens: 0, cost: 0, count: 0 };
      }
      stats.byEndpoint[log.endpoint].tokens += log.usage.totalTokens;
      stats.byEndpoint[log.endpoint].cost += log.cost;
      stats.byEndpoint[log.endpoint].count += 1;
    }

    return stats;
  } catch (error) {
    console.error('[getWorkspaceUsageStats] Error:', error);
    return {
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      byModel: {},
      byEndpoint: {},
    };
  }
}

/**
 * Estimate tokens for text (rough approximation)
 * More accurate with actual tokenizer, but this works for estimates
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Check if request would exceed token limit
 */
export function wouldExceedTokenLimit(
  promptTokens: number,
  maxTokens: number,
  modelContextWindow: number
): boolean {
  return promptTokens + maxTokens > modelContextWindow;
}
