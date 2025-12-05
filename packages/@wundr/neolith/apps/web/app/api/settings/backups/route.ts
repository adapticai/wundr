/**
 * Backup History API Route
 * GET /api/settings/backups
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest} from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, fetch from database
    // For now, return mock data
    const backups = [
      {
        id: 'backup-1',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        categories: ['all'],
        size: 125 * 1024, // 125 KB
        automatic: false,
      },
      {
        id: 'backup-2',
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(), // 1 week ago
        categories: ['profile', 'preferences', 'appearance'],
        size: 15 * 1024, // 15 KB
        automatic: true,
      },
      {
        id: 'backup-3',
        timestamp: new Date(Date.now() - 30 * 86400000).toISOString(), // 1 month ago
        categories: ['all'],
        size: 520 * 1024, // 520 KB (with conversations)
        automatic: true,
      },
    ];

    return NextResponse.json(backups);
  } catch (error) {
    console.error('Backup history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backup history' },
      { status: 500 },
    );
  }
}
