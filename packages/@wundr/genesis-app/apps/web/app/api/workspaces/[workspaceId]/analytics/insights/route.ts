import { AnalyticsService } from '@genesis/core';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

import type { NextRequest} from 'next/server';



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month' | 'quarter' | 'year';

    const analyticsService = new AnalyticsService({ prisma, redis });
    const report = await analyticsService.generateInsightReport(workspaceId, period);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Analytics insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
