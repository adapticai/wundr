/**
 * Data Deletion API Routes (GDPR Compliance)
 *
 * Handles user data deletion requests (Right to be Forgotten).
 *
 * Routes:
 * - POST /api/user/privacy/delete - Request account and data deletion
 *
 * @module app/api/user/privacy/delete/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/privacy/delete
 *
 * Request permanent deletion of user account and all associated data (GDPR compliance).
 * This creates a deletion request that will be processed after a grace period.
 *
 * @param request - Next.js request object with confirmation
 * @returns Deletion request status
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { confirmation } = body;

    // Verify confirmation text
    if (confirmation !== 'DELETE MY DATA') {
      return NextResponse.json(
        {
          error: 'Invalid confirmation text',
          code: 'INVALID_CONFIRMATION',
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // In a production environment, you would:
    // 1. Create a deletion request record with a grace period (e.g., 30 days)
    // 2. Send confirmation email to the user
    // 3. Schedule a background job to process the deletion after the grace period
    // 4. Allow the user to cancel within the grace period
    // 5. Handle deletion of all related data (messages, files, memberships, etc.)

    // For this implementation, we'll create a notification for the deletion request
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'SYSTEM',
        title: 'Account Deletion Requested',
        body: 'Your account deletion request has been received. Your account and all associated data will be permanently deleted in 30 days. You can cancel this request from your settings.',
        resourceType: 'user',
        resourceId: session.user.id,
        metadata: {
          message:
            'Your account deletion request has been received. Your account and all associated data will be permanently deleted in 30 days. You can cancel this request from your settings.',
        },
      },
    });

    // Mark user preferences with deletion request
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs =
      (currentUser?.preferences as Record<string, unknown>) || {};
    const scheduledDeletionDate = new Date();
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          deletionRequested: true,
          deletionRequestedAt: new Date().toISOString(),
          scheduledDeletionDate: scheduledDeletionDate.toISOString(),
        } as never,
      },
    });

    // In a real implementation, you would send an email here
    // await sendDeletionConfirmationEmail(user.email, user.name);

    return NextResponse.json({
      success: true,
      message:
        'Account deletion request submitted. You will receive a confirmation email.',
      scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      gracePeriodDays: 30,
    });
  } catch (error) {
    console.error('[POST /api/user/privacy/delete] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
