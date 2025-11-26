'use client';

import { Bot, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import type { VP } from '@/types/vp';

interface VPTask {
  id: string;
  title: string;
  progress: number;
  estimatedMinutes: number;
}

interface VPPresenceTooltipProps {
  vp: VP;
  currentTask?: VPTask | null;
  children: React.ReactNode;
  workspaceId?: string;
  className?: string;
}

export function VPPresenceTooltip({
  vp,
  currentTask,
  children,
  workspaceId,
  className,
}: VPPresenceTooltipProps) {
  const hasTask = currentTask !== null && currentTask !== undefined;
  const initials = vp.title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className={cn('w-80', className)} align="start">
        <div className="space-y-3">
          {/* VP Header */}
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={vp.avatarUrl || undefined} alt={vp.title} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1">
                <Bot className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-semibold leading-none">{vp.title}</h4>
              {vp.discipline && (
                <p className="text-xs text-muted-foreground">{vp.discipline}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'inline-flex h-2 w-2 rounded-full',
                    vp.status === 'ONLINE' && 'bg-green-500',
                    vp.status === 'BUSY' && 'bg-yellow-500',
                    vp.status === 'AWAY' && 'bg-orange-500',
                    vp.status === 'OFFLINE' && 'bg-gray-400',
                  )}
                />
                <span className="capitalize">{vp.status.toLowerCase()}</span>
              </div>
            </div>
          </div>

          {/* Current Task or Idle State */}
          {hasTask ? (
            <div className="space-y-2 rounded-md border bg-muted/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Current Task
                  </p>
                  <p className="text-sm font-medium leading-tight">
                    {currentTask.title}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{currentTask.progress}%</span>
                </div>
                <Progress value={currentTask.progress} className="h-1.5" />
              </div>

              {/* Estimated Time */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {currentTask.estimatedMinutes < 60
                    ? `~${currentTask.estimatedMinutes}m remaining`
                    : `~${Math.round(currentTask.estimatedMinutes / 60)}h remaining`}
                </span>
              </div>

              {/* Link to Task */}
              {workspaceId && (
                <Link
                  href={`/${workspaceId}/tasks/${currentTask.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View task details
                  <TrendingUp className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-1 rounded-md border border-dashed bg-muted/30 p-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                No active task
              </p>
              <p className="text-xs text-muted-foreground">
                {vp.status === 'ONLINE' ? 'Ready for assignment' : 'Currently unavailable'}
              </p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="flex items-center justify-between border-t pt-2 text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Messages</span>
              <span className="font-medium">{vp.messageCount.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Tasks</span>
              <span className="font-medium">{vp.agentCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Last Active</span>
              <span className="font-medium">
                {vp.lastActivityAt ? formatRelativeTime(new Date(vp.lastActivityAt)) : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Utility function to format relative time
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
