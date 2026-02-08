/**
 * Platform Detector
 *
 * Cross-platform system detection and capability queries.
 * Replaces fragile subprocess-based checks (df, ping) with
 * native Node.js APIs for reliability and portability.
 *
 * Supports macOS, Linux, and Windows.
 */

import * as dns from 'dns/promises';
import * as fs from 'fs/promises';
import * as os from 'os';

import type { SetupPlatform } from '../types';

/**
 * Minimum system requirements for setup
 */
export interface SystemRequirements {
  /** Minimum free disk space in bytes */
  minDiskSpaceBytes: number;
  /** Whether network connectivity is required */
  requireNetwork: boolean;
  /** Minimum Node.js major version */
  minNodeMajorVersion: number;
}

/**
 * Result of a system validation check
 */
export interface SystemValidationResult {
  valid: boolean;
  platform: SetupPlatform;
  diskSpaceBytes: number;
  networkAvailable: boolean;
  nodeVersion: string;
  errors: string[];
  warnings: string[];
}

const DEFAULT_REQUIREMENTS: SystemRequirements = {
  minDiskSpaceBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  requireNetwork: true,
  minNodeMajorVersion: 18,
};

/**
 * Detects the current platform and validates system requirements.
 *
 * All checks use native Node.js APIs -- no subprocesses are spawned.
 * Results are cached for the lifetime of the instance.
 */
export class PlatformDetector {
  private cachedPlatform: SetupPlatform | null = null;
  private cachedDiskSpace: number | null = null;
  private cachedNetworkAvailable: boolean | null = null;

  /**
   * Detect the current platform. Cached after first call.
   */
  detect(): SetupPlatform {
    if (this.cachedPlatform) {
      return this.cachedPlatform;
    }

    const rawPlatform = process.platform;
    let osName: SetupPlatform['os'];

    if (rawPlatform === 'darwin') {
      osName = 'darwin';
    } else if (rawPlatform === 'win32') {
      osName = 'win32';
    } else {
      osName = 'linux';
    }

    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

    this.cachedPlatform = {
      os: osName,
      arch: arch as 'x64' | 'arm64',
      version: os.release(),
      node: process.version,
      shell: process.env.SHELL || (osName === 'win32' ? 'powershell' : 'bash'),
    };

    return this.cachedPlatform;
  }

  /**
   * Get available disk space on the home directory volume.
   *
   * Uses the Node.js `fs.statfs` API (available since Node 18.15)
   * instead of spawning `df`. Falls back to a generous estimate
   * if the API is unavailable.
   */
  async getAvailableDiskSpace(): Promise<number> {
    if (this.cachedDiskSpace !== null) {
      return this.cachedDiskSpace;
    }

    try {
      const homeDir = os.homedir();
      // fs.statfs is available in Node 18.15+
      if (typeof fs.statfs === 'function') {
        const stats = await fs.statfs(homeDir);
        this.cachedDiskSpace = stats.bavail * stats.bsize;
        return this.cachedDiskSpace;
      }

      // Fallback: assume sufficient space when API is unavailable
      this.cachedDiskSpace = Number.MAX_SAFE_INTEGER;
      return this.cachedDiskSpace;
    } catch {
      // If we cannot determine disk space, assume it is sufficient
      // rather than blocking the entire setup.
      this.cachedDiskSpace = Number.MAX_SAFE_INTEGER;
      return this.cachedDiskSpace;
    }
  }

  /**
   * Check network connectivity using DNS resolution.
   *
   * This avoids spawning `ping` (which may require special permissions
   * on some platforms) and instead performs a DNS lookup against a
   * well-known domain.
   */
  async checkNetworkConnectivity(): Promise<boolean> {
    if (this.cachedNetworkAvailable !== null) {
      return this.cachedNetworkAvailable;
    }

    const domains = ['registry.npmjs.org', 'github.com', 'dns.google'];

    for (const domain of domains) {
      try {
        await dns.lookup(domain);
        this.cachedNetworkAvailable = true;
        return true;
      } catch {
        // Try next domain
      }
    }

    this.cachedNetworkAvailable = false;
    return false;
  }

  /**
   * Validate the system against a set of requirements.
   *
   * Returns a structured result with errors and warnings rather
   * than throwing, so callers can decide how to proceed.
   */
  async validate(
    requirements: Partial<SystemRequirements> = {}
  ): Promise<SystemValidationResult> {
    const reqs = { ...DEFAULT_REQUIREMENTS, ...requirements };
    const platform = this.detect();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check platform support
    const supportedPlatforms: SetupPlatform['os'][] = [
      'darwin',
      'linux',
      'win32',
    ];
    if (!supportedPlatforms.includes(platform.os)) {
      errors.push(`Unsupported operating system: ${platform.os}`);
    }

    // Check disk space
    const diskSpaceBytes = await this.getAvailableDiskSpace();
    if (diskSpaceBytes < reqs.minDiskSpaceBytes) {
      const requiredGB = Math.ceil(reqs.minDiskSpaceBytes / 1024 / 1024 / 1024);
      const availableGB = Math.round(diskSpaceBytes / 1024 / 1024 / 1024);
      errors.push(
        `Insufficient disk space. Required: ${requiredGB}GB, Available: ${availableGB}GB`
      );
    }

    // Check network
    const networkAvailable = await this.checkNetworkConnectivity();
    if (reqs.requireNetwork && !networkAvailable) {
      errors.push('No network connectivity detected');
    } else if (!networkAvailable) {
      warnings.push(
        'No network connectivity detected; some installations may fail'
      );
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    if (nodeMajor < reqs.minNodeMajorVersion) {
      errors.push(
        `Node.js ${reqs.minNodeMajorVersion}+ required, found ${nodeVersion}`
      );
    }

    return {
      valid: errors.length === 0,
      platform,
      diskSpaceBytes,
      networkAvailable,
      nodeVersion,
      errors,
      warnings,
    };
  }

  /**
   * Return the default package manager command for the detected platform.
   */
  getPackageManagerCommand(): string {
    const platform = this.detect();
    switch (platform.os) {
      case 'darwin':
        return 'brew';
      case 'linux':
        return 'apt-get';
      case 'win32':
        return 'winget';
      default:
        return 'brew';
    }
  }

  /**
   * Clear all cached values. Useful for testing or when the
   * environment changes during a long-running process.
   */
  clearCache(): void {
    this.cachedPlatform = null;
    this.cachedDiskSpace = null;
    this.cachedNetworkAvailable = null;
  }
}
