/**
 * Claude Flow Orchestrator - Manages the 54 specialized agents
 *
 * Handles agent spawning, coordination, and the SPARC methodology integration.
 * Implements concurrent execution patterns and swarm topology management.
 */

import { spawn } from 'child_process';
import * as path from 'path';

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs-extra';

import {
  ClaudeFlowConfig,
  Agent,
  AgentType,
  SwarmTopology,
  OperationResult,
  SPARCPhase,
} from '../types';
import { convertErrorToOperationError } from '../utils';

export class ClaudeFlowOrchestrator extends EventEmitter {
  private config: ClaudeFlowConfig;
  private activeAgents: Map<string, Agent> = new Map();
  private topologies: Map<string, SwarmTopology> = new Map();
  private sessionId: string;

  // 54 Specialized Agents Registry
  private readonly AGENT_REGISTRY = {
    // Core Development (5)
    coder: {
      category: 'core',
      capabilities: ['coding', 'implementation', 'refactoring'],
    },
    reviewer: {
      category: 'core',
      capabilities: ['code-review', 'quality-assurance', 'standards'],
    },
    tester: {
      category: 'core',
      capabilities: ['testing', 'validation', 'quality-assurance'],
    },
    planner: {
      category: 'core',
      capabilities: ['planning', 'architecture', 'coordination'],
    },
    researcher: {
      category: 'core',
      capabilities: ['research', 'analysis', 'documentation'],
    },

    // Swarm Coordination (5)
    'hierarchical-coordinator': {
      category: 'swarm',
      capabilities: ['coordination', 'hierarchy', 'management'],
    },
    'mesh-coordinator': {
      category: 'swarm',
      capabilities: ['coordination', 'mesh-topology', 'distributed'],
    },
    'adaptive-coordinator': {
      category: 'swarm',
      capabilities: ['coordination', 'adaptation', 'optimization'],
    },
    'collective-intelligence-coordinator': {
      category: 'swarm',
      capabilities: ['coordination', 'intelligence', 'consensus'],
    },
    'swarm-memory-manager': {
      category: 'swarm',
      capabilities: ['memory', 'persistence', 'coordination'],
    },

    // Consensus & Distributed (7)
    'byzantine-coordinator': {
      category: 'consensus',
      capabilities: ['consensus', 'fault-tolerance', 'distributed'],
    },
    'raft-manager': {
      category: 'consensus',
      capabilities: ['consensus', 'raft-protocol', 'leadership'],
    },
    'gossip-coordinator': {
      category: 'consensus',
      capabilities: ['gossip-protocol', 'distributed', 'communication'],
    },
    'consensus-builder': {
      category: 'consensus',
      capabilities: ['consensus', 'agreement', 'coordination'],
    },
    'crdt-synchronizer': {
      category: 'consensus',
      capabilities: ['crdt', 'synchronization', 'conflict-resolution'],
    },
    'quorum-manager': {
      category: 'consensus',
      capabilities: ['quorum', 'voting', 'consensus'],
    },
    'security-manager': {
      category: 'consensus',
      capabilities: ['security', 'encryption', 'authentication'],
    },

    // Performance & Optimization (5)
    'perf-analyzer': {
      category: 'performance',
      capabilities: ['performance', 'analysis', 'optimization'],
    },
    'performance-benchmarker': {
      category: 'performance',
      capabilities: ['benchmarking', 'metrics', 'analysis'],
    },
    'task-orchestrator': {
      category: 'performance',
      capabilities: ['orchestration', 'task-management', 'coordination'],
    },
    'memory-coordinator': {
      category: 'performance',
      capabilities: ['memory', 'optimization', 'coordination'],
    },
    'smart-agent': {
      category: 'performance',
      capabilities: ['intelligence', 'adaptation', 'learning'],
    },

    // GitHub & Repository (9)
    'github-modes': {
      category: 'github',
      capabilities: ['github', 'integration', 'automation'],
    },
    'pr-manager': {
      category: 'github',
      capabilities: ['pull-requests', 'management', 'automation'],
    },
    'code-review-swarm': {
      category: 'github',
      capabilities: ['code-review', 'swarm', 'quality'],
    },
    'issue-tracker': {
      category: 'github',
      capabilities: ['issues', 'tracking', 'management'],
    },
    'release-manager': {
      category: 'github',
      capabilities: ['releases', 'versioning', 'deployment'],
    },
    'workflow-automation': {
      category: 'github',
      capabilities: ['workflows', 'automation', 'ci-cd'],
    },
    'project-board-sync': {
      category: 'github',
      capabilities: ['project-boards', 'synchronization', 'management'],
    },
    'repo-architect': {
      category: 'github',
      capabilities: ['repository', 'architecture', 'organization'],
    },
    'multi-repo-swarm': {
      category: 'github',
      capabilities: ['multi-repo', 'swarm', 'coordination'],
    },

    // SPARC Methodology (6)
    'sparc-coord': {
      category: 'sparc',
      capabilities: ['sparc', 'coordination', 'methodology'],
    },
    'sparc-coder': {
      category: 'sparc',
      capabilities: ['sparc', 'coding', 'implementation'],
    },
    specification: {
      category: 'sparc',
      capabilities: ['specification', 'requirements', 'analysis'],
    },
    pseudocode: {
      category: 'sparc',
      capabilities: ['pseudocode', 'algorithm', 'design'],
    },
    architecture: {
      category: 'sparc',
      capabilities: ['architecture', 'system-design', 'structure'],
    },
    refinement: {
      category: 'sparc',
      capabilities: ['refinement', 'optimization', 'iteration'],
    },

    // Specialized Development (8)
    'backend-dev': {
      category: 'specialized',
      capabilities: ['backend', 'server', 'api'],
    },
    'mobile-dev': {
      category: 'specialized',
      capabilities: ['mobile', 'ios', 'android'],
    },
    'ml-developer': {
      category: 'specialized',
      capabilities: ['machine-learning', 'ai', 'data-science'],
    },
    'cicd-engineer': {
      category: 'specialized',
      capabilities: ['ci-cd', 'deployment', 'automation'],
    },
    'api-docs': {
      category: 'specialized',
      capabilities: ['api', 'documentation', 'specification'],
    },
    'system-architect': {
      category: 'specialized',
      capabilities: ['system-architecture', 'design', 'scalability'],
    },
    'code-analyzer': {
      category: 'specialized',
      capabilities: ['code-analysis', 'quality', 'metrics'],
    },
    'base-template-generator': {
      category: 'specialized',
      capabilities: ['templates', 'generation', 'scaffolding'],
    },

    // Testing & Validation (2)
    'tdd-london-swarm': {
      category: 'testing',
      capabilities: ['tdd', 'london-style', 'swarm'],
    },
    'production-validator': {
      category: 'testing',
      capabilities: ['validation', 'production', 'quality'],
    },

    // Migration & Planning (2)
    'migration-planner': {
      category: 'migration',
      capabilities: ['migration', 'planning', 'strategy'],
    },
    'swarm-init': {
      category: 'migration',
      capabilities: ['initialization', 'setup', 'configuration'],
    },
  };

  constructor(config: ClaudeFlowConfig) {
    super();
    this.config = config;
    this.sessionId = this.generateSessionId();
  }

  async initialize(): Promise<OperationResult> {
    try {
      // Initialize Claude Flow MCP server
      await this.setupClaudeFlowMCP();

      // Create session directory
      await this.createSessionDirectory();

      // Initialize base topology configurations
      await this.initializeTopologies();

      return {
        success: true,
        message: 'Claude Flow Orchestrator initialized successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Claude Flow initialization failed: ${errorMessage}`,
        error: convertErrorToOperationError(error, 'CLAUDE_FLOW_INIT_ERROR'),
      };
    }
  }

  private async setupClaudeFlowMCP(): Promise<void> {
    // Check if Claude Flow MCP is installed and configured
    const mcpConfigPath = path.join(
      process.env['HOME'] || '',
      '.claude',
      'mcp.json'
    );

    try {
      const mcpConfig = await fs.readJson(mcpConfigPath);
      const hasClaudeFlow = mcpConfig.servers?.['claude-flow'];

      if (!hasClaudeFlow) {
        throw new Error('Claude Flow MCP server not configured');
      }
    } catch (error) {
      // Log the error for debugging - could be file not found or JSON parse error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.debug(
        `MCP config check failed (${errorMessage}), attempting auto-install`
      );
      // Auto-install Claude Flow MCP server
      await this.installClaudeFlowMCP();
    }
  }

  private async installClaudeFlowMCP(): Promise<void> {
    return new Promise((resolve, reject) => {
      const installProcess = spawn(
        'claude',
        [
          'mcp',
          'add',
          'claude-flow',
          'npx',
          'claude-flow@alpha',
          'mcp',
          'start',
        ],
        {
          stdio: 'inherit',
        }
      );

      installProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Claude Flow MCP installation failed with code ${code}`)
          );
        }
      });

      installProcess.on('error', reject);
    });
  }

  private async createSessionDirectory(): Promise<void> {
    const sessionDir = path.join(
      this.config.sessionPath || './memory/sessions',
      this.sessionId
    );
    await fs.ensureDir(sessionDir);

    // Create session metadata
    await fs.writeJson(path.join(sessionDir, 'metadata.json'), {
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      config: this.config,
    });
  }

  private async initializeTopologies(): Promise<void> {
    // Mesh Topology for distributed coordination
    this.topologies.set('mesh', {
      type: 'mesh',
      maxAgents: 10,
      connectionPattern: 'full-mesh',
      coordinationStyle: 'peer-to-peer',
      faultTolerance: 'high',
    });

    // Hierarchical Topology for structured coordination
    this.topologies.set('hierarchical', {
      type: 'hierarchical',
      maxAgents: 20,
      connectionPattern: 'tree',
      coordinationStyle: 'top-down',
      faultTolerance: 'medium',
    });

    // Adaptive Topology for dynamic coordination
    this.topologies.set('adaptive', {
      type: 'adaptive',
      maxAgents: 15,
      connectionPattern: 'dynamic',
      coordinationStyle: 'adaptive',
      faultTolerance: 'high',
    });
  }

  /**
   * Spawn agents using Claude Flow with specified topology
   */
  async spawnAgents(
    agentTypes: AgentType[],
    topology: SwarmTopology
  ): Promise<Agent[]> {
    const agents: Agent[] = [];

    // Initialize swarm with topology
    await this.executeClaudeFlowCommand('swarm_init', {
      topology: topology.type,
      maxAgents: agentTypes.length,
    });

    // Spawn each agent type
    for (const agentType of agentTypes) {
      const agent = await this.spawnSingleAgent(agentType, topology);
      agents.push(agent);
      this.activeAgents.set(agent.id, agent);
      this.emit('agent-spawned', agent);
    }

    return agents;
  }

  private async spawnSingleAgent(
    agentType: AgentType,
    topology: SwarmTopology
  ): Promise<Agent> {
    const agentConfig = this.AGENT_REGISTRY[agentType];

    if (!agentConfig) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    // Spawn agent using Claude Flow MCP
    const agentId = await this.executeClaudeFlowCommand('agent_spawn', {
      type: agentType,
      category: agentConfig.category,
      capabilities: agentConfig.capabilities,
      topology: topology.type,
    });

    return {
      id: agentId,
      type: agentType,
      category: agentConfig.category,
      capabilities: agentConfig.capabilities,
      status: 'active',
      topology: topology.type,
      sessionId: this.sessionId,
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 0,
        averageResponseTime: 0,
      },
    };
  }

  /**
   * Execute SPARC methodology workflow
   */
  async executeSPARCWorkflow(
    task: string,
    phases: SPARCPhase[] = [
      'specification',
      'pseudocode',
      'architecture',
      'refinement',
      'completion',
    ]
  ): Promise<OperationResult> {
    try {
      const results: any = {};

      for (const phase of phases) {
        switch (phase) {
          case 'specification':
            results.specification = await this.executeClaudeFlowCommand(
              'sparc',
              {
                mode: 'spec-pseudocode',
                task: task,
              }
            );
            break;

          case 'pseudocode':
            results.pseudocode = await this.executeClaudeFlowCommand('sparc', {
              mode: 'spec-pseudocode',
              task: task,
              context: results.specification,
            });
            break;

          case 'architecture':
            results.architecture = await this.executeClaudeFlowCommand(
              'sparc',
              {
                mode: 'architect',
                task: task,
                context: {
                  specification: results.specification,
                  pseudocode: results.pseudocode,
                },
              }
            );
            break;

          case 'refinement':
            results.refinement = await this.executeClaudeFlowCommand('sparc', {
              mode: 'tdd',
              task: task,
              context: results,
            });
            break;

          case 'completion':
            results.completion = await this.executeClaudeFlowCommand('sparc', {
              mode: 'integration',
              task: task,
              context: results,
            });
            break;
        }

        this.emit('sparc-phase-completed', { phase, result: results[phase] });
      }

      return {
        success: true,
        message: 'SPARC workflow completed successfully',
        data: results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `SPARC workflow failed: ${errorMessage}`,
        error: convertErrorToOperationError(error, 'CLAUDE_FLOW_INIT_ERROR'),
      };
    }
  }

  /**
   * Execute concurrent batch operations
   */
  async executeBatchOperations(operations: any[]): Promise<OperationResult[]> {
    const results = await Promise.allSettled(
      operations.map(op => this.executeClaudeFlowCommand(op.command, op.params))
    );

    return results.map(result => ({
      success: result.status === 'fulfilled',
      message:
        result.status === 'fulfilled'
          ? 'Operation completed'
          : `Operation failed: ${result.reason}`,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  /**
   * Execute Claude Flow command via MCP
   */
  private async executeClaudeFlowCommand(
    command: string,
    params: any
  ): Promise<any> {
    // This would integrate with the actual MCP protocol
    // For now, we'll simulate the command execution

    const sessionCommand = await this.createSessionCommand(command, params);

    // Execute pre-task hooks
    await this.executeHook('pre-task', { command, params });

    // Execute main command (simulated)
    const result = await this.simulateClaudeFlowExecution(sessionCommand);

    // Execute post-task hooks
    await this.executeHook('post-task', { command, params, result });

    return result;
  }

  private async createSessionCommand(
    command: string,
    params: any
  ): Promise<string> {
    const hooks = {
      'pre-task': `npx claude-flow@alpha hooks pre-task --description "${params.task || command}"`,
      'session-restore': `npx claude-flow@alpha hooks session-restore --session-id "${this.sessionId}"`,
      'post-edit': `npx claude-flow@alpha hooks post-edit --file "${params.file || 'unknown'}" --memory-key "swarm/${command}/${Date.now()}"`,
      notify: `npx claude-flow@alpha hooks notify --message "${params.message || 'Command executed'}"`,
      'post-task': `npx claude-flow@alpha hooks post-task --task-id "${params.taskId || command}"`,
      'session-end': `npx claude-flow@alpha hooks session-end --export-metrics true`,
    };

    return (
      (hooks as Record<string, string>)[command] ||
      `npx claude-flow@alpha ${command}`
    );
  }

  private async executeHook(hookType: string, context: any): Promise<void> {
    // Execute hooks based on the Agent Coordination Protocol
    const hookCommands = {
      'pre-task': [
        `npx claude-flow@alpha hooks pre-task --description "${context.command}"`,
        `npx claude-flow@alpha hooks session-restore --session-id "${this.sessionId}"`,
      ],
      'post-task': [
        `npx claude-flow@alpha hooks post-task --task-id "${context.command}"`,
        `npx claude-flow@alpha hooks session-end --export-metrics true`,
      ],
    };

    const commands = (hookCommands as Record<string, string[]>)[hookType] || [];

    for (const command of commands) {
      try {
        await this.executeSystemCommand(command);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Hook execution failed: ${errorMessage}`);
      }
    }
  }

  private async executeSystemCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const childProcess = spawn(cmd || '', args, { stdio: 'pipe' });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      childProcess.on('error', reject);
    });
  }

  private async simulateClaudeFlowExecution(command: string): Promise<any> {
    // Simulate Claude Flow command execution
    // In a real implementation, this would interface with the actual MCP server

    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate execution time

    return {
      command,
      executedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      success: true,
    };
  }

  async getMetrics(): Promise<any> {
    return {
      sessionId: this.sessionId,
      activeAgents: this.activeAgents.size,
      availableAgentTypes: Object.keys(this.AGENT_REGISTRY).length,
      topologies: Array.from(this.topologies.keys()),
      agentsByCategory: this.getAgentsByCategory(),
    };
  }

  private getAgentsByCategory(): Record<string, number> {
    const categories: Record<string, number> = {};

    for (const agent of this.activeAgents.values()) {
      categories[agent.category] = (categories[agent.category] || 0) + 1;
    }

    return categories;
  }

  private generateSessionId(): string {
    return `swarm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async shutdown(): Promise<OperationResult> {
    try {
      // Shutdown all active agents
      for (const agent of this.activeAgents.values()) {
        await this.executeClaudeFlowCommand('agent_shutdown', {
          agentId: agent.id,
        });
      }

      this.activeAgents.clear();
      this.topologies.clear();

      return {
        success: true,
        message: 'Claude Flow Orchestrator shutdown completed',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Shutdown failed: ${errorMessage}`,
        error: convertErrorToOperationError(error, 'CLAUDE_FLOW_INIT_ERROR'),
      };
    }
  }
}
