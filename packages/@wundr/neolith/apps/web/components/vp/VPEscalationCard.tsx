'use client';

import { AlertTriangle, ArrowRight, Clock, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { VP } from '@/types/vp';

interface EscalationReason {
  type: 'blocked' | 'unclear' | 'permission' | 'complexity' | 'other';
  description: string;
}

interface BlockedTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  blockedSince: Date;
  estimatedImpact: string;
}

interface VPEscalation {
  id: string;
  vp: VP;
  task: BlockedTask;
  reason: EscalationReason;
  vpReasoning: string;
  suggestedActions?: string[];
  escalatedAt: Date;
  status: 'pending' | 'assigned' | 'resolved';
}

interface VPEscalationCardProps {
  escalation: VPEscalation;
  workspaceId?: string;
  onAssign?: (escalationId: string, userId: string) => void;
  onResolve?: (escalationId: string, resolution: string) => void;
  onRespond?: (escalationId: string, response: string) => void;
  className?: string;
}

const reasonConfig = {
  blocked: {
    label: 'Blocked by Dependency',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  unclear: {
    label: 'Unclear Requirements',
    icon: MessageSquare,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  permission: {
    label: 'Requires Permission',
    icon: User,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  complexity: {
    label: 'Exceeds Capability',
    icon: AlertTriangle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  other: {
    label: 'Other Issue',
    icon: AlertTriangle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};

const priorityConfig = {
  low: { color: 'text-gray-700', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' },
  medium: { color: 'text-blue-700', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
  urgent: { color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
};

export function VPEscalationCard({
  escalation,
  workspaceId,
  onAssign,
  onResolve,
  onRespond,
  className,
}: VPEscalationCardProps) {
  const reasonCfg = reasonConfig[escalation.reason.type];
  const priorityCfg = priorityConfig[escalation.task.priority];
  const ReasonIcon = reasonCfg.icon;

  const vpInitials = escalation.vp.title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className={cn('overflow-hidden border-orange-200 bg-orange-50/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={escalation.vp.avatarUrl || undefined}
                  alt={escalation.vp.title}
                />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {vpInitials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 rounded-full bg-orange-500 p-1">
                <AlertTriangle className="h-3 w-3 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Escalation Request</CardTitle>
                {escalation.status === 'pending' && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    Pending
                  </Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-2 text-xs">
                <span>From {escalation.vp.title}</span>
                <span>•</span>
                <span>{formatRelativeTime(escalation.escalatedAt)}</span>
              </CardDescription>
            </div>
          </div>

          <Badge
            variant="secondary"
            className={cn(
              'capitalize',
              priorityCfg.color,
              priorityCfg.bgColor,
            )}
          >
            {escalation.task.priority}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Escalation Reason */}
        <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
          <div className={cn('mt-0.5 rounded-full p-2', reasonCfg.bgColor)}>
            <ReasonIcon className={cn('h-4 w-4', reasonCfg.color)} />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{reasonCfg.label}</p>
            <p className="text-sm text-muted-foreground">
              {escalation.reason.description}
            </p>
          </div>
        </div>

        {/* Blocked Task Details */}
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Blocked Task</p>
              <h4 className="font-semibold leading-tight">{escalation.task.title}</h4>
            </div>
            {workspaceId && (
              <Link
                href={`/${workspaceId}/tasks/${escalation.task.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                View
              </Link>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {escalation.task.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Blocked {formatRelativeTime(escalation.task.blockedSince)}</span>
            </div>
            {escalation.task.estimatedImpact && (
              <>
                <span>•</span>
                <span>Impact: {escalation.task.estimatedImpact}</span>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* VP's Reasoning */}
        <div className="space-y-2">
          <p className="text-sm font-medium">VP Analysis</p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {escalation.vpReasoning}
          </div>
        </div>

        {/* Suggested Actions */}
        {escalation.suggestedActions && escalation.suggestedActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Suggested Actions</p>
            <ul className="space-y-1.5">
              {escalation.suggestedActions.map((action, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {onAssign && escalation.status === 'pending' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onAssign(escalation.id, 'current-user-id')}
            >
              <User className="mr-2 h-4 w-4" />
              Assign to Me
            </Button>
          )}

          {onResolve && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const resolution = prompt('Enter resolution details:');
                if (resolution) {
                  onResolve(escalation.id, resolution);
                }
              }}
            >
              Mark as Resolved
            </Button>
          )}

          {onRespond && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const response = prompt('Enter your response:');
                if (response) {
                  onRespond(escalation.id, response);
                }
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Respond to VP
            </Button>
          )}

          {workspaceId && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${workspaceId}/escalations/${escalation.id}`}>
                View Full Details
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact list item version for escalation lists
interface VPEscalationListItemProps {
  escalation: VPEscalation;
  workspaceId?: string;
  onClick?: () => void;
  className?: string;
}

export function VPEscalationListItem({
  escalation,
  onClick,
  className,
}: VPEscalationListItemProps) {
  const reasonCfg = reasonConfig[escalation.reason.type];
  const priorityCfg = priorityConfig[escalation.task.priority];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-full p-2', reasonCfg.bgColor)}>
          <AlertTriangle className={cn('h-4 w-4', reasonCfg.color)} />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-tight">{escalation.task.title}</p>
            <Badge
              variant="secondary"
              className={cn('text-xs', priorityCfg.color, priorityCfg.bgColor)}
            >
              {escalation.task.priority}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-1">
            {escalation.reason.description}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{escalation.vp.title}</span>
            <span>•</span>
            <span>{formatRelativeTime(escalation.escalatedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
return 'just now';
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
