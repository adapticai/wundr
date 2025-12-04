'use client';

import {
  AlertCircle,
  AlertTriangle,
  Info,
  Settings,
  Check,
  X,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface BudgetAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  threshold?: number;
  currentValue?: number;
}

export interface AlertThresholds {
  warningThreshold: number;
  criticalThreshold: number;
}

export interface BudgetAlertsProps {
  alerts: BudgetAlert[];
  thresholds: AlertThresholds;
  className?: string;
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onUpdateThresholds?: (thresholds: AlertThresholds) => void;
}

const severityConfig = {
  info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    badge: 'default',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    badge: 'default',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    badge: 'destructive',
  },
} as const;

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
};

export function BudgetAlerts({
  alerts,
  thresholds,
  className,
  onAcknowledge,
  onDismiss,
  onUpdateThresholds,
}: BudgetAlertsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [localThresholds, setLocalThresholds] = React.useState(thresholds);

  const sortedAlerts = React.useMemo(() => {
    return [...alerts].sort((a, b) => {
      // Sort by severity (critical > warning > info)
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // Then by acknowledged status
      if (a.acknowledged !== b.acknowledged) {
        return a.acknowledged ? 1 : -1;
      }

      // Then by timestamp (newest first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [alerts]);

  const activeAlerts = sortedAlerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = sortedAlerts.filter(alert => alert.acknowledged);

  const handleSaveThresholds = () => {
    onUpdateThresholds?.(localThresholds);
    setIsSettingsOpen(false);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              Budget Alerts
              {activeAlerts.length > 0 && (
                <Badge variant='destructive' className='ml-2'>
                  {activeAlerts.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Monitor and manage token budget alerts
            </CardDescription>
          </div>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm'>
                <Settings className='h-4 w-4 mr-2' />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alert Threshold Configuration</DialogTitle>
                <DialogDescription>
                  Set percentage thresholds for warning and critical alerts
                </DialogDescription>
              </DialogHeader>
              <div className='space-y-4 py-4'>
                <div className='space-y-2'>
                  <Label htmlFor='warning-threshold'>
                    Warning Threshold (%)
                  </Label>
                  <Input
                    id='warning-threshold'
                    type='number'
                    min='0'
                    max='100'
                    value={localThresholds.warningThreshold}
                    onChange={e =>
                      setLocalThresholds(prev => ({
                        ...prev,
                        warningThreshold: Number(e.target.value),
                      }))
                    }
                  />
                  <p className='text-xs text-muted-foreground'>
                    Trigger a warning when usage exceeds this percentage
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='critical-threshold'>
                    Critical Threshold (%)
                  </Label>
                  <Input
                    id='critical-threshold'
                    type='number'
                    min='0'
                    max='100'
                    value={localThresholds.criticalThreshold}
                    onChange={e =>
                      setLocalThresholds(prev => ({
                        ...prev,
                        criticalThreshold: Number(e.target.value),
                      }))
                    }
                  />
                  <p className='text-xs text-muted-foreground'>
                    Trigger a critical alert when usage exceeds this percentage
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant='outline'
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveThresholds}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>Active Alerts</h3>
              <div className='space-y-2'>
                {activeAlerts.map(alert => {
                  const config = severityConfig[alert.severity];
                  const Icon = config.icon;

                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border',
                        config.bgColor,
                        config.borderColor
                      )}
                    >
                      <Icon className={cn('h-5 w-5 mt-0.5', config.color)} />
                      <div className='flex-1 space-y-1'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium'>
                              {alert.message}
                            </p>
                            {alert.threshold && alert.currentValue && (
                              <p className='text-xs text-muted-foreground mt-1'>
                                Current: {alert.currentValue.toFixed(1)}% /
                                Threshold: {alert.threshold}%
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={config.badge as any}
                            className='shrink-0'
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>
                            {formatRelativeTime(alert.timestamp)}
                          </span>
                          <div className='flex gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => onAcknowledge?.(alert.id)}
                            >
                              <Check className='h-4 w-4 mr-1' />
                              Acknowledge
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => onDismiss?.(alert.id)}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acknowledged Alerts */}
          {acknowledgedAlerts.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Acknowledged ({acknowledgedAlerts.length})
              </h3>
              <div className='space-y-2'>
                {acknowledgedAlerts.slice(0, 3).map(alert => {
                  const config = severityConfig[alert.severity];
                  const Icon = config.icon;

                  return (
                    <div
                      key={alert.id}
                      className='flex items-start gap-3 p-3 rounded-lg border border-muted bg-muted/30 opacity-60'
                    >
                      <Icon className={cn('h-4 w-4 mt-0.5', config.color)} />
                      <div className='flex-1 space-y-1'>
                        <p className='text-sm'>{alert.message}</p>
                        <span className='text-xs text-muted-foreground'>
                          {formatRelativeTime(alert.timestamp)}
                        </span>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => onDismiss?.(alert.id)}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {alerts.length === 0 && (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Info className='h-12 w-12 text-muted-foreground mb-3' />
              <p className='text-sm font-medium'>No alerts</p>
              <p className='text-xs text-muted-foreground mt-1'>
                Your token usage is within configured thresholds
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
