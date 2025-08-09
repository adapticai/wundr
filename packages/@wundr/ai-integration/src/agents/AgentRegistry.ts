/**
 * Agent Registry - Central registry for all 54 agent types
 * 
 * Maintains metadata, capabilities, and status for all available agent types
 * in the AI Integration system.
 */

import { EventEmitter } from 'eventemitter3';
import { Agent, AgentType, OperationResult } from '../types';

export interface AgentTypeMetadata {
  category: string;
  capabilities: string[];
  description: string;
  prerequisites?: string[];
  estimatedCost: number; // Relative cost for resource planning
  maxConcurrent: number; // Max instances of this type
}

export class AgentRegistry extends EventEmitter {
  private registeredAgents: Map<string, Agent> = new Map();
  private agentTypes: Map<AgentType, AgentTypeMetadata> = new Map();

  constructor() {
    super();
    this.initializeAgentTypes();
  }

  async initialize(): Promise<OperationResult> {
    this.setupEventHandlers();
    return {
      success: true,
      message: 'Agent Registry initialized successfully'
    };
  }

  private initializeAgentTypes(): void {
    const agentTypes: Record<AgentType, AgentTypeMetadata> = {
      // Core Development (5)
      'coder': {
        category: 'core',
        capabilities: ['coding', 'implementation', 'refactoring', 'debugging'],
        description: 'Primary coding agent for implementation tasks',
        estimatedCost: 5,
        maxConcurrent: 10
      },
      'reviewer': {
        category: 'core',
        capabilities: ['code-review', 'quality-assurance', 'standards', 'best-practices'],
        description: 'Code review and quality assurance agent',
        estimatedCost: 3,
        maxConcurrent: 5
      },
      'tester': {
        category: 'core',
        capabilities: ['testing', 'validation', 'quality-assurance', 'test-automation'],
        description: 'Testing and validation specialist',
        estimatedCost: 4,
        maxConcurrent: 8
      },
      'planner': {
        category: 'core',
        capabilities: ['planning', 'architecture', 'coordination', 'strategy'],
        description: 'Strategic planning and coordination agent',
        estimatedCost: 2,
        maxConcurrent: 3
      },
      'researcher': {
        category: 'core',
        capabilities: ['research', 'analysis', 'documentation', 'investigation'],
        description: 'Research and analysis specialist',
        estimatedCost: 3,
        maxConcurrent: 6
      },

      // Swarm Coordination (5)
      'hierarchical-coordinator': {
        category: 'swarm',
        capabilities: ['coordination', 'hierarchy', 'management', 'delegation'],
        description: 'Hierarchical swarm coordination agent',
        estimatedCost: 2,
        maxConcurrent: 2
      },
      'mesh-coordinator': {
        category: 'swarm',
        capabilities: ['coordination', 'mesh-topology', 'distributed', 'peer-to-peer'],
        description: 'Mesh topology coordinator',
        estimatedCost: 3,
        maxConcurrent: 4
      },
      'adaptive-coordinator': {
        category: 'swarm',
        capabilities: ['coordination', 'adaptation', 'optimization', 'dynamic-topology'],
        description: 'Adaptive coordination with dynamic optimization',
        estimatedCost: 4,
        maxConcurrent: 3
      },
      'collective-intelligence-coordinator': {
        category: 'swarm',
        capabilities: ['coordination', 'intelligence', 'consensus', 'collective-decision'],
        description: 'Collective intelligence coordination',
        estimatedCost: 5,
        maxConcurrent: 2
      },
      'swarm-memory-manager': {
        category: 'swarm',
        capabilities: ['memory', 'persistence', 'coordination', 'state-management'],
        description: 'Swarm memory and state management',
        estimatedCost: 3,
        maxConcurrent: 4
      },

      // Consensus & Distributed (7)
      'byzantine-coordinator': {
        category: 'consensus',
        capabilities: ['consensus', 'fault-tolerance', 'distributed', 'byzantine-fault-tolerance'],
        description: 'Byzantine fault tolerant consensus',
        estimatedCost: 6,
        maxConcurrent: 2
      },
      'raft-manager': {
        category: 'consensus',
        capabilities: ['consensus', 'raft-protocol', 'leadership', 'log-replication'],
        description: 'Raft consensus protocol manager',
        estimatedCost: 4,
        maxConcurrent: 3
      },
      'gossip-coordinator': {
        category: 'consensus',
        capabilities: ['gossip-protocol', 'distributed', 'communication', 'epidemic-algorithms'],
        description: 'Gossip protocol based communication',
        estimatedCost: 3,
        maxConcurrent: 5
      },
      'consensus-builder': {
        category: 'consensus',
        capabilities: ['consensus', 'agreement', 'coordination', 'voting'],
        description: 'General consensus building agent',
        estimatedCost: 4,
        maxConcurrent: 3
      },
      'crdt-synchronizer': {
        category: 'consensus',
        capabilities: ['crdt', 'synchronization', 'conflict-resolution', 'eventual-consistency'],
        description: 'CRDT-based synchronization agent',
        estimatedCost: 5,
        maxConcurrent: 4
      },
      'quorum-manager': {
        category: 'consensus',
        capabilities: ['quorum', 'voting', 'consensus', 'majority-rules'],
        description: 'Quorum-based decision management',
        estimatedCost: 3,
        maxConcurrent: 3
      },
      'security-manager': {
        category: 'consensus',
        capabilities: ['security', 'encryption', 'authentication', 'access-control'],
        description: 'Security and access control manager',
        estimatedCost: 4,
        maxConcurrent: 2
      },

      // Performance & Optimization (5)
      'perf-analyzer': {
        category: 'performance',
        capabilities: ['performance', 'analysis', 'optimization', 'profiling'],
        description: 'Performance analysis and optimization',
        estimatedCost: 4,
        maxConcurrent: 5
      },
      'performance-benchmarker': {
        category: 'performance',
        capabilities: ['benchmarking', 'metrics', 'analysis', 'comparison'],
        description: 'Performance benchmarking specialist',
        estimatedCost: 3,
        maxConcurrent: 6
      },
      'task-orchestrator': {
        category: 'performance',
        capabilities: ['orchestration', 'task-management', 'coordination', 'workflow'],
        description: 'Task orchestration and workflow management',
        estimatedCost: 3,
        maxConcurrent: 4
      },
      'memory-coordinator': {
        category: 'performance',
        capabilities: ['memory', 'optimization', 'coordination', 'resource-management'],
        description: 'Memory optimization and coordination',
        estimatedCost: 3,
        maxConcurrent: 4
      },
      'smart-agent': {
        category: 'performance',
        capabilities: ['intelligence', 'adaptation', 'learning', 'self-optimization'],
        description: 'Intelligent adaptive agent',
        estimatedCost: 6,
        maxConcurrent: 3
      },

      // GitHub & Repository (9)
      'github-modes': {
        category: 'github',
        capabilities: ['github', 'integration', 'automation', 'api-integration'],
        description: 'GitHub integration and automation',
        estimatedCost: 3,
        maxConcurrent: 5
      },
      'pr-manager': {
        category: 'github',
        capabilities: ['pull-requests', 'management', 'automation', 'workflow'],
        description: 'Pull request management and automation',
        estimatedCost: 4,
        maxConcurrent: 6
      },
      'code-review-swarm': {
        category: 'github',
        capabilities: ['code-review', 'swarm', 'quality', 'collaborative-review'],
        description: 'Collaborative code review swarm',
        estimatedCost: 5,
        maxConcurrent: 4
      },
      'issue-tracker': {
        category: 'github',
        capabilities: ['issues', 'tracking', 'management', 'triage'],
        description: 'Issue tracking and management',
        estimatedCost: 2,
        maxConcurrent: 8
      },
      'release-manager': {
        category: 'github',
        capabilities: ['releases', 'versioning', 'deployment', 'changelog'],
        description: 'Release management and versioning',
        estimatedCost: 3,
        maxConcurrent: 3
      },
      'workflow-automation': {
        category: 'github',
        capabilities: ['workflows', 'automation', 'ci-cd', 'github-actions'],
        description: 'GitHub workflow automation',
        estimatedCost: 4,
        maxConcurrent: 5
      },
      'project-board-sync': {
        category: 'github',
        capabilities: ['project-boards', 'synchronization', 'management', 'kanban'],
        description: 'Project board synchronization',
        estimatedCost: 2,
        maxConcurrent: 4
      },
      'repo-architect': {
        category: 'github',
        capabilities: ['repository', 'architecture', 'organization', 'structure'],
        description: 'Repository architecture and organization',
        estimatedCost: 3,
        maxConcurrent: 3
      },
      'multi-repo-swarm': {
        category: 'github',
        capabilities: ['multi-repo', 'swarm', 'coordination', 'cross-repo'],
        description: 'Multi-repository coordination swarm',
        estimatedCost: 5,
        maxConcurrent: 2
      },

      // SPARC Methodology (6)
      'sparc-coord': {
        category: 'sparc',
        capabilities: ['sparc', 'coordination', 'methodology', 'workflow'],
        description: 'SPARC methodology coordinator',
        estimatedCost: 3,
        maxConcurrent: 3
      },
      'sparc-coder': {
        category: 'sparc',
        capabilities: ['sparc', 'coding', 'implementation', 'methodology'],
        description: 'SPARC methodology implementation specialist',
        estimatedCost: 4,
        maxConcurrent: 5
      },
      'specification': {
        category: 'sparc',
        capabilities: ['specification', 'requirements', 'analysis', 'documentation'],
        description: 'Requirements specification agent',
        estimatedCost: 3,
        maxConcurrent: 4
      },
      'pseudocode': {
        category: 'sparc',
        capabilities: ['pseudocode', 'algorithm', 'design', 'logic'],
        description: 'Algorithm design and pseudocode generation',
        estimatedCost: 3,
        maxConcurrent: 5
      },
      'architecture': {
        category: 'sparc',
        capabilities: ['architecture', 'system-design', 'structure', 'patterns'],
        description: 'System architecture design agent',
        estimatedCost: 4,
        maxConcurrent: 3
      },
      'refinement': {
        category: 'sparc',
        capabilities: ['refinement', 'optimization', 'iteration', 'improvement'],
        description: 'Code refinement and optimization',
        estimatedCost: 3,
        maxConcurrent: 6
      },

      // Specialized Development (8)
      'backend-dev': {
        category: 'specialized',
        capabilities: ['backend', 'server', 'api', 'database'],
        description: 'Backend development specialist',
        estimatedCost: 5,
        maxConcurrent: 6
      },
      'mobile-dev': {
        category: 'specialized',
        capabilities: ['mobile', 'ios', 'android', 'cross-platform'],
        description: 'Mobile development specialist',
        estimatedCost: 5,
        maxConcurrent: 4
      },
      'ml-developer': {
        category: 'specialized',
        capabilities: ['machine-learning', 'ai', 'data-science', 'neural-networks'],
        description: 'Machine learning and AI specialist',
        estimatedCost: 6,
        maxConcurrent: 3
      },
      'cicd-engineer': {
        category: 'specialized',
        capabilities: ['ci-cd', 'deployment', 'automation', 'devops'],
        description: 'CI/CD and deployment specialist',
        estimatedCost: 4,
        maxConcurrent: 4
      },
      'api-docs': {
        category: 'specialized',
        capabilities: ['api', 'documentation', 'specification', 'openapi'],
        description: 'API documentation specialist',
        estimatedCost: 3,
        maxConcurrent: 5
      },
      'system-architect': {
        category: 'specialized',
        capabilities: ['system-architecture', 'design', 'scalability', 'patterns'],
        description: 'System architecture specialist',
        estimatedCost: 5,
        maxConcurrent: 2
      },
      'code-analyzer': {
        category: 'specialized',
        capabilities: ['code-analysis', 'quality', 'metrics', 'static-analysis'],
        description: 'Code analysis and quality specialist',
        estimatedCost: 3,
        maxConcurrent: 6
      },
      'base-template-generator': {
        category: 'specialized',
        capabilities: ['templates', 'generation', 'scaffolding', 'boilerplate'],
        description: 'Template and scaffolding generator',
        estimatedCost: 2,
        maxConcurrent: 4
      },

      // Testing & Validation (2)
      'tdd-london-swarm': {
        category: 'testing',
        capabilities: ['tdd', 'london-style', 'swarm', 'mocking'],
        description: 'TDD London style testing swarm',
        estimatedCost: 5,
        maxConcurrent: 3
      },
      'production-validator': {
        category: 'testing',
        capabilities: ['validation', 'production', 'quality', 'smoke-testing'],
        description: 'Production validation specialist',
        estimatedCost: 4,
        maxConcurrent: 3
      },

      // Migration & Planning (2)
      'migration-planner': {
        category: 'migration',
        capabilities: ['migration', 'planning', 'strategy', 'legacy-systems'],
        description: 'Migration planning and strategy',
        estimatedCost: 4,
        maxConcurrent: 2
      },
      'swarm-init': {
        category: 'migration',
        capabilities: ['initialization', 'setup', 'configuration', 'bootstrap'],
        description: 'Swarm initialization and setup',
        estimatedCost: 2,
        maxConcurrent: 3
      }
    };

    Object.entries(agentTypes).forEach(([type, metadata]) => {
      this.agentTypes.set(type as AgentType, metadata);
    });
  }

  registerAgent(agent: Agent): void {
    this.registeredAgents.set(agent.id, agent);
    this.emit('agent-registered', agent);
  }

  unregisterAgent(agentId: string): boolean {
    const removed = this.registeredAgents.delete(agentId);
    if (removed) {
      this.emit('agent-unregistered', agentId);
    }
    return removed;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.registeredAgents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.registeredAgents.values());
  }

  getAgentsByType(type: AgentType): Agent[] {
    return this.getAllAgents().filter(agent => agent.type === type);
  }

  getAgentsByCategory(category: string): Agent[] {
    return this.getAllAgents().filter(agent => agent.category === category);
  }

  getAgentTypeMetadata(type: AgentType): AgentTypeMetadata | undefined {
    return this.agentTypes.get(type);
  }

  getAllAgentTypes(): Map<AgentType, AgentTypeMetadata> {
    return new Map(this.agentTypes);
  }

  getAvailableCapabilities(): string[] {
    const capabilities = new Set<string>();
    this.agentTypes.forEach(metadata => {
      metadata.capabilities.forEach(cap => capabilities.add(cap));
    });
    return Array.from(capabilities);
  }

  findAgentTypesByCapability(capability: string): AgentType[] {
    const matchingTypes: AgentType[] = [];
    this.agentTypes.forEach((metadata, type) => {
      if (metadata.capabilities.includes(capability)) {
        matchingTypes.push(type);
      }
    });
    return matchingTypes;
  }

  private setupEventHandlers(): void {
    // Event handling setup
  }

  async shutdown(): Promise<OperationResult> {
    this.registeredAgents.clear();
    return {
      success: true,
      message: 'Agent Registry shutdown completed'
    };
  }
}