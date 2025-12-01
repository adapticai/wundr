'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Puzzle,
  Settings,
  Trash2,
  Power,
  PowerOff,
  ExternalLink,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface InstalledApp {
  id: string;
  name: string;
  description: string;
  icon?: string;
  status: 'active' | 'inactive' | 'error';
  permissions: string[];
  installedAt: string;
  lastUsed?: string;
  category: string;
}

/**
 * Installed Apps Admin Settings Page
 *
 * Manage workspace integrations and apps:
 * - View installed apps with status
 * - Enable/disable apps
 * - Configure app permissions
 * - Remove apps
 * - Browse more apps
 */
export default function InstalledAppsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);

  // Load installed apps
  useEffect(() => {
    const loadApps = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations`
        );
        if (!response.ok) throw new Error('Failed to load apps');
        const data = await response.json();
        setApps(data.integrations || []);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load apps',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadApps();
  }, [workspaceSlug, toast]);

  const handleToggleApp = useCallback(
    async (appId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      setProcessingAppId(appId);

      // Optimistic update
      setApps(prev =>
        prev.map(app =>
          app.id === appId
            ? { ...app, status: newStatus as 'active' | 'inactive' }
            : app
        )
      );

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations/${appId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }
        );

        if (!response.ok) throw new Error('Failed to update app status');

        toast({
          title: 'Success',
          description: `App ${newStatus === 'active' ? 'enabled' : 'disabled'}`,
        });
      } catch (error) {
        // Revert on error
        setApps(prev =>
          prev.map(app =>
            app.id === appId
              ? { ...app, status: currentStatus as 'active' | 'inactive' }
              : app
          )
        );

        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update app',
          variant: 'destructive',
        });
      } finally {
        setProcessingAppId(null);
      }
    },
    [workspaceSlug, toast]
  );

  const handleRemoveApp = useCallback(
    async (appId: string, appName: string) => {
      if (
        !confirm(
          `Are you sure you want to remove ${appName}? This action cannot be undone.`
        )
      ) {
        return;
      }

      setProcessingAppId(appId);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations/${appId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) throw new Error('Failed to remove app');

        setApps(prev => prev.filter(app => app.id !== appId));

        toast({
          title: 'Success',
          description: `${appName} has been removed`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to remove app',
          variant: 'destructive',
        });
      } finally {
        setProcessingAppId(null);
      }
    },
    [workspaceSlug, toast]
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const activeApps = apps.filter(app => app.status === 'active');
  const inactiveApps = apps.filter(app => app.status === 'inactive');
  const errorApps = apps.filter(app => app.status === 'error');

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Installed Apps</h1>
          <p className='mt-1 text-muted-foreground'>
            Manage integrations and apps for your workspace
          </p>
        </div>
        <Link href={`/${workspaceSlug}/admin/settings/apps/browse`}>
          <Button>
            <Puzzle className='h-4 w-4 mr-2' />
            Browse Apps
          </Button>
        </Link>
      </div>

      {/* Summary */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Active Apps
                </p>
                <p className='text-2xl font-bold'>{activeApps.length}</p>
              </div>
              <Power className='h-8 w-8 text-green-500' />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Inactive Apps
                </p>
                <p className='text-2xl font-bold'>{inactiveApps.length}</p>
              </div>
              <PowerOff className='h-8 w-8 text-muted-foreground' />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Total Installed
                </p>
                <p className='text-2xl font-bold'>{apps.length}</p>
              </div>
              <Puzzle className='h-8 w-8 text-primary' />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Apps Alert */}
      {errorApps.length > 0 && (
        <Card className='border-red-500/50 bg-red-50 dark:bg-red-900/10'>
          <CardContent className='pt-6'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5' />
              <div>
                <p className='font-medium text-red-800 dark:text-red-200'>
                  {errorApps.length} app{errorApps.length > 1 ? 's' : ''} need
                  attention
                </p>
                <p className='mt-1 text-sm text-red-700 dark:text-red-300'>
                  Some apps are experiencing errors and may not function
                  properly. Check the apps below for details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Installed Apps List */}
      {apps.length === 0 ? (
        <Card>
          <CardContent className='py-12'>
            <div className='text-center'>
              <Puzzle className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No apps installed</h3>
              <p className='text-sm text-muted-foreground mb-6'>
                Browse our app directory to find integrations that enhance your
                workspace
              </p>
              <Link href={`/${workspaceSlug}/admin/settings/apps/browse`}>
                <Button>
                  <Puzzle className='h-4 w-4 mr-2' />
                  Browse Apps
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {apps.map(app => (
            <Card
              key={app.id}
              className={cn(app.status === 'error' && 'border-red-500/50')}
            >
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex items-start gap-3 flex-1'>
                    <div className='h-10 w-10 rounded-lg border bg-muted flex items-center justify-center flex-shrink-0'>
                      {app.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.icon}
                          alt={app.name}
                          className='h-6 w-6'
                        />
                      ) : (
                        <Puzzle className='h-5 w-5 text-muted-foreground' />
                      )}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <CardTitle className='text-base truncate'>
                          {app.name}
                        </CardTitle>
                        <Badge
                          variant={
                            app.status === 'active'
                              ? 'default'
                              : app.status === 'error'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <CardDescription className='mt-1 line-clamp-2'>
                        {app.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Permissions */}
                <div>
                  <div className='flex items-center gap-2 mb-2'>
                    <Shield className='h-4 w-4 text-muted-foreground' />
                    <p className='text-sm font-medium'>Permissions</p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {app.permissions.slice(0, 3).map(permission => (
                      <Badge
                        key={permission}
                        variant='outline'
                        className='text-xs'
                      >
                        {permission}
                      </Badge>
                    ))}
                    {app.permissions.length > 3 && (
                      <Badge variant='outline' className='text-xs'>
                        +{app.permissions.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className='flex items-center gap-4 text-xs text-muted-foreground border-t pt-3'>
                  <span>
                    Installed {new Date(app.installedAt).toLocaleDateString()}
                  </span>
                  {app.lastUsed && (
                    <span>
                      Last used {new Date(app.lastUsed).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className='flex items-center gap-2 border-t pt-4'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleToggleApp(app.id, app.status)}
                    disabled={
                      processingAppId === app.id || app.status === 'error'
                    }
                    className='flex-1'
                  >
                    {processingAppId === app.id ? (
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    ) : app.status === 'active' ? (
                      <PowerOff className='h-4 w-4 mr-2' />
                    ) : (
                      <Power className='h-4 w-4 mr-2' />
                    )}
                    {app.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <Link
                      href={`/${workspaceSlug}/admin/settings/apps/${app.id}`}
                    >
                      <Settings className='h-4 w-4 mr-2' />
                      Configure
                    </Link>
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleRemoveApp(app.id, app.name)}
                    disabled={processingAppId === app.id}
                  >
                    {processingAppId === app.id ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Trash2 className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ExternalLink className='h-5 w-5' />
            Need Help?
          </CardTitle>
          <CardDescription>
            Learn more about managing apps and integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <Link
              href='https://docs.wundr.ai/apps/overview'
              target='_blank'
              rel='noopener noreferrer'
              className='block text-sm text-primary hover:underline'
            >
              Apps documentation
            </Link>
            <Link
              href='https://docs.wundr.ai/apps/permissions'
              target='_blank'
              rel='noopener noreferrer'
              className='block text-sm text-primary hover:underline'
            >
              Understanding app permissions
            </Link>
            <Link
              href='https://docs.wundr.ai/apps/troubleshooting'
              target='_blank'
              rel='noopener noreferrer'
              className='block text-sm text-primary hover:underline'
            >
              Troubleshooting app issues
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <div className='h-8 w-48 animate-pulse rounded bg-muted' />
          <div className='h-4 w-96 animate-pulse rounded bg-muted' />
        </div>
        <div className='h-10 w-32 animate-pulse rounded bg-muted' />
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className='pt-6'>
              <div className='h-16 w-full animate-pulse rounded bg-muted' />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className='h-20 w-full animate-pulse rounded bg-muted' />
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <div className='h-10 w-full animate-pulse rounded bg-muted' />
                <div className='h-10 w-full animate-pulse rounded bg-muted' />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
