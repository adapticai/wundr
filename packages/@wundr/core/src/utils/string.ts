/**
 * String manipulation utility functions
 */

/**
 * Converts a string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * Converts a string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase())
    .replace(/\s+/g, '');
}

/**
 * Converts a string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Converts a string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncates a string to a specified length
 */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) {
    return str;
  }

  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Escapes HTML characters in a string
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, match => htmlEscapes[match]);
}

/**
 * Unescapes HTML characters in a string
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  return str.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    match => htmlUnescapes[match]
  );
}

/**
 * Pads a string to a specified length
 */
export function pad(
  str: string,
  length: number,
  char = ' ',
  direction: 'left' | 'right' | 'both' = 'left'
): string {
  if (str.length >= length) {
    return str;
  }

  const padLength = length - str.length;

  switch (direction) {
    case 'left':
      return char.repeat(padLength) + str;
    case 'right':
      return str + char.repeat(padLength);
    case 'both': {
      const leftPad = Math.floor(padLength / 2);
      const rightPad = padLength - leftPad;
      return char.repeat(leftPad) + str + char.repeat(rightPad);
    }
    default:
      return str;
  }
}

/**
 * Removes whitespace from both ends of a string
 */
export function trim(str: string, chars?: string): string {
  if (!chars) {
    return str.trim();
  }

  const pattern = new RegExp(
    `^[${escapeRegExp(chars)}]+|[${escapeRegExp(chars)}]+$`,
    'g'
  );
  return str.replace(pattern, '');
}

/**
 * Escapes special regex characters in a string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a random string of specified length
 */
export function randomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  const charsetLength = charset.length;

  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charsetLength));
  }

  return result;
}

/**
 * Counts the number of words in a string
 */
export function wordCount(str: string): number {
  return str
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * Pluralizes a word based on count
 */
export function pluralize(
  word: string,
  count: number,
  pluralForm?: string
): string {
  if (count === 1) {
    return word;
  }

  if (pluralForm) {
    return pluralForm;
  }

  // Simple pluralization rules
  if (word.endsWith('y') && !isVowel(word[word.length - 2])) {
    return word.slice(0, -1) + 'ies';
  }

  if (
    word.endsWith('s') ||
    word.endsWith('sh') ||
    word.endsWith('ch') ||
    word.endsWith('x') ||
    word.endsWith('z')
  ) {
    return word + 'es';
  }

  return word + 's';
}

/**
 * Checks if a character is a vowel
 */
function isVowel(char: string): boolean {
  return 'aeiouAEIOU'.includes(char);
}

/**
 * Template string interpolation
 */
export function template(
  str: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options: {
    prefix?: string;
    suffix?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform?: (key: string, value: any) => string;
  } = {}
): string {
  const { prefix = '{{', suffix = '}}', transform } = options;

  const regex = new RegExp(
    `${escapeRegExp(prefix)}\\s*([^${escapeRegExp(suffix)}]+)\\s*${escapeRegExp(suffix)}`,
    'g'
  );

  return str.replace(regex, (match, key) => {
    const value = data[key.trim()];

    if (value === undefined || value === null) {
      return match; // Keep original if no replacement found
    }

    return transform ? transform(key, value) : String(value);
  });
}
