import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import {
  buildClaudeSettingsV2,
  deepMerge,
  isMaestroManaged,
  writeJsonWithBackup,
} from '../claude-config';

describe('deepMerge', () => {
  it('lets override win for primitive conflicts', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it('merges nested objects recursively', () => {
    expect(deepMerge({ x: { p: 1, q: 2 } }, { x: { q: 9, r: 3 } })).toEqual({
      x: { p: 1, q: 9, r: 3 },
    });
  });

  it('unions arrays by value identity (no duplicates, no drops)', () => {
    expect(deepMerge({ list: ['a', 'b'] }, { list: ['b', 'c'] })).toEqual({
      list: ['a', 'b', 'c'],
    });
  });
});

describe('buildClaudeSettingsV2', () => {
  it('emits the current v2 schema and not the legacy keys', () => {
    const s = buildClaudeSettingsV2() as Record<string, any>;
    expect(Array.isArray(s.permissions.allow)).toBe(true);
    expect(Array.isArray(s.permissions.deny)).toBe(true);
    expect(Array.isArray(s.hooks.PreToolUse)).toBe(true);
    // legacy / malformed keys must be gone
    expect(s.claudeCodeOptions).toBeUndefined();
    expect(s.permissions.allowCommands).toBeUndefined();
    expect(s.hooks.preToolUse).toBeUndefined();
  });
});

describe('isMaestroManaged', () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(tmpdir(), 'wundr-home-'));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it('returns false on a clean machine', async () => {
    expect(await isMaestroManaged(home)).toBe(false);
  });

  it('detects the ~/maestro repo', async () => {
    await fs.mkdir(path.join(home, 'maestro'));
    expect(await isMaestroManaged(home)).toBe(true);
  });

  it('detects ai.adaptic.* launchd agents', async () => {
    const la = path.join(home, 'Library', 'LaunchAgents');
    await fs.mkdir(la, { recursive: true });
    await fs.writeFile(path.join(la, 'ai.adaptic.sophie-daemon.plist'), '');
    expect(await isMaestroManaged(home)).toBe(true);
  });

  it('detects an existing ruflo-hooked global settings.json', async () => {
    const claudeDir = path.join(home, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ command: 'npx ruflo@latest hooks x' }],
            },
          ],
        },
      })
    );
    expect(await isMaestroManaged(home)).toBe(true);
  });
});

describe('writeJsonWithBackup', () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(tmpdir(), 'wundr-backup-'));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it('writes JSON and backs up any pre-existing file', async () => {
    const file = path.join(home, 'settings.json');
    await fs.writeFile(file, '{"old":true}');
    await writeJsonWithBackup(file, { new: true });

    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ new: true });
    const entries = await fs.readdir(home);
    expect(entries.some(e => e.startsWith('settings.json.backup-'))).toBe(true);
  });
});
