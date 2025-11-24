/**
 * @packageDocumentation
 * Storage layer for the Global Agent Registry.
 *
 * Provides file-based and in-memory storage implementations for persisting
 * registry data including charters, disciplines, agents, tools, and hooks.
 *
 * @remarks
 * The storage layer abstracts away the persistence mechanism, allowing the
 * registry to operate with different backends:
 *
 * - **FileStorage**: Persistent storage using the local filesystem
 * - **MemoryStorage**: In-memory storage for testing and ephemeral use cases
 *
 * All storage implementations conform to the `RegistryStorage` interface,
 * enabling easy swapping between backends.
 *
 * @example
 * ```typescript
 * import { FileStorage, MemoryStorage } from '@wundr/org-genesis/registry/storage';
 *
 * // File-based storage for production
 * const fileStorage = new FileStorage({
 *   basePath: '~/.wundr/registry',
 *   format: 'json'
 * });
 *
 * // In-memory storage for testing
 * const memoryStorage = new MemoryStorage();
 * ```
 *
 * @module registry/storage
 */

export * from './storage-interface.js';
export * from './file-storage.js';
export * from './memory-storage.js';
