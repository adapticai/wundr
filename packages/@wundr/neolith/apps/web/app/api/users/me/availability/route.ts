import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import { auth } from '@/lib/auth';

/**
 * GET /api/users/me/availability
 * Get user availability settings
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
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const prefs = (user.preferences || {}) as Record<string, any>;

    const availabilitySettings = {
      workingHours: prefs.workingHours || null,
      outOfOffice: prefs.outOfOffice || null,
      scheduledStatuses: prefs.scheduledStatuses || [],
    };

    return NextResponse.json({ data: availabilitySettings });
  } catch (error) {
    console.error('Error fetching availability settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability settings' },
      { status: 500 },
    );
  }
}
