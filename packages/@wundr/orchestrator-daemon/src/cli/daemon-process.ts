/**
 * Daemon Process Manager
 *
 * Forks the daemon as a detached child process so it survives the parent
 * CLI process exiting. Handles:
 *   - Stdout/stderr redirection to log files
 *   - PID file creation and cleanup
 *   - Automatic restart on crash (up to MAX_RESTARTS attempts)
 *   - Stale PID file detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000; // track restarts within the last minute
const PID_FILE = '/tmp/wundr-daemon.pid';
const LOG_DIR = '/tmp/wundr-daemon-logs';

// ---------------------------------------------------------------------------
// PID file helpers
// ---------------------------------------------------------------------------

/**
 * Write the given PID to the PID file.
 */
export function writePidFile(pid: number, pidFile: string = PID_FILE): void {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(pid), { encoding: 'utf-8', mode: 0o644 });
}

/**
 * Remove the PID file. Silently ignores ENOENT.
 */
export function removePidFile(pidFile: string = PID_FILE): void {
  try {
    fs.unlinkSync(pidFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Read the PID stored in the PID file.
 * Returns null if the file does not exist or contains an invalid value.
 */
export function readPidFile(pidFile: string = PID_FILE): number | null {
  try {
    const content = fs.readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Check whether a process with the given PID is currently running.
 * Uses signal 0 which does not kill the process but validates existence.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but we lack permission to signal it
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Resolve the PID from the PID file and verify the process is alive.
 * Removes stale PID files automatically.
 * Returns null if not running.
 */
export function resolveRunningPid(pidFile: string = PID_FILE): number | null {
  const pid = readPidFile(pidFile);
  if (pid === null) {
    return null;
  }

  if (isProcessRunning(pid)) {
    return pid;
  }

  // Stale PID file — clean it up
  removePidFile(pidFile);
  return null;
}

// ---------------------------------------------------------------------------
// Log file helpers
// ---------------------------------------------------------------------------

function ensureLogDir(logDir: string): void {
  fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
}

function openLogFile(logDir: string, name: string): number {
  ensureLogDir(logDir);
  const logPath = path.join(logDir, name);
  return fs.openSync(logPath, 'a', 0o644);
}

// ---------------------------------------------------------------------------
// Process launcher
// ---------------------------------------------------------------------------

export interface SpawnDaemonOptions {
  /** Path to the compiled CLI JS file or a module entry point */
  entryPoint: string;
  /** Extra argv to pass to the child (e.g. ["--port", "8788"]) */
  args?: string[];
  /** Directory to write log files */
  logDir?: string;
  /** Path to write the PID file */
  pidFile?: string;
  /** Working directory for the daemon process */
  cwd?: string;
  /** Extra environment variables for the daemon */
  env?: NodeJS.ProcessEnv;
}

export interface SpawnDaemonResult {
  pid: number;
  logFile: string;
  errorLogFile: string;
}

/**
 * Spawn the daemon as a detached background process with restart supervision.
 *
 * The supervisor itself runs briefly in the background, watches the daemon
 * process, and restarts it up to MAX_RESTARTS times within RESTART_WINDOW_MS.
 * After that it gives up and removes the PID file.
 */
export async function spawnDaemon(
  options: SpawnDaemonOptions
): Promise<SpawnDaemonResult> {
  const logDir = options.logDir ?? LOG_DIR;
  const pidFile = options.pidFile ?? PID_FILE;
  const cwd = options.cwd ?? process.cwd();
  const env = { ...process.env, ...(options.env ?? {}) };

  ensureLogDir(logDir);
  const logFile = path.join(logDir, 'daemon.log');
  const errorLogFile = path.join(logDir, 'daemon-error.log');

  // Spawn the supervisor as a detached process
  const supervisorScript = buildSupervisorScript(
    options.entryPoint,
    options.args ?? [],
    logFile,
    errorLogFile,
    pidFile,
    MAX_RESTARTS,
    RESTART_WINDOW_MS,
    cwd
  );

  const supervisor = spawn(process.execPath, ['--eval', supervisorScript], {
    detached: true,
    stdio: 'ignore',
    env,
    cwd,
  });

  supervisor.unref();

  // Give the supervisor a moment to write the PID file
  await new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    const interval = setInterval(() => {
      attempts++;
      const pid = readPidFile(pidFile);
      if (pid !== null) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(
          new Error(
            'Daemon did not write PID file within 5 seconds. Check logs at: ' +
              logFile
          )
        );
      }
    }, 100);
  });

  const pid = readPidFile(pidFile)!;
  return { pid, logFile, errorLogFile };
}

/**
 * Build the Node.js inline script that acts as the process supervisor.
 * We inline it as a string so it can be passed to node --eval without
 * requiring a separate script file on disk.
 */
function buildSupervisorScript(
  entryPoint: string,
  args: string[],
  logFile: string,
  errorLogFile: string,
  pidFile: string,
  maxRestarts: number,
  restartWindowMs: number,
  cwd: string
): string {
  // Serialize config as JSON so it can be safely embedded in the script string
  const config = JSON.stringify({
    entryPoint,
    args,
    logFile,
    errorLogFile,
    pidFile,
    maxRestarts,
    restartWindowMs,
    cwd,
  });

  return `
(function() {
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');
  const cfg = ${config};

  let restartTimestamps = [];
  let currentChild = null;

  function writePid(pid) {
    try {
      fs.writeFileSync(cfg.pidFile, String(pid), { encoding: 'utf-8', mode: 0o644 });
    } catch(e) {
      process.stderr.write('Supervisor: failed to write PID file: ' + e.message + '\\n');
    }
  }

  function removePid() {
    try { fs.unlinkSync(cfg.pidFile); } catch(_) {}
  }

  function openLog(p) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      return fs.openSync(p, 'a', 0o644);
    } catch(e) {
      return 'pipe';
    }
  }

  function startDaemon() {
    const outFd = openLog(cfg.logFile);
    const errFd = openLog(cfg.errorLogFile);

    const child = spawn(process.execPath, [cfg.entryPoint].concat(cfg.args), {
      cwd: cfg.cwd,
      env: process.env,
      stdio: [
        'ignore',
        typeof outFd === 'number' ? outFd : 'pipe',
        typeof errFd === 'number' ? errFd : 'pipe',
      ],
      detached: false,
    });

    writePid(child.pid);
    currentChild = child;

    child.on('exit', function(code, signal) {
      const msg = '[' + new Date().toISOString() + '] Daemon exited: code=' + code + ' signal=' + signal + '\\n';
      try { fs.appendFileSync(cfg.logFile, msg); } catch(_) {}

      const now = Date.now();
      restartTimestamps = restartTimestamps.filter(function(t) {
        return now - t < cfg.restartWindowMs;
      });

      if (code === 0 || signal === 'SIGTERM') {
        // Clean exit or graceful stop — do not restart
        removePid();
        process.exit(0);
        return;
      }

      if (restartTimestamps.length >= cfg.maxRestarts) {
        const warn = '[' + new Date().toISOString() + '] Max restarts (' + cfg.maxRestarts + ') reached. Giving up.\\n';
        try { fs.appendFileSync(cfg.logFile, warn); } catch(_) {}
        removePid();
        process.exit(1);
        return;
      }

      restartTimestamps.push(now);
      const delay = 2000 * restartTimestamps.length;
      const retryMsg = '[' + new Date().toISOString() + '] Restarting daemon in ' + delay + 'ms (attempt ' + restartTimestamps.length + '/' + cfg.maxRestarts + ')...\\n';
      try { fs.appendFileSync(cfg.logFile, retryMsg); } catch(_) {}

      setTimeout(startDaemon, delay);
    });
  }

  // Handle supervisor signals - forward to child
  process.on('SIGTERM', function() {
    if (currentChild) {
      currentChild.kill('SIGTERM');
    }
  });

  process.on('SIGINT', function() {
    if (currentChild) {
      currentChild.kill('SIGINT');
    }
  });

  startDaemon();
})();
`;
}
