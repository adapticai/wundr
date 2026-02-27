/**
 * Internationalization (i18n) Utilities
 */

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

// Alias for compatibility
export type SupportedLocale = Locale;

export type TranslationKey = string;

export type TranslationParams = Record<string, string | number>;

export type Translations = Record<TranslationKey, string>;

export type LocaleData = {
  locale: Locale;
  translations: Translations;
};

// Built-in baseline translations (English) that are always available without a
// dynamic import.  Other locales can be loaded at runtime via loadTranslations.
const STATIC_TRANSLATIONS: Partial<Record<Locale, Translations>> = {
  en: {},
};

// Simple translation store
class I18nStore {
  private currentLocale: Locale = 'en';
  private translations: Map<Locale, Translations> = new Map();
  private fallbackLocale: Locale = 'en';

  setLocale(locale: Locale): void {
    console.log('[i18n] Setting locale:', locale);
    this.currentLocale = locale;
    // Load translations for the locale if not already loaded
    if (!this.translations.has(locale)) {
      this.loadTranslations(locale).catch(err => {
        console.warn(
          '[i18n] Failed to load translations for locale:',
          locale,
          err
        );
      });
    }
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  setFallbackLocale(locale: Locale): void {
    console.log('[i18n] Setting fallback locale:', locale);
    this.fallbackLocale = locale;
  }

  addTranslations(locale: Locale, translations: Translations): void {
    console.log('[i18n] Adding translations for locale:', locale);
    const existing = this.translations.get(locale) || {};
    this.translations.set(locale, { ...existing, ...translations });
  }

  translate(key: TranslationKey, params?: TranslationParams): string {
    const localeTranslations = this.translations.get(this.currentLocale);
    let translation = localeTranslations?.[key];

    // Fallback to fallback locale if translation not found
    if (!translation && this.currentLocale !== this.fallbackLocale) {
      const fallbackTranslations = this.translations.get(this.fallbackLocale);
      translation = fallbackTranslations?.[key];
    }

    // Return key if no translation found
    if (!translation) {
      console.warn(`[i18n] Translation not found for key: ${key}`);
      return key;
    }

    // Replace parameters in translation
    if (params) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  private interpolate(text: string, params: TranslationParams): string {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() ?? match;
    });
  }

  async loadTranslations(locale: Locale): Promise<void> {
    console.log('[i18n] Loading translations for locale:', locale);

    // First check the static (bundled) translations map
    const staticTranslations = STATIC_TRANSLATIONS[locale];
    if (staticTranslations) {
      this.addTranslations(locale, staticTranslations);
      return;
    }

    // Fall back to an empty object so the store always has an entry for the
    // locale (prevents repeated failed import attempts)
    this.addTranslations(locale, {});

    // Attempt a dynamic import for locale-specific JSON files.
    // The import path follows the convention ../locales/<locale>.json relative
    // to this file's location.  A try/catch prevents unhandled rejections when
    // the file does not exist.
    await loadDynamicTranslations(locale).then(translations => {
      if (Object.keys(translations).length > 0) {
        this.addTranslations(locale, translations);
      }
    });
  }

  hasTranslation(key: TranslationKey, locale: Locale): boolean {
    const localeTranslations = this.translations.get(locale);
    return localeTranslations !== undefined && key in localeTranslations;
  }
}

// Singleton instance
const i18nStore = new I18nStore();

/**
 * Translate a key to the current locale
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return i18nStore.translate(key, params);
}

/**
 * Set the current locale
 */
export function setLocale(locale: Locale): void {
  i18nStore.setLocale(locale);
}

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  return i18nStore.getLocale();
}

/**
 * Set the fallback locale
 */
export function setFallbackLocale(locale: Locale): void {
  i18nStore.setFallbackLocale(locale);
}

/**
 * Add translations for a locale
 */
export function addTranslations(
  locale: Locale,
  translations: Translations
): void {
  i18nStore.addTranslations(locale, translations);
}

/**
 * Load translations for a locale dynamically
 */
export async function loadTranslations(locale: Locale): Promise<void> {
  return i18nStore.loadTranslations(locale);
}

/**
 * Attempt to load translations via a dynamic import.
 * Returns an empty object when the locale file does not exist.
 */
async function loadDynamicTranslations(locale: Locale): Promise<Translations> {
  try {
    // Dynamic import resolves at runtime; the path is relative to this module.
    // Bundlers (webpack/turbopack) will include any statically-analysable locale
    // files found at build time.
    const module = await import(`../locales/${locale}.json`);
    const translations = module?.default ?? module ?? {};
    console.log('[i18n] Dynamically loaded translations for locale:', locale);
    return translations as Translations;
  } catch {
    // File does not exist or failed to parse – this is expected for locales
    // that have not yet been created.
    console.warn('[i18n] No translation file found for locale:', locale);
    return {};
  }
}

/**
 * Check if a translation exists for a key
 */
export function hasTranslation(key: TranslationKey, locale?: Locale): boolean {
  const targetLocale = locale || getLocale();
  console.log('[i18n] Checking translation exists:', key, targetLocale);
  return i18nStore.hasTranslation(key, targetLocale);
}

/**
 * Format number according to locale
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLocale();
  console.log('[i18n] Formatting number:', value, locale);
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format date according to locale
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const locale = getLocale();
  console.log('[i18n] Formatting date:', date, locale);
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

/**
 * Format currency according to locale
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLocale();
  console.log('[i18n] Formatting currency:', value, currency, locale);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

/**
 * Alias for t() function - translate a key
 */
export function translate(
  key: TranslationKey,
  params?: TranslationParams
): string {
  return t(key, params);
}

/**
 * Format time according to locale
 */
export function formatTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const locale = getLocale();
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  console.log('[i18n] Formatting time:', date, locale);
  return new Intl.DateTimeFormat(locale, timeOptions).format(new Date(date));
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | string,
  baseDate: Date = new Date()
): string {
  const locale = getLocale();
  const targetDate = new Date(date);
  const diffInSeconds = Math.floor(
    (targetDate.getTime() - baseDate.getTime()) / 1000
  );

  console.log('[i18n] Formatting relative time:', date, locale);

  // Simple implementation - can be enhanced with Intl.RelativeTimeFormat
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;

  if (Math.abs(diffInSeconds) < minute) {
    return rtf.format(diffInSeconds, 'second');
  } else if (Math.abs(diffInSeconds) < hour) {
    return rtf.format(Math.floor(diffInSeconds / minute), 'minute');
  } else if (Math.abs(diffInSeconds) < day) {
    return rtf.format(Math.floor(diffInSeconds / hour), 'hour');
  } else if (Math.abs(diffInSeconds) < week) {
    return rtf.format(Math.floor(diffInSeconds / day), 'day');
  } else if (Math.abs(diffInSeconds) < month) {
    return rtf.format(Math.floor(diffInSeconds / week), 'week');
  } else if (Math.abs(diffInSeconds) < year) {
    return rtf.format(Math.floor(diffInSeconds / month), 'month');
  } else {
    return rtf.format(Math.floor(diffInSeconds / year), 'year');
  }
}

/**
 * Detect browser locale from navigator
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'en'; // Default for SSR
  }

  const browserLocale = navigator.language || navigator.userLanguage || 'en';
  const languageCode = browserLocale.split('-')[0] as Locale;

  // Check if the detected locale is supported
  const supportedLocales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
  if (supportedLocales.includes(languageCode)) {
    return languageCode;
  }

  // Fallback to English
  return 'en';
}
