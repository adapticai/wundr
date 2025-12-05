/**
 * Backup Restore API Route
 * POST /api/settings/backups/[backupId]/restore
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupId } = await params;
    const body = await request.json();
    const { categories = [] } = body;

    // In production:
    // 1. Fetch backup from database
    // 2. Validate backup ownership
    // 3. Restore specified categories
    // 4. Update user settings

    const restored = categories.length > 0 ? categories : ['all'];

    return NextResponse.json({
      success: true,
      restored,
    });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup' },
      { status: 500 },
    );
  }
}
