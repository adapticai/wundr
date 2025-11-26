/**
 * Theme Storage Utility
 * Handles theme persistence for web (localStorage) and mobile (Capacitor Preferences)
 */

export async function getStoredTheme(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Check if running in Capacitor
  if ('Capacitor' in window) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'theme' });
      return value;
    } catch {
      // Fall back to localStorage
    }
  }

  return localStorage.getItem('theme');
}

export async function setStoredTheme(theme: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Check if running in Capacitor
  if ('Capacitor' in window) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'theme', value: theme });
      return;
    } catch {
      // Fall back to localStorage
    }
  }

  localStorage.setItem('theme', theme);
}
