'use client';

import { Activity, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { Orchestrator } from '@/types/orchestrator';

interface OrchestratorActivity {
  id: string;
  type: 'task_completed' | 'task_started' | 'message_sent' | 'escalation';
  title: string;
  timestamp: Date;
}

interface OrchestratorWorkStats {
  tasksCompletedToday: number;
  tasksCompletedWeek: number;
  currentTaskProgress: number;
  currentTaskTitle?: string;
  activeTimeToday: number; // in minutes
  idleTimeToday: number; // in minutes
  recentActivities: OrchestratorActivity[];
}

interface OrchestratorWorkSummaryProps {
  orchestrator: Orchestrator;
  stats: OrchestratorWorkStats;
  workspaceId?: string;
  className?: string;
}

export function OrchestratorWorkSummary({ orchestrator, stats, workspaceId, className }: OrchestratorWorkSummaryProps) {
  const totalTimeToday = stats.activeTimeToday + stats.idleTimeToday;
  const activePercentage =
    totalTimeToday > 0 ? Math.round((stats.activeTimeToday / totalTimeToday) * 100) : 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{orchestrator.title} Work Summary</CardTitle>
            <CardDescription>Performance metrics and recent activity</CardDescription>
          </div>
          {workspaceId && (
            <Link
              href={`/${workspaceId}/orchestrators/${orchestrator.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View Details
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tasks Completed Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>Today</span>
            </div>
            <p className="text-2xl font-bold">{stats.tasksCompletedToday}</p>
            <p className="text-xs text-muted-foreground">tasks completed</p>
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>This Week</span>
            </div>
            <p className="text-2xl font-bold">{stats.tasksCompletedWeek}</p>
            <p className="text-xs text-muted-foreground">tasks completed</p>
          </div>
        </div>

        {/* Current Task Progress */}
        {stats.currentTaskTitle && (
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Current Task</p>
              <span className="text-xs text-muted-foreground">
                {stats.currentTaskProgress}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {stats.currentTaskTitle}
            </p>
            <Progress value={stats.currentTaskProgress} className="h-2" />
          </div>
        )}

        <Separator />

        {/* Active/Idle Time Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            <span>Time Breakdown Today</span>
          </div>

          <div className="space-y-2">
            {/* Active Time */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Active</span>
              </div>
              <span className="font-medium">{formatMinutes(stats.activeTimeToday)}</span>
            </div>

            {/* Idle Time */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-300" />
                <span className="text-muted-foreground">Idle</span>
              </div>
              <span className="font-medium">{formatMinutes(stats.idleTimeToday)}</span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${activePercentage}%` }}
              />
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {activePercentage}% active time
            </p>
          </div>
        </div>

        <Separator />

        {/* Recent Activity List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            <span>Recent Activity</span>
          </div>

          {stats.recentActivities.length > 0 ? (
            <div className="space-y-2">
              {stats.recentActivities.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border bg-muted/30 p-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5">
                    <ActivityIcon type={activity.type} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-none">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Activity icon component
function ActivityIcon({ type }: { type: OrchestratorActivity['type'] }) {
  const iconClass = 'h-4 w-4';

  switch (type) {
    case 'task_completed':
      return <CheckCircle2 className={cn(iconClass, 'text-green-600')} />;
    case 'task_started':
      return <TrendingUp className={cn(iconClass, 'text-blue-600')} />;
    case 'message_sent':
      return <Activity className={cn(iconClass, 'text-purple-600')} />;
    case 'escalation':
      return <Clock className={cn(iconClass, 'text-orange-600')} />;
    default:
      return <Activity className={cn(iconClass, 'text-muted-foreground')} />;
  }
}

// Format minutes to readable time
function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
return 'Just now';
}
  if (diffMins < 60) {
return `${diffMins}m ago`;
}
  if (diffHours < 24) {
return `${diffHours}h ago`;
}
  if (diffDays < 7) {
return `${diffDays}d ago`;
}
  return date.toLocaleDateString();
}
