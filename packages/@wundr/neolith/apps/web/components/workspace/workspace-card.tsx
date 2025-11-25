'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  agentCount: number;
  workflowCount: number;
  updatedAt: Date;
}

interface WorkspaceCardProps {
  workspace: Workspace;
  onClick?: () => void;
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary hover:shadow-md',
        'group',
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        {/* Workspace Icon */}
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <WorkspaceIcon />
        </div>

        <CardTitle className="font-heading">{workspace.name}</CardTitle>
        {workspace.description && (
          <CardDescription className="line-clamp-2 font-sans">
            {workspace.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {/* Stats */}
        <div className="flex w-full gap-4 text-sm text-muted-foreground font-sans">
          <span className="flex items-center gap-1">
            <AgentIcon className="h-4 w-4" />
            {workspace.agentCount} agents
          </span>
          <span className="flex items-center gap-1">
            <WorkflowIcon className="h-4 w-4" />
            {workspace.workflowCount} workflows
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm animate-pulse">
      {/* Icon Skeleton */}
      <div className="mb-4 h-12 w-12 rounded-lg bg-muted" />

      {/* Title Skeleton */}
      <div className="mb-2 h-5 w-3/4 rounded bg-muted" />

      {/* Description Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>

      {/* Stats Skeleton */}
      <div className="mt-auto flex gap-4 pt-4">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

function WorkspaceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
      <path d="M12 3v6" />
    </svg>
  );
}

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function WorkflowIcon({ className }: { className?: string }) {
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
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  );
}
