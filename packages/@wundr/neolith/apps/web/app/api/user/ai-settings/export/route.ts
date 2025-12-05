/**
 * User AI Data Export API Route
 *
 * Handles exporting user's AI-related data including conversation history,
 * usage statistics, and preferences.
 *
 * Routes:
 * - POST /api/user/ai-settings/export - Export AI data
 *
 * @module app/api/user/ai-settings/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/ai-settings/export
 *
 * Export user's AI data including settings, conversation history, and usage stats
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const aiSettings = (prefs.aiSettings as Record<string, unknown>) || {};

    // Get orchestrator data if user is an orchestrator
    const orchestrator = await prisma.orchestrator.findFirst({
      where: { userId: session.user.id },
      include: {
        tokenUsage: {
          orderBy: { createdAt: 'desc' },
          take: 1000, // Last 1000 records
        },
        orchestratorMemories: {
          orderBy: { createdAt: 'desc' },
          take: 1000,
        },
      },
    });

    // Compile export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        accountCreated: user.createdAt.toISOString(),
      },
      aiSettings: {
        defaultModel: aiSettings.defaultModel || null,
        temperature: aiSettings.temperature || null,
        maxTokens: aiSettings.maxTokens || null,
        historyRetention: aiSettings.historyRetention || null,
        enableContextMemory: aiSettings.enableContextMemory ?? null,
        enableSuggestions: aiSettings.enableSuggestions ?? null,
        shareUsageData: aiSettings.shareUsageData ?? null,
      },
      usage: orchestrator
        ? {
            totalTokens: orchestrator.tokenUsage.reduce(
              (sum, u) => sum + u.totalTokens,
              0
            ),
            totalCost: orchestrator.tokenUsage.reduce(
              (sum, u) => sum + Number(u.cost || 0),
              0
            ),
            records: orchestrator.tokenUsage.map(usage => ({
              date: usage.createdAt.toISOString(),
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
              cost: Number(usage.cost || 0),
              taskType: usage.taskType,
            })),
          }
        : null,
      conversationHistory: orchestrator
        ? {
            totalMemories: orchestrator.orchestratorMemories.length,
            memories: orchestrator.orchestratorMemories.map(memory => ({
              type: memory.memoryType,
              content: memory.content,
              importance: memory.importance,
              createdAt: memory.createdAt.toISOString(),
              metadata: memory.metadata,
            })),
          }
        : null,
    };

    // Create JSON blob
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Return as downloadable file
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ai-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/ai-settings/export] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
