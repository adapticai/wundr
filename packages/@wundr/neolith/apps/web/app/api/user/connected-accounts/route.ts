/**
 * Connected Accounts API Route
 *
 * Handles fetching OAuth provider connections.
 *
 * Routes:
 * - GET /api/user/connected-accounts - Get connected OAuth providers
 *
 * @module app/api/user/connected-accounts/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface ConnectedAccount {
  provider: string;
  email?: string;
  username?: string;
  connected: boolean;
  connectedAt?: string;
}

/**
 * GET /api/user/connected-accounts
 *
 * Get all connected OAuth providers for the current user.
 *
 * @param request - Next.js request
 * @returns List of connected accounts
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
        { status: 401 }
      );
    }

    // Fetch connected accounts
    const accounts = await prisma.account.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
    });

    // Transform to ConnectedAccount format
    const connectedAccounts: ConnectedAccount[] = accounts.map(account => ({
      provider: account.provider,
      connected: true,
      connectedAt: account.createdAt?.toISOString(),
      // Note: email/username would need to be fetched from provider or stored separately
    }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: connectedAccounts,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/connected-accounts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
}
