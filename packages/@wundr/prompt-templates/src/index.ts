/**
 * @wundr/prompt-templates - Jinja2-style dynamic prompt templating using Handlebars
 *
 * This package provides a powerful templating engine for creating dynamic AI prompts
 * with support for variables, helpers, macros, and context-aware rendering.
 *
 * @example Basic usage
 * ```typescript
 * import { createEngine } from '@wundr.io/prompt-templates';
 *
 * const engine = createEngine();
 *
 * const result = engine.render(
 *   'Hello, {{name}}! You are a {{role}}.',
 *   { variables: { name: 'Claude', role: 'helpful assistant' } }
 * );
 *
 * console.log(result.output);
 * // Output: "Hello, Claude! You are a helpful assistant."
 * ```
 *
 * @example Using macros
 * ```typescript
 * import { createEngine } from '@wundr.io/prompt-templates';
 *
 * const engine = createEngine();
 *
 * const result = engine.render(
 *   '{{> systemRole role="a coding assistant" expertise="TypeScript" }}',
 *   { variables: {} }
 * );
 * ```
 *
 * @example Loading templates from files
 * ```typescript
 * import { createEngine } from '@wundr.io/prompt-templates';
 *
 * const engine = createEngine({}, '/path/to/templates');
 * engine.loadTemplate('my-prompt');
 *
 * const result = engine.render('my-prompt', {
 *   variables: { user: 'John' }
 * });
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  // Core types
  JsonPrimitive,
  JsonValue,
  JsonObject,
  JsonArray,
  // Context types
  TemplateContext,
  SystemContext,
  MemoryContext,
  ConversationMessage,
  // Tool types
  ToolDefinition,
  ToolParameters,
  ToolParameterProperty,
  // Template configuration
  PromptTemplateConfig,
  MacroDefinition,
  MacroParameter,
  HelperDefinition,
  HelperFunction,
  SafeString,
  // Render types
  RenderOptions,
  RenderResult,
  RenderMetadata,
  TemplateError,
  // Loader types
  LoaderOptions,
  // Event types
  EngineEvents,
  EngineEventHandler,
} from './types.js';

// Zod schemas for validation
export {
  PromptTemplateConfigSchema,
  ToolDefinitionSchema,
  MacroDefinitionSchema,
} from './types.js';

// Engine
export { PromptTemplateEngine, createEngine } from './engine.js';

// Loader
export { TemplateLoader, createLoader } from './loader.js';

// Helpers
export {
  formatTools,
  ifDefined,
  codeBlock,
  formatMemory,
  repeat,
  formatDate,
  json,
  truncate,
  join,
  compare,
  capitalize,
  uppercase,
  lowercase,
  indent,
  wrap,
  bulletList,
  numberedList,
  getBuiltinHelpers,
} from './helpers.js';

// Macros
export {
  systemRoleMacro,
  taskContextMacro,
  outputFormatMacro,
  conversationHistoryMacro,
  toolsSectionMacro,
  codeContextMacro,
  chainOfThoughtMacro,
  fewShotExamplesMacro,
  safetyGuardrailsMacro,
  personaMacro,
  getBuiltinMacros,
  getMacroByName,
  getMacroNames,
} from './macros.js';

// Package info
export const version = '1.0.3';
export const name = '@wundr.io/prompt-templates';
