/**
 * Backup Download API Route
 * GET /api/settings/backups/[backupId]/download
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest} from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { backupId } = await params;

    // In production, fetch backup from database
    const backup = {
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        userId: session.user.id,
        categories: ['all'],
        platform: 'neolith' as const,
      },
      data: {
        profile: {
          name: session.user.name,
          email: session.user.email,
        },
        preferences: {},
        appearance: {},
      },
    };

    return NextResponse.json(backup);
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download backup' },
      { status: 500 },
    );
  }
}
