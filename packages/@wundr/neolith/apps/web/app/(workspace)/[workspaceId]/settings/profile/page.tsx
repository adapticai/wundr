export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Profile Settings</h1>
        <p className="mt-1 text-stone-400">Manage your personal profile and preferences.</p>
      </div>

      <div className="rounded-lg border border-stone-800 bg-stone-900 p-6">
        <h2 className="text-lg font-semibold text-stone-100">Personal Information</h2>
        <p className="mt-1 text-sm text-stone-400">Update your profile details.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-300">
              Display Name
            </label>
            <input
              type="text"
              id="name"
              className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-300">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
