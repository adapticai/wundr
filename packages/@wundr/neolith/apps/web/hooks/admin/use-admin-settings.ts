'use client';

/**
 * Hook for managing workspace admin settings
 * @module hooks/admin/use-admin-settings
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';

import type {
  WorkspaceAdminSettings,
  GeneralSettings,
  NotificationSettings,
  SecuritySettings,
  IntegrationSettings,
} from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * Settings section type
 */
export type SettingsSection = 'general' | 'notifications' | 'security' | 'integrations' | 'all';

/**
 * Return type for useAdminSettings hook
 */
export interface UseAdminSettingsReturn {
  /** Complete settings object */
  settings: WorkspaceAdminSettings | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Update general settings */
  updateGeneral: (updates: Partial<GeneralSettings>) => Promise<void>;
  /** Update notification settings */
  updateNotifications: (updates: Partial<NotificationSettings>) => Promise<void>;
  /** Update security settings */
  updateSecurity: (updates: Partial<SecuritySettings>) => Promise<void>;
  /** Update integration settings */
  updateIntegrations: (updates: Partial<IntegrationSettings>) => Promise<void>;
  /** Update custom fields */
  updateCustomFields: (fields: Record<string, unknown>) => Promise<void>;
  /** Update any section */
  updateSettings: (section: SettingsSection, updates: Partial<WorkspaceAdminSettings[keyof WorkspaceAdminSettings]>) => Promise<void>;
  /** Reset settings to defaults */
  resetSettings: (section?: SettingsSection) => Promise<void>;
  /** Manually refresh settings */
  refresh: () => Promise<void>;
  /** Whether any update is in progress */
  isUpdating: boolean;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Fetcher function with error handling
 */
const settingsFetcher = async (url: string): Promise<WorkspaceAdminSettings> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to fetch settings');
  }

  const result = await res.json();
  return (result.data || result) as WorkspaceAdminSettings;
};

// =============================================================================
// Hook: useAdminSettings
// =============================================================================

/**
 * Hook for managing workspace admin settings
 *
 * Provides comprehensive settings management with section-specific updates,
 * optimistic updates, and reset capabilities.
 *
 * @param workspaceId - The workspace ID
 * @returns Settings data and management functions
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const {
 *     settings,
 *     isLoading,
 *     updateGeneral,
 *     updateSecurity,
 *     resetSettings,
 *     isUpdating,
 *   } = useAdminSettings('workspace-123');
 *
 *   const handleUpdateGeneral = async (values: Partial<GeneralSettings>) => {
 *     try {
 *       await updateGeneral(values);
 *       toast.success('Settings updated');
 *     } catch (error) {
 *       toast.error('Failed to update settings');
 *     }
 *   };
 *
 *   return (
 *     <Tabs>
 *       <TabPanel title="General">
 *         <GeneralSettingsForm
 *           data={settings?.general}
 *           onSubmit={handleUpdateGeneral}
 *           isLoading={isUpdating}
 *         />
 *       </TabPanel>
 *       <TabPanel title="Security">
 *         <SecuritySettingsForm
 *           data={settings?.security}
 *           onSubmit={updateSecurity}
 *         />
 *       </TabPanel>
 *     </Tabs>
 *   );
 * }
 * ```
 */
export function useAdminSettings(workspaceId: string): UseAdminSettingsReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const url = `/api/workspaces/${workspaceId}/admin/settings`;

  const { data, error, isLoading, mutate } = useSWR<WorkspaceAdminSettings>(
    url,
    settingsFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Generic update function
  const updateSettings = useCallback(
    async (
      section: SettingsSection,
      updates: Partial<WorkspaceAdminSettings[keyof WorkspaceAdminSettings]>
    ) => {
      try {
        setIsUpdating(true);

        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, updates }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to update settings');
        }

        // Optimistic update
        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update settings');
      } finally {
        setIsUpdating(false);
      }
    },
    [url, mutate]
  );

  // Update general settings
  const updateGeneral = useCallback(
    async (updates: Partial<GeneralSettings>) => {
      await updateSettings('general', updates);
    },
    [updateSettings]
  );

  // Update notification settings
  const updateNotifications = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      await updateSettings('notifications', updates);
    },
    [updateSettings]
  );

  // Update security settings
  const updateSecurity = useCallback(
    async (updates: Partial<SecuritySettings>) => {
      await updateSettings('security', updates);
    },
    [updateSettings]
  );

  // Update integration settings
  const updateIntegrations = useCallback(
    async (updates: Partial<IntegrationSettings>) => {
      await updateSettings('integrations', updates);
    },
    [updateSettings]
  );

  // Update custom fields
  const updateCustomFields = useCallback(
    async (fields: Record<string, unknown>) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`${url}/custom-fields`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customFields: fields }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to update custom fields');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update custom fields');
      } finally {
        setIsUpdating(false);
      }
    },
    [url, mutate]
  );

  // Reset settings to defaults
  const resetSettings = useCallback(
    async (section?: SettingsSection) => {
      try {
        setIsUpdating(true);

        const resetUrl = section
          ? `${url}/reset?section=${section}`
          : `${url}/reset`;

        const res = await fetch(resetUrl, {
          method: 'POST',
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to reset settings');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to reset settings');
      } finally {
        setIsUpdating(false);
      }
    },
    [url, mutate]
  );

  return {
    settings: data ?? null,
    isLoading,
    error: error as Error | null,
    updateGeneral,
    updateNotifications,
    updateSecurity,
    updateIntegrations,
    updateCustomFields,
    updateSettings,
    resetSettings,
    refresh,
    isUpdating,
  };
}
