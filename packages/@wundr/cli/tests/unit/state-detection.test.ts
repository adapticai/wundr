/**
 * State Detection System Tests
 *
 * Comprehensive test suite for the state detection system including
 * version management, customization detection, and project state analysis.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Version Manager Tests
import {
  parseVersion,
  stringifyVersion,
  compareVersions,
  satisfiesRange,
  checkCompatibility,
  getLatestVersion,
  sortVersions,
  incrementVersion,
  isPrerelease,
  isValidVersion,
  VersionComparisonResult,
  SemanticVersion,
} from '../../src/lib/version-manager';

// State Detection Tests
import {
  detectProjectState,
  hasWundrInstalled,
  getStateSummary,
  detectGitStatus,
  detectClaudeConfig,
  detectMCPConfig,
  detectWundrConfig,
  detectAgents,
  detectHooks,
  detectCustomizations,
  detectConflicts,
  computeFileChecksum,
  computeChecksums,
  ProjectState,
  GitStatus,
  AgentState,
  HookState,
  CustomizationInfo,
  ConflictInfo,
} from '../../src/lib/state-detection';

// Test utilities
let testDir: string;

beforeEach(async () => {
  // Create a unique temporary directory for each test
  testDir = path.join(os.tmpdir(), `wundr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.ensureDir(testDir);
});

afterEach(async () => {
  // Clean up test directory
  if (testDir && (await fs.pathExists(testDir))) {
    await fs.remove(testDir);
  }
});

// ============================================================================
// VERSION MANAGER TESTS
// ============================================================================

describe('Version Manager', () => {
  describe('parseVersion', () => {
    test('should parse basic semantic version', () => {
      const result = parseVersion('1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    test('should parse version with leading v', () => {
      const result = parseVersion('v1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    test('should parse version with prerelease', () => {
      const result = parseVersion('1.2.3-alpha');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
      });
    });

    test('should parse version with prerelease and build metadata', () => {
      const result = parseVersion('1.2.3-alpha.1+build.123');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        buildMetadata: 'build.123',
      });
    });

    test('should parse version with only build metadata', () => {
      const result = parseVersion('1.2.3+build.456');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        buildMetadata: 'build.456',
      });
    });

    test('should return null for invalid versions', () => {
      expect(parseVersion('')).toBeNull();
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('1')).toBeNull();
      expect(parseVersion('1.2.3.4')).toBeNull();
    });

    test('should handle null and undefined', () => {
      expect(parseVersion(null as any)).toBeNull();
      expect(parseVersion(undefined as any)).toBeNull();
    });
  });

  describe('stringifyVersion', () => {
    test('should stringify basic version', () => {
      expect(stringifyVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
    });

    test('should stringify version with prerelease', () => {
      expect(stringifyVersion({ major: 1, minor: 2, patch: 3, prerelease: 'beta' })).toBe('1.2.3-beta');
    });

    test('should stringify version with build metadata', () => {
      expect(stringifyVersion({ major: 1, minor: 2, patch: 3, buildMetadata: '20231201' })).toBe('1.2.3+20231201');
    });

    test('should stringify full version', () => {
      expect(
        stringifyVersion({
          major: 1,
          minor: 2,
          patch: 3,
          prerelease: 'rc.1',
          buildMetadata: 'sha.abc123',
        })
      ).toBe('1.2.3-rc.1+sha.abc123');
    });
  });

  describe('compareVersions', () => {
    test('should return EQUAL for same versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(VersionComparisonResult.EQUAL);
      expect(compareVersions('2.5.10', '2.5.10')).toBe(VersionComparisonResult.EQUAL);
    });

    test('should compare major versions', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(VersionComparisonResult.OLDER);
      expect(compareVersions('3.0.0', '2.0.0')).toBe(VersionComparisonResult.NEWER);
    });

    test('should compare minor versions', () => {
      expect(compareVersions('1.2.0', '1.3.0')).toBe(VersionComparisonResult.OLDER);
      expect(compareVersions('1.5.0', '1.3.0')).toBe(VersionComparisonResult.NEWER);
    });

    test('should compare patch versions', () => {
      expect(compareVersions('1.2.3', '1.2.4')).toBe(VersionComparisonResult.OLDER);
      expect(compareVersions('1.2.5', '1.2.4')).toBe(VersionComparisonResult.NEWER);
    });

    test('should handle prerelease versions correctly', () => {
      // Prerelease has lower precedence than release
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(VersionComparisonResult.OLDER);
      expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(VersionComparisonResult.NEWER);
    });

    test('should compare prerelease identifiers', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(VersionComparisonResult.OLDER);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(VersionComparisonResult.OLDER);
    });

    test('should return null for invalid versions', () => {
      expect(compareVersions('invalid', '1.0.0')).toBeNull();
      expect(compareVersions('1.0.0', 'invalid')).toBeNull();
    });

    test('should accept SemanticVersion objects', () => {
      const v1: SemanticVersion = { major: 1, minor: 0, patch: 0 };
      const v2: SemanticVersion = { major: 2, minor: 0, patch: 0 };
      expect(compareVersions(v1, v2)).toBe(VersionComparisonResult.OLDER);
    });
  });

  describe('satisfiesRange', () => {
    test('should match exact versions', () => {
      expect(satisfiesRange('1.2.3', '1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.3', '1.2.4')).toBe(false);
    });

    test('should handle caret ranges', () => {
      expect(satisfiesRange('1.2.5', '^1.2.3')).toBe(true);
      expect(satisfiesRange('1.9.0', '^1.2.3')).toBe(true);
      expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
      expect(satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
    });

    test('should handle tilde ranges', () => {
      expect(satisfiesRange('1.2.5', '~1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.9', '~1.2.3')).toBe(true);
      expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
    });

    test('should handle greater than or equal', () => {
      expect(satisfiesRange('1.2.3', '>=1.2.3')).toBe(true);
      expect(satisfiesRange('2.0.0', '>=1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.2', '>=1.2.3')).toBe(false);
    });

    test('should handle less than', () => {
      expect(satisfiesRange('1.0.0', '<2.0.0')).toBe(true);
      expect(satisfiesRange('1.9.9', '<2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '<2.0.0')).toBe(false);
    });

    test('should handle wildcard', () => {
      expect(satisfiesRange('1.0.0', '*')).toBe(true);
      expect(satisfiesRange('999.999.999', '*')).toBe(true);
    });
  });

  describe('checkCompatibility', () => {
    test('should report compatible for same versions', () => {
      const result = checkCompatibility('1.0.0', '1.0.0');
      expect(result.isCompatible).toBe(true);
      expect(result.upgradeRequired).toBe(false);
      expect(result.breakingChanges).toBe(false);
    });

    test('should report compatible for minor updates', () => {
      const result = checkCompatibility('1.0.0', '1.2.0');
      expect(result.isCompatible).toBe(true);
      expect(result.breakingChanges).toBe(false);
    });

    test('should report breaking changes for major version differences', () => {
      const result = checkCompatibility('1.0.0', '2.0.0');
      expect(result.isCompatible).toBe(false);
      expect(result.breakingChanges).toBe(true);
      expect(result.upgradeRequired).toBe(true);
    });

    test('should suggest upgrade when current is older', () => {
      const result = checkCompatibility('1.0.0', '1.5.0');
      expect(result.suggestedAction).toBe('upgrade');
    });

    test('should handle invalid versions', () => {
      const result = checkCompatibility('invalid', '1.0.0');
      expect(result.isCompatible).toBe(false);
      expect(result.reason).toContain('Invalid');
    });
  });

  describe('getLatestVersion', () => {
    test('should return latest version from list', () => {
      expect(getLatestVersion(['1.0.0', '2.0.0', '1.5.0'])).toBe('2.0.0');
      expect(getLatestVersion(['0.1.0', '0.2.0', '0.1.5'])).toBe('0.2.0');
    });

    test('should handle empty array', () => {
      expect(getLatestVersion([])).toBeNull();
    });

    test('should filter invalid versions', () => {
      expect(getLatestVersion(['invalid', '1.0.0', 'bad'])).toBe('1.0.0');
    });
  });

  describe('sortVersions', () => {
    test('should sort versions ascending', () => {
      expect(sortVersions(['2.0.0', '1.0.0', '1.5.0'])).toEqual(['1.0.0', '1.5.0', '2.0.0']);
    });

    test('should sort versions descending', () => {
      expect(sortVersions(['2.0.0', '1.0.0', '1.5.0'], true)).toEqual(['2.0.0', '1.5.0', '1.0.0']);
    });

    test('should filter invalid versions', () => {
      expect(sortVersions(['invalid', '2.0.0', '1.0.0'])).toEqual(['1.0.0', '2.0.0']);
    });
  });

  describe('incrementVersion', () => {
    test('should increment major version', () => {
      expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0');
    });

    test('should increment minor version', () => {
      expect(incrementVersion('1.2.3', 'minor')).toBe('1.3.0');
    });

    test('should increment patch version', () => {
      expect(incrementVersion('1.2.3', 'patch')).toBe('1.2.4');
    });

    test('should remove prerelease on increment', () => {
      expect(incrementVersion('1.0.0-alpha', 'patch')).toBe('1.0.1');
    });

    test('should return null for invalid version', () => {
      expect(incrementVersion('invalid', 'major')).toBeNull();
    });
  });

  describe('isPrerelease', () => {
    test('should return true for prerelease versions', () => {
      expect(isPrerelease('1.0.0-alpha')).toBe(true);
      expect(isPrerelease('1.0.0-beta.1')).toBe(true);
    });

    test('should return false for release versions', () => {
      expect(isPrerelease('1.0.0')).toBe(false);
      expect(isPrerelease('2.5.10')).toBe(false);
    });
  });

  describe('isValidVersion', () => {
    test('should return true for valid versions', () => {
      expect(isValidVersion('1.0.0')).toBe(true);
      expect(isValidVersion('0.0.1')).toBe(true);
      expect(isValidVersion('v1.2.3')).toBe(true);
    });

    test('should return false for invalid versions', () => {
      expect(isValidVersion('invalid')).toBe(false);
      expect(isValidVersion('')).toBe(false);
      expect(isValidVersion('1.2')).toBe(false);
    });
  });
});

// ============================================================================
// STATE DETECTION TESTS
// ============================================================================

describe('State Detection', () => {
  describe('computeFileChecksum', () => {
    test('should compute checksum for existing file', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      await fs.writeFile(filePath, 'test content');

      const checksum = await computeFileChecksum(filePath);
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum!.length).toBe(64); // SHA-256 hex length
    });

    test('should return same checksum for same content', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      await fs.writeFile(file1, 'identical content');
      await fs.writeFile(file2, 'identical content');

      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);
      expect(checksum1).toBe(checksum2);
    });

    test('should return different checksums for different content', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      await fs.writeFile(file1, 'content A');
      await fs.writeFile(file2, 'content B');

      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);
      expect(checksum1).not.toBe(checksum2);
    });

    test('should return null for non-existent file', async () => {
      const checksum = await computeFileChecksum(path.join(testDir, 'non-existent.txt'));
      expect(checksum).toBeNull();
    });
  });

  describe('computeChecksums', () => {
    test('should compute checksums for multiple files', async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content 1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content 2');

      const checksums = await computeChecksums(testDir, ['file1.txt', 'file2.txt']);

      expect(checksums.size).toBe(2);
      expect(checksums.has('file1.txt')).toBe(true);
      expect(checksums.has('file2.txt')).toBe(true);
    });

    test('should skip non-existent files', async () => {
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'content');

      const checksums = await computeChecksums(testDir, ['existing.txt', 'non-existent.txt']);

      expect(checksums.size).toBe(1);
      expect(checksums.has('existing.txt')).toBe(true);
      expect(checksums.has('non-existent.txt')).toBe(false);
    });
  });

  describe('detectGitStatus', () => {
    test('should detect non-git directory', async () => {
      const status = await detectGitStatus(testDir);
      expect(status.isRepository).toBe(false);
    });

    test('should detect git repository', async () => {
      // Create a fake .git directory
      await fs.ensureDir(path.join(testDir, '.git'));
      await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
      await fs.ensureDir(path.join(testDir, '.git', 'refs', 'heads'));
      await fs.writeFile(path.join(testDir, '.git', 'refs', 'heads', 'main'), 'abc1234567890\n');

      const status = await detectGitStatus(testDir);
      expect(status.isRepository).toBe(true);
      expect(status.branch).toBe('main');
    });
  });

  describe('detectClaudeConfig', () => {
    test('should detect missing CLAUDE.md', async () => {
      const result = await detectClaudeConfig(testDir);
      expect(result.exists).toBe(false);
    });

    test('should detect CLAUDE.md in root', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Claude Config');

      const result = await detectClaudeConfig(testDir);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.path).toContain('CLAUDE.md');
    });

    test('should detect CLAUDE.md in .claude directory', async () => {
      await fs.ensureDir(path.join(testDir, '.claude'));
      await fs.writeFile(path.join(testDir, '.claude', 'CLAUDE.md'), '# Claude Config');

      const result = await detectClaudeConfig(testDir);
      expect(result.exists).toBe(true);
    });

    test('should detect invalid CLAUDE.md (empty)', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '');

      const result = await detectClaudeConfig(testDir);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(false);
    });
  });

  describe('detectMCPConfig', () => {
    test('should detect missing MCP config', async () => {
      const result = await detectMCPConfig(testDir);
      expect(result.exists).toBe(false);
    });

    test('should detect MCP config with servers', async () => {
      await fs.ensureDir(path.join(testDir, '.mcp'));
      await fs.writeJson(path.join(testDir, '.mcp', 'config.json'), {
        servers: {
          'test-server': { url: 'http://localhost:3000' },
        },
      });

      const result = await detectMCPConfig(testDir);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.servers).toContain('test-server');
    });

    test('should detect invalid MCP config', async () => {
      await fs.writeFile(path.join(testDir, '.mcp.json'), 'invalid json');

      const result = await detectMCPConfig(testDir);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(false);
    });
  });

  describe('detectWundrConfig', () => {
    test('should detect missing Wundr config', async () => {
      const result = await detectWundrConfig(testDir);
      expect(result.exists).toBe(false);
    });

    test('should detect wundr.config.json', async () => {
      await fs.writeJson(path.join(testDir, 'wundr.config.json'), {
        version: '1.0.0',
      });

      const result = await detectWundrConfig(testDir);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('detectAgents', () => {
    test('should detect no agents', async () => {
      const result = await detectAgents(testDir);
      expect(result.hasAgents).toBe(false);
      expect(result.agentCount).toBe(0);
    });

    test('should detect agents in .claude/agents', async () => {
      await fs.ensureDir(path.join(testDir, '.claude', 'agents'));
      await fs.writeJson(path.join(testDir, '.claude', 'agents', 'coder.json'), {
        name: 'coder',
        type: 'development',
      });

      const result = await detectAgents(testDir);
      expect(result.hasAgents).toBe(true);
      expect(result.agentCount).toBe(1);
      expect(result.agents[0]!.name).toBe('coder');
      expect(result.agents[0]!.type).toBe('development');
    });

    test('should detect multiple agents', async () => {
      await fs.ensureDir(path.join(testDir, '.wundr', 'agents'));
      await fs.writeJson(path.join(testDir, '.wundr', 'agents', 'agent1.json'), { name: 'agent1' });
      await fs.writeJson(path.join(testDir, '.wundr', 'agents', 'agent2.json'), { name: 'agent2' });

      const result = await detectAgents(testDir);
      expect(result.hasAgents).toBe(true);
      expect(result.agentCount).toBe(2);
    });
  });

  describe('detectHooks', () => {
    test('should detect no hooks', async () => {
      const result = await detectHooks(testDir);
      expect(result.hasHooks).toBe(false);
      expect(result.hookCount).toBe(0);
    });

    test('should detect hooks in .husky', async () => {
      await fs.ensureDir(path.join(testDir, '.husky'));
      await fs.writeFile(path.join(testDir, '.husky', 'pre-commit'), '#!/bin/sh\nnpm test');

      const result = await detectHooks(testDir);
      expect(result.hasHooks).toBe(true);
      expect(result.hookCount).toBe(1);
    });

    test('should detect disabled hooks (.sample)', async () => {
      await fs.ensureDir(path.join(testDir, '.claude', 'hooks'));
      await fs.writeFile(path.join(testDir, '.claude', 'hooks', 'pre-push.sample'), '# sample');

      const result = await detectHooks(testDir);
      expect(result.hasHooks).toBe(true);
      expect(result.hooks[0]!.isEnabled).toBe(false);
    });
  });

  describe('detectCustomizations', () => {
    test('should detect no customizations in empty project', async () => {
      const result = await detectCustomizations(testDir);
      expect(result.hasCustomizations).toBe(false);
    });

    test('should detect added files', async () => {
      await fs.ensureDir(path.join(testDir, '.claude'));
      await fs.writeFile(path.join(testDir, '.claude', 'custom-config.json'), '{}');

      const result = await detectCustomizations(testDir);
      expect(result.hasCustomizations).toBe(true);
      expect(result.addedFiles.length).toBeGreaterThan(0);
    });

    test('should detect checksum mismatches', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), 'custom content');

      const baseline = new Map([['CLAUDE.md', 'expected-checksum-that-wont-match']]);
      const result = await detectCustomizations(testDir, baseline);

      expect(result.hasCustomizations).toBe(true);
      expect(result.checksumMismatches.length).toBe(1);
      expect(result.customizedFiles).toContain('CLAUDE.md');
    });

    test('should detect removed files', async () => {
      const baseline = new Map([['expected-file.txt', 'some-checksum']]);
      const result = await detectCustomizations(testDir, baseline);

      expect(result.removedFiles).toContain('expected-file.txt');
    });
  });

  describe('detectConflicts', () => {
    test('should detect no conflicts in clean state', async () => {
      const result = await detectConflicts(testDir, {});
      expect(result.hasConflicts).toBe(false);
    });

    test('should detect version conflicts', async () => {
      const state = {
        wundrVersion: '1.0.0',
        latestWundrVersion: '3.0.0',
      };

      const result = await detectConflicts(testDir, state);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'version')).toBe(true);
    });

    test('should detect multiple config file conflicts', async () => {
      await fs.writeJson(path.join(testDir, 'wundr.config.json'), {});
      await fs.writeJson(path.join(testDir, '.wundr.json'), {});

      const result = await detectConflicts(testDir, {});
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'config')).toBe(true);
    });

    test('should detect git dirty state', async () => {
      const state = {
        git: {
          isRepository: true,
          isDirty: true,
          hasUncommittedChanges: true,
          hasUntrackedFiles: false,
        },
      };

      const result = await detectConflicts(testDir, state);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'file')).toBe(true);
    });
  });

  describe('detectProjectState', () => {
    test('should detect empty project state', async () => {
      const state = await detectProjectState(testDir);

      expect(state.projectPath).toBe(testDir);
      expect(state.hasWundr).toBe(false);
      expect(state.hasClaudeConfig).toBe(false);
      expect(state.hasMCPConfig).toBe(false);
      expect(state.hasPackageJson).toBe(false);
      expect(state.detectedAt).toBeInstanceOf(Date);
    });

    test('should detect project with package.json', async () => {
      await fs.writeJson(path.join(testDir, 'package.json'), {
        name: 'test-project',
        version: '1.0.0',
      });

      const state = await detectProjectState(testDir);
      expect(state.hasPackageJson).toBe(true);
      expect(state.packageName).toBe('test-project');
      expect(state.packageVersion).toBe('1.0.0');
    });

    test('should detect monorepo', async () => {
      await fs.writeJson(path.join(testDir, 'package.json'), {
        name: 'monorepo',
        workspaces: ['packages/*'],
      });

      const state = await detectProjectState(testDir);
      expect(state.isMonorepo).toBe(true);
      expect(state.workspaces).toContain('packages/*');
    });

    test('should detect full Wundr installation', async () => {
      // Set up a complete Wundr project
      await fs.writeJson(path.join(testDir, 'package.json'), { name: 'test' });
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Claude Config');
      await fs.ensureDir(path.join(testDir, '.mcp'));
      await fs.writeJson(path.join(testDir, '.mcp', 'config.json'), { servers: {} });
      await fs.writeJson(path.join(testDir, 'wundr.config.json'), { version: '1.0.0' });

      const state = await detectProjectState(testDir);
      expect(state.hasClaudeConfig).toBe(true);
      expect(state.hasMCPConfig).toBe(true);
      expect(state.hasWundrConfig).toBe(true);
    });

    test('should detect partial installation', async () => {
      // Only CLAUDE.md, missing other components
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Claude');
      await fs.ensureDir(path.join(testDir, 'node_modules', '@wundr.io', 'cli'));
      await fs.writeJson(path.join(testDir, 'node_modules', '@wundr.io', 'cli', 'package.json'), {
        version: '1.0.0',
      });

      const state = await detectProjectState(testDir);
      expect(state.isPartialInstallation).toBe(true);
      expect(state.missingComponents.length).toBeGreaterThan(0);
    });

    test('should calculate health score', async () => {
      const state = await detectProjectState(testDir);
      expect(typeof state.healthScore).toBe('number');
      expect(state.healthScore).toBeGreaterThanOrEqual(0);
      expect(state.healthScore).toBeLessThanOrEqual(100);
    });

    test('should generate recommendations', async () => {
      const state = await detectProjectState(testDir);
      expect(Array.isArray(state.recommendations)).toBe(true);
      expect(state.recommendations.length).toBeGreaterThan(0);
    });

    test('should handle version comparison with latest', async () => {
      await fs.ensureDir(path.join(testDir, 'node_modules', '@wundr.io', 'cli'));
      await fs.writeJson(path.join(testDir, 'node_modules', '@wundr.io', 'cli', 'package.json'), {
        version: '1.0.0',
      });

      const state = await detectProjectState(testDir, { latestVersion: '2.0.0' });
      expect(state.isWundrOutdated).toBe(true);
    });
  });

  describe('hasWundrInstalled', () => {
    test('should return false for empty directory', async () => {
      expect(await hasWundrInstalled(testDir)).toBe(false);
    });

    test('should return true if CLAUDE.md exists', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Claude');
      expect(await hasWundrInstalled(testDir)).toBe(true);
    });

    test('should return true if wundr.config.json exists', async () => {
      await fs.writeJson(path.join(testDir, 'wundr.config.json'), {});
      expect(await hasWundrInstalled(testDir)).toBe(true);
    });

    test('should return true if .wundr directory exists', async () => {
      await fs.ensureDir(path.join(testDir, '.wundr'));
      expect(await hasWundrInstalled(testDir)).toBe(true);
    });
  });

  describe('getStateSummary', () => {
    test('should generate summary string', async () => {
      await fs.writeJson(path.join(testDir, 'package.json'), { name: 'test-project' });
      const state = await detectProjectState(testDir);
      const summary = getStateSummary(state);

      expect(typeof summary).toBe('string');
      expect(summary).toContain('test-project');
      expect(summary).toContain('Health Score');
    });

    test('should include recommendations in summary', async () => {
      const state = await detectProjectState(testDir);
      const summary = getStateSummary(state);

      expect(summary).toContain('Recommendations');
    });
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  describe('Partial Installations', () => {
    test('should handle corrupted package.json', async () => {
      await fs.writeFile(path.join(testDir, 'package.json'), 'invalid json content');

      const state = await detectProjectState(testDir);
      expect(state.hasPackageJson).toBe(true);
      expect(state.packageName).toBeUndefined();
    });

    test('should handle permission-denied scenarios gracefully', async () => {
      // This test verifies the system doesn't crash on errors
      // Actual permission denied would require special setup
      const state = await detectProjectState('/nonexistent/path/that/does/not/exist');
      expect(state.hasWundr).toBe(false);
    });
  });

  describe('Symlinks and Special Files', () => {
    test('should handle empty directories', async () => {
      await fs.ensureDir(path.join(testDir, '.claude', 'agents'));
      // Empty agents directory

      const agents = await detectAgents(testDir);
      expect(agents.hasAgents).toBe(false);
    });
  });

  describe('Version Edge Cases', () => {
    test('should handle 0.x versions correctly', () => {
      // In SemVer, 0.x versions are special
      expect(satisfiesRange('0.2.5', '^0.2.3')).toBe(true);
      expect(satisfiesRange('0.3.0', '^0.2.3')).toBe(false);
    });

    test('should handle versions with complex prereleases', () => {
      const result = parseVersion('1.0.0-alpha.beta.gamma.1');
      expect(result?.prerelease).toBe('alpha.beta.gamma.1');
    });

    test('should compare numeric vs alphanumeric prereleases', () => {
      // Numeric identifiers have lower precedence than alphanumeric
      expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(VersionComparisonResult.OLDER);
    });
  });

  describe('Configuration Conflicts', () => {
    test('should detect all types of configuration conflicts', async () => {
      // Create multiple conflicting config files
      await fs.writeJson(path.join(testDir, 'wundr.config.json'), {});
      await fs.writeJson(path.join(testDir, '.wundr.json'), {});
      await fs.ensureDir(path.join(testDir, '.wundr'));
      await fs.writeJson(path.join(testDir, '.wundr', 'config.json'), {});

      await fs.writeFile(path.join(testDir, '.mcp.json'), '{}');
      await fs.ensureDir(path.join(testDir, '.mcp'));
      await fs.writeJson(path.join(testDir, '.mcp', 'config.json'), {});

      const state = await detectProjectState(testDir);
      expect(state.conflicts.hasConflicts).toBe(true);
      expect(state.conflicts.conflicts.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  test('should detect complete project setup end-to-end', async () => {
    // Create a comprehensive project structure
    await fs.writeJson(path.join(testDir, 'package.json'), {
      name: 'complete-project',
      version: '2.0.0',
      workspaces: ['packages/*'],
    });

    await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Claude Code Configuration\n\nProject setup complete.');

    await fs.ensureDir(path.join(testDir, '.mcp'));
    await fs.writeJson(path.join(testDir, '.mcp', 'config.json'), {
      servers: {
        'claude-flow': { url: 'http://localhost:3001' },
        'wundr-tools': { url: 'http://localhost:3002' },
      },
    });

    await fs.writeJson(path.join(testDir, 'wundr.config.json'), {
      version: '1.0.0',
      governance: { enabled: true },
    });

    await fs.ensureDir(path.join(testDir, '.claude', 'agents'));
    await fs.writeJson(path.join(testDir, '.claude', 'agents', 'coder.json'), {
      name: 'coder',
      type: 'development',
    });
    await fs.writeJson(path.join(testDir, '.claude', 'agents', 'reviewer.json'), {
      name: 'reviewer',
      type: 'code-review',
    });

    await fs.ensureDir(path.join(testDir, '.husky'));
    await fs.writeFile(path.join(testDir, '.husky', 'pre-commit'), '#!/bin/sh\nnpm test');
    await fs.writeFile(path.join(testDir, '.husky', 'pre-push'), '#!/bin/sh\nnpm run lint');

    // Initialize git
    await fs.ensureDir(path.join(testDir, '.git'));
    await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

    // Run detection
    const state = await detectProjectState(testDir, { latestVersion: '1.0.0' });

    // Verify complete detection
    expect(state.hasPackageJson).toBe(true);
    expect(state.packageName).toBe('complete-project');
    expect(state.isMonorepo).toBe(true);

    expect(state.hasClaudeConfig).toBe(true);
    expect(state.hasMCPConfig).toBe(true);
    expect(state.hasWundrConfig).toBe(true);

    expect(state.agents.hasAgents).toBe(true);
    expect(state.agents.agentCount).toBe(2);

    expect(state.hooks.hasHooks).toBe(true);
    expect(state.hooks.hookCount).toBe(2);

    expect(state.git.isRepository).toBe(true);
    expect(state.git.branch).toBe('main');

    expect(state.isWundrOutdated).toBe(false);
    expect(state.isPartialInstallation).toBe(false);

    expect(state.healthScore).toBeGreaterThan(50);

    // Generate and verify summary
    const summary = getStateSummary(state);
    expect(summary).toContain('complete-project');
    expect(summary).toContain('Health Score');
  });
});
