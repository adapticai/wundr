/**
 * Orchestration Frameworks Setup
 *
 * Configures LangGraph, CrewAI, and AutoGen for multi-agent AI workflows
 * and advanced orchestration capabilities.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { Logger } from './utils/logger';

import type {
  OrchestrationOptions,
  SetupPlatform,
  SetupStep,
  DeveloperProfile,
} from './types';

const logger = new Logger({ name: 'orchestration-setup' });

/**
 * Result of the orchestration frameworks setup process
 */
export interface OrchestrationSetupResult {
  success: boolean;
  langGraphConfigured: boolean;
  crewAIConfigured: boolean;
  autoGenConfigured: boolean;
  configPath: string;
  installedPackages: string[];
  errors: Error[];
  warnings: string[];
}

/**
 * Default orchestration configuration
 */
export const DEFAULT_ORCHESTRATION_OPTIONS: OrchestrationOptions = {
  langGraph: {
    enabled: true,
    executionMode: 'conditional',
    checkpointing: true,
    maxRecursionDepth: 25,
  },
  crewAI: {
    enabled: true,
    maxAgents: 10,
    collaborationMode: 'hierarchical',
    memorySharing: true,
  },
  autoGen: {
    enabled: false,
    humanInLoop: true,
    maxTurns: 50,
    codeExecutionSandbox: true,
  },
};

/**
 * Sets up orchestration frameworks for multi-agent AI workflows
 *
 * @param options - Orchestration configuration options
 * @param platform - The target platform information
 * @returns Promise resolving to the setup result
 */
export async function setupOrchestrationFrameworks(
  options: OrchestrationOptions = DEFAULT_ORCHESTRATION_OPTIONS,
  platform: SetupPlatform
): Promise<OrchestrationSetupResult> {
  const result: OrchestrationSetupResult = {
    success: false,
    langGraphConfigured: false,
    crewAIConfigured: false,
    autoGenConfigured: false,
    configPath: path.join(os.homedir(), '.wundr', 'orchestration.json'),
    installedPackages: [],
    errors: [],
    warnings: [],
  };

  logger.info('Starting orchestration frameworks setup...');

  try {
    // Ensure base configuration directory exists
    const configDir = path.join(os.homedir(), '.wundr', 'orchestration');
    await fs.mkdir(configDir, { recursive: true });

    // Check if Python is available
    const pythonAvailable = await checkPythonAvailability();
    if (!pythonAvailable) {
      result.warnings.push(
        'Python not available - some orchestration features may be limited'
      );
      logger.warn(
        'Python not available - skipping Python-based orchestration frameworks'
      );
    }

    // Setup LangGraph
    if (options.langGraph?.enabled) {
      try {
        await setupLangGraph(options.langGraph, platform, pythonAvailable);
        result.langGraphConfigured = true;
        if (pythonAvailable) {
          result.installedPackages.push('langgraph');
        }
        logger.info('LangGraph configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure LangGraph:', err.message);
      }
    }

    // Setup CrewAI
    if (options.crewAI?.enabled) {
      try {
        await setupCrewAI(options.crewAI, platform, pythonAvailable);
        result.crewAIConfigured = true;
        if (pythonAvailable) {
          result.installedPackages.push('crewai');
        }
        logger.info('CrewAI configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure CrewAI:', err.message);
      }
    }

    // Setup AutoGen
    if (options.autoGen?.enabled) {
      try {
        await setupAutoGen(options.autoGen, platform, pythonAvailable);
        result.autoGenConfigured = true;
        if (pythonAvailable) {
          result.installedPackages.push('pyautogen');
        }
        logger.info('AutoGen configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure AutoGen:', err.message);
      }
    }

    // Save master configuration
    await fs.writeFile(
      result.configPath,
      JSON.stringify(
        {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          options,
          platform,
          installedPackages: result.installedPackages,
        },
        null,
        2
      )
    );

    result.success = result.errors.length === 0;
    logger.info('Orchestration frameworks setup completed', {
      success: result.success,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    result.errors.push(err);
    logger.error('Orchestration frameworks setup failed:', err.message);
  }

  return result;
}

/**
 * Checks if Python is available on the system
 */
async function checkPythonAvailability(): Promise<boolean> {
  try {
    await execa('python3', ['--version']);
    return true;
  } catch {
    try {
      await execa('python', ['--version']);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Gets the Python command available on the system
 */
async function getPythonCommand(): Promise<string> {
  try {
    await execa('python3', ['--version']);
    return 'python3';
  } catch {
    return 'python';
  }
}

/**
 * Configures LangGraph for graph-based workflow orchestration
 */
async function setupLangGraph(
  config: NonNullable<OrchestrationOptions['langGraph']>,
  _platform: SetupPlatform,
  pythonAvailable: boolean
): Promise<void> {
  logger.info('Setting up LangGraph...');

  const langGraphDir = path.join(
    os.homedir(),
    '.wundr',
    'orchestration',
    'langgraph'
  );
  await fs.mkdir(langGraphDir, { recursive: true });

  // Create LangGraph configuration
  const langGraphConfig = {
    enabled: config.enabled,
    execution: {
      mode: config.executionMode || 'conditional',
      maxRecursionDepth: config.maxRecursionDepth || 25,
      timeout: 300000, // 5 minutes default
    },
    checkpointing: {
      enabled: config.checkpointing ?? true,
      storagePath: path.join(langGraphDir, 'checkpoints'),
      format: 'json',
    },
    graphs: {
      registryPath: path.join(langGraphDir, 'graphs'),
      templatesPath: path.join(langGraphDir, 'templates'),
    },
    tracing: {
      enabled: true,
      outputPath: path.join(langGraphDir, 'traces'),
    },
  };

  // Create directories
  await fs.mkdir(langGraphConfig.checkpointing.storagePath, {
    recursive: true,
  });
  await fs.mkdir(langGraphConfig.graphs.registryPath, { recursive: true });
  await fs.mkdir(langGraphConfig.graphs.templatesPath, { recursive: true });
  await fs.mkdir(langGraphConfig.tracing.outputPath, { recursive: true });

  // Install LangGraph Python package if Python is available
  if (pythonAvailable) {
    try {
      const pythonCmd = await getPythonCommand();
      logger.info('Installing langgraph package...');
      await execa(
        pythonCmd,
        ['-m', 'pip', 'install', '--user', 'langgraph', 'langchain'],
        {
          timeout: 180000,
        }
      );
    } catch (_error) {
      logger.warn(
        'Could not install langgraph package - you may need to install it manually'
      );
    }
  }

  // Create example graph template
  const exampleGraph = {
    name: 'example-workflow',
    version: '1.0.0',
    description: 'Example LangGraph workflow template',
    nodes: ['start', 'process', 'decide', 'end'],
    edges: [
      { from: 'start', to: 'process' },
      { from: 'process', to: 'decide' },
      { from: 'decide', to: 'end', condition: 'complete' },
      { from: 'decide', to: 'process', condition: 'retry' },
    ],
  };

  await fs.writeFile(
    path.join(langGraphConfig.graphs.templatesPath, 'example-workflow.json'),
    JSON.stringify(exampleGraph, null, 2)
  );
  await fs.writeFile(
    path.join(langGraphDir, 'config.json'),
    JSON.stringify(langGraphConfig, null, 2)
  );

  logger.info('LangGraph configuration created');
}

/**
 * Configures CrewAI for multi-agent collaboration
 */
async function setupCrewAI(
  config: NonNullable<OrchestrationOptions['crewAI']>,
  _platform: SetupPlatform,
  pythonAvailable: boolean
): Promise<void> {
  logger.info('Setting up CrewAI...');

  const crewAIDir = path.join(
    os.homedir(),
    '.wundr',
    'orchestration',
    'crewai'
  );
  await fs.mkdir(crewAIDir, { recursive: true });

  // Create CrewAI configuration
  const crewAIConfig = {
    enabled: config.enabled,
    agents: {
      maxConcurrent: config.maxAgents || 10,
      defaultRole: 'assistant',
      templatesPath: path.join(crewAIDir, 'agent-templates'),
    },
    collaboration: {
      mode: config.collaborationMode || 'hierarchical',
      memorySharing: config.memorySharing ?? true,
      communicationProtocol: 'message-passing',
    },
    crews: {
      registryPath: path.join(crewAIDir, 'crews'),
      defaultTimeout: 600000, // 10 minutes
    },
    memory: {
      enabled: config.memorySharing ?? true,
      storagePath: path.join(crewAIDir, 'memory'),
      sharedContext: true,
    },
  };

  // Create directories
  await fs.mkdir(crewAIConfig.agents.templatesPath, { recursive: true });
  await fs.mkdir(crewAIConfig.crews.registryPath, { recursive: true });
  await fs.mkdir(crewAIConfig.memory.storagePath, { recursive: true });

  // Install CrewAI Python package if Python is available
  if (pythonAvailable) {
    try {
      const pythonCmd = await getPythonCommand();
      logger.info('Installing crewai package...');
      await execa(pythonCmd, ['-m', 'pip', 'install', '--user', 'crewai'], {
        timeout: 180000,
      });
    } catch (_error) {
      logger.warn(
        'Could not install crewai package - you may need to install it manually'
      );
    }
  }

  // Create example agent templates
  const agentTemplates = [
    {
      name: 'researcher',
      role: 'Research Specialist',
      goal: 'Gather and synthesize information on given topics',
      backstory:
        'An experienced researcher with expertise in finding and analyzing information',
      tools: ['search', 'read', 'analyze'],
    },
    {
      name: 'coder',
      role: 'Software Developer',
      goal: 'Write clean, efficient, and well-documented code',
      backstory:
        'A skilled developer with experience in multiple programming languages',
      tools: ['code', 'test', 'debug'],
    },
    {
      name: 'reviewer',
      role: 'Code Reviewer',
      goal: 'Review code for quality, security, and best practices',
      backstory:
        'A meticulous reviewer with an eye for detail and security vulnerabilities',
      tools: ['analyze', 'review', 'suggest'],
    },
  ];

  for (const template of agentTemplates) {
    await fs.writeFile(
      path.join(crewAIConfig.agents.templatesPath, `${template.name}.json`),
      JSON.stringify(template, null, 2)
    );
  }

  await fs.writeFile(
    path.join(crewAIDir, 'config.json'),
    JSON.stringify(crewAIConfig, null, 2)
  );

  logger.info('CrewAI configuration created');
}

/**
 * Configures AutoGen for automated multi-agent conversations
 */
async function setupAutoGen(
  config: NonNullable<OrchestrationOptions['autoGen']>,
  _platform: SetupPlatform,
  pythonAvailable: boolean
): Promise<void> {
  logger.info('Setting up AutoGen...');

  const autoGenDir = path.join(
    os.homedir(),
    '.wundr',
    'orchestration',
    'autogen'
  );
  await fs.mkdir(autoGenDir, { recursive: true });

  // Create AutoGen configuration
  const autoGenConfig = {
    enabled: config.enabled,
    conversation: {
      maxTurns: config.maxTurns || 50,
      humanInLoop: config.humanInLoop ?? true,
      terminationCondition: 'natural',
    },
    codeExecution: {
      enabled: config.codeExecutionSandbox ?? true,
      sandbox: {
        type: 'docker',
        image: 'python:3.11-slim',
        timeout: 60000,
        memoryLimit: '512m',
      },
      workDir: path.join(autoGenDir, 'workspace'),
    },
    agents: {
      templatesPath: path.join(autoGenDir, 'agent-configs'),
      defaultModel: 'gpt-4',
    },
    logging: {
      enabled: true,
      outputPath: path.join(autoGenDir, 'logs'),
      level: 'info',
    },
  };

  // Create directories
  await fs.mkdir(autoGenConfig.codeExecution.workDir, { recursive: true });
  await fs.mkdir(autoGenConfig.agents.templatesPath, { recursive: true });
  await fs.mkdir(autoGenConfig.logging.outputPath, { recursive: true });

  // Install AutoGen Python package if Python is available
  if (pythonAvailable) {
    try {
      const pythonCmd = await getPythonCommand();
      logger.info('Installing pyautogen package...');
      await execa(pythonCmd, ['-m', 'pip', 'install', '--user', 'pyautogen'], {
        timeout: 180000,
      });
    } catch (_error) {
      logger.warn(
        'Could not install pyautogen package - you may need to install it manually'
      );
    }
  }

  // Create OAI_CONFIG_LIST template
  const oaiConfigTemplate = {
    _comment: 'Replace with your actual API configuration',
    model: 'gpt-4',
    api_key: '${OPENAI_API_KEY}',
    api_type: 'openai',
  };

  await fs.writeFile(
    path.join(
      autoGenConfig.agents.templatesPath,
      'OAI_CONFIG_LIST.template.json'
    ),
    JSON.stringify([oaiConfigTemplate], null, 2)
  );
  await fs.writeFile(
    path.join(autoGenDir, 'config.json'),
    JSON.stringify(autoGenConfig, null, 2)
  );

  logger.info('AutoGen configuration created');
}

/**
 * Validates the orchestration frameworks setup
 *
 * @returns Promise resolving to true if setup is valid
 */
export async function validateOrchestrationSetup(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.wundr', 'orchestration.json');

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
 * Gets setup steps for orchestration frameworks
 *
 * @param profile - Developer profile
 * @param platform - Target platform
 * @param options - Orchestration options
 * @returns Array of setup steps
 */
export function getOrchestrationSteps(
  _profile: DeveloperProfile,
  platform: SetupPlatform,
  options: OrchestrationOptions = DEFAULT_ORCHESTRATION_OPTIONS
): SetupStep[] {
  const steps: SetupStep[] = [];

  if (
    options.langGraph?.enabled ||
    options.crewAI?.enabled ||
    options.autoGen?.enabled
  ) {
    steps.push({
      id: 'setup-orchestration-frameworks',
      name: 'Setup Orchestration Frameworks',
      description:
        'Configure LangGraph, CrewAI, and AutoGen for multi-agent workflows',
      category: 'ai',
      required: false,
      dependencies: ['install-python', 'install-claude'],
      estimatedTime: 300,
      validator: () => validateOrchestrationSetup(),
      installer: async () => {
        await setupOrchestrationFrameworks(options, platform);
      },
    });
  }

  return steps;
}
