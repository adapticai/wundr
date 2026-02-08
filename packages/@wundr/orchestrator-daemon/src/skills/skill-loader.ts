/**
 * Skill Loader
 *
 * Discovers and parses SKILL.md files from multiple directories with
 * configurable precedence. Handles YAML frontmatter parsing, metadata
 * resolution, and multi-source merging.
 *
 * Directory precedence (lowest to highest):
 * 1. Extra dirs (configured via skills.load.extraDirs)
 * 2. Bundled (ships with Wundr)
 * 3. Managed (user's global ~/.wundr/skills/)
 * 4. Workspace (project-local ./skills/)
 *
 * @module skills/skill-loader
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type {
  ParsedSkillFrontmatter,
  Skill,
  SkillEntry,
  SkillFrontmatter,
  SkillInvocationPolicy,
  SkillSource,
  SkillsConfig,
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
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
    if (c === char) count++;
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
  frontmatter: ParsedSkillFrontmatter,
): WundrSkillMetadata | undefined {
  const raw = frontmatter['metadata'];
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;

    // Look for wundr-specific metadata (also support 'openclaw' for compat)
    const metadataObj = parsed['wundr'] ?? parsed['openclaw'];
    if (!metadataObj || typeof metadataObj !== 'object') return undefined;

    const requiresRaw = typeof metadataObj.requires === 'object' && metadataObj.requires !== null
      ? metadataObj.requires as Record<string, unknown>
      : undefined;

    const installRaw = Array.isArray(metadataObj.install)
      ? metadataObj.install as unknown[]
      : [];
    const install = installRaw
      .map(entry => parseInstallSpec(entry))
      .filter((entry): entry is SkillInstallSpec => entry !== undefined);

    const osList = normalizeStringList(metadataObj.os);

    return {
      always: typeof metadataObj.always === 'boolean' ? metadataObj.always : undefined,
      emoji: typeof metadataObj.emoji === 'string' ? metadataObj.emoji : undefined,
      homepage: typeof metadataObj.homepage === 'string' ? metadataObj.homepage : undefined,
      skillKey: typeof metadataObj.skillKey === 'string' ? metadataObj.skillKey : undefined,
      primaryEnv: typeof metadataObj.primaryEnv === 'string' ? metadataObj.primaryEnv : undefined,
      category: typeof metadataObj.category === 'string' ? metadataObj.category : undefined,
      os: osList.length > 0 ? osList : undefined,
      requires: requiresRaw ? {
        bins: normalizeStringList(requiresRaw.bins),
        anyBins: normalizeStringList(requiresRaw.anyBins),
        env: normalizeStringList(requiresRaw.env),
        config: normalizeStringList(requiresRaw.config),
      } : undefined,
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
  frontmatter: ParsedSkillFrontmatter,
): SkillInvocationPolicy {
  return {
    userInvocable: parseBooleanValue(frontmatter['user-invocable']) ?? true,
    disableModelInvocation: parseBooleanValue(frontmatter['disable-model-invocation']) ?? false,
  };
}

/**
 * Resolve a strongly-typed SkillFrontmatter from raw key-value pairs.
 */
export function resolveSkillFrontmatter(
  raw: ParsedSkillFrontmatter,
): SkillFrontmatter | undefined {
  const name = raw['name']?.trim();
  const description = raw['description']?.trim();

  if (!name || !description) return undefined;

  const result: SkillFrontmatter = { name, description };

  const context = raw['context']?.trim().toLowerCase();
  if (context === 'fork' || context === 'inline') {
    result.context = context;
  }

  const model = raw['model']?.trim();
  if (model) result.model = model;

  const tools = raw['tools']?.trim();
  if (tools) result.tools = normalizeStringList(tools);

  const allowedTools = raw['allowed_tools'] ?? raw['allowed-tools'];
  if (allowedTools) result.allowedTools = normalizeStringList(allowedTools);

  if (raw['user-invocable'] !== undefined) {
    result.userInvocable = parseBooleanValue(raw['user-invocable']);
  }
  if (raw['disable-model-invocation'] !== undefined) {
    result.disableModelInvocation = parseBooleanValue(raw['disable-model-invocation']);
  }

  const metadataRaw = raw['metadata']?.trim();
  if (metadataRaw) {
    try {
      result.metadata = JSON.parse(metadataRaw);
    } catch {
      // Skip malformed metadata
    }
  }

  return result;
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
 */
export function loadSkillsFromDir(
  dir: string,
  source: SkillSource,
): Skill[] {
  if (!fs.existsSync(dir)) return [];

  const skills: Skill[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Nested layout: look for SKILL.md inside the directory
      const skillFile = path.join(fullPath, SKILL_FILENAME);
      if (fs.existsSync(skillFile)) {
        const skill = loadSingleSkill(skillFile, fullPath, source);
        if (skill) skills.push(skill);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      // Flat layout: .md file is itself a skill
      const skill = loadSingleSkill(fullPath, dir, source);
      if (skill) skills.push(skill);
    }
  }

  return skills;
}

/**
 * Load a single skill from a SKILL.md file path.
 */
function loadSingleSkill(
  filePath: string,
  baseDir: string,
  source: SkillSource,
): Skill | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const { frontmatter: raw, body } = parseFrontmatter(content);
  const frontmatter = resolveSkillFrontmatter(raw);

  if (!frontmatter) {
    // Fall back to using filename as name if frontmatter is incomplete
    const basename = path.basename(filePath, path.extname(filePath));
    if (basename === 'SKILL') {
      // Use parent directory name
      const dirName = path.basename(baseDir);
      return {
        name: dirName,
        description: `Skill: ${dirName}`,
        filePath: path.resolve(filePath),
        baseDir: path.resolve(baseDir),
        source,
        body,
        frontmatter: {
          name: dirName,
          description: `Skill: ${dirName}`,
        },
      };
    }
    return undefined;
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    filePath: path.resolve(filePath),
    baseDir: path.resolve(baseDir),
    source,
    body,
    frontmatter,
  };
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
  if (override && fs.existsSync(override)) return override;

  // Look relative to this module's location
  let current = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(current, 'skills');
    if (looksLikeSkillsDir(candidate)) return candidate;

    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }

  return undefined;
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
  bundledSkillsDir?: string,
): SkillEntry[] {
  const resolvedManagedDir = managedSkillsDir ?? MANAGED_SKILLS_DIR;
  const resolvedBundledDir = bundledSkillsDir ?? resolveBundledSkillsDir();

  // Extra dirs (lowest precedence)
  const extraDirs = (config?.load?.extraDirs ?? [])
    .map(d => typeof d === 'string' ? d.trim() : '')
    .filter(Boolean)
    .map(d => resolveUserPath(d));
  const extraSkills = extraDirs.flatMap(dir => loadSkillsFromDir(dir, 'extra'));

  // Bundled skills
  const bundledSkills = resolvedBundledDir
    ? loadSkillsFromDir(resolvedBundledDir, 'bundled')
    : [];

  // Managed skills (user global)
  const managedSkills = loadSkillsFromDir(resolvedManagedDir, 'managed');

  // Workspace skills (highest precedence)
  const workspaceSkillsDirs = [
    path.join(workspaceDir, 'skills'),
    path.join(workspaceDir, '.claude', 'skills'),
  ];
  const workspaceSkills = workspaceSkillsDirs.flatMap(
    dir => loadSkillsFromDir(dir, 'workspace'),
  );

  // Merge by name with precedence: extra < bundled < managed < workspace
  const merged = new Map<string, Skill>();
  for (const skill of extraSkills) merged.set(skill.name, skill);
  for (const skill of bundledSkills) merged.set(skill.name, skill);
  for (const skill of managedSkills) merged.set(skill.name, skill);
  for (const skill of workspaceSkills) merged.set(skill.name, skill);

  // Build entries with resolved metadata
  return Array.from(merged.values()).map(skill => {
    const raw = parseFrontmatter(
      fs.readFileSync(skill.filePath, 'utf-8'),
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
  if (skills.length === 0) return '';

  const lines: string[] = [
    'Available skills (invoke with /skill-name):',
    '',
  ];

  for (const skill of skills) {
    const emoji = skill.frontmatter.metadata?.['wundr']
      ? (skill.frontmatter.metadata['wundr'] as Record<string, unknown>)?.['emoji'] ?? ''
      : '';
    const prefix = emoji ? `${emoji} ` : '';
    lines.push(`- **${prefix}${skill.name}**: ${skill.description}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function normalizeStringList(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    // Handle both comma-separated and YAML array notation
    const cleaned = input.replace(/^\[|\]$/g, '');
    return cleaned.split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [];
}

function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  if (!input || typeof input !== 'object') return undefined;

  const raw = input as Record<string, unknown>;
  const kindRaw = typeof raw.kind === 'string'
    ? raw.kind
    : typeof raw.type === 'string' ? raw.type : '';
  const kind = kindRaw.trim().toLowerCase();

  const validKinds = ['brew', 'apt', 'node', 'go', 'uv', 'download'];
  if (!validKinds.includes(kind)) return undefined;

  const spec: SkillInstallSpec = {
    kind: kind as SkillInstallSpec['kind'],
  };

  if (typeof raw.id === 'string') spec.id = raw.id;
  if (typeof raw.label === 'string') spec.label = raw.label;
  const bins = normalizeStringList(raw.bins);
  if (bins.length > 0) spec.bins = bins;
  const osList = normalizeStringList(raw.os);
  if (osList.length > 0) spec.os = osList;
  if (typeof raw.formula === 'string') spec.formula = raw.formula;
  if (typeof raw.package === 'string') spec.package = raw.package;
  if (typeof raw.module === 'string') spec.module = raw.module;
  if (typeof raw.url === 'string') spec.url = raw.url;
  if (typeof raw.archive === 'string') spec.archive = raw.archive;
  if (typeof raw.extract === 'boolean') spec.extract = raw.extract;
  if (typeof raw.stripComponents === 'number') spec.stripComponents = raw.stripComponents;
  if (typeof raw.targetDir === 'string') spec.targetDir = raw.targetDir;

  return spec;
}

function parseBooleanValue(value: string | undefined): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const lower = String(value).trim().toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return undefined;
}

function resolveUserPath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return path.resolve(inputPath);
}

function looksLikeSkillsDir(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isFile() && entry.name.endsWith('.md')) return true;
      if (entry.isDirectory()) {
        if (fs.existsSync(path.join(dir, entry.name, SKILL_FILENAME))) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
