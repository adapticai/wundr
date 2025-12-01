'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SettingsError({ error, reset }: ErrorProps) {
  console.error('Settings error:', error);

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4'>
      <div className='w-full max-w-md'>
        <div className='rounded-lg border border-gray-200 bg-gray-50 p-6'>
          <div className='flex items-start gap-3'>
            <svg
              className='h-6 w-6 flex-shrink-0 text-gray-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
              />
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-gray-800'>
                Settings Error
              </h3>
              <p className='mt-1 text-sm text-gray-700'>
                {error.message || 'Failed to load settings.'}
              </p>
              {error.digest && (
                <p className='mt-1 text-xs text-gray-600'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className='mt-4 w-full rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 transition-colors'
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
