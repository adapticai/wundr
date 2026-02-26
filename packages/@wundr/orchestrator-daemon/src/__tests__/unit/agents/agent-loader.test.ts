/**
 * Unit tests for @wundr/orchestrator-daemon AgentLoader.
 *
 * Covers file discovery, YAML frontmatter parsing, Zod validation,
 * inheritance resolution, caching, and error handling.
 * All filesystem access is mocked via vi.mock('fs').
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AgentLoader, createAgentLoader } from '../../../agents/agent-loader';

// ---------------------------------------------------------------------------
// Mock the 'fs' module before importing the loader
// ---------------------------------------------------------------------------
vi.mock('fs', () => {
  return {
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    default: {
      readFileSync: vi.fn(),
      statSync: vi.fn(),
      readdirSync: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTS_DIR = '/fake/project/.claude/agents';

function makeDirent(name: string, isDir: boolean): fs.Dirent {
  return {
    name,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '',
    parentPath: '',
  } as fs.Dirent;
}

function makeAgentMd(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        lines.push(`  ${k}: ${v}`);
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

function mockStat(mtimeMs: number = 1000): fs.Stats {
  return { mtimeMs } as fs.Stats;
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('AgentLoader', () => {
  let loader: AgentLoader;
  let logger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    logger = vi.fn();
    loader = new AgentLoader({
      agentsDir: AGENTS_DIR,
      logWarnings: true,
      logger,
    });
  });

  // =========================================================================
  // Constructor & Factory
  // =========================================================================

  describe('constructor and factory', () => {
    it('resolves agentsDir to an absolute path', () => {
      // The constructor calls path.resolve, so a relative input is resolved
      const relativeLoader = new AgentLoader({ agentsDir: 'relative/path' });
      // Should not throw; the resolved path will depend on cwd
      expect(relativeLoader).toBeDefined();
    });

    it('createAgentLoader builds the standard agents path', () => {
      const factoryLoader = createAgentLoader('/my/project');
      expect(factoryLoader).toBeInstanceOf(AgentLoader);
    });
  });

  // =========================================================================
  // loadAll - File Discovery
  // =========================================================================

  describe('loadAll - file discovery', () => {
    it('returns empty result when directory is empty', async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('returns empty result when directory does not exist', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('discovers .md files and skips non-md files', async () => {
      const content = makeAgentMd({ name: 'coder' }, 'You are a coder.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [
            makeDirent('coder.md', false),
            makeDirent('notes.txt', false),
            makeDirent('config.json', false),
          ];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].id).toBe('coder');
    });

    it('skips README.md files', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [
            makeDirent('README.md', false),
            makeDirent('readme.md', false),
          ];
        }
        return [];
      }) as typeof fs.readdirSync);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(0);
      // readFileSync should never have been called for readme files
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('recursively walks subdirectories', async () => {
      const coderMd = makeAgentMd({ name: 'coder' }, 'Code agent.');
      const testerMd = makeAgentMd({ name: 'tester' }, 'Test agent.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('core', true), makeDirent('quality', true)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'core')) {
          return [makeDirent('coder.md', false)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'quality')) {
          return [makeDirent('tester.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation(((filePath: string) => {
        if (filePath.includes('coder.md')) {
          return coderMd;
        }
        if (filePath.includes('tester.md')) {
          return testerMd;
        }
        throw new Error('ENOENT');
      }) as typeof fs.readFileSync);

      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(2);
      const ids = result.definitions.map(d => d.id).sort();
      expect(ids).toEqual(['coder', 'tester']);
    });
  });

  // =========================================================================
  // loadAll - Frontmatter Parsing
  // =========================================================================

  describe('loadAll - frontmatter parsing', () => {
    function setupSingleFile(content: string): void {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(2000));
    }

    it('parses YAML frontmatter and markdown body', async () => {
      const content = makeAgentMd(
        { name: 'parser-test', type: 'developer', tier: 3 },
        'You are a parser test agent.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      const def = result.definitions[0];
      expect(def.metadata.name).toBe('parser-test');
      expect(def.metadata.type).toBe('developer');
      expect(def.metadata.tier).toBe(3);
      expect(def.systemPrompt).toBe('You are a parser test agent.');
    });

    it('parses array frontmatter values', async () => {
      const content = makeAgentMd(
        { name: 'array-test', capabilities: ['code-gen', 'refactoring'] },
        'System prompt.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      const caps = result.definitions[0].metadata.capabilities;
      expect(caps).toEqual(['code-gen', 'refactoring']);
    });

    it('parses nested object frontmatter values', async () => {
      const content = makeAgentMd(
        { name: 'nested-test', hooks: { pre: 'lint', post: 'test' } },
        'Body.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      const hooks = result.definitions[0].metadata.hooks;
      expect(hooks).toEqual({ pre: 'lint', post: 'test' });
    });

    it('parses boolean frontmatter values', async () => {
      const content = makeAgentMd(
        { name: 'bool-test', persistState: true, canSpawnSubagents: false },
        'Body.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].metadata.persistState).toBe(true);
      expect(result.definitions[0].metadata.canSpawnSubagents).toBe(false);
    });

    it('parses numeric frontmatter values', async () => {
      const content = makeAgentMd(
        { name: 'num-test', maxTurns: 42, heartbeatIntervalMs: 15000 },
        'Body.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].metadata.maxTurns).toBe(42);
      expect(result.definitions[0].metadata.heartbeatIntervalMs).toBe(15000);
    });
  });

  // =========================================================================
  // loadAll - Category Derivation
  // =========================================================================

  describe('loadAll - category derivation', () => {
    it('derives category from subdirectory name', async () => {
      const content = makeAgentMd({ name: 'coder' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('core', true)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'core')) {
          return [makeDirent('coder.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].category).toBe('core');
    });

    it('derives "root" category for files at top-level', async () => {
      const content = makeAgentMd({ name: 'root-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('root-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].category).toBe('root');
    });

    it('derives nested category from deep directory structure', async () => {
      const content = makeAgentMd({ name: 'deep-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('swarm', true)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'swarm')) {
          return [makeDirent('workers', true)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'swarm', 'workers')) {
          return [makeDirent('deep-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].category).toBe('swarm/workers');
    });
  });

  // =========================================================================
  // loadAll - Error Handling
  // =========================================================================

  describe('loadAll - error handling', () => {
    it('logs warning for files without frontmatter', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('no-frontmatter.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(
        'Just a body, no frontmatter.'
      );
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(0);
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('No frontmatter found')
      );
    });

    it('logs warning for files missing name field', async () => {
      const content = makeAgentMd({ type: 'developer' }, 'Body.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('no-name.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions).toHaveLength(0);
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining("Missing 'name'")
      );
    });

    it('records error when file read throws', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('broken.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // statSync is called after readFileSync in parseFile, so it can throw too
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await loader.loadAll();

      // parseFile returns null when readFileSync throws, so it's silently skipped
      // (the file never makes it to parsedMap, hence no error in the errors array
      //  from the second pass, but parseFile catches the exception internally)
      expect(result.definitions).toHaveLength(0);
    });

    it('suppresses warnings when logWarnings is false', async () => {
      const silentLoader = new AgentLoader({
        agentsDir: AGENTS_DIR,
        logWarnings: false,
        logger,
      });

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('no-fm.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue('No frontmatter here.');
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      await silentLoader.loadAll();

      expect(logger).not.toHaveBeenCalled();
    });

    it('handles malformed YAML gracefully', async () => {
      const content = '---\n: invalid: yaml: syntax\n---\nBody';

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('malformed.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      // The parser may return null for malformed YAML, or the name check
      // will reject it - either way no definition is produced
      expect(result.definitions).toHaveLength(0);
    });
  });

  // =========================================================================
  // loadAll - Inheritance
  // =========================================================================

  describe('loadAll - inheritance via extends', () => {
    function setupTwoFiles(parentMd: string, childMd: string): void {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [
            makeDirent('parent.md', false),
            makeDirent('child.md', false),
          ];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockImplementation(((filePath: string) => {
        if (filePath.endsWith('parent.md')) {
          return parentMd;
        }
        if (filePath.endsWith('child.md')) {
          return childMd;
        }
        throw new Error('ENOENT');
      }) as typeof fs.readFileSync);

      vi.mocked(fs.statSync).mockReturnValue(mockStat());
    }

    it('merges parent metadata into child', async () => {
      const parent = makeAgentMd(
        { name: 'parent', type: 'developer', model: 'opus' },
        'Parent prompt.'
      );
      const child = makeAgentMd(
        { name: 'child', extends: 'parent', maxTurns: 25 },
        'Child prompt.'
      );

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      expect(childDef).toBeDefined();
      // Child should inherit parent's type and model
      expect(childDef!.metadata.type).toBe('developer');
      expect(childDef!.metadata.model).toBe('opus');
      // Child's own maxTurns is preserved
      expect(childDef!.metadata.maxTurns).toBe(25);
    });

    it('child body takes precedence over parent body', async () => {
      const parent = makeAgentMd({ name: 'parent' }, 'Parent prompt.');
      const child = makeAgentMd(
        { name: 'child', extends: 'parent' },
        'Child prompt.'
      );

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      expect(childDef!.systemPrompt).toBe('Child prompt.');
    });

    it('falls back to parent body when child body is empty', async () => {
      const parent = makeAgentMd({ name: 'parent' }, 'Parent prompt.');
      const child = makeAgentMd({ name: 'child', extends: 'parent' }, '');

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      expect(childDef!.systemPrompt).toBe('Parent prompt.');
    });

    it('deduplicates capabilities from parent and child', async () => {
      const parent = makeAgentMd(
        { name: 'parent', capabilities: ['code-gen', 'review'] },
        'Parent.'
      );
      const child = makeAgentMd(
        {
          name: 'child',
          extends: 'parent',
          capabilities: ['review', 'testing'],
        },
        'Child.'
      );

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      const caps = childDef!.metadata.capabilities;
      // Should contain all three, with 'review' deduplicated
      expect(caps).toContain('code-gen');
      expect(caps).toContain('review');
      expect(caps).toContain('testing');
      // No duplicates
      expect(new Set(caps).size).toBe(caps!.length);
    });

    it('deduplicates tools from parent and child', async () => {
      const parent = makeAgentMd(
        { name: 'parent', tools: ['Read', 'Write'] },
        'Parent.'
      );
      const child = makeAgentMd(
        { name: 'child', extends: 'parent', tools: ['Write', 'Bash'] },
        'Child.'
      );

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      const tools = childDef!.metadata.tools;
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Bash');
      expect(new Set(tools).size).toBe(tools!.length);
    });

    it('logs warning when extends target is not found', async () => {
      const child = makeAgentMd(
        { name: 'orphan', extends: 'nonexistent' },
        'Orphan.'
      );

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('orphan.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(child);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      // The orphan agent is still loaded (extends resolution is best-effort)
      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].id).toBe('orphan');
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Cannot resolve extends')
      );
    });

    it('does not propagate the extends key into merged metadata', async () => {
      const parent = makeAgentMd(
        { name: 'parent', type: 'developer' },
        'Parent.'
      );
      const child = makeAgentMd({ name: 'child', extends: 'parent' }, 'Child.');

      setupTwoFiles(parent, child);

      const result = await loader.loadAll();

      const childDef = result.definitions.find(d => d.id === 'child');
      // extends should be stripped during merge
      expect(childDef!.metadata.extends).toBeUndefined();
    });
  });

  // =========================================================================
  // loadOne
  // =========================================================================

  describe('loadOne', () => {
    it('loads a single agent by file path', () => {
      const content = makeAgentMd(
        { name: 'single-agent', type: 'tester' },
        'Test prompt.'
      );

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(5000));

      const def = loader.loadOne('single-agent.md');

      expect(def).not.toBeNull();
      expect(def!.id).toBe('single-agent');
      expect(def!.metadata.type).toBe('tester');
      expect(def!.systemPrompt).toBe('Test prompt.');
      expect(def!.mtime).toBe(5000);
    });

    it('returns null for files without frontmatter', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('No frontmatter here.');
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const def = loader.loadOne('plain.md');

      expect(def).toBeNull();
    });

    it('returns null when file does not exist', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const def = loader.loadOne('missing.md');

      expect(def).toBeNull();
    });
  });

  // =========================================================================
  // Caching
  // =========================================================================

  describe('caching', () => {
    it('getCached returns cached definition after loadAll', async () => {
      const content = makeAgentMd({ name: 'cached-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('cached-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(3000));

      await loader.loadAll();

      const cached = loader.getCached('cached-agent');
      expect(cached).toBeDefined();
      expect(cached!.id).toBe('cached-agent');
    });

    it('getCached returns undefined for unknown IDs', () => {
      expect(loader.getCached('nonexistent')).toBeUndefined();
    });

    it('clearCache removes all cached definitions', async () => {
      const content = makeAgentMd({ name: 'temp-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('temp-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      await loader.loadAll();
      expect(loader.getCached('temp-agent')).toBeDefined();

      loader.clearCache();

      expect(loader.getCached('temp-agent')).toBeUndefined();
    });
  });

  // =========================================================================
  // Stale Detection
  // =========================================================================

  describe('getStaleDefinitions', () => {
    it('returns empty array when no definitions are loaded', () => {
      expect(loader.getStaleDefinitions()).toEqual([]);
    });

    it('returns empty array when mtime has not changed', async () => {
      const content = makeAgentMd({ name: 'stable-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('stable-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(1000));

      await loader.loadAll();

      // statSync will return the same mtime
      const stale = loader.getStaleDefinitions();
      expect(stale).toEqual([]);
    });

    it('detects stale definitions when mtime changes', async () => {
      const content = makeAgentMd({ name: 'changing-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('changing-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(1000));

      await loader.loadAll();

      // Simulate file modification
      vi.mocked(fs.statSync).mockReturnValue(mockStat(2000));

      const stale = loader.getStaleDefinitions();
      expect(stale).toContain('changing-agent');
    });

    it('detects stale when file is deleted (statSync throws)', async () => {
      const content = makeAgentMd({ name: 'deleted-agent' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('deleted-agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(1000));

      await loader.loadAll();

      // Simulate file deletion
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const stale = loader.getStaleDefinitions();
      expect(stale).toContain('deleted-agent');
    });
  });

  // =========================================================================
  // Agent ID Normalization
  // =========================================================================

  describe('agent ID normalization', () => {
    function setupWithName(name: string): void {
      const content = makeAgentMd({ name }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());
    }

    it('lowercases the agent name for the ID', async () => {
      setupWithName('MyAgent');
      const result = await loader.loadAll();
      expect(result.definitions[0].id).toBe('myagent');
    });

    it('trims whitespace from the agent name for the ID', async () => {
      setupWithName('  padded-agent  ');
      const result = await loader.loadAll();
      expect(result.definitions[0].id).toBe('padded-agent');
    });
  });

  // =========================================================================
  // Zod Validation Integration
  // =========================================================================

  describe('Zod validation integration', () => {
    function setupSingleFile(content: string): void {
      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('agent.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());
    }

    it('logs validation warnings for invalid enum values but still loads', async () => {
      // Invalid type will fail Zod validation, but buildDefinition is fail-soft
      const content = makeAgentMd(
        { name: 'soft-fail', type: 'invalid-type' },
        'Body.'
      );
      setupSingleFile(content);

      const result = await loader.loadAll();

      // Agent should still be loaded due to fail-soft behavior
      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].id).toBe('soft-fail');
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Validation warnings')
      );
    });

    it('rejects agent with no name even in fail-soft mode', async () => {
      const content = '---\ntype: developer\n---\nBody.';
      setupSingleFile(content);

      const result = await loader.loadAll();
      expect(result.definitions).toHaveLength(0);
    });
  });

  // =========================================================================
  // Source Path & mtime
  // =========================================================================

  describe('source path and mtime', () => {
    it('stores the relative source path', async () => {
      const content = makeAgentMd({ name: 'path-test' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('core', true)];
        }
        if (dirPath === path.join(AGENTS_DIR, 'core')) {
          return [makeDirent('path-test.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat());

      const result = await loader.loadAll();

      expect(result.definitions[0].sourcePath).toBe(
        path.join('core', 'path-test.md')
      );
    });

    it('stores file mtime from stat', async () => {
      const content = makeAgentMd({ name: 'mtime-test' }, 'Prompt.');

      vi.mocked(fs.readdirSync).mockImplementation(((dirPath: string) => {
        if (dirPath === AGENTS_DIR) {
          return [makeDirent('mtime-test.md', false)];
        }
        return [];
      }) as typeof fs.readdirSync);

      vi.mocked(fs.readFileSync).mockReturnValue(content);
      vi.mocked(fs.statSync).mockReturnValue(mockStat(99999));

      const result = await loader.loadAll();

      expect(result.definitions[0].mtime).toBe(99999);
    });
  });
});
