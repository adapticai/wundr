/**
 * Backup Schedules API Endpoint
 *
 * GET - List backup schedules
 * POST - Create backup schedule
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

const scheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  format: z.enum(['json', 'csv']),
  includeTypes: z.array(z.string()),
  enabled: z.boolean(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can view schedules' },
        { status: 403 },
      );
    }

    // Return empty schedules for now - in production this would use workspace settings JSON
    const schedules: Array<{
      id: string;
      frequency: string;
      time: string;
      format: string;
      includeTypes: string[];
      enabled: boolean;
      lastRun?: string;
      nextRun: string;
      createdAt: string;
    }> = [];

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Failed to fetch backup schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backup schedules' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can create schedules' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = scheduleSchema.parse(body);

    // Calculate next run time
    const nextRun = calculateNextRun(validated.frequency, validated.time);

    // In production, this would store the schedule in workspace settings JSON
    // For now, return a mock response
    const scheduleId = `schedule_${Date.now()}`;

    return NextResponse.json({
      schedule: {
        id: scheduleId,
        frequency: validated.frequency,
        time: validated.time,
        format: validated.format,
        includeTypes: validated.includeTypes,
        enabled: validated.enabled,
        nextRun: nextRun.toISOString(),
        createdAt: new Date().toISOString(),
      },
      message: 'Schedule created successfully. In production, this would be persisted to workspace settings.',
    });
  } catch (error) {
    console.error('Failed to create backup schedule:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create backup schedule' },
      { status: 500 },
    );
  }
}

function calculateNextRun(
  frequency: 'daily' | 'weekly' | 'monthly',
  time: string,
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const nextRun = new Date();

  nextRun.setHours(hours, minutes, 0, 0);

  // If the time has passed today, move to next occurrence
  if (nextRun <= now) {
    if (frequency === 'daily') {
      nextRun.setDate(nextRun.getDate() + 1);
    } else if (frequency === 'weekly') {
      nextRun.setDate(nextRun.getDate() + 7);
    } else if (frequency === 'monthly') {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  }

  return nextRun;
}
