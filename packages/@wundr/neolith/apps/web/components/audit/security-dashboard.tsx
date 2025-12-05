'use client';

import { format, subDays } from 'date-fns';
import {
  AlertTriangleIcon,
  BanIcon,
  KeyIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserXIcon,
  ActivityIcon,
  TrendingUpIcon,
} from 'lucide-react';
import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { AuditLogEntry } from './audit-log-entry';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type:
    | 'failed_login'
    | 'rate_limit'
    | 'suspicious_activity'
    | 'unauthorized_access';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  action: string;
  actionType:
    | 'CREATE'
    | 'READ'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'SECURITY';
  resource?: {
    id: string;
    type: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityMetrics {
  failedLogins: {
    total: number;
    trend: number;
    byDay: Array<{ date: string; count: number }>;
  };
  rateLimitViolations: {
    total: number;
    trend: number;
    byEndpoint: Array<{ endpoint: string; count: number }>;
  };
  suspiciousActivity: {
    total: number;
    trend: number;
    byType: Array<{ type: string; count: number }>;
  };
  blockedIPs: string[];
  revokedTokens: number;
}

export interface SecurityDashboardProps {
  events: SecurityEvent[];
  metrics: SecurityMetrics;
  onBlockIP: (ip: string) => void;
  onRevokeToken: (tokenId: string) => void;
  onInvestigate: (eventId: string) => void;
  isLoading?: boolean;
}

export function SecurityDashboard({
  events,
  metrics,
  onBlockIP,
  onRevokeToken,
  onInvestigate,
  isLoading = false,
}: SecurityDashboardProps) {
  const [selectedEvent, setSelectedEvent] =
    React.useState<SecurityEvent | null>(null);

  const eventTypeConfig = {
    failed_login: {
      icon: UserXIcon,
      label: 'Failed Login',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    rate_limit: {
      icon: ActivityIcon,
      label: 'Rate Limit',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    suspicious_activity: {
      icon: AlertTriangleIcon,
      label: 'Suspicious Activity',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    unauthorized_access: {
      icon: BanIcon,
      label: 'Unauthorized Access',
      color: 'text-red-600',
      bg: 'bg-red-600/10',
    },
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUpIcon className='h-4 w-4 text-red-500' />;
    }
    if (trend < 0) {
      return <TrendingUpIcon className='h-4 w-4 rotate-180 text-green-500' />;
    }
    return null;
  };

  const getTrendText = (trend: number) => {
    const abs = Math.abs(trend);
    const direction =
      trend > 0 ? 'increase' : trend < 0 ? 'decrease' : 'no change';
    return `${abs}% ${direction}`;
  };

  return (
    <div className='space-y-6'>
      {/* Overview Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Failed Logins</CardTitle>
            <UserXIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {metrics.failedLogins.total}
            </div>
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              {getTrendIcon(metrics.failedLogins.trend)}
              <span>
                {getTrendText(metrics.failedLogins.trend)} from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Rate Limit Violations
            </CardTitle>
            <ActivityIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {metrics.rateLimitViolations.total}
            </div>
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              {getTrendIcon(metrics.rateLimitViolations.trend)}
              <span>
                {getTrendText(metrics.rateLimitViolations.trend)} from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Suspicious Activity
            </CardTitle>
            <AlertTriangleIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {metrics.suspiciousActivity.total}
            </div>
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              {getTrendIcon(metrics.suspiciousActivity.trend)}
              <span>
                {getTrendText(metrics.suspiciousActivity.trend)} from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Blocked IPs</CardTitle>
            <BanIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {metrics.blockedIPs.length}
            </div>
            <p className='text-xs text-muted-foreground'>
              {metrics.revokedTokens} tokens revoked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className='grid gap-4 md:grid-cols-2'>
        {/* Failed Logins Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Failed Login Attempts</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <AreaChart data={metrics.failedLogins.byDay}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='date'
                  className='text-xs'
                  tickFormatter={value => format(new Date(value), 'MMM dd')}
                />
                <YAxis className='text-xs' />
                <Tooltip
                  labelFormatter={value => format(new Date(value), 'PPP')}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type='monotone'
                  dataKey='count'
                  stroke='hsl(var(--destructive))'
                  fill='hsl(var(--destructive))'
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rate Limit Violations Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Violations</CardTitle>
            <CardDescription>By endpoint (top 5)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart
                data={metrics.rateLimitViolations.byEndpoint.slice(0, 5)}
              >
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis dataKey='endpoint' className='text-xs' />
                <YAxis className='text-xs' />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey='count'
                  fill='hsl(var(--primary))'
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Critical events requiring attention ({events.length})
              </CardDescription>
            </div>
            <ShieldCheckIcon className='h-5 w-5 text-muted-foreground' />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex h-32 items-center justify-center text-muted-foreground'>
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className='flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground'>
              <ShieldCheckIcon className='h-8 w-8' />
              <p className='text-sm'>No security events</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {events.map(event => {
                const config = eventTypeConfig[event.type];
                const EventIcon = config.icon;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'rounded-lg border p-4 transition-colors hover:bg-muted/50',
                      selectedEvent?.id === event.id && 'border-primary'
                    )}
                  >
                    <div className='flex items-start justify-between gap-4'>
                      <div className='flex items-start gap-3 flex-1'>
                        <div className={cn('rounded-full p-2', config.bg)}>
                          <EventIcon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <div className='flex-1 space-y-2'>
                          <div className='flex items-center gap-2'>
                            <h4 className='font-medium'>{config.label}</h4>
                            <Badge
                              variant={
                                event.severity === 'critical' ||
                                event.severity === 'error'
                                  ? 'destructive'
                                  : event.severity === 'warning'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {event.severity}
                            </Badge>
                          </div>
                          <p className='text-sm text-muted-foreground'>
                            {event.action}
                          </p>
                          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                            <span>{event.actor.name}</span>
                            {event.ipAddress && (
                              <>
                                <Separator
                                  orientation='vertical'
                                  className='h-3'
                                />
                                <span className='font-mono'>
                                  {event.ipAddress}
                                </span>
                              </>
                            )}
                            <Separator orientation='vertical' className='h-3' />
                            <span>{format(event.timestamp, 'PPp')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className='flex gap-2'>
                        {event.ipAddress && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => onBlockIP(event.ipAddress!)}
                          >
                            <BanIcon className='mr-2 h-3 w-3' />
                            Block IP
                          </Button>
                        )}
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => onInvestigate(event.id)}
                        >
                          <ShieldAlertIcon className='mr-2 h-3 w-3' />
                          Investigate
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedEvent?.id === event.id && (
                      <div className='mt-4 pt-4 border-t'>
                        <AuditLogEntry event={event} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked IPs */}
      {metrics.blockedIPs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Blocked IP Addresses</CardTitle>
            <CardDescription>
              {metrics.blockedIPs.length} IP addresses currently blocked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-2 md:grid-cols-2 lg:grid-cols-3'>
              {metrics.blockedIPs.map(ip => (
                <div
                  key={ip}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <code className='font-mono text-sm'>{ip}</code>
                  <Button variant='ghost' size='sm'>
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
