'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkspaceError({ error, reset }: ErrorProps) {
  console.error('Workspace error:', error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-10 w-10 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Workspace Error
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {error.message || 'An error occurred while loading the workspace.'}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-gray-500">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={reset}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
