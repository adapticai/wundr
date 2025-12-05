/**
 * Settings Backup and Restore Utilities
 * Handles import/export of user settings and data
 */

export interface BackupMetadata {
  version: string;
  timestamp: string;
  userId: string;
  workspaceId?: string;
  categories: string[];
  platform: 'neolith' | 'slack' | 'discord' | 'other';
}

export interface SettingsBackup {
  metadata: BackupMetadata;
  data: {
    profile?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    appearance?: Record<string, unknown>;
    notifications?: Record<string, unknown>;
    privacy?: Record<string, unknown>;
    security?: Record<string, unknown>;
    accessibility?: Record<string, unknown>;
    audioVideo?: Record<string, unknown>;
    language?: Record<string, unknown>;
    keyboardShortcuts?: Record<string, unknown>;
    conversations?: ConversationBackup[];
    customData?: Record<string, unknown>;
  };
}

export interface ConversationBackup {
  id: string;
  channelName: string;
  messages: MessageBackup[];
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageBackup {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  attachments?: AttachmentBackup[];
}

export interface AttachmentBackup {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  maxBackups: number;
  includeConversations: boolean;
  categories: string[];
}

/**
 * Export settings to JSON format
 */
export async function exportSettings(
  categories: string[] = ['all'],
  includeConversations = false,
): Promise<string> {
  const response = await fetch('/api/settings/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories, includeConversations }),
  });

  if (!response.ok) {
    throw new Error('Failed to export settings');
  }

  const backup: SettingsBackup = await response.json();
  return JSON.stringify(backup, null, 2);
}

/**
 * Import settings from JSON string
 */
export async function importSettings(
  jsonData: string,
  options: {
    overwrite?: boolean;
    merge?: boolean;
    categories?: string[];
  } = {},
): Promise<{ success: boolean; imported: string[]; skipped: string[] }> {
  let backup: SettingsBackup;

  try {
    backup = JSON.parse(jsonData);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  // Validate backup structure
  if (!backup.metadata || !backup.data) {
    throw new Error('Invalid backup format');
  }

  const response = await fetch('/api/settings/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backup, options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to import settings');
  }

  return response.json();
}

/**
 * Download settings as JSON file
 */
export function downloadSettingsFile(
  jsonData: string,
  filename?: string,
): void {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download =
    filename || `neolith-settings-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read JSON file from input
 */
export function readSettingsFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      reject(new Error('Please select a JSON file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = e => {
      const content = e.target?.result as string;
      if (!content) {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(content);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Get list of available backups
 */
export async function getBackupHistory(): Promise<
  Array<{
    id: string;
    timestamp: string;
    categories: string[];
    size: number;
    automatic: boolean;
  }>
> {
  const response = await fetch('/api/settings/backups');

  if (!response.ok) {
    throw new Error('Failed to fetch backup history');
  }

  return response.json();
}

/**
 * Restore from a specific backup
 */
export async function restoreFromBackup(
  backupId: string,
  categories?: string[],
): Promise<{ success: boolean; restored: string[] }> {
  const response = await fetch(`/api/settings/backups/${backupId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });

  if (!response.ok) {
    throw new Error('Failed to restore backup');
  }

  return response.json();
}

/**
 * Delete a backup
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const response = await fetch(`/api/settings/backups/${backupId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete backup');
  }
}

/**
 * Download a specific backup
 */
export async function downloadBackup(backupId: string): Promise<void> {
  const response = await fetch(`/api/settings/backups/${backupId}/download`);

  if (!response.ok) {
    throw new Error('Failed to download backup');
  }

  const backup = await response.json();
  const jsonData = JSON.stringify(backup, null, 2);
  downloadSettingsFile(jsonData, `backup-${backupId}.json`);
}

/**
 * Configure automatic backups
 */
export async function configureAutoBackup(
  config: AutoBackupConfig,
): Promise<void> {
  const response = await fetch('/api/settings/backups/auto-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error('Failed to configure automatic backups');
  }
}

/**
 * Get auto backup configuration
 */
export async function getAutoBackupConfig(): Promise<AutoBackupConfig> {
  const response = await fetch('/api/settings/backups/auto-config');

  if (!response.ok) {
    throw new Error('Failed to get auto backup config');
  }

  return response.json();
}

/**
 * Validate backup data
 */
export function validateBackup(backup: SettingsBackup): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!backup.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!backup.metadata.version) errors.push('Missing version in metadata');
    if (!backup.metadata.timestamp)
      errors.push('Missing timestamp in metadata');
    if (!backup.metadata.userId) errors.push('Missing userId in metadata');
  }

  if (!backup.data) {
    errors.push('Missing data');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert Slack export to Neolith format
 */
export function convertSlackExport(slackData: unknown): SettingsBackup {
  // Basic conversion logic - expand based on Slack export format
  const now = new Date().toISOString();

  return {
    metadata: {
      version: '1.0.0',
      timestamp: now,
      userId: 'imported',
      categories: ['conversations'],
      platform: 'slack',
    },
    data: {
      conversations: [],
      customData: { slackImport: slackData },
    },
  };
}

/**
 * Convert Discord export to Neolith format
 */
export function convertDiscordExport(discordData: unknown): SettingsBackup {
  // Basic conversion logic - expand based on Discord export format
  const now = new Date().toISOString();

  return {
    metadata: {
      version: '1.0.0',
      timestamp: now,
      userId: 'imported',
      categories: ['conversations'],
      platform: 'discord',
    },
    data: {
      conversations: [],
      customData: { discordImport: discordData },
    },
  };
}

/**
 * Get settings categories
 */
export const SETTINGS_CATEGORIES = [
  { id: 'profile', label: 'Profile', description: 'Name, email, avatar' },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Workspace preferences',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme, colors, display',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Notification settings',
  },
  { id: 'privacy', label: 'Privacy', description: 'Privacy settings' },
  {
    id: 'security',
    label: 'Security',
    description: 'Password, 2FA, sessions',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Accessibility options',
  },
  {
    id: 'audioVideo',
    label: 'Audio & Video',
    description: 'Audio/video settings',
  },
  {
    id: 'language',
    label: 'Language',
    description: 'Language and region',
  },
  {
    id: 'keyboardShortcuts',
    label: 'Keyboard Shortcuts',
    description: 'Custom shortcuts',
  },
  {
    id: 'conversations',
    label: 'Conversations',
    description: 'Chat history',
  },
] as const;

/**
 * Calculate backup size estimate
 */
export function estimateBackupSize(categories: string[]): number {
  // Rough estimates in KB
  const categorySize: Record<string, number> = {
    profile: 5,
    preferences: 3,
    appearance: 2,
    notifications: 4,
    privacy: 2,
    security: 3,
    accessibility: 2,
    audioVideo: 3,
    language: 2,
    keyboardShortcuts: 5,
    conversations: 500, // Can be large
  };

  return categories.reduce(
    (total, cat) => total + (categorySize[cat] || 0),
    10,
  ); // 10KB base overhead
}
