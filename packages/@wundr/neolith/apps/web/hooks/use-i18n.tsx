'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

import {
  t as translate,
  formatDate,
  formatTime,
  formatNumber,
  formatCurrency,
  formatRelativeTime,
  detectBrowserLocale,
  type SupportedLocale,
} from '@/lib/i18n';

/**
 * Return type for the useI18n hook
 */
export interface UseI18nReturn {
  /** Current locale */
  locale: SupportedLocale;
  /** Set the locale */
  setLocale: (locale: SupportedLocale) => void;
  /** Translate a key with optional interpolation values */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Format a date according to the current locale */
  formatDate: (date: Date) => string;
  /** Format a time according to the current locale */
  formatTime: (date: Date) => string;
  /** Format a number according to the current locale */
  formatNumber: (num: number) => string;
  /** Format a currency amount according to the current locale */
  formatCurrency: (amount: number, currency?: string) => string;
  /** Format a date as relative time (e.g., "2 hours ago") */
  formatRelativeTime: (date: Date) => string;
}

/**
 * Return type for the useTranslation hook
 */
export interface UseTranslationReturn {
  /** Translate a key with optional interpolation values */
  t: (key: string, values?: Record<string, string | number>) => string;
}

type I18nContextValue = UseI18nReturn;

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    initialLocale || detectBrowserLocale()
  );

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      localStorage.setItem('preferred-locale', newLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      return translate(key, values);
    },
    [locale]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    formatDate: (date: Date) => formatDate(date),
    formatTime: (date: Date) => formatTime(date),
    formatNumber: (num: number) => formatNumber(num),
    formatCurrency: (amount: number, currency?: string) =>
      formatCurrency(amount, currency),
    formatRelativeTime: (date: Date) => formatRelativeTime(date),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): UseI18nReturn {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export function useTranslation(): UseTranslationReturn {
  const { t } = useI18n();
  return { t };
}
