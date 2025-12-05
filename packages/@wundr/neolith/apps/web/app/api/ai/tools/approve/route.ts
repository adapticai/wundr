/**
 * AI Tool Approval API Route
 *
 * Handles approval/rejection of sensitive tool operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/ai/tools/init';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Approve or reject a tool execution
 * POST /api/ai/tools/approve
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { approvalId, action } = body;

    if (!approvalId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, action' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      const result = await toolRegistry.approveAndExecute(approvalId);
      return NextResponse.json(result);
    } else if (action === 'reject') {
      toolRegistry.rejectApproval(approvalId);
      return NextResponse.json({
        success: true,
        message: 'Tool execution rejected',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Tool approval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get pending approval details
 * GET /api/ai/tools/approve?approvalId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const approvalId = searchParams.get('approvalId');

    if (!approvalId) {
      return NextResponse.json(
        { error: 'Missing approvalId parameter' },
        { status: 400 }
      );
    }

    const approval = toolRegistry.getPendingApproval(approvalId);

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      approvalId,
      tool: approval.tool,
      input: approval.input,
    });
  } catch (error) {
    console.error('Get approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
