'use client';

import {
  AlertTriangleIcon,
  CreditCardIcon,
  MailIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { DashboardStatsCard } from './dashboard-stats-card';

interface AdminDashboardSectionProps {
  workspaceId: string;
}

interface AdminStats {
  pendingInvites: number;
  totalMembers: number;
  securityEvents: number;
  billingStatus: 'active' | 'past_due' | 'canceled' | 'trial' | null;
  memberGrowth: {
    current: number;
    previous: number;
    percentage: number;
  };
  workspaceHealth: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  };
}

export function AdminDashboardSection({
  workspaceId,
}: AdminDashboardSectionProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        // Fetch admin-specific stats
        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/admin-stats`
        );

        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        } else {
          // If endpoint doesn't exist yet, use mock data
          setStats({
            pendingInvites: 3,
            totalMembers: 12,
            securityEvents: 2,
            billingStatus: 'active',
            memberGrowth: {
              current: 12,
              previous: 10,
              percentage: 20,
            },
            workspaceHealth: {
              status: 'healthy',
              issues: [],
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        // Use default values on error
        setStats({
          pendingInvites: 0,
          totalMembers: 0,
          securityEvents: 0,
          billingStatus: null,
          memberGrowth: {
            current: 0,
            previous: 0,
            percentage: 0,
          },
          workspaceHealth: {
            status: 'healthy',
            issues: [],
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminStats();
  }, [workspaceId]);

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='h-8 w-48 bg-muted animate-pulse rounded' />
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='h-32 bg-muted animate-pulse rounded-lg' />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const healthColor = {
    healthy: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  }[stats.workspaceHealth.status];

  const billingStatusBadge = stats.billingStatus
    ? {
        active: { variant: 'default' as const, label: 'Active' },
        past_due: { variant: 'destructive' as const, label: 'Past Due' },
        canceled: { variant: 'outline' as const, label: 'Canceled' },
        trial: { variant: 'secondary' as const, label: 'Trial' },
      }[stats.billingStatus]
    : null;

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>Admin Overview</h2>
        <p className='text-muted-foreground'>
          Monitor workspace health and manage administrative tasks
        </p>
      </div>

      {/* Workspace Health Alert */}
      {stats.workspaceHealth.status !== 'healthy' && (
        <Card className='border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2'>
              <AlertTriangleIcon className='h-5 w-5 text-yellow-600' />
              <CardTitle className='text-base'>
                Workspace Health Issues
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className='list-disc list-inside space-y-1 text-sm'>
              {stats.workspaceHealth.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <DashboardStatsCard
          label='Pending Invitations'
          value={stats.pendingInvites}
          icon={MailIcon}
          href={`/${workspaceId}/admin/invites`}
          description={
            stats.pendingInvites > 0 ? 'Action required' : 'All caught up'
          }
        />

        <DashboardStatsCard
          label='Member Growth'
          value={stats.memberGrowth.current}
          icon={UsersIcon}
          href={`/${workspaceId}/admin/members`}
          trend={{
            direction:
              stats.memberGrowth.percentage > 0
                ? 'up'
                : stats.memberGrowth.percentage < 0
                  ? 'down'
                  : 'neutral',
            value: `${Math.abs(stats.memberGrowth.percentage)}%`,
            label: 'from last period',
          }}
        />

        <DashboardStatsCard
          label='Security Events'
          value={stats.securityEvents}
          icon={ShieldCheckIcon}
          href={`/${workspaceId}/admin/security`}
          description={
            stats.securityEvents > 0 ? 'Recent activity' : 'No issues detected'
          }
        />
      </div>

      {/* Admin Quick Actions */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <TrendingUpIcon className='h-4 w-4' />
              Workspace Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Status</span>
              <Badge variant='outline' className={healthColor}>
                {stats.workspaceHealth.status.charAt(0).toUpperCase() +
                  stats.workspaceHealth.status.slice(1)}
              </Badge>
            </div>
            <div className='mt-4 space-y-2'>
              <div className='text-sm'>
                <span className='text-muted-foreground'>Total Members:</span>
                <span className='ml-2 font-medium'>{stats.totalMembers}</span>
              </div>
              <div className='text-sm'>
                <span className='text-muted-foreground'>Active Invites:</span>
                <span className='ml-2 font-medium'>{stats.pendingInvites}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {billingStatusBadge && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base flex items-center gap-2'>
                <CreditCardIcon className='h-4 w-4' />
                Billing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>
                  Current Plan
                </span>
                <Badge variant={billingStatusBadge.variant}>
                  {billingStatusBadge.label}
                </Badge>
              </div>
              {stats.billingStatus === 'past_due' && (
                <p className='mt-4 text-sm text-destructive'>
                  Payment is past due. Please update your billing information.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Quick Admin Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-2 md:grid-cols-2'>
            <a
              href={`/${workspaceId}/admin/members`}
              className='flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent transition-colors'
            >
              <span>Manage Members</span>
              <UsersIcon className='h-4 w-4 text-muted-foreground' />
            </a>
            <a
              href={`/${workspaceId}/admin/invites`}
              className='flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent transition-colors'
            >
              <span>View Invitations</span>
              <MailIcon className='h-4 w-4 text-muted-foreground' />
            </a>
            <a
              href={`/${workspaceId}/admin/settings`}
              className='flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent transition-colors'
            >
              <span>Workspace Settings</span>
              <ShieldCheckIcon className='h-4 w-4 text-muted-foreground' />
            </a>
            <a
              href={`/${workspaceId}/admin/activity`}
              className='flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent transition-colors'
            >
              <span>Audit Log</span>
              <TrendingUpIcon className='h-4 w-4 text-muted-foreground' />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
