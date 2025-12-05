/**
 * User Profile Settings API Route
 *
 * Handles profile-specific updates including name, bio, avatar, location, etc.
 *
 * Routes:
 * - PUT /api/user/settings/profile - Update user profile
 *
 * @module app/api/user/settings/profile/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  enhancedProfileSchema,
  type EnhancedProfileInput,
} from '@/lib/validations/profile';
import {
  createUserErrorResponse,
  USER_ERROR_CODES,
} from '@/lib/validations/user';

import type { NextRequest } from 'next/server';

/**
 * PUT /api/user/settings/profile
 *
 * Update user profile information.
 *
 * @param request - Request with profile updates
 * @returns Updated profile data
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createUserErrorResponse(
          'Authentication required',
          USER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createUserErrorResponse(
          'Invalid JSON body',
          USER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = enhancedProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createUserErrorResponse(
          'Validation failed',
          USER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const updates: EnhancedProfileInput = parseResult.data;

    // Get current user preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        createUserErrorResponse('User not found', USER_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    const currentPrefs =
      (currentUser.preferences as Record<string, unknown>) || {};

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Update basic user fields
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    // Store username in preferences (user model doesn't have username field)
    const updatedPrefs = { ...currentPrefs };
    if (updates.username !== undefined) {
      // Check if username is being changed and if it's available
      const existingUser = await prisma.user.findFirst({
        where: {
          preferences: {
            path: ['username'],
            equals: updates.username,
          },
          NOT: { id: session.user.id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          createUserErrorResponse(
            'Username is already taken',
            USER_ERROR_CODES.VALIDATION_ERROR,
            { field: 'username' }
          ),
          { status: 409 }
        );
      }

      updatedPrefs.username = updates.username;
    }

    if (updates.bio !== undefined) {
      updatedPrefs.bio = updates.bio;
    }
    if (updates.location !== undefined) {
      updatedPrefs.location = updates.location;
    }
    if (updates.timezone !== undefined) {
      updatedPrefs.timezone = updates.timezone;
    }
    if (updates.title !== undefined) {
      updatedPrefs.title = updates.title;
    }
    if (updates.pronouns !== undefined) {
      updatedPrefs.pronouns = updates.pronouns;
    }
    if (updates.customPronouns !== undefined) {
      updatedPrefs.customPronouns = updates.customPronouns;
    }
    if (updates.statusMessage !== undefined) {
      updatedPrefs.statusMessage = updates.statusMessage;
    }

    // Update social links
    if (updates.socialLinks) {
      updatedPrefs.socialLinks = updates.socialLinks;
    }

    // Update visibility settings
    if (updates.visibility) {
      Object.entries(updates.visibility).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[key] = value;
        }
      });
    }

    updateData.preferences = updatedPrefs;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    // Extract profile data from updated user
    const prefs = (updatedUser.preferences as Record<string, unknown>) || {};
    const profileData = {
      id: updatedUser.id,
      name: updatedUser.name,
      username: prefs.username as string | undefined,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      bio: prefs.bio as string,
      location: prefs.location as string,
      timezone: prefs.timezone as string,
      title: prefs.title as string,
      pronouns: prefs.pronouns as string,
      customPronouns: prefs.customPronouns as string,
      statusMessage: prefs.statusMessage as string,
      socialLinks: prefs.socialLinks as Record<string, string>,
      visibility: {
        profileVisibility: prefs.profileVisibility as string,
        showEmail: prefs.showEmail as boolean,
        showLocation: prefs.showLocation as boolean,
        showSocialLinks: prefs.showSocialLinks as boolean,
        showBio: prefs.showBio as boolean,
      },
    };

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings/profile] Error:', error);
    return NextResponse.json(
      createUserErrorResponse(
        'An internal error occurred',
        USER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
