/**
 * RAG Store Management Handler for MCP Server
 *
 * Provides vector store management capabilities for RAG operations.
 *
 * @module mcp-tools/tools/rag/rag-store-manage-handler
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { RagStoreManageArgs } from '../../types/index.js';

// Store directory path
const RAG_STORE_DIR = path.join(os.homedir(), '.wundr', 'rag-stores');

/**
 * Handler for RAG store management operations
 */
export class RagStoreManageHandler {
  /**
   * Execute the RAG store management operation
   *
   * @param args - Store management arguments
   * @returns Operation result as formatted string
   */
  async execute(args: RagStoreManageArgs): Promise<string> {
    const { action, storeName, config, indexPaths, force: _force } = args;

    // Ensure store directory exists
    this.ensureStoreDir();

    switch (action) {
      case 'create':
        return this.createStore(storeName, config);
      case 'delete':
        return this.deleteStore(storeName);
      case 'list':
        return this.listStores();
      case 'status':
        return this.getStoreStatus(storeName);
      case 'index':
        return this.indexFiles(storeName, indexPaths);
      case 'clear':
        return this.clearStore(storeName);
      case 'optimize':
        return this.optimizeStore(storeName);
      case 'backup':
        return this.backupStore(storeName, args.backupPath);
      case 'restore':
        return this.restoreStore(storeName, args.backupPath);
      default:
        return JSON.stringify({
          success: false,
          error: `Unknown action: ${action}`,
        });
    }
  }

  private ensureStoreDir(): void {
    if (!fs.existsSync(RAG_STORE_DIR)) {
      fs.mkdirSync(RAG_STORE_DIR, { recursive: true });
    }
  }

  private createStore(
    name: string | undefined,
    config?: { type?: string; embeddingModel?: string; dimensions?: number }
  ): string {
    const storeName = name || `store-${Date.now()}`;
    const storePath = path.join(RAG_STORE_DIR, `${storeName}.json`);

    if (fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'create',
        error: `Store '${storeName}' already exists`,
      });
    }

    const storeData = {
      name: storeName,
      type: config?.type || 'memory',
      embeddingModel: config?.embeddingModel || 'local',
      dimensions: config?.dimensions || 384,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2));

    return JSON.stringify({
      success: true,
      action: 'create',
      message: `Store '${storeName}' created successfully`,
      store: {
        name: storeName,
        type: storeData.type,
        embeddingModel: storeData.embeddingModel,
      },
    });
  }

  private deleteStore(name: string | undefined): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'delete',
        error: 'Store name is required for delete action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'delete',
        error: `Store '${name}' not found`,
      });
    }

    fs.unlinkSync(storePath);

    return JSON.stringify({
      success: true,
      action: 'delete',
      message: `Store '${name}' deleted successfully`,
    });
  }

  private listStores(): string {
    const files = fs
      .readdirSync(RAG_STORE_DIR)
      .filter(f => f.endsWith('.json'));
    const stores = [];

    for (const file of files) {
      try {
        const storePath = path.join(RAG_STORE_DIR, file);
        const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        const stats = fs.statSync(storePath);

        stores.push({
          name: data.name,
          type: data.type,
          documentCount: data.documents?.length || 0,
          sizeBytes: stats.size,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      } catch {
        // Skip invalid stores
      }
    }

    return JSON.stringify({
      success: true,
      action: 'list',
      message: `Found ${stores.length} stores`,
      stores,
    });
  }

  private getStoreStatus(name: string | undefined): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'status',
        error: 'Store name is required for status action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'status',
        error: `Store '${name}' not found`,
      });
    }

    try {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      const stats = fs.statSync(storePath);

      return JSON.stringify({
        success: true,
        action: 'status',
        message: `Status for store '${name}'`,
        store: {
          name: data.name,
          type: data.type,
          embeddingModel: data.embeddingModel,
          dimensions: data.dimensions,
          documentCount: data.documents?.length || 0,
          sizeBytes: stats.size,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          status: 'healthy',
        },
      });
    } catch (_error) {
      return JSON.stringify({
        success: false,
        action: 'status',
        error: `Failed to read store '${name}'`,
      });
    }
  }

  private indexFiles(name: string | undefined, paths?: string[]): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'index',
        error: 'Store name is required for index action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'index',
        error: `Store '${name}' not found`,
      });
    }

    const indexPaths = paths || [process.cwd()];
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    let filesIndexed = 0;

    for (const indexPath of indexPaths) {
      const resolvedPath = path.resolve(indexPath);
      if (fs.existsSync(resolvedPath)) {
        const files = this.collectFiles(resolvedPath);
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            data.documents.push({
              path: file,
              content: content.substring(0, 10000),
              indexed: new Date().toISOString(),
            });
            filesIndexed++;
          } catch {
            // Skip unreadable files
          }
        }
      }
    }

    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

    return JSON.stringify({
      success: true,
      action: 'index',
      message: `Indexed ${filesIndexed} files in store '${name}'`,
      filesIndexed,
    });
  }

  private clearStore(name: string | undefined): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'clear',
        error: 'Store name is required for clear action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'clear',
        error: `Store '${name}' not found`,
      });
    }

    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const previousCount = data.documents?.length || 0;
    data.documents = [];
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

    return JSON.stringify({
      success: true,
      action: 'clear',
      message: `Cleared ${previousCount} documents from store '${name}'`,
      documentsCleared: previousCount,
    });
  }

  private optimizeStore(name: string | undefined): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'optimize',
        error: 'Store name is required for optimize action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'optimize',
        error: `Store '${name}' not found`,
      });
    }

    // For now, optimization just removes duplicates
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const uniquePaths = new Set<string>();
    const uniqueDocs = data.documents.filter((doc: { path: string }) => {
      if (uniquePaths.has(doc.path)) {
        return false;
      }
      uniquePaths.add(doc.path);
      return true;
    });

    const removed = data.documents.length - uniqueDocs.length;
    data.documents = uniqueDocs;
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

    return JSON.stringify({
      success: true,
      action: 'optimize',
      message: `Optimized store '${name}', removed ${removed} duplicates`,
      duplicatesRemoved: removed,
    });
  }

  private backupStore(name: string | undefined, backupPath?: string): string {
    if (!name) {
      return JSON.stringify({
        success: false,
        action: 'backup',
        error: 'Store name is required for backup action',
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

    if (!fs.existsSync(storePath)) {
      return JSON.stringify({
        success: false,
        action: 'backup',
        error: `Store '${name}' not found`,
      });
    }

    const targetPath =
      backupPath ||
      path.join(process.cwd(), `${name}-backup-${Date.now()}.json`);
    fs.copyFileSync(storePath, targetPath);

    return JSON.stringify({
      success: true,
      action: 'backup',
      message: `Store '${name}' backed up to ${targetPath}`,
      backupPath: targetPath,
    });
  }

  private restoreStore(name: string | undefined, backupPath?: string): string {
    if (!name || !backupPath) {
      return JSON.stringify({
        success: false,
        action: 'restore',
        error: 'Store name and backup path are required for restore action',
      });
    }

    if (!fs.existsSync(backupPath)) {
      return JSON.stringify({
        success: false,
        action: 'restore',
        error: `Backup file not found: ${backupPath}`,
      });
    }

    const storePath = path.join(RAG_STORE_DIR, `${name}.json`);
    fs.copyFileSync(backupPath, storePath);

    return JSON.stringify({
      success: true,
      action: 'restore',
      message: `Store '${name}' restored from ${backupPath}`,
    });
  }

  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    const excludePatterns = ['node_modules', '.git', 'dist', 'coverage'];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludePatterns.some(p => entry.name.includes(p))) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.collectFiles(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return files.slice(0, 1000); // Limit to prevent overwhelming
  }
}
