/**
 * Type definitions for Worktree Manager module
 * Manages git worktree lifecycle, fractional access patterns, and resource monitoring
 *
 * @module worktree-manager/types
 */

// ============================================================================
// Worktree Status & Lifecycle
// ============================================================================

/**
 * Status of a worktree instance
 */
export type WorktreeStatus =
  | 'pending'
  | 'creating'
  | 'active'
  | 'paused'
  | 'syncing'
  | 'cleanup'
  | 'error'
  | 'destroyed';

/**
 * Represents a worktree lifecycle instance tracked by the manager
 */
export interface WorktreeLifecycle {
  /** Unique identifier for the associated task */
  taskId: string;
  /** Git branch name for this worktree */
  branchName: string;
  /** Absolute path to the worktree directory */
  worktreePath: string;
  /** Session identifier that owns this worktree */
  sessionId: string;
  /** Timestamp when the worktree was created */
  createdAt: Date;
  /** Current status of the worktree */
  status: WorktreeStatus;
  /** Optional timestamp when the worktree was last accessed */
  lastAccessedAt?: Date;
  /** Optional error message if status is 'error' */
  errorMessage?: string;
  /** Parent worktree path (for sub-agent worktrees) */
  parentWorktreePath?: string;
  /** Metadata for tracking and debugging */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Hierarchical Strategy Configuration
// ============================================================================

/**
 * Path pattern configuration for worktree directories
 */
export interface WorktreePathPattern {
  /** Base directory path for worktrees */
  basePath: string;
  /** Pattern template for generating worktree paths (supports {taskId}, {sessionId}, {branch}) */
  pathTemplate: string;
  /** Maximum number of worktrees allowed in this path */
  maxWorktrees: number;
}

/**
 * Hierarchical strategy for organizing worktrees at different levels
 */
export interface HierarchicalStrategy {
  /** Configuration for session-level worktrees (Tier 2) */
  sessionWorktrees: WorktreePathPattern;
  /** Configuration for sub-agent worktrees (Tier 3) */
  subAgentWorktrees: WorktreePathPattern;
}

/**
 * Complete worktree configuration
 */
export interface WorktreeConfig {
  /** Enable or disable the worktree manager */
  enabled: boolean;
  /** Hierarchical strategy for worktree organization */
  hierarchicalStrategy: HierarchicalStrategy;
  /** Default branch to use when creating worktrees */
  defaultBranch: string;
  /** Timeout for worktree operations in milliseconds */
  operationTimeoutMs: number;
  /** Whether to auto-cleanup stale worktrees */
  autoCleanup: boolean;
  /** Maximum age in milliseconds before a worktree is considered stale */
  staleThresholdMs: number;
  /** Git remote name for sync operations */
  gitRemote: string;
  /** Enable verbose logging */
  verbose: boolean;
}

// ============================================================================
// Fractional Worktree Pattern (ccswitch)
// ============================================================================

/**
 * Agent access level for fractional worktree pattern
 */
export type AgentAccessLevel = 'read' | 'write' | 'admin';

/**
 * Agent identification for access control
 */
export interface AgentIdentifier {
  /** Unique agent identifier */
  agentId: string;
  /** Agent type (e.g., 'session-manager', 'sub-agent', 'reviewer') */
  agentType: string;
  /** Session ID the agent belongs to */
  sessionId: string;
}

/**
 * Fractional worktree pattern configuration
 * Enables read-only access for some agents while others have write access
 */
export interface FractionalWorktreePattern {
  /** Whether fractional access is enabled */
  enabled: boolean;
  /** Agents with read-only access to worktrees */
  readOnlyAgents: AgentIdentifier[];
  /** Agents with write access to worktrees */
  writeAccessAgents: AgentIdentifier[];
  /** Default access level for unspecified agents */
  defaultAccessLevel: AgentAccessLevel;
  /** Whether to enforce access control (false = log only) */
  enforceAccess: boolean;
  /** Patterns for files that are always read-only regardless of agent */
  globalReadOnlyPatterns: string[];
  /** Patterns for files that require admin access */
  adminOnlyPatterns: string[];
}

// ============================================================================
// Resource Limits & Monitoring
// ============================================================================

/**
 * System resource limits for worktree operations
 */
export interface ResourceLimits {
  /** Maximum number of file descriptors to use */
  fileDescriptors: number;
  /** Minimum required disk space in GB */
  diskSpaceMinGB: number;
  /** Maximum number of worktrees per machine */
  maxWorktreesPerMachine: number;
  /** Maximum memory usage in MB for worktree operations */
  maxMemoryMB?: number;
  /** Maximum CPU usage percentage for background operations */
  maxCpuPercent?: number;
}

/**
 * Current resource usage snapshot
 */
export interface ResourceUsage {
  /** Current number of file descriptors in use */
  fileDescriptorsUsed: number;
  /** Available disk space in GB */
  diskSpaceAvailableGB: number;
  /** Current number of active worktrees */
  activeWorktrees: number;
  /** Current memory usage in MB */
  memoryUsedMB: number;
  /** Current CPU usage percentage */
  cpuUsagePercent: number;
  /** Timestamp of this snapshot */
  timestamp: Date;
}

/**
 * Resource monitor configuration
 */
export interface ResourceMonitorConfig {
  /** Polling interval for resource checks in milliseconds */
  pollIntervalMs: number;
  /** Resource limits to enforce */
  limits: ResourceLimits;
  /** Warning thresholds as percentage of limits (0.0 - 1.0) */
  warningThreshold: number;
  /** Critical thresholds as percentage of limits (0.0 - 1.0) */
  criticalThreshold: number;
  /** Enable automatic resource reclamation when critical */
  autoReclaim: boolean;
}

/**
 * Resource alert severity
 */
export type ResourceAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Resource alert event
 */
export interface ResourceAlert {
  /** Type of resource that triggered the alert */
  resourceType: 'disk' | 'memory' | 'cpu' | 'fileDescriptors' | 'worktreeCount';
  /** Alert severity level */
  severity: ResourceAlertSeverity;
  /** Current value of the resource */
  currentValue: number;
  /** Limit value for the resource */
  limitValue: number;
  /** Human-readable message */
  message: string;
  /** Timestamp of the alert */
  timestamp: Date;
}

// ============================================================================
// Worktree Sync Configuration
// ============================================================================

/**
 * Sync strategy for worktree updates
 */
export type SyncStrategy = 'merge' | 'rebase' | 'reset';

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'ours' | 'theirs' | 'manual' | 'abort';

/**
 * Configuration for worktree synchronization
 */
export interface WorktreeSyncConfig {
  /** Enable automatic sync */
  autoSync: boolean;
  /** Sync interval in milliseconds */
  syncIntervalMs: number;
  /** Strategy for applying upstream changes */
  syncStrategy: SyncStrategy;
  /** How to handle merge conflicts */
  conflictResolution: ConflictResolution;
  /** Branches to sync from (usually main/master) */
  syncFromBranches: string[];
  /** Whether to push changes after sync */
  pushAfterSync: boolean;
  /** Maximum number of sync retries on failure */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** Worktree path that was synced */
  worktreePath: string;
  /** Strategy that was used */
  strategy: SyncStrategy;
  /** Commits that were applied */
  appliedCommits: string[];
  /** Files that had conflicts */
  conflictedFiles: string[];
  /** How conflicts were resolved */
  conflictResolution?: ConflictResolution;
  /** Error message if unsuccessful */
  errorMessage?: string;
  /** Duration of sync operation in milliseconds */
  durationMs: number;
  /** Timestamp of sync completion */
  timestamp: Date;
}

// ============================================================================
// Cleanup Configuration
// ============================================================================

/**
 * Cleanup trigger type
 */
export type CleanupTrigger =
  | 'manual'
  | 'stale'
  | 'resource'
  | 'error'
  | 'session-end';

/**
 * Options for worktree cleanup operations
 */
export interface CleanupOptions {
  /** Force cleanup even if worktree has uncommitted changes */
  force: boolean;
  /** Delete the associated branch after cleanup */
  deleteBranch: boolean;
  /** Archive worktree contents before deletion */
  archive: boolean;
  /** Archive destination path (if archive is true) */
  archivePath?: string;
  /** Cleanup worktrees older than this threshold (milliseconds) */
  staleThresholdMs?: number;
  /** Only cleanup worktrees in specific statuses */
  statusFilter?: WorktreeStatus[];
  /** What triggered this cleanup */
  trigger: CleanupTrigger;
  /** Dry run - report what would be cleaned without actually cleaning */
  dryRun: boolean;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Worktrees that were successfully cleaned */
  cleaned: WorktreeLifecycle[];
  /** Worktrees that failed cleanup */
  failed: Array<{
    worktree: WorktreeLifecycle;
    reason: string;
  }>;
  /** Worktrees that were skipped */
  skipped: Array<{
    worktree: WorktreeLifecycle;
    reason: string;
  }>;
  /** Total disk space reclaimed in bytes */
  diskReclaimedBytes: number;
  /** Duration of cleanup operation in milliseconds */
  durationMs: number;
  /** Timestamp of cleanup completion */
  timestamp: Date;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the worktree manager
 */
export interface WorktreeManagerEvents {
  /** Emitted when a worktree is created */
  'worktree:created': WorktreeLifecycle;
  /** Emitted when a worktree status changes */
  'worktree:status-changed': {
    worktree: WorktreeLifecycle;
    previousStatus: WorktreeStatus;
  };
  /** Emitted when a worktree is destroyed */
  'worktree:destroyed': WorktreeLifecycle;
  /** Emitted when a sync operation completes */
  'sync:completed': SyncResult;
  /** Emitted when cleanup completes */
  'cleanup:completed': CleanupResult;
  /** Emitted when a resource alert is triggered */
  'resource:alert': ResourceAlert;
  /** Emitted on any error */
  error: { operation: string; error: Error; context?: Record<string, unknown> };
}

// ============================================================================
// Manager Configuration Defaults
// ============================================================================

/**
 * Default configuration values for the worktree manager
 */
export const DEFAULT_WORKTREE_CONFIG: WorktreeConfig = {
  enabled: true,
  hierarchicalStrategy: {
    sessionWorktrees: {
      basePath: '.worktrees/sessions',
      pathTemplate: '{basePath}/{sessionId}/{taskId}',
      maxWorktrees: 10,
    },
    subAgentWorktrees: {
      basePath: '.worktrees/agents',
      pathTemplate: '{basePath}/{sessionId}/{agentId}/{taskId}',
      maxWorktrees: 50,
    },
  },
  defaultBranch: 'main',
  operationTimeoutMs: 60000,
  autoCleanup: true,
  staleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
  gitRemote: 'origin',
  verbose: false,
};

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  fileDescriptors: 1024,
  diskSpaceMinGB: 5,
  maxWorktreesPerMachine: 20,
  maxMemoryMB: 2048,
  maxCpuPercent: 50,
};

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: WorktreeSyncConfig = {
  autoSync: false,
  syncIntervalMs: 300000, // 5 minutes
  syncStrategy: 'rebase',
  conflictResolution: 'manual',
  syncFromBranches: ['main', 'master'],
  pushAfterSync: false,
  maxRetries: 3,
  retryDelayMs: 5000,
};

/**
 * Default cleanup options
 */
export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  force: false,
  deleteBranch: false,
  archive: false,
  trigger: 'manual',
  dryRun: false,
};
