'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

/**
 * Accessibility preferences - matches @genesis/core/types AccessibilityPreferences
 */
export interface A11yPreferences {
  /** Whether to reduce motion for animations */
  reduceMotion: boolean;
  /** Whether to use high contrast mode */
  highContrast: boolean;
  /** Whether to use larger text */
  largeText: boolean;
  /** Whether screen reader mode is enabled */
  screenReaderMode: boolean;
  /** Focus indicator style preference */
  focusIndicators: 'default' | 'enhanced';
  /** Color blind mode type */
  colorBlindMode?: 'protanopia' | 'deuteranopia' | 'tritanopia';
}

const defaultPreferences: A11yPreferences = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderMode: false,
  focusIndicators: 'default',
};

/**
 * Context value for accessibility settings
 */
interface A11yContextValue {
  /** Current accessibility preferences */
  preferences: A11yPreferences;
  /** Function to update a specific preference */
  setPreference: <K extends keyof A11yPreferences>(key: K, value: A11yPreferences[K]) => void;
}

const A11yContext = createContext<A11yContextValue | null>(null);

/**
 * Props for the A11yProvider component
 */
export interface A11yProviderProps {
  /** Children to wrap with accessibility context */
  children: ReactNode;
}

/**
 * Accessibility provider that manages user preferences
 */
export function A11yProvider({ children }: A11yProviderProps) {
  const [preferences, setPreferences] = useState<A11yPreferences>(defaultPreferences);

  useEffect(() => {
    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
    
    setPreferences(prev => ({
      ...prev,
      reduceMotion: prefersReducedMotion,
      highContrast: prefersContrast,
    }));

    // Load saved preferences
    const saved = localStorage.getItem('a11y-preferences');
    if (saved) {
      try {
        setPreferences(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch {
        // Ignore JSON parse errors for corrupted localStorage
      }
    }
  }, []);

  useEffect(() => {
    // Apply preferences to document
    document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion);
    document.documentElement.classList.toggle('high-contrast', preferences.highContrast);
    document.documentElement.classList.toggle('large-text', preferences.largeText);
    document.documentElement.classList.toggle('enhanced-focus', preferences.focusIndicators === 'enhanced');
    
    localStorage.setItem('a11y-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const setPreference = <K extends keyof A11yPreferences>(key: K, value: A11yPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <A11yContext.Provider value={{ preferences, setPreference }}>
      {children}
    </A11yContext.Provider>
  );
}

/**
 * Hook to access accessibility context
 * @returns Accessibility context with preferences and setter
 * @throws Error if used outside A11yProvider
 */
export function useA11y(): A11yContextValue {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error('useA11y must be used within A11yProvider');
  }
  return context;
}

/**
 * Props for the SkipLink component
 */
export interface SkipLinkProps {
  /** Target anchor ID */
  href?: string;
  /** Link text content */
  children?: ReactNode;
}

/**
 * Skip to main content link for keyboard navigation
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
    >
      {children}
    </a>
  );
}

/**
 * Props for the VisuallyHidden component
 */
export interface VisuallyHiddenProps {
  /** Content only visible to screen readers */
  children: ReactNode;
}

/**
 * Screen reader only text - visually hidden but accessible
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="sr-only">{children}</span>;
}

/**
 * Props for the LiveRegion component
 */
export interface LiveRegionProps {
  /** Content to announce */
  children: ReactNode;
  /** ARIA live politeness level */
  politeness?: 'off' | 'polite' | 'assertive';
  /** Whether the entire region should be announced */
  atomic?: boolean;
}

/**
 * Live region for screen reader announcements
 */
export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
}: LiveRegionProps) {
  return (
    <div aria-live={politeness} aria-atomic={atomic} className="sr-only">
      {children}
    </div>
  );
}

/**
 * Focus trap hook for modal dialogs
 * @param containerRef - Reference to the container element
 * @param active - Whether the focus trap is active
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    if (!active || !containerRef.current) {
return;
}

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') {
return;
}

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    firstElement?.focus();
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}

/**
 * Announce function type for screen reader announcements
 */
export type AnnounceFn = (message: string, politeness?: 'polite' | 'assertive') => void;

/**
 * Hook to announce messages to screen readers
 * @returns Function to announce messages
 */
export function useAnnounce(): AnnounceFn {
  const announce: AnnounceFn = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const el = document.createElement('div');
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  };
  return announce;
}
