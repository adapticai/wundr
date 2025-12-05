/**
 * User Email Preferences API Routes
 *
 * Handles getting and updating email notification preferences for the current user.
 *
 * Routes:
 * - GET /api/users/me/email-preferences - Get email preferences
 * - PATCH /api/users/me/email-preferences - Update email preferences
 *
 * @module app/api/users/me/email-preferences/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Email preference structure
 */
interface EmailPreferences {
  marketingEmails: boolean;
  notificationEmails: boolean;
  digestEmails: 'none' | 'daily' | 'weekly';
  securityEmails: boolean;
}

/**
 * Default email preferences
 */
const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  marketingEmails: true,
  notificationEmails: true,
  digestEmails: 'daily',
  securityEmails: true,
};

/**
 * Error response codes
 */
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  details?: Record<string, unknown>,
) {
  return {
    error: {
      message,
      code,
      ...details,
    },
  };
}

/**
 * Extract email preferences from user preferences JSON field
 */
function extractEmailPreferences(
  preferences: Prisma.JsonValue,
): EmailPreferences {
  let emailPrefs: Partial<EmailPreferences> = {};

  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    const prefsObj = preferences as Record<string, unknown>;

    if (
      'emailPreferences' in prefsObj &&
      typeof prefsObj.emailPreferences === 'object'
    ) {
      emailPrefs = prefsObj.emailPreferences as Partial<EmailPreferences>;
    }
  }

  return {
    ...DEFAULT_EMAIL_PREFERENCES,
    ...emailPrefs,
  };
}

/**
 * Validate digest email value
 */
function isValidDigestEmail(
  value: unknown,
): value is 'none' | 'daily' | 'weekly' {
  return value === 'none' || value === 'daily' || value === 'weekly';
}

/**
 * GET /api/users/me/email-preferences
 *
 * Get email preferences for the current user.
 * Returns email notification preferences with defaults for any unset values.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns Email preferences
 *
 * @example
 * ```
 * GET /api/users/me/email-preferences
 *
 * Response:
 * {
 *   "data": {
 *     "marketingEmails": true,
 *     "notificationEmails": true,
 *     "digestEmails": "daily",
 *     "securityEmails": true
 *   }
 * }
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const emailPrefs = extractEmailPreferences(user.preferences);

    return NextResponse.json({ data: emailPrefs });
  } catch (error) {
    console.error('[GET /api/users/me/email-preferences] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/users/me/email-preferences
 *
 * Update email preferences for the current user.
 * Only provided fields will be updated; others remain unchanged.
 * Security emails cannot be disabled.
 * Requires authentication.
 *
 * @param request - Next.js request with email preference updates
 * @returns Updated email preferences
 *
 * @example
 * ```
 * PATCH /api/users/me/email-preferences
 * Content-Type: application/json
 *
 * {
 *   "marketingEmails": false,
 *   "digestEmails": "weekly"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "marketingEmails": false,
 *     "notificationEmails": true,
 *     "digestEmails": "weekly",
 *     "securityEmails": true
 *   },
 *   "message": "Email preferences updated successfully"
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Basic validation
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse(
          'Request body must be an object',
          ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const errors: Record<string, string> = {};

    // Validate marketingEmails if provided
    if (
      'marketingEmails' in input &&
      input.marketingEmails !== undefined &&
      typeof input.marketingEmails !== 'boolean'
    ) {
      errors.marketingEmails = 'Marketing emails must be a boolean';
    }

    // Validate notificationEmails if provided
    if (
      'notificationEmails' in input &&
      input.notificationEmails !== undefined &&
      typeof input.notificationEmails !== 'boolean'
    ) {
      errors.notificationEmails = 'Notification emails must be a boolean';
    }

    // Validate digestEmails if provided
    if (
      'digestEmails' in input &&
      input.digestEmails !== undefined &&
      !isValidDigestEmail(input.digestEmails)
    ) {
      errors.digestEmails = 'Digest emails must be one of: none, daily, weekly';
    }

    // Security emails cannot be disabled
    if ('securityEmails' in input && input.securityEmails === false) {
      errors.securityEmails = 'Security emails cannot be disabled';
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        createErrorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
          errors,
        }),
        { status: 400 },
      );
    }

    // Get current user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Extract current preferences
    const currentPrefs =
      typeof user.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    // Extract current email preferences
    const currentEmailPrefs = extractEmailPreferences(user.preferences);

    // Merge email preferences (only update provided fields)
    const updatedEmailPrefs: EmailPreferences = {
      ...currentEmailPrefs,
    };

    if (
      'marketingEmails' in input &&
      typeof input.marketingEmails === 'boolean'
    ) {
      updatedEmailPrefs.marketingEmails = input.marketingEmails;
    }

    if (
      'notificationEmails' in input &&
      typeof input.notificationEmails === 'boolean'
    ) {
      updatedEmailPrefs.notificationEmails = input.notificationEmails;
    }

    if ('digestEmails' in input && isValidDigestEmail(input.digestEmails)) {
      updatedEmailPrefs.digestEmails = input.digestEmails;
    }

    // Security emails are always true
    updatedEmailPrefs.securityEmails = true;

    // Update user preferences in database (merge with existing preferences)
    const updatedPrefs = {
      ...currentPrefs,
      emailPreferences: updatedEmailPrefs,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      data: updatedEmailPrefs,
      message: 'Email preferences updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/users/me/email-preferences] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
