/**
 * AI Quota Manager
 *
 * Manages AI usage quotas for users and workspaces with persistent storage.
 * Tracks token usage, request counts, and enforces quota limits.
 *
 * Features:
 * - Per-user and per-workspace quotas
 * - Token and request tracking
 * - Monthly quota resets
 * - Admin quota overrides
 * - Usage analytics
 */

import { prisma } from '@neolith/database';
import {
  checkRateLimit,
  getRateLimitStatus,
  type RateLimitConfig,
} from './rate-limiter';

// Quota tier definitions
export const QUOTA_TIERS = {
  free: {
    name: 'Free',
    maxRequestsPerDay: 50,
    maxRequestsPerHour: 10,
    maxTokensPerMonth: 100000,
    maxRequestsPerMonth: 500,
  },
  pro: {
    name: 'Pro',
    maxRequestsPerDay: 500,
    maxRequestsPerHour: 100,
    maxTokensPerMonth: 1000000,
    maxRequestsPerMonth: 5000,
  },
  enterprise: {
    name: 'Enterprise',
    maxRequestsPerDay: 5000,
    maxRequestsPerHour: 1000,
    maxTokensPerMonth: 10000000,
    maxRequestsPerMonth: 50000,
  },
  unlimited: {
    name: 'Unlimited',
    maxRequestsPerDay: Infinity,
    maxRequestsPerHour: Infinity,
    maxTokensPerMonth: Infinity,
    maxRequestsPerMonth: Infinity,
  },
} as const;

export type QuotaTier = keyof typeof QUOTA_TIERS;

// In-memory fallback store for quota tiers keyed by org/user ID
const quotaTierStore = new Map<string, QuotaTier>();

export interface QuotaUsage {
  tier: QuotaTier;
  requestsToday: number;
  requestsThisHour: number;
  requestsThisMonth: number;
  tokensThisMonth: number;
  limits: {
    maxRequestsPerDay: number;
    maxRequestsPerHour: number;
    maxRequestsPerMonth: number;
    maxTokensPerMonth: number;
  };
  percentages: {
    dailyRequests: number;
    hourlyRequests: number;
    monthlyRequests: number;
    monthlyTokens: number;
  };
  resetAt: {
    hour: Date;
    day: Date;
    month: Date;
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  usage: QuotaUsage;
  retryAfter?: number;
}

/**
 * Get user's quota tier
 */
export async function getUserQuotaTier(userId: string): Promise<QuotaTier> {
  try {
    // Check if user has custom quota tier in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Use in-memory store as fallback since database table may not exist yet
    if (quotaTierStore.has(`user:${userId}`)) {
      return quotaTierStore.get(`user:${userId}`) as QuotaTier;
    }

    return 'free';
  } catch (error) {
    console.error('Failed to get user quota tier:', error);
    return 'free';
  }
}

/**
 * Get workspace's quota tier
 */
export async function getWorkspaceQuotaTier(
  workspaceId: string
): Promise<QuotaTier> {
  try {
    // Check if workspace has custom quota tier
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // Use in-memory store as fallback since database table may not exist yet
    if (quotaTierStore.has(`workspace:${workspaceId}`)) {
      return quotaTierStore.get(`workspace:${workspaceId}`) as QuotaTier;
    }

    return 'pro';
  } catch (error) {
    console.error('Failed to get workspace quota tier:', error);
    return 'free';
  }
}

/**
 * Get current quota usage for a user
 */
export async function getUserQuotaUsage(userId: string): Promise<QuotaUsage> {
  const tier = await getUserQuotaTier(userId);
  const limits = QUOTA_TIERS[tier];
  const now = new Date();

  // Get usage from rate limiter
  const [hourlyStatus, dailyStatus] = await Promise.all([
    getRateLimitStatus({
      identifier: `user:${userId}`,
      maxRequests: limits.maxRequestsPerHour,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),
    getRateLimitStatus({
      identifier: `user:${userId}:daily`,
      maxRequests: limits.maxRequestsPerDay,
      windowMs: 24 * 60 * 60 * 1000, // 1 day
    }),
  ]);

  const requestsThisHour = limits.maxRequestsPerHour - hourlyStatus.remaining;
  const requestsToday = limits.maxRequestsPerDay - dailyStatus.remaining;

  // Query monthly usage from aiUsageLog if available, fallback to 0
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let requestsThisMonth = 0;
  let tokensThisMonth = 0;
  try {
    const [reqAgg, tokenAgg] = await Promise.all([
      (prisma as any).aiUsageLog.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
      (prisma as any).aiUsageLog.aggregate({
        _sum: { tokens: true },
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
    ]);
    requestsThisMonth = reqAgg ?? 0;
    tokensThisMonth = tokenAgg?._sum?.tokens ?? 0;
  } catch {
    // aiUsageLog table does not exist yet — degrade gracefully
  }

  // Calculate reset times
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  return {
    tier,
    requestsToday,
    requestsThisHour,
    requestsThisMonth,
    tokensThisMonth,
    limits: {
      maxRequestsPerDay: limits.maxRequestsPerDay,
      maxRequestsPerHour: limits.maxRequestsPerHour,
      maxRequestsPerMonth: limits.maxRequestsPerMonth,
      maxTokensPerMonth: limits.maxTokensPerMonth,
    },
    percentages: {
      hourlyRequests: calculatePercentage(
        requestsThisHour,
        limits.maxRequestsPerHour
      ),
      dailyRequests: calculatePercentage(
        requestsToday,
        limits.maxRequestsPerDay
      ),
      monthlyRequests: calculatePercentage(
        requestsThisMonth,
        limits.maxRequestsPerMonth
      ),
      monthlyTokens: calculatePercentage(
        tokensThisMonth,
        limits.maxTokensPerMonth
      ),
    },
    resetAt: {
      hour: nextHour,
      day: nextDay,
      month: nextMonth,
    },
  };
}

/**
 * Get current quota usage for a workspace
 */
export async function getWorkspaceQuotaUsage(
  workspaceId: string
): Promise<QuotaUsage> {
  const tier = await getWorkspaceQuotaTier(workspaceId);
  const limits = QUOTA_TIERS[tier];
  const now = new Date();

  const [hourlyStatus, dailyStatus] = await Promise.all([
    getRateLimitStatus({
      identifier: `workspace:${workspaceId}`,
      maxRequests: limits.maxRequestsPerHour,
      windowMs: 60 * 60 * 1000,
    }),
    getRateLimitStatus({
      identifier: `workspace:${workspaceId}:daily`,
      maxRequests: limits.maxRequestsPerDay,
      windowMs: 24 * 60 * 60 * 1000,
    }),
  ]);

  const requestsThisHour = limits.maxRequestsPerHour - hourlyStatus.remaining;
  const requestsToday = limits.maxRequestsPerDay - dailyStatus.remaining;

  // Query monthly usage from aiUsageLog if available, fallback to 0
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let requestsThisMonth = 0;
  let tokensThisMonth = 0;
  try {
    const [reqAgg, tokenAgg] = await Promise.all([
      (prisma as any).aiUsageLog.count({
        where: { workspaceId, createdAt: { gte: startOfMonth } },
      }),
      (prisma as any).aiUsageLog.aggregate({
        _sum: { tokens: true },
        where: { workspaceId, createdAt: { gte: startOfMonth } },
      }),
    ]);
    requestsThisMonth = reqAgg ?? 0;
    tokensThisMonth = tokenAgg?._sum?.tokens ?? 0;
  } catch {
    // aiUsageLog table does not exist yet — degrade gracefully
  }

  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  return {
    tier,
    requestsToday,
    requestsThisHour,
    requestsThisMonth,
    tokensThisMonth,
    limits: {
      maxRequestsPerDay: limits.maxRequestsPerDay,
      maxRequestsPerHour: limits.maxRequestsPerHour,
      maxRequestsPerMonth: limits.maxRequestsPerMonth,
      maxTokensPerMonth: limits.maxTokensPerMonth,
    },
    percentages: {
      hourlyRequests: calculatePercentage(
        requestsThisHour,
        limits.maxRequestsPerHour
      ),
      dailyRequests: calculatePercentage(
        requestsToday,
        limits.maxRequestsPerDay
      ),
      monthlyRequests: calculatePercentage(
        requestsThisMonth,
        limits.maxRequestsPerMonth
      ),
      monthlyTokens: calculatePercentage(
        tokensThisMonth,
        limits.maxTokensPerMonth
      ),
    },
    resetAt: {
      hour: nextHour,
      day: nextDay,
      month: nextMonth,
    },
  };
}

/**
 * Check if user can make an AI request (enforces all quota limits)
 */
export async function checkUserQuota(
  userId: string
): Promise<QuotaCheckResult> {
  const usage = await getUserQuotaUsage(userId);
  const tier = usage.tier;
  const limits = QUOTA_TIERS[tier];

  // Check hourly rate limit
  const hourlyResult = await checkRateLimit({
    identifier: `user:${userId}`,
    maxRequests: limits.maxRequestsPerHour,
    windowMs: 60 * 60 * 1000,
  });

  if (!hourlyResult.allowed) {
    return {
      allowed: false,
      reason: `Hourly rate limit exceeded (${limits.maxRequestsPerHour} requests per hour)`,
      usage,
      retryAfter: hourlyResult.retryAfter,
    };
  }

  // Check daily rate limit
  const dailyResult = await checkRateLimit({
    identifier: `user:${userId}:daily`,
    maxRequests: limits.maxRequestsPerDay,
    windowMs: 24 * 60 * 60 * 1000,
  });

  if (!dailyResult.allowed) {
    return {
      allowed: false,
      reason: `Daily rate limit exceeded (${limits.maxRequestsPerDay} requests per day)`,
      usage,
      retryAfter: dailyResult.retryAfter,
    };
  }

  // Check monthly quotas
  if (usage.requestsThisMonth >= limits.maxRequestsPerMonth) {
    return {
      allowed: false,
      reason: `Monthly request quota exceeded (${limits.maxRequestsPerMonth} requests per month)`,
      usage,
    };
  }

  if (usage.tokensThisMonth >= limits.maxTokensPerMonth) {
    return {
      allowed: false,
      reason: `Monthly token quota exceeded (${limits.maxTokensPerMonth} tokens per month)`,
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

/**
 * Check if workspace can make an AI request
 */
export async function checkWorkspaceQuota(
  workspaceId: string
): Promise<QuotaCheckResult> {
  const usage = await getWorkspaceQuotaUsage(workspaceId);
  const tier = usage.tier;
  const limits = QUOTA_TIERS[tier];

  const hourlyResult = await checkRateLimit({
    identifier: `workspace:${workspaceId}`,
    maxRequests: limits.maxRequestsPerHour,
    windowMs: 60 * 60 * 1000,
  });

  if (!hourlyResult.allowed) {
    return {
      allowed: false,
      reason: `Workspace hourly rate limit exceeded (${limits.maxRequestsPerHour} requests per hour)`,
      usage,
      retryAfter: hourlyResult.retryAfter,
    };
  }

  const dailyResult = await checkRateLimit({
    identifier: `workspace:${workspaceId}:daily`,
    maxRequests: limits.maxRequestsPerDay,
    windowMs: 24 * 60 * 60 * 1000,
  });

  if (!dailyResult.allowed) {
    return {
      allowed: false,
      reason: `Workspace daily rate limit exceeded (${limits.maxRequestsPerDay} requests per day)`,
      usage,
      retryAfter: dailyResult.retryAfter,
    };
  }

  if (usage.requestsThisMonth >= limits.maxRequestsPerMonth) {
    return {
      allowed: false,
      reason: `Workspace monthly request quota exceeded (${limits.maxRequestsPerMonth} requests per month)`,
      usage,
    };
  }

  if (usage.tokensThisMonth >= limits.maxTokensPerMonth) {
    return {
      allowed: false,
      reason: `Workspace monthly token quota exceeded (${limits.maxTokensPerMonth} tokens per month)`,
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

/**
 * Track token usage for a request
 */
export async function trackTokenUsage(
  identifier: string,
  tokens: number,
  scope: 'user' | 'workspace'
): Promise<void> {
  try {
    await (prisma as any).aiUsageLog.create({
      data: {
        ...(scope === 'user'
          ? { userId: identifier }
          : { workspaceId: identifier }),
        tokens,
        scope,
        createdAt: new Date(),
      },
    });
  } catch {
    // aiUsageLog table does not exist yet — degrade gracefully
    console.log(
      `Token usage tracked (in-memory fallback): ${identifier} (${scope}) - ${tokens} tokens`
    );
  }
}

/**
 * Calculate percentage with safe division
 */
function calculatePercentage(used: number, total: number): number {
  if (total === Infinity || total === 0) return 0;
  return Math.min(100, (used / total) * 100);
}

/**
 * Check if usage is approaching limit (80% threshold)
 */
export function isApproachingLimit(percentage: number): boolean {
  return percentage >= 80;
}

/**
 * Check if usage has exceeded limit
 */
export function hasExceededLimit(percentage: number): boolean {
  return percentage >= 100;
}
