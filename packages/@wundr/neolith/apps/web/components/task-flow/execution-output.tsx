'use client';

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type ExecutionStatus = 'success' | 'failed' | 'in-progress' | 'pending';

export interface ExecutionOutputData {
  status: ExecutionStatus;
  output?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  tokensUsed?: number | null;
  model?: string | null;
}

interface ExecutionOutputProps {
  execution: ExecutionOutputData;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

const STATUS_CONFIG: Record<
  ExecutionStatus,
  {
    label: string;
    icon: React.ElementType;
    iconClass: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
    badgeClass: string;
  }
> = {
  success: {
    label: 'Completed',
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badgeVariant: 'default',
    badgeClass:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    iconClass: 'text-red-600',
    badgeVariant: 'destructive',
    badgeClass: '',
  },
  'in-progress': {
    label: 'In Progress',
    icon: Loader2,
    iconClass: 'text-blue-600 animate-spin',
    badgeVariant: 'secondary',
    badgeClass:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    iconClass: 'text-muted-foreground',
    badgeVariant: 'outline',
    badgeClass: '',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ExecutionOutput({
  execution,
  className,
}: ExecutionOutputProps) {
  const [isOutputOpen, setIsOutputOpen] = useState(false);

  const config = STATUS_CONFIG[execution.status];
  const StatusIcon = config.icon;
  const hasOutput = !!(execution.output || execution.error);

  return (
    <Card className={cn('', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base'>Execution Output</CardTitle>
          <Badge
            variant={config.badgeVariant}
            className={cn('gap-1', config.badgeClass)}
          >
            <StatusIcon className={cn('h-3 w-3', config.iconClass)} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Stats row */}
        <div className='flex flex-wrap gap-4'>
          {execution.durationMs != null && (
            <div className='flex items-center gap-1.5 text-sm'>
              <Clock className='h-3.5 w-3.5 text-muted-foreground' />
              <span className='text-muted-foreground'>Duration:</span>
              <span className='font-medium font-mono'>
                {formatDuration(execution.durationMs)}
              </span>
            </div>
          )}

          {execution.tokensUsed != null && (
            <div className='flex items-center gap-1.5 text-sm'>
              <Coins className='h-3.5 w-3.5 text-muted-foreground' />
              <span className='text-muted-foreground'>Tokens:</span>
              <span className='font-medium font-mono'>
                {formatTokens(execution.tokensUsed)}
              </span>
            </div>
          )}

          {execution.model && (
            <div className='flex items-center gap-1.5 text-sm'>
              <span className='text-muted-foreground'>Model:</span>
              <span className='font-medium font-mono text-xs'>
                {execution.model}
              </span>
            </div>
          )}
        </div>

        {/* Timing */}
        {(execution.startedAt || execution.completedAt) && (
          <div className='grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs'>
            {execution.startedAt && (
              <div>
                <p className='text-muted-foreground'>Started</p>
                <p className='font-medium'>
                  {new Date(execution.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {execution.completedAt && (
              <div>
                <p className='text-muted-foreground'>Completed</p>
                <p className='font-medium'>
                  {new Date(execution.completedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Output viewer */}
        {hasOutput && (
          <Collapsible open={isOutputOpen} onOpenChange={setIsOutputOpen}>
            <CollapsibleTrigger className='flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors'>
              <span>{execution.error ? 'Error Details' : 'Output'}</span>
              {isOutputOpen ? (
                <ChevronDown className='h-4 w-4 text-muted-foreground' />
              ) : (
                <ChevronRight className='h-4 w-4 text-muted-foreground' />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2'>
              {execution.error ? (
                <pre className='max-h-64 overflow-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive font-mono leading-relaxed whitespace-pre-wrap'>
                  {execution.error}
                </pre>
              ) : (
                <pre className='max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground'>
                  {execution.output}
                </pre>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Placeholder when no output yet */}
        {!hasOutput && execution.status === 'pending' && (
          <p className='text-sm text-muted-foreground italic'>
            Waiting for execution to begin...
          </p>
        )}
        {!hasOutput && execution.status === 'in-progress' && (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span>Executing...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
