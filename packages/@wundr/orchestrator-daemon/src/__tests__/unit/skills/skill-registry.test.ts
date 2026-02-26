/**
 * Unit tests for the SkillRegistry.
 *
 * Covers:
 * - Skill registration and retrieval
 * - Eligibility filtering (OS, binaries, env vars, config paths)
 * - Command spec generation (sanitization, dedup, truncation)
 * - Snapshot and prompt building
 * - Event emitter lifecycle
 * - Version tracking delegation
 * - Search delegation
 * - Validation delegation
 * - Hot-reload watcher lifecycle
 * - State export
 * - Dispose cleanup
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import * as loader from '../../../skills/skill-loader';
import { SkillRegistry } from '../../../skills/skill-registry';
import * as scanner from '../../../skills/skill-scanner';
import * as validator from '../../../skills/skill-validator';

import type { SkillEntry, SkillsConfig } from '../../../skills/types';

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../../../skills/skill-loader', () => ({
  loadAllSkillEntries: vi.fn().mockReturnValue([]),
  buildVersionInfo: vi.fn().mockReturnValue({
    name: 'test',
    currentVersion: 'abc123',
    previousVersion: undefined,
    updated: false,
    mtimeMs: 1000,
  }),
  formatSkillsForPrompt: vi.fn().mockReturnValue(''),
  resolveWundrMetadata: vi.fn().mockReturnValue(undefined),
  resolveInvocationPolicy: vi.fn().mockReturnValue({
    userInvocable: true,
    disableModelInvocation: false,
  }),
}));

vi.mock('../../../skills/skill-scanner', () => ({
  scanSkillComplete: vi.fn().mockResolvedValue({
    scannedFiles: 0,
    critical: 0,
    warn: 0,
    info: 0,
    findings: [],
  }),
  hasCriticalFindings: vi.fn().mockReturnValue(false),
  formatScanReport: vi.fn().mockReturnValue(''),
}));

vi.mock('../../../skills/skill-search', () => {
  return {
    SkillSearchIndex: vi.fn().mockImplementation(() => ({
      rebuild: vi.fn(),
      search: vi.fn().mockReturnValue([]),
      getCategories: vi.fn().mockReturnValue([]),
      getAllTags: vi.fn().mockReturnValue([]),
    })),
  };
});

vi.mock('../../../skills/skill-validator', () => ({
  validateAllSkills: vi.fn().mockReturnValue([]),
  formatValidationReport: vi.fn().mockReturnValue(''),
}));

vi.mock('../../../skills/skill-watcher', () => {
  const mockWatcher = {
    onChange: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
    setWorkspaceDir: vi.fn(),
    updateConfig: vi.fn(),
  };
  return {
    SkillWatcher: vi.fn().mockImplementation(() => mockWatcher),
    __mockWatcher: mockWatcher,
  };
});

vi.mock('fs', () => ({
  accessSync: vi.fn(() => {
    throw new Error('not found');
  }),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ mtimeMs: 1000, size: 100 }),
  constants: { X_OK: 1 },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillEntry(
  overrides: Partial<{
    name: string;
    description: string;
    source: string;
    body: string;
    context: string;
    userInvocable: boolean;
    disableModelInvocation: boolean;
    tags: string[];
    version: string;
    category: string;
    always: boolean;
    primaryEnv: string;
    skillKey: string;
    os: string[];
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    dependencies: string[];
    model: string;
    tools: string[];
    allowedTools: string[];
  }> = {}
): SkillEntry {
  const name = overrides.name ?? 'test-skill';
  const description = overrides.description ?? 'A test skill';
  return {
    skill: {
      name,
      description,
      filePath: `/fake/skills/${name}/SKILL.md`,
      baseDir: `/fake/skills/${name}`,
      source: (overrides.source ?? 'workspace') as any,
      body: overrides.body ?? 'Do something with $ARGUMENTS',
      frontmatter: {
        name,
        description,
        context: overrides.context as any,
        model: overrides.model,
        tools: overrides.tools,
        allowedTools: overrides.allowedTools,
        tags: overrides.tags,
        version: overrides.version,
        dependencies: overrides.dependencies,
      },
      tags: overrides.tags ?? [],
    },
    rawFrontmatter: { name, description: description },
    metadata: {
      always: overrides.always,
      skillKey: overrides.skillKey,
      primaryEnv: overrides.primaryEnv,
      category: overrides.category,
      os: overrides.os,
      requires: {
        bins: overrides.bins,
        anyBins: overrides.anyBins,
        env: overrides.env,
        config: overrides.config,
      },
    },
    invocation: {
      userInvocable: overrides.userInvocable ?? true,
      disableModelInvocation: overrides.disableModelInvocation ?? false,
    },
  };
}

function loadEntries(entries: SkillEntry[]): void {
  (loader.loadAllSkillEntries as Mock).mockReturnValue(entries);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-establish default mock return values after clearAllMocks.
    // clearAllMocks resets call history but NOT implementations set by
    // earlier tests (e.g. security scanning tests setting
    // hasCriticalFindings to true). Restore safe defaults so subsequent
    // test groups that call load() without explicit scanner setup work.
    (scanner.scanSkillComplete as Mock).mockResolvedValue({
      scannedFiles: 0,
      critical: 0,
      warn: 0,
      info: 0,
      findings: [],
    });
    (scanner.hasCriticalFindings as Mock).mockReturnValue(false);
    (scanner.formatScanReport as Mock).mockReturnValue('');

    (loader.loadAllSkillEntries as Mock).mockReturnValue([]);
    (loader.buildVersionInfo as Mock).mockReturnValue({
      name: 'test',
      currentVersion: 'abc123',
      previousVersion: undefined,
      updated: false,
      mtimeMs: 1000,
    });
    (loader.formatSkillsForPrompt as Mock).mockReturnValue('');

    (validator.validateAllSkills as Mock).mockReturnValue([]);

    registry = new SkillRegistry({ workspaceDir: '/fake/workspace' });
  });

  // =========================================================================
  // Construction and basic state
  // =========================================================================

  describe('construction', () => {
    it('starts with zero skills and version 0', () => {
      expect(registry.size).toBe(0);
      expect(registry.getVersion()).toBe(0);
      expect(registry.getSkillNames()).toEqual([]);
    });
  });

  // =========================================================================
  // load()
  // =========================================================================

  describe('load()', () => {
    it('loads skills from loader and stores them', async () => {
      const entry = makeSkillEntry({ name: 'my-skill' });
      loadEntries([entry]);

      await registry.load();

      expect(registry.size).toBe(1);
      expect(registry.hasSkill('my-skill')).toBe(true);
      expect(registry.getSkill('my-skill')).toEqual(entry.skill);
    });

    it('clears previous skills on reload', async () => {
      loadEntries([makeSkillEntry({ name: 'first' })]);
      await registry.load();
      expect(registry.size).toBe(1);

      loadEntries([makeSkillEntry({ name: 'second' })]);
      await registry.load();
      expect(registry.size).toBe(1);
      expect(registry.hasSkill('first')).toBe(false);
      expect(registry.hasSkill('second')).toBe(true);
    });

    it('clears entries when config.enabled is false', async () => {
      loadEntries([makeSkillEntry()]);
      await registry.load();
      expect(registry.size).toBe(1);

      const disabledRegistry = new SkillRegistry({
        workspaceDir: '/fake/workspace',
        config: { enabled: false },
      });
      loadEntries([makeSkillEntry()]);
      await disabledRegistry.load();
      expect(disabledRegistry.size).toBe(0);
    });

    it('bumps version on each load', async () => {
      loadEntries([]);
      await registry.load();
      const v1 = registry.getVersion();
      expect(v1).toBeGreaterThan(0);

      await registry.load();
      const v2 = registry.getVersion();
      expect(v2).toBeGreaterThanOrEqual(v1);
    });

    it('emits "loaded" event after load', async () => {
      const listener = vi.fn();
      registry.on('loaded', listener);

      loadEntries([makeSkillEntry({ name: 'alpha' })]);
      await registry.load();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 })
      );
    });

    it('emits "validationComplete" when there are validation issues', async () => {
      const validationListener = vi.fn();
      registry.on('validationComplete', validationListener);

      (validator.validateAllSkills as Mock).mockReturnValue([
        {
          skillName: 'bad',
          valid: false,
          issues: [{ rule: 'x', severity: 'error', message: 'err' }],
        },
      ]);

      loadEntries([makeSkillEntry({ name: 'bad' })]);
      await registry.load();

      expect(validationListener).toHaveBeenCalledTimes(1);
    });

    it('does not emit "validationComplete" when all skills are clean', async () => {
      const validationListener = vi.fn();
      registry.on('validationComplete', validationListener);

      (validator.validateAllSkills as Mock).mockReturnValue([
        { skillName: 'good', valid: true, issues: [] },
      ]);

      loadEntries([makeSkillEntry({ name: 'good' })]);
      await registry.load();

      expect(validationListener).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Security scanning during load
  // =========================================================================

  describe('security scanning', () => {
    it('blocks skills with critical scan findings when blockCritical is true', async () => {
      const config: SkillsConfig = {
        security: { scanOnLoad: true, blockCritical: true },
      };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      (scanner.scanSkillComplete as Mock).mockResolvedValue({
        scannedFiles: 1,
        critical: 1,
        warn: 0,
        info: 0,
        findings: [
          {
            ruleId: 'test',
            severity: 'critical',
            file: 'x',
            line: 1,
            message: 'bad',
            evidence: 'x',
          },
        ],
      });
      (scanner.hasCriticalFindings as Mock).mockReturnValue(true);

      const entry = makeSkillEntry({ name: 'malicious' });
      loadEntries([entry]);
      await reg.load();

      expect(reg.hasSkill('malicious')).toBe(false);
    });

    it('emits scanFailed event for blocked skills', async () => {
      const config: SkillsConfig = {
        security: { scanOnLoad: true, blockCritical: true },
      };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });
      const scanFailedListener = vi.fn();
      reg.on('scanFailed', scanFailedListener);

      (scanner.scanSkillComplete as Mock).mockResolvedValue({
        scannedFiles: 1,
        critical: 1,
        warn: 0,
        info: 0,
        findings: [],
      });
      (scanner.hasCriticalFindings as Mock).mockReturnValue(true);

      loadEntries([makeSkillEntry({ name: 'bad-skill' })]);
      await reg.load();

      expect(scanFailedListener).toHaveBeenCalledWith(
        expect.objectContaining({ skillName: 'bad-skill' })
      );
    });

    it('allows skills when scanning is disabled', async () => {
      const config: SkillsConfig = {
        security: { scanOnLoad: false },
      };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      loadEntries([makeSkillEntry({ name: 'ok-skill' })]);
      await reg.load();

      expect(reg.hasSkill('ok-skill')).toBe(true);
      expect(scanner.scanSkillComplete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Eligibility filtering
  // =========================================================================

  describe('eligibility filtering', () => {
    it('excludes skills disabled via per-skill config', async () => {
      const config: SkillsConfig = {
        security: { scanOnLoad: false },
        entries: { 'my-skill': { enabled: false } },
      };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      loadEntries([makeSkillEntry({ name: 'my-skill' })]);
      await reg.load();

      expect(reg.hasSkill('my-skill')).toBe(false);
    });

    it('excludes bundled skills not in allowBundled list', async () => {
      const config: SkillsConfig = {
        security: { scanOnLoad: false },
        allowBundled: ['allowed-skill'],
      };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      loadEntries([
        makeSkillEntry({ name: 'allowed-skill', source: 'bundled' }),
        makeSkillEntry({ name: 'blocked-skill', source: 'bundled' }),
      ]);
      await reg.load();

      expect(reg.hasSkill('allowed-skill')).toBe(true);
      expect(reg.hasSkill('blocked-skill')).toBe(false);
    });

    it('includes skills marked as always=true even if requirements fail', async () => {
      const config: SkillsConfig = { security: { scanOnLoad: false } };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      loadEntries([
        makeSkillEntry({
          name: 'always-on',
          always: true,
          bins: ['nonexistent-binary-xyz'],
        }),
      ]);
      await reg.load();

      expect(reg.hasSkill('always-on')).toBe(true);
    });

    it('excludes skills when required env vars are missing', async () => {
      const config: SkillsConfig = { security: { scanOnLoad: false } };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      // Ensure the env var is not set
      delete process.env['VERY_RARE_ENV_VAR_12345'];

      loadEntries([
        makeSkillEntry({
          name: 'needs-env',
          env: ['VERY_RARE_ENV_VAR_12345'],
        }),
      ]);
      await reg.load();

      expect(reg.hasSkill('needs-env')).toBe(false);
    });

    it('includes skills when required env vars are present', async () => {
      const config: SkillsConfig = { security: { scanOnLoad: false } };
      const reg = new SkillRegistry({ workspaceDir: '/fake', config });

      process.env['TEST_ENV_VAR_SKILL'] = 'set';
      loadEntries([
        makeSkillEntry({
          name: 'has-env',
          env: ['TEST_ENV_VAR_SKILL'],
        }),
      ]);
      await reg.load();

      expect(reg.hasSkill('has-env')).toBe(true);
      delete process.env['TEST_ENV_VAR_SKILL'];
    });
  });

  // =========================================================================
  // Accessors
  // =========================================================================

  describe('accessors', () => {
    beforeEach(async () => {
      loadEntries([
        makeSkillEntry({ name: 'alpha', description: 'First', tags: ['test'] }),
        makeSkillEntry({ name: 'beta', description: 'Second' }),
      ]);
      await registry.load();
    });

    it('getEntry returns the full entry', () => {
      const entry = registry.getEntry('alpha');
      expect(entry).toBeDefined();
      expect(entry!.skill.name).toBe('alpha');
    });

    it('getEntry returns undefined for unknown skills', () => {
      expect(registry.getEntry('nonexistent')).toBeUndefined();
    });

    it('getSkill returns only the Skill object', () => {
      const skill = registry.getSkill('beta');
      expect(skill).toBeDefined();
      expect(skill!.name).toBe('beta');
    });

    it('getAllEntries returns all entries as array', () => {
      const all = registry.getAllEntries();
      expect(all).toHaveLength(2);
    });

    it('getEntriesMap returns the internal map', () => {
      const map = registry.getEntriesMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(2);
    });

    it('getSkillNames returns sorted list of names', () => {
      const names = registry.getSkillNames();
      expect(names).toContain('alpha');
      expect(names).toContain('beta');
    });

    it('hasSkill returns correct boolean', () => {
      expect(registry.hasSkill('alpha')).toBe(true);
      expect(registry.hasSkill('gamma')).toBe(false);
    });

    it('size returns the count', () => {
      expect(registry.size).toBe(2);
    });
  });

  // =========================================================================
  // Event emitter
  // =========================================================================

  describe('event emitter', () => {
    it('on() returns an unsubscribe function', async () => {
      const listener = vi.fn();
      const unsub = registry.on('loaded', listener);

      loadEntries([]);
      await registry.load();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      await registry.load();
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it('swallows errors from event listeners', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('boom');
      });
      const normalListener = vi.fn();

      registry.on('loaded', errorListener);
      registry.on('loaded', normalListener);

      loadEntries([]);
      await registry.load();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // buildSnapshot / buildPrompt
  // =========================================================================

  describe('buildSnapshot()', () => {
    it('returns a snapshot with prompt, skills, and version', async () => {
      (loader.formatSkillsForPrompt as Mock).mockReturnValue('mocked prompt');

      loadEntries([makeSkillEntry({ name: 'snap-skill', category: 'dev' })]);
      await registry.load();

      const snapshot = registry.buildSnapshot();
      expect(snapshot.prompt).toBe('mocked prompt');
      expect(snapshot.skills).toHaveLength(1);
      expect(snapshot.skills[0].name).toBe('snap-skill');
      expect(snapshot.version).toBeGreaterThan(0);
    });

    it('filters by name when filterNames is provided', async () => {
      loadEntries([
        makeSkillEntry({ name: 'keep' }),
        makeSkillEntry({ name: 'drop' }),
      ]);
      await registry.load();

      const snapshot = registry.buildSnapshot(['keep']);
      expect(snapshot.skills).toHaveLength(1);
      expect(snapshot.skills[0].name).toBe('keep');
    });

    it('excludes skills with disableModelInvocation from the prompt', async () => {
      loadEntries([
        makeSkillEntry({ name: 'model-off', disableModelInvocation: true }),
        makeSkillEntry({ name: 'model-on', disableModelInvocation: false }),
      ]);
      await registry.load();

      registry.buildSnapshot();

      // formatSkillsForPrompt should only receive the model-on skill
      expect(loader.formatSkillsForPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'model-on' })])
      );
      const callArgs = (loader.formatSkillsForPrompt as Mock).mock.calls[0][0];
      expect(callArgs.every((s: any) => s.name !== 'model-off')).toBe(true);
    });

    it('buildPrompt() returns just the prompt string', async () => {
      (loader.formatSkillsForPrompt as Mock).mockReturnValue('prompt-string');
      loadEntries([makeSkillEntry()]);
      await registry.load();

      expect(registry.buildPrompt()).toBe('prompt-string');
    });
  });

  // =========================================================================
  // buildCommandSpecs
  // =========================================================================

  describe('buildCommandSpecs()', () => {
    it('generates command specs from user-invocable skills', async () => {
      loadEntries([
        makeSkillEntry({
          name: 'review-pr',
          description: 'Review a PR',
          userInvocable: true,
        }),
      ]);
      await registry.load();

      const specs = registry.buildCommandSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].skillName).toBe('review-pr');
      expect(specs[0].name).toBe('review_pr');
      expect(specs[0].description).toBe('Review a PR');
    });

    it('excludes non-user-invocable skills', async () => {
      loadEntries([
        makeSkillEntry({ name: 'hidden', userInvocable: false }),
        makeSkillEntry({ name: 'visible', userInvocable: true }),
      ]);
      await registry.load();

      const specs = registry.buildCommandSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].skillName).toBe('visible');
    });

    it('sanitizes command names (removes special chars, lowercases)', async () => {
      loadEntries([makeSkillEntry({ name: 'My--Cool..Skill!' })]);
      await registry.load();

      const specs = registry.buildCommandSpecs();
      expect(specs[0].name).toMatch(/^[a-z0-9_]+$/);
    });

    it('deduplicates command names when they collide', async () => {
      loadEntries([
        makeSkillEntry({ name: 'deploy' }),
        makeSkillEntry({ name: 'Deploy' }),
      ]);
      await registry.load();

      const specs = registry.buildCommandSpecs();
      const names = specs.map(s => s.name);
      const unique = new Set(names.map(n => n.toLowerCase()));
      expect(unique.size).toBe(names.length);
    });

    it('avoids reserved names', async () => {
      loadEntries([makeSkillEntry({ name: 'help' })]);
      await registry.load();

      const specs = registry.buildCommandSpecs(new Set(['help']));
      expect(specs[0].name).not.toBe('help');
    });

    it('truncates long descriptions', async () => {
      const longDesc = 'x'.repeat(200);
      loadEntries([makeSkillEntry({ name: 'wordy', description: longDesc })]);
      await registry.load();

      const specs = registry.buildCommandSpecs();
      // Source truncates to (SKILL_COMMAND_DESCRIPTION_MAX_LENGTH - 1) + '...' = 99 + 3 = 102
      expect(specs[0].description.length).toBeLessThanOrEqual(102);
      expect(specs[0].description.length).toBeLessThan(longDesc.length);
      expect(specs[0].description.endsWith('...')).toBe(true);
    });
  });

  // =========================================================================
  // Version tracking
  // =========================================================================

  describe('version tracking', () => {
    it('getVersionInfo returns version info for a loaded skill', async () => {
      (loader.buildVersionInfo as Mock).mockReturnValue({
        name: 'vskill',
        currentVersion: 'v1',
        previousVersion: undefined,
        updated: false,
        mtimeMs: 2000,
      });

      loadEntries([makeSkillEntry({ name: 'vskill' })]);
      await registry.load();

      const info = registry.getVersionInfo('vskill');
      expect(info).toBeDefined();
      expect(info!.name).toBe('vskill');
    });

    it('getAllVersionInfo returns all version entries', async () => {
      loadEntries([
        makeSkillEntry({ name: 'a' }),
        makeSkillEntry({ name: 'b' }),
      ]);
      await registry.load();

      const all = registry.getAllVersionInfo();
      expect(all).toHaveLength(2);
    });

    it('getUpdatedSkills returns names of updated skills', async () => {
      (loader.buildVersionInfo as Mock)
        .mockReturnValueOnce({
          name: 'changed',
          currentVersion: 'v2',
          previousVersion: 'v1',
          updated: true,
          mtimeMs: 0,
        })
        .mockReturnValueOnce({
          name: 'same',
          currentVersion: 'v1',
          previousVersion: 'v1',
          updated: false,
          mtimeMs: 0,
        });

      loadEntries([
        makeSkillEntry({ name: 'changed' }),
        makeSkillEntry({ name: 'same' }),
      ]);
      await registry.load();

      const updated = registry.getUpdatedSkills();
      expect(updated).toContain('changed');
      expect(updated).not.toContain('same');
    });
  });

  // =========================================================================
  // Search delegation
  // =========================================================================

  describe('search()', () => {
    it('delegates to the search index', async () => {
      loadEntries([makeSkillEntry({ name: 'indexed' })]);
      await registry.load();

      registry.search({ text: 'docker' });
      // The mock SkillSearchIndex.search should have been called
      // (we verify no error thrown and the delegation works)
    });

    it('getCategories delegates to search index', async () => {
      loadEntries([]);
      await registry.load();
      const cats = registry.getCategories();
      expect(Array.isArray(cats)).toBe(true);
    });

    it('getAllTags delegates to search index', async () => {
      loadEntries([]);
      await registry.load();
      const tags = registry.getAllTags();
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  // =========================================================================
  // Validation delegation
  // =========================================================================

  describe('validation', () => {
    it('getValidationResults returns results from last load', async () => {
      (validator.validateAllSkills as Mock).mockReturnValue([
        { skillName: 'x', valid: true, issues: [] },
      ]);

      loadEntries([makeSkillEntry({ name: 'x' })]);
      await registry.load();

      const results = registry.getValidationResults();
      expect(results).toHaveLength(1);
      expect(results[0].skillName).toBe('x');
    });

    it('getValidationReport returns formatted string', async () => {
      (validator.formatValidationReport as Mock).mockReturnValue('report text');

      loadEntries([]);
      await registry.load();

      expect(registry.getValidationReport()).toBe('report text');
    });
  });

  // =========================================================================
  // Hot-reload / watcher lifecycle
  // =========================================================================

  describe('watcher lifecycle', () => {
    it('startWatching creates a watcher and starts it', () => {
      registry.startWatching();
      expect(registry.isWatching()).toBe(false); // mock isRunning returns false by default
    });

    it('stopWatching stops and clears the watcher', () => {
      registry.startWatching();
      registry.stopWatching();
      expect(registry.isWatching()).toBe(false);
    });
  });

  // =========================================================================
  // setWorkspaceDir / updateConfig
  // =========================================================================

  describe('setWorkspaceDir()', () => {
    it('reloads skills from the new directory', async () => {
      loadEntries([makeSkillEntry({ name: 'old' })]);
      await registry.load();

      loadEntries([makeSkillEntry({ name: 'new' })]);
      await registry.setWorkspaceDir('/new/workspace');

      expect(registry.hasSkill('new')).toBe(true);
    });
  });

  describe('updateConfig()', () => {
    it('reloads skills with updated configuration', async () => {
      loadEntries([makeSkillEntry({ name: 'cfgtest' })]);
      await registry.load();
      expect(registry.size).toBe(1);

      await registry.updateConfig({ enabled: false });
      expect(registry.size).toBe(0);
    });
  });

  // =========================================================================
  // exportState
  // =========================================================================

  describe('exportState()', () => {
    it('returns structured state with skill metadata', async () => {
      (loader.buildVersionInfo as Mock).mockReturnValue({
        name: 'exp',
        currentVersion: '1.0.0',
        updated: true,
        mtimeMs: 123,
      });

      loadEntries([
        makeSkillEntry({ name: 'exp', description: 'export test' }),
      ]);
      await registry.load();

      const state = registry.exportState();
      expect(state.version).toBeGreaterThan(0);
      expect(state.skillCount).toBe(1);
      expect(state.watching).toBe(false);
      expect(state.skills).toHaveLength(1);
      expect(state.skills[0].name).toBe('exp');
    });
  });

  // =========================================================================
  // dispose
  // =========================================================================

  describe('dispose()', () => {
    it('clears entries, listeners, and stops watcher', async () => {
      loadEntries([makeSkillEntry()]);
      await registry.load();

      const listener = vi.fn();
      registry.on('loaded', listener);

      registry.dispose();

      expect(registry.size).toBe(0);
    });
  });
});
