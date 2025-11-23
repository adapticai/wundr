/**
 * @wundr/prompt-templates - Template file loader
 */

import * as fs from 'fs';
import * as path from 'path';

import { PromptTemplateConfigSchema } from './types.js';

import type {
  PromptTemplateConfig,
  LoaderOptions,
  TemplateError,
} from './types.js';

/**
 * Default loader options
 */
const DEFAULT_LOADER_OPTIONS: Required<LoaderOptions> = {
  baseDir: process.cwd(),
  extension: '.hbs',
  cache: true,
  watch: false,
};

/**
 * Template cache for loaded templates
 */
interface TemplateCache {
  readonly template: PromptTemplateConfig;
  readonly loadedAt: Date;
  readonly filePath: string;
}

/**
 * TemplateLoader handles loading templates from the filesystem
 */
export class TemplateLoader {
  private readonly options: Required<LoaderOptions>;
  private readonly cache: Map<string, TemplateCache> = new Map();
  private readonly watchers: Map<string, fs.FSWatcher> = new Map();

  /**
   * Create a new TemplateLoader
   *
   * @param options - Loader configuration options
   */
  constructor(options: LoaderOptions = {}) {
    this.options = { ...DEFAULT_LOADER_OPTIONS, ...options };
  }

  /**
   * Load a template from a file
   *
   * @param templatePath - Path to the template file (relative or absolute)
   * @returns Loaded template configuration
   * @throws Error if template cannot be loaded or is invalid
   */
  loadTemplate(templatePath: string): PromptTemplateConfig {
    const absolutePath = this.resolveTemplatePath(templatePath);

    // Check cache first
    if (this.options.cache) {
      const cached = this.cache.get(absolutePath);
      if (cached) {
        return cached.template;
      }
    }

    // Load from filesystem
    const template = this.loadFromFile(absolutePath);

    // Cache the template
    if (this.options.cache) {
      this.cache.set(absolutePath, {
        template,
        loadedAt: new Date(),
        filePath: absolutePath,
      });

      // Set up watcher if enabled
      if (this.options.watch && !this.watchers.has(absolutePath)) {
        this.setupWatcher(absolutePath);
      }
    }

    return template;
  }

  /**
   * Load a template asynchronously
   *
   * @param templatePath - Path to the template file
   * @returns Promise resolving to loaded template configuration
   */
  async loadTemplateAsync(templatePath: string): Promise<PromptTemplateConfig> {
    const absolutePath = this.resolveTemplatePath(templatePath);

    // Check cache first
    if (this.options.cache) {
      const cached = this.cache.get(absolutePath);
      if (cached) {
        return cached.template;
      }
    }

    // Load from filesystem asynchronously
    const template = await this.loadFromFileAsync(absolutePath);

    // Cache the template
    if (this.options.cache) {
      this.cache.set(absolutePath, {
        template,
        loadedAt: new Date(),
        filePath: absolutePath,
      });

      // Set up watcher if enabled
      if (this.options.watch && !this.watchers.has(absolutePath)) {
        this.setupWatcher(absolutePath);
      }
    }

    return template;
  }

  /**
   * Load all templates from a directory
   *
   * @param dirPath - Directory path to scan
   * @param recursive - Whether to scan subdirectories
   * @returns Array of loaded templates
   */
  loadTemplatesFromDirectory(
    dirPath?: string,
    recursive: boolean = false
  ): PromptTemplateConfig[] {
    const absolutePath = dirPath
      ? path.isAbsolute(dirPath)
        ? dirPath
        : path.join(this.options.baseDir, dirPath)
      : this.options.baseDir;

    const templates: PromptTemplateConfig[] = [];
    const files = this.getTemplateFiles(absolutePath, recursive);

    for (const file of files) {
      try {
        const template = this.loadTemplate(file);
        templates.push(template);
      } catch (error) {
        // Log warning but continue loading other templates
        console.warn(`Failed to load template ${file}:`, error);
      }
    }

    return templates;
  }

  /**
   * Load raw template content from a file (without metadata parsing)
   *
   * @param templatePath - Path to the template file
   * @returns Raw template string
   */
  loadRawTemplate(templatePath: string): string {
    const absolutePath = this.resolveTemplatePath(templatePath);

    if (!fs.existsSync(absolutePath)) {
      throw this.createError(
        'TEMPLATE_NOT_FOUND',
        `Template file not found: ${absolutePath}`
      );
    }

    return fs.readFileSync(absolutePath, 'utf-8');
  }

  /**
   * Load raw template content asynchronously
   *
   * @param templatePath - Path to the template file
   * @returns Promise resolving to raw template string
   */
  async loadRawTemplateAsync(templatePath: string): Promise<string> {
    const absolutePath = this.resolveTemplatePath(templatePath);

    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
    } catch {
      throw this.createError(
        'TEMPLATE_NOT_FOUND',
        `Template file not found: ${absolutePath}`
      );
    }

    return fs.promises.readFile(absolutePath, 'utf-8');
  }

  /**
   * Check if a template exists
   *
   * @param templatePath - Path to the template file
   * @returns True if template exists
   */
  templateExists(templatePath: string): boolean {
    const absolutePath = this.resolveTemplatePath(templatePath);
    return fs.existsSync(absolutePath);
  }

  /**
   * Clear the template cache
   *
   * @param templatePath - Optional specific template to clear, or all if not provided
   */
  clearCache(templatePath?: string): void {
    if (templatePath) {
      const absolutePath = this.resolveTemplatePath(templatePath);
      this.cache.delete(absolutePath);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics object
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Stop all file watchers
   */
  stopWatching(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Resolve template path to absolute path
   */
  private resolveTemplatePath(templatePath: string): string {
    // If already absolute, use as-is
    if (path.isAbsolute(templatePath)) {
      return this.ensureExtension(templatePath);
    }

    // Resolve relative to base directory
    return this.ensureExtension(path.join(this.options.baseDir, templatePath));
  }

  /**
   * Ensure template path has the correct extension
   */
  private ensureExtension(filePath: string): string {
    if (!path.extname(filePath)) {
      return filePath + this.options.extension;
    }
    return filePath;
  }

  /**
   * Load template configuration from file
   */
  private loadFromFile(filePath: string): PromptTemplateConfig {
    if (!fs.existsSync(filePath)) {
      throw this.createError(
        'TEMPLATE_NOT_FOUND',
        `Template file not found: ${filePath}`
      );
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseTemplateContent(content, filePath);
  }

  /**
   * Load template configuration from file asynchronously
   */
  private async loadFromFileAsync(
    filePath: string
  ): Promise<PromptTemplateConfig> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw this.createError(
        'TEMPLATE_NOT_FOUND',
        `Template file not found: ${filePath}`
      );
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseTemplateContent(content, filePath);
  }

  /**
   * Parse template content with optional frontmatter
   */
  private parseTemplateContent(
    content: string,
    filePath: string
  ): PromptTemplateConfig {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (frontmatterMatch) {
      // Has frontmatter - parse YAML/JSON metadata
      const metadataStr = frontmatterMatch[1];
      const templateStr = frontmatterMatch[2];

      try {
        const metadata = JSON.parse(metadataStr);
        const config = {
          ...metadata,
          template: templateStr?.trim() || '',
          id: metadata.id || path.basename(filePath, this.options.extension),
        };

        return this.validateConfig(config);
      } catch {
        // If JSON parse fails, treat as simple key: value pairs
        const metadata = this.parseSimpleFrontmatter(metadataStr);
        const config = {
          ...metadata,
          template: templateStr?.trim() || '',
          id: metadata.id || path.basename(filePath, this.options.extension),
        };

        return this.validateConfig(config);
      }
    }

    // No frontmatter - create minimal config
    const id = path.basename(filePath, this.options.extension);
    return this.validateConfig({
      id,
      name: id,
      version: '1.0.0',
      template: content.trim(),
    });
  }

  /**
   * Parse simple frontmatter format (key: value)
   */
  private parseSimpleFrontmatter(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value: unknown = match[2]?.trim() || '';

        // Try to parse as JSON for complex values
        if (value && typeof value === 'string') {
          if (value.startsWith('[') || value.startsWith('{')) {
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as string
            }
          } else if (value === 'true') {
            value = true;
          } else if (value === 'false') {
            value = false;
          } else if (/^\d+$/.test(value)) {
            value = parseInt(value, 10);
          }
        }

        if (key) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Validate template configuration
   */
  private validateConfig(config: unknown): PromptTemplateConfig {
    const result = PromptTemplateConfigSchema.safeParse(config);

    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw this.createError(
        'INVALID_TEMPLATE_CONFIG',
        `Invalid template configuration: ${errors}`
      );
    }

    return result.data as PromptTemplateConfig;
  }

  /**
   * Get all template files in a directory
   */
  private getTemplateFiles(dirPath: string, recursive: boolean): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dirPath)) {
      return files;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        files.push(...this.getTemplateFiles(fullPath, recursive));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(this.options.extension)
      ) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Set up file watcher for template changes
   */
  private setupWatcher(filePath: string): void {
    const watcher = fs.watch(filePath, eventType => {
      if (eventType === 'change') {
        // Invalidate cache on change
        this.cache.delete(filePath);
      }
    });

    this.watchers.set(filePath, watcher);
  }

  /**
   * Create a template error
   */
  private createError(code: string, message: string): TemplateError & Error {
    const error = new Error(message) as TemplateError & Error;
    (error as unknown as { code: string }).code = code;
    return error;
  }
}

/**
 * Create a template loader with default options
 *
 * @param options - Loader options
 * @returns Configured template loader
 */
export function createLoader(options?: LoaderOptions): TemplateLoader {
  return new TemplateLoader(options);
}
