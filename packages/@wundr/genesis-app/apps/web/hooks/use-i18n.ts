'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translate, formatDate, formatTime, formatNumber, formatCurrency, formatRelativeTime, detectBrowserLocale, SupportedLocale, DEFAULT_LOCALE } from '@/lib/i18n';

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
  formatNumber: (num: number) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (date: Date) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: SupportedLocale }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale || detectBrowserLocale());

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
      localStorage.setItem('preferred-locale', newLocale);
    }
  }, []);

  const t = useCallback((key: string, values?: Record<string, string | number>) => {
    return translate(key, locale, values);
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    formatDate: (date: Date) => formatDate(date, locale),
    formatTime: (date: Date) => formatTime(date, locale),
    formatNumber: (num: number) => formatNumber(num, locale),
    formatCurrency: (amount: number, currency?: string) => formatCurrency(amount, currency, locale),
    formatRelativeTime: (date: Date) => formatRelativeTime(date, locale),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}

export function useTranslation() {
  const { t } = useI18n();
  return { t };
}
