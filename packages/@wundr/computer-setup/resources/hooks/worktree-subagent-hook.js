#!/usr/bin/env node
/**
 * worktree-subagent-hook.js
 *
 * Claude Code hook that automatically creates git worktrees for subagents
 * spawned via the Task tool, enabling isolated parallel development.
 *
 * This hook intercepts Task tool calls and:
 * 1. Creates a dedicated worktree/branch for each subagent
 * 2. Spawns the subagent in the isolated worktree
 * 3. Tracks the worktree for later merge operations
 *
 * Install location: ~/.claude/hooks/worktree-subagent-hook.js
 *
 * Configuration via environment:
 *   CLAUDE_WORKTREE_ENABLED=1       Enable worktree isolation (default: 1)
 *   CLAUDE_WORKTREE_AUTO_MERGE=0    Auto-merge on completion (default: 0)
 *   CLAUDE_WORKTREE_BASE_BRANCH=    Base branch for worktrees (default: current)
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();
const WUNDR_DIR = path.join(HOME, '.wundr');
const WORKTREE_MANAGER_DIR = path.join(WUNDR_DIR, 'resource-manager', 'worktrees');
const WORKTREE_REGISTRY = path.join(WORKTREE_MANAGER_DIR, 'active-worktrees.json');

// Configuration
const CONFIG = {
  enabled: process.env.CLAUDE_WORKTREE_ENABLED !== '0',
  autoMerge: process.env.CLAUDE_WORKTREE_AUTO_MERGE === '1',
  baseBranch: process.env.CLAUDE_WORKTREE_BASE_BRANCH || null,
  maxWorktrees: parseInt(process.env.CLAUDE_MAX_WORKTREES || '200', 10),
};

/**
 * Hook context passed by Claude Code
 */
interface HookContext {
  tool: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  workingDirectory: string;
}

/**
 * Worktree entry in registry
 */
interface WorktreeEntry {
  id: string;
  path: string;
  branch: string;
  agentType: string;
  taskDescription: string;
  parentSession: string;
  baseBranch: string;
  created: string;
  status: 'active' | 'completed' | 'merged' | 'abandoned';
  commits: string[];
}

/**
 * Ensure directories exist
 */
function ensureDirectories(): void {
  if (!fs.existsSync(WORKTREE_MANAGER_DIR)) {
    fs.mkdirSync(WORKTREE_MANAGER_DIR, { recursive: true });
  }
}

/**
 * Load worktree registry
 */
function loadRegistry(): WorktreeEntry[] {
  ensureDirectories();
  if (fs.existsSync(WORKTREE_REGISTRY)) {
    try {
      return JSON.parse(fs.readFileSync(WORKTREE_REGISTRY, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Save worktree registry
 */
function saveRegistry(entries: WorktreeEntry[]): void {
  ensureDirectories();
  fs.writeFileSync(WORKTREE_REGISTRY, JSON.stringify(entries, null, 2));
}

/**
 * Check if we're in a git repository
 */
function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name
 */
function getCurrentBranch(dir: string): string {
  try {
    return execSync('git branch --show-current', { cwd: dir, encoding: 'utf-8' }).trim();
  } catch {
    return 'main';
  }
}

/**
 * Get repository root
 */
function getRepoRoot(dir: string): string {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8' }).trim();
  } catch {
    return dir;
  }
}

/**
 * Generate a unique worktree ID
 */
function generateWorktreeId(agentType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${agentType}-${timestamp}-${random}`;
}

/**
 * Create a worktree for a subagent
 */
function createWorktree(
  repoRoot: string,
  agentType: string,
  taskDescription: string,
  parentSession: string,
  baseBranch: string,
): WorktreeEntry | null {
  const registry = loadRegistry();

  // Check worktree limit
  const activeCount = registry.filter(e => e.status === 'active').length;
  if (activeCount >= CONFIG.maxWorktrees) {
    console.error(`[worktree-hook] Max worktrees (${CONFIG.maxWorktrees}) reached`);
    return null;
  }

  const worktreeId = generateWorktreeId(agentType);
  const branchName = `agents/${agentType}/${worktreeId}`;
  const worktreePath = path.join(repoRoot, '.worktrees', worktreeId);

  try {
    // Create worktrees directory
    const worktreesBase = path.join(repoRoot, '.worktrees');
    if (!fs.existsSync(worktreesBase)) {
      fs.mkdirSync(worktreesBase, { recursive: true });
    }

    // Create the worktree with a new branch
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    // Create metadata file in worktree
    const metadata = {
      id: worktreeId,
      agentType,
      taskDescription,
      parentSession,
      baseBranch,
      created: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(worktreePath, '.agent-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Register the worktree
    const entry: WorktreeEntry = {
      id: worktreeId,
      path: worktreePath,
      branch: branchName,
      agentType,
      taskDescription: taskDescription.substring(0, 200),
      parentSession,
      baseBranch,
      created: new Date().toISOString(),
      status: 'active',
      commits: [],
    };

    registry.push(entry);
    saveRegistry(registry);

    console.log(`[worktree-hook] Created worktree: ${worktreePath}`);
    console.log(`[worktree-hook] Branch: ${branchName}`);

    return entry;
  } catch (error) {
    console.error(`[worktree-hook] Failed to create worktree:`, error);
    return null;
  }
}

/**
 * Mark a worktree as completed
 */
function markWorktreeCompleted(worktreeId: string): void {
  const registry = loadRegistry();
  const entry = registry.find(e => e.id === worktreeId);

  if (entry) {
    entry.status = 'completed';

    // Capture commits made in this worktree
    try {
      const commits = execSync(
        `git log ${entry.baseBranch}..HEAD --oneline`,
        { cwd: entry.path, encoding: 'utf-8' }
      ).trim().split('\n').filter(Boolean);
      entry.commits = commits;
    } catch {
      // Ignore if we can't get commits
    }

    saveRegistry(registry);
    console.log(`[worktree-hook] Marked worktree ${worktreeId} as completed`);
  }
}

/**
 * Pre-tool hook: Intercept Task tool to create worktree
 */
function preToolHook(context: HookContext): {
  proceed: boolean;
  modifiedInput?: Record<string, unknown>;
  worktreeEntry?: WorktreeEntry;
} {
  // Only intercept Task tool
  if (context.tool !== 'Task') {
    return { proceed: true };
  }

  // Check if worktree isolation is enabled
  if (!CONFIG.enabled) {
    return { proceed: true };
  }

  // Check if we're in a git repo
  if (!isGitRepo(context.workingDirectory)) {
    console.log('[worktree-hook] Not in a git repository, skipping worktree isolation');
    return { proceed: true };
  }

  const repoRoot = getRepoRoot(context.workingDirectory);
  const baseBranch = CONFIG.baseBranch || getCurrentBranch(context.workingDirectory);

  // Extract agent type and task description from Task tool input
  const agentType = (context.toolInput.subagent_type as string) || 'general';
  const taskDescription = (context.toolInput.prompt as string) || (context.toolInput.description as string) || '';

  // Create worktree for this subagent
  const worktreeEntry = createWorktree(
    repoRoot,
    agentType,
    taskDescription,
    context.sessionId,
    baseBranch
  );

  if (!worktreeEntry) {
    // Failed to create worktree, proceed without isolation
    return { proceed: true };
  }

  // Modify the task prompt to include worktree instructions
  const modifiedPrompt = `
[WORKTREE ISOLATION ACTIVE]
You are working in an isolated git worktree: ${worktreeEntry.path}
Branch: ${worktreeEntry.branch}
Base branch: ${worktreeEntry.baseBranch}

IMPORTANT:
- All file operations should be relative to: ${worktreeEntry.path}
- Commit your changes frequently with descriptive messages
- When done, your changes will be reviewed for merge into ${worktreeEntry.baseBranch}

ORIGINAL TASK:
${taskDescription}
`;

  return {
    proceed: true,
    modifiedInput: {
      ...context.toolInput,
      prompt: modifiedPrompt,
      // Add worktree path for the subagent to use
      _worktreePath: worktreeEntry.path,
      _worktreeId: worktreeEntry.id,
    },
    worktreeEntry,
  };
}

/**
 * Post-tool hook: Handle worktree completion
 */
function postToolHook(
  context: HookContext,
  result: unknown,
  worktreeEntry?: WorktreeEntry
): void {
  if (context.tool !== 'Task' || !worktreeEntry) {
    return;
  }

  // Mark worktree as completed
  markWorktreeCompleted(worktreeEntry.id);

  // If auto-merge is enabled, trigger merge
  if (CONFIG.autoMerge) {
    console.log(`[worktree-hook] Auto-merge enabled, attempting merge...`);
    try {
      const mergeScript = path.join(HOME, '.wundr', 'scripts', 'worktree-merge.sh');
      if (fs.existsSync(mergeScript)) {
        execSync(`"${mergeScript}" "${worktreeEntry.id}" --auto`, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error(`[worktree-hook] Auto-merge failed:`, error);
    }
  } else {
    console.log(`[worktree-hook] Worktree ${worktreeEntry.id} ready for merge`);
    console.log(`[worktree-hook] Run: wt-merge ${worktreeEntry.id}`);
  }
}

/**
 * Main hook handler
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hookType = args[0]; // 'pre' or 'post'
  const contextJson = args[1];

  if (!hookType || !contextJson) {
    console.error('Usage: worktree-subagent-hook.js <pre|post> <context-json>');
    process.exit(1);
  }

  try {
    const context: HookContext = JSON.parse(contextJson);

    if (hookType === 'pre') {
      const result = preToolHook(context);
      // Output result as JSON for Claude Code to consume
      console.log(JSON.stringify(result));
    } else if (hookType === 'post') {
      const resultJson = args[2];
      const worktreeEntryJson = args[3];
      const result = resultJson ? JSON.parse(resultJson) : null;
      const worktreeEntry = worktreeEntryJson ? JSON.parse(worktreeEntryJson) : null;
      postToolHook(context, result, worktreeEntry);
    }
  } catch (error) {
    console.error('[worktree-hook] Error:', error);
    process.exit(1);
  }
}

// Export for use as module
export { preToolHook, postToolHook, createWorktree, markWorktreeCompleted, loadRegistry };

// Run if executed directly
main().catch(console.error);
