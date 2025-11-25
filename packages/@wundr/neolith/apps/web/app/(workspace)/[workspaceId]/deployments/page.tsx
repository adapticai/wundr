export default function DeploymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Deployments</h1>
        <p className="mt-1 text-stone-400">Monitor and manage your deployed services.</p>
      </div>

      <div className="rounded-lg border border-stone-800 bg-stone-900 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-400"
          >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M19 17v4" />
            <path d="M3 5h4" />
            <path d="M17 19h4" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-stone-100">No active deployments</h3>
        <p className="mt-2 text-sm text-stone-400">
          Deploy your first service to see it here.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
        >
          New Deployment
        </button>
      </div>
    </div>
  );
}
