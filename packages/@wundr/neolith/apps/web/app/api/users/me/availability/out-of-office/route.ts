import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import { auth } from '@/lib/auth';
import { outOfOfficeSchema } from '@/lib/validations/status';

/**
 * PUT /api/users/me/availability/out-of-office
 * Update out of office settings
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = outOfOfficeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    // Validate dates
    const { startDate, endDate } = validation.data;
    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
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

    // Update out of office settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          outOfOffice: validation.data,
        },
      },
    });

    return NextResponse.json({ data: validation.data });
  } catch (error) {
    console.error('Error updating out of office settings:', error);
    return NextResponse.json(
      { error: 'Failed to update out of office settings' },
      { status: 500 },
    );
  }
}
