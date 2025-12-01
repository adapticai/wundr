'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  console.error('Dashboard error:', error);

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4'>
      <div className='w-full max-w-md'>
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-6'>
          <div className='flex items-start gap-3'>
            <svg
              className='h-6 w-6 flex-shrink-0 text-destructive'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-destructive'>
                Dashboard Error
              </h3>
              <p className='mt-1 text-sm text-destructive/90'>
                {error.message || 'Failed to load dashboard data.'}
              </p>
              {error.digest && (
                <p className='mt-1 text-xs text-destructive/70'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className='mt-4 w-full rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive transition-colors'
            aria-label='Try loading the dashboard again'
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
