'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrchestratorStatusBadge } from './orchestrator-status';
import { MessageSquare, Clock, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Orchestrator } from '@/types/orchestrator';

interface OrchestratorCardProps {
  orchestrator: Orchestrator;
  workspaceSlug: string;
  onConfigure?: (id: string) => void;
  className?: string;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
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

export function OrchestratorCardAdmin({
  orchestrator,
  workspaceSlug,
  onConfigure,
  className,
}: OrchestratorCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-lg'>
              {orchestrator.avatarUrl ? (
                <img
                  src={orchestrator.avatarUrl}
                  alt={orchestrator.title}
                  className='h-full w-full rounded-lg object-cover'
                />
              ) : (
                orchestrator.title.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h3 className='font-semibold text-lg'>{orchestrator.title}</h3>
              {orchestrator.discipline && (
                <p className='text-sm text-muted-foreground'>
                  {orchestrator.discipline}
                </p>
              )}
            </div>
          </div>
          <OrchestratorStatusBadge status={orchestrator.status} size='sm' />
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {orchestrator.description && (
          <p className='text-sm text-muted-foreground line-clamp-2'>
            {orchestrator.description}
          </p>
        )}

        <div className='flex items-center gap-4 text-sm text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <MessageSquare className='h-4 w-4' />
            {orchestrator.messageCount} messages
          </span>
          <span className='flex items-center gap-1'>
            <Clock className='h-4 w-4' />
            {formatRelativeTime(orchestrator.lastActivityAt)}
          </span>
        </div>

        <div className='flex gap-2 pt-2'>
          <Button variant='outline' size='sm' asChild className='flex-1'>
            <Link
              href={`/${workspaceSlug}/admin/orchestrators/${orchestrator.id}`}
            >
              View Details
            </Link>
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onConfigure?.(orchestrator.id)}
          >
            <Settings className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
