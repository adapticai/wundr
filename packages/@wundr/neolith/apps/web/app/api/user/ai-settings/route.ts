/**
 * User AI Settings API Route
 *
 * Handles AI-related user settings including model preferences, provider configuration,
 * and data privacy options.
 *
 * Routes:
 * - GET /api/user/ai-settings - Get current AI settings
 * - PUT /api/user/ai-settings - Update AI settings
 *
 * @module app/api/user/ai-settings/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Encrypt sensitive data (API keys) before storing
 */
function encryptApiKey(apiKey: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(
    process.env.ENCRYPTION_KEY ||
      crypto.randomBytes(32).toString('hex').slice(0, 32)
  );
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * GET /api/user/ai-settings
 *
 * Retrieve current AI settings for the authenticated user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const aiSettings = (prefs.aiSettings as Record<string, unknown>) || {};

    // Don't send encrypted API keys to client
    const sanitizedSettings = { ...aiSettings };
    delete sanitizedSettings.openaiApiKey;
    delete sanitizedSettings.anthropicApiKey;
    delete sanitizedSettings.googleApiKey;
    delete sanitizedSettings.deepseekApiKey;

    return NextResponse.json({
      success: true,
      data: sanitizedSettings,
    });
  } catch (error) {
    console.error('[GET /api/user/ai-settings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/ai-settings
 *
 * Update AI settings for the authenticated user
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updates = body as Record<string, unknown>;

    // Get current preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentPrefs =
      (currentUser.preferences as Record<string, unknown>) || {};
    const currentAiSettings =
      (currentPrefs.aiSettings as Record<string, unknown>) || {};

    // Merge updates
    const updatedAiSettings = { ...currentAiSettings };

    // Handle model preferences
    if (updates.defaultModel !== undefined) {
      updatedAiSettings.defaultModel = updates.defaultModel;
    }
    if (updates.temperature !== undefined) {
      updatedAiSettings.temperature = updates.temperature;
    }
    if (updates.maxTokens !== undefined) {
      updatedAiSettings.maxTokens = updates.maxTokens;
    }
    if (updates.historyRetention !== undefined) {
      updatedAiSettings.historyRetention = updates.historyRetention;
    }

    // Handle boolean settings
    if (updates.enableContextMemory !== undefined) {
      updatedAiSettings.enableContextMemory = updates.enableContextMemory;
    }
    if (updates.enableSuggestions !== undefined) {
      updatedAiSettings.enableSuggestions = updates.enableSuggestions;
    }
    if (updates.shareUsageData !== undefined) {
      updatedAiSettings.shareUsageData = updates.shareUsageData;
    }

    // Handle provider API keys (encrypt before storing)
    if (updates.providers && typeof updates.providers === 'object') {
      const providers = updates.providers as Record<string, string>;

      if (providers.openaiApiKey) {
        updatedAiSettings.openaiApiKey = encryptApiKey(providers.openaiApiKey);
      }
      if (providers.anthropicApiKey) {
        updatedAiSettings.anthropicApiKey = encryptApiKey(
          providers.anthropicApiKey
        );
      }
      if (providers.googleApiKey) {
        updatedAiSettings.googleApiKey = encryptApiKey(providers.googleApiKey);
      }
      if (providers.deepseekApiKey) {
        updatedAiSettings.deepseekApiKey = encryptApiKey(
          providers.deepseekApiKey
        );
      }
    }

    // Update preferences
    const updatedPrefs = {
      ...currentPrefs,
      aiSettings: updatedAiSettings,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI settings updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/user/ai-settings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
