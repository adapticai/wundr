/**
 * Internationalization Types for Genesis-App
 * i18n, l10n, and accessibility
 */

/** Supported locales */
export type SupportedLocale = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ja-JP' | 'zh-CN' | 'pt-BR' | 'ko-KR' | 'it-IT';

/** Locale configuration */
export interface LocaleConfig {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  timeFormat: string;
  numberFormat: NumberFormatConfig;
  pluralRules: string;
}

/** Number format configuration */
export interface NumberFormatConfig {
  decimal: string;
  thousands: string;
  currency: string;
  currencySymbol: string;
}

/** Translation namespace */
export type TranslationNamespace = 'common' | 'auth' | 'channels' | 'messages' | 'settings' | 'admin' | 'errors' | 'notifications';

/** Translation key with namespace */
export type TranslationKey = `${TranslationNamespace}:${string}`;

/** Interpolation values */
export type InterpolationValues = Record<string, string | number | boolean>;

/** Translation function */
export type TranslateFunction = (key: string, values?: InterpolationValues) => string;

/** i18n context */
export interface I18nContext {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: TranslateFunction;
  formatDate: (date: Date, format?: string) => string;
  formatTime: (date: Date, format?: string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (date: Date) => string;
}

/** Locale detection source */
export type LocaleSource = 'browser' | 'user_preference' | 'workspace_default' | 'url' | 'cookie';

/** User locale preferences */
export interface UserLocalePreferences {
  preferredLocale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  timezone: string;
  use24HourTime: boolean;
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
}

/** Accessibility preferences */
export interface AccessibilityPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderMode: boolean;
  focusIndicators: 'default' | 'enhanced';
  colorBlindMode?: 'protanopia' | 'deuteranopia' | 'tritanopia';
}

/** Keyboard navigation config */
export interface KeyboardNavigationConfig {
  enabled: boolean;
  skipLinks: boolean;
  focusTrap: boolean;
  arrowNavigation: boolean;
}

/** ARIA live region config */
export interface LiveRegionConfig {
  politeness: 'off' | 'polite' | 'assertive';
  atomic: boolean;
  relevant: ('additions' | 'removals' | 'text' | 'all')[];
}

/** Locale data */
export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: 'en-US', name: 'English (US)', nativeName: 'English', direction: 'ltr', dateFormat: 'MM/DD/YYYY', timeFormat: 'h:mm A', numberFormat: { decimal: '.', thousands: ',', currency: 'USD', currencySymbol: '$' }, pluralRules: 'en' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: '.', thousands: ',', currency: 'GBP', currencySymbol: '£' }, pluralRules: 'en' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: ',', thousands: '.', currency: 'EUR', currencySymbol: '€' }, pluralRules: 'es' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: ',', thousands: ' ', currency: 'EUR', currencySymbol: '€' }, pluralRules: 'fr' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: ',', thousands: '.', currency: 'EUR', currencySymbol: '€' }, pluralRules: 'de' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', direction: 'ltr', dateFormat: 'YYYY/MM/DD', timeFormat: 'HH:mm', numberFormat: { decimal: '.', thousands: ',', currency: 'JPY', currencySymbol: '¥' }, pluralRules: 'ja' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文', direction: 'ltr', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', numberFormat: { decimal: '.', thousands: ',', currency: 'CNY', currencySymbol: '¥' }, pluralRules: 'zh' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: ',', thousands: '.', currency: 'BRL', currencySymbol: 'R$' }, pluralRules: 'pt' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', direction: 'ltr', dateFormat: 'YYYY.MM.DD', timeFormat: 'HH:mm', numberFormat: { decimal: '.', thousands: ',', currency: 'KRW', currencySymbol: '₩' }, pluralRules: 'ko' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberFormat: { decimal: ',', thousands: '.', currency: 'EUR', currencySymbol: '€' }, pluralRules: 'it' },
];

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderMode: false,
  focusIndicators: 'default',
};
