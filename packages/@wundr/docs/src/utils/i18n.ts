/**
 * Internationalization utilities for Wundr Documentation
 */

export interface SupportedLocales {
  en: 'English';
  es: 'Español';
  fr: 'Français';
  de: 'Deutsch';
}

export const SUPPORTED_LOCALES: Record<keyof SupportedLocales, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const DEFAULT_LOCALE = 'en';

export function getLocalizedPath(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  return `/${locale}${path === '/' ? '' : path}`;
}

export function getLocaleFromPath(path: string): string {
  const pathSegments = path.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  
  if (firstSegment && Object.keys(SUPPORTED_LOCALES).includes(firstSegment)) {
    return firstSegment;
  }
  
  return DEFAULT_LOCALE;
}

export function stripLocaleFromPath(path: string): string {
  const locale = getLocaleFromPath(path);
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  
  return path.replace(new RegExp(`^/${locale}`), '') || '/';
}

export function isLocaleSupported(locale: string): locale is keyof SupportedLocales {
  return Object.keys(SUPPORTED_LOCALES).includes(locale);
}
