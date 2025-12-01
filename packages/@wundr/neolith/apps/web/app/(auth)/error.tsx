'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: ErrorProps) {
  console.error('Auth error:', error);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8'>
      <div className='w-full max-w-md space-y-8'>
        <div className='text-center'>
          <div className='mx-auto h-12 w-12 text-red-500'>
            <svg
              className='h-full w-full'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
          <h2 className='mt-6 text-3xl font-bold tracking-tight text-gray-900'>
            Authentication Error
          </h2>
          <p className='mt-2 text-sm text-gray-600'>
            {error.message || 'Something went wrong with authentication.'}
          </p>
          {error.digest && (
            <p className='mt-1 text-xs text-gray-500'>
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className='mt-8'>
          <button
            onClick={reset}
            className='flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors'
          >
            Try again
          </button>
          <a
            href='/'
            className='mt-4 flex w-full justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors'
          >
            Return to home
          </a>
        </div>
      </div>
    </div>
  );
}
