'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  orchestratorId?: string;
  orchestratorName?: string;
  acknowledged: boolean;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  className?: string;
}

interface AlertItemProps {
  alert: Alert;
  onAcknowledge?: (alertId: string) => void;
}

const SeverityBadge: React.FC<{ severity: AlertSeverity }> = ({ severity }) => {
  const variants = {
    critical: {
      variant: 'destructive' as const,
      icon: XCircle,
      label: 'Critical',
    },
    warning: {
      variant: 'outline' as const,
      icon: AlertCircle,
      label: 'Warning',
      className: 'border-yellow-500 text-yellow-700 bg-yellow-50',
    },
    info: {
      variant: 'secondary' as const,
      icon: Info,
      label: 'Info',
    },
  };

  const config = variants[severity];
  const { variant, icon: Icon, label } = config;
  const className = 'className' in config ? config.className : undefined;

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className='h-3 w-3' />
      {label}
    </Badge>
  );
};

const AlertItem: React.FC<AlertItemProps> = ({ alert, onAcknowledge }) => {
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const handleAcknowledge = () => {
    onAcknowledge?.(alert.id);
    setShowConfirmDialog(false);
  };

  const formatTimestamp = (timestamp: string) => {
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

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'critical':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'info':
        return 'border-l-blue-500';
    }
  };

  return (
    <>
      <div
        className={cn(
          'flex items-start gap-4 p-4 border-l-4 rounded-lg bg-card hover:bg-muted/50 transition-colors',
          getSeverityColor(),
          alert.acknowledged && 'opacity-60'
        )}
      >
        <div className='flex-1 space-y-2'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <SeverityBadge severity={alert.severity} />
              {alert.acknowledged && (
                <Badge variant='outline' className='gap-1'>
                  <CheckCircle2 className='h-3 w-3' />
                  Acknowledged
                </Badge>
              )}
            </div>
            <span className='text-xs text-muted-foreground whitespace-nowrap'>
              {formatTimestamp(alert.timestamp)}
            </span>
          </div>
          <p className='text-sm'>{alert.message}</p>
          {alert.orchestratorName && (
            <p className='text-xs text-muted-foreground'>
              Orchestrator: {alert.orchestratorName}
            </p>
          )}
        </div>
        {!alert.acknowledged && onAcknowledge && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => setShowConfirmDialog(true)}
          >
            Acknowledge
          </Button>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to acknowledge this alert? This action will
              mark the alert as reviewed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcknowledge}>
              Acknowledge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onAcknowledge,
  className,
}) => {
  const [selectedSeverity, setSelectedSeverity] = React.useState<
    AlertSeverity | 'all'
  >('all');

  const filteredAlerts = React.useMemo(() => {
    if (selectedSeverity === 'all') return alerts;
    return alerts.filter(alert => alert.severity === selectedSeverity);
  }, [alerts, selectedSeverity]);

  const alertCounts = React.useMemo(() => {
    return {
      all: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    };
  }, [alerts]);

  const FilterButton: React.FC<{
    severity: AlertSeverity | 'all';
    label: string;
    count: number;
  }> = ({ severity, label, count }) => (
    <button
      onClick={() => setSelectedSeverity(severity)}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        selectedSeverity === severity
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      )}
    >
      {label} ({count})
    </button>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>System Alerts</CardTitle>
          <div className='flex gap-2'>
            <FilterButton severity='all' label='All' count={alertCounts.all} />
            <FilterButton
              severity='critical'
              label='Critical'
              count={alertCounts.critical}
            />
            <FilterButton
              severity='warning'
              label='Warning'
              count={alertCounts.warning}
            />
            <FilterButton
              severity='info'
              label='Info'
              count={alertCounts.info}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {filteredAlerts.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Info className='h-12 w-12 mx-auto mb-2 opacity-50' />
              <p>No alerts to display</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={onAcknowledge}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

AlertsPanel.displayName = 'AlertsPanel';
