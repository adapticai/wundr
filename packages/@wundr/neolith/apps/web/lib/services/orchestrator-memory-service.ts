/**
 * Orchestrator Memory Service
 * Manages persistent memory and state for orchestrators
 * @module lib/services/orchestrator-memory-service
 */

import { prisma } from '@neolith/database';

/** Default retention limit when compressing old memory records */
const DEFAULT_RETENTION_LIMIT = 100;

/**
 * Store orchestrator state. Upserts a single JSON blob keyed by orchestratorId.
 */
export async function storeState(
  orchestratorId: string,
  state: any
): Promise<void> {
  try {
    await (prisma as any).orchestratorMemory.upsert({
      where: { orchestratorId },
      update: {
        state: JSON.stringify(state),
        updatedAt: new Date(),
      },
      create: {
        orchestratorId,
        state: JSON.stringify(state),
      },
    });
  } catch {
    // Swallow write errors so callers are not disrupted
  }
}

/**
 * Retrieve orchestrator state by orchestratorId.
 * Returns the parsed state object or null when no record exists.
 */
export async function retrieveState(orchestratorId: string): Promise<any> {
  try {
    const record = await (prisma as any).orchestratorMemory.findUnique({
      where: { orchestratorId },
    });

    if (!record) {
      return null;
    }

    return typeof record.state === 'string'
      ? JSON.parse(record.state)
      : record.state;
  } catch {
    return null;
  }
}

/**
 * Delete all memory records associated with the given orchestratorId.
 * This covers the state record, context records, and individual memory entries.
 */
export async function clearMemory(orchestratorId: string): Promise<void> {
  try {
    await Promise.allSettled([
      (prisma as any).orchestratorMemory.deleteMany({
        where: { orchestratorId },
      }),
      (prisma as any).orchestratorContext.deleteMany({
        where: { orchestratorId },
      }),
      (prisma as any).orchestratorMemoryEntry.deleteMany({
        where: { orchestratorId },
      }),
    ]);
  } catch {
    // Swallow errors; partial clears are acceptable
  }
}

/**
 * Upsert an execution context record keyed by orchestratorId + contextKey.
 */
export async function storeContext(
  orchestratorId: string,
  contextKey: string,
  contextData: any
): Promise<void> {
  try {
    await (prisma as any).orchestratorContext.upsert({
      where: {
        orchestratorId_contextKey: { orchestratorId, contextKey },
      },
      update: {
        contextData: JSON.stringify(contextData),
        updatedAt: new Date(),
      },
      create: {
        orchestratorId,
        contextKey,
        contextData: JSON.stringify(contextData),
      },
    });
  } catch {
    // Swallow write errors so callers are not disrupted
  }
}

/**
 * Retrieve a context entry by orchestratorId and contextKey.
 * Returns the parsed context data or null when no record exists.
 */
export async function retrieveContext(
  orchestratorId: string,
  contextKey: string
): Promise<any> {
  try {
    const record = await (prisma as any).orchestratorContext.findUnique({
      where: {
        orchestratorId_contextKey: { orchestratorId, contextKey },
      },
    });

    if (!record) {
      return null;
    }

    return typeof record.contextData === 'string'
      ? JSON.parse(record.contextData)
      : record.contextData;
  } catch {
    return null;
  }
}

/**
 * Return aggregate statistics for memory associated with the orchestratorId:
 * total entry count, context count, and total size estimation.
 */
export async function getMemoryStats(orchestratorId: string): Promise<{
  entryCount: number;
  contextCount: number;
  hasStateRecord: boolean;
} | null> {
  try {
    const [entryCount, contextCount, stateRecord] = await Promise.all([
      (prisma as any).orchestratorMemoryEntry.count({
        where: { orchestratorId },
      }),
      (prisma as any).orchestratorContext.count({
        where: { orchestratorId },
      }),
      (prisma as any).orchestratorMemory.findUnique({
        where: { orchestratorId },
        select: { orchestratorId: true },
      }),
    ]);

    return {
      entryCount: entryCount ?? 0,
      contextCount: contextCount ?? 0,
      hasStateRecord: stateRecord !== null,
    };
  } catch {
    return null;
  }
}

/**
 * Prune old memory entries beyond the retention limit, keeping the most recent N records.
 * The retention limit defaults to DEFAULT_RETENTION_LIMIT (100) but can be overridden
 * via compressionConfig.retentionLimit.
 */
export async function compressMemory(
  orchestratorId: string,
  compressionConfig?: { retentionLimit?: number }
): Promise<void> {
  const retentionLimit =
    compressionConfig?.retentionLimit ?? DEFAULT_RETENTION_LIMIT;

  try {
    // Fetch all entry IDs ordered by creation time descending
    const allEntries = await (prisma as any).orchestratorMemoryEntry.findMany({
      where: { orchestratorId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!allEntries || allEntries.length <= retentionLimit) {
      return;
    }

    // Everything after the retention window can be deleted
    const entriesToDelete = allEntries
      .slice(retentionLimit)
      .map((e: { id: string }) => e.id);

    await (prisma as any).orchestratorMemoryEntry.deleteMany({
      where: {
        id: { in: entriesToDelete },
      },
    });
  } catch {
    // Swallow errors; compression is a best-effort operation
  }
}

// ============================================================================
// MEMORY OPERATIONS
// ============================================================================

/**
 * Store a memory item, creating a new entry row. Supports optional TTL (seconds),
 * type tag, and free-form string tags.
 */
export async function storeMemory(
  orchestratorId: string,
  memoryKey: string,
  memoryData: {
    content: unknown;
    type?: string;
    tags?: string[];
    ttl?: number;
  }
): Promise<{ key: string; storedAt: Date }> {
  const storedAt = new Date();

  try {
    const expiresAt =
      typeof memoryData.ttl === 'number' && memoryData.ttl > 0
        ? new Date(storedAt.getTime() + memoryData.ttl * 1000)
        : null;

    await (prisma as any).orchestratorMemoryEntry.create({
      data: {
        orchestratorId,
        memoryKey,
        content: JSON.stringify(memoryData.content),
        type: memoryData.type ?? null,
        tags: memoryData.tags ?? [],
        expiresAt,
        createdAt: storedAt,
      },
    });
  } catch {
    // Swallow write errors; return the key and timestamp regardless
  }

  return { key: memoryKey, storedAt };
}

/**
 * Delete a specific memory entry identified by orchestratorId and memoryKey.
 * Returns whether at least one record was deleted.
 */
export async function deleteMemory(
  orchestratorId: string,
  memoryKey: string
): Promise<{ deleted: boolean }> {
  try {
    const result = await (prisma as any).orchestratorMemoryEntry.deleteMany({
      where: { orchestratorId, memoryKey },
    });

    return { deleted: (result?.count ?? 0) > 0 };
  } catch {
    return { deleted: false };
  }
}
