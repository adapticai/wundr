'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChannelsError({ error, reset }: ErrorProps) {
  console.error('Channels error:', error);

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
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-destructive'>
                Unable to load channels
              </h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                Something went wrong while loading your channels. Please try
                again or contact support if the problem persists.
              </p>
              {error.digest && (
                <p className='mt-2 text-xs text-muted-foreground'>
                  Reference: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className='mt-4 w-full rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive transition-colors'
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
