'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  console.error('Admin error:', error);

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4'>
      <div className='w-full max-w-md'>
        <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-6'>
          <div className='flex items-start gap-3'>
            <svg
              className='h-6 w-6 flex-shrink-0 text-yellow-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-yellow-800'>
                Admin Error
              </h3>
              <p className='mt-1 text-sm text-yellow-700'>
                {error.message || 'Failed to load admin panel.'}
              </p>
              {error.digest && (
                <p className='mt-1 text-xs text-yellow-600'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className='mt-4 w-full rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600 transition-colors'
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
