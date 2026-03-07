/**
 * Active Sessions Panel
 *
 * Displays running Claude Code sessions for a session manager.
 * Shows session ID, start time, current task, output preview
 * and provides stop/restart controls.
 */
'use client';

import {
  Terminal,
  Clock,
  StopCircle,
  RefreshCw,
  AlertCircle,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ActiveSession {
  id: string;
  status: 'RUNNING' | 'PENDING' | 'STOPPING' | 'ERROR';
  startTime: string;
  currentTask?: string;
  outputPreview?: string;
  agentName?: string;
  pid?: number;
}

interface ActiveSessionsPanelProps {
  sessionManagerId: string;
  /** Poll interval in milliseconds. 0 disables polling. Default: 5000 */
  pollInterval?: number;
  className?: string;
}

const SESSION_STATUS: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  RUNNING: {
    label: 'Running',
    dot: 'bg-green-500 animate-pulse',
    badge: 'text-green-700 bg-green-50 border-green-200',
  },
  PENDING: {
    label: 'Starting',
    dot: 'bg-yellow-500 animate-pulse',
    badge: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  STOPPING: {
    label: 'Stopping',
    dot: 'bg-orange-500',
    badge: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  ERROR: {
    label: 'Error',
    dot: 'bg-red-500',
    badge: 'text-red-700 bg-red-50 border-red-200',
  },
};

function formatDuration(startTimeStr: string): string {
  const start = new Date(startTimeStr).getTime();
  const now = Date.now();
  const diffMs = now - start;

  if (diffMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function SessionRow({
  session,
  onStop,
  onRestart,
}: {
  session: ActiveSession;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(() =>
    formatDuration(session.startTime)
  );
  const statusConfig = SESSION_STATUS[session.status] ?? SESSION_STATUS.RUNNING;

  // Update elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatDuration(session.startTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [session.startTime]);

  return (
    <div className='border rounded-lg overflow-hidden'>
      {/* Header row */}
      <div
        className='flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors'
        onClick={() => setExpanded(prev => !prev)}
      >
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full flex-shrink-0',
            statusConfig.dot
          )}
          title={session.status}
        />

        {/* Session ID */}
        <span className='text-xs font-mono text-muted-foreground flex-shrink-0'>
          {session.id.slice(0, 8)}
        </span>

        {/* Agent name / task */}
        <div className='flex-1 min-w-0'>
          {session.agentName && (
            <span className='text-sm font-medium mr-2'>
              {session.agentName}
            </span>
          )}
          {session.currentTask && (
            <span className='text-xs text-muted-foreground truncate'>
              {session.currentTask}
            </span>
          )}
        </div>

        {/* Status badge */}
        <Badge
          className={cn('text-xs border flex-shrink-0', statusConfig.badge)}
        >
          {statusConfig.label}
        </Badge>

        {/* Elapsed time */}
        <span className='text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0'>
          <Clock className='h-3 w-3' />
          {elapsed}
        </span>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronDown className='h-4 w-4 text-muted-foreground flex-shrink-0' />
        ) : (
          <ChevronRight className='h-4 w-4 text-muted-foreground flex-shrink-0' />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className='px-4 py-3 border-t space-y-3'>
          {/* Output preview */}
          {session.outputPreview ? (
            <div>
              <p className='text-xs font-medium text-muted-foreground mb-1.5'>
                Output Preview
              </p>
              <pre className='text-xs font-mono bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-32'>
                {session.outputPreview}
              </pre>
            </div>
          ) : (
            <p className='text-xs text-muted-foreground italic'>
              No output captured yet.
            </p>
          )}

          {/* Metadata */}
          <div className='grid grid-cols-2 gap-2 text-xs'>
            <div>
              <span className='text-muted-foreground'>Started: </span>
              <span className='font-medium'>
                {new Date(session.startTime).toLocaleString()}
              </span>
            </div>
            {session.pid !== undefined && (
              <div>
                <span className='text-muted-foreground'>PID: </span>
                <span className='font-mono font-medium'>{session.pid}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className='flex gap-2 pt-1'>
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs'
              onClick={() => onRestart(session.id)}
              disabled={session.status === 'STOPPING'}
            >
              <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
              Restart
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60'
              onClick={() => onStop(session.id)}
              disabled={session.status === 'STOPPING'}
            >
              <StopCircle className='h-3.5 w-3.5 mr-1.5' />
              Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActiveSessionsPanel({
  sessionManagerId,
  pollInterval = 5000,
  className,
}: ActiveSessionsPanelProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessions = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        // This endpoint would be implemented to return active sessions.
        // We gracefully handle 404 (not yet implemented) by returning empty.
        const res = await fetch(
          `/api/session-managers/${sessionManagerId}/sessions`
        );

        if (res.status === 404) {
          setSessions([]);
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to fetch sessions');
        }

        const { data } = await res.json();
        setSessions(data ?? []);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [sessionManagerId]
  );

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) {
      return;
    }
    pollRef.current = setInterval(() => {
      fetchSessions(true);
    }, pollInterval);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchSessions, pollInterval]);

  const handleStop = useCallback(
    async (sessionId: string) => {
      try {
        await fetch(
          `/api/session-managers/${sessionManagerId}/sessions/${sessionId}/stop`,
          { method: 'POST' }
        );
        await fetchSessions(true);
      } catch (err) {
        console.error('Failed to stop session:', err);
      }
    },
    [sessionManagerId, fetchSessions]
  );

  const handleRestart = useCallback(
    async (sessionId: string) => {
      try {
        await fetch(
          `/api/session-managers/${sessionManagerId}/sessions/${sessionId}/restart`,
          { method: 'POST' }
        );
        await fetchSessions(true);
      } catch (err) {
        console.error('Failed to restart session:', err);
      }
    },
    [sessionManagerId, fetchSessions]
  );

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2].map(i => (
          <Skeleton key={i} className='h-14 w-full' />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4',
          className
        )}
      >
        <AlertCircle className='h-5 w-5 text-amber-500 flex-shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-amber-800'>
            Session data unavailable
          </p>
          <p className='text-xs text-amber-600 mt-0.5'>{error}</p>
        </div>
        <Button variant='outline' size='sm' onClick={() => fetchSessions()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Activity className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm font-medium'>
            {sessions.length === 0
              ? 'No active sessions'
              : `${sessions.length} active session${sessions.length !== 1 ? 's' : ''}`}
          </span>
          {sessions.length > 0 && (
            <span className='inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse' />
          )}
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='h-7 text-xs'
          onClick={() => fetchSessions()}
          title='Refresh sessions'
        >
          <RefreshCw className='h-3.5 w-3.5' />
        </Button>
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center'>
          <Terminal className='h-10 w-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium text-muted-foreground'>
            No active sessions
          </p>
          <p className='text-xs text-muted-foreground mt-1'>
            Claude Code sessions will appear here when the session manager is
            running.
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              onStop={handleStop}
              onRestart={handleRestart}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ActiveSessionsPanel;
