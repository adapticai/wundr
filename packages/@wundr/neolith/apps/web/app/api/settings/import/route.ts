/**
 * Settings Import API Route
 * POST /api/settings/import
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { validateBackup, type SettingsBackup } from '@/lib/settings-backup';

import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { backup, options = {} } = body as {
      backup: SettingsBackup;
      options: {
        overwrite?: boolean;
        merge?: boolean;
        categories?: string[];
      };
    };

    // Validate backup structure
    const validation = validateBackup(backup);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid backup format', details: validation.errors },
        { status: 400 }
      );
    }

    const imported: string[] = [];
    const skipped: string[] = [];
    const { overwrite = false, categories = [] } = options;

    // Import each category
    const categoriesToImport =
      categories.length > 0 ? categories : Object.keys(backup.data);

    for (const category of categoriesToImport) {
      const categoryData = backup.data[category as keyof typeof backup.data];
      if (!categoryData) {
        skipped.push(category);
        continue;
      }

      try {
        switch (category) {
          case 'profile':
            // Update user profile
            // In production, update database
            imported.push('profile');
            break;

          case 'preferences':
            // Update preferences
            imported.push('preferences');
            break;

          case 'appearance':
            // Update appearance settings
            imported.push('appearance');
            break;

          case 'notifications':
            // Update notification settings
            imported.push('notifications');
            break;

          case 'privacy':
            // Update privacy settings
            imported.push('privacy');
            break;

          case 'security':
            // Update security settings (carefully)
            imported.push('security');
            break;

          case 'accessibility':
            // Update accessibility settings
            imported.push('accessibility');
            break;

          case 'audioVideo':
            // Update audio/video settings
            imported.push('audioVideo');
            break;

          case 'language':
            // Update language settings
            imported.push('language');
            break;

          case 'keyboardShortcuts':
            // Update keyboard shortcuts
            imported.push('keyboardShortcuts');
            break;

          case 'conversations':
            // Import conversations (carefully, with validation)
            // This should be handled specially in production
            if (overwrite) {
              imported.push('conversations');
            } else {
              skipped.push('conversations');
            }
            break;

          default:
            skipped.push(category);
        }
      } catch (error) {
        console.error(`Failed to import ${category}:`, error);
        skipped.push(category);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import settings' },
      { status: 500 }
    );
  }
}
