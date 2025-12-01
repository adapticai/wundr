/**
 * RAG (Retrieval-Augmented Generation) CLI Commands
 * Manages RAG stores for AI-powered code understanding and retrieval
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';

// Constants
const RAG_BASE_DIR = path.join(os.homedir(), '.wundr', 'rag-stores');
const RAG_GLOBAL_DIR = path.join(RAG_BASE_DIR, 'global');
const RAG_PROJECT_DIR = path.join(RAG_BASE_DIR, 'project-specific');
const CONFIG_FILE = path.join(RAG_BASE_DIR, 'config.json');

// Types
interface RAGConfig {
  version: string;
  stores: {
    global: StoreConfig;
    'project-specific': StoreConfig;
  };
  embeddings: {
    model: string;
    dimensions: number;
    batchSize: number;
  };
  indexing: {
    chunkSize: number;
    chunkOverlap: number;
    maxTokens: number;
  };
  retrieval: {
    topK: number;
    minScore: number;
  };
}

interface StoreConfig {
  path: string;
  description: string;
  autoSync: boolean;
  pruneDeleted: boolean;
}

interface StoreMetadata {
  name: string;
  path: string;
  embeddingCount: number;
  lastSync: string | null;
  lastPrune: string | null;
  lastIndex: string | null;
  status: 'ready' | 'syncing' | 'error' | 'unknown';
  sourceDir?: string;
}

// Utility functions
function getTimestamp(): string {
  return new Date().toISOString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;
  try {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        totalSize += getDirSize(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  } catch {
    // Ignore permission errors
  }

  return totalSize;
}

async function loadConfig(): Promise<RAGConfig> {
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(configContent) as RAGConfig;
  } catch {
    return getDefaultConfig();
  }
}

function getDefaultConfig(): RAGConfig {
  return {
    version: '1.0.0',
    stores: {
      global: {
        path: RAG_GLOBAL_DIR,
        description: 'Global RAG store for shared knowledge',
        autoSync: true,
        pruneDeleted: true,
      },
      'project-specific': {
        path: RAG_PROJECT_DIR,
        description: 'Project-specific RAG stores',
        autoSync: false,
        pruneDeleted: false,
      },
    },
    embeddings: {
      model: 'text-embedding-004',
      dimensions: 768,
      batchSize: 100,
    },
    indexing: {
      chunkSize: 1000,
      chunkOverlap: 200,
      maxTokens: 8192,
    },
    retrieval: {
      topK: 5,
      minScore: 0.7,
    },
  };
}

async function saveConfig(config: RAGConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function getAllStores(): Promise<string[]> {
  const stores: string[] = [];

  if (existsSync(RAG_GLOBAL_DIR)) {
    stores.push(RAG_GLOBAL_DIR);
  }

  if (existsSync(RAG_PROJECT_DIR)) {
    try {
      const projectStores = readdirSync(RAG_PROJECT_DIR);
      for (const store of projectStores) {
        const storePath = path.join(RAG_PROJECT_DIR, store);
        if (statSync(storePath).isDirectory()) {
          stores.push(storePath);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  return stores;
}

async function getStoreMetadata(storePath: string): Promise<StoreMetadata> {
  const name = path.basename(storePath);
  const embeddingsDir = path.join(storePath, 'embeddings');
  const syncMetadataPath = path.join(storePath, 'metadata', 'sync.json');
  const pruneMetadataPath = path.join(storePath, 'metadata', 'prune.json');
  const indexMetadataPath = path.join(storePath, 'metadata', 'index.json');

  let embeddingCount = 0;
  if (existsSync(embeddingsDir)) {
    try {
      const files = readdirSync(embeddingsDir).filter(f => f.endsWith('.json'));
      embeddingCount = files.length;
    } catch {
      // Ignore permission errors
    }
  }

  let lastSync: string | null = null;
  let sourceDir: string | undefined;
  let status: StoreMetadata['status'] = 'unknown';

  if (existsSync(syncMetadataPath)) {
    try {
      const syncData = JSON.parse(await fs.readFile(syncMetadataPath, 'utf-8'));
      lastSync = syncData.lastSync || null;
      sourceDir = syncData.sourceDir;
      status = syncData.status === 'synced' ? 'ready' : syncData.status;
    } catch {
      // Ignore parse errors
    }
  }

  let lastPrune: string | null = null;
  if (existsSync(pruneMetadataPath)) {
    try {
      const pruneData = JSON.parse(
        await fs.readFile(pruneMetadataPath, 'utf-8')
      );
      lastPrune = pruneData.lastPrune || null;
    } catch {
      // Ignore parse errors
    }
  }

  let lastIndex: string | null = null;
  if (existsSync(indexMetadataPath)) {
    try {
      const indexData = JSON.parse(
        await fs.readFile(indexMetadataPath, 'utf-8')
      );
      lastIndex = indexData.lastIndex || null;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    name,
    path: storePath,
    embeddingCount,
    lastSync,
    lastPrune,
    lastIndex,
    status,
    sourceDir,
  };
}

// Create RAG command
export function createRAGCommand(): Command {
  const command = new Command('rag')
    .description(
      'Manage RAG (Retrieval-Augmented Generation) stores for AI-powered code understanding'
    )
    .addHelpText(
      'after',
      chalk.gray(`
Examples:
  ${chalk.green('wundr rag status')}           Show RAG store status
  ${chalk.green('wundr rag sync')}             Sync all RAG stores
  ${chalk.green('wundr rag prune')}            Remove deleted files from stores
  ${chalk.green('wundr rag reindex')}          Re-index stores
  ${chalk.green('wundr rag create myproject')} Create a new project-specific store
  ${chalk.green('wundr rag setup')}            Run initial RAG infrastructure setup
      `)
    );

  // Status command (default)
  command
    .command('status', { isDefault: true })
    .description('Show RAG store status and statistics')
    .option('--json', 'Output as JSON')
    .action(async options => {
      await showStatus(options);
    });

  // Sync command
  command
    .command('sync')
    .description('Sync all RAG stores with their source directories')
    .option('--store <name>', 'Only sync specific store')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async options => {
      await syncStores(options);
    });

  // Prune command
  command
    .command('prune')
    .description('Remove deleted files from RAG stores')
    .option('--store <name>', 'Only prune specific store')
    .option('--dry-run', 'Show what would be pruned without making changes')
    .action(async options => {
      await pruneStores(options);
    });

  // Reindex command
  command
    .command('reindex')
    .description('Re-index RAG stores with updated configurations')
    .option('--store <name>', 'Only reindex specific store')
    .option('--force', 'Force complete reindex')
    .action(async options => {
      await reindexStores(options);
    });

  // Create command
  command
    .command('create')
    .description('Create a new RAG store')
    .argument('<name>', 'Store name')
    .option('-s, --source <path>', 'Source directory to index')
    .option('-g, --global', 'Create as global store')
    .action(async (name, options) => {
      await createStore(name, options);
    });

  // Setup command
  command
    .command('setup')
    .description('Run initial RAG infrastructure setup')
    .option('--skip-api-key', 'Skip GEMINI_API_KEY configuration')
    .action(async options => {
      await runSetup(options);
    });

  // Config command
  command
    .command('config')
    .description('View or modify RAG configuration')
    .option('--get <key>', 'Get configuration value')
    .option('--set <key=value>', 'Set configuration value')
    .option('--reset', 'Reset to default configuration')
    .action(async options => {
      await manageConfig(options);
    });

  // Delete command
  command
    .command('delete')
    .description('Delete a RAG store')
    .argument('<name>', 'Store name')
    .option('--force', 'Skip confirmation')
    .action(async (name, options) => {
      await deleteStore(name, options);
    });

  return command;
}

// Command implementations
async function showStatus(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Loading RAG store status...').start();

  try {
    const stores = await getAllStores();
    const storeMetadata: StoreMetadata[] = [];
    let totalEmbeddings = 0;

    for (const store of stores) {
      const metadata = await getStoreMetadata(store);
      storeMetadata.push(metadata);
      totalEmbeddings += metadata.embeddingCount;
    }

    const totalSize = getDirSize(RAG_BASE_DIR);

    spinner.stop();

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            timestamp: getTimestamp(),
            stores: storeMetadata,
            totalEmbeddings,
            totalDiskUsage: formatBytes(totalSize),
            configPath: CONFIG_FILE,
          },
          null,
          2
        )
      );
      return;
    }

    console.log(chalk.cyan('\nRAG Store Status Report'));
    console.log(chalk.gray('='.repeat(70)));
    console.log(chalk.white('Config:'), chalk.gray(CONFIG_FILE));
    console.log(chalk.white('Total Embeddings:'), chalk.green(totalEmbeddings));
    console.log(
      chalk.white('Disk Usage:'),
      chalk.green(formatBytes(totalSize))
    );
    console.log(chalk.gray('-'.repeat(70)));

    if (storeMetadata.length === 0) {
      console.log(
        chalk.yellow(
          '\nNo RAG stores found. Run "wundr rag setup" to get started.\n'
        )
      );
      return;
    }

    console.log(
      chalk.cyan(
        padRight('Store', 25) +
          padRight('Embeddings', 12) +
          padRight('Last Sync', 18) +
          padRight('Status', 15)
      )
    );
    console.log(chalk.gray('-'.repeat(70)));

    for (const store of storeMetadata) {
      const lastSync = store.lastSync
        ? new Date(store.lastSync).toLocaleDateString()
        : 'Never';

      let statusColor = chalk.yellow;
      if (store.status === 'ready') {
        statusColor = chalk.green;
      }
      if (store.status === 'error') {
        statusColor = chalk.red;
      }

      console.log(
        padRight(store.name, 25) +
          padRight(String(store.embeddingCount), 12) +
          padRight(lastSync, 18) +
          statusColor(padRight(store.status, 15))
      );
    }

    console.log(chalk.gray('-'.repeat(70)));
    console.log('');
  } catch (error) {
    spinner.fail('Failed to load RAG status');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function syncStores(options: {
  store?: string;
  dryRun?: boolean;
}): Promise<void> {
  const spinner = ora('Syncing RAG stores...').start();

  try {
    const stores = await getAllStores();
    let synced = 0;
    let skipped = 0;

    spinner.stop();
    console.log(chalk.cyan('\nSyncing RAG Stores\n'));

    for (const storePath of stores) {
      const storeName = path.basename(storePath);

      if (options.store && storeName !== options.store) {
        continue;
      }

      const sourceMetadataPath = path.join(
        storePath,
        'metadata',
        'source.json'
      );

      if (!existsSync(sourceMetadataPath)) {
        console.log(chalk.yellow(`  [SKIP] ${storeName}: No source metadata`));
        skipped++;
        continue;
      }

      try {
        const sourceMetadata = JSON.parse(
          await fs.readFile(sourceMetadataPath, 'utf-8')
        );
        const sourceDir = sourceMetadata.sourceDir;

        if (!sourceDir || !existsSync(sourceDir)) {
          console.log(
            chalk.yellow(`  [SKIP] ${storeName}: Source directory not found`)
          );
          skipped++;
          continue;
        }

        // Count files
        let fileCount = 0;
        const countFiles = (dir: string): void => {
          if (!existsSync(dir)) {
            return;
          }
          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              const fullPath = path.join(dir, entry);
              const stat = statSync(fullPath);
              if (
                stat.isDirectory() &&
                !entry.startsWith('.') &&
                entry !== 'node_modules'
              ) {
                countFiles(fullPath);
              } else if (
                stat.isFile() &&
                /\.(ts|js|tsx|jsx|md|json)$/.test(entry)
              ) {
                fileCount++;
              }
            }
          } catch {
            // Ignore permission errors
          }
        };
        countFiles(sourceDir);

        if (options.dryRun) {
          console.log(
            chalk.blue(
              `  [DRY-RUN] ${storeName}: Would sync ${fileCount} files`
            )
          );
        } else {
          // Update sync metadata
          const syncMetadata = {
            lastSync: getTimestamp(),
            filesCount: fileCount,
            sourceDir,
            status: 'synced',
          };

          await fs.mkdir(path.join(storePath, 'metadata'), { recursive: true });
          await fs.writeFile(
            path.join(storePath, 'metadata', 'sync.json'),
            JSON.stringify(syncMetadata, null, 2)
          );

          console.log(
            chalk.green(`  [OK] ${storeName}: Synced ${fileCount} files`)
          );
        }
        synced++;
      } catch (error) {
        console.log(
          chalk.red(
            `  [ERROR] ${storeName}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }

    console.log(chalk.gray('\n' + '-'.repeat(50)));
    console.log(
      chalk.green(`Sync complete: ${synced} synced, ${skipped} skipped\n`)
    );
  } catch (error) {
    spinner.fail('Failed to sync stores');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function pruneStores(options: {
  store?: string;
  dryRun?: boolean;
}): Promise<void> {
  const spinner = ora('Pruning RAG stores...').start();

  try {
    const stores = await getAllStores();
    let totalPruned = 0;

    spinner.stop();
    console.log(chalk.cyan('\nPruning RAG Stores\n'));

    for (const storePath of stores) {
      const storeName = path.basename(storePath);

      if (options.store && storeName !== options.store) {
        continue;
      }

      const embeddingsDir = path.join(storePath, 'embeddings');
      let pruned = 0;

      if (existsSync(embeddingsDir)) {
        try {
          const embeddingFiles = readdirSync(embeddingsDir).filter(f =>
            f.endsWith('.json')
          );

          for (const file of embeddingFiles) {
            const embeddingPath = path.join(embeddingsDir, file);

            try {
              const embeddingData = JSON.parse(
                await fs.readFile(embeddingPath, 'utf-8')
              );
              const originalPath = embeddingData.originalPath;

              if (originalPath && !existsSync(originalPath)) {
                if (options.dryRun) {
                  console.log(chalk.blue(`  [DRY-RUN] Would remove: ${file}`));
                } else {
                  await fs.unlink(embeddingPath);
                }
                pruned++;
              }
            } catch {
              // Skip files that can't be parsed
            }
          }
        } catch {
          // Ignore permission errors
        }
      }

      if (!options.dryRun && pruned > 0) {
        // Update prune metadata
        const pruneMetadata = {
          lastPrune: getTimestamp(),
          prunedCount: pruned,
          status: 'completed',
        };

        await fs.mkdir(path.join(storePath, 'metadata'), { recursive: true });
        await fs.writeFile(
          path.join(storePath, 'metadata', 'prune.json'),
          JSON.stringify(pruneMetadata, null, 2)
        );
      }

      console.log(chalk.green(`  [OK] ${storeName}: Pruned ${pruned} entries`));
      totalPruned += pruned;
    }

    console.log(chalk.gray('\n' + '-'.repeat(50)));
    console.log(
      chalk.green(`Prune complete: ${totalPruned} entries removed\n`)
    );
  } catch (error) {
    spinner.fail('Failed to prune stores');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function reindexStores(options: {
  store?: string;
  force?: boolean;
}): Promise<void> {
  const spinner = ora('Re-indexing RAG stores...').start();

  try {
    const stores = await getAllStores();

    spinner.stop();
    console.log(chalk.cyan('\nRe-indexing RAG Stores\n'));

    for (const storePath of stores) {
      const storeName = path.basename(storePath);

      if (options.store && storeName !== options.store) {
        continue;
      }

      const embeddingsDir = path.join(storePath, 'embeddings');
      const indexesDir = path.join(storePath, 'indexes');

      await fs.mkdir(indexesDir, { recursive: true });

      let embeddingCount = 0;
      if (existsSync(embeddingsDir)) {
        try {
          const files = readdirSync(embeddingsDir).filter(f =>
            f.endsWith('.json')
          );
          embeddingCount = files.length;
        } catch {
          // Ignore permission errors
        }
      }

      // Generate index file
      const indexFile = path.join(indexesDir, 'main.json');
      const indexData = {
        version: '1.0.0',
        created: getTimestamp(),
        updated: getTimestamp(),
        embeddingCount,
        indexType: 'flat',
        status: 'ready',
      };

      await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2));

      // Update index metadata
      const indexMetadata = {
        lastIndex: getTimestamp(),
        totalEmbeddings: embeddingCount,
        indexFile,
        status: 'indexed',
      };

      await fs.mkdir(path.join(storePath, 'metadata'), { recursive: true });
      await fs.writeFile(
        path.join(storePath, 'metadata', 'index.json'),
        JSON.stringify(indexMetadata, null, 2)
      );

      console.log(
        chalk.green(`  [OK] ${storeName}: Indexed ${embeddingCount} entries`)
      );
    }

    console.log(chalk.gray('\n' + '-'.repeat(50)));
    console.log(chalk.green('Re-index complete\n'));
  } catch (error) {
    spinner.fail('Failed to reindex stores');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function createStore(
  name: string,
  options: { source?: string; global?: boolean }
): Promise<void> {
  const spinner = ora(`Creating RAG store: ${name}...`).start();

  try {
    const baseDir = options.global
      ? RAG_GLOBAL_DIR
      : path.join(RAG_PROJECT_DIR, name);

    if (existsSync(baseDir)) {
      spinner.fail(`Store already exists: ${name}`);
      return;
    }

    // Get source directory
    let sourceDir = options.source;

    if (!sourceDir) {
      spinner.stop();
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'sourceDir',
          message: 'Enter source directory to index:',
          default: process.cwd(),
          validate: (input: string) => {
            if (!existsSync(input)) {
              return 'Directory does not exist';
            }
            return true;
          },
        },
      ]);
      sourceDir = answers.sourceDir;
      spinner.start();
    }

    // Create store directories
    await fs.mkdir(path.join(baseDir, 'embeddings'), { recursive: true });
    await fs.mkdir(path.join(baseDir, 'indexes'), { recursive: true });
    await fs.mkdir(path.join(baseDir, 'metadata'), { recursive: true });
    await fs.mkdir(path.join(baseDir, 'cache'), { recursive: true });

    // Create source metadata
    const sourceMetadata = {
      sourceDir,
      created: getTimestamp(),
      name,
      type: options.global ? 'global' : 'project-specific',
    };

    await fs.writeFile(
      path.join(baseDir, 'metadata', 'source.json'),
      JSON.stringify(sourceMetadata, null, 2)
    );

    spinner.succeed(`RAG store created: ${name}`);
    console.log(chalk.gray(`  Location: ${baseDir}`));
    console.log(chalk.gray(`  Source: ${sourceDir}`));
    console.log(chalk.green('\nRun "wundr rag sync" to sync the store.\n'));
  } catch (error) {
    spinner.fail('Failed to create store');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function runSetup(options: { skipApiKey?: boolean }): Promise<void> {
  console.log(chalk.cyan('\nRAG Infrastructure Setup\n'));
  console.log(
    chalk.gray('This will set up the RAG infrastructure for Wundr.\n')
  );

  const spinner = ora('Checking prerequisites...').start();

  try {
    // Check Node.js version
    const versionPart = process.version.slice(1).split('.')[0] ?? '0';
    const nodeVersion = parseInt(versionPart, 10);
    if (nodeVersion < 18) {
      spinner.fail(`Node.js 18+ required. Current version: ${process.version}`);
      return;
    }
    spinner.succeed('Node.js version OK');

    // Install @google/genai
    spinner.start('Checking @google/genai package...');
    try {
      require.resolve('@google/genai');
      spinner.succeed('@google/genai is available');
    } catch {
      spinner.text = 'Installing @google/genai...';
      const { execSync } = await import('child_process');
      execSync('npm install -g @google/genai', { stdio: 'pipe' });
      spinner.succeed('@google/genai installed');
    }

    // Configure API key
    if (!options.skipApiKey) {
      spinner.stop();
      console.log(chalk.yellow('\nGEMINI_API_KEY Configuration'));
      console.log(
        chalk.gray(
          'Get your API key from: https://makersuite.google.com/app/apikey\n'
        )
      );

      if (process.env.GEMINI_API_KEY) {
        console.log(
          chalk.green('GEMINI_API_KEY is already set in environment.\n')
        );
      } else {
        console.log(chalk.yellow('GEMINI_API_KEY is not set.'));
        console.log(chalk.gray('Add the following to your shell profile:'));
        console.log(
          chalk.white('  export GEMINI_API_KEY="your-api-key-here"\n')
        );
      }
    }

    // Create directory structure
    spinner.start('Creating RAG store directories...');

    await fs.mkdir(RAG_GLOBAL_DIR, { recursive: true });
    await fs.mkdir(path.join(RAG_GLOBAL_DIR, 'embeddings'), {
      recursive: true,
    });
    await fs.mkdir(path.join(RAG_GLOBAL_DIR, 'indexes'), { recursive: true });
    await fs.mkdir(path.join(RAG_GLOBAL_DIR, 'metadata'), { recursive: true });
    await fs.mkdir(path.join(RAG_GLOBAL_DIR, 'cache'), { recursive: true });
    await fs.mkdir(RAG_PROJECT_DIR, { recursive: true });

    spinner.succeed('RAG store directories created');

    // Create config file
    spinner.start('Creating configuration file...');

    if (!existsSync(CONFIG_FILE)) {
      const config = getDefaultConfig();
      await saveConfig(config);
      spinner.succeed('Configuration file created');
    } else {
      spinner.succeed('Configuration file already exists');
    }

    console.log(chalk.green('\nRAG infrastructure setup complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.white('  1. Set GEMINI_API_KEY if not already set'));
    console.log(
      chalk.white('  2. Run "wundr rag create <name>" to create a store')
    );
    console.log(chalk.white('  3. Run "wundr rag sync" to sync your stores'));
    console.log(chalk.white('  4. Run "wundr rag status" to check status\n'));
  } catch (error) {
    spinner.fail('Setup failed');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function manageConfig(options: {
  get?: string;
  set?: string;
  reset?: boolean;
}): Promise<void> {
  try {
    if (options.reset) {
      const config = getDefaultConfig();
      await saveConfig(config);
      console.log(chalk.green('Configuration reset to defaults.'));
      return;
    }

    const config = await loadConfig();

    if (options.get) {
      const keys = options.get.split('.');
      let value: unknown = config;
      for (const key of keys) {
        value = (value as Record<string, unknown>)[key];
      }
      console.log(JSON.stringify(value, null, 2));
      return;
    }

    if (options.set) {
      const [keyPath, ...valueParts] = options.set.split('=');
      const value = valueParts.join('=');

      if (!keyPath) {
        console.error(chalk.red('Invalid key path'));
        return;
      }

      const keys = keyPath.split('.');
      let obj: Record<string, unknown> = config as unknown as Record<
        string,
        unknown
      >;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key) {
          obj = obj[key] as Record<string, unknown>;
        }
      }
      const lastKey = keys[keys.length - 1];

      if (!lastKey) {
        console.error(chalk.red('Invalid key path'));
        return;
      }

      // Parse value
      try {
        obj[lastKey] = JSON.parse(value);
      } catch {
        obj[lastKey] = value;
      }

      await saveConfig(config);
      console.log(chalk.green(`Set ${keyPath} = ${value}`));
      return;
    }

    // Show current config
    console.log(chalk.cyan('\nRAG Configuration\n'));
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

async function deleteStore(
  name: string,
  options: { force?: boolean }
): Promise<void> {
  const storePath =
    name === 'global' ? RAG_GLOBAL_DIR : path.join(RAG_PROJECT_DIR, name);

  if (!existsSync(storePath)) {
    console.log(chalk.red(`Store not found: ${name}`));
    return;
  }

  if (!options.force) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete store "${name}"?`,
        default: false,
      },
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }
  }

  const spinner = ora(`Deleting store: ${name}...`).start();

  try {
    await fs.rm(storePath, { recursive: true, force: true });
    spinner.succeed(`Store deleted: ${name}`);
  } catch (error) {
    spinner.fail('Failed to delete store');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

function padRight(str: string, length: number): string {
  return str.length >= length ? str : str + ' '.repeat(length - str.length);
}
