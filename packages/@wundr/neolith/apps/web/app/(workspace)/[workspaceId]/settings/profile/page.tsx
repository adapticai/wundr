'use client';

import { ThemeToggleLarge } from '@/components/layout/theme-toggle';

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal profile and preferences.</p>
      </div>

      {/* Personal Information Section */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Personal Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update your profile details.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Display Name
            </label>
            <input
              type="text"
              id="name"
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-95 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Theme Preference Section */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how the interface appears to you. Select a theme below.
        </p>

        <div className="mt-6">
          <label className="block text-sm font-medium mb-3">Theme</label>
          <ThemeToggleLarge />
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-muted">
          <h3 className="text-sm font-medium mb-2">Theme Preview</h3>
          <div className="grid grid-cols-1 gap-4">
            {/* Light Theme Preview */}
            <div className="rounded-lg bg-white p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-900 mb-2">Light Theme</p>
              <div className="flex gap-2 text-xs">
                <div className="px-2 py-1 bg-blue-100 text-blue-900 rounded">Primary</div>
                <div className="px-2 py-1 bg-gray-100 text-gray-900 rounded">Secondary</div>
              </div>
            </div>

            {/* Dark Theme Preview */}
            <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
              <p className="text-xs font-semibold text-slate-100 mb-2">Dark Theme</p>
              <div className="flex gap-2 text-xs">
                <div className="px-2 py-1 bg-blue-900 text-blue-100 rounded">Primary</div>
                <div className="px-2 py-1 bg-slate-800 text-slate-100 rounded">Secondary</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Your theme preference is automatically saved to your browser.
          </p>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how you interact with Neolith.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
            <span className="text-sm font-medium">Enable animations</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
            <span className="text-sm font-medium">Compact sidebar</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
            <span className="text-sm font-medium">Show helpful hints</span>
          </label>
        </div>
      </div>
    </div>
  );
}
