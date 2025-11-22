/**
 * System detection and information utilities
 */

import { execSync } from 'child_process';
import { platform, arch } from 'os';

import { Platform, SystemInfo } from '../types';

/**
 * Detect the current platform
 */
export async function detectPlatform(): Promise<Platform> {
  const platformName = platform();

  switch (platformName) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      throw new Error(`Unsupported platform: ${platformName}`);
  }
}

/**
 * Get comprehensive system information
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const detectedPlatform = await detectPlatform();

  return {
    platform: detectedPlatform,
    architecture: arch(),
    nodeVersion: getVersion('node --version'),
    npmVersion: getVersion('npm --version'),
    dockerVersion: getVersion('docker --version'),
    gitVersion: getVersion('git --version'),
    shell: getShellName(),
    terminal: getTerminalName(),
  };
}

/**
 * Get version of a command
 */
function getVersion(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
      .toString()
      .trim()
      .replace(/^v/, ''); // Remove 'v' prefix if present
  } catch {
    // Command not found or execution failed - tool is not installed
    return 'not installed';
  }
}

/**
 * Get current shell name
 */
function getShellName(): string {
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  if (platform() === 'win32') return 'powershell';

  return 'unknown';
}

/**
 * Get terminal name
 */
function getTerminalName(): string {
  const term = process.env.TERM_PROGRAM || process.env.TERMINAL_EMULATOR || '';

  if (term.includes('iTerm')) return 'iTerm2';
  if (term.includes('Terminal')) return 'Terminal.app';
  if (term.includes('VSCode')) return 'VS Code Terminal';
  if (term.includes('Hyper')) return 'Hyper';

  return process.env.TERM || 'unknown';
}

/**
 * Check if running in Docker
 */
export function isRunningInDocker(): boolean {
  try {
    return execSync('cat /proc/1/cgroup', { encoding: 'utf8' }).includes(
      'docker'
    );
  } catch {
    // File doesn't exist or isn't accessible - not running in Docker
    return false;
  }
}

/**
 * Check if running in CI environment
 */
export function isRunningInCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.GITLAB_CI
  );
}
