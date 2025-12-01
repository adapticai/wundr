'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AnalyticsError({
  error,
  reset,
}: ErrorProps): JSX.Element {
  // Log error to error tracking service in production
  useEffect(() => {
    // In production, this should send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error tracking service integration
      console.error('[Analytics Error]', {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      });
    } else {
      console.error('Analytics error:', error);
    }
  }, [error]);

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4'>
      <div className='w-full max-w-md'>
        <div className='rounded-lg border border-teal-200 bg-teal-50 p-6'>
          <div className='flex items-start gap-3'>
            <svg
              className='h-6 w-6 flex-shrink-0 text-teal-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-teal-800'>
                Analytics Error
              </h3>
              <p className='mt-1 text-sm text-teal-700'>
                {error.message || 'Failed to load analytics data.'}
              </p>
              {error.digest && (
                <p className='mt-1 text-xs text-teal-600'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className='mt-4 w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 transition-colors'
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
