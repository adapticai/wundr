'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/** Accessibility preferences */
export interface A11yPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  focusIndicators: 'default' | 'enhanced';
}

const defaultPreferences: A11yPreferences = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  focusIndicators: 'default',
};

interface A11yContextValue {
  preferences: A11yPreferences;
  setPreference: <K extends keyof A11yPreferences>(key: K, value: A11yPreferences[K]) => void;
}

const A11yContext = createContext<A11yContextValue | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
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
      } catch {}
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

export function useA11y() {
  const context = useContext(A11yContext);
  if (!context) throw new Error('useA11y must be used within A11yProvider');
  return context;
}

/** Skip to main content link */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: { href?: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
    >
      {children}
    </a>
  );
}

/** Screen reader only text */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Live region for screen reader announcements */
export function LiveRegion({ 
  children, 
  politeness = 'polite',
  atomic = true 
}: { 
  children: ReactNode; 
  politeness?: 'off' | 'polite' | 'assertive';
  atomic?: boolean;
}) {
  return (
    <div aria-live={politeness} aria-atomic={atomic} className="sr-only">
      {children}
    </div>
  );
}

/** Focus trap for modals */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

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

/** Announce to screen readers */
export function useAnnounce() {
  const announce = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
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
