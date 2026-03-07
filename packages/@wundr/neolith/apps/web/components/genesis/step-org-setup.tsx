'use client';

import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

import type { GenesisFormValues } from './genesis-wizard';

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'media', label: 'Media' },
  { value: 'custom', label: 'Custom / Other' },
] as const;

const SIZE_TIERS = [
  {
    value: 'small',
    label: 'Small',
    description: '1-5 orchestrators, 2-4 disciplines',
    detail: 'Suited for startups and small teams',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: '5-15 orchestrators, 4-8 disciplines',
    detail: 'Suited for mid-size organizations',
  },
  {
    value: 'large',
    label: 'Large',
    description: '15-50 orchestrators, 8-15 disciplines',
    detail: 'Suited for large enterprises',
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    description: '50+ orchestrators, 15+ disciplines',
    detail: 'Suited for global organizations',
  },
] as const;

export function StepOrgSetup() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<GenesisFormValues>();

  const selectedSize = watch('size');

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold text-foreground'>
          Organization Setup
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Define the core identity of your organization. This information will
          guide how the AI cluster is structured and how agents make decisions.
        </p>
      </div>

      {/* Organization Name */}
      <div className='space-y-1.5'>
        <label
          htmlFor='org-name'
          className='block text-sm font-medium text-foreground'
        >
          Organization Name
          <span className='ml-1 text-destructive'>*</span>
        </label>
        <input
          id='org-name'
          type='text'
          placeholder='e.g. Acme Corporation'
          {...register('name')}
          className={cn(
            'w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            errors.name ? 'border-destructive' : 'border-input'
          )}
        />
        {errors.name && (
          <p className='text-xs text-destructive'>{errors.name.message}</p>
        )}
      </div>

      {/* Mission */}
      <div className='space-y-1.5'>
        <label
          htmlFor='org-mission'
          className='block text-sm font-medium text-foreground'
        >
          Mission Statement
          <span className='ml-1 text-destructive'>*</span>
        </label>
        <textarea
          id='org-mission'
          rows={3}
          placeholder='e.g. Democratize AI tooling for small businesses worldwide'
          {...register('mission')}
          className={cn(
            'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            errors.mission ? 'border-destructive' : 'border-input'
          )}
        />
        <p className='text-xs text-muted-foreground'>
          This guides agent decision-making and priority setting across the
          organization.
        </p>
        {errors.mission && (
          <p className='text-xs text-destructive'>{errors.mission.message}</p>
        )}
      </div>

      {/* Description */}
      <div className='space-y-1.5'>
        <label
          htmlFor='org-description'
          className='block text-sm font-medium text-foreground'
        >
          Description
          <span className='ml-1 text-muted-foreground text-xs font-normal'>
            (optional)
          </span>
        </label>
        <textarea
          id='org-description'
          rows={2}
          placeholder='Extended description of your organization goals and values...'
          {...register('description')}
          className='w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
        />
      </div>

      {/* Industry */}
      <div className='space-y-1.5'>
        <label
          htmlFor='org-industry'
          className='block text-sm font-medium text-foreground'
        >
          Industry
          <span className='ml-1 text-destructive'>*</span>
        </label>
        <select
          id='org-industry'
          {...register('industry')}
          className={cn(
            'w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            errors.industry ? 'border-destructive' : 'border-input'
          )}
        >
          <option value=''>Select an industry...</option>
          {INDUSTRY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.industry && (
          <p className='text-xs text-destructive'>{errors.industry.message}</p>
        )}
      </div>

      {/* Size Tier */}
      <div className='space-y-3'>
        <label className='block text-sm font-medium text-foreground'>
          Organization Size
          <span className='ml-1 text-destructive'>*</span>
        </label>
        <div className='grid gap-3 sm:grid-cols-2'>
          {SIZE_TIERS.map(tier => (
            <button
              key={tier.value}
              type='button'
              onClick={() =>
                setValue('size', tier.value, { shouldValidate: true })
              }
              className={cn(
                'relative flex flex-col rounded-lg border p-4 text-left transition-colors',
                selectedSize === tier.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-accent'
              )}
            >
              <div className='flex items-center justify-between'>
                <span className='text-sm font-semibold text-foreground'>
                  {tier.label}
                </span>
                {selectedSize === tier.value && (
                  <span className='flex h-5 w-5 items-center justify-center rounded-full bg-primary'>
                    <CheckIcon className='h-3 w-3 text-primary-foreground' />
                  </span>
                )}
              </div>
              <span className='mt-1 text-xs font-medium text-muted-foreground'>
                {tier.description}
              </span>
              <span className='mt-0.5 text-xs text-muted-foreground'>
                {tier.detail}
              </span>
            </button>
          ))}
        </div>
        {errors.size && (
          <p className='text-xs text-destructive'>{errors.size.message}</p>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}
