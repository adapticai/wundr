'use client';

import {
  Activity,
  Clock,
  Cpu,
  MemoryStick,
  MoreHorizontal,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DaemonNodeStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'MAINTENANCE';

export interface DaemonNodeHealth {
  cpuUsage: number;
  memoryUsage: number;
  activeSessions: number;
  uptimeMs?: number | null;
}

export interface DaemonNodeCardProps {
  id: string;
  name: string;
  hostname: string;
  port: number;
  status: DaemonNodeStatus;
  capabilities: string[];
  region: string;
  orchestratorIds: string[];
  health: DaemonNodeHealth;
  lastHeartbeat: string | null;
  onCheckHealth?: (id: string) => void;
  onDeregister?: (id: string) => void;
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DaemonNodeStatus,
  {
    label: string;
    dot: string;
    badge: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  ONLINE: { label: 'Online', dot: 'bg-green-500', badge: 'default' },
  OFFLINE: { label: 'Offline', dot: 'bg-gray-400', badge: 'secondary' },
  DEGRADED: { label: 'Degraded', dot: 'bg-yellow-500', badge: 'outline' },
  MAINTENANCE: { label: 'Maintenance', dot: 'bg-blue-400', badge: 'secondary' },
};

function formatHeartbeat(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function MetricBar({ value, label }: { value: number; label: string }) {
  const color =
    value < 50 ? 'bg-green-500' : value < 80 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span>{label}</span>
        <span className='font-medium text-foreground'>{value.toFixed(1)}%</span>
      </div>
      <div className='h-1.5 w-full rounded-full bg-muted'>
        <div
          className={cn('h-1.5 rounded-full transition-all', color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DaemonNodeCard({
  id,
  name,
  hostname,
  port,
  status,
  capabilities,
  region,
  orchestratorIds,
  health,
  lastHeartbeat,
  onCheckHealth,
  onDeregister,
  className,
}: DaemonNodeCardProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.OFFLINE;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-3'>
        <div className='flex items-start gap-3'>
          {/* Status indicator dot */}
          <div className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted'>
            <Server className='h-4 w-4 text-muted-foreground' />
          </div>

          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <h3 className='truncate text-sm font-semibold text-foreground'>
                {name}
              </h3>
              <span
                className={cn(
                  'inline-block h-2 w-2 shrink-0 rounded-full',
                  cfg.dot
                )}
                aria-label={cfg.label}
              />
            </div>
            <p className='mt-0.5 truncate font-mono text-xs text-muted-foreground'>
              {hostname}:{port}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Badge variant={cfg.badge} className='shrink-0 text-xs'>
            {cfg.label}
          </Badge>
          {(onCheckHealth ?? onDeregister) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-7 w-7'>
                  <MoreHorizontal className='h-4 w-4' />
                  <span className='sr-only'>Node actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {onCheckHealth && (
                  <DropdownMenuItem onClick={() => onCheckHealth(id)}>
                    <Wifi className='mr-2 h-4 w-4' />
                    Check health
                  </DropdownMenuItem>
                )}
                {onDeregister && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className='text-destructive focus:text-destructive'
                      onClick={() => onDeregister(id)}
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Deregister node
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Health metrics */}
        <div className='space-y-2'>
          <MetricBar value={health.cpuUsage} label='CPU' />
          <MetricBar value={health.memoryUsage} label='Memory' />
        </div>

        {/* Stats row */}
        <div className='grid grid-cols-3 gap-2'>
          <div className='rounded-md bg-muted p-2 text-center'>
            <Activity className='mx-auto mb-0.5 h-3.5 w-3.5 text-muted-foreground' />
            <p className='text-xs font-semibold text-foreground'>
              {health.activeSessions}
            </p>
            <p className='text-xs text-muted-foreground'>Sessions</p>
          </div>
          <div className='rounded-md bg-muted p-2 text-center'>
            <Server className='mx-auto mb-0.5 h-3.5 w-3.5 text-muted-foreground' />
            <p className='text-xs font-semibold text-foreground'>
              {orchestratorIds.length}
            </p>
            <p className='text-xs text-muted-foreground'>Orchs</p>
          </div>
          <div className='rounded-md bg-muted p-2 text-center'>
            {status === 'ONLINE' ? (
              <Wifi className='mx-auto mb-0.5 h-3.5 w-3.5 text-green-500' />
            ) : (
              <WifiOff className='mx-auto mb-0.5 h-3.5 w-3.5 text-muted-foreground' />
            )}
            <p className='text-xs font-semibold text-foreground truncate'>
              {region}
            </p>
            <p className='text-xs text-muted-foreground'>Region</p>
          </div>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {capabilities.slice(0, 4).map(cap => (
              <Badge key={cap} variant='secondary' className='text-xs'>
                {cap}
              </Badge>
            ))}
            {capabilities.length > 4 && (
              <Badge variant='secondary' className='text-xs'>
                +{capabilities.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Last heartbeat */}
        <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <Clock className='h-3.5 w-3.5' />
          <span>Last heartbeat: {formatHeartbeat(lastHeartbeat)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default DaemonNodeCard;
