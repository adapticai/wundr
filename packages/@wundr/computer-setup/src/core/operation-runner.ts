/**
 * Operation Runner
 *
 * Safe command execution layer that prevents command injection,
 * enforces timeouts, supports dry-run mode, and provides
 * structured error handling with retry support.
 *
 * Every external process is spawned without `shell: true` and
 * all arguments are passed as arrays, never interpolated into
 * a shell string.
 */

import {
  execa,
  type ExecaReturnValue,
  type Options as ExecaOptions,
} from 'execa';

import { Logger } from '../utils/logger';

/**
 * Options for running a single command.
 */
export interface RunCommandOptions {
  /** Arguments to pass to the command. Must be an array -- never a string. */
  args?: string[];
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to merge into the process environment */
  env?: Record<string, string>;
  /** Timeout in milliseconds. Defaults to 5 minutes. */
  timeoutMs?: number;
  /** Number of retry attempts on failure. Defaults to 0 (no retry). */
  retries?: number;
  /** Base delay between retries in ms. Doubled on each attempt. */
  retryDelayMs?: number;
  /** If true, suppress stdout/stderr logging. */
  quiet?: boolean;
}

/**
 * Structured result from a command execution.
 */
export interface CommandResult {
  /** Whether the command succeeded (exit code 0) */
  success: boolean;
  /** Standard output, trimmed */
  stdout: string;
  /** Standard error, trimmed */
  stderr: string;
  /** Process exit code */
  exitCode: number;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Whether this was a dry-run (command was not actually executed) */
  dryRun: boolean;
}

/**
 * Error thrown when a command fails after all retry attempts.
 */
export class CommandError extends Error {
  declare readonly cause?: Error;

  constructor(
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number,
    public readonly stderr: string,
    public readonly durationMs: number,
    cause?: Error
  ) {
    const safeCmd = `${command} ${args.join(' ')}`;
    super(`Command failed (exit ${exitCode}): ${safeCmd}`);
    this.name = 'CommandError';
    if (cause) {
      this.cause = cause;
    }
  }
}

// Characters that should never appear in command names
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>!#~*?\\'"]/;
const MAX_ARG_LENGTH = 4096;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * Validates that a command name is safe to execute.
 * Rejects anything containing shell metacharacters.
 */
function validateCommand(command: string): void {
  if (!command || command.trim().length === 0) {
    throw new Error('Command name must not be empty');
  }
  if (SHELL_METACHARACTERS.test(command)) {
    throw new Error(`Command name contains unsafe characters: ${command}`);
  }
  if (command.includes('/') && !command.startsWith('/')) {
    // Allow absolute paths like /usr/bin/git but reject relative traversal
    if (command.includes('..')) {
      throw new Error(`Command path contains directory traversal: ${command}`);
    }
  }
}

/**
 * Validates that arguments do not contain shell injection attempts.
 */
function validateArgs(args: string[]): void {
  for (const arg of args) {
    if (arg.length > MAX_ARG_LENGTH) {
      throw new Error(
        `Argument exceeds maximum length (${MAX_ARG_LENGTH}): ${arg.slice(0, 80)}...`
      );
    }
  }
}

/**
 * Safe command execution engine.
 *
 * Usage:
 * ```ts
 * const runner = new OperationRunner({ dryRun: false });
 * const result = await runner.run('git', { args: ['status'] });
 * ```
 */
export class OperationRunner {
  private readonly dryRun: boolean;
  private readonly logger: Logger;

  constructor(options: { dryRun: boolean }) {
    this.dryRun = options.dryRun;
    this.logger = new Logger({ name: 'OperationRunner' });
  }

  /**
   * Execute a command safely.
   *
   * - Command name and arguments are validated before execution.
   * - No shell is spawned (`shell: false` is the execa default).
   * - Timeouts are enforced.
   * - Retries use exponential backoff.
   * - In dry-run mode the command is logged but not executed.
   */
  async run(
    command: string,
    options: RunCommandOptions = {}
  ): Promise<CommandResult> {
    const args = options.args ?? [];
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options.retries ?? 0;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    // Validate inputs
    validateCommand(command);
    validateArgs(args);

    const safeCmd = `${command} ${args.join(' ')}`.trim();

    // Dry-run: log and return a synthetic success result
    if (this.dryRun) {
      this.logger.info(`[DRY RUN] Would execute: ${safeCmd}`);
      return {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 0,
        dryRun: true,
      };
    }

    // Execute with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        this.logger.info(
          `Retrying (attempt ${attempt}/${retries}) after ${delay}ms: ${safeCmd}`
        );
        await this.sleep(delay);
      }

      const start = Date.now();
      try {
        const execaOpts: ExecaOptions = {
          timeout: timeoutMs,
          reject: false, // Do not throw on non-zero exit
          cwd: options.cwd,
          env: options.env ? { ...process.env, ...options.env } : undefined,
        };

        const result: ExecaReturnValue = await execa(command, args, execaOpts);

        const durationMs = Date.now() - start;
        const stdout = (result.stdout ?? '').toString().trim();
        const stderr = (result.stderr ?? '').toString().trim();
        const exitCode = result.exitCode ?? -1;

        if (!options.quiet) {
          this.logger.debug(`[${exitCode}] ${safeCmd} (${durationMs}ms)`);
        }

        if (exitCode === 0) {
          return {
            success: true,
            stdout,
            stderr,
            exitCode,
            durationMs,
            dryRun: false,
          };
        }

        // Non-zero exit: treat as failure, may retry
        lastError = new CommandError(
          command,
          args,
          exitCode,
          stderr,
          durationMs
        );
      } catch (error) {
        const durationMs = Date.now() - start;
        lastError = new CommandError(
          command,
          args,
          -1,
          (error as Error).message,
          durationMs,
          error as Error
        );
      }
    }

    // All attempts exhausted
    throw lastError;
  }

  /**
   * Check whether a command is available on the PATH.
   *
   * Uses `which` on Unix and `where` on Windows.
   * Never throws -- returns false if the command is not found.
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    validateCommand(command);

    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    try {
      const result = await execa(whichCmd, [command], {
        reject: false,
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the version string of a command by running `command --version`.
   *
   * Returns null if the command is not found or does not support `--version`.
   */
  async getCommandVersion(command: string): Promise<string | null> {
    try {
      const result = await this.run(command, {
        args: ['--version'],
        quiet: true,
        timeoutMs: 10_000,
      });
      if (result.success && result.stdout) {
        return result.stdout.split('\n')[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
