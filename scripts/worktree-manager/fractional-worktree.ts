/**
 * Fractional Worktree Manager
 *
 * Implements fractional worktree pattern for read/write separation in the
 * three-tier architecture. This optimization reduces 200 worktrees to ~50
 * write-enabled ones by allowing read-only agents to share the session worktree.
 *
 * @module scripts/worktree-manager/fractional-worktree
 */

/**
 * Configuration for fractional worktree management
 */
export interface FractionalWorktreeConfig {
  /** Agents that only need read access and can share the session worktree */
  readOnlyAgents: string[];
  /** Agents that need write access and require dedicated worktrees */
  writeAccessAgents: string[];
  /** Maximum worktrees per session */
  maxWorktreesPerSession?: number;
  /** Maximum worktrees per machine */
  maxWorktreesPerMachine?: number;
  /** Base path for worktrees */
  worktreeBasePath?: string;
}

/**
 * Configuration for a specific agent's worktree requirements
 */
export interface AgentWorktreeConfig {
  /** The agent type identifier */
  agentType: string;
  /** Whether the agent needs a dedicated worktree */
  needsDedicatedWorktree: boolean;
  /** Whether the agent has read-only access */
  isReadOnly: boolean;
  /** Whether the agent has write access */
  isWriteAccess: boolean;
  /** Permission mode for the agent */
  permissionMode: 'readOnly' | 'writeAccess' | 'unknown';
}

/**
 * Default agent classifications based on the implementation plan
 */
const DEFAULT_READ_ONLY_AGENTS: string[] = [
  'researcher',
  'log-analyzer',
  'reviewer',
  'trend-analyst',
  'scribe',
  'contract-scanner',
];

/**
 * Default write-access agents based on the implementation plan
 */
const DEFAULT_WRITE_ACCESS_AGENTS: string[] = [
  'code-surgeon',
  'test-fixer',
  'refactorer',
  'dependency-updater',
  'copywriter',
];

/**
 * Manages fractional worktree allocation for read/write separation.
 *
 * This class implements the fractional worktree pattern from the three-tier
 * architecture, which optimizes resource usage by:
 * - Allowing read-only agents to share the session worktree
 * - Only allocating dedicated worktrees to agents that need write access
 * - Reducing total worktree count from ~200 to ~50 per machine
 *
 * @example
 * ```typescript
 * const manager = new FractionalWorktreeManager({
 *   readOnlyAgents: ['researcher', 'reviewer'],
 *   writeAccessAgents: ['coder', 'refactorer'],
 * });
 *
 * const needsWorktree = manager.needsWorktree('coder'); // true
 * const worktreePath = await manager.getWorktreeForAgent('coder', '/path/to/session');
 * ```
 */
export class FractionalWorktreeManager {
  private readonly config: FractionalWorktreeConfig;

  /**
   * Creates a new FractionalWorktreeManager instance
   *
   * @param config - Configuration for worktree management
   */
  constructor(config: Partial<FractionalWorktreeConfig> = {}) {
    this.config = {
      readOnlyAgents: config.readOnlyAgents ?? [...DEFAULT_READ_ONLY_AGENTS],
      writeAccessAgents: config.writeAccessAgents ?? [
        ...DEFAULT_WRITE_ACCESS_AGENTS,
      ],
      maxWorktreesPerSession: config.maxWorktreesPerSession ?? 20,
      maxWorktreesPerMachine: config.maxWorktreesPerMachine ?? 200,
      worktreeBasePath: config.worktreeBasePath ?? '.git-worktrees/agents',
    };
  }

  /**
   * Determines if an agent needs a dedicated worktree.
   *
   * Write-access agents need dedicated worktrees to avoid conflicts.
   * Read-only agents can share the session worktree.
   *
   * @param agentType - The type/identifier of the agent
   * @returns true if the agent needs a dedicated worktree, false otherwise
   *
   * @example
   * ```typescript
   * manager.needsWorktree('code-surgeon'); // true
   * manager.needsWorktree('researcher'); // false
   * ```
   */
  needsWorktree(agentType: string): boolean {
    const normalizedType = this.normalizeAgentType(agentType);
    return this.isWriteAccessAgent(normalizedType);
  }

  /**
   * Checks if an agent is classified as read-only.
   *
   * Read-only agents don't modify files and can safely share
   * the session worktree without causing conflicts.
   *
   * @param agentType - The type/identifier of the agent
   * @returns true if the agent is read-only, false otherwise
   */
  isReadOnlyAgent(agentType: string): boolean {
    const normalizedType = this.normalizeAgentType(agentType);
    return this.config.readOnlyAgents.some(
      agent => this.normalizeAgentType(agent) === normalizedType
    );
  }

  /**
   * Checks if an agent is classified as write-access.
   *
   * Write-access agents modify files and need dedicated worktrees
   * to prevent conflicts with other agents.
   *
   * @param agentType - The type/identifier of the agent
   * @returns true if the agent has write access, false otherwise
   */
  isWriteAccessAgent(agentType: string): boolean {
    const normalizedType = this.normalizeAgentType(agentType);
    return this.config.writeAccessAgents.some(
      agent => this.normalizeAgentType(agent) === normalizedType
    );
  }

  /**
   * Gets the appropriate worktree path for an agent.
   *
   * For read-only agents, returns the session worktree path.
   * For write-access agents, generates a dedicated worktree path.
   *
   * @param agentType - The type/identifier of the agent
   * @param sessionWorktree - The path to the session's worktree
   * @returns The path to the worktree the agent should use
   *
   * @example
   * ```typescript
   * // Read-only agent shares session worktree
   * const path1 = await manager.getWorktreeForAgent('researcher', '/session/worktree');
   * // Returns: '/session/worktree'
   *
   * // Write-access agent gets dedicated worktree
   * const path2 = await manager.getWorktreeForAgent('code-surgeon', '/session/worktree');
   * // Returns: '/session/worktree/.git-worktrees/agents/code-surgeon-{timestamp}'
   * ```
   */
  async getWorktreeForAgent(
    agentType: string,
    sessionWorktree: string
  ): Promise<string> {
    const normalizedType = this.normalizeAgentType(agentType);

    // Read-only agents share the session worktree
    if (this.isReadOnlyAgent(normalizedType)) {
      return sessionWorktree;
    }

    // Write-access agents get a dedicated worktree path
    if (this.isWriteAccessAgent(normalizedType)) {
      const timestamp = Date.now();
      const worktreeName = `${normalizedType}-${timestamp}`;
      return `${sessionWorktree}/${this.config.worktreeBasePath}/${worktreeName}`;
    }

    // Unknown agents default to session worktree with a warning
    console.warn(
      `[FractionalWorktreeManager] Unknown agent type '${agentType}', ` +
        'defaulting to session worktree. Consider classifying this agent.'
    );
    return sessionWorktree;
  }

  /**
   * Gets the complete worktree configuration for an agent.
   *
   * @param agentType - The type/identifier of the agent
   * @returns The agent's worktree configuration
   */
  getAgentConfiguration(agentType: string): AgentWorktreeConfig {
    const normalizedType = this.normalizeAgentType(agentType);
    const isReadOnly = this.isReadOnlyAgent(normalizedType);
    const isWriteAccess = this.isWriteAccessAgent(normalizedType);

    let permissionMode: AgentWorktreeConfig['permissionMode'];
    if (isReadOnly) {
      permissionMode = 'readOnly';
    } else if (isWriteAccess) {
      permissionMode = 'writeAccess';
    } else {
      permissionMode = 'unknown';
    }

    return {
      agentType: normalizedType,
      needsDedicatedWorktree: isWriteAccess,
      isReadOnly,
      isWriteAccess,
      permissionMode,
    };
  }

  /**
   * Gets all registered read-only agent types
   *
   * @returns Array of read-only agent type identifiers
   */
  getReadOnlyAgents(): string[] {
    return [...this.config.readOnlyAgents];
  }

  /**
   * Gets all registered write-access agent types
   *
   * @returns Array of write-access agent type identifiers
   */
  getWriteAccessAgents(): string[] {
    return [...this.config.writeAccessAgents];
  }

  /**
   * Gets the current configuration
   *
   * @returns A copy of the current configuration
   */
  getConfig(): FractionalWorktreeConfig {
    return {
      ...this.config,
      readOnlyAgents: [...this.config.readOnlyAgents],
      writeAccessAgents: [...this.config.writeAccessAgents],
    };
  }

  /**
   * Calculates the optimization benefit of fractional worktrees.
   *
   * This method estimates how many worktrees are saved by using
   * the fractional pattern versus allocating one worktree per agent.
   *
   * @param totalAgentsPerSession - Total number of agents in a session
   * @param readOnlyCount - Number of read-only agents
   * @returns Optimization statistics
   */
  calculateOptimizationBenefit(
    totalAgentsPerSession: number,
    readOnlyCount: number
  ): {
    withoutFractional: number;
    withFractional: number;
    worktreesSaved: number;
    reductionPercentage: number;
  } {
    const withoutFractional = totalAgentsPerSession;
    const writeAccessCount = totalAgentsPerSession - readOnlyCount;
    const withFractional = writeAccessCount + 1; // +1 for session worktree

    const worktreesSaved = withoutFractional - withFractional;
    const reductionPercentage =
      withoutFractional > 0 ? (worktreesSaved / withoutFractional) * 100 : 0;

    return {
      withoutFractional,
      withFractional,
      worktreesSaved,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
    };
  }

  /**
   * Normalizes an agent type string for consistent comparison.
   *
   * Converts to lowercase and removes common prefixes/suffixes.
   *
   * @param agentType - The agent type to normalize
   * @returns The normalized agent type
   */
  private normalizeAgentType(agentType: string): string {
    return agentType
      .toLowerCase()
      .replace(/^(eng-|mkt-|hr-|legal-)/, '')
      .replace(/-agent$/, '')
      .trim();
  }
}

export { DEFAULT_READ_ONLY_AGENTS, DEFAULT_WRITE_ACCESS_AGENTS };
