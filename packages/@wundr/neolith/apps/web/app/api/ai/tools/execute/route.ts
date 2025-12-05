/**
 * AI Tool Execution API Route
 *
 * Handles tool execution requests with permission checking and result formatting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/ai/tools/init';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Execute a tool
 * POST /api/ai/tools/execute
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tool, input, workspaceId } = body;

    if (!tool || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: tool, workspaceId' },
        { status: 400 }
      );
    }

    // Get user permissions (in real app, fetch from database)
    const userPermissions = [
      'workflow:read',
      'workflow:create',
      'workflow:update',
      'workflow:execute',
      'message:read',
      'file:read',
      'user:read',
      'channel:read',
      'data:read',
      'analytics:read',
      'report:create',
      'search:semantic',
    ];

    // Execute tool
    const result = await toolRegistry.execute(tool, input || {}, {
      userId: session.user.id,
      workspaceId,
      permissions: userPermissions,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
