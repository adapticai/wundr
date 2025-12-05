import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { statusUpdateSchema } from '@/lib/validations/status';

/**
 * GET /api/users/me/status
 * Get current user status
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const prefs = (user.preferences || {}) as Record<string, any>;
    const currentStatus = prefs.currentStatus || null;

    // Check if status has expired
    if (
      currentStatus?.expiresAt &&
      new Date(currentStatus.expiresAt) < new Date()
    ) {
      // Clear expired status
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          preferences: {
            ...(user.preferences as object),
            currentStatus: null,
          },
        },
      });

      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: currentStatus });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/me/status
 * Update user status
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = statusUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { emoji, message, type, expiresAt } = validation.data;

    // Get user's current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    const prefs = (user?.preferences || {}) as Record<string, any>;
    const statusHistory = prefs.statusHistory || [];

    // Create new status object
    const newStatus = {
      emoji,
      message: message || '',
      type,
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
    };

    // Add to history (keep last 20)
    const updatedHistory = [
      newStatus,
      ...statusHistory.filter(
        (s: any) => s.emoji !== emoji || s.message !== message
      ),
    ].slice(0, 20);

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          currentStatus: newStatus,
          statusHistory: updatedHistory,
        },
      },
    });

    return NextResponse.json({ data: newStatus });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/me/status
 * Clear user status
 */
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    const prefs = (user?.preferences || {}) as Record<string, any>;

    // Clear current status
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          currentStatus: null,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing user status:', error);
    return NextResponse.json(
      { error: 'Failed to clear status' },
      { status: 500 }
    );
  }
}
