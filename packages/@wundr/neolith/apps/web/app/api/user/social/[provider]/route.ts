/**
 * Social Provider API Route
 *
 * Handles disconnecting OAuth providers.
 *
 * Routes:
 * - DELETE /api/user/social/:provider - Disconnect OAuth provider
 *
 * @module app/api/user/social/[provider]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { verifyPassword, logSecurityEvent } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ provider: string }>;
}

/**
 * DELETE /api/user/social/:provider
 *
 * Disconnect an OAuth provider.
 *
 * @param request - Next.js request
 * @param context - Route context with provider
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { provider } = params;

    // Get user and accounts
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: {
          select: { provider: true, type: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 },
      );
    }

    // Check if provider is connected
    const account = user.accounts.find(acc => acc.provider === provider);
    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider not connected',
          code: SECURITY_ERROR_CODES.PROVIDER_NOT_CONNECTED,
        },
        { status: 400 },
      );
    }

    // Check if user has password set (credentials account exists)
    const hasPassword = user.accounts.some(
      acc => acc.provider === 'credentials' && acc.type === 'credentials',
    );

    // Don't allow disconnecting if it's the only auth method and no password
    if (user.accounts.length === 1 && !hasPassword) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cannot disconnect last authentication method. Please set a password first.',
          code: SECURITY_ERROR_CODES.LAST_AUTH_METHOD,
        },
        { status: 400 },
      );
    }

    // Delete the account connection
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider,
      },
    });

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'oauth_disconnected',
      severity: 'info',
      description: `${provider} account disconnected`,
      metadata: { provider },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `${provider} account disconnected successfully`,
    });
  } catch (error) {
    console.error('[DELETE /api/user/social/:provider] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 },
    );
  }
}
