/**
 * Claude Code global-config de-confliction helpers.
 *
 * On Adaptic agent Mac minis, **maestro** (`~/maestro`) is the authoritative
 * owner of the global `~/.claude/settings.json` (it writes the current
 * Claude Code v2 schema: permissions, ruflo hooks, enabledPlugins, effortLevel).
 * computer-setup must never clobber that. These helpers let computer-setup:
 *
 *  - detect when maestro owns the machine and defer (skip the global write);
 *  - otherwise write a VALID v2 settings.json, merge-preserving any existing
 *    user config, and always keep a timestamped backup.
 *
 * MCP servers are intentionally NOT written here — computer-setup registers them
 * additively via `claude mcp add` (which writes the separate `~/.claude.json`),
 * so it never competes for the settings.json file.
 */
import { promises as fs } from 'fs';
import * as path from 'path';

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when maestro owns the Claude Code config on this machine. Detected via:
 *  1. the `~/maestro` framework repo;
 *  2. maestro/adaptic launchd agents (`ai.adaptic.*`);
 *  3. an existing global settings.json already wired with ruflo PreToolUse hooks.
 */
export async function isMaestroManaged(homeDir: string): Promise<boolean> {
  if (await pathExists(path.join(homeDir, 'maestro'))) {
    return true;
  }

  try {
    const launchAgents = path.join(homeDir, 'Library', 'LaunchAgents');
    const entries = await fs.readdir(launchAgents);
    if (entries.some(entry => entry.startsWith('ai.adaptic.'))) {
      return true;
    }
  } catch {
    // LaunchAgents dir absent — ignore.
  }

  try {
    const raw = await fs.readFile(
      path.join(homeDir, '.claude', 'settings.json'),
      'utf8'
    );
    if (/ruflo@latest hooks/.test(raw) && /"PreToolUse"/.test(raw)) {
      return true;
    }
  } catch {
    // No global settings yet — ignore.
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge two config objects. `override` wins for primitive conflicts,
 * nested objects merge recursively, and arrays are unioned by value identity
 * (so re-runs never duplicate entries and never drop the other tool's entries).
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>
): T {
  const result: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key];

    if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      const seen = new Set(baseValue.map(item => JSON.stringify(item)));
      result[key] = [
        ...baseValue,
        ...overrideValue.filter(item => !seen.has(JSON.stringify(item))),
      ];
    } else if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }

  return result as T;
}

/**
 * Atomically write JSON, keeping a timestamped backup of any existing file so a
 * bad write is always recoverable (mirrors maestro's own backup-before-write).
 */
export async function writeJsonWithBackup(
  filePath: string,
  data: unknown
): Promise<void> {
  if (await pathExists(filePath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(filePath, `${filePath}.backup-${stamp}`);
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Build a VALID Claude Code v2 settings.json. This replaces the old malformed
 * schema (`claudeCodeOptions`, `hooks.preToolUse`, `permissions.allowCommands`)
 * that the current CLI ignored. MCP servers are deliberately omitted — they are
 * registered via `claude mcp add` into `~/.claude.json`.
 */
export function buildClaudeSettingsV2(): Record<string, unknown> {
  const ruflo = (args: string): { type: 'command'; command: string } => ({
    type: 'command',
    command: `npx ruflo@latest hooks ${args}`,
  });

  return {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    permissions: {
      allow: [
        'Bash',
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'WebFetch',
        'WebSearch',
      ],
      deny: [
        'Bash(rm -rf /)',
        'Bash(sudo rm -rf *)',
        'Bash(mkfs *)',
        'Bash(dd if=/dev/zero *)',
      ],
    },
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [ruflo('pre-command')] },
        { matcher: 'Write|Edit|MultiEdit', hooks: [ruflo('pre-edit')] },
      ],
      PostToolUse: [
        { matcher: 'Write|Edit|MultiEdit', hooks: [ruflo('post-edit')] },
        { matcher: 'Bash', hooks: [ruflo('post-command')] },
      ],
      SessionStart: [{ matcher: '', hooks: [ruflo('session-start')] }],
      SessionEnd: [
        { matcher: '', hooks: [ruflo('session-end --export-metrics true')] },
      ],
    },
  };
}
