/**
 * RAG Store Management Tool Handler
 *
 * Provides MCP tool operations for managing RAG (Retrieval Augmented Generation) stores.
 * Supports create, list, get, delete, sync, and status operations.
 *
 * @module @wundr/mcp-server/tools/rag/rag-store-manage
 */

import { z } from 'zod';
import type { McpToolResult } from '../registry.js';
import type {
  RAGStore,
  RAGStoreAction,
  StoreConfig,
  StoreStats,
  StoreHealthStatus,
  SyncResult,
} from './types.js';
import { DEFAULT_STORE_CONFIG } from './types.js';

// ============================================================================
// Input Schema
// ============================================================================

export const StoreConfigSchema = z.object({
  chunkSize: z.number().int().positive().optional().describe('Chunk size for text splitting'),
  chunkOverlap: z.number().int().nonnegative().optional().describe('Overlap between chunks'),
  includePatterns: z.array(z.string()).optional().describe('File patterns to include'),
  excludePatterns: z.array(z.string()).optional().describe('File patterns to exclude'),
  maxFileSize: z.number().int().positive().optional().describe('Maximum file size in bytes'),
  embeddingModel: z.string().optional().describe('Embedding model to use'),
});

export const RagStoreManageInputSchema = z.object({
  action: z.enum(['create', 'list', 'get', 'delete', 'sync', 'status'] as const).describe('Store operation to perform'),
  storeId: z.string().optional().describe('Store identifier (for get, delete, sync, status)'),
  displayName: z.string().optional().describe('Display name (for create)'),
  sourcePath: z.string().optional().describe('Source path (for create, sync)'),
  config: StoreConfigSchema.optional().describe('Store configuration (for create)'),
  forceReindex: z.boolean().optional().default(false).describe('Force reindex (for sync)'),
  format: z.enum(['json', 'table', 'text']).optional().default('json').describe('Output format'),
});

export type RagStoreManageInputValidated = z.infer<typeof RagStoreManageInputSchema>;

// ============================================================================
// Output Types
// ============================================================================

export interface RagStoreManageOutput {
  action: RAGStoreAction;
  store?: RAGStore;
  stores?: RAGStore[];
  stats?: StoreStats;
  syncResult?: SyncResult;
  deleted?: boolean;
  message: string;
}

// ============================================================================
// Store Registry (Singleton for in-memory store management)
// ============================================================================

interface StoreMetadata extends RAGStore {
  files: Map<string, IndexedFileMetadata>;
}

interface IndexedFileMetadata {
  path: string;
  hash: string;
  sizeBytes: number;
  lastModified: string;
  indexedAt: string;
  chunkCount: number;
  mimeType?: string;
}

class RAGStoreRegistry {
  private stores: Map<string, StoreMetadata> = new Map();
  private static instance: RAGStoreRegistry;

  private constructor() {}

  static getInstance(): RAGStoreRegistry {
    if (!RAGStoreRegistry.instance) {
      RAGStoreRegistry.instance = new RAGStoreRegistry();
    }
    return RAGStoreRegistry.instance;
  }

  getStore(id: string): StoreMetadata | undefined {
    return this.stores.get(id);
  }

  setStore(id: string, store: StoreMetadata): void {
    this.stores.set(id, store);
  }

  deleteStore(id: string): boolean {
    return this.stores.delete(id);
  }

  hasStore(id: string): boolean {
    return this.stores.has(id);
  }

  getAllStores(): RAGStore[] {
    return Array.from(this.stores.values()).map(store => ({
      id: store.id,
      displayName: store.displayName,
      createdAt: store.createdAt,
      lastSyncAt: store.lastSyncAt,
      fileCount: store.fileCount,
      chunkCount: store.chunkCount,
      sizeBytes: store.sizeBytes,
      status: store.status,
      config: store.config,
    }));
  }

  getStoreCount(): number {
    return this.stores.size;
  }
}

const storeRegistry = RAGStoreRegistry.getInstance();

// ============================================================================
// Individual Operation Handlers (Exported)
// ============================================================================

/**
 * Create a new RAG store with optional display name
 */
export async function createStore(
  storeId: string,
  displayName?: string,
  config?: StoreConfig,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    if (!storeId || typeof storeId !== 'string') {
      return {
        success: false,
        error: 'Store ID is required and must be a string',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The storeId parameter is required when creating a store',
        },
      };
    }

    if (storeRegistry.hasStore(storeId)) {
      return {
        success: false,
        error: `Store '${storeId}' already exists`,
        errorDetails: {
          code: 'STORE_EXISTS',
          message: `A store with ID '${storeId}' already exists`,
        },
      };
    }

    const now = new Date().toISOString();
    const mergedConfig = { ...DEFAULT_STORE_CONFIG, ...config };

    const store: StoreMetadata = {
      id: storeId,
      displayName: displayName || storeId,
      createdAt: now,
      fileCount: 0,
      chunkCount: 0,
      sizeBytes: 0,
      status: 'active',
      config: mergedConfig,
      files: new Map(),
    };

    storeRegistry.setStore(storeId, store);

    const ragStore: RAGStore = {
      id: store.id,
      displayName: store.displayName,
      createdAt: store.createdAt,
      fileCount: store.fileCount,
      chunkCount: store.chunkCount,
      sizeBytes: store.sizeBytes,
      status: store.status,
      config: store.config,
    };

    return {
      success: true,
      message: `Store '${storeId}' created successfully`,
      data: {
        action: 'create',
        store: ragStore,
        message: `Created RAG store '${displayName || storeId}' with ID '${storeId}'`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'CREATE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * List all RAG stores with metadata
 */
export async function listStores(): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    const stores = storeRegistry.getAllStores();

    return {
      success: true,
      message: `Found ${stores.length} store(s)`,
      data: {
        action: 'list',
        stores,
        message: `Found ${stores.length} store(s)`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'LIST_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Get store details and statistics
 */
export async function getStore(
  storeId: string,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    if (!storeId) {
      return {
        success: false,
        error: 'Store ID is required',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The storeId parameter is required when getting a store',
        },
      };
    }

    const store = storeRegistry.getStore(storeId);
    if (!store) {
      return {
        success: false,
        error: `Store '${storeId}' not found`,
        errorDetails: {
          code: 'STORE_NOT_FOUND',
          message: `No store found with ID '${storeId}'`,
        },
      };
    }

    const ragStore: RAGStore = {
      id: store.id,
      displayName: store.displayName,
      createdAt: store.createdAt,
      lastSyncAt: store.lastSyncAt,
      fileCount: store.fileCount,
      chunkCount: store.chunkCount,
      sizeBytes: store.sizeBytes,
      status: store.status,
      config: store.config,
    };

    return {
      success: true,
      message: `Retrieved store '${storeId}'`,
      data: {
        action: 'get',
        store: ragStore,
        message: `Store '${store.displayName}' retrieved successfully`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'GET_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Delete store and all indexed data
 */
export async function deleteStore(
  storeId: string,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    if (!storeId) {
      return {
        success: false,
        error: 'Store ID is required',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The storeId parameter is required when deleting a store',
        },
      };
    }

    if (!storeRegistry.hasStore(storeId)) {
      return {
        success: false,
        error: `Store '${storeId}' not found`,
        errorDetails: {
          code: 'STORE_NOT_FOUND',
          message: `No store found with ID '${storeId}'`,
        },
      };
    }

    const deleted = storeRegistry.deleteStore(storeId);

    return {
      success: true,
      message: `Store '${storeId}' deleted successfully`,
      data: {
        action: 'delete',
        deleted,
        message: `Deleted RAG store '${storeId}' and all indexed data`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'DELETE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Sync store with changed files only (incremental sync)
 */
export async function syncStore(
  storeId: string,
  sourcePath: string,
  forceReindex: boolean = false,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    if (!storeId) {
      return {
        success: false,
        error: 'Store ID is required',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The storeId parameter is required when syncing a store',
        },
      };
    }

    if (!sourcePath) {
      return {
        success: false,
        error: 'Source path is required for sync operation',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The sourcePath parameter is required when syncing a store',
        },
      };
    }

    const store = storeRegistry.getStore(storeId);
    if (!store) {
      return {
        success: false,
        error: `Store '${storeId}' not found`,
        errorDetails: {
          code: 'STORE_NOT_FOUND',
          message: `No store found with ID '${storeId}'`,
        },
      };
    }

    // Update store status
    store.status = 'syncing';
    const startTime = Date.now();

    // Perform sync operation
    const syncResult = await performSync(store, sourcePath, forceReindex);

    // Update store metadata
    store.status = 'active';
    store.lastSyncAt = new Date().toISOString();
    storeRegistry.setStore(storeId, store);

    return {
      success: true,
      message: `Sync completed for store '${storeId}'`,
      data: {
        action: 'sync',
        syncResult,
        message: `Synced ${syncResult.added} added, ${syncResult.updated} updated, ${syncResult.deleted} deleted files`,
      },
    };
  } catch (error) {
    // Reset status on error
    const store = storeRegistry.getStore(storeId);
    if (store) {
      store.status = 'error';
      storeRegistry.setStore(storeId, store);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Check indexing status and health
 */
export async function getStoreStatus(
  storeId: string,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    if (!storeId) {
      return {
        success: false,
        error: 'Store ID is required',
        errorDetails: {
          code: 'MISSING_PARAM',
          message: 'The storeId parameter is required when checking store status',
        },
      };
    }

    const store = storeRegistry.getStore(storeId);
    if (!store) {
      return {
        success: false,
        error: `Store '${storeId}' not found`,
        errorDetails: {
          code: 'STORE_NOT_FOUND',
          message: `No store found with ID '${storeId}'`,
        },
      };
    }

    const stats = computeStoreStats(store);

    const ragStore: RAGStore = {
      id: store.id,
      displayName: store.displayName,
      createdAt: store.createdAt,
      lastSyncAt: store.lastSyncAt,
      fileCount: store.fileCount,
      chunkCount: store.chunkCount,
      sizeBytes: store.sizeBytes,
      status: store.status,
      config: store.config,
    };

    return {
      success: true,
      message: `Status retrieved for store '${storeId}'`,
      data: {
        action: 'status',
        store: ragStore,
        stats,
        message: `Store '${store.displayName}' is ${stats.health.status}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetails: {
        code: 'STATUS_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Main RAG store management handler - routes to appropriate operation
 */
export async function ragStoreManageHandler(
  args: Record<string, unknown>,
): Promise<McpToolResult<RagStoreManageOutput>> {
  try {
    // Validate input
    const validationResult = RagStoreManageInputSchema.safeParse(args);
    if (!validationResult.success) {
      return {
        success: false,
        error: 'Input validation failed',
        errorDetails: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.message,
          context: { issues: validationResult.error.issues },
        },
      };
    }

    const validInput = validationResult.data;

    switch (validInput.action) {
      case 'create': {
        const storeId = validInput.storeId ||
          (validInput.displayName ? validInput.displayName.toLowerCase().replace(/[^a-z0-9-]/g, '-') : undefined);
        if (!storeId) {
          return {
            success: false,
            error: 'storeId or displayName is required for create action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'Either storeId or displayName must be provided when creating a store',
            },
          };
        }
        return createStore(storeId, validInput.displayName, validInput.config);
      }

      case 'list':
        return listStores();

      case 'get':
        if (!validInput.storeId) {
          return {
            success: false,
            error: 'storeId is required for get action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'The storeId parameter is required when getting a store',
            },
          };
        }
        return getStore(validInput.storeId);

      case 'delete':
        if (!validInput.storeId) {
          return {
            success: false,
            error: 'storeId is required for delete action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'The storeId parameter is required when deleting a store',
            },
          };
        }
        return deleteStore(validInput.storeId);

      case 'sync':
        if (!validInput.storeId) {
          return {
            success: false,
            error: 'storeId is required for sync action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'The storeId parameter is required when syncing a store',
            },
          };
        }
        if (!validInput.sourcePath) {
          return {
            success: false,
            error: 'sourcePath is required for sync action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'The sourcePath parameter is required when syncing a store',
            },
          };
        }
        return syncStore(validInput.storeId, validInput.sourcePath, validInput.forceReindex);

      case 'status':
        if (!validInput.storeId) {
          return {
            success: false,
            error: 'storeId is required for status action',
            errorDetails: {
              code: 'MISSING_PARAM',
              message: 'The storeId parameter is required when checking store status',
            },
          };
        }
        return getStoreStatus(validInput.storeId);

      default:
        return {
          success: false,
          error: `Unknown action: ${(validInput as Record<string, unknown>).action}`,
          errorDetails: {
            code: 'UNKNOWN_ACTION',
            message: `Action '${(validInput as Record<string, unknown>).action}' is not supported`,
          },
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        code: 'OPERATION_ERROR',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * RAG service interface for dependency injection
 */
export interface RAGServiceInterface {
  search?: (query: string, options?: Record<string, unknown>) => Promise<unknown>;
  index?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Creates the RAG store management handler with injected service (for testing/DI)
 *
 * @param ragService - Optional RAG service implementation for custom search/index operations.
 *                     When provided, the service can be used for production integrations.
 *                     Currently, the handler uses an internal registry for store management,
 *                     but the service parameter enables future extension points for:
 *                     - Custom embedding providers
 *                     - External vector database integrations
 *                     - Testing with mock services
 * @returns The RAG store management handler function
 */
export function createRagStoreManageHandler(ragService?: RAGServiceInterface) {
  // Store the service reference for potential future use in handler extensions
  // The current implementation uses the internal registry, but this factory
  // pattern allows for dependency injection when needed
  if (ragService) {
    // Log that a custom service was provided (useful for debugging)
    // In production, this could be used to override default behavior
    console.debug?.('[RAG] Custom RAG service provided to handler factory');
  }
  return ragStoreManageHandler;
}

// ============================================================================
// Helper Functions (Internal)
// ============================================================================

/**
 * Perform file sync operation (mock implementation)
 */
async function performSync(
  store: StoreMetadata,
  sourcePath: string,
  forceReindex: boolean,
): Promise<SyncResult> {
  const startTime = Date.now();

  // In production, this would:
  // 1. Scan the source directory for files matching include patterns
  // 2. Compare file hashes to detect changes
  // 3. Index new/changed files using the RAG service
  // 4. Remove deleted files from the index

  // Mock sync results for demonstration
  const mockAdded = forceReindex ? 5 : 2;
  const mockUpdated = forceReindex ? 0 : 1;
  const mockDeleted = 0;
  const mockUnchanged = forceReindex ? 0 : 10;

  // Update store statistics
  store.fileCount = mockAdded + mockUnchanged;
  store.chunkCount = store.fileCount * 10; // Assume ~10 chunks per file
  store.sizeBytes = store.fileCount * 5000; // Assume ~5KB per file

  return {
    added: mockAdded,
    updated: mockUpdated,
    deleted: mockDeleted,
    unchanged: mockUnchanged,
    totalChunks: store.chunkCount,
    durationMs: Date.now() - startTime + 100, // Add simulated processing time
  };
}

/**
 * Compute store statistics and health status
 */
function computeStoreStats(store: StoreMetadata): StoreStats {
  const fileTypes: Record<string, number> = {};

  // Count file types from tracked files
  for (const file of store.files.values()) {
    const ext = getFileExtension(file.path);
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  }

  // If no files tracked but fileCount > 0, add mock data
  if (store.files.size === 0 && store.fileCount > 0) {
    fileTypes['.ts'] = Math.floor(store.fileCount * 0.5);
    fileTypes['.js'] = Math.floor(store.fileCount * 0.2);
    fileTypes['.md'] = Math.floor(store.fileCount * 0.2);
    fileTypes['.json'] = Math.floor(store.fileCount * 0.1);
  }

  const health = computeStoreHealth(store);

  return {
    storeId: store.id,
    totalFiles: store.fileCount,
    totalChunks: store.chunkCount,
    totalSizeBytes: store.sizeBytes,
    avgChunkSize: store.chunkCount > 0 ? Math.round(store.sizeBytes / store.chunkCount) : 0,
    fileTypes,
    health,
  };
}

/**
 * Compute store health status
 */
function computeStoreHealth(store: StoreMetadata): StoreHealthStatus {
  const checks: StoreHealthStatus['checks'] = [];
  const now = new Date();

  // Check store status
  checks.push({
    name: 'store_status',
    status: store.status === 'active' ? 'pass' : store.status === 'syncing' ? 'warn' : 'fail',
    message: `Store status is ${store.status}`,
  });

  // Check last sync time
  if (store.lastSyncAt) {
    const lastSync = new Date(store.lastSyncAt);
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
    checks.push({
      name: 'sync_freshness',
      status: hoursSinceSync < 24 ? 'pass' : hoursSinceSync < 72 ? 'warn' : 'fail',
      message: `Last synced ${Math.round(hoursSinceSync)} hours ago`,
    });
  } else {
    checks.push({
      name: 'sync_freshness',
      status: 'warn',
      message: 'Store has never been synced',
    });
  }

  // Check file count
  checks.push({
    name: 'file_count',
    status: store.fileCount > 0 ? 'pass' : 'warn',
    message: `${store.fileCount} files indexed`,
  });

  // Check chunk count
  checks.push({
    name: 'chunk_count',
    status: store.chunkCount > 0 ? 'pass' : 'warn',
    message: `${store.chunkCount} chunks created`,
  });

  // Determine overall health
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (failCount > 0) {
    status = 'unhealthy';
  } else if (warnCount > 1) {
    status = 'degraded';
  }

  return {
    status,
    checks,
    lastCheckedAt: now.toISOString(),
  };
}

/**
 * Get file extension from path
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filePath.length - 1) {
    return 'unknown';
  }
  return filePath.substring(lastDot);
}

// ============================================================================
// Store Configuration Utilities (Exported)
// ============================================================================

/**
 * Get default store configuration
 */
export function getDefaultStoreConfig(): Required<StoreConfig> {
  return { ...DEFAULT_STORE_CONFIG };
}

/**
 * Merge custom config with defaults
 */
export function mergeStoreConfig(custom?: Partial<StoreConfig>): Required<StoreConfig> {
  return {
    ...DEFAULT_STORE_CONFIG,
    ...custom,
    includePatterns: custom?.includePatterns || DEFAULT_STORE_CONFIG.includePatterns,
    excludePatterns: custom?.excludePatterns || DEFAULT_STORE_CONFIG.excludePatterns,
  };
}

/**
 * Validate store configuration
 */
export function validateStoreConfig(config: StoreConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.chunkSize !== undefined && (config.chunkSize < 100 || config.chunkSize > 10000)) {
    errors.push('chunkSize must be between 100 and 10000');
  }

  if (config.chunkOverlap !== undefined) {
    if (config.chunkOverlap < 0) {
      errors.push('chunkOverlap must be non-negative');
    }
    if (config.chunkSize !== undefined && config.chunkOverlap >= config.chunkSize) {
      errors.push('chunkOverlap must be less than chunkSize');
    }
  }

  if (config.maxFileSize !== undefined && config.maxFileSize < 1024) {
    errors.push('maxFileSize must be at least 1024 bytes (1KB)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Registry Export
// ============================================================================

export { RAGStoreRegistry, storeRegistry };

/**
 * Tool definition for MCP registration
 */
export const ragStoreManageTool = {
  name: 'rag-store-manage',
  description: 'Manage RAG vector stores - create, list, get, delete, sync, and check status',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'get', 'delete', 'sync', 'status'],
        description: 'Store operation to perform',
      },
      storeId: {
        type: 'string',
        description: 'Store identifier (for get, delete, sync, status)',
      },
      displayName: {
        type: 'string',
        description: 'Display name (for create)',
      },
      sourcePath: {
        type: 'string',
        description: 'Source path (for create, sync)',
      },
      config: {
        type: 'object',
        description: 'Store configuration (for create)',
        properties: {
          chunkSize: { type: 'number' },
          chunkOverlap: { type: 'number' },
          includePatterns: { type: 'array', items: { type: 'string' } },
          excludePatterns: { type: 'array', items: { type: 'string' } },
          maxFileSize: { type: 'number' },
          embeddingModel: { type: 'string' },
        },
      },
      forceReindex: {
        type: 'boolean',
        description: 'Force reindex (for sync)',
        default: false,
      },
      format: {
        type: 'string',
        enum: ['json', 'table', 'text'],
        description: 'Output format',
        default: 'json',
      },
    },
    required: ['action'],
  },
  category: 'rag',
};
