/**
 * Processing Stores Service Tests
 *
 * @module lib/services/__tests__/processing-stores.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initializeStore,
  storeData,
  retrieveData,
  deleteData,
  listKeys,
  clearStore,
  getStoreStats,
  backupStore,
  processingJobs,
  extractedContentStore,
} from '../processing-stores';

import type { ProcessingJob, ExtractedContent } from '../processing-stores';

describe('Processing Stores Service', () => {
  const STORE_ID = 'test-store';

  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure a clean store for each test
    await initializeStore(STORE_ID);
  });

  // --------------------------------------------------------------------------
  // Generic key-value store
  // --------------------------------------------------------------------------

  describe('initializeStore', () => {
    it('should create a new store and return its id and config', async () => {
      const result = await initializeStore('new-store', { ttlMs: 5000 });

      expect(result).toEqual({ storeId: 'new-store', config: { ttlMs: 5000 } });
    });

    it('should reset an existing store when re-initialized', async () => {
      await storeData(STORE_ID, 'key1', 'value1');
      await initializeStore(STORE_ID);

      const retrieved = await retrieveData(STORE_ID, 'key1');
      expect(retrieved).toBeNull();
    });
  });

  describe('storeData / retrieveData round-trip', () => {
    it('should store and retrieve simple data', async () => {
      await storeData(STORE_ID, 'greeting', 'hello');

      const result = await retrieveData(STORE_ID, 'greeting');
      expect(result).toBe('hello');
    });

    it('should store and retrieve complex objects', async () => {
      const payload = { nested: { arr: [1, 2, 3] }, flag: true };
      await storeData(STORE_ID, 'complex', payload);

      const result = await retrieveData(STORE_ID, 'complex');
      expect(result).toEqual(payload);
    });

    it('should return null for a key that does not exist', async () => {
      const result = await retrieveData(STORE_ID, 'missing');
      expect(result).toBeNull();
    });

    it('should return null when store does not exist', async () => {
      const result = await retrieveData('nonexistent-store', 'key');
      expect(result).toBeNull();
    });

    it('should auto-initialize store on storeData if store does not exist', async () => {
      await storeData('auto-store', 'k', 'v');
      const result = await retrieveData('auto-store', 'k');
      expect(result).toBe('v');
    });
  });

  describe('deleteData', () => {
    it('should remove an entry by key', async () => {
      await storeData(STORE_ID, 'to-delete', 'gone');
      await deleteData(STORE_ID, 'to-delete');

      const result = await retrieveData(STORE_ID, 'to-delete');
      expect(result).toBeNull();
    });

    it('should not throw when deleting from a non-existent store', async () => {
      await expect(deleteData('no-store', 'key')).resolves.toBeUndefined();
    });
  });

  describe('listKeys', () => {
    it('should return all keys in the store', async () => {
      await storeData(STORE_ID, 'alpha', 1);
      await storeData(STORE_ID, 'beta', 2);
      await storeData(STORE_ID, 'gamma', 3);

      const keys = await listKeys(STORE_ID);
      expect(keys).toEqual(expect.arrayContaining(['alpha', 'beta', 'gamma']));
      expect(keys).toHaveLength(3);
    });

    it('should filter keys by prefix', async () => {
      await storeData(STORE_ID, 'user:1', 'a');
      await storeData(STORE_ID, 'user:2', 'b');
      await storeData(STORE_ID, 'org:1', 'c');

      const keys = await listKeys(STORE_ID, 'user:');
      expect(keys).toEqual(expect.arrayContaining(['user:1', 'user:2']));
      expect(keys).toHaveLength(2);
    });

    it('should return empty array for non-existent store', async () => {
      const keys = await listKeys('ghost');
      expect(keys).toEqual([]);
    });
  });

  describe('clearStore', () => {
    it('should empty all entries in the store', async () => {
      await storeData(STORE_ID, 'a', 1);
      await storeData(STORE_ID, 'b', 2);
      await clearStore(STORE_ID);

      const keys = await listKeys(STORE_ID);
      expect(keys).toHaveLength(0);
    });

    it('should not throw when clearing a non-existent store', async () => {
      await expect(clearStore('nope')).resolves.toBeUndefined();
    });
  });

  describe('getStoreStats', () => {
    it('should return correct totalKeys count', async () => {
      await storeData(STORE_ID, 'x', 1);
      await storeData(STORE_ID, 'y', 2);

      const stats = await getStoreStats(STORE_ID);
      expect(stats).not.toBeNull();
      expect(stats!.totalKeys).toBe(2);
    });

    it('should return a positive memoryUsageEstimate', async () => {
      await storeData(STORE_ID, 'payload', { big: 'data' });

      const stats = await getStoreStats(STORE_ID);
      expect(stats!.memoryUsageEstimate).toBeGreaterThan(0);
    });

    it('should return null for a non-existent store', async () => {
      const stats = await getStoreStats('missing');
      expect(stats).toBeNull();
    });
  });

  describe('TTL expiry behavior', () => {
    it('should return null for expired entries on retrieveData', async () => {
      // Initialize with a very short TTL
      await initializeStore('ttl-store', { ttlMs: 1 });
      await storeData('ttl-store', 'ephemeral', 'short-lived');

      // Wait past the TTL
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await retrieveData('ttl-store', 'ephemeral');
      expect(result).toBeNull();
    });

    it('should prune expired keys from listKeys', async () => {
      await initializeStore('ttl-store2', { ttlMs: 1 });
      await storeData('ttl-store2', 'temp', 'value');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const keys = await listKeys('ttl-store2');
      expect(keys).toHaveLength(0);
    });

    it('should prune expired keys from getStoreStats', async () => {
      await initializeStore('ttl-store3', { ttlMs: 1 });
      await storeData('ttl-store3', 'temp', 'value');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = await getStoreStats('ttl-store3');
      expect(stats!.totalKeys).toBe(0);
    });

    it('should NOT expire entries when no TTL is configured', async () => {
      await initializeStore('no-ttl', {});
      await storeData('no-ttl', 'permanent', 'stays');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await retrieveData('no-ttl', 'permanent');
      expect(result).toBe('stays');
    });
  });

  describe('backupStore', () => {
    it('should serialize store entries into backup result', async () => {
      await storeData(STORE_ID, 'backup-key', { important: true });

      const backup = await backupStore(STORE_ID, '/tmp/backup');

      expect(backup.storeId).toBe(STORE_ID);
      expect(backup.backupLocation).toBe('/tmp/backup');
      expect(backup.backedUpAt).toBeDefined();
      expect(typeof backup.serialized).toBe('string');

      const parsed = JSON.parse(backup.serialized);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].key).toBe('backup-key');
    });

    it('should produce valid backup for non-existent store (empty entries)', async () => {
      const backup = await backupStore('empty-store', '/tmp/empty');

      const parsed = JSON.parse(backup.serialized);
      expect(parsed.entries).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // processingJobs store
  // --------------------------------------------------------------------------

  describe('processingJobs', () => {
    afterEach(() => {
      processingJobs.clear();
    });

    it('should create a job with auto-generated id and timestamps', () => {
      const job = processingJobs.create({
        fileId: 'file1',
        workspaceId: 'ws1',
        createdById: 'user1',
        type: 'ocr',
        status: 'pending',
        progress: 0,
        priority: 1,
      });

      expect(job.id).toBeDefined();
      expect(job.id).toMatch(/^job_/);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('should get, set, has, and delete jobs', () => {
      const job = processingJobs.create({
        fileId: 'f1',
        workspaceId: 'ws1',
        createdById: 'u1',
        type: 'pdf',
        status: 'pending',
        progress: 0,
        priority: 1,
      });

      expect(processingJobs.has(job.id)).toBe(true);
      expect(processingJobs.get(job.id)).toEqual(job);

      processingJobs.delete(job.id);
      expect(processingJobs.has(job.id)).toBe(false);
      expect(processingJobs.get(job.id)).toBeUndefined();
    });

    it('should update a job and refresh updatedAt', () => {
      const job = processingJobs.create({
        fileId: 'f1',
        workspaceId: 'ws1',
        createdById: 'u1',
        type: 'img',
        status: 'pending',
        progress: 0,
        priority: 1,
      });

      const originalUpdatedAt = job.updatedAt;

      const updated = processingJobs.update(job.id, {
        status: 'processing',
        progress: 50,
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('processing');
      expect(updated!.progress).toBe(50);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it('should return undefined when updating a non-existent job', () => {
      const result = processingJobs.update('nonexistent', { status: 'failed' });
      expect(result).toBeUndefined();
    });

    it('should list jobs with optional status and fileId filters', () => {
      processingJobs.create({
        fileId: 'f1',
        workspaceId: 'ws1',
        createdById: 'u1',
        type: 'a',
        status: 'pending',
        progress: 0,
        priority: 1,
      });
      processingJobs.create({
        fileId: 'f2',
        workspaceId: 'ws1',
        createdById: 'u1',
        type: 'b',
        status: 'completed',
        progress: 100,
        priority: 1,
      });
      processingJobs.create({
        fileId: 'f1',
        workspaceId: 'ws1',
        createdById: 'u1',
        type: 'c',
        status: 'completed',
        progress: 100,
        priority: 1,
      });

      expect(processingJobs.list()).toHaveLength(3);
      expect(processingJobs.list({ status: 'completed' })).toHaveLength(2);
      expect(processingJobs.list({ fileId: 'f1' })).toHaveLength(2);
      expect(
        processingJobs.list({ status: 'completed', fileId: 'f1' })
      ).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // extractedContentStore
  // --------------------------------------------------------------------------

  describe('extractedContentStore', () => {
    afterEach(() => {
      extractedContentStore.clear();
    });

    it('should set, get, has, and delete content', () => {
      const content: ExtractedContent = {
        fileId: 'file1',
        text: 'Hello world',
        extractedAt: new Date(),
      };

      extractedContentStore.set('file1', content);

      expect(extractedContentStore.has('file1')).toBe(true);
      expect(extractedContentStore.get('file1')).toEqual(content);

      extractedContentStore.delete('file1');
      expect(extractedContentStore.has('file1')).toBe(false);
    });

    it('should list all stored content', () => {
      extractedContentStore.set('a', {
        fileId: 'a',
        text: 'A',
        extractedAt: new Date(),
      });
      extractedContentStore.set('b', {
        fileId: 'b',
        text: 'B',
        extractedAt: new Date(),
      });

      const all = extractedContentStore.list();
      expect(all).toHaveLength(2);
    });
  });
});
