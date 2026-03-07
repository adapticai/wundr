'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { cn } from '@/lib/utils';

import { ALL_DISCIPLINES } from './step-disciplines';

export interface GenerationResult {
  success: boolean;
  error?: string;
  organizationId?: string;
  orchestrators?: GeneratedOrchestrator[];
  sessionManagers?: GeneratedSessionManager[];
  agentCount?: number;
  disciplineCount?: number;
}

export interface GeneratedOrchestrator {
  id: string;
  name: string;
  disciplineId: string;
  status: 'active' | 'provisioning' | 'error';
}

export interface GeneratedSessionManager {
  id: string;
  name: string;
  disciplineId: string;
  orchestratorId: string;
}

interface StepResultsProps {
  result: GenerationResult | null;
  isLoading: boolean;
  onRetry: () => void;
  onReset: () => void;
}

function LoadingState() {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <div className='relative mb-6'>
        <div className='h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary' />
        <SparklesIcon className='absolute inset-0 m-auto h-6 w-6 text-primary' />
      </div>
      <h2 className='text-lg font-semibold text-foreground'>
        Generating Organization...
      </h2>
      <p className='mt-2 max-w-sm text-sm text-muted-foreground'>
        Provisioning orchestrators, session managers, and agents. This may take
        a few moments.
      </p>
      <div className='mt-6 space-y-2 text-left w-full max-w-sm'>
        {[
          'Creating organization manifest',
          'Provisioning orchestrators',
          'Spawning session managers',
          'Initializing agents',
        ].map((step, i) => (
          <div
            key={i}
            className='flex items-center gap-2 text-sm text-muted-foreground'
          >
            <div className='h-1.5 w-1.5 animate-pulse rounded-full bg-primary' />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessState({
  result,
  workspaceSlug,
  onReset,
}: {
  result: GenerationResult;
  workspaceSlug: string;
  onReset: () => void;
}) {
  const orchestrators = result.orchestrators ?? [];

  return (
    <div className='space-y-6'>
      {/* Success Header */}
      <div className='flex flex-col items-center py-8 text-center'>
        <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950'>
          <CheckCircleIcon className='h-8 w-8 text-emerald-600 dark:text-emerald-400' />
        </div>
        <h2 className='text-xl font-bold text-foreground'>
          Organization Generated Successfully
        </h2>
        <p className='mt-2 max-w-md text-sm text-muted-foreground'>
          Your AI organization has been provisioned. You can now manage
          orchestrators, configure session managers, and monitor agent activity.
        </p>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-3 gap-3'>
        <div className='rounded-lg border bg-muted/20 p-4 text-center'>
          <p className='text-2xl font-bold text-foreground'>
            {result.disciplineCount ?? 0}
          </p>
          <p className='mt-0.5 text-xs font-medium text-muted-foreground'>
            Disciplines
          </p>
        </div>
        <div className='rounded-lg border bg-muted/20 p-4 text-center'>
          <p className='text-2xl font-bold text-foreground'>
            {orchestrators.length}
          </p>
          <p className='mt-0.5 text-xs font-medium text-muted-foreground'>
            Orchestrators
          </p>
        </div>
        <div className='rounded-lg border bg-muted/20 p-4 text-center'>
          <p className='text-2xl font-bold text-foreground'>
            {result.agentCount ?? 0}
          </p>
          <p className='mt-0.5 text-xs font-medium text-muted-foreground'>
            Agents
          </p>
        </div>
      </div>

      {/* Orchestrators list */}
      {orchestrators.length > 0 && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-4 py-3'>
            <h3 className='text-sm font-semibold text-foreground'>
              Generated Orchestrators
            </h3>
          </div>
          <div className='divide-y'>
            {orchestrators.map(orch => {
              const discipline = ALL_DISCIPLINES.find(
                d => d.id === orch.disciplineId
              );
              return (
                <div
                  key={orch.id}
                  className='flex items-center justify-between px-4 py-3'
                >
                  <div className='flex items-center gap-3'>
                    <StatusDot status={orch.status} />
                    <div>
                      <p className='text-sm font-medium text-foreground'>
                        {orch.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {discipline?.label ?? orch.disciplineId}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/${workspaceSlug}/orchestrators/${orch.id}`}
                    className='text-xs text-primary hover:underline'
                  >
                    Manage
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <Link
          href={`/${workspaceSlug}/admin/orchestrators`}
          className='flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent'
        >
          <OrchestratorIcon className='h-8 w-8 text-primary' />
          <div>
            <p className='text-sm font-medium text-foreground'>
              Manage Orchestrators
            </p>
            <p className='text-xs text-muted-foreground'>
              View and configure all orchestrators
            </p>
          </div>
        </Link>
        <Link
          href={`/${workspaceSlug}/admin/org-chart`}
          className='flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent'
        >
          <OrgChartIcon className='h-8 w-8 text-primary' />
          <div>
            <p className='text-sm font-medium text-foreground'>
              View Org Chart
            </p>
            <p className='text-xs text-muted-foreground'>
              Explore the organizational hierarchy
            </p>
          </div>
        </Link>
      </div>

      {/* Reset */}
      <div className='flex justify-center'>
        <button
          type='button'
          onClick={onReset}
          className='text-xs text-muted-foreground hover:text-foreground hover:underline'
        >
          Generate another organization
        </button>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  onReset,
}: {
  error: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className='flex flex-col items-center py-12 text-center'>
      <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10'>
        <XCircleIcon className='h-8 w-8 text-destructive' />
      </div>
      <h2 className='text-lg font-bold text-foreground'>Generation Failed</h2>
      <p className='mt-2 max-w-md text-sm text-muted-foreground'>
        Something went wrong while generating your organization. Please review
        the error below and try again.
      </p>

      <div className='mt-4 w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left'>
        <p className='text-sm font-medium text-destructive'>Error details</p>
        <p className='mt-1 text-xs text-muted-foreground break-words'>
          {error}
        </p>
      </div>

      <div className='mt-6 flex gap-3'>
        <button
          type='button'
          onClick={onRetry}
          className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          Try again
        </button>
        <button
          type='button'
          onClick={onReset}
          className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
        >
          Start over
        </button>
      </div>
    </div>
  );
}

export function StepResults({
  result,
  isLoading,
  onRetry,
  onReset,
}: StepResultsProps) {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) ?? '';

  if (isLoading) {
    return <LoadingState />;
  }

  if (!result) {
    return (
      <div className='py-12 text-center text-sm text-muted-foreground'>
        No result yet. Complete the previous steps and click Generate.
      </div>
    );
  }

  if (!result.success) {
    return (
      <ErrorState
        error={result.error ?? 'An unknown error occurred.'}
        onRetry={onRetry}
        onReset={onReset}
      />
    );
  }

  return (
    <SuccessState
      result={result}
      workspaceSlug={workspaceSlug}
      onReset={onReset}
    />
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'h-2 w-2 flex-shrink-0 rounded-full',
        status === 'active' && 'bg-emerald-500',
        status === 'provisioning' && 'animate-pulse bg-amber-500',
        status === 'error' && 'bg-destructive'
      )}
    />
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
      <polyline points='22 4 12 14.01 9 11.01' />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='15' x2='9' y1='9' y2='15' />
      <line x1='9' x2='15' y1='9' y2='15' />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' />
      <path d='M5 3v4' />
      <path d='M19 17v4' />
      <path d='M3 5h4' />
      <path d='M17 19h4' />
    </svg>
  );
}

function OrchestratorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M12 8V4H8' />
      <rect width='16' height='12' x='4' y='8' rx='2' />
      <path d='M2 14h2' />
      <path d='M20 14h2' />
      <path d='M15 13v2' />
      <path d='M9 13v2' />
    </svg>
  );
}

function OrgChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <rect x='8' y='2' width='8' height='4' rx='1' />
      <rect x='2' y='14' width='8' height='4' rx='1' />
      <rect x='14' y='14' width='8' height='4' rx='1' />
      <path d='M12 6v4' />
      <path d='M6 14v-4h12v4' />
    </svg>
  );
}
