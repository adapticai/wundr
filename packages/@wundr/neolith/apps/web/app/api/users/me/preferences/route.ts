/**
 * User Preferences API Routes
 *
 * Handles getting and updating general user preferences including theme, language, etc.
 *
 * Routes:
 * - GET /api/users/me/preferences - Get user preferences
 * - PATCH /api/users/me/preferences - Update user preferences
 *
 * @module app/api/users/me/preferences/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * User preference structure
 */
interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  notifications?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Default user preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
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
 * Extract user preferences from Prisma JSON field
 */
function extractUserPreferences(preferences: Prisma.JsonValue): UserPreferences {
  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    return {
      ...DEFAULT_PREFERENCES,
      ...(preferences as UserPreferences),
    };
  }

  return DEFAULT_PREFERENCES;
}

/**
 * Validate theme value
 */
function isValidTheme(theme: unknown): theme is 'light' | 'dark' | 'system' {
  return theme === 'light' || theme === 'dark' || theme === 'system';
}

/**
 * Validate time format value
 */
function isValidTimeFormat(format: unknown): format is '12h' | '24h' {
  return format === '12h' || format === '24h';
}

/**
 * GET /api/users/me/preferences
 *
 * Get preferences for the current user.
 * Returns merged preferences with defaults for any unset values.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns User preferences
 *
 * @example
 * ```
 * GET /api/users/me/preferences
 *
 * Response:
 * {
 *   "data": {
 *     "theme": "dark",
 *     "language": "en",
 *     "timezone": "America/New_York",
 *     "dateFormat": "MM/DD/YYYY",
 *     "timeFormat": "12h"
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
        createErrorResponse('Authentication required', ERROR_CODES.UNAUTHORIZED),
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

    const userPrefs = extractUserPreferences(user.preferences);

    return NextResponse.json({ data: userPrefs });
  } catch (error) {
    console.error('[GET /api/users/me/preferences] Error:', error);
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
 * PATCH /api/users/me/preferences
 *
 * Update preferences for the current user.
 * Only provided fields will be updated; others remain unchanged.
 * Requires authentication.
 *
 * @param request - Next.js request with preference updates
 * @returns Updated user preferences
 *
 * @example
 * ```
 * PATCH /api/users/me/preferences
 * Content-Type: application/json
 *
 * {
 *   "theme": "dark",
 *   "timezone": "America/New_York"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "theme": "dark",
 *     "language": "en",
 *     "timezone": "America/New_York",
 *     "dateFormat": "MM/DD/YYYY",
 *     "timeFormat": "12h"
 *   },
 *   "message": "Preferences updated successfully"
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ERROR_CODES.UNAUTHORIZED),
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

    // Validate theme if provided
    if ('theme' in input && input.theme !== undefined && !isValidTheme(input.theme)) {
      errors.theme = 'Theme must be one of: light, dark, system';
    }

    // Validate timeFormat if provided
    if (
      'timeFormat' in input &&
      input.timeFormat !== undefined &&
      !isValidTimeFormat(input.timeFormat)
    ) {
      errors.timeFormat = 'Time format must be one of: 12h, 24h';
    }

    // Validate language if provided (basic check)
    if (
      'language' in input &&
      input.language !== undefined &&
      typeof input.language !== 'string'
    ) {
      errors.language = 'Language must be a string';
    }

    // Validate timezone if provided (basic check)
    if (
      'timezone' in input &&
      input.timezone !== undefined &&
      typeof input.timezone !== 'string'
    ) {
      errors.timezone = 'Timezone must be a string';
    }

    // Validate dateFormat if provided (basic check)
    if (
      'dateFormat' in input &&
      input.dateFormat !== undefined &&
      typeof input.dateFormat !== 'string'
    ) {
      errors.dateFormat = 'Date format must be a string';
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
    const currentPrefs = extractUserPreferences(user.preferences);

    // Merge preferences (shallow merge for top-level properties)
    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
      ...input,
    };

    // Update user preferences in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      data: updatedPrefs,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/users/me/preferences] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
