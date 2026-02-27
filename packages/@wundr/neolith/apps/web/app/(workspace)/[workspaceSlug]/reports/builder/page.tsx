'use client';

/**
 * Advanced Report Builder Page
 * Drag-and-drop report builder with scheduling and data source selection
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { ReportBuilderCanvas } from './components/report-builder-canvas';

export default function ReportBuilderPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  return (
    <div className='h-full flex flex-col'>
      <div className='border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex h-14 items-center gap-3 px-4'>
          <Button variant='ghost' size='icon' asChild>
            <Link
              href={`/${workspaceSlug}/reports`}
              aria-label='Back to reports'
            >
              <ArrowLeft className='h-4 w-4' />
            </Link>
          </Button>
          <div className='h-5 w-px bg-border' />
          <h1 className='text-lg font-semibold'>Report Builder</h1>
        </div>
      </div>
      <div className='flex-1 overflow-hidden'>
        <ReportBuilderCanvas />
      </div>
    </div>
  );
}
