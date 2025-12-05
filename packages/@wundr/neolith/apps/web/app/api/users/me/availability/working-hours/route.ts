import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import { auth } from '@/lib/auth';
import { workingHoursSchema } from '@/lib/validations/status';

/**
 * PUT /api/users/me/availability/working-hours
 * Update working hours settings
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = workingHoursSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    // Get user's current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    const prefs = (user?.preferences || {}) as Record<string, any>;

    // Update working hours
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          workingHours: validation.data,
        },
      },
    });

    return NextResponse.json({ data: validation.data });
  } catch (error) {
    console.error('Error updating working hours:', error);
    return NextResponse.json(
      { error: 'Failed to update working hours' },
      { status: 500 },
    );
  }
}
