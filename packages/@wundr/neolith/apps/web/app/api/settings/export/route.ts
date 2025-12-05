/**
 * Settings Export API Route
 * POST /api/settings/export
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { SettingsBackup } from '@/lib/settings-backup';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { categories = ['all'], includeConversations = false } = body;

    // Create backup data structure
    const backup: SettingsBackup = {
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        userId: session.user.id,
        categories,
        platform: 'neolith',
      },
      data: {},
    };

    // Export selected categories
    const allCategories = categories.includes('all') || categories.length === 0;

    if (allCategories || categories.includes('profile')) {
      backup.data.profile = {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      };
    }

    if (allCategories || categories.includes('preferences')) {
      // Fetch user preferences from database
      backup.data.preferences = {
        // Add actual preferences data
        workspacePreferences: {},
      };
    }

    if (allCategories || categories.includes('appearance')) {
      // Fetch appearance settings
      backup.data.appearance = {
        theme: 'system',
        accentColor: '#3b82f6',
        // Add more appearance settings
      };
    }

    if (allCategories || categories.includes('notifications')) {
      backup.data.notifications = {
        // Add notification settings
      };
    }

    if (allCategories || categories.includes('privacy')) {
      backup.data.privacy = {
        // Add privacy settings
      };
    }

    if (allCategories || categories.includes('security')) {
      backup.data.security = {
        // Add security settings (excluding sensitive data)
        twoFactorEnabled: false,
      };
    }

    if (allCategories || categories.includes('accessibility')) {
      backup.data.accessibility = {
        // Add accessibility settings
      };
    }

    if (allCategories || categories.includes('audioVideo')) {
      backup.data.audioVideo = {
        // Add audio/video settings
      };
    }

    if (allCategories || categories.includes('language')) {
      backup.data.language = {
        locale: 'en-US',
        timezone: 'America/New_York',
      };
    }

    if (allCategories || categories.includes('keyboardShortcuts')) {
      backup.data.keyboardShortcuts = {
        // Add keyboard shortcuts
      };
    }

    if (
      includeConversations &&
      (allCategories || categories.includes('conversations'))
    ) {
      backup.data.conversations = [];
      // Fetch and add conversation history
      // This should be limited and paginated in production
    }

    return NextResponse.json(backup);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export settings' },
      { status: 500 }
    );
  }
}
