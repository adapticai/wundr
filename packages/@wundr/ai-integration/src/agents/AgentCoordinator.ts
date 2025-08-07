/**
 * Agent Coordinator - Central agent management and coordination
 * 
 * Manages agent lifecycle, load balancing, health monitoring, and optimal
 * task assignment across the 54 specialized agent types.
 */

import { EventEmitter } from 'eventemitter3';
import { 
  AgentConfig,
  Agent,
  AgentType,
  AgentStatus,
  Task,
  OperationResult 
} from '../types';

export class AgentCoordinator extends EventEmitter {
  private config: AgentConfig;
  private agents: Map<string, Agent> = new Map();
  private agentPool: Map<AgentType, Agent[]> = new Map();
  private taskQueue: Map<string, Task> = new Map();
  private agentAssignments: Map<string, string[]> = new Map(); // agentId -> taskIds
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private loadBalancer: AgentLoadBalancer;
  private performanceTracker: AgentPerformanceTracker;

  // Agent Type Categories for intelligent grouping
  private readonly AGENT_CATEGORIES = {
    'core': ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
    'swarm': [
      'hierarchical-coordinator', 'mesh-coordinator', 'adaptive-coordinator',
      'collective-intelligence-coordinator', 'swarm-memory-manager'
    ],
    'consensus': [
      'byzantine-coordinator', 'raft-manager', 'gossip-coordinator',
      'consensus-builder', 'crdt-synchronizer', 'quorum-manager', 'security-manager'
    ],
    'performance': [
      'perf-analyzer', 'performance-benchmarker', 'task-orchestrator',
      'memory-coordinator', 'smart-agent'
    ],
    'github': [
      'github-modes', 'pr-manager', 'code-review-swarm', 'issue-tracker',
      'release-manager', 'workflow-automation', 'project-board-sync',
      'repo-architect', 'multi-repo-swarm'
    ],
    'sparc': [
      'sparc-coord', 'sparc-coder', 'specification', 'pseudocode',
      'architecture', 'refinement'
    ],
    'specialized': [
      'backend-dev', 'mobile-dev', 'ml-developer', 'cicd-engineer',
      'api-docs', 'system-architect', 'code-analyzer', 'base-template-generator'
    ],
    'testing': ['tdd-london-swarm', 'production-validator'],
    'migration': ['migration-planner', 'swarm-init']
  };

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.loadBalancer = new AgentLoadBalancer(config);
    this.performanceTracker = new AgentPerformanceTracker();
    this.initializeAgentPools();
  }

  async initialize(): Promise<OperationResult> {
    try {
      // Initialize agent pools
      this.initializeAgentPools();
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      // Initialize load balancer
      await this.loadBalancer.initialize();
      
      // Setup performance tracking
      await this.performanceTracker.initialize();
      
      // Pre-spawn agents if configured
      if (this.config.spawningStrategy === 'pre-spawn') {
        await this.preSpawnCoreAgents();
      }

      return {
        success: true,
        message: 'Agent Coordinator initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Agent Coordinator initialization failed: ${error.message}`,
        error: error
      };
    }
  }

  private initializeAgentPools(): void {
    // Initialize empty pools for each agent type
    for (const category of Object.values(this.AGENT_CATEGORIES)) {
      for (const agentType of category) {
        this.agentPool.set(agentType as AgentType, []);
      }
    }
  }

  private setupHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async preSpawnCoreAgents(): Promise<void> {
    const coreAgents: AgentType[] = ['coder', 'reviewer', 'tester', 'planner'];
    
    for (const agentType of coreAgents) {
      try {
        const agent = await this.createAgent(agentType, 'global-session');
        await this.registerAgent(agent);
      } catch (error) {
        console.warn(`Failed to pre-spawn ${agentType}: ${error.message}`);
      }
    }
  }

  /**
   * Register an agent with the coordinator
   */
  async registerAgent(agent: Agent): Promise<void> {
    // Validate agent
    if (!this.isValidAgent(agent)) {
      throw new Error('Invalid agent configuration');
    }

    // Register in main registry
    this.agents.set(agent.id, agent);
    
    // Add to type-specific pool
    const pool = this.agentPool.get(agent.type) || [];
    pool.push(agent);
    this.agentPool.set(agent.type, pool);
    
    // Initialize agent assignments tracking
    this.agentAssignments.set(agent.id, []);
    
    // Start performance tracking
    await this.performanceTracker.startTracking(agent);
    
    // Notify load balancer
    await this.loadBalancer.registerAgent(agent);
    
    this.emit('agent-registered', agent);
  }

  private isValidAgent(agent: Agent): boolean {
    return !!(agent.id && 
             agent.type && 
             agent.capabilities && 
             agent.capabilities.length > 0 &&
             agent.sessionId);
  }

  private async createAgent(agentType: AgentType, sessionId: string): Promise<Agent> {
    const agentId = this.generateAgentId(agentType);
    const category = this.getAgentCategory(agentType);
    const capabilities = this.getAgentCapabilities(agentType);

    return {
      id: agentId,
      type: agentType,
      category: category,
      capabilities: capabilities,
      status: 'initializing',
      topology: 'adaptive', // Default topology
      sessionId: sessionId,
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 0,
        averageResponseTime: 0,
        healthScore: 1.0
      }
    };
  }

  private generateAgentId(agentType: AgentType): string {
    return `${agentType}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }

  private getAgentCategory(agentType: AgentType): string {
    for (const [category, types] of Object.entries(this.AGENT_CATEGORIES)) {
      if (types.includes(agentType)) {
        return category;
      }
    }
    return 'unknown';
  }

  private getAgentCapabilities(agentType: AgentType): string[] {
    // Define capabilities for each agent type
    const capabilityMap: Record<AgentType, string[]> = {
      // Core Development
      'coder': ['coding', 'implementation', 'refactoring', 'debugging'],
      'reviewer': ['code-review', 'quality-assurance', 'standards', 'security-review'],
      'tester': ['testing', 'validation', 'quality-assurance', 'automation'],
      'planner': ['planning', 'architecture', 'coordination', 'project-management'],
      'researcher': ['research', 'analysis', 'documentation', 'investigation'],

      // Swarm Coordination
      'hierarchical-coordinator': ['coordination', 'hierarchy', 'management', 'delegation'],
      'mesh-coordinator': ['coordination', 'mesh-topology', 'distributed', 'peer-to-peer'],
      'adaptive-coordinator': ['coordination', 'adaptation', 'optimization', 'flexibility'],
      'collective-intelligence-coordinator': ['coordination', 'intelligence', 'consensus', 'collective'],
      'swarm-memory-manager': ['memory', 'persistence', 'coordination', 'data-management'],

      // Consensus & Distributed
      'byzantine-coordinator': ['consensus', 'fault-tolerance', 'distributed', 'reliability'],
      'raft-manager': ['consensus', 'raft-protocol', 'leadership', 'coordination'],
      'gossip-coordinator': ['gossip-protocol', 'distributed', 'communication', 'propagation'],
      'consensus-builder': ['consensus', 'agreement', 'coordination', 'decision-making'],
      'crdt-synchronizer': ['crdt', 'synchronization', 'conflict-resolution', 'consistency'],
      'quorum-manager': ['quorum', 'voting', 'consensus', 'democratic-process'],
      'security-manager': ['security', 'encryption', 'authentication', 'authorization'],

      // Performance & Optimization
      'perf-analyzer': ['performance', 'analysis', 'optimization', 'profiling'],
      'performance-benchmarker': ['benchmarking', 'metrics', 'analysis', 'measurement'],
      'task-orchestrator': ['orchestration', 'task-management', 'coordination', 'workflow'],
      'memory-coordinator': ['memory', 'optimization', 'coordination', 'resource-management'],
      'smart-agent': ['intelligence', 'adaptation', 'learning', 'optimization'],

      // GitHub & Repository
      'github-modes': ['github', 'integration', 'automation', 'repository-management'],
      'pr-manager': ['pull-requests', 'management', 'automation', 'review-coordination'],
      'code-review-swarm': ['code-review', 'swarm', 'quality', 'collaboration'],
      'issue-tracker': ['issues', 'tracking', 'management', 'prioritization'],
      'release-manager': ['releases', 'versioning', 'deployment', 'coordination'],
      'workflow-automation': ['workflows', 'automation', 'ci-cd', 'process-management'],
      'project-board-sync': ['project-boards', 'synchronization', 'management', 'tracking'],
      'repo-architect': ['repository', 'architecture', 'organization', 'structure'],
      'multi-repo-swarm': ['multi-repo', 'swarm', 'coordination', 'management'],

      // SPARC Methodology
      'sparc-coord': ['sparc', 'coordination', 'methodology', 'process-management'],
      'sparc-coder': ['sparc', 'coding', 'implementation', 'methodology'],
      'specification': ['specification', 'requirements', 'analysis', 'documentation'],
      'pseudocode': ['pseudocode', 'algorithm', 'design', 'planning'],
      'architecture': ['architecture', 'system-design', 'structure', 'planning'],
      'refinement': ['refinement', 'optimization', 'iteration', 'improvement'],

      // Specialized Development
      'backend-dev': ['backend', 'server', 'api', 'database', 'services'],
      'mobile-dev': ['mobile', 'ios', 'android', 'cross-platform', 'ui'],
      'ml-developer': ['machine-learning', 'ai', 'data-science', 'algorithms'],
      'cicd-engineer': ['ci-cd', 'deployment', 'automation', 'devops'],
      'api-docs': ['api', 'documentation', 'specification', 'integration'],
      'system-architect': ['system-architecture', 'design', 'scalability', 'infrastructure'],
      'code-analyzer': ['code-analysis', 'quality', 'metrics', 'static-analysis'],
      'base-template-generator': ['templates', 'generation', 'scaffolding', 'boilerplate'],

      // Testing & Validation
      'tdd-london-swarm': ['tdd', 'london-style', 'swarm', 'testing'],
      'production-validator': ['validation', 'production', 'quality', 'reliability'],

      // Migration & Planning
      'migration-planner': ['migration', 'planning', 'strategy', 'transformation'],
      'swarm-init': ['initialization', 'setup', 'configuration', 'orchestration']
    };

    return capabilityMap[agentType] || ['general'];
  }

  /**
   * Select optimal agents for a task
   */
  async selectAgentsForTask(task: Task): Promise<Agent[]> {
    const selectedAgents: Agent[] = [];
    
    // Analyze task requirements
    const requirements = this.analyzeTaskRequirements(task);
    
    // Find agents with required capabilities
    const candidateAgents = this.findCandidateAgents(requirements);
    
    // Apply load balancing
    const balancedSelection = await this.loadBalancer.selectOptimalAgents(
      candidateAgents, 
      task,
      requirements
    );
    
    // Ensure diversity in agent selection
    const diverseSelection = this.ensureAgentDiversity(balancedSelection, requirements);
    
    return diverseSelection;
  }

  private analyzeTaskRequirements(task: Task): TaskRequirements {
    return {
      capabilities: task.requiredCapabilities,
      complexity: this.estimateTaskComplexity(task),
      priority: task.priority,
      estimatedAgents: this.estimateRequiredAgents(task),
      categories: this.identifyRequiredCategories(task),
      specializations: this.identifySpecializations(task)
    };
  }

  private estimateTaskComplexity(task: Task): number {
    let complexity = 1;
    
    // Base complexity from description length
    complexity += Math.min(task.description.length / 200, 3);
    
    // Capability requirements
    complexity += task.requiredCapabilities.length * 0.5;
    
    // Priority factor
    const priorityWeights = { low: 1, medium: 1.5, high: 2, critical: 3 };
    complexity *= priorityWeights[task.priority];
    
    // Type-specific complexity
    const typeComplexity = {
      'coding': 2,
      'review': 1.5,
      'testing': 1.8,
      'analysis': 2.2,
      'documentation': 1.2,
      'deployment': 2.5,
      'optimization': 3
    };
    
    complexity *= typeComplexity[task.type] || 1;
    
    return Math.round(complexity * 10) / 10;
  }

  private estimateRequiredAgents(task: Task): number {
    const baseAgents = Math.ceil(task.requiredCapabilities.length / 3);
    const complexityMultiplier = this.estimateTaskComplexity(task) > 5 ? 1.5 : 1;
    
    return Math.min(Math.ceil(baseAgents * complexityMultiplier), 8);
  }

  private identifyRequiredCategories(task: Task): string[] {
    const categories: string[] = [];
    
    // Map task type to likely categories
    if (task.type === 'coding') {
      categories.push('core', 'specialized');
    }
    
    if (task.type === 'review') {
      categories.push('core', 'github');
    }
    
    if (task.type === 'testing') {
      categories.push('core', 'testing');
    }
    
    if (task.type === 'analysis') {
      categories.push('core', 'performance');
    }
    
    // Check for SPARC methodology indicators
    if (task.description.toLowerCase().includes('sparc') || 
        task.description.toLowerCase().includes('methodology')) {
      categories.push('sparc');
    }
    
    // Check for GitHub indicators
    if (task.description.toLowerCase().includes('github') ||
        task.description.toLowerCase().includes('pull request') ||
        task.description.toLowerCase().includes('repository')) {
      categories.push('github');
    }
    
    return [...new Set(categories)];
  }

  private identifySpecializations(task: Task): AgentType[] {
    const specializations: AgentType[] = [];
    const description = task.description.toLowerCase();
    
    // Backend specialization
    if (description.includes('api') || description.includes('server') || description.includes('backend')) {
      specializations.push('backend-dev');
    }
    
    // Mobile specialization
    if (description.includes('mobile') || description.includes('ios') || description.includes('android')) {
      specializations.push('mobile-dev');
    }
    
    // ML specialization
    if (description.includes('machine learning') || description.includes('ai') || description.includes('model')) {
      specializations.push('ml-developer');
    }
    
    // CI/CD specialization
    if (description.includes('deploy') || description.includes('ci') || description.includes('pipeline')) {
      specializations.push('cicd-engineer');
    }
    
    return specializations;
  }

  private findCandidateAgents(requirements: TaskRequirements): Agent[] {
    const candidates: Agent[] = [];
    
    // Find agents by required capabilities
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status === 'idle' || agent.status === 'active') {
        const capabilityMatch = this.calculateCapabilityMatch(agent, requirements.capabilities);
        
        if (capabilityMatch > 0.3) { // Minimum 30% capability match
          candidates.push(agent);
        }
      }
    }
    
    // Sort by suitability
    candidates.sort((a, b) => {
      const scoreA = this.calculateAgentScore(a, requirements);
      const scoreB = this.calculateAgentScore(b, requirements);
      return scoreB - scoreA;
    });
    
    return candidates;
  }

  private calculateCapabilityMatch(agent: Agent, requiredCapabilities: string[]): number {
    if (requiredCapabilities.length === 0) return 1;
    
    const matchingCaps = agent.capabilities.filter(cap => 
      requiredCapabilities.includes(cap)
    ).length;
    
    return matchingCaps / requiredCapabilities.length;
  }

  private calculateAgentScore(agent: Agent, requirements: TaskRequirements): number {
    let score = 0;
    
    // Capability match (40%)
    const capabilityScore = this.calculateCapabilityMatch(agent, requirements.capabilities);
    score += capabilityScore * 40;
    
    // Performance metrics (30%)
    const performanceScore = (agent.metrics.successRate + agent.metrics.healthScore) / 2;
    score += performanceScore * 30;
    
    // Availability (20%)
    const availabilityScore = agent.status === 'idle' ? 1 : (agent.status === 'active' ? 0.7 : 0.3);
    score += availabilityScore * 20;
    
    // Load balancing (10%)
    const currentTasks = this.agentAssignments.get(agent.id)?.length || 0;
    const loadScore = Math.max(0, 1 - (currentTasks / 5)); // Penalty after 5 tasks
    score += loadScore * 10;
    
    return score;
  }

  private ensureAgentDiversity(agents: Agent[], requirements: TaskRequirements): Agent[] {
    if (agents.length <= 1) return agents;
    
    const diverse: Agent[] = [];
    const usedCategories = new Set<string>();
    
    // Ensure at least one agent from each required category
    for (const category of requirements.categories) {
      const categoryAgent = agents.find(agent => 
        agent.category === category && !diverse.includes(agent)
      );
      
      if (categoryAgent) {
        diverse.push(categoryAgent);
        usedCategories.add(category);
      }
    }
    
    // Add remaining agents ensuring diversity
    for (const agent of agents) {
      if (!diverse.includes(agent) && diverse.length < requirements.estimatedAgents) {
        if (!usedCategories.has(agent.category) || usedCategories.size < 3) {
          diverse.push(agent);
          usedCategories.add(agent.category);
        }
      }
    }
    
    return diverse.slice(0, requirements.estimatedAgents);
  }

  /**
   * Assign task to agents
   */
  async assignTask(task: Task, agents: Agent[]): Promise<void> {
    for (const agent of agents) {
      // Update agent status
      if (agent.status === 'idle') {
        agent.status = 'active';
      }
      
      // Add to assignments
      const assignments = this.agentAssignments.get(agent.id) || [];
      assignments.push(task.id);
      this.agentAssignments.set(agent.id, assignments);
      
      // Update task
      if (!task.assignedAgents.includes(agent.id)) {
        task.assignedAgents.push(agent.id);
      }
    }
    
    // Add task to queue for tracking
    this.taskQueue.set(task.id, task);
    
    this.emit('task-assigned', { task, agents });
  }

  /**
   * Complete task assignment
   */
  async completeTask(taskId: string, result: any): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) return;
    
    // Update agent assignments and metrics
    for (const agentId of task.assignedAgents) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;
      
      // Remove task from assignments
      const assignments = this.agentAssignments.get(agentId) || [];
      const updatedAssignments = assignments.filter(id => id !== taskId);
      this.agentAssignments.set(agentId, updatedAssignments);
      
      // Update agent status
      if (updatedAssignments.length === 0) {
        agent.status = 'idle';
      }
      
      // Update metrics
      agent.metrics.tasksCompleted++;
      agent.lastActivity = new Date();
      
      if (result.success) {
        agent.metrics.successRate = this.updateSuccessRate(agent.metrics.successRate, true);
      } else {
        agent.metrics.successRate = this.updateSuccessRate(agent.metrics.successRate, false);
      }
      
      // Update average response time
      if (result.executionTime) {
        agent.metrics.averageResponseTime = this.updateAverageResponseTime(
          agent.metrics.averageResponseTime,
          result.executionTime,
          agent.metrics.tasksCompleted
        );
      }
      
      // Update performance tracker
      await this.performanceTracker.recordTaskCompletion(agent, task, result);
    }
    
    // Remove from queue
    this.taskQueue.delete(taskId);
    
    this.emit('task-completed', { taskId, result });
  }

  private updateSuccessRate(currentRate: number, success: boolean): number {
    // Exponential moving average with alpha = 0.1
    return currentRate * 0.9 + (success ? 1 : 0) * 0.1;
  }

  private updateAverageResponseTime(currentAvg: number, newTime: number, taskCount: number): number {
    if (taskCount === 1) return newTime;
    return (currentAvg * (taskCount - 1) + newTime) / taskCount;
  }

  /**
   * Perform health checks on all agents
   */
  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.agents.values()).map(agent => 
      this.checkAgentHealth(agent)
    );
    
    await Promise.allSettled(healthPromises);
  }

  private async checkAgentHealth(agent: Agent): Promise<void> {
    try {
      let healthScore = 1.0;
      
      // Check response time
      if (agent.metrics.averageResponseTime > 10000) {
        healthScore -= 0.2;
      }
      
      // Check success rate
      if (agent.metrics.successRate < 0.5) {
        healthScore -= 0.3;
      }
      
      // Check last activity
      if (agent.lastActivity) {
        const inactiveTime = Date.now() - agent.lastActivity.getTime();
        if (inactiveTime > 60 * 60 * 1000) { // 1 hour
          healthScore -= 0.2;
        }
      }
      
      // Check if agent is stuck
      const assignments = this.agentAssignments.get(agent.id) || [];
      if (assignments.length > 0 && agent.status === 'busy') {
        const oldestTask = this.taskQueue.get(assignments[0]);
        if (oldestTask) {
          const taskAge = Date.now() - oldestTask.createdAt.getTime();
          if (taskAge > 30 * 60 * 1000) { // 30 minutes
            healthScore -= 0.4;
          }
        }
      }
      
      agent.metrics.healthScore = Math.max(0, healthScore);
      
      // Handle unhealthy agents
      if (agent.metrics.healthScore < 0.3 && this.config.autoRecovery) {
        await this.recoverAgent(agent);
      }
      
    } catch (error) {
      console.warn(`Health check failed for agent ${agent.id}:`, error);
      agent.status = 'error';
      agent.metrics.healthScore = 0;
    }
  }

  private async recoverAgent(agent: Agent): Promise<void> {
    try {
      this.emit('agent-recovery-started', agent);
      
      // Reset agent state
      agent.status = 'idle';
      
      // Clear stuck assignments
      const assignments = this.agentAssignments.get(agent.id) || [];
      for (const taskId of assignments) {
        await this.reassignStuckTask(taskId, agent.id);
      }
      this.agentAssignments.set(agent.id, []);
      
      // Reset some metrics
      agent.metrics.healthScore = 0.5; // Partial recovery
      
      this.emit('agent-recovered', agent);
    } catch (error) {
      console.error(`Failed to recover agent ${agent.id}:`, error);
      agent.status = 'error';
    }
  }

  private async reassignStuckTask(taskId: string, failedAgentId: string): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) return;
    
    // Remove failed agent from task
    task.assignedAgents = task.assignedAgents.filter(id => id !== failedAgentId);
    
    // Find replacement agent
    const replacementAgents = await this.selectAgentsForTask(task);
    const replacement = replacementAgents.find(agent => 
      !task.assignedAgents.includes(agent.id)
    );
    
    if (replacement) {
      await this.assignTask(task, [replacement]);
      this.emit('task-reassigned', { taskId, failedAgentId, replacementId: replacement.id });
    }
  }

  async getMetrics(): Promise<any> {
    const agentsByStatus = new Map<AgentStatus, number>();
    const agentsByCategory = new Map<string, number>();
    const agentsByType = new Map<AgentType, number>();
    
    for (const agent of this.agents.values()) {
      agentsByStatus.set(agent.status, (agentsByStatus.get(agent.status) || 0) + 1);
      agentsByCategory.set(agent.category, (agentsByCategory.get(agent.category) || 0) + 1);
      agentsByType.set(agent.type, (agentsByType.get(agent.type) || 0) + 1);
    }

    return {
      totalAgents: this.agents.size,
      agentsByStatus: Object.fromEntries(agentsByStatus),
      agentsByCategory: Object.fromEntries(agentsByCategory),
      agentsByType: Object.fromEntries(agentsByType),
      activeTasks: this.taskQueue.size,
      totalAssignments: Array.from(this.agentAssignments.values()).flat().length,
      loadBalancer: await this.loadBalancer.getMetrics(),
      performanceTracker: await this.performanceTracker.getMetrics()
    };
  }

  async shutdown(): Promise<OperationResult> {
    try {
      // Clear health check timer
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      // Shutdown all agents gracefully
      for (const agent of this.agents.values()) {
        agent.status = 'shutdown';
      }

      // Clear data structures
      this.agents.clear();
      this.agentPool.clear();
      this.taskQueue.clear();
      this.agentAssignments.clear();

      // Shutdown subsystems
      await this.loadBalancer.shutdown();
      await this.performanceTracker.shutdown();

      return {
        success: true,
        message: 'Agent Coordinator shutdown completed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Shutdown failed: ${error.message}`,
        error: error
      };
    }
  }
}

// Supporting Interfaces and Classes

interface TaskRequirements {
  capabilities: string[];
  complexity: number;
  priority: string;
  estimatedAgents: number;
  categories: string[];
  specializations: AgentType[];
}

class AgentLoadBalancer {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize load balancing algorithms
  }

  async registerAgent(agent: Agent): Promise<void> {
    // Register agent for load balancing
  }

  async selectOptimalAgents(candidates: Agent[], task: Task, requirements: TaskRequirements): Promise<Agent[]> {
    if (!this.config.loadBalancing) {
      return candidates.slice(0, requirements.estimatedAgents);
    }

    // Apply load balancing algorithm
    return this.applyLoadBalancing(candidates, requirements);
  }

  private applyLoadBalancing(candidates: Agent[], requirements: TaskRequirements): Agent[] {
    // Round-robin with capability weighting
    const selected: Agent[] = [];
    const sortedCandidates = candidates.sort((a, b) => {
      const loadA = this.calculateAgentLoad(a);
      const loadB = this.calculateAgentLoad(b);
      return loadA - loadB;
    });

    return sortedCandidates.slice(0, requirements.estimatedAgents);
  }

  private calculateAgentLoad(agent: Agent): number {
    // Simple load calculation based on status and metrics
    let load = 0;
    
    if (agent.status === 'busy') load += 1.0;
    if (agent.status === 'active') load += 0.5;
    if (agent.metrics.averageResponseTime > 5000) load += 0.3;
    
    return load;
  }

  async getMetrics(): Promise<any> {
    return {
      enabled: this.config.loadBalancing,
      algorithm: 'round-robin-weighted'
    };
  }

  async shutdown(): Promise<void> {
    // Cleanup load balancer
  }
}

class AgentPerformanceTracker {
  private performanceData: Map<string, any[]> = new Map();

  async initialize(): Promise<void> {
    // Initialize performance tracking
  }

  async startTracking(agent: Agent): Promise<void> {
    this.performanceData.set(agent.id, []);
  }

  async recordTaskCompletion(agent: Agent, task: Task, result: any): Promise<void> {
    const agentData = this.performanceData.get(agent.id) || [];
    
    agentData.push({
      taskId: task.id,
      taskType: task.type,
      success: result.success,
      executionTime: result.executionTime,
      timestamp: new Date()
    });
    
    // Keep only recent data
    if (agentData.length > 100) {
      agentData.splice(0, agentData.length - 100);
    }
    
    this.performanceData.set(agent.id, agentData);
  }

  async getMetrics(): Promise<any> {
    return {
      trackedAgents: this.performanceData.size,
      totalRecords: Array.from(this.performanceData.values()).flat().length
    };
  }

  async shutdown(): Promise<void> {
    this.performanceData.clear();
  }
}