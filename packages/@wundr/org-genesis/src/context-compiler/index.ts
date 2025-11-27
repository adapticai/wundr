/**
 * @packageDocumentation
 * Context Compiler module for dynamic environment compilation.
 *
 * The Context Compiler is responsible for:
 * - Loading discipline packs from the registry
 * - Rendering configuration templates
 * - Generating CLAUDE.md, claude_config.json, settings.json
 * - Writing compiled configs to git worktrees
 *
 * @example
 * ```typescript
 * import { createContextCompiler } from '@wundr/org-genesis/context-compiler';
 *
 * const compiler = createContextCompiler();
 * const result = await compiler.compile({
 *   vpId: 'orchestrator-engineering',
 *   disciplineIds: ['engineering', 'testing'],
 *   taskDescription: 'Implement new feature'
 * });
 * ```
 *
 * @module context-compiler
 */

export * from './template-renderer.js';
export * from './discipline-loader.js';
export * from './config-generator.js';
export * from './worktree-writer.js';
export * from './compiler.js';
