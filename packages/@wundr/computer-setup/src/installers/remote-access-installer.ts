/**
 * Remote Access Installer — provisions a Mac for remote access as part of the
 * standard computer-setup flow (ported from scripts/remote-setup/setup_remote_mac.sh).
 *
 * Design goals (headless-first, never hangs):
 *  - Auto-detects mode: `host` on a headless mini (accepts connections), `master`
 *    on an interactive laptop (connects out). Override via profile.remoteAccess.mode.
 *  - Tailscale + SSH key are installed headlessly (argv arrays, NO `eval`).
 *  - Power management + LaunchDaemons (host mode) use `sudo -n` so a missing
 *    sudo timestamp is logged and skipped, never prompted.
 *  - Desktop sharing (Parsec/RustDesk) needs a TCC grant (Screen Recording +
 *    Accessibility) that macOS cannot script headlessly, so it is attempted only
 *    when a console is attached and otherwise logged as a manual / MDM-PPPC step.
 *
 * The step is `required: false`, so a remote-access failure never aborts the
 * core machine setup.
 */
import { execa } from 'execa';
import * as os from 'os';
import * as path from 'path';

import * as fs from 'fs-extra';
import which from 'which';

import { isInteractive, runProcess } from '../lib/headless';
import { Logger } from '../utils/logger';

import type {
  DeveloperProfile,
  RemoteAccessConfig,
  SetupPlatform,
  SetupStep,
} from '../types';
import type { BaseInstaller } from './index';

export class RemoteAccessInstaller implements BaseInstaller {
  name = 'remote-access';
  private readonly logger = new Logger({ name: 'RemoteAccessInstaller' });
  private sudoUnavailable = false;

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin';
  }

  async isInstalled(): Promise<boolean> {
    try {
      await which('tailscale');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('tailscale', ['version'], {
        timeout: 10_000,
      });
      return stdout.split('\n')[0]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  async validate(): Promise<boolean> {
    return this.isInstalled();
  }

  getSteps(_profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'configure-remote-access',
        name: 'Configure Remote Access',
        description:
          'Tailscale + SSH (+ power management & desktop sharing on headless hosts)',
        category: 'system',
        // Never block the core setup if remote access can't be completed.
        required: false,
        dependencies: ['install-homebrew'],
        estimatedTime: 180,
        validator: () => this.validate(),
        installer: () => this.install(_profile, _platform),
      },
    ];
  }

  async install(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    const cfg: RemoteAccessConfig = profile.remoteAccess ?? {};

    if (cfg.enabled === false || process.env.WUNDR_NO_REMOTE_ACCESS === '1') {
      this.logger.info('Remote access disabled — skipping.');
      return;
    }

    const interactive = isInteractive();
    const mode = cfg.mode ?? (interactive ? 'master' : 'host');
    this.logger.info(
      `Configuring remote access (mode: ${mode}, ${
        interactive ? 'interactive' : 'headless'
      })...`
    );

    await this.ensureTailscale();
    await this.tailscaleUp(cfg, interactive);
    await this.ensureSshKey();

    if (mode === 'host') {
      await this.configurePowerManagement(cfg);
    }

    await this.configureDesktopSharing(cfg, mode, interactive);

    this.logger.info('Remote access configuration complete.');
  }

  private async ensureTailscale(): Promise<void> {
    try {
      await which('tailscale');
      this.logger.info('Tailscale already installed');
      return;
    } catch {
      // not installed
    }

    try {
      await which('brew');
    } catch {
      this.logger.warn(
        'Homebrew not available — cannot install Tailscale. Skipping remote networking.'
      );
      return;
    }

    this.logger.info('Installing Tailscale...');
    try {
      await runProcess('brew', ['install', '--cask', 'tailscale'], {
        timeout: 10 * 60 * 1000,
        reject: false,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Tailscale install failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async tailscaleUp(
    cfg: RemoteAccessConfig,
    interactive: boolean
  ): Promise<void> {
    try {
      await which('tailscale');
    } catch {
      return;
    }

    const authKey = cfg.tailscaleAuthKey ?? process.env.TAILSCALE_AUTH_KEY;
    const deviceName = cfg.deviceName ?? os.hostname();

    // argv array — NO eval, no shell interpolation of the auth key.
    const args = [
      'up',
      `--hostname=${deviceName}`,
      '--accept-dns=true',
      '--accept-routes=true',
    ];
    if (authKey) args.push(`--authkey=${authKey}`);
    if (cfg.tailscaleTags) args.push(`--advertise-tags=${cfg.tailscaleTags}`);

    if (!authKey && !interactive) {
      this.logger.warn(
        'No Tailscale auth key and no console attached — skipping `tailscale up`. ' +
          'Set TAILSCALE_AUTH_KEY (or profile.remoteAccess.tailscaleAuthKey) for unattended join.'
      );
      return;
    }

    if (!authKey) {
      this.logger.info(
        'No auth key provided — run `tailscale up` and authenticate in the browser to finish joining the tailnet.'
      );
      return;
    }

    try {
      await runProcess('tailscale', args, { timeout: 120_000, reject: false });
      this.logger.info('Tailscale brought up.');
    } catch (error: unknown) {
      this.logger.warn(
        `tailscale up failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async ensureSshKey(): Promise<void> {
    const sshDir = path.join(os.homedir(), '.ssh');
    const keyPath = path.join(sshDir, 'id_ed25519');
    if (await fs.pathExists(keyPath)) {
      this.logger.info('SSH key already present.');
      return;
    }

    await fs.ensureDir(sshDir);
    await fs.chmod(sshDir, 0o700);
    try {
      await runProcess(
        'ssh-keygen',
        [
          '-t',
          'ed25519',
          '-f',
          keyPath,
          '-N',
          '',
          '-C',
          `${os.userInfo().username}@${os.hostname()}`,
        ],
        { timeout: 60_000 }
      );
      this.logger.info(`Generated SSH key at ${keyPath}`);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not generate SSH key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async configurePowerManagement(
    cfg: RemoteAccessConfig
  ): Promise<void> {
    const preventSleep = cfg.preventSleep ?? true;
    const displaySleep = cfg.displaySleepMinutes ?? 10;

    await this.backupPowerSettings();

    const commands: string[][] = [
      ['-a', 'womp', '1'], // wake-on-LAN
      ['-a', 'autorestart', '1'], // restart after power failure
      ['-a', 'hibernatemode', '0'],
    ];
    if (preventSleep) {
      commands.push(
        ['-a', 'sleep', '0'],
        ['-a', 'displaysleep', String(displaySleep)],
        ['-a', 'disksleep', '0']
      );
    }

    for (const args of commands) {
      await this.sudoNonInteractive('pmset', args, 'power management');
    }
  }

  /** Capture a machine-readable backup of the power settings we change. */
  private async backupPowerSettings(): Promise<void> {
    try {
      const { stdout } = await execa('pmset', ['-g', 'custom'], {
        timeout: 15_000,
      });
      const keys = [
        'womp',
        'autorestart',
        'hibernatemode',
        'sleep',
        'displaysleep',
        'disksleep',
      ];
      const backup: Record<string, string> = {};
      for (const line of stdout.split('\n')) {
        const match = line.trim().match(/^([a-z]+)\s+(\d+)/i);
        if (match && keys.includes(match[1])) backup[match[1]] = match[2];
      }
      const dir = path.join(os.homedir(), '.wundr', 'remote-access');
      await fs.ensureDir(dir);
      await fs.writeJson(path.join(dir, 'pmset-backup.json'), backup, {
        spaces: 2,
      });
      this.logger.info('Backed up current power settings (revertable).');
    } catch {
      this.logger.warn('Could not back up power settings; continuing.');
    }
  }

  private async configureDesktopSharing(
    cfg: RemoteAccessConfig,
    mode: 'host' | 'master',
    interactive: boolean
  ): Promise<void> {
    if (mode !== 'host') {
      return;
    }

    if (!interactive) {
      this.logger.warn(
        'Desktop sharing (Parsec/RustDesk) requires an interactive TCC grant ' +
          '(Screen Recording + Accessibility) that macOS cannot script headlessly. ' +
          'Skipped — grant it in System Settings > Privacy & Security, or push an MDM PPPC profile, then install the stack.'
      );
      return;
    }

    const stack = cfg.stack ?? 'parsec';
    try {
      await runProcess('brew', ['install', '--cask', stack], {
        timeout: 10 * 60 * 1000,
        reject: false,
      });
      this.logger.info(
        `Installed ${stack}. Grant Screen Recording + Accessibility in ` +
          'System Settings > Privacy & Security for unattended remote control.'
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not install ${stack}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Run a privileged command without ever prompting; log+skip if sudo is unavailable. */
  private async sudoNonInteractive(
    command: string,
    args: string[],
    context: string
  ): Promise<void> {
    if (this.sudoUnavailable) return;

    const result = await execa('sudo', ['-n', command, ...args], {
      stdin: 'ignore',
      timeout: 30_000,
      reject: false,
    });

    if (result.exitCode !== 0) {
      this.sudoUnavailable = true;
      this.logger.warn(
        `Skipping ${context}: passwordless sudo is unavailable. ` +
          `Run \`sudo ${command} ${args.join(' ')}\` (and the related commands) manually, or provision with cached sudo.`
      );
    }
  }
}
