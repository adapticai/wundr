'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

import type { DeploymentLog } from '@/types/deployment';

export interface DeploymentLogsPanelProps {
  deploymentId: string;
  logs: DeploymentLog[];
  isLoading: boolean;
  onClose: () => void;
}

export function DeploymentLogsPanel({
  deploymentId,
  logs,
  isLoading,
  onClose,
}: DeploymentLogsPanelProps) {
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const filteredLogs =
    levelFilter === 'all' ? logs : logs.filter((log) => log.level === levelFilter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h3 className="font-semibold">Deployment Logs</h3>
          <p className="text-sm text-muted-foreground">{deploymentId}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No logs available</p>
          </div>
        ) : (
          <div className="space-y-1 font-mono text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-3 rounded p-2 hover:bg-muted/50">
                <span className="shrink-0 text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={cn('shrink-0 font-semibold', getLevelColor(log.level))}>
                  {log.level.toUpperCase().padEnd(5)}
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t p-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} logs
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-accent"
          >
            Download
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-accent"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
