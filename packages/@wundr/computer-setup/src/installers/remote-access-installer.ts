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
    // Default by HARDWARE, not interactivity: a Mac mini/Studio/iMac is a thing
    // you connect TO (host); a MacBook connects OUT (master). The old
    // interactive→master guess wrongly put a mini set up at its own keyboard
    // into master mode, so none of the host provisioning ran. Override via
    // profile.remoteAccess.mode.
    const mode = cfg.mode ?? (await this.detectDefaultMode());
    this.logger.info(
      `Configuring remote access (mode: ${mode}, ${
        interactive ? 'interactive' : 'headless'
      })...`
    );

    await this.ensureTailscale();
    await this.tailscaleUp(cfg, interactive);
    await this.ensureSshKey();

    if (mode === 'host') {
      // A headless host must ACCEPT connections: enable the SSH server (Remote
      // Login) and native Screen Sharing / Remote Management, and stay awake.
      // All are scripted via passwordless `sudo -n`; if that's unavailable each
      // is logged as a manual `sudo` command rather than prompting. (TCC grants
      // for the screen stream are still a manual/MDM step — see logManualSteps.)
      await this.enableRemoteLogin();
      await this.configurePowerManagement(cfg);
      await this.enableScreenSharing();
    }

    await this.configureDesktopSharing(cfg, mode, interactive);

    if (mode === 'host') {
      await this.installAutoStartAgent(cfg, interactive);
      this.logManualSteps(cfg);
    }

    this.logger.info('Remote access configuration complete.');
  }

  /**
   * Pick host vs master from the hardware: laptops connect OUT (master),
   * desktops/minis are connected TO (host). Defaults to host on any error so a
   * machine being provisioned for remote access gets the full host setup.
   */
  private async detectDefaultMode(): Promise<'host' | 'master'> {
    try {
      const { stdout } = await execa('sysctl', ['-n', 'hw.model'], {
        timeout: 5_000,
      });
      return stdout.trim().toLowerCase().includes('macbook')
        ? 'master'
        : 'host';
    } catch {
      return 'host';
    }
  }

  /** Enable the SSH server (Remote Login) so a headless host accepts SSH in. */
  private async enableRemoteLogin(): Promise<void> {
    await this.sudoNonInteractive(
      'systemsetup',
      ['-setremotelogin', 'on'],
      'SSH Remote Login (System Settings > General > Sharing > Remote Login)'
    );
  }

  /**
   * Enable native macOS screen control so the host can be reached without
   * Parsec/RustDesk. Uses two complementary mechanisms for cross-version
   * reliability (both best-effort via `sudo -n`):
   *  - `launchctl enable system/com.apple.screensharing` + load → plain Screen
   *    Sharing (VNC), the lighter System Settings > Sharing toggle.
   *  - ARD `kickstart -activate` → Remote Management, the path that reliably
   *    works headlessly on modern macOS (also enables legacy VNC).
   * NOTE: granting a remote viewer actual pixels still needs the TCC Screen
   * Recording grant, which macOS will not let any script set — see
   * {@link logManualSteps}.
   */
  private async enableScreenSharing(): Promise<void> {
    await this.sudoNonInteractive(
      'launchctl',
      ['enable', 'system/com.apple.screensharing'],
      'Screen Sharing (System Settings > General > Sharing > Screen Sharing)'
    );
    await this.sudoNonInteractive(
      'launchctl',
      [
        'load',
        '-w',
        '/System/Library/LaunchDaemons/com.apple.screensharing.plist',
      ],
      'Screen Sharing (load daemon)'
    );

    const kickstart =
      '/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart';
    if (await fs.pathExists(kickstart)) {
      await this.sudoNonInteractive(
        kickstart,
        [
          '-activate',
          '-configure',
          '-access',
          '-on',
          '-restart',
          '-agent',
          '-privs',
          '-all',
        ],
        'Remote Management / ARD (System Settings > General > Sharing > Remote Management)'
      );
    }
  }

  /**
   * Install a per-user LaunchAgent that auto-starts the streaming app at login,
   * so the host is reachable after an unattended reboot (once auto-login is set
   * — see {@link logManualSteps}). Written to ~/Library/LaunchAgents (no sudo).
   */
  private async installAutoStartAgent(
    cfg: RemoteAccessConfig,
    interactive: boolean
  ): Promise<void> {
    const stack = cfg.stack ?? 'parsec';
    const appName = stack === 'rustdesk' ? 'RustDesk' : 'Parsec';
    const label = `com.adaptic.${stack}`;
    const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(agentsDir, `${label}.plist`);
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-a</string><string>${appName}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
`;
    try {
      await fs.ensureDir(agentsDir);
      await fs.writeFile(plistPath, plist);
      // Best-effort load; only meaningful with a GUI session attached.
      if (interactive) {
        await execa('launchctl', ['load', '-w', plistPath], {
          reject: false,
          timeout: 15_000,
        });
      }
      this.logger.info(
        `Installed auto-start LaunchAgent for ${appName} at ${plistPath}.`
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not install auto-start agent for ${appName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Log the host-mode settings macOS deliberately will NOT let a script set;
   * a human (or an MDM PPPC profile) must do these once per machine.
   */
  private logManualSteps(cfg: RemoteAccessConfig): void {
    const stack = cfg.stack ?? 'parsec';
    const appName = stack === 'rustdesk' ? 'RustDesk' : 'Parsec';
    this.logger.warn(
      'Manual macOS steps remaining (security-gated — do once per machine, or push an MDM PPPC profile):\n' +
        `  1. Privacy & Security > Screen Recording AND Accessibility > enable ${appName} ` +
        `(${appName}, being third-party, is black/uncontrollable without this; macOS cannot grant TCC by script). ` +
        'Native Screen Sharing was enabled for you and is exempt from this grant.\n' +
        `  2. Open ${appName} once and sign in, enabling Host / Unattended Access ` +
        '(first-run GUI sign-in cannot be scripted).\n' +
        '  3. Users & Groups > Login Options > Automatic login > your user ' +
        '(so a GUI session exists after an unattended reboot — needs the cleartext password; not scriptable).\n' +
        '  4. If Remote Login/systemsetup reported a Full Disk Access error: ' +
        'Privacy & Security > Full Disk Access > enable your terminal/SSH client.'
    );
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

    // The Tailscale cask installs a system/network extension and so needs an
    // admin password. With stdin detached the prompt can never be answered and
    // the process blocks until timeout — exactly the "stuck for 10 minutes"
    // symptom. On an interactive run, attach stdin so the user can type their
    // password; on a headless run keep stdin detached and use a short timeout
    // (it can only succeed with passwordless sudo) and report clearly.
    const interactive = isInteractive();
    this.logger.info(
      interactive
        ? 'Installing Tailscale (a macOS admin password prompt may appear)...'
        : 'Installing Tailscale (headless)...'
    );
    try {
      const result = await runProcess(
        'brew',
        ['install', '--cask', 'tailscale'],
        {
          timeout: interactive ? 10 * 60 * 1000 : 3 * 60 * 1000,
          reject: false,
          stdin: interactive ? 'inherit' : 'ignore',
        }
      );
      if (result.timedOut) {
        this.logger.warn(
          'Tailscale install timed out (it needs admin rights for its network ' +
            'extension). Install it manually with `brew install --cask tailscale`, ' +
            'or configure passwordless sudo, then re-run.'
        );
      }
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
