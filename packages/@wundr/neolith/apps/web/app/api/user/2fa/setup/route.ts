/**
 * Two-Factor Authentication Setup API Route
 *
 * Handles 2FA setup including secret generation and QR code data.
 *
 * Routes:
 * - POST /api/user/2fa/setup - Generate 2FA secret and QR code
 *
 * @module app/api/user/2fa/setup/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { generateTOTPSecret } from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/2fa/setup
 *
 * Generate a new 2FA secret for the user.
 *
 * @param request - Next.js request
 * @returns Secret and QR code data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, preferences: true },
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

    // Generate new secret
    const secret = generateTOTPSecret();

    // Store secret temporarily in preferences (will be confirmed on verification)
    const prefs = (user.preferences as Record<string, unknown>) || {};
    const twoFactor = prefs.twoFactor as { enabled?: boolean; secret?: string; backupCodes?: string[] } | undefined;

    const updatedPrefs = {
      ...prefs,
      twoFactor: {
        ...twoFactor,
        secret,
        // Don't enable 2FA yet - wait for verification
        enabled: twoFactor?.enabled || false,
      },
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as Prisma.InputJsonValue,
      },
    });

    // Generate QR code URL
    const appName = 'Wundr';
    const email = user.email || session.user.email;
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(email || 'user')}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

    return NextResponse.json({
      success: true,
      data: {
        secret,
        qrCodeUrl,
        otpAuthUrl,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/setup] Error:', error);
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
