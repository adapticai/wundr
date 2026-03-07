'use client';

import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

import type { GenesisFormValues } from './genesis-wizard';

export interface DisciplineDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  recommendedFor: string[];
}

export const ALL_DISCIPLINES: DisciplineDefinition[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    description:
      'Software development, code review, CI/CD, architecture design, and technical debt management.',
    icon: 'code',
    recommendedFor: ['technology', 'gaming', 'finance', 'healthcare'],
  },
  {
    id: 'product',
    label: 'Product',
    description:
      'Product roadmap, feature prioritization, user research synthesis, and stakeholder alignment.',
    icon: 'layout',
    recommendedFor: ['technology', 'retail', 'gaming', 'media'],
  },
  {
    id: 'design',
    label: 'Design',
    description:
      'UI/UX design, brand identity, design systems, user testing coordination, and visual assets.',
    icon: 'pen-tool',
    recommendedFor: ['technology', 'retail', 'gaming', 'media', 'marketing'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description:
      'Campaign management, content creation, SEO/SEM, social media, analytics, and growth strategies.',
    icon: 'trending-up',
    recommendedFor: ['marketing', 'retail', 'media', 'technology'],
  },
  {
    id: 'sales',
    label: 'Sales',
    description:
      'Lead generation, pipeline management, outreach, deal tracking, and revenue forecasting.',
    icon: 'bar-chart',
    recommendedFor: ['technology', 'finance', 'manufacturing', 'retail'],
  },
  {
    id: 'legal',
    label: 'Legal',
    description:
      'Contract review, compliance monitoring, regulatory filings, IP management, and risk assessment.',
    icon: 'scale',
    recommendedFor: ['legal', 'finance', 'healthcare', 'manufacturing'],
  },
  {
    id: 'hr',
    label: 'Human Resources',
    description:
      'Recruitment coordination, onboarding, performance reviews, policy management, and workforce planning.',
    icon: 'users',
    recommendedFor: ['technology', 'healthcare', 'manufacturing', 'retail'],
  },
  {
    id: 'finance',
    label: 'Finance',
    description:
      'Budget tracking, financial reporting, expense management, forecasting, and compliance.',
    icon: 'dollar-sign',
    recommendedFor: ['finance', 'technology', 'manufacturing', 'retail'],
  },
  {
    id: 'operations',
    label: 'Operations',
    description:
      'Process optimization, supply chain coordination, vendor management, and operational efficiency.',
    icon: 'settings',
    recommendedFor: ['manufacturing', 'retail', 'healthcare', 'legal'],
  },
  {
    id: 'data',
    label: 'Data & Analytics',
    description:
      'Data pipelines, BI dashboards, ML model management, data quality, and insight generation.',
    icon: 'database',
    recommendedFor: ['technology', 'finance', 'healthcare', 'retail'],
  },
  {
    id: 'security',
    label: 'Security',
    description:
      'Threat monitoring, vulnerability assessments, incident response, compliance audits, and pen testing.',
    icon: 'shield',
    recommendedFor: ['technology', 'finance', 'healthcare', 'legal'],
  },
  {
    id: 'customer-success',
    label: 'Customer Success',
    description:
      'Onboarding, support escalations, retention campaigns, NPS tracking, and account health monitoring.',
    icon: 'heart',
    recommendedFor: ['technology', 'retail', 'media', 'gaming'],
  },
];

const ICON_PATHS: Record<string, string> = {
  code: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  layout: 'M12 3H3v7h9V3zM21 3h-9v7h9V3zM21 14H3v7h18v-7z',
  'pen-tool': 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z',
  'trending-up': 'M23 6l-9.5 9.5-5-5L1 18',
  'bar-chart': 'M12 20V10M18 20V4M6 20v-4',
  scale: 'M12 3v18M3 9l4-4 5 5 5-5 4 4M3 21h18M7 21V9M17 21V9',
  users:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'dollar-sign': 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  database:
    'M12 2C6.5 2 2 4 2 6.5v11C2 20 6.5 22 12 22s10-2 10-4.5v-11C22 4 17.5 2 12 2zM2 6.5C2 9 6.5 11 12 11s10-2 10-4.5M2 12c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  heart:
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
};

function DisciplineIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const path = ICON_PATHS[icon] ?? ICON_PATHS['layout'];
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
      <path d={path} />
    </svg>
  );
}

export function StepDisciplines() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<GenesisFormValues>();

  const selectedDisciplines = watch('disciplines') ?? [];
  const selectedIndustry = watch('industry');

  const recommended = ALL_DISCIPLINES.filter(d =>
    selectedIndustry
      ? d.recommendedFor.includes(selectedIndustry as never)
      : false
  );

  const toggleDiscipline = (id: string) => {
    const current = selectedDisciplines ?? [];
    const next = current.includes(id)
      ? current.filter(d => d !== id)
      : [...current, id];
    setValue('disciplines', next, { shouldValidate: true });
  };

  const selectAll = () => {
    setValue(
      'disciplines',
      ALL_DISCIPLINES.map(d => d.id),
      { shouldValidate: true }
    );
  };

  const clearAll = () => {
    setValue('disciplines', [], { shouldValidate: true });
  };

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold text-foreground'>Disciplines</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Select the disciplines to include in your organization. Each
          discipline will receive its own orchestrator and session managers.
        </p>
      </div>

      {/* Summary Bar */}
      <div className='flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3'>
        <span className='text-sm text-foreground'>
          <span className='font-semibold'>{selectedDisciplines.length}</span> of{' '}
          {ALL_DISCIPLINES.length} disciplines selected
        </span>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={selectAll}
            className='text-xs text-primary hover:underline'
          >
            Select all
          </button>
          <span className='text-muted-foreground'>·</span>
          <button
            type='button'
            onClick={clearAll}
            className='text-xs text-muted-foreground hover:text-foreground hover:underline'
          >
            Clear
          </button>
        </div>
      </div>

      {/* Recommended Banner */}
      {recommended.length > 0 && (
        <div className='rounded-lg border border-primary/30 bg-primary/5 px-4 py-3'>
          <p className='text-xs font-medium text-primary'>
            Recommended for your industry:
          </p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            {recommended.map(d => d.label).join(', ')}
          </p>
        </div>
      )}

      {/* Discipline Grid */}
      <div className='grid gap-3 sm:grid-cols-2'>
        {ALL_DISCIPLINES.map(discipline => {
          const isSelected = selectedDisciplines.includes(discipline.id);
          const isRecommended = selectedIndustry
            ? discipline.recommendedFor.includes(selectedIndustry as never)
            : false;

          return (
            <button
              key={discipline.id}
              type='button'
              onClick={() => toggleDiscipline(discipline.id)}
              className={cn(
                'relative flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-accent'
              )}
            >
              {/* Checkbox */}
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground bg-background'
                )}
              >
                {isSelected && (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='h-2.5 w-2.5 text-primary-foreground'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                )}
              </span>

              {/* Icon */}
              <span
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <DisciplineIcon icon={discipline.icon} className='h-4 w-4' />
              </span>

              {/* Text */}
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-1.5'>
                  <span className='text-sm font-medium text-foreground'>
                    {discipline.label}
                  </span>
                  {isRecommended && (
                    <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary'>
                      Recommended
                    </span>
                  )}
                </div>
                <p className='mt-0.5 text-xs text-muted-foreground leading-relaxed'>
                  {discipline.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {errors.disciplines && (
        <p className='text-xs text-destructive'>
          {errors.disciplines.message as string}
        </p>
      )}
    </div>
  );
}
