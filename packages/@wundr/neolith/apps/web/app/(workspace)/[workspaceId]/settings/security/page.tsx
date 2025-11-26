'use client';

import { useState } from 'react';

export default function SecuritySettingsPage() {
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    showOnlineStatus: true,
    loginAlerts: true,
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sessions] = useState([
    {
      id: '1',
      device: 'Chrome on macOS',
      location: 'San Francisco, CA',
      lastActive: 'Active now',
      current: true,
    },
    {
      id: '2',
      device: 'Firefox on Windows',
      location: 'New York, NY',
      lastActive: '2 days ago',
      current: false,
    },
    {
      id: '3',
      device: 'Safari on iPhone',
      location: 'Los Angeles, CA',
      lastActive: '1 week ago',
      current: false,
    },
  ]);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
  };

  const handleSelectChange = (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRevokeSession = (sessionId: string) => {
    // Would call API to revoke session
    console.log('Revoking session:', sessionId);
  };

  const handleRevokeAllSessions = () => {
    // Would call API to revoke all other sessions
    console.log('Revoking all other sessions');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account security and privacy settings.
        </p>
      </div>

      {/* Password Section */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Change your password to keep your account secure.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add an extra layer of security to your account.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Enable 2FA</span>
              <p className="text-xs text-muted-foreground">
                Require a verification code when signing in
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.twoFactorEnabled}
              onChange={() => handleToggle('twoFactorEnabled')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          {settings.twoFactorEnabled && (
            <div className="rounded-lg bg-muted/50 p-4 border border-muted">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Two-factor authentication is enabled
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your account is protected with an authenticator app.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                >
                  Reconfigure 2FA
                </button>
                <span className="text-xs text-muted-foreground">|</span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                >
                  Disable 2FA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Settings */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Session Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how your sessions behave.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Session timeout</span>
              <p className="text-xs text-muted-foreground">
                Automatically sign out after inactivity
              </p>
            </div>
            <select
              value={settings.sessionTimeout}
              onChange={(e) => handleSelectChange('sessionTimeout', e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="never">Never</option>
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Login alerts</span>
              <p className="text-xs text-muted-foreground">
                Get notified when someone signs in to your account
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.loginAlerts}
              onChange={() => handleToggle('loginAlerts')}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Devices where you&apos;re currently signed in.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRevokeAllSessions}
            className="text-sm text-destructive hover:underline"
          >
            Sign out all other sessions
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <DeviceIcon />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {session.device}
                    {session.current && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.location} · {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  className="text-sm text-destructive hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control your privacy settings.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Show online status</span>
              <p className="text-xs text-muted-foreground">
                Let others see when you&apos;re online
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showOnlineStatus}
              onChange={() => handleToggle('showOnlineStatus')}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Irreversible actions that affect your account.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Delete account</span>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal - simplified version */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Change Password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your current password and a new password.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium">
                  Current password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium">
                  New password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium">
                  Confirm new password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceIcon() {
  return (
    <svg
      className="h-5 w-5 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
