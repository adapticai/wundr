'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console
    console.error('Global error caught:', error);

    // TODO: Optionally send to error reporting service (e.g., Sentry)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     tags: { digest: error.digest },
    //   });
    // }
  }, [error]);

  return (
    <html lang='en'>
      <body className='font-sans antialiased'>
        <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4'>
          <div className='max-w-md w-full space-y-8 text-center'>
            {/* Error Icon */}
            <div className='flex justify-center'>
              <div className='relative'>
                <div className='w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center'>
                  <svg
                    className='w-12 h-12 text-destructive'
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
                <div className='absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center'>
                  <span className='text-destructive-foreground text-xs font-bold'>
                    !
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className='space-y-3'>
              <h1 className='text-3xl font-bold text-foreground font-heading'>
                Something went wrong
              </h1>
              <p className='text-muted-foreground'>
                We apologize for the inconvenience. An unexpected error has
                occurred in the application.
              </p>
              {error.digest && (
                <p className='text-xs text-muted-foreground/80 font-mono'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <div className='bg-muted/50 rounded-lg p-4 text-left'>
                <p className='text-xs font-mono text-muted-foreground break-all'>
                  {error.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className='flex flex-col sm:flex-row gap-3 justify-center'>
              <Button onClick={reset} size='lg' className='w-full sm:w-auto'>
                Try again
              </Button>
              <Button
                variant='outline'
                size='lg'
                className='w-full sm:w-auto'
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Go to home
              </Button>
            </div>

            {/* Additional Help */}
            <div className='pt-6 border-t border-border'>
              <p className='text-sm text-muted-foreground'>
                If this problem persists, please{' '}
                <a
                  href='mailto:support@neolith.ai'
                  className='text-primary underline-offset-4 hover:underline'
                >
                  contact support
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
