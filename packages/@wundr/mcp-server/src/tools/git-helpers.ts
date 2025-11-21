/**
 * Git Utility Functions for Git-Worktree MCP Integration
 *
 * Provides low-level git operations and validation utilities
 * used by the git-worktree MCP tool handlers.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { ExecSyncOptionsWithStringEncoding } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export interface GitRepositoryInfo {
  isGitRepo: boolean;
  rootPath: string | null;
  currentBranch: string | null;
  hasUncommittedChanges: boolean;
  error?: string;
}

export interface WorktreeInfo {
  path: string;
  commit: string;
  branch: string | null;
  isDetached: boolean;
}

export interface WorktreeMetadata {
  worktree_name: string;
  agent_type: string;
  task_id: string;
  branch: string;
  base_branch: string;
  created: string;
  repo_root: string;
}

export interface RegistryEntry {
  name: string;
  path: string;
  branch: string;
  agent: string;
  task: string;
  base: string;
  created: string;
  status: 'active' | 'merged' | 'cleaned';
  cleaned?: string;
}

export interface BranchInfo {
  name: string;
  isMerged: boolean;
  commitsAhead: number;
  exists: boolean;
}

export interface DiskSpaceInfo {
  availableKB: number;
  requiredKB: number;
  hasEnoughSpace: boolean;
}

export interface GitOperationResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const WORKTREE_BASE_DIR = '.worktrees';
const WORKTREE_REGISTRY_FILE = '.worktree-registry.jsonl';
const AGENT_METADATA_FILE = '.agent-metadata.json';
const MIN_DISK_SPACE_KB = 100 * 1024; // 100MB minimum

const EXEC_OPTIONS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024, // 10MB buffer
};

// ============================================================================
// Core Git Functions
// ============================================================================

/**
 * Execute a git command and return the output
 */
export function execGit(command: string, cwd?: string): GitOperationResult {
  try {
    const options: ExecSyncOptionsWithStringEncoding = {
      ...EXEC_OPTIONS,
      cwd: cwd || process.cwd(),
    };
    const output = execSync(`git ${command}`, options).trim();
    return { success: true, output };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, output: '', error: errorMessage };
  }
}

/**
 * Get comprehensive information about the current git repository
 */
export function getRepositoryInfo(cwd?: string): GitRepositoryInfo {
  const workDir = cwd || process.cwd();

  const rootResult = execGit('rev-parse --show-toplevel', workDir);
  if (!rootResult.success) {
    return {
      isGitRepo: false,
      rootPath: null,
      currentBranch: null,
      hasUncommittedChanges: false,
      error: 'Not a git repository',
    };
  }

  const rootPath = rootResult.output;
  const branchResult = execGit('branch --show-current', rootPath);
  const currentBranch = branchResult.success ? branchResult.output : null;

  const statusResult = execGit('status --porcelain', rootPath);
  const hasUncommittedChanges = statusResult.success && statusResult.output.length > 0;

  return {
    isGitRepo: true,
    rootPath,
    currentBranch,
    hasUncommittedChanges,
  };
}

/**
 * Get the worktree base directory path
 */
export function getWorktreeBasePath(repoRoot: string): string {
  return path.join(repoRoot, WORKTREE_BASE_DIR);
}

/**
 * Get the worktree registry file path
 */
export function getRegistryPath(repoRoot: string): string {
  return path.join(getWorktreeBasePath(repoRoot), WORKTREE_REGISTRY_FILE);
}

/**
 * Generate worktree name from agent type and task ID
 */
export function generateWorktreeName(agentType: string, taskId: string): string {
  return `${agentType}-${taskId}`;
}

/**
 * Generate branch name for agent worktree
 */
export function generateBranchName(agentType: string, taskId: string): string {
  return `agents/${agentType}/${taskId}`;
}

// ============================================================================
// Branch Operations
// ============================================================================

/**
 * Check if a branch exists
 */
export function branchExists(branchName: string, repoRoot: string): boolean {
  const result = execGit(`rev-parse --verify "${branchName}"`, repoRoot);
  return result.success;
}

/**
 * Check if a branch is merged into target branch
 */
export function isBranchMerged(branchName: string, targetBranch: string, repoRoot: string): boolean {
  const result = execGit(`branch --merged "${targetBranch}"`, repoRoot);
  if (!result.success) {
return false;
}

  const mergedBranches = result.output.split('\n').map(b => b.trim().replace(/^\*?\s*/, ''));
  return mergedBranches.includes(branchName);
}

/**
 * Get comprehensive branch information
 */
export function getBranchInfo(branchName: string, targetBranch: string, repoRoot: string): BranchInfo {
  const exists = branchExists(branchName, repoRoot);

  if (!exists) {
    return {
      name: branchName,
      isMerged: false,
      commitsAhead: 0,
      exists: false,
    };
  }

  const isMerged = isBranchMerged(branchName, targetBranch, repoRoot);

  const countResult = execGit(`rev-list --count "${targetBranch}..${branchName}"`, repoRoot);
  const commitsAhead = countResult.success ? parseInt(countResult.output, 10) : 0;

  return {
    name: branchName,
    isMerged,
    commitsAhead,
    exists: true,
  };
}

/**
 * Check if a branch is in use by any worktree
 */
export function isBranchInWorktree(branchName: string, repoRoot: string): boolean {
  const result = execGit('worktree list --porcelain', repoRoot);
  if (!result.success) {
return false;
}

  return result.output.includes(`branch refs/heads/${branchName}`);
}

/**
 * Delete a branch (safely or forced)
 */
export function deleteBranch(branchName: string, repoRoot: string, force: boolean = false): GitOperationResult {
  const flag = force ? '-D' : '-d';
  return execGit(`branch ${flag} "${branchName}"`, repoRoot);
}

/**
 * Get list of merged agent branches
 */
export function getMergedAgentBranches(targetBranch: string, repoRoot: string): string[] {
  const result = execGit(`branch --merged "${targetBranch}"`, repoRoot);
  if (!result.success) {
return [];
}

  return result.output
    .split('\n')
    .map(b => b.trim().replace(/^\*?\s*/, ''))
    .filter(b => b.startsWith('agents/'));
}

// ============================================================================
// Worktree Operations
// ============================================================================

/**
 * List all git worktrees
 */
export function listWorktrees(repoRoot: string): WorktreeInfo[] {
  const result = execGit('worktree list --porcelain', repoRoot);
  if (!result.success) {
return [];
}

  const worktrees: WorktreeInfo[] = [];
  const entries = result.output.split('\n\n').filter(Boolean);

  for (const entry of entries) {
    const lines = entry.split('\n');
    const worktreePath = lines.find(l => l.startsWith('worktree '))?.replace('worktree ', '') || '';
    const commit = lines.find(l => l.startsWith('HEAD '))?.replace('HEAD ', '') || '';
    const branchLine = lines.find(l => l.startsWith('branch '));
    const isDetached = lines.some(l => l === 'detached');

    const branch = branchLine
      ? branchLine.replace('branch refs/heads/', '')
      : null;

    worktrees.push({
      path: worktreePath,
      commit,
      branch,
      isDetached,
    });
  }

  return worktrees;
}

/**
 * Check if a worktree exists at the given path
 */
export function worktreeExists(worktreePath: string, repoRoot: string): boolean {
  const worktrees = listWorktrees(repoRoot);
  return worktrees.some(wt => wt.path === worktreePath);
}

/**
 * Check if worktree directory exists on disk
 */
export function worktreeDirectoryExists(worktreePath: string): boolean {
  return fs.existsSync(worktreePath) && fs.statSync(worktreePath).isDirectory();
}

/**
 * Create a new worktree
 */
export function createWorktree(
  worktreePath: string,
  branchName: string,
  baseBranch: string,
  repoRoot: string,
): GitOperationResult {
  return execGit(
    `worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`,
    repoRoot,
  );
}

/**
 * Remove a worktree
 */
export function removeWorktree(worktreePath: string, repoRoot: string, force: boolean = false): GitOperationResult {
  const forceFlag = force ? '--force' : '';
  return execGit(`worktree remove "${worktreePath}" ${forceFlag}`.trim(), repoRoot);
}

/**
 * Prune stale worktree entries
 */
export function pruneWorktrees(repoRoot: string, dryRun: boolean = false): GitOperationResult {
  const dryRunFlag = dryRun ? '--dry-run' : '';
  return execGit(`worktree prune ${dryRunFlag}`.trim(), repoRoot);
}

/**
 * Get uncommitted changes in a worktree
 */
export function getUncommittedChanges(worktreePath: string): string[] {
  const result = execGit('status --porcelain', worktreePath);
  if (!result.success || !result.output) {
return [];
}

  return result.output.split('\n').filter(Boolean);
}

// ============================================================================
// Registry Operations
// ============================================================================

/**
 * Initialize the worktree registry if it doesn't exist
 */
export function initializeRegistry(repoRoot: string): void {
  const registryPath = getRegistryPath(repoRoot);
  const baseDir = getWorktreeBasePath(repoRoot);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  if (!fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, '', 'utf-8');
  }
}

/**
 * Read all entries from the worktree registry
 */
export function readRegistry(repoRoot: string): RegistryEntry[] {
  const registryPath = getRegistryPath(repoRoot);

  if (!fs.existsSync(registryPath)) {
    return [];
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  const entries: RegistryEntry[] = [];

  for (const line of content.split('\n').filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Add an entry to the worktree registry
 */
export function addRegistryEntry(repoRoot: string, entry: RegistryEntry): void {
  const registryPath = getRegistryPath(repoRoot);
  initializeRegistry(repoRoot);

  fs.appendFileSync(registryPath, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * Update a registry entry's status
 */
export function updateRegistryStatus(
  repoRoot: string,
  worktreeName: string,
  status: RegistryEntry['status'],
): void {
  const registryPath = getRegistryPath(repoRoot);
  const entries = readRegistry(repoRoot);

  const timestamp = new Date().toISOString();
  const updatedEntries = entries.map(entry => {
    if (entry.name === worktreeName) {
      return {
        ...entry,
        status,
        ...(status === 'cleaned' ? { cleaned: timestamp } : {}),
      };
    }
    return entry;
  });

  fs.writeFileSync(
    registryPath,
    updatedEntries.map(e => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
}

/**
 * Get registry statistics
 */
export function getRegistryStats(repoRoot: string): {
  total: number;
  active: number;
  merged: number;
  cleaned: number;
  byAgent: Record<string, number>;
} {
  const entries = readRegistry(repoRoot);

  const stats = {
    total: entries.length,
    active: 0,
    merged: 0,
    cleaned: 0,
    byAgent: {} as Record<string, number>,
  };

  for (const entry of entries) {
    if (entry.status === 'active') {
stats.active++;
}
    if (entry.status === 'merged') {
stats.merged++;
}
    if (entry.status === 'cleaned') {
stats.cleaned++;
}

    stats.byAgent[entry.agent] = (stats.byAgent[entry.agent] || 0) + 1;
  }

  return stats;
}

// ============================================================================
// Metadata Operations
// ============================================================================

/**
 * Create agent metadata file in worktree
 */
export function createAgentMetadata(worktreePath: string, metadata: WorktreeMetadata): void {
  const metadataPath = path.join(worktreePath, AGENT_METADATA_FILE);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Read agent metadata from worktree
 */
export function readAgentMetadata(worktreePath: string): WorktreeMetadata | null {
  const metadataPath = path.join(worktreePath, AGENT_METADATA_FILE);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// Disk Space Operations
// ============================================================================

/**
 * Check available disk space
 */
export function checkDiskSpace(targetPath: string, requiredKB: number = MIN_DISK_SPACE_KB): DiskSpaceInfo {
  try {
    const result = execSync(`df -k "${targetPath}" | tail -1 | awk '{print $4}'`, EXEC_OPTIONS);
    const availableKB = parseInt(result.trim(), 10);

    return {
      availableKB,
      requiredKB,
      hasEnoughSpace: availableKB >= requiredKB,
    };
  } catch {
    // If we can't check, assume there's enough space
    return {
      availableKB: -1,
      requiredKB,
      hasEnoughSpace: true,
    };
  }
}

/**
 * Get directory size in human-readable format
 */
export function getDirectorySize(dirPath: string): string {
  try {
    const result = execSync(`du -sh "${dirPath}" 2>/dev/null | cut -f1`, EXEC_OPTIONS);
    return result.trim();
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that we're in a git repository
 */
export function validateGitRepository(cwd?: string): { valid: boolean; repoRoot: string | null; error?: string } {
  const info = getRepositoryInfo(cwd);

  if (!info.isGitRepo) {
    return {
      valid: false,
      repoRoot: null,
      error: 'Not a git repository. Please run this command from within a git repository.',
    };
  }

  return {
    valid: true,
    repoRoot: info.rootPath,
  };
}

/**
 * Validate agent type and task ID format
 */
export function validateWorktreeParams(
  agentType: string,
  taskId: string,
): { valid: boolean; error?: string } {
  if (!agentType || typeof agentType !== 'string') {
    return { valid: false, error: 'Agent type is required and must be a non-empty string' };
  }

  if (!taskId || typeof taskId !== 'string') {
    return { valid: false, error: 'Task ID is required and must be a non-empty string' };
  }

  // Validate agent type format (alphanumeric with hyphens)
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(agentType)) {
    return {
      valid: false,
      error: 'Agent type must start with a letter and contain only letters, numbers, and hyphens',
    };
  }

  // Validate task ID format (alphanumeric with hyphens and underscores)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(taskId)) {
    return {
      valid: false,
      error: 'Task ID must start with an alphanumeric character and contain only letters, numbers, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Validate merge strategy
 */
export function validateMergeStrategy(strategy: string): { valid: boolean; error?: string } {
  const validStrategies = ['no-ff', 'squash', 'rebase'];

  if (!validStrategies.includes(strategy)) {
    return {
      valid: false,
      error: `Invalid merge strategy '${strategy}'. Valid strategies are: ${validStrategies.join(', ')}`,
    };
  }

  return { valid: true };
}
