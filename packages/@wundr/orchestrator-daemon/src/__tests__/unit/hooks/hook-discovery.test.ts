/**
 * Tests for hook discovery & status modules.
 *
 *   src/hooks/hook-discovery.ts  -- frontmatter parsing, metadata extraction,
 *     directory scanning, eligibility checking, snapshot building
 *   src/hooks/hook-status.ts     -- diagnostics, health checks, status
 *     generation, snapshot comparison, formatting
 *
 * Filesystem access is mocked so the tests are fast and hermetic.
 *
 * Covers:
 *  - parseFrontmatter: valid, empty, missing delimiters, comments
 *  - extractMetadata: events, os, requires (bins, anyBins, env), JSON arrays
 *  - resolveInvocationPolicy: enabled / disabled
 *  - resolveHookKey: custom hookKey vs slugified name
 *  - shouldIncludeHook: OS filter, always flag, required bins, env vars, config override
 *  - loadHookEntriesFromDir: directory scanning with mocked FS
 *  - buildHookSnapshot: snapshot creation
 *  - generateHookStatus: health report, diagnostics
 *  - generateGroupedView: lifecycle-phase grouping
 *  - compareSnapshots: added / removed / changed hooks
 *  - formatHookStatus: human-readable output
 */


import * as fs from 'fs';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  parseFrontmatter,
  extractMetadata,
  resolveInvocationPolicy,
  resolveHookKey,
  shouldIncludeHook,
  loadHookEntriesFromDir,
  buildHookSnapshot,
} from '../../../hooks/hook-discovery';
import { HookEngine } from '../../../hooks/hook-engine';
import { HookRegistry } from '../../../hooks/hook-registry';
import {
  generateHookStatus,
  generateGroupedView,
  compareSnapshots,
  formatHookStatus,
} from '../../../hooks/hook-status';

import type {
  HookEntry,
  HookFileMetadata,
  HookLogger,
  HookRegistration,
  HookSnapshot,
  ParsedHookFrontmatter,
} from '../../../hooks/hook-types';

// Mock the fs module so that vi.spyOn can redefine properties like existsSync.
// The auto-mock creates configurable descriptors; individual tests override as needed.
vi.mock('fs', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogger(): HookLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeEntry(overrides?: {
  name?: string;
  metadata?: Partial<HookFileMetadata>;
  frontmatter?: ParsedHookFrontmatter;
}): HookEntry {
  return {
    hook: {
      name: overrides?.name ?? 'test-hook',
      description: 'A test hook',
      source: 'directory',
      filePath: '/hooks/test-hook/HOOK.md',
      baseDir: '/hooks/test-hook',
      handlerPath: '/hooks/test-hook/handler.ts',
    },
    frontmatter: overrides?.frontmatter ?? {},
    metadata: {
      events: ['SessionStart'],
      always: false,
      ...overrides?.metadata,
    },
    invocation: { enabled: true },
  };
}

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  it('should parse a well-formed frontmatter block', () => {
    const content = [
      '---',
      'name: my-hook',
      'events: SessionStart, PostToolUse',
      'emoji: :rocket:',
      '---',
      '# My Hook',
      'Some description',
    ].join('\n');

    const result = parseFrontmatter(content);

    expect(result).toEqual({
      name: 'my-hook',
      events: 'SessionStart, PostToolUse',
      emoji: ':rocket:',
    });
  });

  it('should return empty object when content has no frontmatter', () => {
    expect(parseFrontmatter('# Just a heading')).toEqual({});
    expect(parseFrontmatter('')).toEqual({});
  });

  it('should return empty object when closing delimiter is missing', () => {
    const content = '---\nname: test\nno closing\n';
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('should skip comment lines inside frontmatter', () => {
    const content = [
      '---',
      '# this is a comment',
      'key: value',
      '---',
    ].join('\n');

    expect(parseFrontmatter(content)).toEqual({ key: 'value' });
  });

  it('should skip blank lines inside frontmatter', () => {
    const content = [
      '---',
      'a: 1',
      '',
      'b: 2',
      '---',
    ].join('\n');

    expect(parseFrontmatter(content)).toEqual({ a: '1', b: '2' });
  });

  it('should handle values containing colons', () => {
    const content = [
      '---',
      'homepage: https://example.com:8080/docs',
      '---',
    ].join('\n');

    expect(parseFrontmatter(content)).toEqual({
      homepage: 'https://example.com:8080/docs',
    });
  });

  it('should ignore lines without a colon', () => {
    const content = [
      '---',
      'good: value',
      'bad-line-no-colon',
      '---',
    ].join('\n');

    expect(parseFrontmatter(content)).toEqual({ good: 'value' });
  });
});

// ---------------------------------------------------------------------------
// extractMetadata
// ---------------------------------------------------------------------------

describe('extractMetadata', () => {
  it('should extract comma-separated events', () => {
    const meta = extractMetadata({ events: 'SessionStart, PostToolUse, Stop' });
    expect(meta.events).toEqual(['SessionStart', 'PostToolUse', 'Stop']);
  });

  it('should extract JSON array events', () => {
    const meta = extractMetadata({ events: '["PreToolUse","PostToolUse"]' });
    expect(meta.events).toEqual(['PreToolUse', 'PostToolUse']);
  });

  it('should return an empty events array when events field is missing', () => {
    const meta = extractMetadata({});
    expect(meta.events).toEqual([]);
  });

  it('should extract os platforms', () => {
    const meta = extractMetadata({ events: 'SessionStart', os: 'darwin, linux' });
    expect(meta.os).toEqual(['darwin', 'linux']);
  });

  it('should extract requires.bins', () => {
    const meta = extractMetadata({ events: 'SessionStart', 'requires.bins': 'git, node' });
    expect(meta.requires?.bins).toEqual(['git', 'node']);
  });

  it('should extract bins from a top-level bins field', () => {
    const meta = extractMetadata({ events: 'SessionStart', bins: 'git' });
    expect(meta.requires?.bins).toEqual(['git']);
  });

  it('should extract requires.anyBins', () => {
    const meta = extractMetadata({ events: 'SessionStart', 'requires.anyBins': 'npm, pnpm, yarn' });
    expect(meta.requires?.anyBins).toEqual(['npm', 'pnpm', 'yarn']);
  });

  it('should extract requires.env', () => {
    const meta = extractMetadata({ events: 'SessionStart', 'requires.env': 'API_KEY, SECRET' });
    expect(meta.requires?.env).toEqual(['API_KEY', 'SECRET']);
  });

  it('should set always flag from string "true"', () => {
    const meta = extractMetadata({ events: 'SessionStart', always: 'true' });
    expect(meta.always).toBe(true);
  });

  it('should default always to false', () => {
    const meta = extractMetadata({ events: 'SessionStart' });
    expect(meta.always).toBe(false);
  });

  it('should extract hookKey', () => {
    const meta = extractMetadata({ events: 'SessionStart', hookKey: 'my-custom-key' });
    expect(meta.hookKey).toBe('my-custom-key');
  });

  it('should not create requires object when no requirement fields exist', () => {
    const meta = extractMetadata({ events: 'SessionStart' });
    expect(meta.requires).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveInvocationPolicy
// ---------------------------------------------------------------------------

describe('resolveInvocationPolicy', () => {
  it('should return enabled: true by default', () => {
    expect(resolveInvocationPolicy({})).toEqual({ enabled: true });
  });

  it('should return enabled: false when frontmatter says "false"', () => {
    expect(resolveInvocationPolicy({ enabled: 'false' })).toEqual({ enabled: false });
  });

  it('should return enabled: true for any value other than "false"', () => {
    expect(resolveInvocationPolicy({ enabled: 'true' })).toEqual({ enabled: true });
    expect(resolveInvocationPolicy({ enabled: 'yes' })).toEqual({ enabled: true });
  });
});

// ---------------------------------------------------------------------------
// resolveHookKey
// ---------------------------------------------------------------------------

describe('resolveHookKey', () => {
  it('should use metadata.hookKey when available', () => {
    const entry = makeEntry({ metadata: { events: ['SessionStart'], hookKey: 'my-key' } });
    expect(resolveHookKey('anything', entry)).toBe('my-key');
  });

  it('should slugify the name when no hookKey is present', () => {
    expect(resolveHookKey('My Cool Hook!')).toBe('my-cool-hook-');
  });

  it('should handle names with special characters', () => {
    expect(resolveHookKey('hook@v2.0')).toBe('hook-v2-0');
  });
});

// ---------------------------------------------------------------------------
// shouldIncludeHook
// ---------------------------------------------------------------------------

describe('shouldIncludeHook', () => {
  // Save / restore process.platform and process.env
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should include a hook with no requirements', () => {
    const entry = makeEntry({ metadata: { events: ['SessionStart'] } });
    expect(shouldIncludeHook({ entry })).toBe(true);
  });

  it('should exclude when config override sets enabled: false', () => {
    const entry = makeEntry({ name: 'my-hook', metadata: { events: ['SessionStart'] } });
    expect(
      shouldIncludeHook({
        entry,
        config: { hookOverrides: { 'my-hook': { enabled: false } } },
      }),
    ).toBe(false);
  });

  it('should exclude when OS does not match', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const entry = makeEntry({ metadata: { events: ['SessionStart'], os: ['darwin', 'linux'] } });
    expect(shouldIncludeHook({ entry })).toBe(false);
  });

  it('should include when OS matches', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const entry = makeEntry({ metadata: { events: ['SessionStart'], os: ['darwin'] } });
    expect(shouldIncludeHook({ entry })).toBe(true);
  });

  it('should include regardless of bin requirements when always is true', () => {
    const entry = makeEntry({
      metadata: {
        events: ['SessionStart'],
        always: true,
        requires: { bins: ['nonexistent-binary-xyz-99999'] },
      },
    });
    expect(shouldIncludeHook({ entry })).toBe(true);
  });

  it('should exclude when required env vars are not set', () => {
    const envBefore = process.env.WUNDR_TEST_SECRET;
    delete process.env.WUNDR_TEST_SECRET;

    const entry = makeEntry({
      metadata: {
        events: ['SessionStart'],
        requires: { env: ['WUNDR_TEST_SECRET'] },
      },
    });

    expect(shouldIncludeHook({ entry })).toBe(false);

    // Restore
    if (envBefore !== undefined) {
      process.env.WUNDR_TEST_SECRET = envBefore;
    }
  });

  it('should include when required env vars are set', () => {
    process.env.WUNDR_TEST_INCLUDE = 'yes';

    const entry = makeEntry({
      metadata: {
        events: ['SessionStart'],
        requires: { env: ['WUNDR_TEST_INCLUDE'] },
      },
    });

    expect(shouldIncludeHook({ entry })).toBe(true);

    delete process.env.WUNDR_TEST_INCLUDE;
  });

  it('should use remote eligibility context for OS checks', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const entry = makeEntry({ metadata: { events: ['SessionStart'], os: ['linux'] } });

    expect(
      shouldIncludeHook({
        entry,
        eligibility: {
          remote: {
            platforms: ['linux'],
            hasBin: () => true,
            hasAnyBin: () => true,
          },
        },
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadHookEntriesFromDir (mocked filesystem)
// ---------------------------------------------------------------------------

describe('loadHookEntriesFromDir', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return an empty array when the directory does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const entries = loadHookEntriesFromDir({ dir: '/nonexistent', source: 'directory' });
    expect(entries).toEqual([]);
  });

  it('should discover hooks from subdirectories with HOOK.md and handler files', () => {
    const hookMdContent = [
      '---',
      'name: test-hook',
      'events: SessionStart',
      '---',
      '# Test Hook',
    ].join('\n');

    // Mock existsSync
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      const s = String(p);
      if (s === '/hooks') {
return true;
}
      if (s === '/hooks/my-hook/HOOK.md') {
return true;
}
      if (s === '/hooks/my-hook/handler.ts') {
return true;
}
      if (s === '/hooks/my-hook/package.json') {
return false;
}
      return false;
    });

    // Mock statSync
    vi.spyOn(fs, 'statSync').mockImplementation((() => ({
      isDirectory: () => true,
    })) as any);

    // Mock readdirSync
    vi.spyOn(fs, 'readdirSync').mockImplementation(((
      dir: string,
      _opts?: any,
    ) => {
      if (dir === '/hooks') {
        return [{ name: 'my-hook', isDirectory: () => true }];
      }
      return [];
    }) as any);

    // Mock readFileSync
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: string) => {
      if (p === '/hooks/my-hook/HOOK.md') {
return hookMdContent;
}
      throw new Error('file not found');
    }) as any);

    const entries = loadHookEntriesFromDir({ dir: '/hooks', source: 'directory' });

    expect(entries).toHaveLength(1);
    expect(entries[0].hook.name).toBe('test-hook');
    expect(entries[0].metadata?.events).toEqual(['SessionStart']);
    expect(entries[0].invocation?.enabled).toBe(true);
  });

  it('should skip subdirectories without a handler file', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      const s = String(p);
      if (s === '/hooks') {
return true;
}
      if (s === '/hooks/no-handler/HOOK.md') {
return true;
}
      if (s === '/hooks/no-handler/package.json') {
return false;
}
      // None of the handler candidates exist
      return false;
    });

    vi.spyOn(fs, 'statSync').mockImplementation((() => ({
      isDirectory: () => true,
    })) as any);

    vi.spyOn(fs, 'readdirSync').mockImplementation(((
      dir: string,
      _opts?: any,
    ) => {
      if (dir === '/hooks') {
        return [{ name: 'no-handler', isDirectory: () => true }];
      }
      return [];
    }) as any);

    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: string) => {
      if (p === '/hooks/no-handler/HOOK.md') {
return '---\nevents: SessionStart\n---\n';
}
      throw new Error('file not found');
    }) as any);

    const entries = loadHookEntriesFromDir({ dir: '/hooks', source: 'directory' });
    expect(entries).toEqual([]);
  });

  it('should skip non-directory entries', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockImplementation((() => ({
      isDirectory: () => true,
    })) as any);

    vi.spyOn(fs, 'readdirSync').mockImplementation(((
      _dir: string,
      _opts?: any,
    ) => {
      return [
        { name: 'a-file.txt', isDirectory: () => false },
      ];
    }) as any);

    const entries = loadHookEntriesFromDir({ dir: '/hooks', source: 'directory' });
    expect(entries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildHookSnapshot
// ---------------------------------------------------------------------------

describe('buildHookSnapshot', () => {
  it('should create a snapshot from entries', () => {
    const entries = [
      makeEntry({ name: 'hook-a', metadata: { events: ['SessionStart', 'SessionEnd'] } }),
      makeEntry({ name: 'hook-b', metadata: { events: ['PreToolUse'] } }),
    ];

    const snapshot = buildHookSnapshot(entries, 1);

    expect(snapshot.version).toBe(1);
    expect(snapshot.hooks).toHaveLength(2);
    expect(snapshot.hooks[0]).toEqual({ name: 'hook-a', events: ['SessionStart', 'SessionEnd'] });
    expect(snapshot.hooks[1]).toEqual({ name: 'hook-b', events: ['PreToolUse'] });
    expect(snapshot.resolvedHooks).toHaveLength(2);
  });

  it('should handle entries with no metadata', () => {
    const entry: HookEntry = {
      hook: {
        name: 'bare',
        description: '',
        source: 'directory',
        filePath: '/x/HOOK.md',
        baseDir: '/x',
        handlerPath: '/x/handler.ts',
      },
      frontmatter: {},
      metadata: undefined,
    };

    const snapshot = buildHookSnapshot([entry]);
    expect(snapshot.hooks[0].events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hook-status: generateHookStatus
// ---------------------------------------------------------------------------

describe('generateHookStatus', () => {
  let registry: HookRegistry;
  let logger: HookLogger;

  beforeEach(() => {
    logger = createLogger();
    registry = new HookRegistry({ logger });
  });

  it('should report healthy when no error-level diagnostics exist', () => {
    // Register a valid hook to avoid only "no hooks" info diagnostics
    registry.register({
      id: 'h1',
      event: 'SessionStart',
      type: 'command',
      command: 'echo ok',
      handler: vi.fn(),
    } as HookRegistration);

    const status = generateHookStatus(registry);

    expect(status.healthy).toBe(true);
    expect(status.summary.totalHooks).toBe(1);
    expect(status.summary.enabledHooks).toBe(1);
    expect(status.timestamp).toBeTruthy();
  });

  it('should report unhealthy when a hook has no execution mechanism', () => {
    // Force a bad registration by directly manipulating the registry
    registry.register({
      id: 'bad',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
      handler: vi.fn(),
    } as HookRegistration);

    // Clear the handler and command post-registration to simulate a broken hook
    const hook = registry.getHookById('bad');
    if (hook) {
      (hook as any).handler = undefined;
      (hook as any).command = undefined;
    }

    const status = generateHookStatus(registry);

    expect(status.healthy).toBe(false);
    expect(status.diagnostics.some((d) => d.level === 'error')).toBe(true);
  });

  it('should include engine stats when engine is provided', () => {
    const engine = new HookEngine({ registry, logger, cacheTtlMs: 0 });
    const status = generateHookStatus(registry, engine);

    expect(status.engineStats).toBeDefined();
    expect(status.engineStats?.totalFired).toBe(0);
    expect(status.engineStats?.cacheSize).toBe(0);
  });

  it('should count hooks by event, source, and type', () => {
    registry.register({
      id: 'a',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
      source: 'built-in',
    } as HookRegistration);
    registry.register({
      id: 'b',
      event: 'SessionStart',
      type: 'prompt',
      promptTemplate: 'test',
      source: 'config-file',
    } as HookRegistration);
    registry.register({
      id: 'c',
      event: 'PostToolUse',
      type: 'command',
      command: 'echo',
      source: 'built-in',
    } as HookRegistration);

    const status = generateHookStatus(registry);

    expect(status.summary.hooksByEvent['SessionStart']).toBe(2);
    expect(status.summary.hooksByEvent['PostToolUse']).toBe(1);
    expect(status.summary.hooksBySource['built-in']).toBe(2);
    expect(status.summary.hooksBySource['config-file']).toBe(1);
    expect(status.summary.hooksByType['command']).toBe(2);
    expect(status.summary.hooksByType['prompt']).toBe(1);
  });

  it('should flag hooks with zero timeout', () => {
    registry.register({
      id: 'zero-to',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
      timeoutMs: 0,
    } as HookRegistration);

    const status = generateHookStatus(registry);
    const diag = status.diagnostics.find(
      (d) => d.hookId === 'zero-to' && d.level === 'warn',
    );
    expect(diag).toBeDefined();
    expect(diag?.message).toContain('non-positive timeout');
  });

  it('should flag hooks with extremely high priority', () => {
    registry.register({
      id: 'extreme',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
      priority: 99_999,
    } as HookRegistration);

    const status = generateHookStatus(registry);
    const diag = status.diagnostics.find(
      (d) => d.hookId === 'extreme' && d.message.includes('unusually high priority'),
    );
    expect(diag).toBeDefined();
  });

  it('should report events with no registered hooks', () => {
    const status = generateHookStatus(registry);
    const noHookDiags = status.diagnostics.filter(
      (d) => d.message.startsWith('No hooks registered for event'),
    );
    // With zero hooks, all 14 events should be flagged
    expect(noHookDiags).toHaveLength(14);
  });
});

// ---------------------------------------------------------------------------
// hook-status: generateGroupedView
// ---------------------------------------------------------------------------

describe('generateGroupedView', () => {
  let registry: HookRegistry;
  let logger: HookLogger;

  beforeEach(() => {
    logger = createLogger();
    registry = new HookRegistry({ logger });
  });

  it('should group hooks by lifecycle phase', () => {
    registry.register({
      id: 'a',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
    } as HookRegistration);
    registry.register({
      id: 'b',
      event: 'PreToolUse',
      type: 'command',
      command: 'echo',
    } as HookRegistration);
    registry.register({
      id: 'c',
      event: 'PostToolUse',
      type: 'command',
      command: 'echo',
    } as HookRegistration);

    const grouped = generateGroupedView(registry);

    expect(grouped.session).toBeDefined();
    expect(grouped.session).toHaveLength(1);
    expect(grouped.session[0].id).toBe('a');

    expect(grouped.tool).toBeDefined();
    expect(grouped.tool).toHaveLength(2);
  });

  it('should omit groups with no hooks', () => {
    registry.register({
      id: 'a',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
    } as HookRegistration);

    const grouped = generateGroupedView(registry);

    expect(grouped.session).toBeDefined();
    expect(grouped.tool).toBeUndefined();
    expect(grouped.subagent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hook-status: compareSnapshots
// ---------------------------------------------------------------------------

describe('compareSnapshots', () => {
  it('should detect added hooks', () => {
    const before: HookSnapshot = { hooks: [{ name: 'a', events: ['SessionStart'] }] };
    const after: HookSnapshot = {
      hooks: [
        { name: 'a', events: ['SessionStart'] },
        { name: 'b', events: ['PostToolUse'] },
      ],
    };

    const diff = compareSnapshots(before, after);

    expect(diff.added).toEqual(['b']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('should detect removed hooks', () => {
    const before: HookSnapshot = {
      hooks: [
        { name: 'a', events: ['SessionStart'] },
        { name: 'b', events: ['PostToolUse'] },
      ],
    };
    const after: HookSnapshot = { hooks: [{ name: 'a', events: ['SessionStart'] }] };

    const diff = compareSnapshots(before, after);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(['b']);
  });

  it('should detect hooks with changed events', () => {
    const before: HookSnapshot = {
      hooks: [{ name: 'a', events: ['SessionStart'] }],
    };
    const after: HookSnapshot = {
      hooks: [{ name: 'a', events: ['SessionStart', 'SessionEnd'] }],
    };

    const diff = compareSnapshots(before, after);

    expect(diff.changed).toEqual(['a']);
  });

  it('should report no differences for identical snapshots', () => {
    const snap: HookSnapshot = {
      hooks: [
        { name: 'a', events: ['SessionStart'] },
        { name: 'b', events: ['PostToolUse'] },
      ],
    };

    const diff = compareSnapshots(snap, snap);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hook-status: formatHookStatus
// ---------------------------------------------------------------------------

describe('formatHookStatus', () => {
  it('should produce a human-readable string containing key sections', () => {
    const status = generateHookStatus(new HookRegistry());
    const formatted = formatHookStatus(status);

    expect(formatted).toContain('Hook System Status: HEALTHY');
    expect(formatted).toContain('Total hooks: 0');
    expect(formatted).toContain('Diagnostics:');
  });

  it('should include DEGRADED when unhealthy', () => {
    const registry = new HookRegistry();
    registry.register({
      id: 'broken',
      event: 'SessionStart',
      type: 'command',
      command: 'echo',
      handler: vi.fn(),
    } as HookRegistration);

    // Break the hook
    const hook = registry.getHookById('broken');
    if (hook) {
      (hook as any).handler = undefined;
      (hook as any).command = undefined;
    }

    const status = generateHookStatus(registry);
    const formatted = formatHookStatus(status);

    expect(formatted).toContain('DEGRADED');
  });

  it('should include engine stats when present', () => {
    const registry = new HookRegistry();
    const engine = new HookEngine({ registry, cacheTtlMs: 0 });
    const status = generateHookStatus(registry, engine);
    const formatted = formatHookStatus(status);

    expect(formatted).toContain('Engine stats:');
    expect(formatted).toContain('Total fired:');
    expect(formatted).toContain('Cache size:');
  });
});
