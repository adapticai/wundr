/**
 * Headless-safe process execution helpers for computer-setup.
 *
 * New developer Macs — and especially the headless agent Mac minis this tool
 * provisions — run setup non-interactively. Every primitive here is designed so
 * that NO step can ever block forever:
 *
 *  - child processes always get a bounded timeout;
 *  - stdin is detached (`stdin: 'ignore'`) so a prompt can never wait on input;
 *  - interactive-only behaviour (GUI installers, confirmation prompts) is gated
 *    behind an explicit {@link isInteractive} check.
 *
 * The Xcode Command Line Tools installer here replaces the old unbounded
 * `xcode-select --install` + `while (!installed)` poll that hung every fresh
 * Mac. It uses the `softwareupdate` on-demand mechanism, which installs the CLT
 * with no GUI dialog, and only falls back to the GUI installer when a real
 * console is attached.
 */
import { execa, type Options as ExecaOptions } from 'execa';
import * as fs from 'fs-extra';

export interface MinimalLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, ...meta: unknown[]): void;
}

const noopLogger: MinimalLogger = {
  info() {},
  warn() {},
  error() {},
};

/** Default hard ceiling for any single managed process (10 minutes). */
export const DEFAULT_PROCESS_TIMEOUT_MS = 10 * 60 * 1000;

/** Xcode CLT install can be slow on a fresh machine; allow longer. */
export const XCODE_INSTALL_TIMEOUT_MS = 30 * 60 * 1000;

/** Path of the sentinel that exposes the on-demand CLT package to softwareupdate. */
const CLT_SENTINEL =
  '/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress';

function envFlagIsTrue(value: string | undefined): boolean {
  return (
    value !== undefined && value !== '' && value !== '0' && value !== 'false'
  );
}

/**
 * True only when a real interactive console is attached AND we are not running
 * under CI / an explicit non-interactive override. Used to decide whether
 * interactive prompts or GUI fallbacks are permissible.
 */
export function isInteractive(): boolean {
  if (envFlagIsTrue(process.env.CI)) return false;
  if (process.env.WUNDR_NONINTERACTIVE === '1') return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function isHeadless(): boolean {
  return !isInteractive();
}

/**
 * `process.env` augmented with the flags that make common bootstrap installers
 * (Homebrew, Oh My Zsh, apt, ...) run without any prompts.
 */
export function nonInteractiveEnv(
  extra: Record<string, string> = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NONINTERACTIVE: '1',
    CI: process.env.CI ?? '1',
    HOMEBREW_NO_ANALYTICS: '1',
    HOMEBREW_NO_AUTO_UPDATE: '1',
    HOMEBREW_NO_INSTALL_CLEANUP: '1',
    DEBIAN_FRONTEND: 'noninteractive',
    // Oh My Zsh installer flags: don't chsh, keep existing .zshrc, don't launch zsh.
    RUNZSH: 'no',
    CHSH: 'no',
    KEEP_ZSHRC: 'yes',
    ...extra,
  };
}

export type RunProcessOptions = ExecaOptions;

/**
 * execa wrapper with headless-safe defaults: detached stdin (so nothing can
 * block on a prompt) and a bounded timeout. Never spawns a shell.
 */
export function runProcess(
  file: string,
  args: readonly string[] = [],
  options: RunProcessOptions = {}
) {
  return execa(file, args as string[], {
    stdin: 'ignore',
    timeout: DEFAULT_PROCESS_TIMEOUT_MS,
    env: nonInteractiveEnv(),
    ...options,
  });
}

/**
 * Run a shell snippet (e.g. a `curl ... | bash` bootstrap) with the same
 * headless-safe defaults. Only use this for installers that genuinely require a
 * shell; prefer {@link runProcess} otherwise.
 */
export function runShellScript(
  script: string,
  options: RunProcessOptions = {}
) {
  return execa('bash', ['-c', script], {
    stdin: 'ignore',
    timeout: DEFAULT_PROCESS_TIMEOUT_MS,
    env: nonInteractiveEnv(),
    ...options,
  });
}

/**
 * True when the Xcode Command Line Tools are installed AND their developer
 * directory actually exists (catches the "xcode-select -p succeeds but the
 * path is broken" partial-install state).
 */
export async function hasXcodeCommandLineTools(): Promise<boolean> {
  try {
    const { stdout } = await execa('xcode-select', ['-p'], { timeout: 10_000 });
    const dir = stdout.trim();
    return dir.length > 0 && (await fs.pathExists(dir));
  } catch {
    return false;
  }
}

/**
 * Parse `softwareupdate --list` output for the newest installable
 * "Command Line Tools" label. Handles both the modern `* Label: ...` format and
 * the older `* Command Line Tools for Xcode-NN` format.
 */
export function parseCommandLineToolsLabel(
  softwareUpdateList: string
): string | null {
  const labels: string[] = [];
  for (const rawLine of softwareUpdateList.split('\n')) {
    const line = rawLine.trim();
    if (!/command line tools/i.test(line)) continue;
    const label = line
      .replace(/^\*\s*/, '')
      .replace(/^label:\s*/i, '')
      .trim();
    if (/^command line tools/i.test(label)) labels.push(label);
  }
  if (labels.length === 0) return null;

  const versionScore = (label: string): number => {
    const match = label.match(/(\d+(?:\.\d+)+)/);
    if (!match) return 0;
    return match[1]
      .split('.')
      .reduce((acc, part) => acc * 1000 + Number(part), 0);
  };
  labels.sort((a, b) => versionScore(a) - versionScore(b));
  return labels[labels.length - 1];
}

export interface InstallXcodeOptions {
  logger?: MinimalLogger;
  timeoutMs?: number;
  /** Permit the interactive GUI installer as a last resort. Defaults to {@link isInteractive}. */
  allowGuiFallback?: boolean;
}

/**
 * Install the Xcode Command Line Tools without ever hanging.
 *
 * Strategy (headless-first):
 *   1. short-circuit if already installed;
 *   2. expose the on-demand CLT package via the sentinel file and install it
 *      with `softwareupdate --install <label>` (no GUI, no clicks);
 *   3. only if softwareupdate offers no label AND a console is attached, fall
 *      back to the GUI `xcode-select --install` bounded by a hard timeout;
 *   4. otherwise throw a clear, actionable error instead of looping forever.
 */
export async function installXcodeCommandLineTools(
  options: InstallXcodeOptions = {}
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  const timeoutMs = options.timeoutMs ?? XCODE_INSTALL_TIMEOUT_MS;
  const allowGuiFallback = options.allowGuiFallback ?? isInteractive();

  if (await hasXcodeCommandLineTools()) {
    logger.info('Xcode Command Line Tools already installed');
    return;
  }

  logger.info('Installing Xcode Command Line Tools (non-interactive)...');
  await fs.writeFile(CLT_SENTINEL, '');
  try {
    let label: string | null = null;
    try {
      const { stdout } = await execa('softwareupdate', ['--list'], {
        stdin: 'ignore',
        timeout: 5 * 60 * 1000,
        env: nonInteractiveEnv(),
      });
      label = parseCommandLineToolsLabel(stdout);
    } catch (error: unknown) {
      logger.warn(
        `Could not list software updates: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (label) {
      logger.info(`Installing "${label}" via softwareupdate...`);
      await execa('softwareupdate', ['--install', label, '--verbose'], {
        stdin: 'ignore',
        timeout: timeoutMs,
        env: nonInteractiveEnv(),
      });
    } else if (allowGuiFallback) {
      logger.warn(
        'softwareupdate did not offer a Command Line Tools package; falling back to the GUI installer (a console is attached).'
      );
      try {
        await execa('xcode-select', ['--install'], { stdin: 'ignore' });
      } catch {
        // The GUI trigger exits non-zero if a request is already pending — ignore.
      }
      await waitForCommandLineTools(timeoutMs, logger);
    } else {
      throw new Error(
        'Xcode Command Line Tools are not available via softwareupdate and no interactive console is present for the GUI installer. ' +
          'Run `xcode-select --install` manually, then re-run setup.'
      );
    }
  } finally {
    try {
      await fs.remove(CLT_SENTINEL);
    } catch {
      // Best-effort cleanup of the sentinel file.
    }
  }

  if (!(await hasXcodeCommandLineTools())) {
    throw new Error(
      'Xcode Command Line Tools installation did not complete successfully.'
    );
  }
  logger.info('Xcode Command Line Tools installed');
}

async function waitForCommandLineTools(
  timeoutMs: number,
  logger: MinimalLogger
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const pollIntervalMs = 5000;
  logger.info('Waiting for Command Line Tools installation to complete...');
  while (Date.now() < deadline) {
    if (await hasXcodeCommandLineTools()) return;
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(
    `Timed out after ${Math.round(
      timeoutMs / 60000
    )} min waiting for Xcode Command Line Tools installation to complete.`
  );
}
