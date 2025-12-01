'use client';

import { Network, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OrgChartEmptyStateProps {
  workspaceId: string;
  className?: string;
}

export function OrgChartEmptyState({
  workspaceId,
  className,
}: OrgChartEmptyStateProps) {
  return (
    <Card
      className={cn(
        'flex flex-col items-center justify-center p-12 bg-stone-900 border-stone-800',
        className
      )}
    >
      <div className='flex h-20 w-20 items-center justify-center rounded-full bg-stone-800 mb-6'>
        <Network className='h-10 w-10 text-stone-400' />
      </div>
      <h3 className='text-xl font-semibold text-stone-100 mb-2'>
        No organization hierarchy configured
      </h3>
      <p className='text-sm text-stone-400 text-center max-w-md mb-6'>
        Your workspace doesn&apos;t have an organization structure yet. Generate
        one to visualize your Orchestrators hierarchy and team structure.
      </p>
      <div className='flex flex-col sm:flex-row gap-3'>
        <Button
          asChild
          className='bg-stone-100 text-stone-950 hover:bg-stone-200'
        >
          <Link href={`/${workspaceId}/org-genesis`}>
            <Plus className='h-4 w-4 mr-2' />
            Generate Org Structure
          </Link>
        </Button>
        <Button
          asChild
          variant='outline'
          className='border-stone-700 text-stone-300 hover:bg-stone-800'
        >
          <Link href={`/${workspaceId}/orchestrators`}>View Orchestrators</Link>
        </Button>
      </div>
    </Card>
  );
}
