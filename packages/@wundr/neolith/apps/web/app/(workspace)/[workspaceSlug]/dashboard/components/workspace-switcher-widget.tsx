'use client';

import { Building2, Check } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
  unreadCount?: number;
}

interface WorkspaceSwitcherWidgetProps {
  currentWorkspaceSlug: string;
}

export function WorkspaceSwitcherWidget({
  currentWorkspaceSlug,
}: WorkspaceSwitcherWidgetProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/workspaces');

        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }

        const data = await response.json();
        setWorkspaces(data.workspaces || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Failed to load workspaces');
        setWorkspaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  // Don't render if user only has one workspace
  if (!isLoading && workspaces.length <= 1) {
    return null;
  }

  if (isLoading) {
    return <WorkspaceSwitcherSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Workspaces</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
            <p className='font-medium'>Error loading workspaces</p>
            <p className='mt-1 text-xs'>{error}</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {workspaces.map(workspace => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isCurrent={workspace.slug === currentWorkspaceSlug}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface WorkspaceItemProps {
  workspace: Workspace;
  isCurrent: boolean;
}

function WorkspaceItem({ workspace, isCurrent }: WorkspaceItemProps) {
  const content = (
    <>
      <div className='flex items-center gap-3 flex-1 min-w-0'>
        <div className='flex-shrink-0 h-10 w-10 rounded-lg bg-muted flex items-center justify-center'>
          {workspace.avatar ? (
            <img
              src={workspace.avatar}
              alt=''
              className='h-full w-full rounded-lg object-cover'
            />
          ) : (
            <Building2 className='h-5 w-5 text-muted-foreground' />
          )}
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium truncate'>{workspace.name}</p>
            {isCurrent && (
              <Check className='h-4 w-4 text-primary flex-shrink-0' />
            )}
          </div>
          <p className='text-xs text-muted-foreground truncate'>
            /{workspace.slug}
          </p>
        </div>
      </div>
      {workspace.unreadCount && workspace.unreadCount > 0 && (
        <Badge variant='default' className='flex-shrink-0'>
          {workspace.unreadCount > 99 ? '99+' : workspace.unreadCount}
        </Badge>
      )}
    </>
  );

  if (isCurrent) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border',
          'bg-accent',
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/${workspace.slug}/dashboard`}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        'hover:bg-accent transition-colors',
      )}
    >
      {content}
    </Link>
  );
}

function WorkspaceSwitcherSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-24' />
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {[1, 2, 3].map(i => (
            <div key={i} className='flex items-center gap-3 p-3'>
              <Skeleton className='h-10 w-10 rounded-lg' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-3 w-24' />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
