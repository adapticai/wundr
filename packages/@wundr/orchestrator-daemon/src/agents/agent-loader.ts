/**
 * @wundr/orchestrator-daemon - Agent Loader
 *
 * Discovers and parses agent definitions from .claude/agents/ directory.
 * Each agent is a markdown file with YAML frontmatter containing metadata
 * and a markdown body used as the system prompt.
 *
 * Supports:
 * - Recursive directory scanning
 * - YAML frontmatter parsing with Zod validation
 * - Agent inheritance via `extends` field
 * - File-mtime-based cache invalidation
 * - Category derivation from directory structure
 */

import * as fs from 'fs';
import * as path from 'path';

import { AgentMetadataSchema } from './agent-types';

import type { AgentDefinition, AgentMetadata } from './agent-types';

// =============================================================================
// Types
// =============================================================================

export interface AgentLoaderOptions {
  /** Root directory containing agent .md files */
  readonly agentsDir: string;
  /** Whether to log validation warnings. Default: true */
  readonly logWarnings?: boolean;
  /** Custom logger function. Default: console.warn */
  readonly logger?: (message: string) => void;
}

interface ParsedAgentFile {
  readonly metadata: Record<string, unknown>;
  readonly body: string;
  readonly filePath: string;
  readonly mtime: number;
}

interface LoadResult {
  readonly definitions: AgentDefinition[];
  readonly errors: LoadError[];
}

interface LoadError {
  readonly filePath: string;
  readonly error: string;
}

// =============================================================================
// YAML Frontmatter Parser
// =============================================================================

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

/**
 * Parses YAML frontmatter from a markdown string.
 * Uses a simple key-value parser to avoid heavy YAML library dependency.
 * Handles nested objects, arrays, multiline strings, and quoted values.
 */
function parseFrontmatter(
  content: string
): { metadata: Record<string, unknown>; body: string } | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const yamlText = match[1];
  const body = (match[2] ?? '').trim();

  try {
    const metadata = parseSimpleYaml(yamlText);
    return { metadata, body };
  } catch {
    return null;
  }
}

/**
 * Lightweight YAML parser for agent frontmatter.
 * Handles the subset of YAML used in agent definitions:
 * - Scalar values (strings, numbers, booleans)
 * - Arrays (both inline and block)
 * - Nested objects
 * - Multiline strings (| and >)
 * - Quoted strings
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (indent > 0) {
      // Nested content handled by parent key parser
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (!key) {
      i++;
      continue;
    }

    // Multiline string (| or >)
    if (rawValue === '|' || rawValue === '>') {
      const multilineValue = collectMultilineString(lines, i + 1);
      result[key] = multilineValue.value;
      i = multilineValue.nextIndex;
      continue;
    }

    // Block array
    if (rawValue === '') {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.trimStart().startsWith('-')) {
        const arrayResult = collectBlockArray(lines, i + 1);
        result[key] = arrayResult.value;
        i = arrayResult.nextIndex;
        continue;
      }

      // Nested object
      const objectResult = collectNestedObject(lines, i + 1);
      if (objectResult.value && Object.keys(objectResult.value).length > 0) {
        result[key] = objectResult.value;
        i = objectResult.nextIndex;
        continue;
      }

      result[key] = '';
      i++;
      continue;
    }

    // Inline array
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1);
      result[key] = inner
        .split(',')
        .map(v => parseScalar(v.trim()))
        .filter(v => v !== '');
      i++;
      continue;
    }

    // Scalar value
    result[key] = parseScalar(rawValue);
    i++;
  }

  return result;
}

function collectMultilineString(
  lines: string[],
  startIndex: number
): { value: string; nextIndex: number } {
  const parts: string[] = [];
  let i = startIndex;
  const baseIndent = getIndent(lines[i] ?? '');

  while (i < lines.length) {
    const line = lines[i];
    const currentIndent = getIndent(line);

    if (line.trim() === '') {
      parts.push('');
      i++;
      continue;
    }

    if (currentIndent < baseIndent && line.trim() !== '') {
      break;
    }

    parts.push(line.slice(baseIndent));
    i++;
  }

  // Trim trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }

  return { value: parts.join('\n'), nextIndex: i };
}

function collectBlockArray(
  lines: string[],
  startIndex: number
): { value: unknown[]; nextIndex: number } {
  const items: unknown[] = [];
  let i = startIndex;
  const baseIndent = getIndent(lines[i] ?? '');

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (line.trim() === '' || line.startsWith('#')) {
      i++;
      continue;
    }

    const currentIndent = getIndent(line);
    if (currentIndent < baseIndent) {
      break;
    }

    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();

      // Check if this array item starts a nested object
      if (
        value.includes(':') &&
        !value.startsWith("'") &&
        !value.startsWith('"')
      ) {
        // Could be a nested object in the array
        const colonIdx = value.indexOf(':');
        const objKey = value.slice(0, colonIdx).trim();
        const objVal = value.slice(colonIdx + 1).trim();

        if (objKey && !objKey.includes(' ')) {
          const nestedObj: Record<string, unknown> = {};
          nestedObj[objKey] = parseScalar(objVal);

          // Collect additional nested keys at deeper indent
          const nextI = i + 1;
          if (nextI < lines.length) {
            const nextIndent = getIndent(lines[nextI] ?? '');
            if (nextIndent > currentIndent + 2) {
              const nested = collectNestedObject(lines, nextI);
              Object.assign(nestedObj, nested.value);
              i = nested.nextIndex;
              items.push(nestedObj);
              continue;
            }
          }

          items.push(nestedObj);
        } else {
          items.push(parseScalar(value));
        }
      } else {
        items.push(parseScalar(value));
      }
    }

    i++;
  }

  return { value: items, nextIndex: i };
}

function collectNestedObject(
  lines: string[],
  startIndex: number
): { value: Record<string, unknown>; nextIndex: number } {
  const obj: Record<string, unknown> = {};
  let i = startIndex;

  if (i >= lines.length) {
    return { value: obj, nextIndex: i };
  }

  const baseIndent = getIndent(lines[i] ?? '');
  if (baseIndent === 0) {
    return { value: obj, nextIndex: i };
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (line.trim() === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const currentIndent = getIndent(line);
    if (currentIndent < baseIndent) {
      break;
    }

    if (currentIndent > baseIndent) {
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (!key) {
      i++;
      continue;
    }

    if (rawValue === '' || rawValue === '|' || rawValue === '>') {
      // Check for nested array or object
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.trimStart().startsWith('-')) {
        const arrayResult = collectBlockArray(lines, i + 1);
        obj[key] = arrayResult.value;
        i = arrayResult.nextIndex;
        continue;
      }

      if (rawValue === '|' || rawValue === '>') {
        const multiline = collectMultilineString(lines, i + 1);
        obj[key] = multiline.value;
        i = multiline.nextIndex;
        continue;
      }

      const nestedResult = collectNestedObject(lines, i + 1);
      if (Object.keys(nestedResult.value).length > 0) {
        obj[key] = nestedResult.value;
        i = nestedResult.nextIndex;
        continue;
      }

      obj[key] = '';
    } else {
      obj[key] = parseScalar(rawValue);
    }

    i++;
  }

  return { value: obj, nextIndex: i };
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function parseScalar(value: string): unknown {
  if (!value || value === '~' || value === 'null') {
    return null;
  }

  // Quoted strings - preserve as-is
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  // Booleans
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === 'no') {
    return false;
  }

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }

  return value;
}

// =============================================================================
// Agent Loader
// =============================================================================

export class AgentLoader {
  private readonly agentsDir: string;
  private readonly logWarnings: boolean;
  private readonly logger: (message: string) => void;
  private readonly cache: Map<string, AgentDefinition> = new Map();
  private readonly mtimeCache: Map<string, number> = new Map();

  constructor(options: AgentLoaderOptions) {
    this.agentsDir = path.resolve(options.agentsDir);
    this.logWarnings = options.logWarnings ?? true;
    this.logger = options.logger ?? console.warn;
  }

  /**
   * Loads all agent definitions from the configured directory.
   * Returns successfully parsed definitions and any errors encountered.
   */
  async loadAll(): Promise<LoadResult> {
    const definitions: AgentDefinition[] = [];
    const errors: LoadError[] = [];

    const files = this.discoverAgentFiles();

    // First pass: parse all files
    const parsedMap = new Map<string, ParsedAgentFile>();
    for (const filePath of files) {
      try {
        const parsed = this.parseFile(filePath);
        if (parsed) {
          const relPath = path.relative(this.agentsDir, filePath);
          parsedMap.set(relPath, parsed);
        }
      } catch (err) {
        errors.push({
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Second pass: resolve inheritance and validate
    for (const [relPath, parsed] of parsedMap) {
      try {
        const resolved = this.resolveInheritance(parsed, parsedMap);
        const definition = this.buildDefinition(resolved, relPath);
        if (definition) {
          definitions.push(definition);
          this.cache.set(definition.id, definition);
          this.mtimeCache.set(relPath, definition.mtime);
        }
      } catch (err) {
        errors.push({
          filePath: relPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { definitions, errors };
  }

  /**
   * Loads a single agent definition by file path.
   */
  loadOne(filePath: string): AgentDefinition | null {
    const absolutePath = path.resolve(this.agentsDir, filePath);
    const parsed = this.parseFile(absolutePath);
    if (!parsed) {
      return null;
    }

    const relPath = path.relative(this.agentsDir, absolutePath);
    return this.buildDefinition(parsed, relPath);
  }

  /**
   * Checks if any cached definitions need reloading based on file mtime.
   * Returns the IDs of definitions that have changed.
   */
  getStaleDefinitions(): string[] {
    const stale: string[] = [];

    for (const [relPath, cachedMtime] of this.mtimeCache) {
      const absolutePath = path.join(this.agentsDir, relPath);
      try {
        const stat = fs.statSync(absolutePath);
        if (stat.mtimeMs !== cachedMtime) {
          const cached = this.findDefinitionByPath(relPath);
          if (cached) {
            stale.push(cached.id);
          }
        }
      } catch {
        // File may have been deleted
        const cached = this.findDefinitionByPath(relPath);
        if (cached) {
          stale.push(cached.id);
        }
      }
    }

    return stale;
  }

  /**
   * Clears all cached definitions.
   */
  clearCache(): void {
    this.cache.clear();
    this.mtimeCache.clear();
  }

  /**
   * Gets a cached definition by ID.
   */
  getCached(agentId: string): AgentDefinition | undefined {
    return this.cache.get(agentId);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Recursively discovers all .md files in the agents directory,
   * excluding README.md files.
   */
  private discoverAgentFiles(): string[] {
    const files: string[] = [];

    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const lower = entry.name.toLowerCase();
        if (!lower.endsWith('.md')) {
          continue;
        }

        // Skip README files
        if (lower === 'readme.md') {
          continue;
        }

        files.push(fullPath);
      }
    };

    walk(this.agentsDir);
    return files.sort();
  }

  /**
   * Parses a single .md file into metadata and body.
   */
  private parseFile(filePath: string): ParsedAgentFile | null {
    let content: string;
    let stat: fs.Stats;

    try {
      content = fs.readFileSync(filePath, 'utf-8');
      stat = fs.statSync(filePath);
    } catch {
      return null;
    }

    const parsed = parseFrontmatter(content);
    if (!parsed) {
      if (this.logWarnings) {
        this.logger(`[AgentLoader] No frontmatter found in ${filePath}`);
      }
      return null;
    }

    if (!parsed.metadata.name) {
      if (this.logWarnings) {
        this.logger(
          `[AgentLoader] Missing 'name' in frontmatter of ${filePath}`
        );
      }
      return null;
    }

    return {
      metadata: parsed.metadata,
      body: parsed.body,
      filePath,
      mtime: stat.mtimeMs,
    };
  }

  /**
   * Resolves the `extends` field by merging parent metadata.
   * Parent is looked up by relative path (e.g., "core/coder").
   */
  private resolveInheritance(
    parsed: ParsedAgentFile,
    allParsed: Map<string, ParsedAgentFile>
  ): ParsedAgentFile {
    const extendsRef = parsed.metadata.extends;
    if (typeof extendsRef !== 'string' || !extendsRef.trim()) {
      return parsed;
    }

    // Find parent by relative path (with or without .md extension)
    const parentPath = extendsRef.endsWith('.md')
      ? extendsRef
      : `${extendsRef}.md`;

    const parent = allParsed.get(parentPath);
    if (!parent) {
      if (this.logWarnings) {
        this.logger(
          `[AgentLoader] Cannot resolve extends "${extendsRef}" for ${parsed.filePath}`
        );
      }
      return parsed;
    }

    // Recursively resolve parent's inheritance first
    const resolvedParent = this.resolveInheritance(parent, allParsed);

    // Deep merge: child overrides parent, arrays are concatenated for capabilities
    const mergedMetadata = this.mergeMetadata(
      resolvedParent.metadata,
      parsed.metadata
    );

    return {
      ...parsed,
      metadata: mergedMetadata,
      // System prompt: child body takes precedence; fall back to parent
      body: parsed.body || resolvedParent.body,
    };
  }

  /**
   * Merges parent and child metadata objects.
   * Child values override parent values.
   * `capabilities` arrays are concatenated and deduplicated.
   */
  private mergeMetadata(
    parent: Record<string, unknown>,
    child: Record<string, unknown>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...parent };

    for (const [key, value] of Object.entries(child)) {
      if (key === 'extends') {
        // Don't propagate extends to merged result
        continue;
      }

      if (key === 'capabilities') {
        // Concatenate and deduplicate capabilities
        const parentCaps = Array.isArray(parent.capabilities)
          ? parent.capabilities
          : [];
        const childCaps = Array.isArray(value) ? value : [];
        merged.capabilities = [...new Set([...parentCaps, ...childCaps])];
        continue;
      }

      if (key === 'tools') {
        // Concatenate and deduplicate tools
        const parentTools = Array.isArray(parent.tools) ? parent.tools : [];
        const childTools = Array.isArray(value) ? value : [];
        merged.tools = [...new Set([...parentTools, ...childTools])];
        continue;
      }

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        parent[key] !== null &&
        typeof parent[key] === 'object' &&
        !Array.isArray(parent[key])
      ) {
        // Deep merge nested objects
        merged[key] = {
          ...(parent[key] as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        };
        continue;
      }

      merged[key] = value;
    }

    return merged;
  }

  /**
   * Builds a validated AgentDefinition from parsed file data.
   */
  private buildDefinition(
    parsed: ParsedAgentFile,
    relativePath: string
  ): AgentDefinition | null {
    // Validate metadata against schema (passthrough mode: allow extra fields)
    const validation = AgentMetadataSchema.safeParse(parsed.metadata);

    let metadata: AgentMetadata;
    if (validation.success) {
      metadata = validation.data;
    } else {
      if (this.logWarnings) {
        const issues = validation.error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        this.logger(
          `[AgentLoader] Validation warnings for ${relativePath}: ${issues}`
        );
      }
      // Fail-soft: use raw metadata with just the name requirement
      const name = parsed.metadata.name;
      if (typeof name !== 'string' || !name.trim()) {
        return null;
      }
      metadata = parsed.metadata as AgentMetadata;
    }

    // Derive category from directory structure
    const dirParts = path.dirname(relativePath).split(path.sep);
    const category =
      dirParts[0] === '.' ? 'root' : dirParts.filter(Boolean).join('/');

    // Normalize agent ID: lowercase, trim
    const id = metadata.name.toLowerCase().trim();

    return {
      id,
      metadata,
      systemPrompt: parsed.body,
      sourcePath: relativePath,
      category,
      mtime: parsed.mtime,
    };
  }

  /**
   * Finds a cached definition by its source path.
   */
  private findDefinitionByPath(relPath: string): AgentDefinition | undefined {
    for (const def of this.cache.values()) {
      if (def.sourcePath === relPath) {
        return def;
      }
    }
    return undefined;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates an AgentLoader for the standard .claude/agents/ directory.
 */
export function createAgentLoader(projectRoot: string): AgentLoader {
  return new AgentLoader({
    agentsDir: path.join(projectRoot, '.claude', 'agents'),
  });
}
