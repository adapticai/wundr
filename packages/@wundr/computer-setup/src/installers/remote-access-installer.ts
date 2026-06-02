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

    // Running under `sudo` is the #1 reason remote-access "looks done but isn't":
    // GUI actions launched from a sudo session (opening Settings panes, launching
    // Parsec, Tailscale's network-extension approval dialog) don't surface in the
    // user's Aqua session. Tell the user plainly to re-run without sudo.
    if (process.env.SUDO_USER) {
      this.logger.warn(
        'Detected a `sudo` launch. GUI steps below (opening System Settings panes, ' +
          'launching Parsec, approving Tailscale’s network extension) often do ' +
          'NOT appear from a sudo session, so remote access may not fully configure. ' +
          'For best results re-run WITHOUT sudo:  wundr computer-setup'
      );
    }

    // Make sure the standard Homebrew bins are on PATH before any brew /
    // tailscale call — when brew pre-exists, the bootstrap installer never
    // exported them into this process.
    this.ensureBrewOnPath();

    // Prime sudo ONCE up front. The Tailscale and Parsec casks are pkg-based
    // (brew shells out to `installer -pkg -target /` as root), and the host
    // settings below need sudo too — caching it here means a single visible
    // prompt covers every privileged step and brew won't prompt again
    // mid-install. No-op when headless / non-interactive.
    await this.primeSudo();

    await this.ensureTailscale();
    await this.tailscaleUp(cfg, interactive);
    await this.ensureSshKey();

    if (mode === 'host') {
      // A headless host must ACCEPT connections: enable the SSH server (Remote
      // Login) and native Screen Sharing / Remote Management, and stay awake.
      // sudo was already primed above, so these apply from that one prompt.
      await this.enableRemoteLogin();
      await this.configurePowerManagement(cfg);
      await this.enableScreenSharing();
    }

    await this.configureDesktopSharing(cfg, mode, interactive);

    if (mode === 'host') {
      await this.installAutoStartAgent(cfg, interactive);
      // Open the System Settings panes + the app so the user just flicks the
      // remaining switches, rather than reading a checklist. Falls back to the
      // text checklist when headless.
      await this.openManualSettings(cfg);
      // Read everything back and print a PASS/FAIL summary so it's never a
      // mystery which host settings actually landed.
      await this.reportRemoteAccessState(cfg);
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

  /**
   * Prompt for the sudo password ONCE, up front and visibly, so the privileged
   * host steps below all run from a single password entry (sudo caches it).
   * No-op when headless or when sudo is already known to be unavailable.
   */
  private async primeSudo(): Promise<void> {
    if (this.sudoUnavailable || !isInteractive()) return;
    this.logger.warn(
      'macOS password needed to install Parsec/Tailscale and enable Remote ' +
        'Login, Screen Sharing and power settings — type it at the prompt below ' +
        '(asked once for all of them), or wait to skip the privileged steps.'
    );
    // 60s is ample for a human at the keyboard but bounds the dead-air if no one
    // is present (the latch then cleanly skips the privileged steps).
    const result = await execa('sudo', ['-v'], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      timeout: 60_000,
      reject: false,
    });
    if (result.exitCode !== 0) {
      this.sudoUnavailable = true;
      this.logger.warn(
        `No sudo access granted (${
          result.timedOut ? 'no password entered in time' : 'prompt cancelled'
        }) — privileged steps (Parsec/Tailscale install, Remote Login, Screen ` +
          'Sharing, power) will be skipped. Re-run and enter your password to finish.'
      );
    }
  }

  /** Prepend the standard Homebrew bin dirs to PATH if missing (pure env, no exec). */
  private ensureBrewOnPath(): void {
    const segments = (process.env.PATH ?? '').split(path.delimiter);
    for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
      if (!segments.includes(dir)) {
        process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ''}`;
        segments.unshift(dir);
      }
    }
  }

  /**
   * Install a Homebrew cask, repairing the half-installed state where a
   * Caskroom receipt exists but the app bundle is gone. tailscale-app and
   * parsec are pkg-based casks: brew tracks only the receipt, not the .app, so
   * a plain `brew install --cask` is a no-op (exits 0 in ~0.5s) when the app
   * was removed. `reinstall --cask --force` re-runs the pkg installer and
   * re-lays the bundle. So: repair when already listed, fresh-install when not.
   * The default runProcess env keeps NONINTERACTIVE unset on interactive runs
   * so brew can prompt for the admin password these pkg casks require.
   */
  private async installOrRepairCask(
    token: string,
    interactive: boolean
  ): Promise<Awaited<ReturnType<typeof runProcess>>> {
    const listed =
      (
        await runProcess('brew', ['list', '--cask', token], {
          reject: false,
          timeout: 30_000,
        })
      ).exitCode === 0;
    const args = listed
      ? ['reinstall', '--cask', '--force', token]
      : ['install', '--cask', token];
    this.logger.info(
      `${listed ? 'Repairing' : 'Installing'} ${token} (\`brew ${args.join(
        ' '
      )}\`${interactive ? '; a macOS admin password prompt may appear' : ''})...`
    );
    return runProcess('brew', args, {
      timeout: interactive ? 10 * 60 * 1000 : 3 * 60 * 1000,
      reject: false,
      stdin: interactive ? 'inherit' : 'ignore',
    });
  }

  /** Read every host setting back and log a PASS/FAIL summary. Read-only. */
  private async reportRemoteAccessState(
    cfg: RemoteAccessConfig
  ): Promise<void> {
    const stack = cfg.stack ?? 'parsec';
    const appName = stack === 'rustdesk' ? 'RustDesk' : 'Parsec';
    const run = async (cmd: string, args: string[]): Promise<string> => {
      try {
        const r = await execa(cmd, args, { timeout: 15_000, reject: false });
        return `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
      } catch {
        return '';
      }
    };

    const pmset = await run('pmset', ['-g']);
    const has = (re: RegExp): boolean => re.test(pmset);
    // systemsetup needs root; read via cached sudo (-n), don't prompt here.
    const remoteLogin = await run('sudo', [
      '-n',
      'systemsetup',
      '-getremotelogin',
    ]);
    const tailscaleApp = await fs.pathExists('/Applications/Tailscale.app');
    const appInstalled = await fs.pathExists(`/Applications/${appName}.app`);
    const agent = await fs.pathExists(
      path.join(
        os.homedir(),
        'Library',
        'LaunchAgents',
        `com.adaptic.${stack}.plist`
      )
    );
    const m = (ok: boolean): string => (ok ? 'OK ' : 'NO ');

    this.logger.info(
      'Remote-access state (read back):\n' +
        `  ${m(/On/i.test(remoteLogin))} SSH Remote Login ${
          /remote login/i.test(remoteLogin)
            ? `(${remoteLogin.trim().split('\n')[0]})`
            : '(could not read without sudo)'
        }\n` +
        `  ${m(tailscaleApp)} Tailscale installed\n` +
        `  ${m(appInstalled)} ${appName} installed\n` +
        `  ${m(has(/womp\s+1/))} Wake-on-LAN (womp)\n` +
        `  ${m(has(/autorestart\s+1/))} Restart after power failure\n` +
        `  ${m(has(/hibernatemode\s+0/))} Hibernation off\n` +
        `  ${m(has(/\n\s*sleep\s+0/))} System sleep off\n` +
        `  ${m(agent)} ${appName} auto-start LaunchAgent`
    );
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
    // Don't write/log an auto-start agent for an app that didn't install — that
    // produced a misleading "Installed auto-start LaunchAgent" line for an
    // absent Parsec and added to the false-success confusion.
    if (!(await fs.pathExists(`/Applications/${appName}.app`))) {
      this.logger.warn(
        `Skipping ${appName} auto-start agent — ${appName} is not installed.`
      );
      return;
    }
    const label = `com.adaptic.${stack}`;
    const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(agentsDir, `${label}.plist`);
    // RunAtLoad launches the app once at login (after auto-login). Do NOT set
    // KeepAlive: ProgramArguments is `open -a <App>`, and `open` exits the
    // instant it has launched the app — with KeepAlive launchd would treat that
    // immediate exit as a crash and relaunch `open` in a tight loop, which is
    // why the app "keeps opening". RunAtLoad alone launches it exactly once.
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-a</string><string>${appName}</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;
    try {
      await fs.ensureDir(agentsDir);
      await fs.writeFile(plistPath, plist);
      // Reload idempotently: unload any previously-loaded version first (this
      // also tears down an older KeepAlive-looping agent from a prior setup),
      // then load the fresh definition. Only meaningful with a GUI session.
      if (interactive) {
        await execa('launchctl', ['unload', plistPath], {
          reject: false,
          timeout: 15_000,
        });
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
   * For the settings macOS won't let a script toggle, OPEN the relevant System
   * Settings panes (and the streaming app) so the user just flicks the switches,
   * then print the checklist. Headless: just print the checklist.
   */
  private async openManualSettings(cfg: RemoteAccessConfig): Promise<void> {
    const stack = cfg.stack ?? 'parsec';
    const appName = stack === 'rustdesk' ? 'RustDesk' : 'Parsec';

    if (!isInteractive()) {
      this.logManualSteps(cfg);
      return;
    }

    this.logger.info(
      `Opening the System Settings panes (and ${appName}) for the switches ` +
        'macOS requires a human to flip...'
    );

    // Bring System Settings to the foreground FIRST — a bare
    // `open x-apple.systempreferences:` deep-link navigates the pane but does
    // not reliably raise the window, so the panes were opening behind the
    // terminal and the user never saw them.
    await execa('open', ['-a', 'System Settings'], {
      reject: false,
      timeout: 10_000,
    });
    await new Promise(resolve => setTimeout(resolve, 700));

    // Deep-links to the exact panes, using the modern `*.extension` anchors that
    // resolve on macOS 13–15 (the legacy `com.apple.preference.security?...`
    // anchors are fragile on Sequoia). System Settings is single-window, so open
    // them with a short stagger; the user can also use the Privacy sidebar.
    const panes: Array<[string, string]> = [
      [
        'Screen Recording',
        'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture',
      ],
      [
        'Accessibility',
        'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility',
      ],
      [
        'Full Disk Access',
        'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles',
      ],
      [
        'Login Items / Automatic Login (Users & Groups)',
        'x-apple.systempreferences:com.apple.LoginItems-Settings.extension',
      ],
    ];
    for (const [label, url] of panes) {
      try {
        await execa('open', [url], { reject: false, timeout: 10_000 });
        // Honest wording: we requested the pane; whether it renders depends on
        // the macOS version. Don't overstate that a pane definitely appeared.
        this.logger.info(
          `  Requested System Settings pane: ${label} (flip the switch if it appears)`
        );
        // Brief stagger so the single Settings window settles on each pane.
        await new Promise(resolve => setTimeout(resolve, 1200));
      } catch {
        // best-effort
      }
    }

    // Pull the Settings window forward in case the deep-links left it behind.
    await execa(
      'osascript',
      ['-e', 'tell application "System Settings" to activate'],
      {
        reject: false,
        timeout: 5_000,
      }
    );

    // Open the streaming app so the user can do first-run sign-in + Host setup.
    try {
      await execa('open', ['-a', appName], { reject: false, timeout: 10_000 });
      this.logger.info(`  Opened: ${appName} (sign in + enable Host access)`);
    } catch {
      // app may not be installed yet
    }

    this.logManualSteps(cfg);
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
    // The cask installs Tailscale.app but does NOT put a `tailscale` CLI on
    // PATH, so `which tailscale` would wrongly report "not installed". Check the
    // app bundle (or a CLI that happens to be on PATH).
    const tailscaleInstalled = async (): Promise<boolean> =>
      (await fs.pathExists('/Applications/Tailscale.app')) ||
      which('tailscale')
        .then(() => true)
        .catch(() => false);

    if (await tailscaleInstalled()) {
      this.logger.info('Tailscale already installed');
      return;
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
    try {
      // Canonical cask is `tailscale-app` (GUI app + network extension + the
      // `tailscale` CLI wrapper); the bare `tailscale` is a CLI-only formula.
      // It's a pkg cask, so a stale receipt with a missing app needs a forced
      // reinstall — installOrRepairCask handles install-vs-repair.
      const result = await this.installOrRepairCask(
        'tailscale-app',
        interactive
      );
      // Verify it actually landed — don't claim success on a swallowed failure.
      if (!(await tailscaleInstalled())) {
        const why = result.timedOut
          ? 'it timed out (the cask needs admin rights for its network extension)'
          : `brew exited ${result.exitCode}: ${String(result.stderr || '')
              .split('\n')
              .filter(Boolean)
              .slice(-2)
              .join(' ')
              .trim()}`;
        this.logger.warn(
          `Tailscale did NOT install (${why}). Repair it manually with ` +
            '`brew reinstall --cask --force tailscale-app`. If you launched setup with sudo, the ' +
            "network-extension approval can't surface — re-run `wundr computer-setup` WITHOUT sudo."
        );
        return;
      }
      this.logger.info('Tailscale installed.');
      // Launch the app once so tailscaled / the network extension start and the
      // macOS "allow network extension" approval prompt fires. This only works
      // from the user's GUI session (i.e. NOT under sudo).
      if (interactive) {
        await execa('open', ['-a', 'Tailscale'], {
          reject: false,
          timeout: 15_000,
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
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
    // Resolve the CLI. The cask installs a `tailscale` shim on PATH, but right
    // after a fresh install it may not be on this process's PATH yet — fall
    // back to the wrapper binary inside the app bundle.
    let tailscaleBin = 'tailscale';
    try {
      await which('tailscale');
    } catch {
      const wrapper = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
      if (await fs.pathExists(wrapper)) {
        tailscaleBin = wrapper;
      } else {
        this.logger.warn(
          'Tailscale CLI not found (the app may still be installing) — skipping `tailscale up`.'
        );
        return;
      }
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

    try {
      if (!authKey) {
        // Interactive, no auth key: open the browser login + the app, then run
        // `tailscale up` (args have no --authkey) so the user authenticates in
        // the browser to finish joining the tailnet.
        this.logger.info(
          'Joining the tailnet — complete sign-in in the browser if prompted...'
        );
        await execa('open', ['https://login.tailscale.com/start'], {
          reject: false,
          timeout: 10_000,
        });
        await execa('open', ['-a', 'Tailscale'], {
          reject: false,
          timeout: 10_000,
        });
      }
      await runProcess(tailscaleBin, args, {
        timeout: 120_000,
        reject: false,
        stdin: interactive ? 'inherit' : 'ignore',
      });
      this.logger.info('Ran `tailscale up`.');
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

    const stack = cfg.stack ?? 'parsec';
    const appName = stack === 'rustdesk' ? 'RustDesk' : 'Parsec';
    const appPath = `/Applications/${appName}.app`;

    // The brew cask install itself needs no TTY, so do it regardless of
    // interactivity — only the TCC (Screen Recording + Accessibility) grant
    // below is interactive-only. Previously the whole step was skipped when
    // headless, which is why a non-TTY run never installed Parsec.
    if (await fs.pathExists(appPath)) {
      this.logger.info(`${appName} already installed.`);
    } else {
      // parsec/rustdesk are pkg casks too — a stale Caskroom receipt with a
      // missing .app makes a plain `brew install` a no-op, so repair-or-install.
      const result = await this.installOrRepairCask(stack, interactive);
      // Verify the app actually landed — brew can exit non-zero (or get killed
      // by the timeout) and we must NOT claim success when it didn't install.
      if (!(await fs.pathExists(appPath))) {
        const why = result.timedOut
          ? 'it timed out waiting for an admin password'
          : `brew exited ${result.exitCode}: ${String(result.stderr || '')
              .split('\n')
              .filter(Boolean)
              .slice(-2)
              .join(' ')
              .trim()}`;
        this.logger.warn(
          `${appName} did NOT install (${why}). Repair it manually with ` +
            `\`brew reinstall --cask --force ${stack}\`. If you launched setup ` +
            `with sudo, the GUI installer can't surface — re-run ` +
            `\`wundr computer-setup\` WITHOUT sudo.`
        );
        return;
      }
      this.logger.info(`Installed ${appName}.`);
    }

    if (interactive) {
      this.logger.info(
        `Grant ${appName} Screen Recording + Accessibility in System Settings > ` +
          'Privacy & Security for unattended remote control.'
      );
    } else {
      this.logger.warn(
        `${appName} is installed, but it still needs a Screen Recording + ` +
          'Accessibility (TCC) grant that macOS cannot script headlessly — grant ' +
          'it in System Settings > Privacy & Security, or push an MDM PPPC profile.'
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

    // Interactive: prompt for the password ONCE (sudo caches it for the rest of
    // the run) so the switches actually get flipped. Headless: `sudo -n` (no
    // prompt) and log+skip if no cached/passwordless sudo — never block.
    const interactive = isInteractive();
    const sudoArgs = interactive
      ? [command, ...args]
      : ['-n', command, ...args];
    const result = await execa('sudo', sudoArgs, {
      stdin: interactive ? 'inherit' : 'ignore',
      timeout: interactive ? 120_000 : 30_000,
      reject: false,
    });

    if (result.exitCode !== 0) {
      this.sudoUnavailable = true;
      this.logger.warn(
        interactive
          ? `Skipping ${context}: sudo was cancelled or failed. ` +
              `Run \`sudo ${command} ${args.join(' ')}\` yourself to finish.`
          : `Skipping ${context}: passwordless sudo is unavailable. ` +
              `Run \`sudo ${command} ${args.join(' ')}\` (and the related commands) manually, or provision with cached sudo.`
      );
    }
  }
}
