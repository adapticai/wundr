/**
 * Context Engineering Setup
 *
 * Configures JIT (Just-In-Time) tools, agentic RAG, and memory architecture
 * for enhanced AI-assisted development workflows.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { Logger } from './utils/logger';

import type {
  ContextEngineeringOptions,
  SetupPlatform,
  SetupStep,
  DeveloperProfile,
} from './types';

const logger = new Logger({ name: 'context-engineering' });

/**
 * Result of the context engineering setup process
 */
export interface ContextEngineeringResult {
  success: boolean;
  jitToolsConfigured: boolean;
  agenticRagConfigured: boolean;
  memoryArchitectureConfigured: boolean;
  configPath: string;
  errors: Error[];
  warnings: string[];
}

/**
 * Default context engineering configuration
 */
export const DEFAULT_CONTEXT_ENGINEERING_OPTIONS: ContextEngineeringOptions = {
  jitTools: {
    enabled: true,
    maxContextSize: 128000,
    dynamicDiscovery: true,
  },
  agenticRag: {
    enabled: true,
    vectorStore: 'local',
    embeddingModel: 'text-embedding-3-small',
    chunkSize: 1000,
    chunkOverlap: 200,
  },
  memoryArchitecture: {
    enabled: true,
    shortTermCapacity: 10,
    longTermStoragePath: path.join(os.homedir(), '.wundr', 'memory'),
    episodicMemory: true,
    semanticMemory: true,
  },
};

/**
 * Sets up context engineering components for AI development workflows
 *
 * @param options - Context engineering configuration options
 * @param platform - The target platform information
 * @returns Promise resolving to the setup result
 */
export async function setupContextEngineering(
  options: ContextEngineeringOptions = DEFAULT_CONTEXT_ENGINEERING_OPTIONS,
  platform: SetupPlatform,
): Promise<ContextEngineeringResult> {
  const result: ContextEngineeringResult = {
    success: false,
    jitToolsConfigured: false,
    agenticRagConfigured: false,
    memoryArchitectureConfigured: false,
    configPath: path.join(os.homedir(), '.wundr', 'context-engineering.json'),
    errors: [],
    warnings: [],
  };

  logger.info('Starting context engineering setup...');

  try {
    // Ensure base configuration directory exists
    const configDir = path.join(os.homedir(), '.wundr');
    await fs.mkdir(configDir, { recursive: true });

    // Setup JIT Tools
    if (options.jitTools?.enabled) {
      try {
        await setupJitTools(options.jitTools, platform);
        result.jitToolsConfigured = true;
        logger.info('JIT tools configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure JIT tools:', err.message);
      }
    }

    // Setup Agentic RAG
    if (options.agenticRag?.enabled) {
      try {
        await setupAgenticRag(options.agenticRag, platform);
        result.agenticRagConfigured = true;
        logger.info('Agentic RAG configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure Agentic RAG:', err.message);
      }
    }

    // Setup Memory Architecture
    if (options.memoryArchitecture?.enabled) {
      try {
        await setupMemoryArchitecture(options.memoryArchitecture);
        result.memoryArchitectureConfigured = true;
        logger.info('Memory architecture configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure memory architecture:', err.message);
      }
    }

    // Save configuration
    await fs.writeFile(
      result.configPath,
      JSON.stringify(
        {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          options,
          platform,
        },
        null,
        2,
      ),
    );

    result.success = result.errors.length === 0;
    logger.info('Context engineering setup completed', {
      success: result.success,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    result.errors.push(err);
    logger.error('Context engineering setup failed:', err.message);
  }

  return result;
}

/**
 * Configures Just-In-Time tools for dynamic context loading
 */
async function setupJitTools(
  config: NonNullable<ContextEngineeringOptions['jitTools']>,
  _platform: SetupPlatform,
): Promise<void> {
  logger.info('Setting up JIT tools...');

  const jitConfigDir = path.join(os.homedir(), '.wundr', 'jit');
  await fs.mkdir(jitConfigDir, { recursive: true });

  // Create JIT tools configuration
  const jitConfig = {
    enabled: config.enabled,
    maxContextSize: config.maxContextSize || 128000,
    dynamicDiscovery: config.dynamicDiscovery ?? true,
    toolRegistry: path.join(jitConfigDir, 'tool-registry.json'),
    cacheDir: path.join(jitConfigDir, 'cache'),
    loadStrategies: ['lazy', 'preload', 'on-demand'],
    defaultStrategy: 'lazy',
  };

  // Create tool registry
  const toolRegistry: {
    version: string;
    tools: string[];
    lastUpdated: string;
  } = {
    version: '1.0.0',
    tools: [],
    lastUpdated: new Date().toISOString(),
  };

  await fs.mkdir(jitConfig.cacheDir, { recursive: true });
  await fs.writeFile(
    jitConfig.toolRegistry,
    JSON.stringify(toolRegistry, null, 2),
  );
  await fs.writeFile(
    path.join(jitConfigDir, 'config.json'),
    JSON.stringify(jitConfig, null, 2),
  );

  logger.info('JIT tools configuration created');
}

/**
 * Configures Agentic RAG for intelligent document retrieval
 */
async function setupAgenticRag(
  config: NonNullable<ContextEngineeringOptions['agenticRag']>,
  platform: SetupPlatform,
): Promise<void> {
  logger.info('Setting up Agentic RAG...');

  const ragConfigDir = path.join(os.homedir(), '.wundr', 'rag');
  await fs.mkdir(ragConfigDir, { recursive: true });

  // Create RAG configuration
  const ragConfig = {
    enabled: config.enabled,
    vectorStore: {
      provider: config.vectorStore || 'local',
      path: path.join(ragConfigDir, 'vectors'),
      dimensions: 1536, // Standard for text-embedding-3-small
    },
    embedding: {
      model: config.embeddingModel || 'text-embedding-3-small',
      batchSize: 100,
    },
    chunking: {
      size: config.chunkSize || 1000,
      overlap: config.chunkOverlap || 200,
      strategy: 'recursive',
    },
    retrieval: {
      topK: 5,
      minScore: 0.7,
      reranking: true,
    },
  };

  // Create vector store directory
  await fs.mkdir(ragConfig.vectorStore.path, { recursive: true });

  // Install required Python packages for local vector store if needed
  if (
    config.vectorStore === 'local' &&
    ['darwin', 'linux'].includes(platform.os)
  ) {
    try {
      // Check if pip is available
      await execa('pip3', ['--version']);

      // Install chromadb for local vector storage (optional, don't fail if unavailable)
      logger.info('Installing chromadb for local vector storage...');
      await execa('pip3', ['install', '--user', 'chromadb'], {
        timeout: 120000,
      });
    } catch (_error) {
      logger.warn(
        'Could not install chromadb - you may need to install it manually',
      );
    }
  }

  await fs.writeFile(
    path.join(ragConfigDir, 'config.json'),
    JSON.stringify(ragConfig, null, 2),
  );

  logger.info('Agentic RAG configuration created');
}

/**
 * Configures memory architecture for conversation and concept storage
 */
async function setupMemoryArchitecture(
  config: NonNullable<ContextEngineeringOptions['memoryArchitecture']>,
): Promise<void> {
  logger.info('Setting up memory architecture...');

  const memoryDir =
    config.longTermStoragePath || path.join(os.homedir(), '.wundr', 'memory');
  await fs.mkdir(memoryDir, { recursive: true });

  // Create memory architecture configuration
  const memoryConfig = {
    shortTerm: {
      enabled: true,
      capacity: config.shortTermCapacity || 10,
      storageType: 'in-memory',
      evictionPolicy: 'lru',
    },
    longTerm: {
      enabled: true,
      storagePath: memoryDir,
      storageFormat: 'json',
      compression: true,
    },
    episodic: {
      enabled: config.episodicMemory ?? true,
      storagePath: path.join(memoryDir, 'episodic'),
      indexStrategy: 'temporal',
      maxEpisodes: 1000,
    },
    semantic: {
      enabled: config.semanticMemory ?? true,
      storagePath: path.join(memoryDir, 'semantic'),
      indexStrategy: 'embedding',
      conceptGraph: true,
    },
  };

  // Create subdirectories
  if (memoryConfig.episodic.enabled) {
    await fs.mkdir(memoryConfig.episodic.storagePath, { recursive: true });
  }
  if (memoryConfig.semantic.enabled) {
    await fs.mkdir(memoryConfig.semantic.storagePath, { recursive: true });
  }

  await fs.writeFile(
    path.join(memoryDir, 'config.json'),
    JSON.stringify(memoryConfig, null, 2),
  );

  // Initialize empty memory stores
  await fs.writeFile(
    path.join(memoryDir, 'short-term.json'),
    JSON.stringify(
      { entries: [], lastUpdated: new Date().toISOString() },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(memoryDir, 'long-term.json'),
    JSON.stringify(
      { entries: [], lastUpdated: new Date().toISOString() },
      null,
      2,
    ),
  );

  logger.info('Memory architecture configuration created');
}

/**
 * Validates the context engineering setup
 *
 * @returns Promise resolving to true if setup is valid
 */
export async function validateContextEngineering(): Promise<boolean> {
  const configPath = path.join(
    os.homedir(),
    '.wundr',
    'context-engineering.json',
  );

  try {
    await fs.access(configPath);
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return config.version === '1.0.0';
  } catch {
    return false;
  }
}

/**
 * Gets setup steps for context engineering
 *
 * @param profile - Developer profile
 * @param platform - Target platform
 * @param options - Context engineering options
 * @returns Array of setup steps
 */
export function getContextEngineeringSteps(
  _profile: DeveloperProfile,
  platform: SetupPlatform,
  options: ContextEngineeringOptions = DEFAULT_CONTEXT_ENGINEERING_OPTIONS,
): SetupStep[] {
  const steps: SetupStep[] = [];

  if (
    options.jitTools?.enabled ||
    options.agenticRag?.enabled ||
    options.memoryArchitecture?.enabled
  ) {
    steps.push({
      id: 'setup-context-engineering',
      name: 'Setup Context Engineering',
      description: 'Configure JIT tools, agentic RAG, and memory architecture',
      category: 'ai',
      required: false,
      dependencies: ['install-claude'],
      estimatedTime: 120,
      validator: () => validateContextEngineering(),
      installer: async () => {
        await setupContextEngineering(options, platform);
      },
    });
  }

  return steps;
}
