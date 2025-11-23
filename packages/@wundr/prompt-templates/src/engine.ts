/**
 * @wundr/prompt-templates - PromptTemplateEngine for dynamic prompt rendering
 */

import Handlebars, { type HelperDelegate } from 'handlebars';

import { getBuiltinHelpers } from './helpers.js';
import { createLoader } from './loader.js';
import { getBuiltinMacros } from './macros.js';

import type { TemplateLoader } from './loader.js';
import type {
  PromptTemplateConfig,
  TemplateContext,
  RenderOptions,
  RenderResult,
  RenderMetadata,
  TemplateError,
  MacroDefinition,
  HelperDefinition,
  HelperFunction,
  EngineEvents,
  EngineEventHandler,
} from './types.js';

/**
 * Default render options
 */
const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  strict: false,
  delimiters: ['{{', '}}'],
  escapeHtml: false,
  maxDepth: 10,
  timeout: 5000,
};

/**
 * PromptTemplateEngine provides Jinja2-style templating using Handlebars
 */
export class PromptTemplateEngine {
  private readonly handlebars: typeof Handlebars;
  private readonly templates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private readonly templateConfigs: Map<string, PromptTemplateConfig> =
    new Map();
  private readonly macros: Map<string, MacroDefinition> = new Map();
  private readonly customHelpers: Map<string, HelperDefinition> = new Map();
  private readonly eventHandlers: Map<
    keyof EngineEvents,
    Set<EngineEventHandler<keyof EngineEvents>>
  > = new Map();
  private readonly loader: TemplateLoader;
  private readonly defaultOptions: Required<RenderOptions>;

  /**
   * Create a new PromptTemplateEngine
   *
   * @param options - Default render options
   * @param loaderBaseDir - Base directory for template loading
   */
  constructor(options?: Partial<RenderOptions>, loaderBaseDir?: string) {
    this.handlebars = Handlebars.create();
    this.defaultOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
    this.loader = createLoader({ baseDir: loaderBaseDir });

    // Disable HTML escaping by default for prompts
    if (!this.defaultOptions.escapeHtml) {
      this.handlebars.Utils.escapeExpression = (str: string) => str;
    }

    // Register built-in helpers
    this.registerBuiltinHelpers();

    // Register built-in macros
    this.registerBuiltinMacros();
  }

  /**
   * Render a template string with the given context
   *
   * @param template - Template string or template ID
   * @param context - Context data for rendering
   * @param options - Render options
   * @returns Render result with output or error
   */
  render(
    template: string,
    context: TemplateContext = { variables: {} },
    options?: Partial<RenderOptions>
  ): RenderResult {
    const startTime = Date.now();
    const _mergedOptions = { ...this.defaultOptions, ...options };

    try {
      // Check if this is a template ID
      const compiledTemplate = this.getOrCompileTemplate(template);

      // Prepare context with system defaults
      const preparedContext = this.prepareContext(context);

      // Render the template
      const output = compiledTemplate(preparedContext);

      const metadata: RenderMetadata = {
        renderTime: Date.now() - startTime,
        templateId: this.templateConfigs.has(template) ? template : undefined,
      };

      this.emit('template:rendered', {
        templateId: metadata.templateId || 'inline',
        renderTime: metadata.renderTime,
      });

      return {
        success: true,
        output,
        metadata,
      };
    } catch (error) {
      const templateError = this.createTemplateError(error, template);

      this.emit('template:error', {
        templateId: template,
        error: templateError,
      });

      return {
        success: false,
        error: templateError,
        metadata: {
          renderTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Render a template asynchronously (useful for timeout support)
   *
   * @param template - Template string or template ID
   * @param context - Context data for rendering
   * @param options - Render options
   * @returns Promise resolving to render result
   */
  async renderAsync(
    template: string,
    context: TemplateContext = { variables: {} },
    options?: Partial<RenderOptions>
  ): Promise<RenderResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    return new Promise(resolve => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: {
            code: 'RENDER_TIMEOUT',
            message: `Template rendering timed out after ${mergedOptions.timeout}ms`,
          },
          metadata: {
            renderTime: mergedOptions.timeout,
          },
        });
      }, mergedOptions.timeout);

      try {
        const result = this.render(template, context, options);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: this.createTemplateError(error, template),
          metadata: {
            renderTime: Date.now(),
          },
        });
      }
    });
  }

  /**
   * Register a template configuration
   *
   * @param config - Template configuration
   * @returns The engine instance for chaining
   */
  registerTemplate(config: PromptTemplateConfig): this {
    this.templateConfigs.set(config.id, config);

    // Pre-compile the template
    try {
      const compiled = this.handlebars.compile(config.template);
      this.templates.set(config.id, compiled);
      this.emit('template:loaded', { templateId: config.id });
    } catch (error) {
      const templateError = this.createTemplateError(error, config.id);
      this.emit('template:error', {
        templateId: config.id,
        error: templateError,
      });
      throw error;
    }

    return this;
  }

  /**
   * Load and register a template from file
   *
   * @param templatePath - Path to the template file
   * @returns The engine instance for chaining
   */
  loadTemplate(templatePath: string): this {
    const config = this.loader.loadTemplate(templatePath);
    return this.registerTemplate(config);
  }

  /**
   * Load and register a template from file asynchronously
   *
   * @param templatePath - Path to the template file
   * @returns Promise resolving to the engine instance
   */
  async loadTemplateAsync(templatePath: string): Promise<this> {
    const config = await this.loader.loadTemplateAsync(templatePath);
    return this.registerTemplate(config);
  }

  /**
   * Register a custom macro
   *
   * @param macro - Macro definition
   * @returns The engine instance for chaining
   */
  registerMacro(macro: MacroDefinition): this {
    this.macros.set(macro.name, macro);

    // Register as a Handlebars partial
    this.handlebars.registerPartial(macro.name, macro.template);

    this.emit('macro:registered', { name: macro.name });
    return this;
  }

  /**
   * Register multiple macros
   *
   * @param macros - Array of macro definitions
   * @returns The engine instance for chaining
   */
  registerMacros(macros: MacroDefinition[]): this {
    for (const macro of macros) {
      this.registerMacro(macro);
    }
    return this;
  }

  /**
   * Register a custom helper function
   *
   * @param name - Helper name
   * @param fn - Helper function
   * @param description - Optional description
   * @returns The engine instance for chaining
   */
  registerHelper(name: string, fn: HelperFunction, description?: string): this {
    const helper: HelperDefinition = { name, fn, description };
    this.customHelpers.set(name, helper);
    this.handlebars.registerHelper(name, fn as HelperDelegate);
    this.emit('helper:registered', { name });
    return this;
  }

  /**
   * Unregister a helper
   *
   * @param name - Helper name to remove
   * @returns The engine instance for chaining
   */
  unregisterHelper(name: string): this {
    this.customHelpers.delete(name);
    this.handlebars.unregisterHelper(name);
    return this;
  }

  /**
   * Get a registered template configuration
   *
   * @param id - Template ID
   * @returns Template configuration or undefined
   */
  getTemplate(id: string): PromptTemplateConfig | undefined {
    return this.templateConfigs.get(id);
  }

  /**
   * Get all registered template IDs
   *
   * @returns Array of template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.templateConfigs.keys());
  }

  /**
   * Get a registered macro
   *
   * @param name - Macro name
   * @returns Macro definition or undefined
   */
  getMacro(name: string): MacroDefinition | undefined {
    return this.macros.get(name);
  }

  /**
   * Get all registered macro names
   *
   * @returns Array of macro names
   */
  getMacroNames(): string[] {
    return Array.from(this.macros.keys());
  }

  /**
   * Get all registered helper names
   *
   * @returns Array of helper names
   */
  getHelperNames(): string[] {
    return Array.from(this.customHelpers.keys());
  }

  /**
   * Check if a template is registered
   *
   * @param id - Template ID
   * @returns True if template is registered
   */
  hasTemplate(id: string): boolean {
    return this.templateConfigs.has(id);
  }

  /**
   * Remove a registered template
   *
   * @param id - Template ID
   * @returns True if template was removed
   */
  removeTemplate(id: string): boolean {
    const existed = this.templateConfigs.has(id);
    this.templateConfigs.delete(id);
    this.templates.delete(id);
    return existed;
  }

  /**
   * Clear all registered templates
   */
  clearTemplates(): void {
    this.templateConfigs.clear();
    this.templates.clear();
  }

  /**
   * Add an event listener
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Function to remove the listener
   */
  on<K extends keyof EngineEvents>(
    event: K,
    handler: EngineEventHandler<K>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    handlers?.add(handler as EngineEventHandler<keyof EngineEvents>);

    return () => {
      handlers?.delete(handler as EngineEventHandler<keyof EngineEvents>);
    };
  }

  /**
   * Get the underlying Handlebars instance (for advanced usage)
   *
   * @returns Handlebars instance
   */
  getHandlebars(): typeof Handlebars {
    return this.handlebars;
  }

  /**
   * Get the template loader instance
   *
   * @returns Template loader
   */
  getLoader(): TemplateLoader {
    return this.loader;
  }

  /**
   * Register all built-in helpers
   */
  private registerBuiltinHelpers(): void {
    const helpers = getBuiltinHelpers();
    for (const helper of helpers) {
      this.handlebars.registerHelper(helper.name, helper.fn as HelperDelegate);
    }

    // Register additional Handlebars-style helpers
    this.registerArithmeticHelpers();
    this.registerLogicalHelpers();
  }

  /**
   * Register built-in macros as partials
   */
  private registerBuiltinMacros(): void {
    const macros = getBuiltinMacros();
    for (const macro of macros) {
      this.macros.set(macro.name, macro);
      this.handlebars.registerPartial(macro.name, macro.template);
    }
  }

  /**
   * Register arithmetic helpers
   */
  private registerArithmeticHelpers(): void {
    this.handlebars.registerHelper('add', (a: number, b: number) => a + b);
    this.handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
    this.handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    this.handlebars.registerHelper('divide', (a: number, b: number) =>
      b !== 0 ? a / b : 0
    );
    this.handlebars.registerHelper('mod', (a: number, b: number) =>
      b !== 0 ? a % b : 0
    );
    this.handlebars.registerHelper('abs', (a: number) => Math.abs(a));
    this.handlebars.registerHelper('ceil', (a: number) => Math.ceil(a));
    this.handlebars.registerHelper('floor', (a: number) => Math.floor(a));
    this.handlebars.registerHelper('round', (a: number) => Math.round(a));
  }

  /**
   * Register logical helpers
   */
  private registerLogicalHelpers(): void {
    this.handlebars.registerHelper(
      'and',
      function (this: unknown, ...args: unknown[]) {
        const options = args.pop() as Handlebars.HelperOptions;
        const values = args;
        const result = values.every(Boolean);
        if (options?.fn) {
          return result
            ? options.fn(this)
            : options.inverse
              ? options.inverse(this)
              : '';
        }
        return result;
      }
    );

    this.handlebars.registerHelper(
      'or',
      function (this: unknown, ...args: unknown[]) {
        const options = args.pop() as Handlebars.HelperOptions;
        const values = args;
        const result = values.some(Boolean);
        if (options?.fn) {
          return result
            ? options.fn(this)
            : options.inverse
              ? options.inverse(this)
              : '';
        }
        return result;
      }
    );

    this.handlebars.registerHelper('not', (value: unknown) => !value);

    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    this.handlebars.registerHelper('lte', (a: number, b: number) => a <= b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('gte', (a: number, b: number) => a >= b);

    // Helper to create arrays inline
    this.handlebars.registerHelper('array', (...args: unknown[]) => {
      args.pop(); // Remove options object
      return args;
    });

    // Helper to create objects inline
    this.handlebars.registerHelper(
      'object',
      (options: Handlebars.HelperOptions) => {
        return options?.hash || {};
      }
    );

    // Ternary helper
    this.handlebars.registerHelper(
      'ternary',
      (condition: unknown, ifTrue: unknown, ifFalse: unknown) => {
        return condition ? ifTrue : ifFalse;
      }
    );

    // Default value helper
    this.handlebars.registerHelper(
      'default',
      (value: unknown, defaultValue: unknown) => {
        return value !== undefined && value !== null ? value : defaultValue;
      }
    );
  }

  /**
   * Get or compile a template
   */
  private getOrCompileTemplate(template: string): HandlebarsTemplateDelegate {
    // Check if it's a registered template ID
    const cached = this.templates.get(template);
    if (cached) {
      return cached;
    }

    // Compile as inline template
    return this.handlebars.compile(template);
  }

  /**
   * Prepare context with defaults and system values
   */
  private prepareContext(context: TemplateContext): Record<string, unknown> {
    const system = {
      timestamp: new Date(),
      ...context.system,
    };

    return {
      ...context.variables,
      system,
      memory: context.memory,
      tools: context.tools,
      metadata: context.metadata,
    };
  }

  /**
   * Create a template error from an exception
   */
  private createTemplateError(
    error: unknown,
    templateId?: string
  ): TemplateError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Try to parse line/column from Handlebars error
    const lineMatch = errorMessage.match(/line (\d+)/i);
    const columnMatch = errorMessage.match(/column (\d+)/i);

    return {
      code: 'TEMPLATE_ERROR',
      message: errorMessage,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: columnMatch ? parseInt(columnMatch[1], 10) : undefined,
      templateId,
      stack: errorStack,
    };
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<K extends keyof EngineEvents>(
    event: K,
    data: EngineEvents[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as EngineEventHandler<K>)(data);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }
}

/**
 * Create a new PromptTemplateEngine instance
 *
 * @param options - Default render options
 * @param loaderBaseDir - Base directory for template loading
 * @returns Configured engine instance
 */
export function createEngine(
  options?: Partial<RenderOptions>,
  loaderBaseDir?: string
): PromptTemplateEngine {
  return new PromptTemplateEngine(options, loaderBaseDir);
}
