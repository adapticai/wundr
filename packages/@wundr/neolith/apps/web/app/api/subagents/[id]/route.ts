/**
 * API Routes for individual Subagent
 *
 * GET /api/subagents/[id] - Get subagent details
 * PATCH /api/subagents/[id] - Update subagent
 * DELETE /api/subagents/[id] - Delete subagent
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const subagent = await prisma.subagent.findUnique({
      where: { id: resolvedParams.id },
      include: {
        sessionManager: {
          select: {
            id: true,
            name: true,
            orchestratorId: true,
          },
        },
      },
    });

    if (!subagent) {
      return NextResponse.json(
        { error: 'Subagent not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: subagent });
  } catch (error) {
    console.error('Error fetching subagent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();

    const subagent = await prisma.subagent.update({
      where: { id: resolvedParams.id },
      data: body,
      include: {
        sessionManager: {
          select: {
            id: true,
            name: true,
            orchestratorId: true,
          },
        },
      },
    });

    return NextResponse.json({ data: subagent });
  } catch (error) {
    console.error('Error updating subagent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    await prisma.subagent.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subagent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
