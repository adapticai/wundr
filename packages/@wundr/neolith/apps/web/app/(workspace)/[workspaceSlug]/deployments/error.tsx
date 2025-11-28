'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DeploymentsError({ error, reset }: ErrorProps) {
  console.error('Deployments error:', error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 flex-shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-800">
                Deployments Error
              </h3>
              <p className="mt-1 text-sm text-green-700">
                {error.message || 'Failed to load deployments.'}
              </p>
              {error.digest && (
                <p className="mt-1 text-xs text-green-600">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-4 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
