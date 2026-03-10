/**
 * State Detection - Full implementation
 *
 * Scans the file system to detect project type, git state, and configuration
 * state. Uses only Node.js built-ins (fs, path, crypto, child_process).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface CustomizationInfo {
  file: string;
  type: string;
  description: string;
}

export interface GitStatus {
  isRepository: boolean;
  branch?: string;
  isDirty: boolean;
  hasUncommittedChanges: boolean;
  hasUntrackedFiles: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export interface AgentInfo {
  name: string;
  type: string;
  configPath: string;
  isValid: boolean;
}

export interface AgentState {
  hasAgents: boolean;
  agentCount: number;
  agents: AgentInfo[];
}

export interface HookInfo {
  name: string;
  configPath: string;
  isEnabled: boolean;
  type: string;
}

export interface HookState {
  hasHooks: boolean;
  hookCount: number;
  hooks: HookInfo[];
}

export interface CustomizationState {
  hasCustomizations: boolean;
  customizedFiles: string[];
  addedFiles: string[];
  removedFiles: string[];
  checksumMismatches: string[];
}

export interface ConflictEntry {
  type: 'version' | 'config' | 'file';
  severity: 'error' | 'warning' | 'info';
  description: string;
}

export interface ConflictState {
  hasConflicts: boolean;
  conflicts: ConflictEntry[];
}

export interface ClaudeConfigInfo {
  exists: boolean;
  path?: string;
  isValid: boolean;
}

export interface MCPConfigInfo {
  exists: boolean;
  path?: string;
  isValid: boolean;
  servers: string[];
}

export interface WundrConfigInfo {
  exists: boolean;
  path?: string;
  isValid: boolean;
  version?: string;
}

/**
 * Full project state as detected from the file system.
 *
 * The original minimal interface fields (type, customizations, dependencies,
 * healthScore, isWundrOutdated, recommendations, wundrVersion) are preserved
 * alongside the richer fields required by the command layer and test suite.
 */
export interface ProjectState {
  // ---- original interface fields (preserved) --------------------------------
  /** Detected project type: 'node', 'python', 'go', 'java', 'unknown', etc. */
  type: string;
  /** Customization details (legacy list form) */
  customizations: CustomizationState;
  /** Key/value dependency map from the primary manifest */
  dependencies: Record<string, string>;
  healthScore: number;
  isWundrOutdated?: boolean;
  recommendations: string[];
  wundrVersion?: string;

  // ---- extended fields used by project-update.ts and the test suite --------
  projectPath: string;
  detectedAt: Date;

  hasWundr: boolean;
  hasClaudeConfig: boolean;
  hasMCPConfig: boolean;
  hasWundrConfig: boolean;
  hasPackageJson: boolean;

  packageName?: string;
  packageVersion?: string;
  isMonorepo: boolean;
  workspaces: string[];

  claudeConfigPath?: string;
  mcpConfigPath?: string;
  wundrConfigPath?: string;

  latestWundrVersion?: string;
  isPartialInstallation: boolean;
  missingComponents: string[];

  git: GitStatus;
  agents: AgentState;
  hooks: HookState;
  conflicts: ConflictState;
}

// ---------------------------------------------------------------------------
// Checksum helpers
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a file. Returns null if the file does not
 * exist or cannot be read.
 */
export async function computeFileChecksum(
  filePath: string
): Promise<string | null> {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Compute checksums for a list of relative file paths within a root directory.
 * Files that cannot be read are silently skipped.
 */
export async function computeChecksums(
  root: string,
  files: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const file of files) {
    const checksum = await computeFileChecksum(path.join(root, file));
    if (checksum !== null) {
      result.set(file, checksum);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Individual sub-detectors
// ---------------------------------------------------------------------------

/**
 * Detect git repository status by reading .git/HEAD and running `git status`.
 * Falls back to a safe default when the directory is not a git repo or git is
 * not available.
 */
export async function detectGitStatus(projectPath: string): Promise<GitStatus> {
  const gitDir = path.join(projectPath, '.git');

  if (!fs.existsSync(gitDir)) {
    return {
      isRepository: false,
      isDirty: false,
      hasUncommittedChanges: false,
      hasUntrackedFiles: false,
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
    };
  }

  // Read current branch from HEAD
  let branch: string | undefined;
  try {
    const headPath = path.join(gitDir, 'HEAD');
    if (fs.existsSync(headPath)) {
      const headContent = fs.readFileSync(headPath, 'utf8').trim();
      const refMatch = headContent.match(/^ref: refs\/heads\/(.+)$/);
      if (refMatch) {
        branch = refMatch[1];
      } else {
        // Detached HEAD – use the short commit hash
        branch = headContent.slice(0, 7);
      }
    }
  } catch {
    // ignore – branch will be undefined
  }

  // Run git status for file-level information
  const stagedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  try {
    const output = execSync('git status --porcelain', {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    for (const line of output.split('\n')) {
      if (!line) continue;
      const xy = line.slice(0, 2);
      const file = line.slice(3).trim();
      const staged = xy[0] !== ' ' && xy[0] !== '?';
      const unstaged = xy[1] !== ' ' && xy[1] !== '?';
      const untracked = xy === '??';

      if (staged) stagedFiles.push(file);
      if (unstaged) modifiedFiles.push(file);
      if (untracked) untrackedFiles.push(file);
    }
  } catch {
    // git may not be in PATH or repo may be bare – leave arrays empty
  }

  const hasUncommittedChanges =
    stagedFiles.length > 0 || modifiedFiles.length > 0;
  const hasUntrackedFiles = untrackedFiles.length > 0;
  const isDirty = hasUncommittedChanges || hasUntrackedFiles;

  return {
    isRepository: true,
    branch,
    isDirty,
    hasUncommittedChanges,
    hasUntrackedFiles,
    stagedFiles,
    modifiedFiles,
    untrackedFiles,
  };
}

/**
 * Detect Claude configuration (CLAUDE.md).
 * Searches the project root and .claude/ subdirectory.
 */
export async function detectClaudeConfig(
  projectPath: string
): Promise<ClaudeConfigInfo> {
  const candidates = [
    path.join(projectPath, 'CLAUDE.md'),
    path.join(projectPath, '.claude', 'CLAUDE.md'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      let isValid = false;
      try {
        const content = fs.readFileSync(candidate, 'utf8');
        isValid = content.trim().length > 0;
      } catch {
        // unreadable file is considered invalid
      }
      return { exists: true, path: candidate, isValid };
    }
  }

  return { exists: false, isValid: false };
}

/**
 * Detect MCP server configuration.
 * Searches for .mcp/config.json or .mcp.json at the project root.
 */
export async function detectMCPConfig(
  projectPath: string
): Promise<MCPConfigInfo> {
  const candidates = [
    path.join(projectPath, '.mcp', 'config.json'),
    path.join(projectPath, '.mcp.json'),
    path.join(projectPath, 'mcp.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      let isValid = false;
      const servers: string[] = [];
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        isValid = true;
        if (parsed.servers && typeof parsed.servers === 'object') {
          servers.push(...Object.keys(parsed.servers));
        }
      } catch {
        // JSON parse error – file exists but is invalid
      }
      return { exists: true, path: candidate, isValid, servers };
    }
  }

  return { exists: false, isValid: false, servers: [] };
}

/**
 * Detect Wundr project configuration.
 * Searches for wundr.config.json, .wundr.json, or .wundr/config.json.
 */
export async function detectWundrConfig(
  projectPath: string
): Promise<WundrConfigInfo> {
  const candidates = [
    path.join(projectPath, 'wundr.config.json'),
    path.join(projectPath, '.wundr.json'),
    path.join(projectPath, '.wundr', 'config.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      let isValid = false;
      let version: string | undefined;
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        isValid = true;
        version =
          typeof parsed.version === 'string' ? parsed.version : undefined;
      } catch {
        // invalid JSON
      }
      return { exists: true, path: candidate, isValid, version };
    }
  }

  return { exists: false, isValid: false };
}

/**
 * Detect agent configuration files in known locations.
 */
export async function detectAgents(projectPath: string): Promise<AgentState> {
  const agentDirs = [
    path.join(projectPath, '.claude', 'agents'),
    path.join(projectPath, '.wundr', 'agents'),
  ];

  const agents: AgentInfo[] = [];

  for (const dir of agentDirs) {
    if (!fs.existsSync(dir)) continue;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (
        !entry.name.endsWith('.json') &&
        !entry.name.endsWith('.yaml') &&
        !entry.name.endsWith('.yml')
      ) {
        continue;
      }

      const configPath = path.join(dir, entry.name);
      let name = entry.name.replace(/\.(json|ya?ml)$/, '');
      let type = 'unknown';
      let isValid = false;

      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        isValid = true;
        if (typeof parsed.name === 'string') name = parsed.name;
        if (typeof parsed.type === 'string') type = parsed.type;
      } catch {
        // YAML or broken JSON – still record the agent as invalid
      }

      agents.push({ name, type, configPath, isValid });
    }
  }

  return {
    hasAgents: agents.length > 0,
    agentCount: agents.length,
    agents,
  };
}

/**
 * Detect lifecycle hook configuration files in known hook directories.
 */
export async function detectHooks(projectPath: string): Promise<HookState> {
  const hookDirs = [
    path.join(projectPath, '.husky'),
    path.join(projectPath, '.claude', 'hooks'),
    path.join(projectPath, '.wundr', 'hooks'),
    path.join(projectPath, '.git', 'hooks'),
  ];

  const hooks: HookInfo[] = [];

  for (const dir of hookDirs) {
    if (!fs.existsSync(dir)) continue;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      // Skip hidden files / directories
      if (entry.name.startsWith('.')) continue;

      const configPath = path.join(dir, entry.name);
      const isSample = entry.name.endsWith('.sample');
      const hookName = isSample
        ? entry.name.replace(/\.sample$/, '')
        : entry.name;

      // Infer a human-readable type from the hook name
      let type = 'shell';
      if (entry.name.endsWith('.json')) type = 'json';
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
        type = 'script';
      }

      hooks.push({
        name: hookName,
        configPath,
        isEnabled: !isSample,
        type,
      });
    }
  }

  return {
    hasHooks: hooks.length > 0,
    hookCount: hooks.length,
    hooks,
  };
}

/**
 * Detect file-level customizations relative to an optional checksum baseline.
 *
 * When no baseline is provided the function reports files that exist in
 * wundr-managed directories (e.g. .claude/) as "added" files.
 */
export async function detectCustomizations(
  projectPath: string,
  baseline?: Map<string, string>
): Promise<CustomizationState> {
  const addedFiles: string[] = [];
  const checksumMismatches: string[] = [];
  const removedFiles: string[] = [];

  if (baseline && baseline.size > 0) {
    // Compare each baseline entry against the current file system
    for (const [relFile, expectedChecksum] of baseline.entries()) {
      const absPath = path.join(projectPath, relFile);
      if (!fs.existsSync(absPath)) {
        removedFiles.push(relFile);
        continue;
      }
      const actual = await computeFileChecksum(absPath);
      if (actual !== null && actual !== expectedChecksum) {
        checksumMismatches.push(relFile);
      }
    }
  }

  // Scan managed directories for files that are not in the baseline
  const managedDirs = [
    path.join(projectPath, '.claude'),
    path.join(projectPath, '.wundr'),
  ];

  for (const dir of managedDirs) {
    if (!fs.existsSync(dir)) continue;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const relPath = path.relative(projectPath, path.join(dir, entry.name));
      // Only flag as added if it's not already in the baseline
      if (!baseline || !baseline.has(relPath)) {
        addedFiles.push(relPath);
      }
    }
  }

  const customizedFiles = [...new Set([...checksumMismatches, ...addedFiles])];

  const hasCustomizations =
    addedFiles.length > 0 ||
    checksumMismatches.length > 0 ||
    removedFiles.length > 0;

  return {
    hasCustomizations,
    customizedFiles,
    addedFiles,
    removedFiles,
    checksumMismatches,
  };
}

/**
 * Detect conflicts within the project state.
 *
 * Accepts a partial state object so it can be called both before and after
 * full detection completes.
 */
export async function detectConflicts(
  projectPath: string,
  state: Partial<ProjectState>
): Promise<ConflictState> {
  const conflicts: ConflictEntry[] = [];

  // Version conflict: installed version is significantly behind latest
  if (state.wundrVersion && state.latestWundrVersion) {
    const current = state.wundrVersion;
    const latest = state.latestWundrVersion;
    if (current !== latest) {
      const [cMaj] = current.split('.').map(Number);
      const [lMaj] = latest.split('.').map(Number);
      const severity =
        lMaj !== undefined && cMaj !== undefined && lMaj > cMaj
          ? 'error'
          : 'warning';
      conflicts.push({
        type: 'version',
        severity,
        description: `Installed version ${current} is behind latest ${latest}`,
      });
    }
  }

  // Config conflict: multiple wundr config files
  const wundrConfigFiles = [
    path.join(projectPath, 'wundr.config.json'),
    path.join(projectPath, '.wundr.json'),
    path.join(projectPath, '.wundr', 'config.json'),
  ].filter(f => fs.existsSync(f));

  if (wundrConfigFiles.length > 1) {
    conflicts.push({
      type: 'config',
      severity: 'warning',
      description: `Multiple Wundr config files found: ${wundrConfigFiles.map(f => path.basename(f)).join(', ')}`,
    });
  }

  // Config conflict: multiple MCP config files
  const mcpConfigFiles = [
    path.join(projectPath, '.mcp', 'config.json'),
    path.join(projectPath, '.mcp.json'),
    path.join(projectPath, 'mcp.json'),
  ].filter(f => fs.existsSync(f));

  if (mcpConfigFiles.length > 1) {
    conflicts.push({
      type: 'config',
      severity: 'warning',
      description: `Multiple MCP config files found: ${mcpConfigFiles.map(f => path.basename(f)).join(', ')}`,
    });
  }

  // File conflict: uncommitted git changes block clean update
  const git = state.git;
  if (git?.isRepository && git?.isDirty) {
    conflicts.push({
      type: 'file',
      severity: 'warning',
      description:
        'Working tree has uncommitted changes. Consider committing or stashing before updating.',
    });
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// Detect project type
// ---------------------------------------------------------------------------

/**
 * Detect the primary project type from well-known manifest files.
 */
function detectProjectType(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(projectPath, 'requirements.txt')))
    return 'python';
  if (fs.existsSync(path.join(projectPath, 'Pipfile'))) return 'python';
  if (fs.existsSync(path.join(projectPath, 'pyproject.toml'))) return 'python';
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) return 'java';
  if (fs.existsSync(path.join(projectPath, 'build.gradle'))) return 'java';
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(projectPath, 'composer.json'))) return 'php';
  if (fs.existsSync(path.join(projectPath, 'Gemfile'))) return 'ruby';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Health score and recommendations
// ---------------------------------------------------------------------------

function computeHealthScore(
  state: Omit<ProjectState, 'healthScore' | 'recommendations'>
): number {
  let score = 0;

  if (state.hasPackageJson) score += 15;
  if (state.hasClaudeConfig) score += 20;
  if (state.hasMCPConfig) score += 15;
  if (state.hasWundrConfig) score += 15;
  if (state.agents.hasAgents) score += 10;
  if (state.hooks.hasHooks) score += 10;
  if (state.git.isRepository) score += 10;
  if (!state.isWundrOutdated) score += 5;

  return Math.min(100, score);
}

function buildRecommendations(
  state: Omit<ProjectState, 'recommendations'>
): string[] {
  const recs: string[] = [];

  if (!state.hasClaudeConfig) {
    recs.push('Add a CLAUDE.md configuration file to your project root.');
  }
  if (!state.hasMCPConfig) {
    recs.push('Configure MCP servers by adding .mcp/config.json.');
  }
  if (!state.hasWundrConfig) {
    recs.push(
      'Add wundr.config.json to declare the Wundr version for this project.'
    );
  }
  if (!state.agents.hasAgents) {
    recs.push(
      'Define agent configurations in .claude/agents/ for better automation.'
    );
  }
  if (!state.hooks.hasHooks) {
    recs.push(
      'Set up lifecycle hooks (e.g. Husky pre-commit) to enforce quality gates.'
    );
  }
  if (!state.git.isRepository) {
    recs.push('Initialise a git repository to enable version tracking.');
  }
  if (state.isWundrOutdated) {
    recs.push(
      `Update Wundr from ${state.wundrVersion} to ${state.latestWundrVersion} to get the latest features.`
    );
  }
  if (state.conflicts.hasConflicts) {
    recs.push(
      'Resolve detected configuration conflicts before running an update.'
    );
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main detection entry point
// ---------------------------------------------------------------------------

export interface DetectProjectStateOptions {
  /** The latest known Wundr CLI version (used for outdated detection). */
  latestVersion?: string;
}

/**
 * Analyse the project at `projectPath` and return a comprehensive
 * `ProjectState` snapshot.
 *
 * When `projectPath` is omitted `process.cwd()` is used so that callers
 * such as `wundr update check` can call `detectProjectState()` with no
 * arguments.
 */
export async function detectProjectState(
  projectPath: string = process.cwd(),
  options: DetectProjectStateOptions = {}
): Promise<ProjectState> {
  // Resolve to an absolute path and bail out gracefully for non-existent dirs
  const resolvedPath = path.resolve(projectPath);
  const pathExists = fs.existsSync(resolvedPath);

  if (!pathExists) {
    return buildEmptyState(resolvedPath, options);
  }

  // ---- project type ---------------------------------------------------------
  const type = detectProjectType(resolvedPath);

  // ---- package.json ---------------------------------------------------------
  let hasPackageJson = false;
  let packageName: string | undefined;
  let packageVersion: string | undefined;
  let isMonorepo = false;
  let workspaces: string[] = [];
  let dependencies: Record<string, string> = {};

  const pkgPath = path.join(resolvedPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    hasPackageJson = true;
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      packageName = typeof pkg.name === 'string' ? pkg.name : undefined;
      packageVersion =
        typeof pkg.version === 'string' ? pkg.version : undefined;

      if (pkg.workspaces) {
        isMonorepo = true;
        workspaces = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : Array.isArray(pkg.workspaces?.packages)
            ? pkg.workspaces.packages
            : [];
      }

      if (pkg.dependencies && typeof pkg.dependencies === 'object') {
        dependencies = { ...pkg.dependencies };
      }
    } catch {
      // corrupted package.json – hasPackageJson is still true
    }
  }

  // ---- wundr CLI version in node_modules ------------------------------------
  let wundrVersion: string | undefined;
  const wundrPkgPaths = [
    path.join(resolvedPath, 'node_modules', '@wundr.io', 'cli', 'package.json'),
    path.join(resolvedPath, 'node_modules', '@wundr', 'cli', 'package.json'),
  ];

  for (const wPkg of wundrPkgPaths) {
    if (fs.existsSync(wPkg)) {
      try {
        const raw = fs.readFileSync(wPkg, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.version === 'string') {
          wundrVersion = parsed.version;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  // ---- sub-detectors --------------------------------------------------------
  const [git, claudeConfig, mcpConfig, wundrConfig, agents, hooks] =
    await Promise.all([
      detectGitStatus(resolvedPath),
      detectClaudeConfig(resolvedPath),
      detectMCPConfig(resolvedPath),
      detectWundrConfig(resolvedPath),
      detectAgents(resolvedPath),
      detectHooks(resolvedPath),
    ]);

  const hasClaudeConfig = claudeConfig.exists;
  const hasMCPConfig = mcpConfig.exists;
  const hasWundrConfig = wundrConfig.exists;

  // Prefer version from wundr.config.json over node_modules
  if (!wundrVersion && wundrConfig.version) {
    wundrVersion = wundrConfig.version;
  }

  const latestWundrVersion = options.latestVersion;

  // ---- outdated check -------------------------------------------------------
  let isWundrOutdated = false;
  if (
    wundrVersion &&
    latestWundrVersion &&
    wundrVersion !== latestWundrVersion
  ) {
    isWundrOutdated = true;
  }

  // ---- customizations -------------------------------------------------------
  const customizations = await detectCustomizations(resolvedPath);

  // ---- hasWundr -------------------------------------------------------------
  const hasWundr =
    fs.existsSync(path.join(resolvedPath, 'CLAUDE.md')) ||
    fs.existsSync(path.join(resolvedPath, 'wundr.config.json')) ||
    fs.existsSync(path.join(resolvedPath, '.wundr')) ||
    wundrVersion !== undefined;

  // ---- missing components ---------------------------------------------------
  const missingComponents: string[] = [];
  if (!hasClaudeConfig) missingComponents.push('CLAUDE.md');
  if (!hasMCPConfig) missingComponents.push('mcp-config');
  if (!hasWundrConfig) missingComponents.push('wundr-config');

  const isPartialInstallation = hasWundr && missingComponents.length > 0;

  // ---- partial state for conflict detection ---------------------------------
  const partialState = {
    wundrVersion,
    latestWundrVersion,
    git,
    projectPath: resolvedPath,
    type,
    customizations,
    dependencies,
    isWundrOutdated,
    hasPackageJson,
    packageName,
    packageVersion,
    isMonorepo,
    workspaces,
    hasWundr,
    hasClaudeConfig,
    hasMCPConfig,
    hasWundrConfig,
    claudeConfigPath: claudeConfig.path,
    mcpConfigPath: mcpConfig.path,
    wundrConfigPath: wundrConfig.path,
    latestWundrVersion,
    isPartialInstallation,
    missingComponents,
    agents,
    hooks,
    detectedAt: new Date(),
  };

  const conflicts = await detectConflicts(resolvedPath, partialState);

  // ---- health score and recommendations -------------------------------------
  const stateWithoutScore = { ...partialState, conflicts };
  const healthScore = computeHealthScore(stateWithoutScore);
  const recommendations = buildRecommendations({
    ...stateWithoutScore,
    healthScore,
  });

  return {
    ...stateWithoutScore,
    healthScore,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Helper: hasWundrInstalled
// ---------------------------------------------------------------------------

/**
 * Quick check for whether Wundr is installed in the given directory.
 */
export async function hasWundrInstalled(projectPath: string): Promise<boolean> {
  return (
    fs.existsSync(path.join(projectPath, 'CLAUDE.md')) ||
    fs.existsSync(path.join(projectPath, 'wundr.config.json')) ||
    fs.existsSync(path.join(projectPath, '.wundr'))
  );
}

// ---------------------------------------------------------------------------
// Summary helper
// ---------------------------------------------------------------------------

/**
 * Build a human-readable summary string from a `ProjectState`.
 */
export function getStateSummary(state: ProjectState): string {
  const lines: string[] = [];

  lines.push('=== Project State Summary ===');

  if (state.packageName) {
    lines.push(
      `Project: ${state.packageName}${state.packageVersion ? ` v${state.packageVersion}` : ''}`
    );
  } else {
    lines.push(`Project path: ${state.projectPath}`);
  }

  lines.push(`Type: ${state.type}`);
  lines.push(`Health Score: ${state.healthScore}/100`);

  if (state.wundrVersion) {
    lines.push(`Wundr version: ${state.wundrVersion}`);
  }

  if (state.isWundrOutdated) {
    lines.push(`Update available: ${state.latestWundrVersion}`);
  }

  lines.push(
    `Git: ${state.git.isRepository ? `${state.git.branch ?? 'detached HEAD'}${state.git.isDirty ? ' (dirty)' : ''}` : 'not a repository'}`
  );

  lines.push(`Claude config: ${state.hasClaudeConfig ? 'present' : 'missing'}`);
  lines.push(`MCP config: ${state.hasMCPConfig ? 'present' : 'missing'}`);
  lines.push(`Wundr config: ${state.hasWundrConfig ? 'present' : 'missing'}`);
  lines.push(`Agents: ${state.agents.agentCount}`);
  lines.push(`Hooks: ${state.hooks.hookCount}`);

  if (state.conflicts.hasConflicts) {
    lines.push(`Conflicts: ${state.conflicts.conflicts.length}`);
    for (const c of state.conflicts.conflicts) {
      lines.push(`  [${c.severity}] ${c.description}`);
    }
  }

  if (state.recommendations.length > 0) {
    lines.push('\nRecommendations:');
    for (const rec of state.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Private helper: build a safe empty state for non-existent paths
// ---------------------------------------------------------------------------

function buildEmptyState(
  projectPath: string,
  options: DetectProjectStateOptions
): ProjectState {
  const git: GitStatus = {
    isRepository: false,
    isDirty: false,
    hasUncommittedChanges: false,
    hasUntrackedFiles: false,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
  };

  const agents: AgentState = { hasAgents: false, agentCount: 0, agents: [] };
  const hooks: HookState = { hasHooks: false, hookCount: 0, hooks: [] };
  const customizations: CustomizationState = {
    hasCustomizations: false,
    customizedFiles: [],
    addedFiles: [],
    removedFiles: [],
    checksumMismatches: [],
  };
  const conflicts: ConflictState = { hasConflicts: false, conflicts: [] };

  const base = {
    projectPath,
    detectedAt: new Date(),
    type: 'unknown',
    hasWundr: false,
    hasClaudeConfig: false,
    hasMCPConfig: false,
    hasWundrConfig: false,
    hasPackageJson: false,
    isMonorepo: false,
    workspaces: [],
    dependencies: {},
    isPartialInstallation: false,
    missingComponents: [] as string[],
    git,
    agents,
    hooks,
    customizations,
    conflicts,
    isWundrOutdated: false,
    latestWundrVersion: options.latestVersion,
    healthScore: 0,
  };

  const recommendations = buildRecommendations(base);
  return { ...base, recommendations };
}
