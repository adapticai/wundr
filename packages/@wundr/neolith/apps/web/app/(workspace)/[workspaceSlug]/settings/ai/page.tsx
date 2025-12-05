import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { AIPreferences } from '@/components/settings/ai-preferences';
import { AIProviders } from '@/components/settings/ai-providers';
import { AIUsage } from '@/components/settings/ai-usage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Settings',
  description: 'Manage your AI preferences and usage',
};

interface AISettingsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function AISettingsPage({ params }: AISettingsPageProps) {
  const { workspaceSlug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch user with preferences and usage data
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      preferences: true,
    },
  });

  if (!user) {
    redirect('/');
  }

  // Extract AI settings from preferences
  const prefs = (user.preferences as Record<string, unknown>) || {};
  const aiSettings = (prefs.aiSettings as Record<string, unknown>) || {};

  // Fetch token usage stats for the current month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get orchestrator if user is an orchestrator
  const orchestrator = await prisma.orchestrator.findFirst({
    where: { userId: session.user.id },
    include: {
      tokenUsage: {
        where: {
          createdAt: {
            gte: firstDayOfMonth,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      budgetConfig: true,
    },
  });

  // Calculate usage stats
  const totalTokens =
    orchestrator?.tokenUsage.reduce(
      (sum, usage) => sum + usage.totalTokens,
      0
    ) || 0;

  const totalCost =
    orchestrator?.tokenUsage.reduce(
      (sum, usage) => sum + Number(usage.cost || 0),
      0
    ) || 0;

  const monthlyLimit = orchestrator?.budgetConfig?.monthlyLimit || 10000000;
  const usagePercentage = (totalTokens / monthlyLimit) * 100;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>AI Settings</h1>
        <p className='text-muted-foreground'>
          Manage your AI model preferences, provider configuration, and usage
          limits.
        </p>
      </div>

      <Separator />

      {/* AI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>AI Preferences</CardTitle>
          <CardDescription>
            Configure your default AI model and behavior preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIPreferences
            userId={user.id}
            settings={aiSettings}
            workspaceSlug={workspaceSlug}
          />
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>
            Manage API keys and provider configurations for AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIProviders
            userId={user.id}
            settings={aiSettings}
            workspaceSlug={workspaceSlug}
          />
        </CardContent>
      </Card>

      {/* Usage & Billing */}
      <Card>
        <CardHeader>
          <CardTitle>Usage & Billing</CardTitle>
          <CardDescription>
            Track your AI usage, costs, and manage quotas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIUsage
            userId={user.id}
            orchestratorId={orchestrator?.id}
            totalTokens={totalTokens}
            totalCost={totalCost}
            usagePercentage={usagePercentage}
            monthlyLimit={monthlyLimit}
            workspaceSlug={workspaceSlug}
          />
        </CardContent>
      </Card>
    </div>
  );
}
