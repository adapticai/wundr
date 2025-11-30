'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  CalendarIcon,
  GlobeIcon,
  MonitorIcon,
  ShieldAlertIcon,
  UserIcon,
  FileIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  actor: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  action: string;
  actionType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SECURITY';
  resource?: {
    id: string;
    type: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AuditLogEntryProps {
  event: AuditEvent;
  compact?: boolean;
}

const severityConfig = {
  info: {
    color: 'bg-blue-500',
    label: 'Info',
    icon: ShieldAlertIcon,
  },
  warning: {
    color: 'bg-yellow-500',
    label: 'Warning',
    icon: ShieldAlertIcon,
  },
  error: {
    color: 'bg-orange-500',
    label: 'Error',
    icon: ShieldAlertIcon,
  },
  critical: {
    color: 'bg-red-500',
    label: 'Critical',
    icon: ShieldAlertIcon,
  },
};

export function AuditLogEntry({ event, compact = false }: AuditLogEntryProps) {
  const [metadataOpen, setMetadataOpen] = React.useState(false);

  const severityInfo = severityConfig[event.severity];
  const SeverityIcon = severityInfo.icon;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMetadata = (metadata: Record<string, unknown>, indent = 0): React.ReactNode => {
    return (
      <div className="space-y-1">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} style={{ paddingLeft: `${indent * 16}px` }}>
            <span className="font-medium text-foreground">{key}:</span>{' '}
            {typeof value === 'object' && value !== null ? (
              <div className="ml-4 mt-1 border-l-2 border-muted pl-2">
                {formatMetadata(value as Record<string, unknown>, indent + 1)}
              </div>
            ) : (
              <span className="text-muted-foreground">
                {value === null ? 'null' : String(value)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <div className={cn('h-2 w-2 rounded-full mt-2', severityInfo.color)} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={event.actor.avatar} alt={event.actor.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(event.actor.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{event.actor.name}</span>
              <Badge variant="outline" className="text-xs">
                {event.actionType}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(event.timestamp, 'MMM dd, HH:mm')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{event.action}</p>
          {event.resource && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileIcon className="h-3 w-3" />
              <span>
                {event.resource.type}: {event.resource.name || event.resource.id}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header with severity indicator */}
          <div className="flex items-start gap-4">
            <div className={cn('rounded-full p-2', severityInfo.color)}>
              <SeverityIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{event.action}</h3>
                <Badge
                  variant={
                    event.severity === 'critical' || event.severity === 'error'
                      ? 'destructive'
                      : event.severity === 'warning'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {severityInfo.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Event ID: {event.id}</p>
            </div>
          </div>

          <Separator />

          {/* Actor information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span>Actor</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={event.actor.avatar} alt={event.actor.name} />
                <AvatarFallback>{getInitials(event.actor.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{event.actor.name}</p>
                {event.actor.email && (
                  <p className="text-sm text-muted-foreground">{event.actor.email}</p>
                )}
                <p className="text-xs text-muted-foreground">ID: {event.actor.id}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Event details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>Timestamp</span>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 font-mono text-sm">
                {format(event.timestamp, 'PPpp')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Badge variant="outline">{event.actionType}</Badge>
                <span>Action Type</span>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-sm">{event.action}</p>
            </div>
          </div>

          {/* Resource information */}
          {event.resource && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <span>Resource</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{event.resource.type}</Badge>
                    {event.resource.name && (
                      <span className="font-medium">{event.resource.name}</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    ID: {event.resource.id}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Network information */}
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            {event.ipAddress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                  <span>IP Address</span>
                </div>
                <p className="rounded-lg bg-muted/50 p-3 font-mono text-sm">
                  {event.ipAddress}
                </p>
              </div>
            )}

            {event.userAgent && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MonitorIcon className="h-4 w-4 text-muted-foreground" />
                  <span>User Agent</span>
                </div>
                <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground break-all">
                  {event.userAgent}
                </p>
              </div>
            )}
          </div>

          {/* Metadata */}
          {Object.keys(event.metadata).length > 0 && (
            <>
              <Separator />
              <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                    <span className="text-sm font-medium">Metadata</span>
                    {metadataOpen ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 rounded-lg bg-muted/50 p-4">
                    <pre className="overflow-x-auto text-xs font-mono">
                      {formatMetadata(event.metadata)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
