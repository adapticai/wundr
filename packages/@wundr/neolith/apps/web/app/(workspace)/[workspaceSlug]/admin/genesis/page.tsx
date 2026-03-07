'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { GenesisWizard } from '@/components/genesis/genesis-wizard';
import { usePageHeader } from '@/contexts/page-header-context';

/**
 * Org Genesis Wizard Page
 *
 * Step-by-step interface for generating a full organizational structure
 * from a workspace. Creates orchestrators, session managers, and agents
 * across chosen disciplines in one provisioning flow.
 *
 * Route: /[workspaceSlug]/admin/genesis
 */
export default function GenesisPage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Organization Genesis',
      'Generate a full organizational structure from a workspace'
    );
  }, [setPageHeader]);

  return (
    <div className='mx-auto max-w-3xl'>
      {/* Page Header */}
      <div className='mb-6 flex items-start gap-4'>
        <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10'>
          <SparklesIcon className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h1 className='text-xl font-bold text-foreground'>
            Organization Genesis
          </h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            Define your organizational structure and generate all orchestrators,
            session managers, and agents in one step.
          </p>
        </div>
      </div>

      {/* Wizard */}
      <GenesisWizard workspaceSlug={workspaceSlug} />
    </div>
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
