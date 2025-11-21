/**
 * Unit tests for RAG Store Management Tool
 *
 * Tests all operations (create, list, get, delete, sync, status)
 * and error handling for store management.
 *
 * @module @wundr/mcp-server/tests/unit/rag/rag-store-manage
 */

import { RagStoreManageSchema } from '../../../src/tools/rag/schemas';
import { ragStoreManageHandler } from '../../../src/tools/rag/handlers';

// ============================================================================
// Input Schema Validation Tests
// ============================================================================

describe('RAG Store Manage Input Validation', () => {
  describe('action validation', () => {
    it('should accept create action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
      });
      expect(result.success).toBe(true);
    });

    it('should accept delete action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'delete',
        storeName: 'my-store',
        force: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept list action', () => {
      const result = RagStoreManageSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });

    it('should accept status action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'status',
        storeName: 'my-store',
      });
      expect(result.success).toBe(true);
    });

    it('should accept index action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'index',
        storeName: 'my-store',
        indexPaths: ['/src'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept clear action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'clear',
        storeName: 'my-store',
        force: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optimize action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'optimize',
        storeName: 'my-store',
      });
      expect(result.success).toBe(true);
    });

    it('should accept backup action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'backup',
        storeName: 'my-store',
        backupPath: '/backups/store.bak',
      });
      expect(result.success).toBe(true);
    });

    it('should accept restore action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'restore',
        storeName: 'my-store',
        backupPath: '/backups/store.bak',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid action', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should require action field', () => {
      const result = RagStoreManageSchema.safeParse({
        storeName: 'my-store',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('config validation', () => {
    it('should accept valid config with type', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { type: 'memory' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid config with embedding model', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { embeddingModel: 'openai' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid config with dimensions', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { dimensions: 768 },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid store type', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { type: 'invalid' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid embedding model', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { embeddingModel: 'invalid' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive dimensions', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: { dimensions: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('should accept complete config', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
        config: {
          type: 'chromadb',
          embeddingModel: 'cohere',
          dimensions: 1024,
          metadata: { project: 'test' },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('indexPaths validation', () => {
    it('should accept array of paths', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'index',
        storeName: 'my-store',
        indexPaths: ['/src', '/lib'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.indexPaths).toEqual(['/src', '/lib']);
      }
    });

    it('should accept single path in array', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'index',
        storeName: 'my-store',
        indexPaths: ['/src'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty array', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'index',
        storeName: 'my-store',
        indexPaths: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('force validation', () => {
    it('should accept true', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'delete',
        storeName: 'my-store',
        force: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept false', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'delete',
        storeName: 'my-store',
        force: false,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Handler Tests - Using types.ts interface (storeId, displayName, etc.)
// ============================================================================

describe('RAG Store Manage Handler - Create', () => {
  const createdStores: string[] = [];

  afterAll(async () => {
    // Cleanup created stores
    for (const storeId of createdStores) {
      try {
        await ragStoreManageHandler({
          action: 'delete',
          storeId,
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should create a new store successfully', async () => {
    const storeId = `test-create-${Date.now()}`;
    createdStores.push(storeId);

    const result = await ragStoreManageHandler({
      action: 'create',
      storeId,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.action).toBe('create');
    }
  });

  it('should create store with display name', async () => {
    const storeId = `test-create-display-${Date.now()}`;
    createdStores.push(storeId);

    const result = await ragStoreManageHandler({
      action: 'create',
      displayName: storeId,
    });

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Handler Tests - List Operation
// ============================================================================

describe('RAG Store Manage Handler - List', () => {
  it('should list all stores', async () => {
    const result = await ragStoreManageHandler({ action: 'list' });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.action).toBe('list');
      expect(Array.isArray(result.data.stores)).toBe(true);
    }
  });
});

// ============================================================================
// Handler Tests - Status Operation
// ============================================================================

describe('RAG Store Manage Handler - Status', () => {
  let testStoreId: string;

  beforeAll(async () => {
    testStoreId = `test-status-${Date.now()}`;
    await ragStoreManageHandler({
      action: 'create',
      storeId: testStoreId,
    });
  });

  afterAll(async () => {
    await ragStoreManageHandler({
      action: 'delete',
      storeId: testStoreId,
    });
  });

  it('should return status for existing store', async () => {
    const result = await ragStoreManageHandler({
      action: 'status',
      storeId: testStoreId,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.action).toBe('status');
    }
  });

  it('should handle non-existent store', async () => {
    const result = await ragStoreManageHandler({
      action: 'status',
      storeId: 'non-existent-store',
    });

    // Handler may return success:false or success:true with data.success:false
    // depending on implementation
    if (result.success) {
      expect(result.data?.success).toBe(false);
    } else {
      expect(result.success).toBe(false);
    }
  });
});

// ============================================================================
// Handler Tests - Delete Operation
// ============================================================================

describe('RAG Store Manage Handler - Delete', () => {
  it('should delete existing store', async () => {
    const storeId = `test-delete-${Date.now()}`;

    // Create store
    await ragStoreManageHandler({
      action: 'create',
      storeId,
    });

    // Delete
    const result = await ragStoreManageHandler({
      action: 'delete',
      storeId,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.action).toBe('delete');
    }
  });

  it('should handle deleting non-existent store', async () => {
    const result = await ragStoreManageHandler({
      action: 'delete',
      storeId: 'non-existent-store',
    });

    // Handler may return success:false or success:true with data.success:false
    if (result.success) {
      expect(result.data?.success).toBe(false);
    } else {
      expect(result.success).toBe(false);
    }
  });
});

// ============================================================================
// Handler Tests - Sync Operation
// ============================================================================

describe('RAG Store Manage Handler - Sync', () => {
  let testStoreId: string;

  beforeAll(async () => {
    testStoreId = `test-sync-${Date.now()}`;
    await ragStoreManageHandler({
      action: 'create',
      storeId: testStoreId,
    });
  });

  afterAll(async () => {
    await ragStoreManageHandler({
      action: 'delete',
      storeId: testStoreId,
    });
  });

  it('should sync store with source path', async () => {
    const result = await ragStoreManageHandler({
      action: 'sync',
      storeId: testStoreId,
      sourcePath: process.cwd(),
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.action).toBe('sync');
    }
  });

  it('should handle sync of non-existent store', async () => {
    const result = await ragStoreManageHandler({
      action: 'sync',
      storeId: 'non-existent-store',
      sourcePath: process.cwd(),
    });

    // Handler may return success:false or success:true with data.success:false
    if (result.success) {
      expect(result.data?.success).toBe(false);
    } else {
      expect(result.success).toBe(false);
    }
  });
});

// ============================================================================
// Handler Tests - Error Handling
// ============================================================================

describe('RAG Store Manage Handler - Error Handling', () => {
  it('should handle unknown action gracefully', async () => {
    const result = await ragStoreManageHandler({
      action: 'unknown' as any,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });

  it('should include metadata in responses', async () => {
    const result = await ragStoreManageHandler({ action: 'list' });

    expect(result.metadata).toBeDefined();
    if (result.metadata) {
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.duration).toBeDefined();
    }
  });
});
