/**
 * AI Rate Limit Middleware
 *
 * Middleware for protecting AI API routes with rate limiting and quota enforcement.
 * Use this to wrap your AI endpoints and automatically enforce limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkUserQuota,
  checkWorkspaceQuota,
  trackTokenUsage,
} from './quota-manager';
import { checkBypassToken } from './rate-limiter';

export interface RateLimitOptions {
  /** Scope of the rate limit */
  scope?: 'user' | 'workspace';
  /** Function to extract workspace ID from request */
  getWorkspaceId?: (req: NextRequest) => Promise<string | null>;
  /** Skip authentication check (use with caution) */
  skipAuth?: boolean;
}

export interface RateLimitedContext {
  userId: string;
  workspaceId?: string;
  bypassed: boolean;
}

/**
 * Higher-order function to apply rate limiting to API routes
 */
export function withRateLimit<T = any>(
  handler: (
    req: NextRequest,
    context: RateLimitedContext
  ) => Promise<NextResponse<T>>,
  options: RateLimitOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Check authentication
      if (!options.skipAuth) {
        const session = await auth();
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Check for bypass token
        const bypassToken = req.headers.get('x-bypass-token');
        const bypassed = checkBypassToken(bypassToken);

        if (!bypassed) {
          // Determine scope and check quota
          const scope = options.scope || 'user';

          if (scope === 'workspace' && options.getWorkspaceId) {
            const workspaceId = await options.getWorkspaceId(req);

            if (!workspaceId) {
              return NextResponse.json(
                { error: 'Workspace ID required' },
                { status: 400 }
              );
            }

            // Check workspace quota
            const quotaResult = await checkWorkspaceQuota(workspaceId);

            if (!quotaResult.allowed) {
              const headers = new Headers();
              if (quotaResult.retryAfter) {
                headers.set('Retry-After', quotaResult.retryAfter.toString());
              }
              headers.set(
                'X-RateLimit-Limit',
                quotaResult.usage.limits.maxRequestsPerHour.toString()
              );
              headers.set('X-RateLimit-Remaining', '0');
              headers.set(
                'X-RateLimit-Reset',
                new Date(quotaResult.usage.resetAt.hour).toISOString()
              );

              return NextResponse.json(
                {
                  error: 'Rate limit exceeded',
                  message: quotaResult.reason,
                  retryAfter: quotaResult.retryAfter,
                  usage: quotaResult.usage,
                },
                { status: 429, headers }
              );
            }

            return handler(req, { userId, workspaceId, bypassed: false });
          } else {
            // Check user quota
            const quotaResult = await checkUserQuota(userId);

            if (!quotaResult.allowed) {
              const headers = new Headers();
              if (quotaResult.retryAfter) {
                headers.set('Retry-After', quotaResult.retryAfter.toString());
              }
              headers.set(
                'X-RateLimit-Limit',
                quotaResult.usage.limits.maxRequestsPerHour.toString()
              );
              headers.set('X-RateLimit-Remaining', '0');
              headers.set(
                'X-RateLimit-Reset',
                new Date(quotaResult.usage.resetAt.hour).toISOString()
              );

              return NextResponse.json(
                {
                  error: 'Rate limit exceeded',
                  message: quotaResult.reason,
                  retryAfter: quotaResult.retryAfter,
                  usage: quotaResult.usage,
                },
                { status: 429, headers }
              );
            }

            return handler(req, { userId, bypassed: false });
          }
        } else {
          // Bypass active - skip quota checks
          return handler(req, { userId, bypassed: true });
        }
      } else {
        // Skip auth - provide minimal context
        return handler(req, { userId: 'anonymous', bypassed: false });
      }
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Response wrapper that adds rate limit headers
 */
export async function withRateLimitHeaders(
  response: NextResponse,
  identifier: string,
  scope: 'user' | 'workspace' = 'user'
): Promise<NextResponse> {
  try {
    const { getRateLimitStatus } = await import('./rate-limiter');
    const { getUserQuotaTier, getWorkspaceQuotaTier, QUOTA_TIERS } =
      await import('./quota-manager');

    const tier =
      scope === 'user'
        ? await getUserQuotaTier(identifier)
        : await getWorkspaceQuotaTier(identifier);

    const limits = QUOTA_TIERS[tier];

    const status = await getRateLimitStatus({
      identifier: `${scope}:${identifier}`,
      maxRequests: limits.maxRequestsPerHour,
      windowMs: 60 * 60 * 1000,
    });

    response.headers.set('X-RateLimit-Limit', status.limit.toString());
    response.headers.set('X-RateLimit-Remaining', status.remaining.toString());
    response.headers.set('X-RateLimit-Reset', status.reset.toString());

    return response;
  } catch (error) {
    console.error('Failed to add rate limit headers:', error);
    return response;
  }
}

/**
 * Track token usage after AI request completion
 */
export async function trackAIUsage(
  identifier: string,
  tokens: number,
  scope: 'user' | 'workspace' = 'user'
): Promise<void> {
  try {
    await trackTokenUsage(identifier, tokens, scope);
  } catch (error) {
    console.error('Failed to track AI usage:', error);
  }
}
