/**
 * User AI History Management API Route
 *
 * Handles deletion of user's AI conversation history and context memory.
 *
 * Routes:
 * - DELETE /api/user/ai-settings/history - Delete AI conversation history
 *
 * @module app/api/user/ai-settings/history/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * DELETE /api/user/ai-settings/history
 *
 * Delete all AI conversation history and context memory for the authenticated user
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find orchestrator if user is an orchestrator
    const orchestrator = await prisma.orchestrator.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!orchestrator) {
      return NextResponse.json({
        success: true,
        message: 'No conversation history to delete',
        deleted: 0,
      });
    }

    // Delete all orchestrator memories (conversation history)
    const deleteResult = await prisma.orchestratorMemory.deleteMany({
      where: {
        orchestratorId: orchestrator.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation history deleted successfully',
      deleted: deleteResult.count,
    });
  } catch (error) {
    console.error('[DELETE /api/user/ai-settings/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
