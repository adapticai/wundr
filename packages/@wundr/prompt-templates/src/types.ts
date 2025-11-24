/**
 * @wundr/prompt-templates - Type definitions for dynamic prompt templating
 */

import { z } from 'zod';

/**
 * JSON-compatible primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-compatible value types
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * JSON-compatible object type
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * JSON-compatible array type
 */
export type JsonArray = ReadonlyArray<JsonValue>;

/**
 * Context data passed to templates for rendering
 */
export interface TemplateContext {
  /** Variables available in the template */
  readonly variables: Record<string, unknown>;
  /** System-level context (e.g., current date, user info) */
  readonly system?: SystemContext;
  /** Memory/history context for conversation-aware templates */
  readonly memory?: MemoryContext;
  /** Tools/functions available to the AI */
  readonly tools?: ToolDefinition[];
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * System-level context available to all templates
 */
export interface SystemContext {
  /** Current timestamp */
  readonly timestamp?: Date;
  /** User identifier */
  readonly userId?: string;
  /** Session identifier */
  readonly sessionId?: string;
  /** Environment (development, production, test) */
  readonly environment?: 'development' | 'production' | 'test';
  /** Model being used */
  readonly model?: string;
  /** Custom system values */
  readonly [key: string]: unknown;
}

/**
 * Memory context for conversation history
 */
export interface MemoryContext {
  /** Previous messages in the conversation */
  readonly messages?: ConversationMessage[];
  /** Key facts/context to remember */
  readonly facts?: string[];
  /** Short-term working memory */
  readonly shortTerm?: Record<string, unknown>;
  /** Long-term persistent memory */
  readonly longTerm?: Record<string, unknown>;
}

/**
 * Conversation message structure
 */
export interface ConversationMessage {
  /** Role of the message sender */
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message content */
  readonly content: string;
  /** Optional message name */
  readonly name?: string;
  /** Timestamp when message was sent */
  readonly timestamp?: Date;
  /** Additional message metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool/function definition for AI prompts
 */
export interface ToolDefinition {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** Input parameters schema */
  readonly parameters?: ToolParameters;
  /** Whether the tool returns data */
  readonly returnsData?: boolean;
  /** Example usage */
  readonly examples?: string[];
}

/**
 * Tool parameters schema (JSON Schema-like)
 */
export interface ToolParameters {
  /** Parameter type */
  readonly type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  /** Object properties */
  readonly properties?: Record<string, ToolParameterProperty>;
  /** Required property names */
  readonly required?: string[];
  /** Additional properties allowed */
  readonly additionalProperties?: boolean;
}

/**
 * Individual tool parameter property
 */
export interface ToolParameterProperty {
  /** Property type */
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Property description */
  readonly description?: string;
  /** Enum values for constrained types */
  readonly enum?: readonly (string | number)[];
  /** Default value */
  readonly default?: unknown;
  /** Array item schema */
  readonly items?: ToolParameterProperty;
}

/**
 * Prompt template configuration
 */
export interface PromptTemplateConfig {
  /** Unique template identifier */
  readonly id: string;
  /** Template name for display */
  readonly name: string;
  /** Template description */
  readonly description?: string;
  /** Template version */
  readonly version: string;
  /** The template content (Handlebars format) */
  readonly template: string;
  /** Default context values */
  readonly defaults?: Partial<TemplateContext>;
  /** Required variables that must be provided */
  readonly requiredVariables?: string[];
  /** Template tags for categorization */
  readonly tags?: string[];
  /** Template author */
  readonly author?: string;
  /** Creation timestamp */
  readonly createdAt?: Date;
  /** Last update timestamp */
  readonly updatedAt?: Date;
}

/**
 * Macro definition for reusable template components
 */
export interface MacroDefinition {
  /** Macro name */
  readonly name: string;
  /** Macro description */
  readonly description?: string;
  /** Macro template content */
  readonly template: string;
  /** Expected parameters */
  readonly parameters?: MacroParameter[];
  /** Example usage */
  readonly example?: string;
}

/**
 * Macro parameter definition
 */
export interface MacroParameter {
  /** Parameter name */
  readonly name: string;
  /** Parameter description */
  readonly description?: string;
  /** Parameter type */
  readonly type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Whether the parameter is required */
  readonly required?: boolean;
  /** Default value */
  readonly default?: unknown;
}

/**
 * Helper function definition
 */
export interface HelperDefinition {
  /** Helper name */
  readonly name: string;
  /** Helper description */
  readonly description?: string;
  /** The helper function implementation */
  readonly fn: HelperFunction;
}

/**
 * Helper function signature (Handlebars-compatible)
 */
export type HelperFunction = (
  ...args: unknown[]
) => string | SafeString | undefined;

/**
 * Handlebars SafeString type for HTML-safe output
 */
export interface SafeString {
  readonly toHTML: () => string;
  readonly toString: () => string;
}

/**
 * Template render options
 */
export interface RenderOptions {
  /** Strict mode - throw on undefined variables */
  readonly strict?: boolean;
  /** Custom delimiters for template parsing */
  readonly delimiters?: [string, string];
  /** Enable HTML escaping (default: false for prompts) */
  readonly escapeHtml?: boolean;
  /** Maximum template depth for nested templates */
  readonly maxDepth?: number;
  /** Timeout for template rendering (ms) */
  readonly timeout?: number;
}

/**
 * Template render result
 */
export interface RenderResult {
  /** Whether rendering was successful */
  readonly success: boolean;
  /** Rendered output (if successful) */
  readonly output?: string;
  /** Error information (if failed) */
  readonly error?: TemplateError;
  /** Rendering metadata */
  readonly metadata?: RenderMetadata;
}

/**
 * Template error information
 */
export interface TemplateError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Line number where error occurred */
  readonly line?: number;
  /** Column number where error occurred */
  readonly column?: number;
  /** Template ID that caused the error */
  readonly templateId?: string;
  /** Original error stack */
  readonly stack?: string;
}

/**
 * Metadata about the render operation
 */
export interface RenderMetadata {
  /** Time taken to render (ms) */
  readonly renderTime: number;
  /** Template ID used */
  readonly templateId?: string;
  /** Variables that were used */
  readonly usedVariables?: string[];
  /** Macros that were invoked */
  readonly usedMacros?: string[];
  /** Helpers that were invoked */
  readonly usedHelpers?: string[];
}

/**
 * Template loader options
 */
export interface LoaderOptions {
  /** Base directory for template files */
  readonly baseDir?: string;
  /** File extension for template files */
  readonly extension?: string;
  /** Enable template caching */
  readonly cache?: boolean;
  /** Watch for file changes */
  readonly watch?: boolean;
}

/**
 * Template engine events
 */
export interface EngineEvents {
  readonly 'template:loaded': { templateId: string };
  readonly 'template:rendered': { templateId: string; renderTime: number };
  readonly 'template:error': { templateId: string; error: TemplateError };
  readonly 'macro:registered': { name: string };
  readonly 'helper:registered': { name: string };
}

/**
 * Template engine event handler
 */
export type EngineEventHandler<K extends keyof EngineEvents> = (
  event: EngineEvents[K]
) => void;

// Zod schemas for validation

/**
 * Zod schema for PromptTemplateConfig
 */
export const PromptTemplateConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  template: z.string().min(1),
  defaults: z.record(z.unknown()).optional(),
  requiredVariables: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Zod schema for ToolDefinition
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z
    .object({
      type: z.enum(['object', 'array', 'string', 'number', 'boolean']),
      properties: z.record(z.unknown()).optional(),
      required: z.array(z.string()).optional(),
      additionalProperties: z.boolean().optional(),
    })
    .optional(),
  returnsData: z.boolean().optional(),
  examples: z.array(z.string()).optional(),
});

/**
 * Zod schema for MacroDefinition
 */
export const MacroDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  template: z.string().min(1),
  parameters: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z
          .enum(['string', 'number', 'boolean', 'array', 'object'])
          .optional(),
        required: z.boolean().optional(),
        default: z.unknown().optional(),
      }),
    )
    .optional(),
  example: z.string().optional(),
});
