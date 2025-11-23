/**
 * @wundr/prompt-templates - Built-in Handlebars helpers for prompt templating
 */

import Handlebars from 'handlebars';

import type {
  ToolDefinition,
  ConversationMessage,
  HelperDefinition,
} from './types.js';

/**
 * Format tools array into a structured prompt format
 *
 * @param tools - Array of tool definitions
 * @param options - Handlebars helper options
 * @returns Formatted tools string
 *
 * @example
 * {{formatTools tools}}
 */
export function formatTools(
  tools: ToolDefinition[] | undefined,
  options?: Handlebars.HelperOptions
): string {
  if (!tools || tools.length === 0) {
    return '';
  }

  const format = options?.hash?.['format'] as string | undefined;

  if (format === 'json') {
    return JSON.stringify(tools, null, 2);
  }

  if (format === 'compact') {
    return tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  }

  // Default detailed format
  const formatted = tools
    .map(tool => {
      let output = `### ${tool.name}\n${tool.description}`;

      if (tool.parameters?.properties) {
        output += '\n\n**Parameters:**';
        for (const [name, prop] of Object.entries(tool.parameters.properties)) {
          const required = tool.parameters.required?.includes(name)
            ? ' (required)'
            : '';
          const paramProp = prop as { type?: string; description?: string };
          output += `\n- \`${name}\`${required}: ${paramProp.type || 'any'} - ${paramProp.description || 'No description'}`;
        }
      }

      if (tool.examples && tool.examples.length > 0) {
        output += '\n\n**Examples:**';
        for (const example of tool.examples) {
          output += `\n\`\`\`\n${example}\n\`\`\``;
        }
      }

      return output;
    })
    .join('\n\n---\n\n');

  return formatted;
}

/**
 * Conditionally render block if value is defined and not null/undefined
 *
 * @param value - Value to check
 * @param options - Handlebars helper options
 * @returns Rendered block or empty string
 *
 * @example
 * {{#ifDefined user.name}}Hello, {{user.name}}{{/ifDefined}}
 */
export function ifDefined(
  this: unknown,
  value: unknown,
  options: Handlebars.HelperOptions
): string {
  if (value !== undefined && value !== null) {
    return options.fn(this);
  }
  return options.inverse ? options.inverse(this) : '';
}

/**
 * Wrap content in a code block with optional language
 *
 * @param language - Programming language for syntax highlighting
 * @param options - Handlebars helper options
 * @returns Code block formatted string
 *
 * @example
 * {{#codeBlock "javascript"}}
 * const x = 1;
 * {{/codeBlock}}
 */
export function codeBlock(
  this: unknown,
  language: string | Handlebars.HelperOptions,
  options?: Handlebars.HelperOptions
): string {
  // Handle case where language is not provided
  if (typeof language === 'object' && !options) {
    options = language as Handlebars.HelperOptions;
    language = '';
  }

  const content = options?.fn(this) || '';
  const lang = typeof language === 'string' ? language : '';
  return `\`\`\`${lang}\n${content.trim()}\n\`\`\``;
}

/**
 * Format memory/conversation history into a readable format
 *
 * @param messages - Array of conversation messages
 * @param options - Handlebars helper options
 * @returns Formatted memory string
 *
 * @example
 * {{formatMemory memory.messages}}
 */
export function formatMemory(
  messages: ConversationMessage[] | undefined,
  options?: Handlebars.HelperOptions
): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  const maxMessages = (options?.hash?.['max'] as number) ?? messages.length;
  const format = options?.hash?.['format'] as string | undefined;
  const slicedMessages = messages.slice(-maxMessages);

  if (format === 'compact') {
    return slicedMessages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n');
  }

  if (format === 'xml') {
    return slicedMessages
      .map(
        m =>
          `<message role="${m.role}"${m.name ? ` name="${m.name}"` : ''}>\n${m.content}\n</message>`
      )
      .join('\n\n');
  }

  // Default format
  return slicedMessages
    .map(m => {
      const roleLabel =
        m.role.charAt(0).toUpperCase() + m.role.slice(1).toLowerCase();
      const nameLabel = m.name ? ` (${m.name})` : '';
      return `**${roleLabel}${nameLabel}:**\n${m.content}`;
    })
    .join('\n\n');
}

/**
 * Repeat content n times
 *
 * @param count - Number of times to repeat
 * @param options - Handlebars helper options
 * @returns Repeated content
 *
 * @example
 * {{#repeat 3}}Item {{@index}}{{/repeat}}
 */
export function repeat(
  this: unknown,
  count: number,
  options: Handlebars.HelperOptions
): string {
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const data = Handlebars.createFrame(options.data || {});
    data['index'] = i;
    data['first'] = i === 0;
    data['last'] = i === count - 1;
    results.push(options.fn(this, { data }));
  }
  return results.join('');
}

/**
 * Format a date value
 *
 * @param date - Date to format
 * @param formatStr - Format string (iso, locale, relative, or custom)
 * @returns Formatted date string
 *
 * @example
 * {{formatDate timestamp "iso"}}
 */
export function formatDate(
  date: Date | string | number | undefined,
  formatStr?: string
): string {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const format = typeof formatStr === 'string' ? formatStr : 'iso';

  switch (format) {
    case 'iso':
      return dateObj.toISOString();
    case 'locale':
      return dateObj.toLocaleString();
    case 'date':
      return dateObj.toLocaleDateString();
    case 'time':
      return dateObj.toLocaleTimeString();
    case 'relative': {
      const now = Date.now();
      const diff = now - dateObj.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
      if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      }
      if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      }
      return 'just now';
    }
    default:
      return dateObj.toISOString();
  }
}

/**
 * JSON stringify with formatting options
 *
 * @param value - Value to stringify
 * @param options - Handlebars helper options
 * @returns JSON string
 *
 * @example
 * {{json data indent=2}}
 */
export function json(
  value: unknown,
  options?: Handlebars.HelperOptions
): string {
  const indent = (options?.hash?.['indent'] as number) ?? 2;
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

/**
 * Truncate text to a maximum length
 *
 * @param text - Text to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add when truncated (default: '...')
 * @returns Truncated text
 *
 * @example
 * {{truncate description 100 "..."}}
 */
export function truncate(
  text: string | undefined,
  length?: number | Handlebars.HelperOptions,
  suffix?: string | Handlebars.HelperOptions
): string {
  if (!text) {
    return '';
  }

  const maxLength = typeof length === 'number' ? length : 100;
  const ellipsis = typeof suffix === 'string' ? suffix : '...';

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Join array items with a separator
 *
 * @param items - Array to join
 * @param separator - Separator string (default: ', ')
 * @returns Joined string
 *
 * @example
 * {{join tags ", "}}
 */
export function join(
  items: unknown[] | undefined,
  separator?: string | Handlebars.HelperOptions
): string {
  if (!items || !Array.isArray(items)) {
    return '';
  }

  const sep = typeof separator === 'string' ? separator : ', ';
  return items.map(String).join(sep);
}

/**
 * String comparison helper
 *
 * @param a - First value
 * @param operator - Comparison operator
 * @param b - Second value
 * @param options - Handlebars helper options
 * @returns Rendered block based on comparison result
 *
 * @example
 * {{#compare role "eq" "admin"}}Admin content{{/compare}}
 */
export function compare(
  this: unknown,
  a: unknown,
  operator: string,
  b: unknown,
  options: Handlebars.HelperOptions
): string {
  let result = false;

  switch (operator) {
    case 'eq':
    case '==':
    case '===':
      result = a === b;
      break;
    case 'ne':
    case '!=':
    case '!==':
      result = a !== b;
      break;
    case 'lt':
    case '<':
      result = Number(a) < Number(b);
      break;
    case 'lte':
    case '<=':
      result = Number(a) <= Number(b);
      break;
    case 'gt':
    case '>':
      result = Number(a) > Number(b);
      break;
    case 'gte':
    case '>=':
      result = Number(a) >= Number(b);
      break;
    case 'contains':
      result = typeof a === 'string' && typeof b === 'string' && a.includes(b);
      break;
    case 'startsWith':
      result =
        typeof a === 'string' && typeof b === 'string' && a.startsWith(b);
      break;
    case 'endsWith':
      result = typeof a === 'string' && typeof b === 'string' && a.endsWith(b);
      break;
    default:
      result = false;
  }

  if (result) {
    return options.fn(this);
  }
  return options.inverse ? options.inverse(this) : '';
}

/**
 * Capitalize first letter of string
 *
 * @param text - Text to capitalize
 * @returns Capitalized text
 *
 * @example
 * {{capitalize name}}
 */
export function capitalize(text: string | undefined): string {
  if (!text) {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert string to uppercase
 *
 * @param text - Text to convert
 * @returns Uppercase text
 *
 * @example
 * {{uppercase status}}
 */
export function uppercase(text: string | undefined): string {
  if (!text) {
    return '';
  }
  return text.toUpperCase();
}

/**
 * Convert string to lowercase
 *
 * @param text - Text to convert
 * @returns Lowercase text
 *
 * @example
 * {{lowercase status}}
 */
export function lowercase(text: string | undefined): string {
  if (!text) {
    return '';
  }
  return text.toLowerCase();
}

/**
 * Indent text by a number of spaces
 *
 * @param text - Text to indent
 * @param spaces - Number of spaces (default: 2)
 * @returns Indented text
 *
 * @example
 * {{indent content 4}}
 */
export function indent(
  text: string | undefined,
  spaces?: number | Handlebars.HelperOptions
): string {
  if (!text) {
    return '';
  }

  const numSpaces = typeof spaces === 'number' ? spaces : 2;
  const indentStr = ' '.repeat(numSpaces);
  return text
    .split('\n')
    .map(line => indentStr + line)
    .join('\n');
}

/**
 * Wrap text to a maximum line width
 *
 * @param text - Text to wrap
 * @param width - Maximum line width (default: 80)
 * @returns Wrapped text
 *
 * @example
 * {{wrap longText 72}}
 */
export function wrap(
  text: string | undefined,
  width?: number | Handlebars.HelperOptions
): string {
  if (!text) {
    return '';
  }

  const maxWidth = typeof width === 'number' ? width : 80;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Create a bulleted list from array
 *
 * @param items - Array of items
 * @param options - Handlebars helper options
 * @returns Bulleted list string
 *
 * @example
 * {{bulletList items bullet="*"}}
 */
export function bulletList(
  items: unknown[] | undefined,
  options?: Handlebars.HelperOptions
): string {
  if (!items || !Array.isArray(items)) {
    return '';
  }

  const bullet = (options?.hash?.['bullet'] as string) || '-';
  return items.map(item => `${bullet} ${String(item)}`).join('\n');
}

/**
 * Create a numbered list from array
 *
 * @param items - Array of items
 * @param options - Handlebars helper options
 * @returns Numbered list string
 *
 * @example
 * {{numberedList steps start=1}}
 */
export function numberedList(
  items: unknown[] | undefined,
  options?: Handlebars.HelperOptions
): string {
  if (!items || !Array.isArray(items)) {
    return '';
  }

  const start = (options?.hash?.['start'] as number) || 1;
  return items
    .map((item, index) => `${start + index}. ${String(item)}`)
    .join('\n');
}

/**
 * Get all built-in helper definitions
 *
 * @returns Array of helper definitions
 */
export function getBuiltinHelpers(): HelperDefinition[] {
  return [
    {
      name: 'formatTools',
      description: 'Format tools array into a structured prompt format',
      fn: formatTools as HelperDefinition['fn'],
    },
    {
      name: 'ifDefined',
      description:
        'Conditionally render block if value is defined and not null/undefined',
      fn: ifDefined as HelperDefinition['fn'],
    },
    {
      name: 'codeBlock',
      description: 'Wrap content in a code block with optional language',
      fn: codeBlock as HelperDefinition['fn'],
    },
    {
      name: 'formatMemory',
      description: 'Format memory/conversation history into a readable format',
      fn: formatMemory as HelperDefinition['fn'],
    },
    {
      name: 'repeat',
      description: 'Repeat content n times',
      fn: repeat as HelperDefinition['fn'],
    },
    {
      name: 'formatDate',
      description: 'Format a date value',
      fn: formatDate as HelperDefinition['fn'],
    },
    {
      name: 'json',
      description: 'JSON stringify with formatting options',
      fn: json as HelperDefinition['fn'],
    },
    {
      name: 'truncate',
      description: 'Truncate text to a maximum length',
      fn: truncate as HelperDefinition['fn'],
    },
    {
      name: 'join',
      description: 'Join array items with a separator',
      fn: join as HelperDefinition['fn'],
    },
    {
      name: 'compare',
      description: 'String comparison helper',
      fn: compare as HelperDefinition['fn'],
    },
    {
      name: 'capitalize',
      description: 'Capitalize first letter of string',
      fn: capitalize as HelperDefinition['fn'],
    },
    {
      name: 'uppercase',
      description: 'Convert string to uppercase',
      fn: uppercase as HelperDefinition['fn'],
    },
    {
      name: 'lowercase',
      description: 'Convert string to lowercase',
      fn: lowercase as HelperDefinition['fn'],
    },
    {
      name: 'indent',
      description: 'Indent text by a number of spaces',
      fn: indent as HelperDefinition['fn'],
    },
    {
      name: 'wrap',
      description: 'Wrap text to a maximum line width',
      fn: wrap as HelperDefinition['fn'],
    },
    {
      name: 'bulletList',
      description: 'Create a bulleted list from array',
      fn: bulletList as HelperDefinition['fn'],
    },
    {
      name: 'numberedList',
      description: 'Create a numbered list from array',
      fn: numberedList as HelperDefinition['fn'],
    },
  ];
}
