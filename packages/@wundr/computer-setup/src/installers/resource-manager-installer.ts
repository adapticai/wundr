/**
 * Resource Manager Installer - Global Claude Code Resource Management
 *
 * Installs and configures the resource manager layer that wraps Claude Code:
 * - Session pool management for subagent coordination
 * - Git worktree isolation for parallel agent work
 * - Background task management and cleanup
 * - launchd/systemd daemon registration
 *
 * This ensures that when computer-setup is re-run, missing components
 * are properly added (idempotent installation).
 */

import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';

const logger = new Logger({ name: 'ResourceManagerInstaller' });

/**
 * Configuration for Resource Manager installation
 */
export interface ResourceManagerConfig {
  /** Maximum concurrent Claude sessions */
  readonly maxConcurrentSessions?: number;
  /** Maximum worktrees per machine */
  readonly maxWorktrees?: number;
  /** Session timeout in milliseconds */
  readonly sessionTimeout?: number;
  /** Enable auto-start daemon on boot */
  readonly enableDaemon?: boolean;
  /** Stale task cleanup interval in milliseconds */
  readonly cleanupInterval?: number;
}

/**
 * Result of Resource Manager installation
 */
export interface ResourceManagerInstallResult {
  readonly success: boolean;
  readonly installedComponents: string[];
  readonly skippedComponents: string[];
  readonly errors: Error[];
  readonly warnings: string[];
  readonly daemonStatus: 'running' | 'stopped' | 'not_installed';
}

/**
 * Resource Manager Installer class
 */
export class ResourceManagerInstaller extends EventEmitter {
  readonly name = 'resource-manager';
  private readonly homeDir: string;
  private readonly wundrDir: string;
  private readonly claudeDir: string;
  private readonly config: Required<ResourceManagerConfig>;

  constructor(config: ResourceManagerConfig = {}) {
    super();
    this.homeDir = os.homedir();
    this.wundrDir = path.join(this.homeDir, '.wundr');
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.config = {
      maxConcurrentSessions: config.maxConcurrentSessions ?? 10,
      maxWorktrees: config.maxWorktrees ?? 200,
      sessionTimeout: config.sessionTimeout ?? 300000, // 5 minutes
      enableDaemon: config.enableDaemon ?? true,
      cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute
    };
  }

  /**
   * Check if Resource Manager is supported on current platform
   */
  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  /**
   * Check if Resource Manager is fully installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const checks = await Promise.all([
        this.checkWorktreeScripts(),
        this.checkResourceManagerWrapper(),
        this.checkSessionPoolConfig(),
      ]);
      return checks.every(Boolean);
    } catch {
      return false;
    }
  }

  /**
   * Get Resource Manager version
   */
  async getVersion(): Promise<string | null> {
    try {
      const configPath = path.join(
        this.wundrDir,
        'resource-manager',
        'config.json'
      );
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      return config.version || '1.0.0';
    } catch {
      return null;
    }
  }

  /**
   * Install Resource Manager (void return for BaseInstaller interface)
   */
  async install(
    _profile?: DeveloperProfile,
    _platform?: SetupPlatform
  ): Promise<void> {
    const result = await this.installWithResult();
    if (!result.success) {
      throw new Error(
        result.errors.length > 0
          ? result.errors[0].message
          : 'Resource Manager installation failed'
      );
    }
  }

  /**
   * Install Resource Manager with detailed result
   */
  async installWithResult(): Promise<ResourceManagerInstallResult> {
    const installedComponents: string[] = [];
    const skippedComponents: string[] = [];
    const errors: Error[] = [];
    const warnings: string[] = [];
    let daemonStatus: 'running' | 'stopped' | 'not_installed' = 'not_installed';

    try {
      logger.info('Installing Resource Manager...');
      this.emit('progress', { step: 'Creating directories', percentage: 5 });

      // 1. Create directory structure
      await this.createDirectoryStructure();
      installedComponents.push('directory-structure');

      this.emit('progress', {
        step: 'Installing worktree scripts',
        percentage: 15,
      });

      // 2. Install worktree scripts (idempotent)
      const worktreeResult = await this.installWorktreeScripts();
      if (worktreeResult.installed) {
        installedComponents.push('worktree-scripts');
      } else {
        skippedComponents.push('worktree-scripts');
      }

      this.emit('progress', {
        step: 'Creating resource manager wrapper',
        percentage: 30,
      });

      // 3. Install resource manager wrapper script
      const wrapperResult = await this.installResourceManagerWrapper();
      if (wrapperResult.installed) {
        installedComponents.push('resource-manager-wrapper');
      } else {
        skippedComponents.push('resource-manager-wrapper');
      }

      this.emit('progress', {
        step: 'Configuring session pool',
        percentage: 45,
      });

      // 4. Install session pool configuration
      const poolResult = await this.installSessionPoolConfig();
      if (poolResult.installed) {
        installedComponents.push('session-pool-config');
      } else {
        skippedComponents.push('session-pool-config');
      }

      this.emit('progress', {
        step: 'Installing daemon service',
        percentage: 60,
      });

      // 5. Install daemon service (launchd/systemd)
      if (this.config.enableDaemon) {
        const daemonResult = await this.installDaemonService();
        if (daemonResult.installed) {
          installedComponents.push('daemon-service');
          daemonStatus = daemonResult.running ? 'running' : 'stopped';
        } else {
          if (daemonResult.error) {
            warnings.push(`Daemon installation skipped: ${daemonResult.error}`);
          }
          skippedComponents.push('daemon-service');
        }
      }

      this.emit('progress', {
        step: 'Installing cleanup utilities',
        percentage: 65,
      });

      // 6. Install cleanup utilities
      const cleanupResult = await this.installCleanupUtilities();
      if (cleanupResult.installed) {
        installedComponents.push('cleanup-utilities');
      } else {
        skippedComponents.push('cleanup-utilities');
      }

      this.emit('progress', {
        step: 'Installing worktree hooks',
        percentage: 75,
      });

      // 7. Install worktree subagent hook (for automatic worktree isolation)
      const hookResult = await this.installWorktreeHooks();
      if (hookResult.installed) {
        installedComponents.push('worktree-hooks');
      } else {
        skippedComponents.push('worktree-hooks');
      }

      this.emit('progress', {
        step: 'Installing merge utilities',
        percentage: 82,
      });

      // 8. Install worktree merge utilities
      const mergeResult = await this.installMergeUtilities();
      if (mergeResult.installed) {
        installedComponents.push('merge-utilities');
      } else {
        skippedComponents.push('merge-utilities');
      }

      this.emit('progress', {
        step: 'Installing orchestrator manager',
        percentage: 88,
      });

      // 9. Install orchestrator worktree manager
      const orchestratorResult =
        await this.installOrchestratorWorktreeManager();
      if (orchestratorResult.installed) {
        installedComponents.push('orchestrator-worktree-manager');
      } else {
        skippedComponents.push('orchestrator-worktree-manager');
      }

      this.emit('progress', {
        step: 'Configuring shell integration',
        percentage: 95,
      });

      // 10. Add shell integration
      await this.installShellIntegration();
      installedComponents.push('shell-integration');

      this.emit('progress', { step: 'Installation complete', percentage: 100 });

      logger.info('Resource Manager installed successfully');
      logger.info(`  Installed: ${installedComponents.join(', ')}`);
      if (skippedComponents.length > 0) {
        logger.info(
          `  Skipped (already present): ${skippedComponents.join(', ')}`
        );
      }

      return {
        success: true,
        installedComponents,
        skippedComponents,
        errors,
        warnings,
        daemonStatus,
      };
    } catch (error) {
      logger.error('Resource Manager installation failed:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        installedComponents,
        skippedComponents,
        errors,
        warnings,
        daemonStatus,
      };
    }
  }

  /**
   * Validate Resource Manager installation
   */
  async validate(): Promise<boolean> {
    try {
      const checks = [
        await this.checkWorktreeScripts(),
        await this.checkResourceManagerWrapper(),
        await this.checkSessionPoolConfig(),
      ];

      const allValid = checks.every(Boolean);
      if (!allValid) {
        logger.warn(
          'Resource Manager validation failed - some components missing'
        );
      }
      return allValid;
    } catch (error) {
      logger.error('Validation failed:', error);
      return false;
    }
  }

  /**
   * Get installation steps for the orchestrator
   */
  getSteps(_profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'install-resource-manager',
        name: 'Install Resource Manager',
        description:
          'Install session pooling, worktree isolation, and daemon services',
        category: 'ai',
        required: false,
        dependencies: ['install-claude', 'install-orchestrator-daemon'],
        estimatedTime: 60,
        validator: () => this.validate(),
        installer: async () => {
          await this.install();
        },
      },
    ];
  }

  // ============================================================================
  // Private Methods - Directory Setup
  // ============================================================================

  private async createDirectoryStructure(): Promise<void> {
    const directories = [
      path.join(this.wundrDir, 'resource-manager'),
      path.join(this.wundrDir, 'resource-manager', 'sessions'),
      path.join(this.wundrDir, 'resource-manager', 'logs'),
      path.join(this.wundrDir, 'resource-manager', 'worktrees'),
      path.join(this.wundrDir, 'scripts'),
      path.join(this.claudeDir, 'scripts'),
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // ============================================================================
  // Private Methods - Worktree Scripts
  // ============================================================================

  private async checkWorktreeScripts(): Promise<boolean> {
    const scripts = [
      'create-agent-worktree.sh',
      'cleanup-worktree.sh',
      'worktree-status.sh',
    ];
    const wundrScriptsDir = path.join(this.wundrDir, 'scripts');

    for (const script of scripts) {
      const exists = fsSync.existsSync(path.join(wundrScriptsDir, script));
      if (!exists) return false;
    }
    return true;
  }

  private async installWorktreeScripts(): Promise<{ installed: boolean }> {
    const scriptsToInstall = [
      'create-agent-worktree.sh',
      'cleanup-worktree.sh',
      'worktree-status.sh',
    ];

    const wundrScriptsDir = path.join(this.wundrDir, 'scripts');
    const claudeScriptsDir = path.join(this.claudeDir, 'scripts');

    // Try to find source scripts (bundled resources or project worktree scripts)
    const possibleSourceDirs = [
      // Bundled with npm package
      path.resolve(__dirname, '../../resources/worktree-scripts'),
      // Project-local worktree scripts
      path.join(process.cwd(), '.worktree-scripts'),
      // Wundr monorepo worktree scripts
      path.join(this.homeDir, 'wundr', '.worktree-scripts'),
      // Fallback relative path
      path.resolve(__dirname, '../../../..', '.worktree-scripts'),
    ];

    let sourceDir: string | null = null;
    for (const dir of possibleSourceDirs) {
      if (fsSync.existsSync(path.join(dir, 'create-agent-worktree.sh'))) {
        sourceDir = dir;
        break;
      }
    }

    let installed = false;

    if (sourceDir) {
      // Copy from existing source
      for (const script of scriptsToInstall) {
        const src = path.join(sourceDir, script);
        const destWundr = path.join(wundrScriptsDir, script);
        const destClaude = path.join(claudeScriptsDir, script);

        if (fsSync.existsSync(src)) {
          // Copy to both locations
          await fs.copyFile(src, destWundr);
          await fs.copyFile(src, destClaude);
          await fs.chmod(destWundr, 0o755);
          await fs.chmod(destClaude, 0o755);
          installed = true;
          logger.info(`Installed ${script}`);
        }
      }
    } else {
      // Generate scripts if source not found
      logger.info('Source worktree scripts not found, generating...');
      await this.generateWorktreeScripts(wundrScriptsDir);
      await this.generateWorktreeScripts(claudeScriptsDir);
      installed = true;
    }

    return { installed };
  }

  private async generateWorktreeScripts(targetDir: string): Promise<void> {
    // Create agent worktree script
    const createWorktreeScript = `#!/bin/bash
# create-agent-worktree.sh - Creates isolated git worktree for Claude Code subagent
# Installed by wundr computer-setup resource-manager

set -euo pipefail

AGENT_TYPE="\${1}"
TASK_ID="\${2}"
BASE_BRANCH="\${3:-master}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="\${REPO_ROOT}/.worktrees"
WORKTREE_NAME="\${AGENT_TYPE}-\${TASK_ID}"
WORKTREE_PATH="\${WORKTREE_BASE}/\${WORKTREE_NAME}"
BRANCH_NAME="agents/\${AGENT_TYPE}/\${TASK_ID}"

# Validate inputs
if [ -z "\${AGENT_TYPE}" ] || [ -z "\${TASK_ID}" ]; then
    echo "Usage: create-agent-worktree.sh <agent-type> <task-id> [base-branch]"
    exit 1
fi

# Create worktree base directory
mkdir -p "\${WORKTREE_BASE}"

# Initialize registry
if [ ! -f "\${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    touch "\${WORKTREE_BASE}/.worktree-registry.jsonl"
fi

# Check if worktree already exists
if [ -d "\${WORKTREE_PATH}" ]; then
    if git worktree list | grep -q "\${WORKTREE_PATH}"; then
        echo "WORKTREE_PATH=\${WORKTREE_PATH}"
        echo "WORKTREE_BRANCH=\${BRANCH_NAME}"
        exit 0
    else
        rm -rf "\${WORKTREE_PATH}"
    fi
fi

# Create worktree with new branch
if git worktree add -b "\${BRANCH_NAME}" "\${WORKTREE_PATH}" "\${BASE_BRANCH}"; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\\"name\\":\\"\${WORKTREE_NAME}\\",\\"path\\":\\"\${WORKTREE_PATH}\\",\\"branch\\":\\"\${BRANCH_NAME}\\",\\"agent\\":\\"\${AGENT_TYPE}\\",\\"task\\":\\"\${TASK_ID}\\",\\"base\\":\\"\${BASE_BRANCH}\\",\\"created\\":\\"\${TIMESTAMP}\\",\\"status\\":\\"active\\"}" >> "\${WORKTREE_BASE}/.worktree-registry.jsonl"

    echo "WORKTREE_PATH=\${WORKTREE_PATH}"
    echo "WORKTREE_BRANCH=\${BRANCH_NAME}"
else
    echo "Failed to create worktree" >&2
    exit 1
fi
`;

    // Cleanup worktree script
    const cleanupWorktreeScript = `#!/bin/bash
# cleanup-worktree.sh - Cleans up agent worktree after merge
# Installed by wundr computer-setup resource-manager

set -euo pipefail

WORKTREE_NAME="\${1}"
FORCE_CLEANUP="\${2:-false}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="\${REPO_ROOT}/.worktrees"
WORKTREE_PATH="\${WORKTREE_BASE}/\${WORKTREE_NAME}"

if [ -z "\${WORKTREE_NAME}" ]; then
    echo "Usage: cleanup-worktree.sh <worktree-name> [force]"
    exit 1
fi

if [ ! -d "\${WORKTREE_PATH}" ]; then
    git worktree prune 2>/dev/null || true
    exit 0
fi

cd "\${WORKTREE_PATH}"
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "")

# Check for uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    if [ "\${FORCE_CLEANUP}" != "true" ]; then
        echo "Uncommitted changes detected. Use force cleanup." >&2
        exit 1
    fi
fi

cd "\${REPO_ROOT}"

# Remove worktree
git worktree remove "\${WORKTREE_PATH}" --force 2>/dev/null || rm -rf "\${WORKTREE_PATH}"
git worktree prune

# Delete branch if force cleanup or merged
if [ -n "\${BRANCH_NAME}" ] && [ "\${FORCE_CLEANUP}" = "true" ]; then
    git branch -D "\${BRANCH_NAME}" 2>/dev/null || true
fi

echo "Cleaned up \${WORKTREE_NAME}"
`;

    // Worktree status script
    const worktreeStatusScript = `#!/bin/bash
# worktree-status.sh - Shows status of all agent worktrees
# Installed by wundr computer-setup resource-manager

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
WORKTREE_BASE="\${REPO_ROOT}/.worktrees"

echo "=== Git Worktree Status ==="
echo "Repository: \${REPO_ROOT}"
echo ""

if [ -f "\${WORKTREE_BASE}/.worktree-registry.jsonl" ]; then
    TOTAL=$(wc -l < "\${WORKTREE_BASE}/.worktree-registry.jsonl" | tr -d ' ')
    ACTIVE=$(grep -c '"status":"active"' "\${WORKTREE_BASE}/.worktree-registry.jsonl" 2>/dev/null || echo "0")
    echo "Registry: \${TOTAL} total, \${ACTIVE} active"
    echo ""
fi

echo "Active Worktrees:"
git worktree list | tail -n +2 || echo "  None"
echo ""

echo "Disk Usage:"
if [ -d "\${WORKTREE_BASE}" ]; then
    du -sh "\${WORKTREE_BASE}" 2>/dev/null || echo "  Unable to calculate"
else
    echo "  No worktrees directory"
fi
`;

    await fs.writeFile(
      path.join(targetDir, 'create-agent-worktree.sh'),
      createWorktreeScript
    );
    await fs.writeFile(
      path.join(targetDir, 'cleanup-worktree.sh'),
      cleanupWorktreeScript
    );
    await fs.writeFile(
      path.join(targetDir, 'worktree-status.sh'),
      worktreeStatusScript
    );

    await fs.chmod(path.join(targetDir, 'create-agent-worktree.sh'), 0o755);
    await fs.chmod(path.join(targetDir, 'cleanup-worktree.sh'), 0o755);
    await fs.chmod(path.join(targetDir, 'worktree-status.sh'), 0o755);
  }

  // ============================================================================
  // Private Methods - Resource Manager Wrapper
  // ============================================================================

  private async checkResourceManagerWrapper(): Promise<boolean> {
    const wrapperPath = path.join(
      this.claudeDir,
      'scripts',
      'claude-resource-manager'
    );
    return fsSync.existsSync(wrapperPath);
  }

  private async installResourceManagerWrapper(): Promise<{
    installed: boolean;
  }> {
    const wrapperPath = path.join(
      this.claudeDir,
      'scripts',
      'claude-resource-manager'
    );
    const wundrWrapperPath = path.join(
      this.wundrDir,
      'scripts',
      'claude-resource-manager'
    );

    // Check if already installed with current version
    if (fsSync.existsSync(wrapperPath)) {
      const content = await fs.readFile(wrapperPath, 'utf-8');
      if (content.includes('VERSION="2.0.0"')) {
        return { installed: false }; // Already up to date
      }
    }

    const wrapperScript = `#!/usr/bin/env bash
###############################################################################
# claude-resource-manager: Session-Pooled, Worktree-Isolated Claude Launcher
#
# Extends claude-optimized with:
# - Session pooling for concurrent subagent management
# - Git worktree isolation for parallel agent work
# - Stale background task cleanup
# - Resource limit enforcement
#
# Usage:
#   claude-resource-manager [claude arguments...]
#   claude-resource-manager --pool-status
#   claude-resource-manager --cleanup-stale
#   claude-resource-manager --spawn-agent <type> <task-id>
#
# Installed by: wundr computer-setup resource-manager
###############################################################################

set -euo pipefail

VERSION="2.0.0"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
WUNDR_DIR="\${HOME}/.wundr"
RESOURCE_MANAGER_DIR="\${WUNDR_DIR}/resource-manager"
SESSION_DIR="\${RESOURCE_MANAGER_DIR}/sessions"
LOG_DIR="\${RESOURCE_MANAGER_DIR}/logs"
POOL_STATE_FILE="\${SESSION_DIR}/pool-state.json"
LOCK_FILE="\${SESSION_DIR}/.pool.lock"

# Configuration (can be overridden by environment)
MAX_CONCURRENT_SESSIONS="\${CLAUDE_MAX_SESSIONS:-${this.config.maxConcurrentSessions}}"
MAX_WORKTREES="\${CLAUDE_MAX_WORKTREES:-${this.config.maxWorktrees}}"
SESSION_TIMEOUT="\${CLAUDE_SESSION_TIMEOUT:-${this.config.sessionTimeout}}"
CLEANUP_INTERVAL="\${CLAUDE_CLEANUP_INTERVAL:-${this.config.cleanupInterval}}"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() { echo -e "\${BLUE}ℹ\${NC} $*"; }
log_success() { echo -e "\${GREEN}✅\${NC} $*"; }
log_warn() { echo -e "\${YELLOW}⚠\${NC} $*"; }
log_error() { echo -e "\${RED}❌\${NC} $*"; }

# Ensure directories exist
mkdir -p "\${SESSION_DIR}" "\${LOG_DIR}"

# Initialize pool state if needed
init_pool_state() {
    if [ ! -f "\${POOL_STATE_FILE}" ]; then
        echo '{"sessions":[],"lastCleanup":"'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'","version":"'"$VERSION"'"}' > "\${POOL_STATE_FILE}"
    fi
}

# Get current session count
get_session_count() {
    if [ -f "\${POOL_STATE_FILE}" ]; then
        grep -o '"pid":[0-9]*' "\${POOL_STATE_FILE}" | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Check if we can spawn a new session
can_spawn_session() {
    local current_count
    current_count=$(get_session_count)
    [ "\${current_count}" -lt "\${MAX_CONCURRENT_SESSIONS}" ]
}

# Register a new session
register_session() {
    local session_id="\$1"
    local pid="\$2"
    local worktree="\${3:-}"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Acquire lock
    exec 9>"\${LOCK_FILE}"
    flock -x 9

    init_pool_state

    local session_entry='{"id":"'"$session_id"'","pid":'"$pid"',"started":"'"$timestamp"'","worktree":"'"$worktree"'"}'

    # Add session to pool
    local current_sessions
    current_sessions=$(cat "\${POOL_STATE_FILE}")
    echo "\${current_sessions}" | sed 's/"sessions":\\[/"sessions":['"$session_entry"',/' > "\${POOL_STATE_FILE}.tmp"
    # Clean up empty entries
    sed 's/,]/]/' "\${POOL_STATE_FILE}.tmp" > "\${POOL_STATE_FILE}"
    rm -f "\${POOL_STATE_FILE}.tmp"

    # Release lock
    flock -u 9
    exec 9>&-
}

# Unregister a session
unregister_session() {
    local session_id="\$1"

    exec 9>"\${LOCK_FILE}"
    flock -x 9

    if [ -f "\${POOL_STATE_FILE}" ]; then
        # Remove session from pool (simple grep-based removal)
        grep -v "\\"\${session_id}\\"" "\${POOL_STATE_FILE}" > "\${POOL_STATE_FILE}.tmp" 2>/dev/null || true
        mv "\${POOL_STATE_FILE}.tmp" "\${POOL_STATE_FILE}"
    fi

    flock -u 9
    exec 9>&-
}

# Cleanup stale sessions (processes that no longer exist)
cleanup_stale_sessions() {
    log_info "Cleaning up stale sessions..."

    init_pool_state

    local cleaned=0
    local pids
    pids=$(grep -o '"pid":[0-9]*' "\${POOL_STATE_FILE}" 2>/dev/null | grep -o '[0-9]*' || true)

    for pid in \$pids; do
        if ! kill -0 "\$pid" 2>/dev/null; then
            log_info "Removing stale session with PID \$pid"
            unregister_session "session-\$pid"
            ((cleaned++)) || true
        fi
    done

    log_success "Cleaned up \$cleaned stale sessions"

    # Also cleanup orphaned worktrees
    cleanup_orphaned_worktrees
}

# Cleanup orphaned worktrees
cleanup_orphaned_worktrees() {
    log_info "Checking for orphaned worktrees..."

    local worktree_script="\${WUNDR_DIR}/scripts/cleanup-worktree.sh"
    if [ ! -f "\${worktree_script}" ]; then
        worktree_script="\${SCRIPT_DIR}/cleanup-worktree.sh"
    fi

    if [ -f "\${worktree_script}" ]; then
        # Get list of stale worktrees
        git worktree prune --dry-run 2>&1 | grep -o "Removing worktrees/[^']*" | while read -r line; do
            log_info "Would prune: \$line"
        done
        git worktree prune 2>/dev/null || true
    fi
}

# Show pool status
show_pool_status() {
    init_pool_state

    echo "═══════════════════════════════════════════════════════════"
    echo "  Claude Resource Manager - Pool Status"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Configuration:"
    echo "  Max Sessions:    \${MAX_CONCURRENT_SESSIONS}"
    echo "  Max Worktrees:   \${MAX_WORKTREES}"
    echo "  Session Timeout: \${SESSION_TIMEOUT}ms"
    echo ""

    local current_count
    current_count=$(get_session_count)
    echo "Current State:"
    echo "  Active Sessions: \${current_count} / \${MAX_CONCURRENT_SESSIONS}"

    if [ -f "\${POOL_STATE_FILE}" ]; then
        echo ""
        echo "Sessions:"
        cat "\${POOL_STATE_FILE}" | grep -o '{[^}]*}' | while read -r session; do
            local pid id started
            pid=$(echo "\$session" | grep -o '"pid":[0-9]*' | grep -o '[0-9]*')
            id=$(echo "\$session" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
            started=$(echo "\$session" | grep -o '"started":"[^"]*"' | cut -d'"' -f4)

            if [ -n "\$pid" ]; then
                local status="running"
                if ! kill -0 "\$pid" 2>/dev/null; then
                    status="stale"
                fi
                echo "  • \${id:-unknown} (PID: \$pid, Started: \${started:-unknown}, Status: \$status)"
            fi
        done
    fi

    echo ""
    echo "Worktrees:"
    git worktree list 2>/dev/null | tail -n +2 | head -10 || echo "  None"
    local wt_count
    wt_count=$(git worktree list 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
    if [ "\$wt_count" -gt 10 ]; then
        echo "  ... and \$((wt_count - 10)) more"
    fi
    echo ""
}

# Spawn an agent with worktree isolation
spawn_agent() {
    local agent_type="\$1"
    local task_id="\$2"
    shift 2

    if ! can_spawn_session; then
        log_error "Session pool full (\${MAX_CONCURRENT_SESSIONS} concurrent sessions)"
        log_info "Use --pool-status to see active sessions"
        log_info "Use --cleanup-stale to remove dead sessions"
        exit 1
    fi

    local worktree_script="\${WUNDR_DIR}/scripts/create-agent-worktree.sh"
    if [ ! -f "\${worktree_script}" ]; then
        worktree_script="\${SCRIPT_DIR}/create-agent-worktree.sh"
    fi

    if [ ! -f "\${worktree_script}" ]; then
        log_error "Worktree script not found"
        exit 1
    fi

    log_info "Creating worktree for \${agent_type} agent (task: \${task_id})..."

    # Create worktree
    local worktree_output
    worktree_output=$("\${worktree_script}" "\${agent_type}" "\${task_id}")
    local worktree_path
    worktree_path=$(echo "\${worktree_output}" | grep "WORKTREE_PATH=" | cut -d'=' -f2)

    if [ -z "\${worktree_path}" ]; then
        log_error "Failed to create worktree"
        exit 1
    fi

    log_success "Worktree created: \${worktree_path}"

    # Generate session ID
    local session_id="session-\${agent_type}-\${task_id}-\$\$"

    # Launch Claude in the worktree
    log_info "Launching Claude in isolated worktree..."
    cd "\${worktree_path}"

    # Register session before spawning
    register_session "\${session_id}" "\$\$" "\${worktree_path}"

    # Trap to unregister on exit
    trap 'unregister_session "\${session_id}"' EXIT

    # Run with hardware optimization if available
    if [ -f "\${SCRIPT_DIR}/claude-optimized" ]; then
        exec "\${SCRIPT_DIR}/claude-optimized" "$@"
    else
        exec claude "$@"
    fi
}

# Main entry point
main() {
    case "\${1:-}" in
        --version)
            echo "claude-resource-manager v\${VERSION}"
            exit 0
            ;;
        --pool-status|--status)
            show_pool_status
            exit 0
            ;;
        --cleanup-stale|--cleanup)
            cleanup_stale_sessions
            exit 0
            ;;
        --spawn-agent)
            if [ -z "\${2:-}" ] || [ -z "\${3:-}" ]; then
                log_error "Usage: claude-resource-manager --spawn-agent <type> <task-id> [claude args...]"
                exit 1
            fi
            spawn_agent "\$2" "\$3" "\${@:4}"
            ;;
        --help|-h)
            echo "claude-resource-manager v\${VERSION}"
            echo ""
            echo "Usage:"
            echo "  claude-resource-manager [claude arguments...]"
            echo "  claude-resource-manager --pool-status"
            echo "  claude-resource-manager --cleanup-stale"
            echo "  claude-resource-manager --spawn-agent <type> <task-id> [args...]"
            echo ""
            echo "Options:"
            echo "  --pool-status     Show session pool status"
            echo "  --cleanup-stale   Remove dead/stale sessions"
            echo "  --spawn-agent     Spawn agent with worktree isolation"
            echo "  --version         Show version"
            echo "  --help            Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  CLAUDE_MAX_SESSIONS       Max concurrent sessions (default: ${this.config.maxConcurrentSessions})"
            echo "  CLAUDE_MAX_WORKTREES      Max worktrees (default: ${this.config.maxWorktrees})"
            echo "  CLAUDE_SESSION_TIMEOUT    Session timeout in ms (default: ${this.config.sessionTimeout})"
            exit 0
            ;;
        *)
            # Default: run claude with resource management
            if ! can_spawn_session; then
                log_warn "Session pool near capacity, running cleanup first..."
                cleanup_stale_sessions

                if ! can_spawn_session; then
                    log_error "Session pool full. Use --pool-status to see active sessions."
                    exit 1
                fi
            fi

            local session_id="session-\$\$-$(date +%s)"
            register_session "\${session_id}" "\$\$" ""
            trap 'unregister_session "\${session_id}"' EXIT

            # Run with hardware optimization if available
            if [ -f "\${SCRIPT_DIR}/claude-optimized" ]; then
                exec "\${SCRIPT_DIR}/claude-optimized" "$@"
            else
                exec claude "$@"
            fi
            ;;
    esac
}

main "$@"
`;

    await fs.writeFile(wrapperPath, wrapperScript);
    await fs.writeFile(wundrWrapperPath, wrapperScript);
    await fs.chmod(wrapperPath, 0o755);
    await fs.chmod(wundrWrapperPath, 0o755);

    logger.info('Installed claude-resource-manager wrapper');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Session Pool Config
  // ============================================================================

  private async checkSessionPoolConfig(): Promise<boolean> {
    const configPath = path.join(
      this.wundrDir,
      'resource-manager',
      'config.json'
    );
    return fsSync.existsSync(configPath);
  }

  private async installSessionPoolConfig(): Promise<{ installed: boolean }> {
    const configPath = path.join(
      this.wundrDir,
      'resource-manager',
      'config.json'
    );

    const config = {
      version: '2.0.0',
      installedAt: new Date().toISOString(),
      sessionPool: {
        maxConcurrentSessions: this.config.maxConcurrentSessions,
        defaultSessionTimeout: this.config.sessionTimeout,
        maxQueueSize: 100,
        autoRecovery: true,
        priorityWeights: {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        },
      },
      worktree: {
        maxWorktrees: this.config.maxWorktrees,
        baseDir: '.worktrees',
        autoCleanupMerged: true,
        cleanupOnExit: false,
      },
      daemon: {
        enabled: this.config.enableDaemon,
        cleanupInterval: this.config.cleanupInterval,
        healthCheckInterval: 30000,
      },
      logging: {
        level: 'info',
        maxLogFiles: 10,
        maxLogSize: '10MB',
      },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.info('Created session pool configuration');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Daemon Service
  // ============================================================================

  private async installDaemonService(): Promise<{
    installed: boolean;
    running: boolean;
    error?: string;
  }> {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this.installLaunchdService();
    } else if (platform === 'linux') {
      return this.installSystemdService();
    }

    return { installed: false, running: false, error: 'Unsupported platform' };
  }

  private async installLaunchdService(): Promise<{
    installed: boolean;
    running: boolean;
    error?: string;
  }> {
    const plistName = 'io.wundr.resource-manager.plist';
    const plistPath = path.join(
      this.homeDir,
      'Library',
      'LaunchAgents',
      plistName
    );

    // Ensure LaunchAgents directory exists
    await fs.mkdir(path.join(this.homeDir, 'Library', 'LaunchAgents'), {
      recursive: true,
    });

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.wundr.resource-manager</string>

    <key>ProgramArguments</key>
    <array>
        <string>${path.join(this.claudeDir, 'scripts', 'claude-resource-manager')}</string>
        <string>--cleanup-stale</string>
    </array>

    <key>StartInterval</key>
    <integer>${Math.floor(this.config.cleanupInterval / 1000)}</integer>

    <key>RunAtLoad</key>
    <false/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${path.join(this.wundrDir, 'resource-manager', 'logs', 'daemon.log')}</string>

    <key>StandardErrorPath</key>
    <string>${path.join(this.wundrDir, 'resource-manager', 'logs', 'daemon.error.log')}</string>

    <key>WorkingDirectory</key>
    <string>${this.homeDir}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>HOME</key>
        <string>${this.homeDir}</string>
    </dict>
</dict>
</plist>
`;

    try {
      // Unload existing service if present
      try {
        execSync(`launchctl unload "${plistPath}" 2>/dev/null`, {
          stdio: 'ignore',
        });
      } catch {
        // Ignore errors if service wasn't loaded
      }

      await fs.writeFile(plistPath, plistContent);
      logger.info('Created launchd plist');

      // Load the service
      try {
        execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' });
        logger.info('Loaded launchd service');
        return { installed: true, running: true };
      } catch (loadError) {
        logger.warn('Could not auto-load launchd service. Load manually with:');
        logger.warn(`  launchctl load "${plistPath}"`);
        return { installed: true, running: false };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { installed: false, running: false, error: msg };
    }
  }

  private async installSystemdService(): Promise<{
    installed: boolean;
    running: boolean;
    error?: string;
  }> {
    const serviceDir = path.join(this.homeDir, '.config', 'systemd', 'user');
    const serviceName = 'wundr-resource-manager.service';
    const servicePath = path.join(serviceDir, serviceName);
    const timerName = 'wundr-resource-manager.timer';
    const timerPath = path.join(serviceDir, timerName);

    await fs.mkdir(serviceDir, { recursive: true });

    const serviceContent = `[Unit]
Description=Wundr Resource Manager - Claude Session Pool Cleanup
After=network.target

[Service]
Type=oneshot
ExecStart=${path.join(this.claudeDir, 'scripts', 'claude-resource-manager')} --cleanup-stale
WorkingDirectory=${this.homeDir}
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="HOME=${this.homeDir}"

[Install]
WantedBy=default.target
`;

    const timerContent = `[Unit]
Description=Run Wundr Resource Manager cleanup periodically

[Timer]
OnBootSec=1min
OnUnitActiveSec=${Math.floor(this.config.cleanupInterval / 1000)}s
Persistent=true

[Install]
WantedBy=timers.target
`;

    try {
      await fs.writeFile(servicePath, serviceContent);
      await fs.writeFile(timerPath, timerContent);
      logger.info('Created systemd service and timer');

      // Try to enable and start the timer
      try {
        execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
        execSync(`systemctl --user enable ${timerName}`, { stdio: 'pipe' });
        execSync(`systemctl --user start ${timerName}`, { stdio: 'pipe' });
        logger.info('Enabled and started systemd timer');
        return { installed: true, running: true };
      } catch {
        logger.warn(
          'Could not auto-enable systemd timer. Enable manually with:'
        );
        logger.warn(`  systemctl --user enable --now ${timerName}`);
        return { installed: true, running: false };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { installed: false, running: false, error: msg };
    }
  }

  // ============================================================================
  // Private Methods - Cleanup Utilities
  // ============================================================================

  private async installCleanupUtilities(): Promise<{ installed: boolean }> {
    const cleanupScript = `#!/usr/bin/env bash
# cleanup-claude-sessions.sh - Clean up stale Claude sessions and resources
# Installed by wundr computer-setup resource-manager

set -euo pipefail

RESOURCE_MANAGER="\${HOME}/.claude/scripts/claude-resource-manager"

if [ -f "\${RESOURCE_MANAGER}" ]; then
    exec "\${RESOURCE_MANAGER}" --cleanup-stale
else
    echo "Resource manager not found at \${RESOURCE_MANAGER}"

    # Fallback: manual cleanup
    echo "Running manual cleanup..."

    # Find and kill orphaned claude processes older than 1 hour
    pgrep -f "claude" | while read pid; do
        if [ -n "\$pid" ]; then
            # Check process age
            ps -p "\$pid" -o etimes= 2>/dev/null | while read elapsed; do
                if [ "\${elapsed:-0}" -gt 3600 ]; then
                    echo "Killing stale claude process \$pid (age: \${elapsed}s)"
                    kill "\$pid" 2>/dev/null || true
                fi
            done
        fi
    done

    # Prune git worktrees
    git worktree prune 2>/dev/null || true

    echo "Manual cleanup complete"
fi
`;

    const cleanupPath = path.join(
      this.wundrDir,
      'scripts',
      'cleanup-claude-sessions.sh'
    );
    await fs.writeFile(cleanupPath, cleanupScript);
    await fs.chmod(cleanupPath, 0o755);

    // Also add to ~/.claude/scripts
    const claudeCleanupPath = path.join(
      this.claudeDir,
      'scripts',
      'cleanup-claude-sessions.sh'
    );
    await fs.writeFile(claudeCleanupPath, cleanupScript);
    await fs.chmod(claudeCleanupPath, 0o755);

    logger.info('Installed cleanup utilities');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Worktree Hooks
  // ============================================================================

  private async installWorktreeHooks(): Promise<{ installed: boolean }> {
    const hooksDir = path.join(this.claudeDir, 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });

    // Try to copy from bundled resources first
    const possibleSourceDirs = [
      path.resolve(__dirname, '../../resources/hooks'),
      path.join(process.cwd(), 'resources/hooks'),
    ];

    let sourceFound = false;
    for (const sourceDir of possibleSourceDirs) {
      const hookSource = path.join(sourceDir, 'worktree-subagent-hook.js');
      if (fsSync.existsSync(hookSource)) {
        await fs.copyFile(
          hookSource,
          path.join(hooksDir, 'worktree-subagent-hook.js')
        );
        await fs.chmod(path.join(hooksDir, 'worktree-subagent-hook.js'), 0o755);
        sourceFound = true;
        break;
      }
    }

    if (!sourceFound) {
      // Generate a minimal hook configuration file
      const hookConfig = {
        version: '1.0.0',
        hooks: {
          'pre-task': {
            enabled: true,
            script: 'worktree-subagent-hook.js',
            args: ['pre'],
          },
          'post-task': {
            enabled: true,
            script: 'worktree-subagent-hook.js',
            args: ['post'],
          },
        },
        worktreeIsolation: {
          enabled: true,
          autoMerge: false,
          defaultStrategy: 'auto',
        },
      };
      await fs.writeFile(
        path.join(hooksDir, 'worktree-hooks-config.json'),
        JSON.stringify(hookConfig, null, 2)
      );
    }

    // Create hooks.json config if not exists
    const hooksConfigPath = path.join(this.claudeDir, 'hooks.json');
    if (!fsSync.existsSync(hooksConfigPath)) {
      const hooksJson = {
        version: '1.0.0',
        worktreeIsolation: {
          enabled: process.env.CLAUDE_WORKTREE_ENABLED !== '0',
          autoMerge: process.env.CLAUDE_WORKTREE_AUTO_MERGE === '1',
        },
      };
      await fs.writeFile(hooksConfigPath, JSON.stringify(hooksJson, null, 2));
    }

    logger.info('Installed worktree hooks');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Merge Utilities
  // ============================================================================

  private async installMergeUtilities(): Promise<{ installed: boolean }> {
    const scriptsDir = path.join(this.wundrDir, 'scripts');
    const claudeScriptsDir = path.join(this.claudeDir, 'scripts');

    // Try to copy from bundled resources
    const possibleSourceDirs = [
      path.resolve(__dirname, '../../resources/scripts'),
      path.join(process.cwd(), 'resources/scripts'),
    ];

    let sourceFound = false;
    for (const sourceDir of possibleSourceDirs) {
      const mergeSource = path.join(sourceDir, 'worktree-merge.sh');
      if (fsSync.existsSync(mergeSource)) {
        await fs.copyFile(
          mergeSource,
          path.join(scriptsDir, 'worktree-merge.sh')
        );
        await fs.copyFile(
          mergeSource,
          path.join(claudeScriptsDir, 'worktree-merge.sh')
        );
        await fs.chmod(path.join(scriptsDir, 'worktree-merge.sh'), 0o755);
        await fs.chmod(path.join(claudeScriptsDir, 'worktree-merge.sh'), 0o755);
        sourceFound = true;
        logger.info('Installed worktree-merge.sh from bundled resources');
        break;
      }
    }

    if (!sourceFound) {
      // Generate minimal merge script
      const minimalMergeScript = `#!/bin/bash
# worktree-merge.sh - Minimal merge utility
# Full version available in bundled resources

WORKTREE_ID="\${1}"
STRATEGY="\${2:-auto}"

if [ -z "\${WORKTREE_ID}" ]; then
    echo "Usage: worktree-merge.sh <worktree-id> [strategy]"
    echo "Strategies: auto, squash, pr, manual"
    exit 1
fi

REGISTRY="\${HOME}/.wundr/resource-manager/worktrees/active-worktrees.json"

if [ ! -f "\${REGISTRY}" ]; then
    echo "No worktree registry found"
    exit 1
fi

echo "Merge worktree \${WORKTREE_ID} with strategy: \${STRATEGY}"
echo "Full merge functionality requires jq. Install with: brew install jq"
`;
      await fs.writeFile(
        path.join(scriptsDir, 'worktree-merge.sh'),
        minimalMergeScript
      );
      await fs.writeFile(
        path.join(claudeScriptsDir, 'worktree-merge.sh'),
        minimalMergeScript
      );
      await fs.chmod(path.join(scriptsDir, 'worktree-merge.sh'), 0o755);
      await fs.chmod(path.join(claudeScriptsDir, 'worktree-merge.sh'), 0o755);
    }

    logger.info('Installed merge utilities');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Orchestrator Worktree Manager
  // ============================================================================

  private async installOrchestratorWorktreeManager(): Promise<{
    installed: boolean;
  }> {
    const scriptsDir = path.join(this.wundrDir, 'scripts');

    // Try to copy from bundled resources
    const possibleSourceDirs = [
      path.resolve(__dirname, '../../resources/scripts'),
      path.join(process.cwd(), 'resources/scripts'),
    ];

    let sourceFound = false;
    for (const sourceDir of possibleSourceDirs) {
      const managerSource = path.join(
        sourceDir,
        'orchestrator-worktree-manager.ts'
      );
      if (fsSync.existsSync(managerSource)) {
        await fs.copyFile(
          managerSource,
          path.join(scriptsDir, 'orchestrator-worktree-manager.ts')
        );
        await fs.chmod(
          path.join(scriptsDir, 'orchestrator-worktree-manager.ts'),
          0o755
        );
        sourceFound = true;
        logger.info(
          'Installed orchestrator-worktree-manager.ts from bundled resources'
        );
        break;
      }
    }

    // Create a shell wrapper for easy execution
    const wrapperScript = `#!/bin/bash
# orchestrator-worktree - Wrapper for TypeScript worktree manager
# Installed by wundr computer-setup resource-manager

MANAGER_SCRIPT="\${HOME}/.wundr/scripts/orchestrator-worktree-manager.ts"

if [ ! -f "\${MANAGER_SCRIPT}" ]; then
    echo "Orchestrator worktree manager not found"
    exit 1
fi

# Check for ts-node or tsx
if command -v tsx &>/dev/null; then
    exec tsx "\${MANAGER_SCRIPT}" "$@"
elif command -v ts-node &>/dev/null; then
    exec ts-node "\${MANAGER_SCRIPT}" "$@"
elif command -v npx &>/dev/null; then
    exec npx ts-node "\${MANAGER_SCRIPT}" "$@"
else
    echo "TypeScript runtime not found. Install with: npm install -g ts-node"
    exit 1
fi
`;

    await fs.writeFile(
      path.join(scriptsDir, 'orchestrator-worktree'),
      wrapperScript
    );
    await fs.chmod(path.join(scriptsDir, 'orchestrator-worktree'), 0o755);

    // Also add to claude scripts
    await fs.writeFile(
      path.join(this.claudeDir, 'scripts', 'orchestrator-worktree'),
      wrapperScript
    );
    await fs.chmod(
      path.join(this.claudeDir, 'scripts', 'orchestrator-worktree'),
      0o755
    );

    logger.info('Installed orchestrator worktree manager');
    return { installed: true };
  }

  // ============================================================================
  // Private Methods - Shell Integration
  // ============================================================================

  private async installShellIntegration(): Promise<void> {
    const shellConfigs = [
      path.join(this.homeDir, '.zshrc'),
      path.join(this.homeDir, '.bashrc'),
    ];

    const integrationBlock = `
# ═══════════════════════════════════════════════════════════════════════════
# Wundr Resource Manager - Claude Session Pool & Worktree Management
# ═══════════════════════════════════════════════════════════════════════════

# Resource manager wrapper (includes session pooling and worktree isolation)
if [ -f "$HOME/.claude/scripts/claude-resource-manager" ]; then
    alias claude-managed="$HOME/.claude/scripts/claude-resource-manager"
    alias claude-pool-status="$HOME/.claude/scripts/claude-resource-manager --pool-status"
    alias claude-cleanup="$HOME/.claude/scripts/claude-resource-manager --cleanup-stale"
    alias claude-spawn-agent="$HOME/.claude/scripts/claude-resource-manager --spawn-agent"
fi

# Worktree management shortcuts
if [ -f "$HOME/.wundr/scripts/create-agent-worktree.sh" ]; then
    alias wt-create="$HOME/.wundr/scripts/create-agent-worktree.sh"
    alias wt-cleanup="$HOME/.wundr/scripts/cleanup-worktree.sh"
    alias wt-status="$HOME/.wundr/scripts/worktree-status.sh"
fi

# Worktree merge utilities
if [ -f "$HOME/.wundr/scripts/worktree-merge.sh" ]; then
    alias wt-merge="$HOME/.wundr/scripts/worktree-merge.sh"
    alias wt-merge-list="$HOME/.wundr/scripts/worktree-merge.sh --list"
    alias wt-merge-all="$HOME/.wundr/scripts/worktree-merge.sh --merge-all"
    alias wt-merge-cleanup="$HOME/.wundr/scripts/worktree-merge.sh --cleanup"
fi

# Orchestrator worktree manager (advanced)
if [ -f "$HOME/.wundr/scripts/orchestrator-worktree" ]; then
    alias orch-spawn="$HOME/.wundr/scripts/orchestrator-worktree spawn"
    alias orch-merge="$HOME/.wundr/scripts/orchestrator-worktree merge"
    alias orch-list="$HOME/.wundr/scripts/orchestrator-worktree list"
    alias orch-cleanup="$HOME/.wundr/scripts/orchestrator-worktree cleanup"
    alias orch-daemon="$HOME/.wundr/scripts/orchestrator-worktree daemon"
fi

# Environment variables for worktree isolation
export CLAUDE_WORKTREE_ENABLED=1
# export CLAUDE_WORKTREE_AUTO_MERGE=0  # Uncomment to enable auto-merge

# ═══════════════════════════════════════════════════════════════════════════
`;

    for (const configFile of shellConfigs) {
      try {
        const exists = fsSync.existsSync(configFile);
        if (exists) {
          const content = await fs.readFile(configFile, 'utf-8');
          if (!content.includes('Wundr Resource Manager')) {
            await fs.appendFile(configFile, integrationBlock);
            logger.info(
              `Added resource manager integration to ${path.basename(configFile)}`
            );
          }
        }
      } catch {
        // Shell config doesn't exist or not writable
      }
    }
  }
}

// Export singleton instance
export const resourceManagerInstaller = new ResourceManagerInstaller();
export default resourceManagerInstaller;
