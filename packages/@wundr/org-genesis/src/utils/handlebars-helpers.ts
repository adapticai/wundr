/**
 * @packageDocumentation
 * Handlebars template helpers for the Context Compiler.
 *
 * This module provides a comprehensive set of Handlebars helpers designed
 * specifically for context compilation in the Org Genesis system. These helpers
 * enable dynamic template rendering for agent charters, system prompts, and
 * organizational documentation.
 *
 * @example
 * ```typescript
 * import { renderTemplate, registerHelpers } from './handlebars-helpers.js';
 *
 * // Render a template with data
 * const output = renderTemplate(
 *   'Hello, {{upper name}}! Today is {{formatDate today}}.',
 *   { name: 'Agent', today: new Date() }
 * );
 * ```
 *
 * @module utils/handlebars-helpers
 */

import Handlebars, { type TemplateDelegate } from 'handlebars';

/**
 * Registers all custom Handlebars helpers for context compilation.
 *
 * This function should be called before compiling any templates to ensure
 * all custom helpers are available. It is automatically called by
 * {@link compileTemplate} and {@link renderTemplate}.
 *
 * @remarks
 * The following helpers are registered:
 * - `formatDate` - ISO date formatting
 * - `json` - JSON serialization with pretty printing
 * - `upper` - Uppercase transformation
 * - `lower` - Lowercase transformation
 * - `capitalize` - Capitalize first letter
 * - `join` - Array joining with separator
 * - `bulletList` - Markdown bullet list generation
 * - `numberedList` - Markdown numbered list generation
 * - `eq` - Equality comparison
 * - `ifTruthy` - Conditional block for truthy values
 * - `eachWithIndex` - Loop with index metadata
 * - `safe` - Safe string (no HTML escaping)
 *
 * @example
 * ```typescript
 * import Handlebars from 'handlebars';
 * import { registerHelpers } from './handlebars-helpers.js';
 *
 * registerHelpers();
 *
 * const template = Handlebars.compile('{{upper name}}');
 * console.log(template({ name: 'test' })); // 'TEST'
 * ```
 *
 * @public
 */
export function registerHelpers(): void {
  /**
   * Formats a date to ISO 8601 string format.
   *
   * @param date - The date to format (Date object or ISO string)
   * @returns ISO 8601 formatted date string
   *
   * @example
   * ```handlebars
   * Created: {{formatDate createdAt}}
   * ```
   */
  Handlebars.registerHelper('formatDate', (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  });

  /**
   * Serializes a value to formatted JSON.
   *
   * Useful for debugging or including structured data in templates.
   *
   * @param context - The value to serialize
   * @returns Pretty-printed JSON string with 2-space indentation
   *
   * @example
   * ```handlebars
   * Configuration:
   * ```json
   * {{json config}}
   * ```
   */
  Handlebars.registerHelper('json', (context: unknown): string => {
    return JSON.stringify(context, null, 2);
  });

  /**
   * Converts a string to uppercase.
   *
   * @param str - The string to transform
   * @returns Uppercase string, or empty string if input is falsy
   *
   * @example
   * ```handlebars
   * Status: {{upper status}}
   * ```
   */
  Handlebars.registerHelper('upper', (str: string): string => {
    return str?.toUpperCase() ?? '';
  });

  /**
   * Converts a string to lowercase.
   *
   * @param str - The string to transform
   * @returns Lowercase string, or empty string if input is falsy
   *
   * @example
   * ```handlebars
   * Identifier: {{lower identifier}}
   * ```
   */
  Handlebars.registerHelper('lower', (str: string): string => {
    return str?.toLowerCase() ?? '';
  });

  /**
   * Capitalizes the first letter of a string.
   *
   * @param str - The string to capitalize
   * @returns String with first letter capitalized, or empty string if input is falsy
   *
   * @example
   * ```handlebars
   * Title: {{capitalize title}}
   * ```
   */
  Handlebars.registerHelper('capitalize', (str: string): string => {
    if (!str) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  /**
   * Joins an array of strings with a separator.
   *
   * @param arr - The array of strings to join
   * @param separator - The separator to use between elements
   * @returns Joined string, or empty string if input is not an array
   *
   * @example
   * ```handlebars
   * Tags: {{join tags ", "}}
   * ```
   */
  Handlebars.registerHelper('join', (arr: string[], separator: string): string => {
    return Array.isArray(arr) ? arr.join(separator) : '';
  });

  /**
   * Generates a Markdown bullet list from an array of items.
   *
   * @param items - The array of items to format
   * @returns Markdown-formatted bullet list, or empty string if input is not an array
   *
   * @example
   * ```handlebars
   * Responsibilities:
   * {{bulletList responsibilities}}
   * ```
   * Output:
   * ```
   * Responsibilities:
   * - Review code changes
   * - Ensure quality standards
   * - Provide feedback
   * ```
   */
  Handlebars.registerHelper('bulletList', (items: string[]): string => {
    if (!Array.isArray(items)) {
      return '';
    }
    return items.map((item) => `- ${item}`).join('\n');
  });

  /**
   * Generates a Markdown numbered list from an array of items.
   *
   * @param items - The array of items to format
   * @returns Markdown-formatted numbered list, or empty string if input is not an array
   *
   * @example
   * ```handlebars
   * Steps:
   * {{numberedList steps}}
   * ```
   * Output:
   * ```
   * Steps:
   * 1. Initialize context
   * 2. Load templates
   * 3. Render output
   * ```
   */
  Handlebars.registerHelper('numberedList', (items: string[]): string => {
    if (!Array.isArray(items)) {
      return '';
    }
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  });

  /**
   * Compares two values for strict equality.
   *
   * Useful in conditional helpers like `{{#if (eq status "active")}}`.
   *
   * @param a - First value to compare
   * @param b - Second value to compare
   * @returns `true` if values are strictly equal, `false` otherwise
   *
   * @example
   * ```handlebars
   * {{#if (eq role "admin")}}
   * Admin-specific content
   * {{/if}}
   * ```
   */
  Handlebars.registerHelper('eq', (a: unknown, b: unknown): boolean => {
    return a === b;
  });

  /**
   * Conditional block helper for truthy values.
   *
   * Renders the main block if value is truthy, otherwise renders the inverse block.
   *
   * @param value - The value to check for truthiness
   * @param options - Handlebars options object containing fn and inverse
   * @returns Rendered block content
   *
   * @example
   * ```handlebars
   * {{#ifTruthy description}}
   * Description: {{description}}
   * {{else}}
   * No description provided.
   * {{/ifTruthy}}
   * ```
   */
  Handlebars.registerHelper(
    'ifTruthy',
    function (this: unknown, value: unknown, options: Handlebars.HelperOptions): string {
      if (value) {
        return options.fn(this);
      }
      return options.inverse(this);
    },
  );

  /**
   * Enhanced each loop with index metadata.
   *
   * Iterates over an array and provides additional metadata:
   * - `index` - Zero-based index of current item
   * - `first` - `true` if this is the first item
   * - `last` - `true` if this is the last item
   *
   * @param context - The array to iterate over
   * @param options - Handlebars options object
   * @returns Concatenated rendered content for all items
   *
   * @example
   * ```handlebars
   * {{#eachWithIndex agents}}
   * {{#unless first}}, {{/unless}}{{name}}{{#if last}}.{{/if}}
   * {{/eachWithIndex}}
   * ```
   */
  Handlebars.registerHelper(
    'eachWithIndex',
    function (
      this: unknown,
      context: Record<string, unknown>[],
      options: Handlebars.HelperOptions,
    ): string {
      let result = '';
      for (let i = 0; i < context.length; i++) {
        result += options.fn({
          ...context[i],
          index: i,
          first: i === 0,
          last: i === context.length - 1,
        });
      }
      return result;
    },
  );

  /**
   * Marks a string as safe HTML (prevents HTML entity escaping).
   *
   * Use with caution - only apply to trusted content.
   *
   * @param str - The string to mark as safe
   * @returns Handlebars SafeString instance
   *
   * @example
   * ```handlebars
   * {{safe htmlContent}}
   * ```
   */
  Handlebars.registerHelper('safe', (str: string): Handlebars.SafeString => {
    return new Handlebars.SafeString(str);
  });
}

/**
 * Compiles a Handlebars template string with all custom helpers registered.
 *
 * This function ensures all custom helpers are available before compilation.
 * Use this when you need to compile a template once and render it multiple times
 * with different data.
 *
 * @param template - The Handlebars template string to compile
 * @returns Compiled template function ready for rendering
 *
 * @example
 * ```typescript
 * const template = compileTemplate('Hello, {{upper name}}!');
 *
 * console.log(template({ name: 'alice' })); // 'Hello, ALICE!'
 * console.log(template({ name: 'bob' }));   // 'Hello, BOB!'
 * ```
 *
 * @public
 */
export function compileTemplate(template: string): TemplateDelegate<Record<string, unknown>> {
  registerHelpers();
  return Handlebars.compile(template);
}

/**
 * Renders a Handlebars template with data in a single call.
 *
 * This is a convenience function that combines compilation and rendering.
 * For templates that will be rendered multiple times, prefer using
 * {@link compileTemplate} to avoid repeated compilation overhead.
 *
 * @param template - The Handlebars template string
 * @param data - The data object to use for template rendering
 * @returns The rendered string output
 *
 * @example
 * ```typescript
 * const output = renderTemplate(
 *   `# Agent Charter: {{upper name}}
 *
 * ## Responsibilities
 * {{bulletList responsibilities}}
 *
 * ## Status
 * {{#ifTruthy active}}Active{{else}}Inactive{{/ifTruthy}}
 *
 * Created: {{formatDate createdAt}}`,
 *   {
 *     name: 'code-reviewer',
 *     responsibilities: ['Review PRs', 'Ensure quality', 'Provide feedback'],
 *     active: true,
 *     createdAt: new Date()
 *   }
 * );
 * ```
 *
 * @public
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  const compiled = compileTemplate(template);
  return compiled(data);
}

/**
 * Re-export Handlebars for direct access when needed.
 *
 * @remarks
 * This allows consumers to access the Handlebars instance directly
 * for advanced use cases like registering additional custom helpers
 * or using Handlebars-specific features not wrapped by this module.
 *
 * @example
 * ```typescript
 * import { Handlebars, registerHelpers } from './handlebars-helpers.js';
 *
 * registerHelpers();
 *
 * // Register additional custom helper
 * Handlebars.registerHelper('customHelper', (value) => {
 *   return `Custom: ${value}`;
 * });
 * ```
 *
 * @public
 */
export { Handlebars };
