'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AgentsError({ error, reset }: ErrorProps) {
  console.error('Agents error:', error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 flex-shrink-0 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-800">
                Agents Error
              </h3>
              <p className="mt-1 text-sm text-indigo-700">
                {error.message || 'Failed to load agents.'}
              </p>
              {error.digest && (
                <p className="mt-1 text-xs text-indigo-600">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
