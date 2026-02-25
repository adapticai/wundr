/**
 * Platform Adapter
 *
 * Maps abstract tool specifications to concrete, platform-specific install
 * and validate commands. Detects available system package managers and
 * handles platform quirks.
 *
 * @module profiles/platform-adapter
 */

import * as fs from 'fs/promises';
import * as os from 'os';

import { Logger } from '../utils/logger';
import { PlatformDetector } from '../core/platform-detector';

import type { SetupPlatform } from '../types';
import type {
  DetectedPackageManager,
  PackageManagerDetectionResult,
  PlatformInstallSpec,
  ToolSpec,
} from './profile-types';

const logger = new Logger({ name: 'platform-adapter' });

/**
 * Resolved install/validate commands for a single tool on the current platform.
 */
export interface ResolvedToolCommand {
  /** Tool name. */
  toolName: string;

  /** Whether the tool is supported on this platform. */
  supported: boolean;

  /** Reason if unsupported. */
  unsupportedReason?: string;

  /** Concrete install command for this platform. */
  installCommand: string | null;

  /** Concrete validate command for this platform. */
  validateCommand: string;

  /** The package manager that will be used. */
  packageManager?: string;
}

/**
 * Adapts abstract tool specifications to the current platform.
 */
export class PlatformAdapter {
  private detector: PlatformDetector;
  private cachedPlatform: SetupPlatform | null = null;
  private cachedPackageManagers: PackageManagerDetectionResult | null = null;

  constructor(detector?: PlatformDetector) {
    this.detector = detector || new PlatformDetector();
  }

  /**
   * Get the detected platform (cached).
   */
  getPlatform(): SetupPlatform {
    if (!this.cachedPlatform) {
      this.cachedPlatform = this.detector.detect();
    }
    return this.cachedPlatform;
  }

  /**
   * Resolve concrete install/validate commands for a tool on the current platform.
   */
  resolveToolCommand(tool: ToolSpec): ResolvedToolCommand {
    const platform = this.getPlatform();
    const osName = platform.os;

    // Check for platform-specific override
    const platformSpec = tool.platformOverrides?.[osName];

    if (platformSpec && !platformSpec.supported) {
      return {
        toolName: tool.name,
        supported: false,
        unsupportedReason:
          platformSpec.unsupportedReason ||
          `${tool.displayName} is not supported on ${osName}`,
        installCommand: null,
        validateCommand: tool.validateCommand || `${tool.name} --version`,
      };
    }

    // Determine install command
    let installCommand: string | null = null;
    let packageManager: string | undefined;

    if (platformSpec?.installCommand) {
      installCommand = platformSpec.installCommand;
      packageManager = this.inferPackageManager(installCommand);
    } else {
      // Fall back to default install via detected package manager
      installCommand = this.getDefaultInstallCommand(tool, osName);
      packageManager = this.getDefaultPackageManagerName(osName);
    }

    // Determine validate command
    const validateCommand =
      platformSpec?.validateCommand ||
      tool.validateCommand ||
      `${tool.name} --version`;

    return {
      toolName: tool.name,
      supported: true,
      installCommand,
      validateCommand,
      packageManager,
    };
  }

  /**
   * Resolve commands for all tools in a list.
   */
  resolveAllToolCommands(tools: ToolSpec[]): ResolvedToolCommand[] {
    return tools.map(t => this.resolveToolCommand(t));
  }

  /**
   * Detect all available package managers on the current system.
   */
  async detectPackageManagers(): Promise<PackageManagerDetectionResult> {
    if (this.cachedPackageManagers) {
      return this.cachedPackageManagers;
    }

    const platform = this.getPlatform();
    const all: DetectedPackageManager[] = [];

    switch (platform.os) {
      case 'darwin':
        await this.probeManager('brew', 'brew --version', all);
        break;

      case 'linux': {
        const linuxFamily = await this.detectLinuxFamily();
        await this.probeManager('brew', 'brew --version', all);
        await this.probeManager('apt-get', 'apt-get --version', all);
        await this.probeManager('dnf', 'dnf --version', all);
        await this.probeManager('pacman', 'pacman --version', all);
        await this.probeManager('zypper', 'zypper --version', all);
        await this.probeManager('apk', 'apk --version', all);

        // Mark primary based on distro family
        const primaryName = this.getPrimaryManagerForLinuxFamily(linuxFamily);
        for (const mgr of all) {
          mgr.primary = mgr.name === primaryName;
        }

        this.cachedPackageManagers = {
          primary: all.find(m => m.primary) || all[0] || null,
          all,
          platform,
          linuxFamily,
        };
        return this.cachedPackageManagers;
      }

      case 'win32':
        await this.probeManager('winget', 'winget --version', all);
        await this.probeManager('choco', 'choco --version', all);
        await this.probeManager('scoop', 'scoop --version', all);
        break;
    }

    // Mark first as primary if none explicitly set
    if (all.length > 0 && !all.some(m => m.primary)) {
      all[0].primary = true;
    }

    this.cachedPackageManagers = {
      primary: all.find(m => m.primary) || null,
      all,
      platform,
    };

    logger.info(
      `Detected package managers: ${all.map(m => m.name).join(', ') || 'none'}`
    );

    return this.cachedPackageManagers;
  }

  /**
   * Get an alternative install command for a tool using a specific package manager.
   * Useful when the primary manager is unavailable.
   */
  getAlternativeInstallCommand(
    tool: ToolSpec,
    managerName: string
  ): string | null {
    const platform = this.getPlatform();
    const platformSpec = tool.platformOverrides?.[platform.os];

    if (platformSpec?.alternativeCommands?.[managerName]) {
      return platformSpec.alternativeCommands[managerName];
    }

    return null;
  }

  /**
   * Detect the Linux distribution family from /etc/os-release.
   */
  async detectLinuxFamily(): Promise<
    PackageManagerDetectionResult['linuxFamily']
  > {
    try {
      const osRelease = await fs.readFile('/etc/os-release', 'utf-8');
      const idLine = osRelease.split('\n').find(line => line.startsWith('ID='));
      const idLikeLine = osRelease
        .split('\n')
        .find(line => line.startsWith('ID_LIKE='));

      const id = idLine?.split('=')[1]?.replace(/"/g, '').trim().toLowerCase();
      const idLike = idLikeLine
        ?.split('=')[1]
        ?.replace(/"/g, '')
        .trim()
        .toLowerCase();

      const combined = `${id || ''} ${idLike || ''}`;

      if (
        combined.includes('debian') ||
        combined.includes('ubuntu') ||
        combined.includes('mint')
      ) {
        return 'debian';
      }
      if (
        combined.includes('rhel') ||
        combined.includes('fedora') ||
        combined.includes('centos') ||
        combined.includes('rocky') ||
        combined.includes('alma')
      ) {
        return 'redhat';
      }
      if (combined.includes('arch') || combined.includes('manjaro')) {
        return 'arch';
      }
      if (combined.includes('suse') || combined.includes('opensuse')) {
        return 'suse';
      }
      if (combined.includes('alpine')) {
        return 'alpine';
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Clear cached detection results. Useful for testing.
   */
  clearCache(): void {
    this.cachedPlatform = null;
    this.cachedPackageManagers = null;
    this.detector.clearCache();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Probe whether a package manager is available.
   */
  private async probeManager(
    name: string,
    versionCommand: string,
    results: DetectedPackageManager[]
  ): Promise<void> {
    try {
      const { execa } = await import('execa');
      const parts = versionCommand.split(' ');
      const { stdout } = await execa(parts[0], parts.slice(1), {
        timeout: 5000,
      });
      const version = stdout.split('\n')[0].trim();

      // Determine path
      let binPath: string;
      try {
        const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
        const { stdout: pathOut } = await execa(whichCmd, [name], {
          timeout: 3000,
        });
        binPath = pathOut.trim().split('\n')[0];
      } catch {
        binPath = name;
      }

      results.push({
        name,
        path: binPath,
        version,
        primary: false,
      });
    } catch {
      // Manager not available; skip
    }
  }

  /**
   * Infer which package manager an install command uses.
   */
  private inferPackageManager(command: string): string | undefined {
    if (command.includes('brew ')) return 'brew';
    if (command.includes('apt ') || command.includes('apt-get ')) return 'apt';
    if (command.includes('dnf ')) return 'dnf';
    if (command.includes('pacman ')) return 'pacman';
    if (command.includes('winget ')) return 'winget';
    if (command.includes('choco ')) return 'choco';
    if (command.includes('scoop ')) return 'scoop';
    if (command.includes('pip ') || command.includes('pip3 ')) return 'pip';
    if (command.includes('npm ')) return 'npm';
    if (command.includes('snap ')) return 'snap';
    return undefined;
  }

  /**
   * Get a default install command when no platform override is provided.
   */
  private getDefaultInstallCommand(
    tool: ToolSpec,
    osName: SetupPlatform['os']
  ): string | null {
    const versionSuffix = tool.version ? `@${tool.version}` : '';

    switch (osName) {
      case 'darwin':
        return `brew install ${tool.name}${versionSuffix}`;
      case 'linux':
        return `brew install ${tool.name}${versionSuffix}`;
      case 'win32':
        return `winget install ${tool.name}`;
      default:
        return null;
    }
  }

  /**
   * Get the default package manager name for a platform.
   */
  private getDefaultPackageManagerName(osName: SetupPlatform['os']): string {
    switch (osName) {
      case 'darwin':
        return 'brew';
      case 'linux':
        return 'brew';
      case 'win32':
        return 'winget';
      default:
        return 'brew';
    }
  }

  /**
   * Map Linux distro family to its native package manager.
   */
  private getPrimaryManagerForLinuxFamily(
    family: PackageManagerDetectionResult['linuxFamily']
  ): string {
    switch (family) {
      case 'debian':
        return 'apt-get';
      case 'redhat':
        return 'dnf';
      case 'arch':
        return 'pacman';
      case 'suse':
        return 'zypper';
      case 'alpine':
        return 'apk';
      default:
        return 'brew'; // Homebrew on Linux as fallback
    }
  }
}

export default PlatformAdapter;
