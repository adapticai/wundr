/**
 * Safety Mechanisms - File-system based backup, transaction, and rollback support
 *
 * Backups are stored under `{projectRoot}/.wundr-backup/{backupId}/` and a
 * metadata index is maintained at `{projectRoot}/.wundr-backup/index.json`.
 *
 * Transaction pattern:
 *   const tx = safetyManager.startTransaction('label');
 *   tx.recordOperation({ type, path, backupRef });
 *   tx.completeOperation(path);
 *   await tx.commit();   // no-op for now; marks the transaction done
 *   // or
 *   await tx.rollback(); // restores each file from its backupRef
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Public interfaces (kept from original stub + extended for consumer usage)
// ---------------------------------------------------------------------------

export interface SafetyManagerOptions {
  /** Root directory of the project being managed */
  projectRoot?: string;
  /** When true, skip writing any backup files to disk */
  skipBackup?: boolean;
  /** When true, do not write anything to disk */
  dryRun?: boolean;
}

export interface SafetyManager {
  /** Create a full backup of the supplied file list */
  createBackup(
    files: string[],
    description?: string,
    fromVersion?: string,
    toVersion?: string
  ): Promise<UpdateBackup>;
  /** Begin a logical transaction that can be committed or rolled back */
  startTransaction(label?: string): UpdateTransaction;
  /** List all stored backups, newest first */
  listBackups(): Promise<UpdateBackup[]>;
  /** Return the most recent backup, or null if none exist */
  getLatestBackup(): Promise<UpdateBackup | null>;
  /**
   * Restore files from a backup.
   * Accepts either a full UpdateBackup object or a bare backup-id string
   * so that both usages in project-update.ts are satisfied.
   */
  restoreFromBackup(backupOrId: UpdateBackup | string): Promise<boolean>;
  /** Permanently remove a backup by id */
  deleteBackup(backupId: string): Promise<boolean>;
  // --- Legacy interface aliases kept for backwards-compatibility ---
  /** @deprecated Use startTransaction instead */
  beginTransaction(): UpdateTransaction;
}

export interface UpdateBackup {
  id: string;
  timestamp: Date;
  /** Absolute path to the backup directory on disk */
  path: string;
  /** List of original file paths that were backed up */
  files: string[];
  description: string;
  fromVersion: string;
  toVersion: string;
  /** Convenience method that delegates to SafetyManager.restoreFromBackup */
  restore(): Promise<void>;
}

export interface TransactionOperation {
  type: 'update' | 'create' | 'delete';
  path: string;
  /** Reference to the backup entry that holds the pre-change copy */
  backupRef: string | null;
}

export interface UpdateTransaction {
  /** Record a pending operation; call before modifying the file */
  recordOperation(op: TransactionOperation): void;
  /** Mark a previously-recorded operation as successfully completed */
  completeOperation(filePath: string): void;
  /** Mark a previously-recorded operation as failed */
  failOperation(filePath: string, reason: string): void;
  /** Commit the transaction (clears the in-memory log) */
  commit(): Promise<boolean>;
  /** Roll back by restoring each file from its saved backup copy */
  rollback(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Serialised form stored in index.json
// ---------------------------------------------------------------------------

interface BackupIndexEntry {
  id: string;
  timestamp: string; // ISO string
  path: string;
  files: string[];
  description: string;
  fromVersion: string;
  toVersion: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateBackupId(): string {
  // e.g. "bkp-20240311T143022-456"
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `bkp-${ts}-${rand}`;
}

function backupDir(projectRoot: string): string {
  return path.join(projectRoot, '.wundr-backup');
}

function indexPath(projectRoot: string): string {
  return path.join(backupDir(projectRoot), 'index.json');
}

async function ensureBackupDir(projectRoot: string): Promise<void> {
  await fs.mkdir(backupDir(projectRoot), { recursive: true });

  const idx = indexPath(projectRoot);
  if (!existsSync(idx)) {
    await fs.writeFile(idx, JSON.stringify([], null, 2), 'utf-8');
  }
}

async function readIndex(projectRoot: string): Promise<BackupIndexEntry[]> {
  try {
    const raw = await fs.readFile(indexPath(projectRoot), 'utf-8');
    return JSON.parse(raw) as BackupIndexEntry[];
  } catch {
    return [];
  }
}

async function writeIndex(
  projectRoot: string,
  entries: BackupIndexEntry[]
): Promise<void> {
  await fs.writeFile(
    indexPath(projectRoot),
    JSON.stringify(entries, null, 2),
    'utf-8'
  );
}

/**
 * Convert an index entry + projectRoot into a full UpdateBackup object.
 */
function entryToBackup(
  entry: BackupIndexEntry,
  manager: SafetyManager
): UpdateBackup {
  return {
    id: entry.id,
    timestamp: new Date(entry.timestamp),
    path: entry.path,
    files: entry.files,
    description: entry.description,
    fromVersion: entry.fromVersion,
    toVersion: entry.toVersion,
    restore: async () => {
      await manager.restoreFromBackup(entry.id);
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSafetyManager(
  options: SafetyManagerOptions = {}
): SafetyManager {
  const projectRoot = options.projectRoot || process.cwd();
  const skipBackup = options.skipBackup ?? false;
  const dryRun = options.dryRun ?? false;

  // Forward declaration so entryToBackup can reference `manager`.
  const manager: SafetyManager = {
    // ------------------------------------------------------------------
    // createBackup
    // ------------------------------------------------------------------
    async createBackup(
      files: string[],
      description = 'Backup',
      fromVersion = '',
      toVersion = ''
    ): Promise<UpdateBackup> {
      if (skipBackup || dryRun) {
        // Return a no-op backup object without touching disk.
        const noop: UpdateBackup = {
          id: `noop-${Date.now()}`,
          timestamp: new Date(),
          path: '',
          files: [],
          description,
          fromVersion,
          toVersion,
          restore: async () => {},
        };
        return noop;
      }

      await ensureBackupDir(projectRoot);

      const id = generateBackupId();
      const backupPath = path.join(backupDir(projectRoot), id);
      await fs.mkdir(backupPath, { recursive: true });

      const backedUpFiles: string[] = [];

      for (const filePath of files) {
        if (!existsSync(filePath)) {
          continue;
        }

        // Preserve the relative structure inside the backup directory.
        // For absolute paths outside projectRoot use the full path stripped
        // of its leading separator.
        let relative: string;
        try {
          relative = path.relative(projectRoot, filePath);
          // If the file is outside projectRoot, relative starts with '..'
          if (relative.startsWith('..')) {
            relative = filePath.replace(/^[/\\]/, '');
          }
        } catch {
          relative = filePath.replace(/^[/\\]/, '');
        }

        const dest = path.join(backupPath, relative);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(filePath, dest);
        backedUpFiles.push(filePath);
      }

      const entry: BackupIndexEntry = {
        id,
        timestamp: new Date().toISOString(),
        path: backupPath,
        files: backedUpFiles,
        description,
        fromVersion,
        toVersion,
      };

      const index = await readIndex(projectRoot);
      // Newest first.
      index.unshift(entry);
      await writeIndex(projectRoot, index);

      return entryToBackup(entry, manager);
    },

    // ------------------------------------------------------------------
    // startTransaction
    // ------------------------------------------------------------------
    startTransaction(label = 'transaction'): UpdateTransaction {
      interface OpRecord {
        op: TransactionOperation;
        status: 'pending' | 'completed' | 'failed';
        failReason?: string;
      }

      const ops = new Map<string, OpRecord>();
      let committed = false;

      const transaction: UpdateTransaction = {
        recordOperation(op: TransactionOperation): void {
          if (committed) {
            throw new Error(
              `Transaction "${label}" is already committed; cannot record new operations.`
            );
          }
          ops.set(op.path, { op, status: 'pending' });
        },

        completeOperation(filePath: string): void {
          const record = ops.get(filePath);
          if (record) {
            record.status = 'completed';
          }
        },

        failOperation(filePath: string, reason: string): void {
          const record = ops.get(filePath);
          if (record) {
            record.status = 'failed';
            record.failReason = reason;
          }
        },

        async commit(): Promise<boolean> {
          committed = true;
          // All operations are already written to disk by the caller; the
          // transaction commit just seals the log.
          return true;
        },

        async rollback(): Promise<void> {
          // For each operation that has a backupRef, restore the file from
          // the backup entry stored under projectRoot/.wundr-backup/{id}.
          for (const [filePath, record] of ops.entries()) {
            const { backupRef } = record.op;
            if (!backupRef) {
              continue;
            }

            try {
              const index = await readIndex(projectRoot);
              const entry = index.find(e => e.id === backupRef);
              if (!entry) {
                continue;
              }

              let relative: string;
              try {
                relative = path.relative(projectRoot, filePath);
                if (relative.startsWith('..')) {
                  relative = filePath.replace(/^[/\\]/, '');
                }
              } catch {
                relative = filePath.replace(/^[/\\]/, '');
              }

              const backupFilePath = path.join(entry.path, relative);
              if (existsSync(backupFilePath)) {
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.copyFile(backupFilePath, filePath);
              }
            } catch {
              // Best-effort; continue with remaining files.
            }
          }
        },
      };

      return transaction;
    },

    // ------------------------------------------------------------------
    // listBackups
    // ------------------------------------------------------------------
    async listBackups(): Promise<UpdateBackup[]> {
      await ensureBackupDir(projectRoot);
      const index = await readIndex(projectRoot);
      // Already sorted newest-first by how we write the index.
      return index.map(entry => entryToBackup(entry, manager));
    },

    // ------------------------------------------------------------------
    // getLatestBackup
    // ------------------------------------------------------------------
    async getLatestBackup(): Promise<UpdateBackup | null> {
      await ensureBackupDir(projectRoot);
      const index = await readIndex(projectRoot);
      if (index.length === 0) {
        return null;
      }
      return entryToBackup(index[0], manager);
    },

    // ------------------------------------------------------------------
    // restoreFromBackup
    // ------------------------------------------------------------------
    async restoreFromBackup(
      backupOrId: UpdateBackup | string
    ): Promise<boolean> {
      const id = typeof backupOrId === 'string' ? backupOrId : backupOrId.id;

      const index = await readIndex(projectRoot);
      const entry = index.find(e => e.id === id);
      if (!entry) {
        return false;
      }

      let allRestored = true;

      for (const originalPath of entry.files) {
        let relative: string;
        try {
          relative = path.relative(projectRoot, originalPath);
          if (relative.startsWith('..')) {
            relative = originalPath.replace(/^[/\\]/, '');
          }
        } catch {
          relative = originalPath.replace(/^[/\\]/, '');
        }

        const backupFilePath = path.join(entry.path, relative);

        if (!existsSync(backupFilePath)) {
          allRestored = false;
          continue;
        }

        try {
          await fs.mkdir(path.dirname(originalPath), { recursive: true });
          await fs.copyFile(backupFilePath, originalPath);
        } catch {
          allRestored = false;
        }
      }

      return allRestored;
    },

    // ------------------------------------------------------------------
    // deleteBackup
    // ------------------------------------------------------------------
    async deleteBackup(backupId: string): Promise<boolean> {
      const index = await readIndex(projectRoot);
      const entry = index.find(e => e.id === backupId);
      if (!entry) {
        return false;
      }

      try {
        if (existsSync(entry.path)) {
          await fs.rm(entry.path, { recursive: true, force: true });
        }
        const updated = index.filter(e => e.id !== backupId);
        await writeIndex(projectRoot, updated);
        return true;
      } catch {
        return false;
      }
    },

    // ------------------------------------------------------------------
    // Legacy: beginTransaction (alias)
    // ------------------------------------------------------------------
    beginTransaction(): UpdateTransaction {
      return manager.startTransaction('transaction');
    },
  };

  return manager;
}
