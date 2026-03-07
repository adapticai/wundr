'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

import { ALL_DISCIPLINES } from './step-disciplines';

import type { GenesisFormValues, OrchestratorConfig } from './genesis-wizard';

const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  name: '',
  persona: '',
  maxConcurrentSessions: 10,
  tokenBudgetPerHour: 500000,
};

function buildDefaultName(disciplineId: string): string {
  const discipline = ALL_DISCIPLINES.find(d => d.id === disciplineId);
  if (!discipline) {
    return `${disciplineId} Orchestrator`;
  }
  return `${discipline.label} Orchestrator`;
}

function buildDefaultPersona(disciplineId: string): string {
  const personas: Record<string, string> = {
    engineering:
      'A methodical and detail-oriented technical leader focused on code quality, system reliability, and engineering best practices.',
    product:
      'A strategic product thinker who balances user needs, business goals, and technical feasibility to drive impactful outcomes.',
    design:
      'A creative and user-centric design leader who champions exceptional user experiences and consistent visual language.',
    marketing:
      'A data-driven marketing strategist who crafts compelling narratives and executes campaigns that drive growth and brand awareness.',
    sales:
      'A results-oriented sales coordinator who nurtures pipeline health, accelerates deal velocity, and maximizes revenue outcomes.',
    legal:
      'A rigorous and precise legal coordinator who ensures compliance, manages risk, and protects organizational interests.',
    hr: 'A people-focused HR orchestrator who fosters a positive culture, manages talent acquisition, and drives employee engagement.',
    finance:
      'A disciplined finance orchestrator who maintains fiscal health, ensures accurate reporting, and enables informed business decisions.',
    operations:
      'A process-driven operations orchestrator who optimizes workflows, manages vendor relationships, and improves operational efficiency.',
    data: 'An analytical data orchestrator who transforms raw data into actionable insights and ensures data quality and governance.',
    security:
      'A vigilant security orchestrator who proactively identifies threats, enforces policies, and maintains a strong security posture.',
    'customer-success':
      'A customer-centric orchestrator who drives adoption, resolves escalations swiftly, and maximizes customer lifetime value.',
  };
  return (
    personas[disciplineId] ??
    'A disciplined orchestrator dedicated to coordinating discipline activities with precision and clarity.'
  );
}

interface OrchestratorSectionProps {
  disciplineId: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

function OrchestratorSection({
  disciplineId,
  index,
  isOpen,
  onToggle,
}: OrchestratorSectionProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<GenesisFormValues>();

  const discipline = ALL_DISCIPLINES.find(d => d.id === disciplineId);
  const configPath = `orchestratorConfigs.${disciplineId}` as const;
  const config = watch(configPath as `orchestratorConfigs.${string}`);

  // Initialize defaults if not set
  const currentConfig: OrchestratorConfig = config ?? {
    name: buildDefaultName(disciplineId),
    persona: buildDefaultPersona(disciplineId),
    maxConcurrentSessions: DEFAULT_ORCHESTRATOR_CONFIG.maxConcurrentSessions,
    tokenBudgetPerHour: DEFAULT_ORCHESTRATOR_CONFIG.tokenBudgetPerHour,
  };

  const hasErrors =
    errors.orchestratorConfigs?.[
      disciplineId as keyof typeof errors.orchestratorConfigs
    ];

  const handleResetDefaults = () => {
    setValue(
      `orchestratorConfigs.${disciplineId}` as never,
      {
        name: buildDefaultName(disciplineId),
        persona: buildDefaultPersona(disciplineId),
        maxConcurrentSessions:
          DEFAULT_ORCHESTRATOR_CONFIG.maxConcurrentSessions,
        tokenBudgetPerHour: DEFAULT_ORCHESTRATOR_CONFIG.tokenBudgetPerHour,
      } as never,
      { shouldValidate: true }
    );
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isOpen ? 'border-primary/50' : 'border-border',
        hasErrors && 'border-destructive'
      )}
    >
      {/* Section Header */}
      <button
        type='button'
        onClick={onToggle}
        className='flex w-full items-center justify-between px-4 py-3 text-left'
      >
        <div className='flex items-center gap-3'>
          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground'>
            {index + 1}
          </span>
          <div>
            <span className='text-sm font-medium text-foreground'>
              {discipline?.label ?? disciplineId}
            </span>
            {!isOpen && currentConfig.name && (
              <span className='ml-2 text-xs text-muted-foreground'>
                &mdash; {currentConfig.name}
              </span>
            )}
          </div>
          {hasErrors && (
            <span className='rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive'>
              Needs attention
            </span>
          )}
        </div>
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Section Body */}
      {isOpen && (
        <div className='border-t px-4 pb-4 pt-4'>
          <div className='space-y-4'>
            {/* Name */}
            <div className='space-y-1.5'>
              <label
                htmlFor={`orch-name-${disciplineId}`}
                className='block text-sm font-medium text-foreground'
              >
                Orchestrator Name
                <span className='ml-1 text-destructive'>*</span>
              </label>
              <input
                id={`orch-name-${disciplineId}`}
                type='text'
                defaultValue={currentConfig.name}
                placeholder={buildDefaultName(disciplineId)}
                {...register(
                  `orchestratorConfigs.${disciplineId}.name` as never
                )}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              />
            </div>

            {/* Persona */}
            <div className='space-y-1.5'>
              <label
                htmlFor={`orch-persona-${disciplineId}`}
                className='block text-sm font-medium text-foreground'
              >
                Persona
                <span className='ml-1 text-destructive'>*</span>
              </label>
              <textarea
                id={`orch-persona-${disciplineId}`}
                rows={3}
                defaultValue={currentConfig.persona}
                placeholder={buildDefaultPersona(disciplineId)}
                {...register(
                  `orchestratorConfigs.${disciplineId}.persona` as never
                )}
                className='w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              />
              <p className='text-xs text-muted-foreground'>
                Describes this orchestrator&apos;s personality, communication
                style, and decision-making approach.
              </p>
            </div>

            {/* Resource Limits */}
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label
                  htmlFor={`orch-sessions-${disciplineId}`}
                  className='block text-sm font-medium text-foreground'
                >
                  Max Concurrent Sessions
                </label>
                <input
                  id={`orch-sessions-${disciplineId}`}
                  type='number'
                  min={1}
                  max={100}
                  defaultValue={currentConfig.maxConcurrentSessions}
                  {...register(
                    `orchestratorConfigs.${disciplineId}.maxConcurrentSessions` as never,
                    { valueAsNumber: true }
                  )}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum child sessions this orchestrator can spawn
                  simultaneously.
                </p>
              </div>

              <div className='space-y-1.5'>
                <label
                  htmlFor={`orch-tokens-${disciplineId}`}
                  className='block text-sm font-medium text-foreground'
                >
                  Token Budget / Hour
                </label>
                <input
                  id={`orch-tokens-${disciplineId}`}
                  type='number'
                  min={10000}
                  step={10000}
                  defaultValue={currentConfig.tokenBudgetPerHour}
                  {...register(
                    `orchestratorConfigs.${disciplineId}.tokenBudgetPerHour` as never,
                    { valueAsNumber: true }
                  )}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum LLM tokens this orchestrator can consume per hour.
                </p>
              </div>
            </div>

            {/* Reset button */}
            <div className='flex justify-end'>
              <button
                type='button'
                onClick={handleResetDefaults}
                className='text-xs text-muted-foreground hover:text-foreground hover:underline'
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StepOrchestratorConfig() {
  const { watch } = useFormContext<GenesisFormValues>();
  const selectedDisciplines = watch('disciplines') ?? [];

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(selectedDisciplines.slice(0, 1))
  );

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(selectedDisciplines));
  const collapseAll = () => setOpenSections(new Set());

  if (selectedDisciplines.length === 0) {
    return (
      <div className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold text-foreground'>
            Orchestrator Configuration
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Configure orchestrators for each selected discipline.
          </p>
        </div>
        <div className='rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center'>
          <p className='text-sm text-muted-foreground'>
            No disciplines selected. Go back and select at least one discipline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold text-foreground'>
          Orchestrator Configuration
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Customize each discipline&apos;s orchestrator. Defaults are pre-filled
          based on the discipline&apos;s domain — you can adjust name, persona,
          and resource limits.
        </p>
      </div>

      {/* Controls */}
      <div className='flex items-center justify-between'>
        <span className='text-sm text-muted-foreground'>
          {selectedDisciplines.length} orchestrator
          {selectedDisciplines.length !== 1 ? 's' : ''} to configure
        </span>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={expandAll}
            className='text-xs text-primary hover:underline'
          >
            Expand all
          </button>
          <span className='text-muted-foreground'>·</span>
          <button
            type='button'
            onClick={collapseAll}
            className='text-xs text-muted-foreground hover:text-foreground hover:underline'
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Orchestrator Sections */}
      <div className='space-y-3'>
        {selectedDisciplines.map((disciplineId, index) => (
          <OrchestratorSection
            key={disciplineId}
            disciplineId={disciplineId}
            index={index}
            isOpen={openSections.has(disciplineId)}
            onToggle={() => toggleSection(disciplineId)}
          />
        ))}
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
      <polyline points='6 9 12 15 18 9' />
    </svg>
  );
}
