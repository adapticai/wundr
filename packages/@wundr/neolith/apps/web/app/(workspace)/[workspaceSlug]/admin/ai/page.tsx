/**
 * AI Admin Dashboard Page
 *
 * Comprehensive AI management interface for workspace administrators.
 * Features:
 * - Workspace-wide AI usage metrics
 * - Per-user usage breakdown
 * - Cost projections and analysis
 * - Model availability toggles
 * - Rate limit configuration
 * - Usage alerts setup
 * - Export usage reports
 *
 * @module app/(workspace)/[workspaceSlug]/admin/ai/page
 */

import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { AVAILABLE_MODELS } from '@/lib/ai/providers';

import { AIUsageChart } from '@/components/admin/ai-usage-chart';
import { AIModelManagement } from '@/components/admin/ai-model-management';
import { AICostBreakdown } from '@/components/admin/ai-cost-breakdown';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AdminAIPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Get AI usage statistics for workspace
 */
async function getAIUsageStats(workspaceId: string) {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get all orchestrators for this workspace
  const orchestrators = await prisma.orchestrator.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  const orchestratorIds = orchestrators.map(o => o.id);

  // Get token usage for different time periods
  const [last24HoursUsage, last7DaysUsage, last30DaysUsage, allTimeUsage] =
    await Promise.all([
      prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: { in: orchestratorIds },
          createdAt: { gte: last24Hours },
        },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
        },
        _count: true,
      }),
      prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: { in: orchestratorIds },
          createdAt: { gte: last7Days },
        },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
        },
        _count: true,
      }),
      prisma.tokenUsage.aggregate({
        where: {
          orchestratorId: { in: orchestratorIds },
          createdAt: { gte: last30Days },
        },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
        },
        _count: true,
      }),
      prisma.tokenUsage.aggregate({
        where: { orchestratorId: { in: orchestratorIds } },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
        },
        _count: true,
      }),
    ]);

  // Get daily usage for last 30 days
  const dailyUsage = await prisma.tokenUsage.groupBy({
    by: ['createdAt'],
    where: {
      orchestratorId: { in: orchestratorIds },
      createdAt: { gte: last30Days },
    },
    _sum: { totalTokens: true, cost: true },
  });

  // Get usage by model
  const usageByModel = await prisma.tokenUsage.groupBy({
    by: ['model'],
    where: { orchestratorId: { in: orchestratorIds } },
    _sum: {
      totalTokens: true,
      inputTokens: true,
      outputTokens: true,
      cost: true,
    },
    _count: true,
  });

  // Get usage by user (via orchestrator owner)
  const usageByUser = await prisma.tokenUsage.findMany({
    where: { orchestratorId: { in: orchestratorIds } },
    select: {
      orchestrator: {
        select: {
          userId: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      totalTokens: true,
      inputTokens: true,
      outputTokens: true,
      cost: true,
    },
  });

  // Aggregate by user
  const userUsageMap = new Map<
    string,
    {
      userId: string;
      userName: string;
      userEmail: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      requestCount: number;
    }
  >();

  for (const usage of usageByUser) {
    const userId = usage.orchestrator.user?.id || usage.orchestrator.userId;
    const userName = usage.orchestrator.user?.name || 'Unknown';
    const userEmail = usage.orchestrator.user?.email || 'unknown@example.com';

    const existing = userUsageMap.get(userId) || {
      userId,
      userName,
      userEmail,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      requestCount: 0,
    };

    existing.totalTokens += usage.totalTokens;
    existing.inputTokens += usage.inputTokens;
    existing.outputTokens += usage.outputTokens;
    existing.cost += Number(usage.cost || 0);
    existing.requestCount += 1;

    userUsageMap.set(userId, existing);
  }

  return {
    summary: {
      last24Hours: {
        tokens: last24HoursUsage._sum.totalTokens || 0,
        cost: Number(last24HoursUsage._sum.cost || 0),
        requests: last24HoursUsage._count,
      },
      last7Days: {
        tokens: last7DaysUsage._sum.totalTokens || 0,
        cost: Number(last7DaysUsage._sum.cost || 0),
        requests: last7DaysUsage._count,
      },
      last30Days: {
        tokens: last30DaysUsage._sum.totalTokens || 0,
        cost: Number(last30DaysUsage._sum.cost || 0),
        requests: last30DaysUsage._count,
      },
      allTime: {
        tokens: allTimeUsage._sum.totalTokens || 0,
        cost: Number(allTimeUsage._sum.cost || 0),
        requests: allTimeUsage._count,
      },
    },
    dailyUsage: dailyUsage.map(d => ({
      date: d.createdAt.toISOString().split('T')[0],
      tokens: d._sum.totalTokens || 0,
      cost: Number(d._sum.cost || 0),
    })),
    usageByModel: usageByModel.map(m => ({
      model: m.model,
      tokens: m._sum.totalTokens || 0,
      inputTokens: m._sum.inputTokens || 0,
      outputTokens: m._sum.outputTokens || 0,
      cost: Number(m._sum.cost || 0),
      requests: m._count,
    })),
    usageByUser: Array.from(userUsageMap.values()),
  };
}

/**
 * Get workspace AI settings
 */
async function getWorkspaceAISettings(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });

  const settings = (workspace?.settings as any) || {};
  return {
    enabledModels: settings.ai?.enabledModels || Object.keys(AVAILABLE_MODELS),
    rateLimits: settings.ai?.rateLimits || {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      costPerDay: 100,
    },
    alerts: settings.ai?.alerts || {
      enabled: true,
      thresholds: [50, 75, 90],
      recipients: [],
    },
  };
}

export default async function AdminAIPage({ params }: AdminAIPageProps) {
  const { workspaceSlug } = await params;
  const session = await auth();

  // Authentication check
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Find workspace
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    select: { id: true, name: true, slug: true },
  });

  if (!workspace) {
    redirect('/');
  }

  // Authorization check - only ADMIN and OWNER roles
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
    select: { role: true },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    redirect(`/${workspaceSlug}/dashboard`);
  }

  // Get AI usage stats and settings
  const [stats, settings] = await Promise.all([
    getAIUsageStats(workspace.id),
    getWorkspaceAISettings(workspace.id),
  ]);

  return (
    <div className='container mx-auto p-6 space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>AI Management</h1>
        <p className='text-muted-foreground mt-2'>
          Monitor and manage AI usage, models, and costs for your workspace
        </p>
      </div>

      {/* Summary Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>24h Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(stats.summary.last24Hours.tokens / 1000).toFixed(1)}K
            </div>
            <p className='text-xs text-muted-foreground'>
              tokens • ${stats.summary.last24Hours.cost.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>7d Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(stats.summary.last7Days.tokens / 1000).toFixed(1)}K
            </div>
            <p className='text-xs text-muted-foreground'>
              tokens • ${stats.summary.last7Days.cost.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>30d Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(stats.summary.last30Days.tokens / 1000).toFixed(1)}K
            </div>
            <p className='text-xs text-muted-foreground'>
              tokens • ${stats.summary.last30Days.cost.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.summary.allTime.requests}
            </div>
            <p className='text-xs text-muted-foreground'>
              ${stats.summary.allTime.cost.toFixed(2)} all time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='usage' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='usage'>Usage Analytics</TabsTrigger>
          <TabsTrigger value='models'>Model Management</TabsTrigger>
          <TabsTrigger value='costs'>Cost Analysis</TabsTrigger>
        </TabsList>

        {/* Usage Analytics Tab */}
        <TabsContent value='usage' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>
                Token usage and requests over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIUsageChart
                data={stats.dailyUsage}
                usageByModel={stats.usageByModel}
                usageByUser={stats.usageByUser}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Management Tab */}
        <TabsContent value='models' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>
                Enable or disable AI models and configure rate limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIModelManagement
                workspaceId={workspace.id}
                workspaceSlug={workspace.slug}
                enabledModels={settings.enabledModels}
                rateLimits={settings.rateLimits}
                alerts={settings.alerts}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Analysis Tab */}
        <TabsContent value='costs' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>
                Detailed cost analysis by model, user, and time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AICostBreakdown
                summary={stats.summary}
                usageByModel={stats.usageByModel}
                usageByUser={stats.usageByUser}
                workspaceSlug={workspace.slug}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
