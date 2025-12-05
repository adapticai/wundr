/**
 * Auto Backup Configuration API Route
 * GET/POST /api/settings/backups/auto-config
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import type { AutoBackupConfig } from '@/lib/settings-backup';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, fetch from database
    const config: AutoBackupConfig = {
      enabled: false,
      frequency: 'weekly',
      maxBackups: 10,
      includeConversations: false,
      categories: ['all'],
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json(
      { error: 'Failed to get auto backup config' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = (await request.json()) as AutoBackupConfig;

    // In production:
    // 1. Validate config
    // 2. Save to database
    // 3. Schedule backup jobs if enabled

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save config error:', error);
    return NextResponse.json(
      { error: 'Failed to save auto backup config' },
      { status: 500 },
    );
  }
}
