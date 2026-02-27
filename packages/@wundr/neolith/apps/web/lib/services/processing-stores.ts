/**
 * Processing Stores Service
 * Manages data stores for processing operations
 * @module lib/services/processing-stores
 */

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface StoreEntry {
  data: unknown;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

interface StoreConfig {
  ttlMs?: number;
}

// Module-level registry: storeId -> (key -> entry)
const registry = new Map<string, Map<string, StoreEntry>>();

// TTL configuration per store
const storeConfigs = new Map<string, StoreConfig>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStore(storeId: string): Map<string, StoreEntry> | undefined {
  return registry.get(storeId);
}

function isExpired(entry: StoreEntry): boolean {
  return entry.expiresAt !== undefined && entry.expiresAt < new Date();
}

// Rough memory estimate: serialize to JSON and measure byte length
function estimateMemoryBytes(store: Map<string, StoreEntry>): number {
  try {
    const serialized = JSON.stringify(Array.from(store.entries()));
    return Buffer.byteLength(serialized, 'utf8');
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize processing store
 */
export async function initializeStore(
  storeId: string,
  config: StoreConfig = {}
): Promise<{ storeId: string; config: StoreConfig }> {
  console.log('[ProcessingStores] initializeStore called with:', {
    storeId,
    config,
  });

  // Create or reset the store
  registry.set(storeId, new Map<string, StoreEntry>());
  storeConfigs.set(storeId, config);

  return { storeId, config };
}

/**
 * Store processing data
 */
export async function storeData(
  storeId: string,
  key: string,
  data: unknown,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  console.log('[ProcessingStores] storeData called with:', {
    storeId,
    key,
    data,
  });

  let store = registry.get(storeId);
  if (!store) {
    // Auto-initialise the store if it does not exist yet
    store = new Map<string, StoreEntry>();
    registry.set(storeId, store);
  }

  const config = storeConfigs.get(storeId) ?? {};
  const createdAt = new Date();
  const expiresAt =
    config.ttlMs !== undefined
      ? new Date(createdAt.getTime() + config.ttlMs)
      : undefined;

  store.set(key, { data, metadata, createdAt, expiresAt });
}

/**
 * Retrieve processing data
 */
export async function retrieveData(
  storeId: string,
  key: string
): Promise<unknown> {
  console.log('[ProcessingStores] retrieveData called with:', {
    storeId,
    key,
  });

  const store = getStore(storeId);
  if (!store) {
    return null;
  }

  const entry = store.get(key);
  if (!entry) {
    return null;
  }

  if (isExpired(entry)) {
    store.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Delete processing data
 */
export async function deleteData(storeId: string, key: string): Promise<void> {
  console.log('[ProcessingStores] deleteData called with:', {
    storeId,
    key,
  });

  const store = getStore(storeId);
  if (store) {
    store.delete(key);
  }
}

/**
 * List all keys in store
 */
export async function listKeys(
  storeId: string,
  prefix?: string
): Promise<string[]> {
  console.log('[ProcessingStores] listKeys called with:', {
    storeId,
    prefix,
  });

  const store = getStore(storeId);
  if (!store) {
    return [];
  }

  const now = new Date();
  const keys: string[] = [];

  for (const [key, entry] of store.entries()) {
    // Prune expired entries as we iterate
    if (entry.expiresAt !== undefined && entry.expiresAt < now) {
      store.delete(key);
      continue;
    }
    if (prefix === undefined || key.startsWith(prefix)) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Clear entire store
 */
export async function clearStore(storeId: string): Promise<void> {
  console.log('[ProcessingStores] clearStore called with:', {
    storeId,
  });

  const store = getStore(storeId);
  if (store) {
    store.clear();
  }
}

/**
 * Get store statistics
 */
export async function getStoreStats(
  storeId: string
): Promise<{ totalKeys: number; memoryUsageEstimate: number } | null> {
  console.log('[ProcessingStores] getStoreStats called with:', {
    storeId,
  });

  const store = getStore(storeId);
  if (!store) {
    return null;
  }

  // Prune expired keys before counting
  const now = new Date();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt !== undefined && entry.expiresAt < now) {
      store.delete(key);
    }
  }

  return {
    totalKeys: store.size,
    memoryUsageEstimate: estimateMemoryBytes(store),
  };
}

/**
 * Backup store data
 */
export async function backupStore(
  storeId: string,
  backupLocation: string
): Promise<{
  storeId: string;
  backupLocation: string;
  serialized: string;
  backedUpAt: string;
}> {
  console.log('[ProcessingStores] backupStore called with:', {
    storeId,
    backupLocation,
  });

  const store = getStore(storeId);
  const entries = store
    ? Array.from(store.entries()).map(([key, entry]) => ({ key, ...entry }))
    : [];

  const serialized = JSON.stringify({
    storeId,
    backupLocation,
    entries,
    backedUpAt: new Date().toISOString(),
  });

  return {
    storeId,
    backupLocation,
    serialized,
    backedUpAt: new Date().toISOString(),
  };
}

// ============================================================================
// PROCESSING JOBS STORE
// ============================================================================

export type ProcessingJobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProcessingJob {
  id: string;
  fileId: string;
  workspaceId: string;
  createdById: string;
  type: string;
  status: ProcessingJobStatus;
  progress: number;
  priority: number;
  options?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// In-memory processing jobs store
const jobsStore = new Map<string, ProcessingJob>();

/**
 * Processing jobs store operations
 */
export const processingJobs = {
  get(jobId: string): ProcessingJob | undefined {
    return jobsStore.get(jobId);
  },

  set(jobId: string, job: ProcessingJob): void {
    jobsStore.set(jobId, job);
  },

  delete(jobId: string): boolean {
    return jobsStore.delete(jobId);
  },

  has(jobId: string): boolean {
    return jobsStore.has(jobId);
  },

  values(): IterableIterator<ProcessingJob> {
    return jobsStore.values();
  },

  list(filters?: {
    status?: ProcessingJobStatus;
    fileId?: string;
  }): ProcessingJob[] {
    let jobs = Array.from(jobsStore.values());
    if (filters?.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    if (filters?.fileId) {
      jobs = jobs.filter(j => j.fileId === filters.fileId);
    }
    return jobs;
  },

  create(
    data: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>
  ): ProcessingJob {
    const job: ProcessingJob = {
      ...data,
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jobsStore.set(job.id, job);
    return job;
  },

  update(
    jobId: string,
    updates: Partial<ProcessingJob>
  ): ProcessingJob | undefined {
    const job = jobsStore.get(jobId);
    if (!job) {
      return undefined;
    }
    const updated = { ...job, ...updates, updatedAt: new Date() };
    jobsStore.set(jobId, updated);
    return updated;
  },

  clear(): void {
    jobsStore.clear();
  },
};

// ============================================================================
// EXTRACTED CONTENT STORE
// ============================================================================

export interface ExtractedContent {
  fileId: string;
  text: string | null;
  tables?: Array<{
    rows: string[][];
    headers?: string[];
    caption?: string;
  }> | null;
  metadata?: Record<string, unknown> | null;
  pages?: number | null;
  wordCount?: number | null;
  language?: string | null;
  extractedAt: Date;
  jobId?: string;
}

// In-memory extracted content store
const contentStore = new Map<string, ExtractedContent>();

/**
 * Extracted content store operations
 */
export const extractedContentStore = {
  get(fileId: string): ExtractedContent | undefined {
    return contentStore.get(fileId);
  },

  set(fileId: string, content: ExtractedContent): void {
    contentStore.set(fileId, content);
  },

  delete(fileId: string): boolean {
    return contentStore.delete(fileId);
  },

  has(fileId: string): boolean {
    return contentStore.has(fileId);
  },

  list(): ExtractedContent[] {
    return Array.from(contentStore.values());
  },

  clear(): void {
    contentStore.clear();
  },
};
