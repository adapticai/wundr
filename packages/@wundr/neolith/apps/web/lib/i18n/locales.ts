/**
 * Locale and Language Configuration
 * @module lib/i18n/locales
 */

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
  isRTL?: boolean;
}

export interface Timezone {
  value: string;
  label: string;
  offset: string;
  region: string;
}

export const LOCALES: Locale[] = [
  // English
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English (United States)',
    region: 'Americas',
  },
  {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English (United Kingdom)',
    region: 'Europe',
  },
  {
    code: 'en-CA',
    name: 'English (Canada)',
    nativeName: 'English (Canada)',
    region: 'Americas',
  },
  {
    code: 'en-AU',
    name: 'English (Australia)',
    nativeName: 'English (Australia)',
    region: 'Oceania',
  },
  {
    code: 'en-IN',
    name: 'English (India)',
    nativeName: 'English (India)',
    region: 'Asia',
  },

  // Spanish
  {
    code: 'es-ES',
    name: 'Spanish (Spain)',
    nativeName: 'Español (España)',
    region: 'Europe',
  },
  {
    code: 'es-MX',
    name: 'Spanish (Mexico)',
    nativeName: 'Español (México)',
    region: 'Americas',
  },
  {
    code: 'es-AR',
    name: 'Spanish (Argentina)',
    nativeName: 'Español (Argentina)',
    region: 'Americas',
  },

  // French
  {
    code: 'fr-FR',
    name: 'French (France)',
    nativeName: 'Français (France)',
    region: 'Europe',
  },
  {
    code: 'fr-CA',
    name: 'French (Canada)',
    nativeName: 'Français (Canada)',
    region: 'Americas',
  },

  // German
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', region: 'Europe' },
  {
    code: 'de-AT',
    name: 'German (Austria)',
    nativeName: 'Deutsch (Österreich)',
    region: 'Europe',
  },
  {
    code: 'de-CH',
    name: 'German (Switzerland)',
    nativeName: 'Deutsch (Schweiz)',
    region: 'Europe',
  },

  // Italian
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', region: 'Europe' },

  // Portuguese
  {
    code: 'pt-PT',
    name: 'Portuguese (Portugal)',
    nativeName: 'Português (Portugal)',
    region: 'Europe',
  },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português (Brasil)',
    region: 'Americas',
  },

  // Dutch
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', region: 'Europe' },
  {
    code: 'nl-BE',
    name: 'Dutch (Belgium)',
    nativeName: 'Nederlands (België)',
    region: 'Europe',
  },

  // Russian
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', region: 'Europe' },

  // Japanese
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', region: 'Asia' },

  // Chinese
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    region: 'Asia',
  },
  {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    region: 'Asia',
  },

  // Korean
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', region: 'Asia' },

  // Arabic
  {
    code: 'ar-SA',
    name: 'Arabic (Saudi Arabia)',
    nativeName: 'العربية (السعودية)',
    region: 'Middle East',
    isRTL: true,
  },
  {
    code: 'ar-AE',
    name: 'Arabic (UAE)',
    nativeName: 'العربية (الإمارات)',
    region: 'Middle East',
    isRTL: true,
  },

  // Hebrew
  {
    code: 'he-IL',
    name: 'Hebrew',
    nativeName: 'עברית',
    region: 'Middle East',
    isRTL: true,
  },

  // Turkish
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', region: 'Europe' },

  // Polish
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', region: 'Europe' },

  // Swedish
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', region: 'Europe' },

  // Norwegian
  { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk', region: 'Europe' },

  // Danish
  { code: 'da-DK', name: 'Danish', nativeName: 'Dansk', region: 'Europe' },

  // Finnish
  { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', region: 'Europe' },

  // Greek
  { code: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', region: 'Europe' },

  // Czech
  { code: 'cs-CZ', name: 'Czech', nativeName: 'Čeština', region: 'Europe' },

  // Hungarian
  { code: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar', region: 'Europe' },

  // Thai
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', region: 'Asia' },

  // Vietnamese
  {
    code: 'vi-VN',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    region: 'Asia',
  },

  // Indonesian
  {
    code: 'id-ID',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    region: 'Asia',
  },

  // Hindi
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', region: 'Asia' },
];

export const TIMEZONES: Timezone[] = [
  // Americas
  {
    value: 'America/New_York',
    label: 'Eastern Time (US & Canada)',
    offset: 'UTC-5',
    region: 'Americas',
  },
  {
    value: 'America/Chicago',
    label: 'Central Time (US & Canada)',
    offset: 'UTC-6',
    region: 'Americas',
  },
  {
    value: 'America/Denver',
    label: 'Mountain Time (US & Canada)',
    offset: 'UTC-7',
    region: 'Americas',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Pacific Time (US & Canada)',
    offset: 'UTC-8',
    region: 'Americas',
  },
  {
    value: 'America/Anchorage',
    label: 'Alaska',
    offset: 'UTC-9',
    region: 'Americas',
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Hawaii',
    offset: 'UTC-10',
    region: 'Americas',
  },
  {
    value: 'America/Phoenix',
    label: 'Arizona',
    offset: 'UTC-7',
    region: 'Americas',
  },
  {
    value: 'America/Toronto',
    label: 'Toronto',
    offset: 'UTC-5',
    region: 'Americas',
  },
  {
    value: 'America/Mexico_City',
    label: 'Mexico City',
    offset: 'UTC-6',
    region: 'Americas',
  },
  {
    value: 'America/Sao_Paulo',
    label: 'São Paulo',
    offset: 'UTC-3',
    region: 'Americas',
  },
  {
    value: 'America/Buenos_Aires',
    label: 'Buenos Aires',
    offset: 'UTC-3',
    region: 'Americas',
  },

  // Europe
  {
    value: 'Europe/London',
    label: 'London',
    offset: 'UTC+0',
    region: 'Europe',
  },
  { value: 'Europe/Paris', label: 'Paris', offset: 'UTC+1', region: 'Europe' },
  {
    value: 'Europe/Berlin',
    label: 'Berlin',
    offset: 'UTC+1',
    region: 'Europe',
  },
  { value: 'Europe/Rome', label: 'Rome', offset: 'UTC+1', region: 'Europe' },
  {
    value: 'Europe/Madrid',
    label: 'Madrid',
    offset: 'UTC+1',
    region: 'Europe',
  },
  {
    value: 'Europe/Amsterdam',
    label: 'Amsterdam',
    offset: 'UTC+1',
    region: 'Europe',
  },
  {
    value: 'Europe/Brussels',
    label: 'Brussels',
    offset: 'UTC+1',
    region: 'Europe',
  },
  {
    value: 'Europe/Zurich',
    label: 'Zurich',
    offset: 'UTC+1',
    region: 'Europe',
  },
  {
    value: 'Europe/Stockholm',
    label: 'Stockholm',
    offset: 'UTC+1',
    region: 'Europe',
  },
  {
    value: 'Europe/Copenhagen',
    label: 'Copenhagen',
    offset: 'UTC+1',
    region: 'Europe',
  },
  { value: 'Europe/Oslo', label: 'Oslo', offset: 'UTC+1', region: 'Europe' },
  {
    value: 'Europe/Helsinki',
    label: 'Helsinki',
    offset: 'UTC+2',
    region: 'Europe',
  },
  {
    value: 'Europe/Athens',
    label: 'Athens',
    offset: 'UTC+2',
    region: 'Europe',
  },
  {
    value: 'Europe/Istanbul',
    label: 'Istanbul',
    offset: 'UTC+3',
    region: 'Europe',
  },
  {
    value: 'Europe/Moscow',
    label: 'Moscow',
    offset: 'UTC+3',
    region: 'Europe',
  },

  // Asia
  { value: 'Asia/Dubai', label: 'Dubai', offset: 'UTC+4', region: 'Asia' },
  {
    value: 'Asia/Kolkata',
    label: 'Mumbai, Kolkata, New Delhi',
    offset: 'UTC+5:30',
    region: 'Asia',
  },
  {
    value: 'Asia/Bangkok',
    label: 'Bangkok, Hanoi, Jakarta',
    offset: 'UTC+7',
    region: 'Asia',
  },
  {
    value: 'Asia/Singapore',
    label: 'Singapore',
    offset: 'UTC+8',
    region: 'Asia',
  },
  {
    value: 'Asia/Hong_Kong',
    label: 'Hong Kong',
    offset: 'UTC+8',
    region: 'Asia',
  },
  {
    value: 'Asia/Shanghai',
    label: 'Beijing, Shanghai',
    offset: 'UTC+8',
    region: 'Asia',
  },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: 'UTC+9', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul', offset: 'UTC+9', region: 'Asia' },
  { value: 'Asia/Taipei', label: 'Taipei', offset: 'UTC+8', region: 'Asia' },

  // Oceania
  {
    value: 'Australia/Sydney',
    label: 'Sydney, Melbourne',
    offset: 'UTC+11',
    region: 'Oceania',
  },
  {
    value: 'Australia/Brisbane',
    label: 'Brisbane',
    offset: 'UTC+10',
    region: 'Oceania',
  },
  {
    value: 'Australia/Perth',
    label: 'Perth',
    offset: 'UTC+8',
    region: 'Oceania',
  },
  {
    value: 'Pacific/Auckland',
    label: 'Auckland',
    offset: 'UTC+13',
    region: 'Oceania',
  },

  // Middle East & Africa
  { value: 'Africa/Cairo', label: 'Cairo', offset: 'UTC+2', region: 'Africa' },
  {
    value: 'Africa/Johannesburg',
    label: 'Johannesburg',
    offset: 'UTC+2',
    region: 'Africa',
  },
  {
    value: 'Asia/Jerusalem',
    label: 'Jerusalem',
    offset: 'UTC+2',
    region: 'Middle East',
  },
  {
    value: 'Asia/Riyadh',
    label: 'Riyadh',
    offset: 'UTC+3',
    region: 'Middle East',
  },
];

export const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)', example: '12/31/2024' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK)', example: '31/12/2024' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)', example: '2024-12-31' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (EU)', example: '31.12.2024' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '31-12-2024' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (Asia)', example: '2024/12/31' },
];

export const TIME_FORMATS = [
  { value: '12h', label: '12-hour (1:00 PM)', example: '1:00 PM' },
  { value: '24h', label: '24-hour (13:00)', example: '13:00' },
];

export const WEEKDAY_START = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'saturday', label: 'Saturday' },
];

export const NUMBER_FORMATS = [
  {
    value: 'en-US',
    label: '1,234.56 (US)',
    example: '1,234.56',
    decimal: '.',
    thousands: ',',
  },
  {
    value: 'de-DE',
    label: '1.234,56 (EU)',
    example: '1.234,56',
    decimal: ',',
    thousands: '.',
  },
  {
    value: 'fr-FR',
    label: '1 234,56 (FR)',
    example: '1 234,56',
    decimal: ',',
    thousands: ' ',
  },
  {
    value: 'en-IN',
    label: '1,23,456.78 (IN)',
    example: '1,23,456.78',
    decimal: '.',
    thousands: ',',
  },
];

export const CURRENCY_FORMATS = [
  {
    value: 'symbol-before',
    label: '$100.00',
    description: 'Symbol before amount',
  },
  {
    value: 'symbol-after',
    label: '100.00$',
    description: 'Symbol after amount',
  },
  {
    value: 'code-before',
    label: 'USD 100.00',
    description: 'Code before amount',
  },
  {
    value: 'code-after',
    label: '100.00 USD',
    description: 'Code after amount',
  },
];

export const SPELL_CHECK_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'he', label: 'Hebrew' },
  { value: 'tr', label: 'Turkish' },
  { value: 'pl', label: 'Polish' },
  { value: 'sv', label: 'Swedish' },
];

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

export function detectLocale(): string {
  try {
    return navigator.language || 'en-US';
  } catch {
    return 'en-US';
  }
}

export function getLocaleRegions(): string[] {
  return Array.from(
    new Set(LOCALES.map(l => l.region).filter(Boolean))
  ) as string[];
}

export function getTimezoneRegions(): string[] {
  return Array.from(new Set(TIMEZONES.map(t => t.region)));
}
