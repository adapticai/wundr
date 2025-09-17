/**
 * AI Integration Hive Queen - Central orchestration system
 * 
 * Coordinates all AI capabilities including Claude Code, Claude Flow, and MCP tools.
 * Implements the main orchestration logic for the AI integration ecosystem.
 */

import { EventEmitter } from 'eventemitter3';

import { ClaudeFlowOrchestrator } from './ClaudeFlowOrchestrator';
import { MCPToolsRegistry } from './MCPToolsRegistry';
import { MemoryManager } from './MemoryManager';
import { NeuralTrainingPipeline } from './NeuralTrainingPipeline';
import { SwarmIntelligence } from './SwarmIntelligence';
import { AgentCoordinator } from '../agents/AgentCoordinator';
import { GitHubIntegration } from '../github/GitHubIntegration';
import { PerformanceAnalyzer } from '../monitoring/PerformanceAnalyzer';
import { 
  AIIntegrationConfig, 
  HiveStatus, 
  OperationResult,
  Agent,
  Task,
  MemoryEntry 
} from '../types';

export class AIIntegrationHive extends EventEmitter {
  private claudeFlowOrchestrator!: ClaudeFlowOrchestrator;
  private mcpToolsRegistry!: MCPToolsRegistry;
  private neuralTrainingPipeline!: NeuralTrainingPipeline;
  private swarmIntelligence!: SwarmIntelligence;
  private memoryManager!: MemoryManager;
  private agentCoordinator!: AgentCoordinator;
  private performanceAnalyzer!: PerformanceAnalyzer;
  private githubIntegration!: GitHubIntegration;
  private status: HiveStatus = 'initializing';
  private config: AIIntegrationConfig;

  constructor(config: AIIntegrationConfig) {
    super();
    this.config = config;
    this.initializeComponents();
  }

  private initializeComponents(): void {
    // Initialize core orchestration components
    this.claudeFlowOrchestrator = new ClaudeFlowOrchestrator(this.config.claudeFlow);
    this.mcpToolsRegistry = new MCPToolsRegistry(this.config.mcpTools);
    this.neuralTrainingPipeline = new NeuralTrainingPipeline(this.config.neural);
    this.swarmIntelligence = new SwarmIntelligence(this.config.swarm);
    this.memoryManager = new MemoryManager(this.config.memory);
    this.agentCoordinator = new AgentCoordinator(this.config.agents);
    this.performanceAnalyzer = new PerformanceAnalyzer(this.config.performance);
    this.githubIntegration = new GitHubIntegration(this.config.github);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Cross-component event coordination
    this.claudeFlowOrchestrator.on('agent-spawned', this.handleAgentSpawned.bind(this));
    this.claudeFlowOrchestrator.on('task-completed', this.handleTaskCompleted.bind(this));
    this.neuralTrainingPipeline.on('pattern-learned', this.handlePatternLearned.bind(this));
    this.swarmIntelligence.on('consensus-reached', this.handleConsensusReached.bind(this));
    this.memoryManager.on('memory-updated', this.handleMemoryUpdated.bind(this));
    this.performanceAnalyzer.on('bottleneck-detected', this.handleBottleneckDetected.bind(this));
    this.githubIntegration.on('pr-ready', this.handlePRReady.bind(this));
  }

  /**
   * Initialize the AI Integration Hive
   */
  async initialize(): Promise<OperationResult> {
    try {
      this.status = 'initializing';
      this.emit('status-changed', this.status);

      // Initialize all components in parallel
      await Promise.all([
        this.claudeFlowOrchestrator.initialize(),
        this.mcpToolsRegistry.initialize(),
        this.neuralTrainingPipeline.initialize(),
        this.swarmIntelligence.initialize(),
        this.memoryManager.initialize(),
        this.agentCoordinator.initialize(),
        this.performanceAnalyzer.initialize(),
        this.githubIntegration.initialize()
      ]);

      this.status = 'ready';
      this.emit('status-changed', this.status);

      return {
        success: true,
        message: 'AI Integration Hive initialized successfully',
        data: { status: this.status }
      };
    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      return {
        success: false,
        message: `Initialization failed: ${(error as Error).message}`,
        error: error
      };
    }
  }

  /**
   * Spawn AI agents using Claude Flow orchestration
   */
  async spawnAgents(agentTypes: string[], task: string): Promise<OperationResult> {
    try {
      const topology = await this.swarmIntelligence.selectOptimalTopology(agentTypes, task);
      const agents = await this.claudeFlowOrchestrator.spawnAgents(agentTypes as any, topology);
      
      // Register agents with coordinator
      for (const agent of agents) {
        await this.agentCoordinator.registerAgent(agent);
      }

      // Start neural pattern monitoring
      await this.neuralTrainingPipeline.startMonitoring(agents);

      return {
        success: true,
        message: `Spawned ${agents.length} agents successfully`,
        data: { agents, topology }
      };
    } catch (error) {
      return {
        success: false,
        message: `Agent spawning failed: ${(error as Error).message}`,
        error: error
      };
    }
  }

  /**
   * Execute a task using the AI orchestration system
   */
  async executeTask(task: Task): Promise<OperationResult> {
    try {
      // Analyze task complexity and requirements
      await this.performanceAnalyzer.analyzeTask(task);
      
      // Select optimal agents and tools
      const agents = await this.agentCoordinator.selectAgentsForTask(task);
      const tools = await this.mcpToolsRegistry.selectToolsForTask(task);

      // Create memory context
      const memoryContext = await this.memoryManager.createContext(task);

      // Execute task through swarm intelligence
      const result = await this.swarmIntelligence.executeTask(task, agents, tools, memoryContext);

      // Train neural models on execution patterns
      await this.neuralTrainingPipeline.trainOnExecution(task, result);

      // Update cross-session memory
      // Store task result in memory
      // await this.memoryManager.storeTaskResult(task.id, result);

      return result;
    } catch (error) {
      return {
        success: false,
        message: `Task execution failed: ${(error as Error).message}`,
        error: error
      };
    }
  }

  /**
   * Get comprehensive status of the AI Integration Hive
   */
  getStatus(): HiveStatus {
    return this.status;
  }

  /**
   * Get detailed system metrics
   */
  async getMetrics(): Promise<any> {
    return {
      hive: {
        status: this.status,
        uptime: process.uptime()
      },
      claudeFlow: await this.claudeFlowOrchestrator.getMetrics(),
      mcpTools: await this.mcpToolsRegistry.getMetrics(),
      neural: await this.neuralTrainingPipeline.getMetrics(),
      swarm: await this.swarmIntelligence.getMetrics(),
      memory: await this.memoryManager.getMetrics(),
      agents: await this.agentCoordinator.getMetrics(),
      performance: await this.performanceAnalyzer.getMetrics(),
      github: await this.githubIntegration.getMetrics()
    };
  }

  // Event Handlers
  private async handleAgentSpawned(agent: Agent): Promise<void> {
    await this.memoryManager.trackAgent(agent);
    this.emit('agent-spawned', agent);
  }

  private async handleTaskCompleted(task: Task, result: any): Promise<void> {
    await this.neuralTrainingPipeline.learnFromCompletion(task, result);
    this.emit('task-completed', task, result);
  }

  private async handlePatternLearned(pattern: any): Promise<void> {
    await this.swarmIntelligence.updatePatterns(pattern);
    this.emit('pattern-learned', pattern);
  }

  private async handleConsensusReached(decision: any): Promise<void> {
    await this.memoryManager.storeConsensus(decision);
    this.emit('consensus-reached', decision);
  }

  private async handleMemoryUpdated(entry: MemoryEntry): Promise<void> {
    await this.neuralTrainingPipeline.processMemoryUpdate(entry);
    this.emit('memory-updated', entry);
  }

  private async handleBottleneckDetected(bottleneck: any): Promise<void> {
    await this.swarmIntelligence.optimizeTopology(bottleneck);
    this.emit('bottleneck-detected', bottleneck);
  }

  private async handlePRReady(pr: any): Promise<void> {
    await this.memoryManager.trackGitHubActivity(pr);
    this.emit('pr-ready', pr);
  }

  /**
   * Shutdown the AI Integration Hive gracefully
   */
  async shutdown(): Promise<OperationResult> {
    try {
      this.status = 'shutting-down';
      this.emit('status-changed', this.status);

      // Shutdown all components in parallel
      await Promise.all([
        this.claudeFlowOrchestrator.shutdown(),
        this.mcpToolsRegistry.shutdown(),
        this.neuralTrainingPipeline.shutdown(),
        this.swarmIntelligence.shutdown(),
        this.memoryManager.shutdown(),
        this.agentCoordinator.shutdown(),
        this.performanceAnalyzer.shutdown(),
        this.githubIntegration.shutdown()
      ]);

      this.status = 'shutdown';
      this.emit('status-changed', this.status);

      return {
        success: true,
        message: 'AI Integration Hive shutdown completed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Shutdown failed: ${(error as Error).message}`,
        error: error
      };
    }
  }
}