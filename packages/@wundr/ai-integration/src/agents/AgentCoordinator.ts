/**
 * Agent Coordinator - Central agent management and coordination
 *
 * Manages agent lifecycle, load balancing, health monitoring, and optimal
 * task assignment across the 54 specialized agent types.
 */

import { EventEmitter } from 'eventemitter3';

import { AgentConfig, Agent, AgentType, Task, OperationResult } from '../types';
import { convertErrorToOperationError } from '../utils';

/**
 * Agent Load Balancer - Manages agent workload distribution
 */
class AgentLoadBalancer {
  private _config: AgentConfig;
  private agentLoads: Map<string, number> = new Map();

  constructor(config: AgentConfig) {
    this._config = config;
  }

  async initialize(): Promise<void> {
    // Initialize load balancer
  }

  async registerAgent(agent: Agent): Promise<void> {
    this.agentLoads.set(agent.id, 0);
  }

  async selectOptimalAgents(
    availableAgents: Agent[],
    task: Task
  ): Promise<Agent[]> {
    // For complex tasks requiring multiple capabilities, prioritize diversity
    const requiredCapabilities = task.requiredCapabilities || [];
    const isComplexTask = requiredCapabilities.length > 2;

    if (isComplexTask) {
      // Select agents with different categories to ensure diversity
      const selectedAgents: Agent[] = [];
      const usedCategories = new Set<string>();

      // First, try to get one agent from each different category
      const sortedAgents = availableAgents.sort((a, b) => {
        // Prefer idle agents over active ones
        if (a.status === 'idle' && b.status !== 'idle') return -1;
        if (b.status === 'idle' && a.status !== 'idle') return 1;

        // Then sort by load
        return (
          (this.agentLoads.get(a.id) || 0) - (this.agentLoads.get(b.id) || 0)
        );
      });

      for (const agent of sortedAgents) {
        if (!usedCategories.has(agent.category) && selectedAgents.length < 3) {
          selectedAgents.push(agent);
          usedCategories.add(agent.category);
        }
      }

      // Fill remaining slots with best available agents
      for (const agent of sortedAgents) {
        if (!selectedAgents.includes(agent) && selectedAgents.length < 3) {
          selectedAgents.push(agent);
        }
      }

      return selectedAgents;
    }

    // For simple tasks, use standard load-based selection
    return availableAgents
      .sort((a, b) => {
        // Prefer idle agents over active ones
        if (a.status === 'idle' && b.status !== 'idle') return -1;
        if (b.status === 'idle' && a.status !== 'idle') return 1;

        // Then sort by load
        return (
          (this.agentLoads.get(a.id) || 0) - (this.agentLoads.get(b.id) || 0)
        );
      })
      .slice(0, 3);
  }

  async applyLoadBalancing(agents: Agent[]): Promise<Agent[]> {
    return agents;
  }

  calculateAgentLoad(agentId: string): number {
    return this.agentLoads.get(agentId) || 0;
  }

  async getMetrics(): Promise<any> {
    return { loads: Object.fromEntries(this.agentLoads) };
  }

  async shutdown(): Promise<void> {
    this.agentLoads.clear();
  }
}

/**
 * Agent Performance Tracker - Tracks agent performance metrics
 */
class AgentPerformanceTracker {
  private performanceData: Map<string, any> = new Map();

  constructor() {}

  async initialize(): Promise<void> {
    // Initialize performance tracking
  }

  async startTracking(agent: Agent): Promise<void> {
    this.performanceData.set(agent.id, {
      startTime: Date.now(),
      tasks: 0,
      successes: 0,
    });
  }

  async recordTaskCompletion(
    agent: Agent,
    _task: Task,
    result: any
  ): Promise<void> {
    const data = this.performanceData.get(agent.id) || {
      tasks: 0,
      successes: 0,
    };
    data.tasks++;
    if (result.success) data.successes++;
    this.performanceData.set(agent.id, data);
  }

  async getMetrics(): Promise<any> {
    return { performance: Object.fromEntries(this.performanceData) };
  }

  async shutdown(): Promise<void> {
    this.performanceData.clear();
  }
}

export class AgentCoordinator extends EventEmitter {
  private _config: AgentConfig;
  private agents: Map<string, Agent> = new Map();
  private agentPool: Map<AgentType, Agent[]> = new Map();
  private taskQueue: Map<string, Task> = new Map();
  private agentAssignments: Map<string, string[]> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private loadBalancer: AgentLoadBalancer;
  private performanceTracker: AgentPerformanceTracker;

  constructor(config: AgentConfig) {
    super();
    this._config = config;
    this.loadBalancer = new AgentLoadBalancer(config);
    this.performanceTracker = new AgentPerformanceTracker();
    this.initializeAgentPools();
  }

  async initialize(): Promise<OperationResult> {
    try {
      this.initializeAgentPools();
      this.setupHealthMonitoring();

      await this.loadBalancer.initialize();
      await this.performanceTracker.initialize();

      if (this._config.spawningStrategy === 'pre-spawn') {
        await this.preSpawnCoreAgents();
      }

      return {
        success: true,
        message: 'Agent Coordinator initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Agent Coordinator initialization failed: ${(error as Error).message}`,
        error: convertErrorToOperationError(error, 'AGENT_INIT_ERROR'),
      };
    }
  }

  private initializeAgentPools(): void {
    const agentTypes: AgentType[] = [
      'coder',
      'reviewer',
      'tester',
      'planner',
      'researcher',
      'hierarchical-coordinator',
      'mesh-coordinator',
      'adaptive-coordinator',
      'collective-intelligence-coordinator',
      'swarm-memory-manager',
      'byzantine-coordinator',
      'raft-manager',
      'gossip-coordinator',
      'consensus-builder',
      'crdt-synchronizer',
      'quorum-manager',
      'security-manager',
      'perf-analyzer',
      'performance-benchmarker',
      'task-orchestrator',
      'memory-coordinator',
      'smart-agent',
      'github-modes',
      'pr-manager',
      'code-review-swarm',
      'issue-tracker',
      'release-manager',
      'workflow-automation',
      'project-board-sync',
      'repo-architect',
      'multi-repo-swarm',
      'sparc-coord',
      'sparc-coder',
      'specification',
      'pseudocode',
      'architecture',
      'refinement',
      'backend-dev',
      'mobile-dev',
      'ml-developer',
      'cicd-engineer',
      'api-docs',
      'system-architect',
      'code-analyzer',
      'base-template-generator',
      'tdd-london-swarm',
      'production-validator',
      'migration-planner',
      'swarm-init',
    ];

    agentTypes.forEach(type => {
      this.agentPool.set(type, []);
    });
  }

  private setupHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this._config.healthCheckInterval);
  }

  private async preSpawnCoreAgents(): Promise<void> {
    const coreAgents: AgentType[] = ['coder', 'reviewer', 'tester', 'planner'];

    for (const agentType of coreAgents) {
      try {
        const agent = await this.createAgent(agentType, 'global-session');
        await this.registerAgent(agent);
      } catch (error) {
        console.warn(
          `Failed to pre-spawn ${agentType}: ${(error as Error).message}`
        );
      }
    }
  }

  async registerAgent(agent: Agent): Promise<void> {
    if (!this.isValidAgent(agent)) {
      throw new Error('Invalid agent configuration');
    }

    this.agents.set(agent.id, agent);

    const pool = this.agentPool.get(agent.type) || [];
    pool.push(agent);
    this.agentPool.set(agent.type, pool);

    this.agentAssignments.set(agent.id, []);

    await this.loadBalancer.registerAgent(agent);
    await this.performanceTracker.startTracking(agent);

    // Initialize health score for newly registered agents
    agent.metrics.healthScore = 100;

    this.emit('agent-registered', agent);
  }

  private isValidAgent(agent: Agent): boolean {
    return !!(agent.id && agent.type && agent.status);
  }

  private async createAgent(
    type: AgentType,
    sessionId: string
  ): Promise<Agent> {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: this.getCategoryForType(type),
      capabilities: this.getCapabilitiesForType(type),
      status: 'idle',
      topology: 'mesh',
      sessionId,
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1,
        averageResponseTime: 0,
        healthScore: 100,
      },
    };
  }

  private getCategoryForType(type: AgentType): string {
    const categoryMap: Record<string, string> = {
      coder: 'core',
      reviewer: 'core',
      tester: 'core',
      planner: 'core',
      researcher: 'core',
      'hierarchical-coordinator': 'swarm',
      'mesh-coordinator': 'swarm',
      'adaptive-coordinator': 'swarm',
      'ml-developer': 'specialized',
      'backend-dev': 'specialized',
      'mobile-dev': 'specialized',
    };
    return categoryMap[type] || 'general';
  }

  private getCapabilitiesForType(type: AgentType): string[] {
    const capabilityMap: Record<string, string[]> = {
      coder: ['coding', 'implementation'],
      reviewer: ['code-review', 'quality-assurance', 'coding'], // Reviewers can also code
      tester: ['testing', 'validation', 'coding'], // Testers can also code
      'ml-developer': ['machine-learning', 'data-analysis', 'coding'],
      'backend-dev': ['backend-development', 'api-design', 'coding'],
      'mobile-dev': ['mobile-development', 'ui-design', 'coding'],
    };
    return capabilityMap[type] || ['general'];
  }

  async selectAgentsForTask(task: Task): Promise<Agent[]> {
    const availableAgents = this.getAvailableAgents();
    const compatibleAgents = this.filterAgentsByCapabilities(
      availableAgents,
      task.requiredCapabilities
    );

    if (compatibleAgents.length === 0) {
      return [];
    }

    // First, try to select from idle agents only
    const idleCompatibleAgents = compatibleAgents.filter(
      agent => agent.status === 'idle'
    );
    if (idleCompatibleAgents.length > 0) {
      return this.loadBalancer.selectOptimalAgents(idleCompatibleAgents, task);
    }

    // If no idle agents are available, fall back to active ones
    return this.loadBalancer.selectOptimalAgents(compatibleAgents, task);
  }

  async assignTask(task: Task, agents: Agent[]): Promise<void> {
    if (!task.id || agents.length === 0) {
      return; // Handle invalid assignments gracefully
    }

    // Add task to queue
    task.status = 'assigned';
    task.assignedAgents = agents.map(agent => agent.id);
    this.taskQueue.set(task.id, task);

    // Update agent assignments and status
    for (const agent of agents) {
      const assignments = this.agentAssignments.get(agent.id) || [];
      assignments.push(task.id);
      this.agentAssignments.set(agent.id, assignments);

      // Update agent status
      agent.status = 'active';
      this.agents.set(agent.id, agent);
    }

    this.emit('task-assigned', { task, agents });
  }

  async completeTask(taskId: string, result: any): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) {
      return;
    }

    // Update task status
    task.status = result.success ? 'completed' : 'failed';
    task.result = result;
    task.completedAt = new Date();

    // Update assigned agents
    for (const agentId of task.assignedAgents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        // Update agent status
        agent.status = 'idle';

        // Update agent metrics
        agent.metrics.tasksCompleted++;

        // Calculate success rate
        const assignments = this.agentAssignments.get(agentId) || [];
        const completedTasks = assignments.length;
        if (completedTasks > 0) {
          const successCount = result.success
            ? agent.metrics.tasksCompleted
            : agent.metrics.tasksCompleted - 1;
          agent.metrics.successRate = successCount / completedTasks;
        }

        // Update response time if provided
        if (result.executionTime) {
          const currentAvg = agent.metrics.averageResponseTime || 0;
          const completedCount = agent.metrics.tasksCompleted;
          agent.metrics.averageResponseTime =
            (currentAvg * (completedCount - 1) + result.executionTime) /
            completedCount;
        }

        this.agents.set(agentId, agent);
      }

      // Remove task from agent assignments
      const assignments = this.agentAssignments.get(agentId) || [];
      const updatedAssignments = assignments.filter(id => id !== taskId);
      this.agentAssignments.set(agentId, updatedAssignments);
    }

    // Record performance data
    for (const agentId of task.assignedAgents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        await this.performanceTracker.recordTaskCompletion(agent, task, result);
      }
    }

    // Remove task from queue
    this.taskQueue.delete(taskId);

    this.emit('task-completed', { taskId, result });
  }

  private getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.status === 'active' || agent.status === 'idle'
    );
  }

  private getIdleAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.status === 'idle'
    );
  }

  private filterAgentsByCapabilities(
    agents: Agent[],
    requiredCapabilities: string[]
  ): Agent[] {
    return agents.filter(agent =>
      requiredCapabilities.some(capability =>
        agent.capabilities.includes(capability)
      )
    );
  }

  private async performHealthChecks(): Promise<void> {
    for (const agent of this.agents.values()) {
      // Calculate health score based on performance metrics
      let healthScore = 100;

      // Factor in success rate (0-1 scale)
      const successPenalty = (1 - agent.metrics.successRate) * 50;
      healthScore -= successPenalty;

      // Factor in response time (penalize slow responses)
      const avgResponseTime = agent.metrics.averageResponseTime || 0;
      if (avgResponseTime > 10000) {
        // > 10 seconds
        healthScore -= 30;
      } else if (avgResponseTime > 5000) {
        // > 5 seconds
        healthScore -= 15;
      }

      // Update agent health score
      agent.metrics.healthScore = Math.max(0, healthScore);

      // Update the agent in our map so the changes persist
      this.agents.set(agent.id, agent);

      if (agent.metrics.healthScore < 50) {
        agent.status = 'error';
        this.emit('agent-unhealthy', agent);

        if (this._config.autoRecovery) {
          this.emit('agent-recovery-started', agent);
          await this.recoverAgent(agent);
        }
      }
    }
  }

  private async recoverAgent(agent: Agent): Promise<void> {
    try {
      agent.status = 'idle';
      agent.metrics.healthScore = 100;
      agent.metrics.averageResponseTime = 0;
      agent.metrics.successRate = 1;
      this.emit('agent-recovered', agent);
    } catch (error) {
      console.error(
        `Failed to recover agent ${agent.id}: ${(error as Error).message}`
      );
    }
  }

  async getMetrics(): Promise<any> {
    const agents = Array.from(this.agents.values());
    const activeTasks = Array.from(this.taskQueue.values()).filter(
      t => t.status === 'in-progress' || t.status === 'assigned'
    ).length;
    const totalAssignments = Array.from(this.agentAssignments.values()).reduce(
      (sum, assignments) => sum + assignments.length,
      0
    );

    // Group agents by type
    const agentsByType: Record<string, number> = {};
    agents.forEach(agent => {
      agentsByType[agent.type] = (agentsByType[agent.type] || 0) + 1;
    });

    // Group agents by status
    const agentsByStatus: Record<string, number> = {
      idle: 0,
      active: 0,
      busy: 0,
      error: 0,
      initializing: 0,
      shutdown: 0,
    };
    agents.forEach(agent => {
      agentsByStatus[agent.status] = (agentsByStatus[agent.status] || 0) + 1;
    });

    // Group agents by category
    const agentsByCategory: Record<string, number> = {};
    agents.forEach(agent => {
      agentsByCategory[agent.category] =
        (agentsByCategory[agent.category] || 0) + 1;
    });

    return {
      totalAgents: this.agents.size,
      activeAgents: agents.filter(a => a.status === 'active').length,
      agentsByType,
      agentsByStatus,
      agentsByCategory,
      activeTasks,
      totalAssignments,
      taskQueue: this.taskQueue.size,
      loadBalancer: await this.loadBalancer.getMetrics(),
      performanceTracker: await this.performanceTracker.getMetrics(),
    };
  }

  async shutdown(): Promise<OperationResult> {
    try {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      await this.loadBalancer.shutdown();
      await this.performanceTracker.shutdown();

      this.agents.clear();
      this.agentPool.clear();
      this.taskQueue.clear();
      this.agentAssignments.clear();
      this.healthCheckTimer = null;

      return {
        success: true,
        message: 'Agent Coordinator shutdown completed',
      };
    } catch (error) {
      return {
        success: false,
        message: `Shutdown failed: ${(error as Error).message}`,
        error: convertErrorToOperationError(error, 'AGENT_SHUTDOWN_ERROR'),
      };
    }
  }
}
