'use client';

import * as React from 'react';
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
  RefreshCw,
  FileText,
  Package,
  TestTube,
  Zap,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void | Promise<void>;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  disabled?: boolean;
  badge?: string;
}

export function QuickActions() {
  const [isRunning, setIsRunning] = React.useState<{ [key: string]: boolean }>(
    {}
  );
  const { toast } = useToast();

  const handleAction = async (
    key: string,
    action: () => void | Promise<void>
  ) => {
    setIsRunning(prev => ({ ...prev, [key]: true }));

    try {
      await action();
      // Simulate async action
      setTimeout(() => {
        setIsRunning(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error('Action failed:', error);
      setIsRunning(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRunTests = () => {
    toast({
      title: 'Test run triggered',
      description:
        'Running 1,247 tests across all suites. Results will appear in your CI pipeline.',
    });
  };

  const handleBuildProject = () => {
    toast({
      title: 'Build triggered',
      description:
        'Building 12 packages. Monitor progress in your CI/CD pipeline dashboard.',
    });
  };

  const handleUpdateDependencies = () => {
    toast({
      title: '3 updates available',
      description:
        'Run `pnpm update` in your terminal to apply pending dependency updates.',
    });
  };

  const handleGenerateReport = () => {
    try {
      const reportData = {
        generated: new Date().toISOString(),
        summary: {
          totalTests: 1247,
          packages: 12,
          pendingUpdates: 3,
        },
      };
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Report downloaded',
        description: 'Analytics report saved as a JSON file.',
      });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Could not generate the report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeployPreview = () => {
    toast({
      title: 'Deploy preview not configured',
      description:
        'Set a DEPLOY_PREVIEW_WEBHOOK environment variable to enable one-click staging deploys.',
    });
  };

  const handleOpenTerminal = () => {
    toast({
      title: 'Terminal unavailable',
      description:
        'The integrated terminal is not available in the web dashboard. Use your local terminal instead.',
    });
  };

  const actions: QuickAction[] = [
    {
      title: 'Run Tests',
      description: 'Execute all test suites',
      icon: TestTube,
      action: handleRunTests,
      badge: '1,247 tests',
    },
    {
      title: 'Build Project',
      description: 'Build all packages',
      icon: Package,
      action: handleBuildProject,
      badge: '12 packages',
    },
    {
      title: 'Update Dependencies',
      description: 'Check for package updates',
      icon: RefreshCw,
      action: handleUpdateDependencies,
      badge: '3 updates available',
    },
    {
      title: 'Generate Report',
      description: 'Create analytics report',
      icon: FileText,
      action: handleGenerateReport,
      variant: 'outline' as const,
    },
    {
      title: 'Deploy Preview',
      description: 'Deploy to staging environment',
      icon: Zap,
      action: handleDeployPreview,
      variant: 'secondary' as const,
    },
    {
      title: 'Open Terminal',
      description: 'Launch integrated terminal',
      icon: Terminal,
      action: handleOpenTerminal,
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common development tasks and shortcuts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
          {actions.map((actionItem, index) => {
            const key = `action-${index}`;
            const running = isRunning[key];
            const IconComponent = actionItem.icon;

            return (
              <Button
                key={key}
                variant={actionItem.variant || 'default'}
                className={cn(
                  'h-auto p-4 flex flex-col items-start text-left space-y-2',
                  running && 'opacity-50 cursor-not-allowed'
                )}
                disabled={actionItem.disabled || running}
                onClick={() => handleAction(key, actionItem.action)}
              >
                <div className='flex items-center justify-between w-full'>
                  <IconComponent
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      running && 'animate-spin'
                    )}
                  />
                  {actionItem.badge && (
                    <Badge variant='secondary' className='text-xs'>
                      {actionItem.badge}
                    </Badge>
                  )}
                </div>
                <div className='space-y-1'>
                  <div className='font-medium text-sm'>{actionItem.title}</div>
                  <div className='text-xs text-muted-foreground'>
                    {actionItem.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
