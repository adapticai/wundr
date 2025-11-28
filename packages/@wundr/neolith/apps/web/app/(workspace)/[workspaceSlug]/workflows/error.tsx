'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkflowsError({ error, reset }: ErrorProps) {
  console.error('Workflows error:', error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 flex-shrink-0 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-purple-800">
                Workflows Error
              </h3>
              <p className="mt-1 text-sm text-purple-700">
                {error.message || 'Failed to load workflows.'}
              </p>
              {error.digest && (
                <p className="mt-1 text-xs text-purple-600">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-4 w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
