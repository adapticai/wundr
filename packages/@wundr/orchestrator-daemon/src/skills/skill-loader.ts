/**
 * Skill Loader
 *
 * Discovers and parses SKILL.md files from multiple directories with
 * configurable precedence. Handles YAML frontmatter parsing, metadata
 * resolution, multi-source merging, caching, and versioning.
 *
 * Directory precedence (lowest to highest):
 * 1. Extra dirs (configured via skills.load.extraDirs)
 * 2. Bundled (ships with Wundr)
 * 3. Managed (user's global ~/.wundr/skills/)
 * 4. Workspace (project-local ./skills/ and .claude/skills/)
 *
 * OpenClaw-compatible features:
 * - YAML frontmatter with hooks, dependencies, version
 * - $ARGUMENTS substitution placeholders
 * - Auto-discovery from .claude/skills/ and ~/.claude/skills/
 * - Install preferences (accept, reject, ask)
 *
 * @module skills/skill-loader
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type {
  ParsedSkillFrontmatter,
  Skill,
  SkillCacheEntry,
  SkillEntry,
  SkillFrontmatter,
  SkillHooks,
  SkillInvocationPolicy,
  SkillSource,
  SkillsConfig,
  SkillsInstallPreferences,
  SkillVersionInfo,
  WundrSkillMetadata,
  SkillInstallSpec,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKILL_FILENAME = 'SKILL.md';
const FRONTMATTER_DELIMITER = '---';
const WUNDR_CONFIG_DIR = path.join(os.homedir(), '.wundr');
const MANAGED_SKILLS_DIR = path.join(WUNDR_CONFIG_DIR, 'skills');

// ---------------------------------------------------------------------------
// Parse Cache
// ---------------------------------------------------------------------------

/**
 * In-process cache for parsed SKILL.md files. Keyed by absolute file path.
 * Entries are invalidated when the file's mtime or size changes.
 */
const parseCache = new Map<string, SkillCacheEntry>();

/**
 * Clear the entire parse cache. Useful after bulk file changes or testing.
 */
export function clearParseCache(): void {
  parseCache.clear();
}

/**
 * Get the current size of the parse cache.
 */
export function getParseCacheSize(): number {
  return parseCache.size;
}

/**
 * Check whether a cached entry is still valid by comparing mtime and size.
 */
function isCacheValid(entry: SkillCacheEntry): boolean {
  try {
    const stat = fs.statSync(entry.filePath);
    return stat.mtimeMs === entry.mtimeMs && stat.size === entry.size;
  } catch {
    return false;
  }
}

/**
 * Retrieve a cached skill or return undefined if the cache is stale or missing.
 */
function getCachedSkill(filePath: string): Skill | undefined {
  const entry = parseCache.get(filePath);
  if (!entry) {
    return undefined;
  }
  if (!isCacheValid(entry)) {
    parseCache.delete(filePath);
    return undefined;
  }
  return entry.skill;
}

/**
 * Store a parsed skill in the cache.
 */
function setCachedSkill(filePath: string, skill: Skill | undefined): void {
  try {
    const stat = fs.statSync(filePath);
    parseCache.set(filePath, {
      filePath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      skill,
      cachedAt: Date.now(),
    });
  } catch {
    // Cannot stat file -- do not cache
  }
}

// ---------------------------------------------------------------------------
// Version Tracking
// ---------------------------------------------------------------------------

/**
 * Previous version hashes, keyed by skill name.
 * Used to detect updates between loads.
 */
const previousVersions = new Map<string, string>();

/**
 * Compute a content hash for version comparison.
 */
function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/**
 * Build version info for a skill by comparing current content to prior load.
 */
export function buildVersionInfo(skill: Skill): SkillVersionInfo {
  const version = skill.frontmatter.version ?? computeContentHash(skill.body);
  const prev = previousVersions.get(skill.name);
  const updated = prev !== undefined && prev !== version;

  // Store current version for next comparison
  previousVersions.set(skill.name, version);

  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(skill.filePath).mtimeMs;
  } catch {
    // ignore
  }

  return {
    name: skill.name,
    currentVersion: version,
    previousVersion: prev,
    updated,
    mtimeMs,
  };
}

/**
 * Get all version info entries from the tracker.
 */
export function getAllVersionInfo(): Map<string, string> {
  return new Map(previousVersions);
}

// ---------------------------------------------------------------------------
// Frontmatter Parsing
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a SKILL.md file content string.
 * Returns the raw key-value pairs and the remaining body.
 *
 * Frontmatter is delimited by `---` on its own line at the start and end.
 */
export function parseFrontmatter(content: string): {
  frontmatter: ParsedSkillFrontmatter;
  body: string;
} {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return { frontmatter: {}, body: content };
  }

  const firstDelimEnd = trimmed.indexOf('\n');
  if (firstDelimEnd === -1) {
    return { frontmatter: {}, body: content };
  }

  const afterFirst = trimmed.slice(firstDelimEnd + 1);
  const secondDelimIndex = afterFirst.indexOf(`\n${FRONTMATTER_DELIMITER}`);
  if (secondDelimIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = afterFirst.slice(0, secondDelimIndex);
  const bodyStart = secondDelimIndex + FRONTMATTER_DELIMITER.length + 2; // +2 for \n and next \n
  const body = afterFirst.slice(bodyStart).trimStart();

  const frontmatter = parseYamlSimple(yamlBlock);

  return { frontmatter, body };
}

/**
 * Simple YAML parser for frontmatter key-value pairs.
 * Handles basic scalar values, quoted strings, multiline strings (>-),
 * and nested objects serialized as JSON.
 *
 * This avoids a full YAML library dependency for the common case.
 * Complex nested metadata is stored as JSON strings and parsed later.
 */
function parseYamlSimple(yaml: string): ParsedSkillFrontmatter {
  const result: ParsedSkillFrontmatter = {};
  const lines = yaml.split('\n');

  let currentKey = '';
  let currentValue = '';
  let multilineMode = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (const line of lines) {
    // Handle multiline JSON-like values (metadata blocks)
    if (multilineMode) {
      currentValue += '\n' + line;
      braceDepth += countChar(line, '{') - countChar(line, '}');
      bracketDepth += countChar(line, '[') - countChar(line, ']');
      if (braceDepth <= 0 && bracketDepth <= 0) {
        result[currentKey] = currentValue.trim();
        multilineMode = false;
        currentKey = '';
        currentValue = '';
      }
      continue;
    }

    // Handle folded scalar (>-) continuation lines
    if (currentKey && line.match(/^\s+\S/) && !line.match(/^\S/)) {
      const continuation = line.trim();
      if (continuation) {
        currentValue += ' ' + continuation;
        result[currentKey] = currentValue.trim();
      }
      continue;
    }

    // Match key: value pairs at root level
    const match = line.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:\s*(.*)/);
    if (!match) {
      continue;
    }

    // Flush previous key
    if (currentKey && currentValue) {
      result[currentKey] = currentValue.trim();
    }

    currentKey = match[1];
    let value = match[2].trim();

    // Strip >- indicator
    if (value === '>-' || value === '>') {
      currentValue = '';
      continue;
    }

    // Handle quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Detect multiline JSON objects/arrays
    braceDepth = countChar(value, '{') - countChar(value, '}');
    bracketDepth = countChar(value, '[') - countChar(value, ']');
    if (braceDepth > 0 || bracketDepth > 0) {
      currentValue = value;
      multilineMode = true;
      continue;
    }

    currentValue = value;
    result[currentKey] = value;
  }

  // Flush trailing key
  if (currentKey && currentValue) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}

function countChar(str: string, char: string): number {
  let count = 0;
  for (const c of str) {
    if (c === char) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Metadata Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve Wundr-specific metadata from the raw frontmatter `metadata` field.
 * The metadata field is expected to be a JSON string containing a `wundr` key.
 */
export function resolveWundrMetadata(
  frontmatter: ParsedSkillFrontmatter
): WundrSkillMetadata | undefined {
  const raw = frontmatter['metadata'];
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    // Look for wundr-specific metadata (also support 'openclaw' for compat)
    const metadataObj = parsed['wundr'] ?? parsed['openclaw'];
    if (!metadataObj || typeof metadataObj !== 'object') {
      return undefined;
    }

    const requiresRaw =
      typeof metadataObj.requires === 'object' && metadataObj.requires !== null
        ? (metadataObj.requires as Record<string, unknown>)
        : undefined;

    const installRaw = Array.isArray(metadataObj.install)
      ? (metadataObj.install as unknown[])
      : [];
    const install = installRaw
      .map(entry => parseInstallSpec(entry))
      .filter((entry): entry is SkillInstallSpec => entry !== undefined);

    const osList = normalizeStringList(metadataObj.os);

    return {
      always:
        typeof metadataObj.always === 'boolean'
          ? metadataObj.always
          : undefined,
      emoji:
        typeof metadataObj.emoji === 'string' ? metadataObj.emoji : undefined,
      homepage:
        typeof metadataObj.homepage === 'string'
          ? metadataObj.homepage
          : undefined,
      skillKey:
        typeof metadataObj.skillKey === 'string'
          ? metadataObj.skillKey
          : undefined,
      primaryEnv:
        typeof metadataObj.primaryEnv === 'string'
          ? metadataObj.primaryEnv
          : undefined,
      category:
        typeof metadataObj.category === 'string'
          ? metadataObj.category
          : undefined,
      os: osList.length > 0 ? osList : undefined,
      requires: requiresRaw
        ? {
            bins: normalizeStringList(requiresRaw.bins),
            anyBins: normalizeStringList(requiresRaw.anyBins),
            env: normalizeStringList(requiresRaw.env),
            config: normalizeStringList(requiresRaw.config),
          }
        : undefined,
      install: install.length > 0 ? install : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Resolve the invocation policy from frontmatter flags.
 */
export function resolveInvocationPolicy(
  frontmatter: ParsedSkillFrontmatter
): SkillInvocationPolicy {
  return {
    userInvocable: parseBooleanValue(frontmatter['user-invocable']) ?? true,
    disableModelInvocation:
      parseBooleanValue(frontmatter['disable-model-invocation']) ?? false,
  };
}

/**
 * Resolve lifecycle hooks from frontmatter.
 */
export function resolveHooks(
  frontmatter: ParsedSkillFrontmatter
): SkillHooks | undefined {
  const before =
    frontmatter['hook-before']?.trim() || frontmatter['hooks-before']?.trim();
  const after =
    frontmatter['hook-after']?.trim() || frontmatter['hooks-after']?.trim();

  if (!before && !after) {
    return undefined;
  }
  const hooks: SkillHooks = {};
  if (before) {
    hooks.before = before;
  }
  if (after) {
    hooks.after = after;
  }
  return hooks;
}

/**
 * Resolve a strongly-typed SkillFrontmatter from raw key-value pairs.
 */
export function resolveSkillFrontmatter(
  raw: ParsedSkillFrontmatter
): SkillFrontmatter | undefined {
  const name = raw['name']?.trim();
  const description = raw['description']?.trim();

  if (!name || !description) {
    return undefined;
  }

  const result: SkillFrontmatter = { name, description };

  const context = raw['context']?.trim().toLowerCase();
  if (context === 'fork' || context === 'inline') {
    result.context = context;
  }

  const model = raw['model']?.trim();
  if (model) {
    result.model = model;
  }

  const tools = raw['tools']?.trim();
  if (tools) {
    result.tools = normalizeStringList(tools);
  }

  const allowedTools = raw['allowed_tools'] ?? raw['allowed-tools'];
  if (allowedTools) {
    result.allowedTools = normalizeStringList(allowedTools);
  }

  if (raw['user-invocable'] !== undefined) {
    result.userInvocable = parseBooleanValue(raw['user-invocable']);
  }
  if (raw['disable-model-invocation'] !== undefined) {
    result.disableModelInvocation = parseBooleanValue(
      raw['disable-model-invocation']
    );
  }

  const tags = raw['tags']?.trim();
  if (tags) {
    result.tags = normalizeStringList(tags);
  }

  const metadataRaw = raw['metadata']?.trim();
  if (metadataRaw) {
    try {
      result.metadata = JSON.parse(metadataRaw);
    } catch {
      // Skip malformed metadata
    }
  }

  // Hooks
  const hooks = resolveHooks(raw);
  if (hooks) {
    result.hooks = hooks;
  }

  // Dependencies
  const deps = raw['dependencies']?.trim() || raw['depends-on']?.trim();
  if (deps) {
    result.dependencies = normalizeStringList(deps);
  }

  // Version
  const version = raw['version']?.trim();
  if (version) {
    result.version = version;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Install Preferences
// ---------------------------------------------------------------------------

/**
 * Resolve install preferences from skills configuration (OpenClaw-compatible).
 */
export function resolveInstallPreferences(
  config?: SkillsConfig
): SkillsInstallPreferences {
  const raw = config?.install;
  const preferBrew = raw?.preferBrew ?? true;
  const managerRaw =
    typeof raw?.nodeManager === 'string' ? raw.nodeManager.trim() : '';
  const manager = managerRaw.toLowerCase();
  const nodeManager: SkillsInstallPreferences['nodeManager'] =
    manager === 'pnpm' ||
    manager === 'yarn' ||
    manager === 'bun' ||
    manager === 'npm'
      ? manager
      : 'npm';
  const prefRaw = raw?.preference?.trim().toLowerCase() ?? '';
  const preference: SkillsInstallPreferences['preference'] =
    prefRaw === 'accept' || prefRaw === 'reject' || prefRaw === 'ask'
      ? prefRaw
      : 'ask';
  return { preferBrew, nodeManager, preference };
}

// ---------------------------------------------------------------------------
// Directory Scanning
// ---------------------------------------------------------------------------

/**
 * Load all skills from a single directory.
 *
 * Supports two layouts:
 * 1. Flat: directory contains individual .md files (each is a skill)
 * 2. Nested: directory contains subdirectories, each with a SKILL.md
 *
 * Uses the parse cache to avoid re-parsing unchanged files.
 */
export function loadSkillsFromDir(dir: string, source: SkillSource): Skill[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const skills: Skill[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name === 'node_modules') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Nested layout: look for SKILL.md inside the directory
      const skillFile = path.join(fullPath, SKILL_FILENAME);
      if (fs.existsSync(skillFile)) {
        const skill = loadSingleSkill(skillFile, fullPath, source);
        if (skill) {
          skills.push(skill);
        }
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      entry.name !== 'README.md'
    ) {
      // Flat layout: .md file is itself a skill
      const skill = loadSingleSkill(fullPath, dir, source);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * Load a single skill from a SKILL.md file path, using cache when available.
 */
function loadSingleSkill(
  filePath: string,
  baseDir: string,
  source: SkillSource
): Skill | undefined {
  const resolvedPath = path.resolve(filePath);

  // Check cache first
  const cached = getCachedSkill(resolvedPath);
  if (cached) {
    // Return cached with potentially updated source (source depends on call site)
    return { ...cached, source };
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const { frontmatter: raw, body } = parseFrontmatter(content);
  const frontmatter = resolveSkillFrontmatter(raw);

  let skill: Skill | undefined;

  if (!frontmatter) {
    // Fall back to using filename as name if frontmatter is incomplete
    const basename = path.basename(filePath, path.extname(filePath));
    if (basename === 'SKILL') {
      // Use parent directory name
      const dirName = path.basename(baseDir);
      skill = {
        name: dirName,
        description: `Skill: ${dirName}`,
        filePath: resolvedPath,
        baseDir: path.resolve(baseDir),
        source,
        body,
        frontmatter: {
          name: dirName,
          description: `Skill: ${dirName}`,
        },
        tags: [],
      };
    }
  } else {
    skill = {
      name: frontmatter.name,
      description: frontmatter.description,
      filePath: resolvedPath,
      baseDir: path.resolve(baseDir),
      source,
      body,
      frontmatter,
      tags: frontmatter.tags ?? [],
    };
  }

  // Cache the result (even if undefined, to avoid re-parsing bad files)
  setCachedSkill(resolvedPath, skill);
  return skill;
}

// ---------------------------------------------------------------------------
// Multi-Directory Loading
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the bundled skills directory.
 * Looks for a `skills/` directory relative to the package root.
 */
export function resolveBundledSkillsDir(): string | undefined {
  const override = process.env['WUNDR_BUNDLED_SKILLS_DIR']?.trim();
  if (override && fs.existsSync(override)) {
    return override;
  }

  // Look relative to this module's location
  let current = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(current, 'skills');
    if (looksLikeSkillsDir(candidate)) {
      return candidate;
    }

    const next = path.dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return undefined;
}

/**
 * Resolve all auto-discovery directories for skills (OpenClaw-compatible).
 * Returns directories in precedence order (lowest to highest).
 */
export function resolveDiscoveryDirs(
  workspaceDir: string,
  config?: SkillsConfig,
  managedSkillsDir?: string,
  bundledSkillsDir?: string
): Array<{ dir: string; source: SkillSource }> {
  const dirs: Array<{ dir: string; source: SkillSource }> = [];

  // Extra dirs (lowest precedence)
  const extraDirs = (config?.load?.extraDirs ?? [])
    .map(d => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean)
    .map(d => resolveUserPath(d));
  for (const dir of extraDirs) {
    dirs.push({ dir, source: 'extra' });
  }

  // Bundled
  const resolvedBundledDir = bundledSkillsDir ?? resolveBundledSkillsDir();
  if (resolvedBundledDir) {
    dirs.push({ dir: resolvedBundledDir, source: 'bundled' });
  }

  // Managed (user global)
  const resolvedManagedDir = managedSkillsDir ?? MANAGED_SKILLS_DIR;
  dirs.push({ dir: resolvedManagedDir, source: 'managed' });

  // Also check ~/.claude/skills/ for global OpenClaw-style skills
  const claudeGlobal = path.join(os.homedir(), '.claude', 'skills');
  dirs.push({ dir: claudeGlobal, source: 'managed' });

  // Workspace: project-local ./skills/ and .claude/skills/ (OpenClaw compat)
  dirs.push({ dir: path.join(workspaceDir, 'skills'), source: 'workspace' });
  dirs.push({
    dir: path.join(workspaceDir, '.claude', 'skills'),
    source: 'workspace',
  });

  return dirs;
}

/**
 * Load skill entries from all configured directories, applying precedence.
 *
 * @param workspaceDir - The current workspace/project root directory
 * @param config - Skills configuration
 * @param managedSkillsDir - Override for the managed skills directory
 * @param bundledSkillsDir - Override for the bundled skills directory
 * @returns Merged skill entries with higher-precedence sources overriding lower
 */
export function loadAllSkillEntries(
  workspaceDir: string,
  config?: SkillsConfig,
  managedSkillsDir?: string,
  bundledSkillsDir?: string
): SkillEntry[] {
  const discoveryDirs = resolveDiscoveryDirs(
    workspaceDir,
    config,
    managedSkillsDir,
    bundledSkillsDir
  );

  // Load from all directories in precedence order
  const merged = new Map<string, Skill>();
  for (const { dir, source } of discoveryDirs) {
    const skills = loadSkillsFromDir(dir, source);
    for (const skill of skills) {
      merged.set(skill.name, skill);
    }
  }

  // Build entries with resolved metadata
  return Array.from(merged.values()).map(skill => {
    const raw = parseFrontmatter(
      fs.readFileSync(skill.filePath, 'utf-8')
    ).frontmatter;

    return {
      skill,
      rawFrontmatter: raw,
      metadata: resolveWundrMetadata(raw),
      invocation: resolveInvocationPolicy(raw),
    };
  });
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

/**
 * Format skill entries into a prompt string for injection into system context.
 *
 * Uses progressive disclosure: only name + description are included in the
 * always-present prompt. The full body is loaded on demand when a skill triggers.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }

  const lines: string[] = ['Available skills (invoke with /skill-name):', ''];

  for (const skill of skills) {
    const emoji = skill.frontmatter.metadata?.['wundr']
      ? ((skill.frontmatter.metadata['wundr'] as Record<string, unknown>)?.[
          'emoji'
        ] ?? '')
      : '';
    const prefix = emoji ? `${emoji} ` : '';
    const version = skill.frontmatter.version
      ? ` (v${skill.frontmatter.version})`
      : '';
    const context = skill.frontmatter.context === 'fork' ? ' [fork]' : '';
    lines.push(
      `- **${prefix}${skill.name}**${version}${context}: ${skill.description}`
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function normalizeStringList(input: unknown): string[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    // Handle both comma-separated and YAML array notation
    const cleaned = input.replace(/^\[|\]$/g, '');
    return cleaned
      .split(',')
      .map(v => v.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const raw = input as Record<string, unknown>;
  const kindRaw =
    typeof raw.kind === 'string'
      ? raw.kind
      : typeof raw.type === 'string'
        ? raw.type
        : '';
  const kind = kindRaw.trim().toLowerCase();

  const validKinds = ['brew', 'apt', 'node', 'go', 'uv', 'download'];
  if (!validKinds.includes(kind)) {
    return undefined;
  }

  const spec: SkillInstallSpec = {
    kind: kind as SkillInstallSpec['kind'],
  };

  if (typeof raw.id === 'string') {
    spec.id = raw.id;
  }
  if (typeof raw.label === 'string') {
    spec.label = raw.label;
  }
  const bins = normalizeStringList(raw.bins);
  if (bins.length > 0) {
    spec.bins = bins;
  }
  const osList = normalizeStringList(raw.os);
  if (osList.length > 0) {
    spec.os = osList;
  }
  if (typeof raw.formula === 'string') {
    spec.formula = raw.formula;
  }
  if (typeof raw.package === 'string') {
    spec.package = raw.package;
  }
  if (typeof raw.module === 'string') {
    spec.module = raw.module;
  }
  if (typeof raw.url === 'string') {
    spec.url = raw.url;
  }
  if (typeof raw.archive === 'string') {
    spec.archive = raw.archive;
  }
  if (typeof raw.extract === 'boolean') {
    spec.extract = raw.extract;
  }
  if (typeof raw.stripComponents === 'number') {
    spec.stripComponents = raw.stripComponents;
  }
  if (typeof raw.targetDir === 'string') {
    spec.targetDir = raw.targetDir;
  }

  return spec;
}

export function parseBooleanValue(
  value: string | undefined
): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const lower = String(value).trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  return undefined;
}

export function resolveUserPath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return path.resolve(inputPath);
}

function looksLikeSkillsDir(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        return true;
      }
      if (entry.isDirectory()) {
        if (fs.existsSync(path.join(dir, entry.name, SKILL_FILENAME))) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}
