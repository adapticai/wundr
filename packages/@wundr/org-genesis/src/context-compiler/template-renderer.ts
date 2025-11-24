/**
 * @packageDocumentation
 * Template Renderer for the Context Compiler.
 *
 * This module provides Handlebars-based template rendering capabilities for
 * context compilation in the Org Genesis system. It supports template caching,
 * partial templates, and integrates with the custom Handlebars helpers defined
 * in the utils module.
 *
 * @example
 * ```typescript
 * import { templateRenderer, createTemplateRenderer } from './template-renderer.js';
 *
 * // Use the default singleton instance
 * const output = templateRenderer.render(
 *   'Hello, {{upper name}}!',
 *   { name: 'Agent' }
 * );
 *
 * // Or create a custom instance
 * const renderer = createTemplateRenderer();
 * const result = await renderer.renderFromFile('./template.hbs', { data: 'value' });
 * ```
 *
 * @module context-compiler/template-renderer
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import Handlebars, { type TemplateDelegate } from 'handlebars';

import { registerHelpers } from '../utils/handlebars-helpers.js';

/**
 * Primitive types allowed in template data.
 */
export type TemplatePrimitive = string | number | boolean | null | undefined | Date;

/**
 * Template data value type for rendering operations.
 *
 * Represents the possible value types in a template data context.
 */
export type TemplateDataValue =
  | TemplatePrimitive
  | TemplateDataValue[]
  | { [key: string]: TemplateDataValue };

/**
 * Template data type for rendering operations.
 *
 * Represents the data context passed to templates during rendering.
 * Uses a strict type that allows string keys with typed values.
 */
export type TemplateData = Record<string, TemplateDataValue>;

/**
 * Options for template compilation.
 */
export interface CompileOptions {
  /**
   * Whether to enable strict mode (throws on missing variables).
   * @defaultValue false
   */
  strict?: boolean;

  /**
   * Whether to assume all variables are already escaped.
   * @defaultValue false
   */
  noEscape?: boolean;
}

/**
 * Error thrown when template operations fail.
 */
export class TemplateRenderError extends Error {
  /**
   * The source of the error (template content or file path).
   */
  public readonly source: string;

  /**
   * The original error that caused this error, if any.
   */
  public readonly cause?: Error;

  /**
   * Creates a new TemplateRenderError.
   *
   * @param message - Human-readable error message
   * @param source - The template source or file path that caused the error
   * @param cause - The underlying error, if any
   */
  constructor(message: string, source: string, cause?: Error) {
    super(message);
    this.name = 'TemplateRenderError';
    this.source = source;
    this.cause = cause;
    Object.setPrototypeOf(this, TemplateRenderError.prototype);
  }
}

/**
 * Handlebars-based template renderer for context compilation.
 *
 * This class provides a high-level interface for compiling and rendering
 * Handlebars templates with caching support. It automatically registers
 * custom helpers from the handlebars-helpers module on first use.
 *
 * @remarks
 * The renderer maintains an internal cache of compiled templates to avoid
 * repeated compilation of the same template source. Use {@link clearCache}
 * to reset the cache if templates have been modified.
 *
 * @example
 * ```typescript
 * const renderer = new TemplateRenderer();
 *
 * // Simple rendering
 * const output = renderer.render('Hello {{name}}!', { name: 'World' });
 *
 * // Register a partial for reuse
 * renderer.registerPartial('header', '<header>{{title}}</header>');
 *
 * // Use the partial in templates
 * const html = renderer.render('{{> header}}<main>Content</main>', { title: 'My Page' });
 *
 * // Render from file
 * const fromFile = await renderer.renderFromFile('./templates/charter.hbs', agentData);
 * ```
 *
 * @public
 */
export class TemplateRenderer {
  /**
   * Internal cache mapping template source strings to compiled template delegates.
   */
  private readonly templateCache: Map<string, TemplateDelegate<TemplateData>>;

  /**
   * Flag indicating whether custom helpers have been registered.
   */
  private helpersRegistered: boolean;

  /**
   * Creates a new TemplateRenderer instance.
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   * ```
   */
  constructor() {
    this.templateCache = new Map();
    this.helpersRegistered = false;
  }

  /**
   * Ensures custom Handlebars helpers are registered.
   *
   * This method is called automatically before any template operations.
   * It only registers helpers once per renderer instance.
   */
  private ensureHelpersRegistered(): void {
    if (!this.helpersRegistered) {
      registerHelpers();
      this.helpersRegistered = true;
    }
  }

  /**
   * Compiles a Handlebars template string and caches the result.
   *
   * If the same template source has been compiled before, the cached
   * version is returned to avoid redundant compilation.
   *
   * @param templateSource - The Handlebars template string to compile
   * @param options - Optional compilation options
   * @returns The compiled template delegate function
   * @throws {TemplateRenderError} If template compilation fails
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   * const template = renderer.compile('Hello {{upper name}}!');
   *
   * // Reuse the compiled template
   * console.log(template({ name: 'alice' })); // 'Hello ALICE!'
   * console.log(template({ name: 'bob' }));   // 'Hello BOB!'
   * ```
   *
   * @public
   */
  public compile(templateSource: string, options?: CompileOptions): TemplateDelegate<TemplateData> {
    this.ensureHelpersRegistered();

    // Check cache first
    const cacheKey = this.generateCacheKey(templateSource, options);
    const cached = this.templateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const compiled = Handlebars.compile<TemplateData>(templateSource, {
        strict: options?.strict ?? false,
        noEscape: options?.noEscape ?? false,
      });

      // Cache the compiled template
      this.templateCache.set(cacheKey, compiled);
      return compiled;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateRenderError(
        `Failed to compile template: ${errorMessage}`,
        templateSource.substring(0, 100) + (templateSource.length > 100 ? '...' : ''),
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Renders a Handlebars template string with the provided data.
   *
   * This is a convenience method that combines compilation and rendering
   * in a single call. The compiled template is cached for future use.
   *
   * @param templateSource - The Handlebars template string to render
   * @param data - The data context for template rendering
   * @param options - Optional compilation options
   * @returns The rendered string output
   * @throws {TemplateRenderError} If compilation or rendering fails
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   *
   * const output = renderer.render(
   *   `# Agent Charter: {{upper name}}
   *
   * ## Responsibilities
   * {{bulletList responsibilities}}
   *
   * Created: {{formatDate createdAt}}`,
   *   {
   *     name: 'code-reviewer',
   *     responsibilities: ['Review PRs', 'Ensure quality'],
   *     createdAt: new Date()
   *   }
   * );
   * ```
   *
   * @public
   */
  public render(templateSource: string, data: TemplateData, options?: CompileOptions): string {
    const template = this.compile(templateSource, options);

    try {
      return template(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateRenderError(
        `Failed to render template: ${errorMessage}`,
        templateSource.substring(0, 100) + (templateSource.length > 100 ? '...' : ''),
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Loads a template from a file and renders it with the provided data.
   *
   * The template file is read from disk, compiled (with caching), and
   * rendered with the given data context.
   *
   * @param filePath - The path to the template file (absolute or relative to cwd)
   * @param data - The data context for template rendering
   * @param options - Optional compilation options
   * @returns A promise that resolves to the rendered string output
   * @throws {TemplateRenderError} If file reading, compilation, or rendering fails
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   *
   * const output = await renderer.renderFromFile(
   *   './templates/agent-charter.hbs',
   *   {
   *     agent: {
   *       name: 'code-reviewer',
   *       discipline: 'engineering'
   *     }
   *   }
   * );
   * ```
   *
   * @public
   */
  public async renderFromFile(
    filePath: string,
    data: TemplateData,
    options?: CompileOptions,
  ): Promise<string> {
    const absolutePath = resolve(filePath);

    let templateSource: string;
    try {
      templateSource = await readFile(absolutePath, 'utf-8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateRenderError(
        `Failed to read template file: ${errorMessage}`,
        absolutePath,
        error instanceof Error ? error : undefined,
      );
    }

    try {
      return this.render(templateSource, data, options);
    } catch (error) {
      // Re-throw with file path context if not already a TemplateRenderError
      if (error instanceof TemplateRenderError) {
        throw new TemplateRenderError(
          `${error.message} (file: ${absolutePath})`,
          absolutePath,
          error.cause,
        );
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateRenderError(
        `Failed to render template from file: ${errorMessage}`,
        absolutePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Clears the internal template cache.
   *
   * Call this method if templates have been modified and you want to
   * force recompilation on the next render.
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   *
   * // Render some templates
   * renderer.render('{{name}}', { name: 'test' });
   *
   * // Clear cache to force recompilation
   * renderer.clearCache();
   *
   * // Template will be recompiled
   * renderer.render('{{name}}', { name: 'test' });
   * ```
   *
   * @public
   */
  public clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Registers a partial template for use in other templates.
   *
   * Partials allow you to create reusable template fragments that can be
   * included in other templates using the `{{> partialName}}` syntax.
   *
   * @param name - The name to register the partial under
   * @param source - The Handlebars template source for the partial
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   *
   * // Register a header partial
   * renderer.registerPartial('header', `
   * # {{title}}
   * Version: {{version}}
   * ---
   * `);
   *
   * // Use the partial in a template
   * const output = renderer.render(
   *   '{{> header}}\nMain content here.',
   *   { title: 'My Document', version: '1.0.0' }
   * );
   * ```
   *
   * @public
   */
  public registerPartial(name: string, source: string): void {
    this.ensureHelpersRegistered();
    Handlebars.registerPartial(name, source);
  }

  /**
   * Returns the current size of the template cache.
   *
   * Useful for monitoring cache usage and debugging.
   *
   * @returns The number of cached template delegates
   *
   * @example
   * ```typescript
   * const renderer = new TemplateRenderer();
   *
   * renderer.render('{{name}}', { name: 'a' });
   * renderer.render('{{value}}', { value: 'b' });
   *
   * console.log(renderer.cacheSize); // 2
   * ```
   *
   * @public
   */
  public get cacheSize(): number {
    return this.templateCache.size;
  }

  /**
   * Generates a cache key for a template source and options combination.
   *
   * @param templateSource - The template source string
   * @param options - The compilation options
   * @returns A unique cache key string
   */
  private generateCacheKey(templateSource: string, options?: CompileOptions): string {
    const optionsKey = options
      ? `:strict=${options.strict ?? false}:noEscape=${options.noEscape ?? false}`
      : '';
    return `${templateSource}${optionsKey}`;
  }
}

/**
 * Creates a new TemplateRenderer instance.
 *
 * This factory function provides a convenient way to create renderer instances
 * without using the `new` keyword.
 *
 * @returns A new TemplateRenderer instance
 *
 * @example
 * ```typescript
 * import { createTemplateRenderer } from './template-renderer.js';
 *
 * const renderer = createTemplateRenderer();
 * const output = renderer.render('Hello {{name}}!', { name: 'World' });
 * ```
 *
 * @public
 */
export function createTemplateRenderer(): TemplateRenderer {
  return new TemplateRenderer();
}

/**
 * Default singleton TemplateRenderer instance.
 *
 * Use this instance for simple use cases where a shared renderer is acceptable.
 * For isolated rendering contexts (e.g., testing), create a new instance using
 * {@link createTemplateRenderer}.
 *
 * @example
 * ```typescript
 * import { templateRenderer } from './template-renderer.js';
 *
 * // Use the shared instance
 * const output = templateRenderer.render('Hello {{name}}!', { name: 'World' });
 *
 * // Register a partial on the shared instance
 * templateRenderer.registerPartial('footer', 'Copyright {{year}}');
 * ```
 *
 * @public
 */
export const templateRenderer: TemplateRenderer = createTemplateRenderer();
