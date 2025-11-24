/**
 * @packageDocumentation
 * Org Genesis - Organizational generation and context compilation for AI-managed organizations.
 *
 * This package provides the complete infrastructure for:
 * - Dynamic context compilation based on disciplines
 * - Global agent registry for Charters, Agents, Tools, Hooks
 * - Organizational generation via conversational interface
 * - CLI tools for managing AI organizations
 *
 * @example
 * ```typescript
 * import { createGenesisEngine, createRegistryManager } from '@wundr/org-genesis';
 *
 * // Generate a new organization
 * const genesis = createGenesisEngine();
 * const result = await genesis.generate('Create an AI-managed hedge fund');
 *
 * // Store in registry
 * const registry = createRegistryManager({ storageType: 'file' });
 * await genesis.saveToRegistry(result);
 * ```
 *
 * @module @wundr/org-genesis
 */

// Core types
export * from './types/index.js';

// Utilities
export * from './utils/index.js';

// Context Compiler
export * from './context-compiler/index.js';

// Global Registry
export * from './registry/index.js';

// Organizational Generator
export * from './generator/index.js';

// Built-in Templates
export * from './templates/index.js';

// CLI
export * from './cli/index.js';
