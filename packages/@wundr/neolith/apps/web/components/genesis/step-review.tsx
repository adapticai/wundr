'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

import { ALL_DISCIPLINES } from './step-disciplines';

import type { GenesisFormValues } from './genesis-wizard';

const INDUSTRY_LABELS: Record<string, string> = {
  technology: 'Technology',
  finance: 'Finance',
  healthcare: 'Healthcare',
  legal: 'Legal',
  marketing: 'Marketing',
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  gaming: 'Gaming',
  media: 'Media',
  custom: 'Custom / Other',
};

const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  enterprise: 'Enterprise',
};

// Estimated counts per discipline per size
const AGENTS_PER_DISCIPLINE: Record<string, number> = {
  small: 3,
  medium: 5,
  large: 8,
  enterprise: 12,
};

const SESSION_MANAGERS_PER_DISCIPLINE: Record<string, number> = {
  small: 1,
  medium: 2,
  large: 3,
  enterprise: 5,
};

interface TreeNodeProps {
  label: string;
  sublabel?: string;
  badge?: string;
  badgeVariant?: 'default' | 'muted';
  children?: React.ReactNode;
  defaultOpen?: boolean;
  depth?: number;
}

function TreeNode({
  label,
  sublabel,
  badge,
  badgeVariant = 'default',
  children,
  defaultOpen = false,
  depth = 0,
}: TreeNodeProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div className={cn(depth > 0 && 'ml-6')}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5',
          hasChildren && 'cursor-pointer hover:bg-muted/50'
        )}
        onClick={hasChildren ? () => setOpen(o => !o) : undefined}
      >
        {/* Toggle indicator */}
        {hasChildren ? (
          <ChevronIcon
            className={cn(
              'h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          />
        ) : (
          <span className='h-3.5 w-3.5 flex-shrink-0' />
        )}

        {/* Dot */}
        <span
          className={cn(
            'h-2 w-2 flex-shrink-0 rounded-full',
            depth === 0 && 'bg-primary',
            depth === 1 && 'bg-blue-500',
            depth === 2 && 'bg-emerald-500',
            depth === 3 && 'bg-amber-500'
          )}
        />

        {/* Label */}
        <span
          className={cn(
            'text-sm',
            depth === 0 && 'font-semibold text-foreground',
            depth === 1 && 'font-medium text-foreground',
            depth >= 2 && 'text-muted-foreground'
          )}
        >
          {label}
        </span>

        {sublabel && (
          <span className='text-xs text-muted-foreground'>{sublabel}</span>
        )}

        {badge && (
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
              badgeVariant === 'default' && 'bg-primary/10 text-primary',
              badgeVariant === 'muted' && 'bg-muted text-muted-foreground'
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {hasChildren && open && (
        <div className='mt-0.5 border-l border-border/60 ml-4'>{children}</div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className='rounded-lg border bg-muted/20 p-4'>
      <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 text-xl font-bold text-foreground'>{value}</p>
      {description && (
        <p className='mt-0.5 text-xs text-muted-foreground'>{description}</p>
      )}
    </div>
  );
}

export function StepReview() {
  const { watch } = useFormContext<GenesisFormValues>();

  const name = watch('name');
  const mission = watch('mission');
  const description = watch('description');
  const industry = watch('industry');
  const size = watch('size');
  const disciplines = watch('disciplines') ?? [];
  const orchestratorConfigs = watch('orchestratorConfigs') ?? {};

  const totalOrchestrators = disciplines.length;
  const totalSessionManagers =
    disciplines.length * (SESSION_MANAGERS_PER_DISCIPLINE[size] ?? 2);
  const totalAgents = disciplines.length * (AGENTS_PER_DISCIPLINE[size] ?? 5);

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold text-foreground'>
          Review &amp; Generate
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Review the organization structure below. Click Generate to provision
          all orchestrators, session managers, and agents.
        </p>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <SummaryCard
          label='Disciplines'
          value={disciplines.length}
          description='Active disciplines'
        />
        <SummaryCard
          label='Orchestrators'
          value={totalOrchestrators}
          description='Tier 1 agents'
        />
        <SummaryCard
          label='Session Managers'
          value={`~${totalSessionManagers}`}
          description='Tier 2 agents'
        />
        <SummaryCard
          label='Agents'
          value={`~${totalAgents}`}
          description='Tier 3 agents'
        />
      </div>

      {/* Org Details */}
      <div className='rounded-lg border bg-card p-4'>
        <h3 className='text-sm font-semibold text-foreground'>
          Organization Details
        </h3>
        <dl className='mt-3 grid gap-3 sm:grid-cols-2'>
          <div>
            <dt className='text-xs font-medium text-muted-foreground'>Name</dt>
            <dd className='mt-0.5 text-sm text-foreground'>
              {name || (
                <span className='text-muted-foreground italic'>Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className='text-xs font-medium text-muted-foreground'>
              Industry
            </dt>
            <dd className='mt-0.5 text-sm text-foreground'>
              {industry ? (
                (INDUSTRY_LABELS[industry] ?? industry)
              ) : (
                <span className='text-muted-foreground italic'>Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className='text-xs font-medium text-muted-foreground'>
              Size Tier
            </dt>
            <dd className='mt-0.5 text-sm text-foreground'>
              {size ? (
                (SIZE_LABELS[size] ?? size)
              ) : (
                <span className='text-muted-foreground italic'>Not set</span>
              )}
            </dd>
          </div>
          <div className='sm:col-span-2'>
            <dt className='text-xs font-medium text-muted-foreground'>
              Mission
            </dt>
            <dd className='mt-0.5 text-sm text-foreground'>
              {mission || (
                <span className='text-muted-foreground italic'>Not set</span>
              )}
            </dd>
          </div>
          {description && (
            <div className='sm:col-span-2'>
              <dt className='text-xs font-medium text-muted-foreground'>
                Description
              </dt>
              <dd className='mt-0.5 text-sm text-foreground'>{description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Organization Tree */}
      <div className='rounded-lg border bg-card p-4'>
        <h3 className='mb-3 text-sm font-semibold text-foreground'>
          Organization Structure
        </h3>
        <div className='space-y-1'>
          <TreeNode
            label={name || 'Organization'}
            sublabel={
              industry
                ? `· ${INDUSTRY_LABELS[industry] ?? industry}`
                : undefined
            }
            badge={SIZE_LABELS[size] ?? size}
            defaultOpen
            depth={0}
          >
            {disciplines.map(disciplineId => {
              const discipline = ALL_DISCIPLINES.find(
                d => d.id === disciplineId
              );
              const config = orchestratorConfigs[disciplineId];
              const smCount = SESSION_MANAGERS_PER_DISCIPLINE[size] ?? 2;
              const agentCount = AGENTS_PER_DISCIPLINE[size] ?? 5;

              return (
                <TreeNode
                  key={disciplineId}
                  label={discipline?.label ?? disciplineId}
                  depth={1}
                >
                  <TreeNode
                    label={
                      config?.name ||
                      `${discipline?.label ?? disciplineId} Orchestrator`
                    }
                    sublabel='Orchestrator'
                    badge='Tier 1'
                    depth={2}
                  >
                    {Array.from({ length: smCount }).map((_, smIdx) => (
                      <TreeNode
                        key={smIdx}
                        label={`Session Manager ${smIdx + 1}`}
                        sublabel={discipline?.label}
                        badge='Tier 2'
                        badgeVariant='muted'
                        depth={3}
                      >
                        {Array.from({
                          length: Math.ceil(agentCount / smCount),
                        }).map((_, agIdx) => (
                          <TreeNode
                            key={agIdx}
                            label={`Agent ${agIdx + 1}`}
                            badge='Tier 3'
                            badgeVariant='muted'
                            depth={4}
                          />
                        ))}
                      </TreeNode>
                    ))}
                  </TreeNode>
                </TreeNode>
              );
            })}
          </TreeNode>
        </div>
      </div>

      {/* Warning Banner */}
      <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30'>
        <div className='flex gap-2'>
          <WarningIcon className='h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5' />
          <div>
            <p className='text-sm font-medium text-amber-800 dark:text-amber-200'>
              Generation will provision real resources
            </p>
            <p className='mt-0.5 text-xs text-amber-700 dark:text-amber-300'>
              This action creates orchestrators, session managers, and agent
              records in your workspace. You can manage or delete them
              afterwards from the Admin &rarr; Orchestrators panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <polyline points='9 18 15 12 9 6' />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' />
      <line x1='12' x2='12' y1='9' y2='13' />
      <line x1='12' x2='12.01' y1='17' y2='17' />
    </svg>
  );
}
