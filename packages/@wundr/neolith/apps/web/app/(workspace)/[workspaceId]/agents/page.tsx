export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Agents</h1>
        <p className="mt-1 text-stone-400">Manage your AI agents and their configurations.</p>
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
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-stone-100">No agents configured</h3>
        <p className="mt-2 text-sm text-stone-400">
          Get started by creating your first AI agent to automate tasks.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
        >
          Create Agent
        </button>
      </div>
    </div>
  );
}
