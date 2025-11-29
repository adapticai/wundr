'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Settings, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityEntry {
  id: string;
  type: 'message' | 'config' | 'assignment' | 'error';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface OrchestratorActivityProps {
  orchestratorId: string;
  activities?: ActivityEntry[];
  className?: string;
}

const activityIcons = {
  message: MessageSquare,
  config: Settings,
  assignment: Users,
  error: AlertCircle,
};

const activityColors = {
  message: 'text-blue-600',
  config: 'text-purple-600',
  assignment: 'text-green-600',
  error: 'text-red-600',
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function OrchestratorActivity({
  activities = [],
  className,
}: OrchestratorActivityProps) {
  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type];
              const iconColor = activityColors[activity.type];

              return (
                <div key={activity.id} className="flex gap-3 border-b pb-4 last:border-0">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0',
                      iconColor
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {activity.type}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
