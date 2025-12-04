'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AgentsError({ error, reset }: ErrorProps) {
  console.error('Agents error:', error);

  return (
    <div className='space-y-6'>
      <div className='rounded-lg border border-red-800 bg-red-900/20 p-6'>
        <div className='flex items-start gap-3'>
          <AlertCircle className='h-6 w-6 flex-shrink-0 text-red-400' />
          <div className='flex-1'>
            <h3 className='text-sm font-semibold text-red-300'>
              Failed to load agents
            </h3>
            <p className='mt-1 text-sm text-red-400'>
              {error.message ||
                'An unexpected error occurred while loading the agents page.'}
            </p>
            {error.digest && (
              <p className='mt-1 text-xs text-red-500'>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className='mt-4'>
          <Button
            onClick={reset}
            variant='outline'
            className='border-red-800 text-red-300 hover:bg-red-900/30 hover:text-red-200'
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
