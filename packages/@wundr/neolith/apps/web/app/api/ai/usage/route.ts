/**
 * AI Usage API Route
 *
 * GET /api/ai/usage - Get current AI usage and quota information
 *
 * Query parameters:
 * - scope: 'user' | 'workspace' (default: 'user')
 * - workspaceId: string (required if scope is 'workspace')
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getUserQuotaUsage,
  getWorkspaceQuotaUsage,
  checkUserQuota,
  checkWorkspaceQuota,
} from '@/lib/ai/quota-manager';
import { checkBypassToken } from '@/lib/ai/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'user') as 'user' | 'workspace';
    const workspaceId = searchParams.get('workspaceId');

    // Check bypass token for admin
    const bypassToken = request.headers.get('x-bypass-token');
    const isBypassed = checkBypassToken(bypassToken);

    if (scope === 'workspace') {
      if (!workspaceId) {
        return NextResponse.json(
          { error: 'workspaceId is required when scope is workspace' },
          { status: 400 }
        );
      }

      // Get workspace usage and quota check
      const [usage, quotaCheck] = await Promise.all([
        getWorkspaceQuotaUsage(workspaceId),
        checkWorkspaceQuota(workspaceId),
      ]);

      return NextResponse.json({
        scope: 'workspace',
        workspaceId,
        usage,
        quotaCheck: {
          allowed: isBypassed || quotaCheck.allowed,
          reason: isBypassed ? 'Bypass token active' : quotaCheck.reason,
          retryAfter: isBypassed ? undefined : quotaCheck.retryAfter,
        },
        bypassed: isBypassed,
      });
    } else {
      // Get user usage and quota check
      const [usage, quotaCheck] = await Promise.all([
        getUserQuotaUsage(session.user.id),
        checkUserQuota(session.user.id),
      ]);

      return NextResponse.json({
        scope: 'user',
        userId: session.user.id,
        usage,
        quotaCheck: {
          allowed: isBypassed || quotaCheck.allowed,
          reason: isBypassed ? 'Bypass token active' : quotaCheck.reason,
          retryAfter: isBypassed ? undefined : quotaCheck.retryAfter,
        },
        bypassed: isBypassed,
      });
    }
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI usage' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/usage/reset - Reset quota for testing (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check bypass token (admin verification)
    const bypassToken = request.headers.get('x-bypass-token');
    if (!checkBypassToken(bypassToken)) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid bypass token' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { scope, identifier } = body;

    if (!scope || !identifier) {
      return NextResponse.json(
        { error: 'scope and identifier are required' },
        { status: 400 }
      );
    }

    // Import reset function
    const { resetRateLimit } = await import('@/lib/ai/rate-limiter');

    // Reset all time windows for the identifier
    await Promise.all([
      resetRateLimit(`${scope}:${identifier}`),
      resetRateLimit(`${scope}:${identifier}:daily`),
    ]);

    return NextResponse.json({
      success: true,
      message: `Quota reset for ${scope}:${identifier}`,
    });
  } catch (error) {
    console.error('Error resetting quota:', error);
    return NextResponse.json(
      { error: 'Failed to reset quota' },
      { status: 500 }
    );
  }
}
