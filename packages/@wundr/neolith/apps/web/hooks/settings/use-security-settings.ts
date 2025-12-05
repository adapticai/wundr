'use client';

/**
 * @neolith/hooks/settings/use-security-settings
 *
 * Hook for managing security settings including 2FA, session management,
 * and security alerts.
 *
 * @module hooks/settings/use-security-settings
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActive: Date;
  isCurrent: boolean;
}

/**
 * Two-factor authentication status
 */
export interface TwoFactorStatus {
  enabled: boolean;
  method: 'totp' | 'sms' | null;
  backupCodes: number;
  lastVerified: Date | null;
}

/**
 * Security settings state
 */
export interface SecuritySettings {
  twoFactor: TwoFactorStatus;
  sessions: SessionInfo[];
  loginAlerts: boolean;
  unusualActivityAlerts: boolean;
  passwordLastChanged: Date | null;
  recoveryEmail: string | null;
  recoveryPhone: string | null;
}

/**
 * Return type for useSecuritySettings hook
 */
export interface UseSecuritySettingsReturn {
  /** Current security settings */
  settings: SecuritySettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Error loading settings */
  error: Error | null;
  /** Refresh security settings */
  refresh: () => Promise<void>;
  /** Enable 2FA with method */
  enable2FA: (method: 'totp' | 'sms') => Promise<void>;
  /** Disable 2FA */
  disable2FA: () => Promise<void>;
  /** Regenerate backup codes */
  regenerateBackupCodes: () => Promise<string[]>;
  /** Revoke a session */
  revokeSession: (sessionId: string) => Promise<void>;
  /** Revoke all other sessions */
  revokeAllOtherSessions: () => Promise<void>;
  /** Toggle login alerts */
  toggleLoginAlerts: () => Promise<void>;
  /** Toggle unusual activity alerts */
  toggleUnusualActivityAlerts: () => Promise<void>;
  /** Whether any action is in progress */
  isUpdating: boolean;
}

/**
 * Hook for managing security settings
 *
 * Provides comprehensive security controls including 2FA management,
 * session monitoring, and security alert configuration.
 *
 * @returns Security settings and management methods
 *
 * @example
 * ```tsx
 * function SecurityPanel() {
 *   const {
 *     settings,
 *     enable2FA,
 *     disable2FA,
 *     revokeSession,
 *     revokeAllOtherSessions,
 *     toggleLoginAlerts,
 *   } = useSecuritySettings();
 *
 *   return (
 *     <div>
 *       <h2>Two-Factor Authentication</h2>
 *       {settings?.twoFactor.enabled ? (
 *         <div>
 *           <Badge>Enabled</Badge>
 *           <p>Method: {settings.twoFactor.method}</p>
 *           <Button onClick={disable2FA}>Disable 2FA</Button>
 *         </div>
 *       ) : (
 *         <Button onClick={() => enable2FA('totp')}>Enable 2FA</Button>
 *       )}
 *
 *       <h2>Active Sessions</h2>
 *       {settings?.sessions.map((session) => (
 *         <div key={session.id}>
 *           <p>{session.deviceName} - {session.location}</p>
 *           {!session.isCurrent && (
 *             <Button onClick={() => revokeSession(session.id)}>
 *               Revoke
 *             </Button>
 *           )}
 *         </div>
 *       ))}
 *       <Button onClick={revokeAllOtherSessions}>
 *         Revoke All Other Sessions
 *       </Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSecuritySettings(): UseSecuritySettingsReturn {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch security settings
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/security');

      if (!response.ok) {
        throw new Error('Failed to fetch security settings');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch security settings');
      }

      // Transform API response to SecuritySettings
      const data = result.data;
      setSettings({
        twoFactor: {
          enabled: data.twoFactorEnabled ?? false,
          method: data.twoFactorMethod ?? null,
          backupCodes: data.backupCodesRemaining ?? 0,
          lastVerified: data.twoFactorLastVerified
            ? new Date(data.twoFactorLastVerified)
            : null,
        },
        sessions: (data.sessions || []).map((s: unknown) => ({
          id: (s as { id: string }).id,
          deviceName:
            (s as { deviceName: string }).deviceName || 'Unknown Device',
          browser: (s as { browser: string }).browser || 'Unknown',
          os: (s as { os: string }).os || 'Unknown',
          ipAddress: (s as { ipAddress: string }).ipAddress || '',
          location: (s as { location: string }).location || 'Unknown',
          lastActive: new Date((s as { lastActive: string }).lastActive),
          isCurrent: (s as { isCurrent: boolean }).isCurrent ?? false,
        })),
        loginAlerts: data.loginAlerts ?? true,
        unusualActivityAlerts: data.unusualActivityAlerts ?? true,
        passwordLastChanged: data.passwordLastChanged
          ? new Date(data.passwordLastChanged)
          : null,
        recoveryEmail: data.recoveryEmail ?? null,
        recoveryPhone: data.recoveryPhone ?? null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Refresh settings
  const refresh = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  // Enable 2FA
  const enable2FA = useCallback(
    async (method: 'totp' | 'sms') => {
      try {
        setIsUpdating(true);

        const response = await fetch('/api/user/2fa/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method }),
        });

        if (!response.ok) {
          throw new Error('Failed to enable 2FA');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh]
  );

  // Disable 2FA
  const disable2FA = useCallback(async () => {
    try {
      setIsUpdating(true);

      const response = await fetch('/api/user/2fa/disable', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disable 2FA');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [refresh]);

  // Regenerate backup codes
  const regenerateBackupCodes = useCallback(async (): Promise<string[]> => {
    try {
      setIsUpdating(true);

      const response = await fetch('/api/user/2fa/backup-codes', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to regenerate backup codes');
      }

      await refresh();
      return result.data.codes;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [refresh]);

  // Revoke a session
  const revokeSession = useCallback(
    async (sessionId: string) => {
      try {
        setIsUpdating(true);

        const response = await fetch(`/api/user/sessions/${sessionId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to revoke session');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh]
  );

  // Revoke all other sessions
  const revokeAllOtherSessions = useCallback(async () => {
    try {
      setIsUpdating(true);

      const response = await fetch('/api/user/sessions/revoke-all', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [refresh]);

  // Toggle login alerts
  const toggleLoginAlerts = useCallback(async () => {
    try {
      setIsUpdating(true);

      const newValue = !settings?.loginAlerts;

      const response = await fetch('/api/user/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginAlerts: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update login alerts');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [settings?.loginAlerts, refresh]);

  // Toggle unusual activity alerts
  const toggleUnusualActivityAlerts = useCallback(async () => {
    try {
      setIsUpdating(true);

      const newValue = !settings?.unusualActivityAlerts;

      const response = await fetch('/api/user/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unusualActivityAlerts: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update unusual activity alerts');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [settings?.unusualActivityAlerts, refresh]);

  return {
    settings,
    isLoading,
    error,
    refresh,
    enable2FA,
    disable2FA,
    regenerateBackupCodes,
    revokeSession,
    revokeAllOtherSessions,
    toggleLoginAlerts,
    toggleUnusualActivityAlerts,
    isUpdating,
  };
}
