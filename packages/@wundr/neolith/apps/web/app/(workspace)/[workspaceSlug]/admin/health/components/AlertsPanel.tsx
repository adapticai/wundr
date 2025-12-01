'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HealthAlert, AlertSeverity } from '@neolith/core/types';
import { useHealthAlerts as useAlerts } from '@/hooks/use-health-dashboard';
import { useToast } from '@/hooks/use-toast';
import { Check, AlertTriangle, Info, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AlertsPanelProps {
  alerts: HealthAlert[];
}

const severityIcons: Record<AlertSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: XCircle,
};

const severityColors: Record<AlertSeverity, string> = {
  info: 'text-blue-600',
  warning: 'text-yellow-600',
  critical: 'text-red-600',
};

const severityBgColors: Record<AlertSeverity, string> = {
  info: 'bg-blue-50 dark:bg-blue-950',
  warning: 'bg-yellow-50 dark:bg-yellow-950',
  critical: 'bg-red-50 dark:bg-red-950',
};

const severityVariants: Record<
  AlertSeverity,
  'default' | 'secondary' | 'destructive'
> = {
  info: 'secondary',
  warning: 'default',
  critical: 'destructive',
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const { acknowledgeAlert, isMutating: isAcknowledging } = useAlerts();
  const { toast } = useToast();

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter === 'all') return true;
    return alert.severity === severityFilter;
  });

  const unacknowledgedAlerts = filteredAlerts.filter(
    alert => !alert.acknowledged
  );
  const acknowledgedAlerts = filteredAlerts.filter(alert => alert.acknowledged);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      toast({
        title: 'Alert acknowledged',
        description: 'The alert has been marked as acknowledged.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderAlert = (alert: HealthAlert) => {
    const Icon = severityIcons[alert.severity];
    return (
      <div
        key={alert.id}
        className={`flex items-start space-x-3 rounded-lg border p-4 ${
          alert.acknowledged ? 'opacity-60' : ''
        }`}
      >
        <div className={`rounded-full p-2 ${severityBgColors[alert.severity]}`}>
          <Icon className={`h-5 w-5 ${severityColors[alert.severity]}`} />
        </div>
        <div className='flex-1 space-y-1'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Badge variant={severityVariants[alert.severity]}>
                {alert.severity}
              </Badge>
              <Badge variant='outline'>{alert.type.replace(/_/g, ' ')}</Badge>
            </div>
            <span className='text-xs text-muted-foreground'>
              {formatDistanceToNow(new Date(alert.timestamp), {
                addSuffix: true,
              })}
            </span>
          </div>
          <p className='text-sm font-medium'>{alert.message}</p>
          {alert.orchestratorId && (
            <p className='text-xs text-muted-foreground'>
              Orchestrator: {alert.orchestratorId}
            </p>
          )}
        </div>
        {!alert.acknowledged && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => handleAcknowledge(alert.id)}
            disabled={isAcknowledging}
          >
            <Check className='mr-2 h-4 w-4' />
            Acknowledge
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>
              {unacknowledgedAlerts.length} unacknowledged alert
              {unacknowledgedAlerts.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Filter by severity' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Severity</SelectItem>
              <SelectItem value='critical'>Critical</SelectItem>
              <SelectItem value='warning'>Warning</SelectItem>
              <SelectItem value='info'>Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {unacknowledgedAlerts.length > 0 && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium'>Unacknowledged</h3>
            {unacknowledgedAlerts.map(renderAlert)}
          </div>
        )}

        {acknowledgedAlerts.length > 0 && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Acknowledged
            </h3>
            {acknowledgedAlerts.map(renderAlert)}
          </div>
        )}

        {filteredAlerts.length === 0 && (
          <div className='py-8 text-center'>
            <Info className='mx-auto h-12 w-12 text-muted-foreground' />
            <p className='mt-2 text-sm text-muted-foreground'>
              No alerts found with the selected filter.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
