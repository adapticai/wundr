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
import inquirer from 'inquirer';
import which from 'which';

import { isInteractive, runProcess } from '../lib/headless';
import { resolveInvokingUser } from '../lib/privileges';
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
  /** Per-run capability flag (NOT a failure latch): set once by ensurePasswordlessSudo. */
  private passwordlessSudo = false;

  /** The classic kcpassword XOR cipher key loginwindow uses to decode /etc/kcpassword. */
  private static readonly KCPASSWORD_KEY = [
    0x7d, 0x89, 0x52, 0x23, 0xd2, 0xbc, 0xde, 0xa3, 0xd2, 0xcb, 0x90,
  ] as const;

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
        // After Homebrew (casks), the GUI app phase (so the apps it docks/auto-
        // starts exist), and the passwordless-sudo keystone (so its sudo calls
        // run unattended). Missing dep ids are skipped by the topo sort.
        dependencies: [
          'install-homebrew',
          'install-applications',
          'configure-passwordless-sudo',
        ],
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

    // Establish passwordless sudo up front (the keystone configure-passwordless-
    // sudo step normally already wrote the NOPASSWD drop-in, so this is a silent
    // `sudo -n` probe). pkg casks (Tailscale/Parsec) + every host setting below
    // then run unattended via `sudo -n` — no per-command prompt, no latch.
    await this.ensurePasswordlessSudo();

    await this.ensureTailscale();
    await this.tailscaleUp(cfg, interactive);
    await this.ensureSshKey();

    if (mode === 'host') {
      // A headless host must ACCEPT connections: enable the SSH server (Remote
      // Login) and native Screen Sharing / Remote Management, stay awake, and
      // auto-login after a reboot so a GUI session exists for Parsec/ARD.
      await this.enableRemoteLogin();
      await this.configurePowerManagement(cfg);
      await this.enableScreenSharing();
      await this.configureAutoLogin(cfg);
    }

    await this.configureDesktopSharing(cfg, mode, interactive);

    if (mode === 'host') {
      // Auto-start LaunchAgents (Tailscale/Parsec/Slack) are owned by
      // the mac-installer configure-auto-start step, which runs after this.
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
   * Ensure passwordless sudo is active so every privileged host step below runs
   * unattended via `sudo -n` with no prompt. The standard path is the
   * /etc/sudoers.d/wundr-<user> NOPASSWD drop-in written by the keystone
   * configure-passwordless-sudo step — when present this probe succeeds silently
   * and the whole run is hands-off. Fallbacks: headless+no-sudo → skip (never
   * block); interactive+no-sudo → ONE visible `sudo -v` to seed a timestamp.
   * Unlike the old primeSudo, a miss here does NOT latch anything off — each
   * privileged call still probes `sudo -n` independently.
   */
  private async ensurePasswordlessSudo(): Promise<void> {
    // Non-interactive probe: never reads stdin, so it can't be poisoned by a
    // prior stdin:'inherit' child and can't hang.
    const probe = await execa('sudo', ['-n', 'true'], {
      stdin: 'ignore',
      timeout: 5_000,
      reject: false,
    });
    if (probe.exitCode === 0) {
      this.passwordlessSudo = true;
      this.logger.info(
        'Passwordless sudo is active — privileged host steps run unattended via `sudo -n`.'
      );
      return;
    }
    if (!isInteractive()) {
      this.logger.warn(
        'Passwordless sudo is NOT configured and no console is attached — Remote ' +
          'Login, Screen Sharing, power and auto-login will be skipped. Provision ' +
          '/etc/sudoers.d/wundr-<user> (NOPASSWD) for unattended setup.'
      );
      return;
    }
    // Interactive last resort: one visible prompt seeds a sudo timestamp the
    // `sudo -n` calls below reuse. This is the ONLY stdin:'inherit' sudo.
    this.logger.warn(
      'macOS password needed once to enable Remote Login, Screen Sharing, power ' +
        'and auto-login (asked a single time); or configure passwordless sudo to ' +
        'skip this entirely.'
    );
    const seed = await execa('sudo', ['-v'], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      timeout: 60_000,
      reject: false,
    });
    if (seed.exitCode === 0) {
      this.passwordlessSudo = true;
    } else {
      this.logger.warn(
        `No sudo access granted (${
          seed.timedOut ? 'no password entered in time' : 'prompt cancelled'
        }) — privileged host steps will be skipped.`
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
    // pkg casks (tailscale-app, parsec) shell out to `sudo /usr/sbin/installer`.
    // With passwordless sudo configured, that runs unattended — keep stdin
    // detached so it can't be poisoned and never prompts. Only fall back to
    // inheriting the TTY when we have NO passwordless sudo (so brew can prompt).
    const unattended = this.passwordlessSudo;
    this.logger.info(
      `${listed ? 'Repairing' : 'Installing'} ${token} (\`brew ${args.join(
        ' '
      )}\`${unattended ? '' : '; a macOS admin password prompt may appear'})...`
    );
    return runProcess('brew', args, {
      timeout: interactive ? 10 * 60 * 1000 : 3 * 60 * 1000,
      reject: false,
      stdin: unattended ? 'ignore' : interactive ? 'inherit' : 'ignore',
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

    // Auto-start agents are owned by mac-installer (com.adaptic.autostart.<slug>).
    const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const autostart = async (slug: string): Promise<boolean> =>
      fs.pathExists(
        path.join(agentsDir, `com.adaptic.autostart.${slug}.plist`)
      );
    const tsAgent = await autostart('tailscale');
    const parsecAgent = await autostart(stack);
    const slackAgent = await autostart('slack');

    // Passwordless sudo + auto-login + screensaver (read-only).
    const sudoers = await fs.pathExists(
      `/etc/sudoers.d/wundr-${os.userInfo().username}`
    );
    const autoLoginUser = await run('sudo', [
      '-n',
      'defaults',
      'read',
      '/Library/Preferences/com.apple.loginwindow',
      'autoLoginUser',
    ]);
    const kcpassword = await run('sudo', [
      '-n',
      'stat',
      '-f',
      '%Sp',
      '/etc/kcpassword',
    ]);
    const saverIdle = await run('defaults', [
      '-currentHost',
      'read',
      'com.apple.screensaver',
      'idleTime',
    ]);
    const filevault = await run('fdesetup', ['status']);
    const tsStatus = await run('tailscale', ['status']);
    const m = (ok: boolean): string => (ok ? 'OK ' : 'NO ');

    this.logger.info(
      'Remote-access state (read back):\n' +
        `  ${m(this.passwordlessSudo || sudoers)} Passwordless sudo (sudoers drop-in${sudoers ? ' present' : ' absent'})\n` +
        `  ${m(/On/i.test(remoteLogin))} SSH Remote Login ${
          /remote login/i.test(remoteLogin)
            ? `(${remoteLogin.trim().split('\n')[0]})`
            : '(could not read without sudo)'
        }\n` +
        `  ${m(tailscaleApp)} Tailscale installed\n` +
        `  ${m(/\b100\.\d+\.\d+\.\d+\b/.test(tsStatus))} Tailscale joined (100.x address)\n` +
        `  ${m(appInstalled)} ${appName} installed\n` +
        `  ${m(/autoLoginUser/i.test(autoLoginUser) || autoLoginUser.trim().length > 0)} Auto-login user set${
          autoLoginUser.trim()
            ? ` (${autoLoginUser.trim().split('\n')[0]})`
            : ''
        }\n` +
        `  ${m(/^-rw-------/m.test(kcpassword))} /etc/kcpassword present (root:wheel 0600)\n` +
        `  ${m(has(/womp\s+1/))} Wake-on-LAN (womp)\n` +
        `  ${m(has(/autorestart\s+1/))} Restart after power failure\n` +
        `  ${m(has(/hibernatemode\s+0/))} Hibernation off\n` +
        `  ${m(has(/\n\s*sleep\s+0/))} System sleep off\n` +
        `  ${m(has(/displaysleep\s+0/))} Display never sleeps\n` +
        `  ${m(/^0\s*$/m.test(saverIdle))} Screensaver disabled (idleTime 0)\n` +
        `  ${m(has(/powermode\s+2/))} High Power mode (Apple-Silicon Pro/Max/Ultra only)\n` +
        `  ${m(tsAgent)} Tailscale auto-start LaunchAgent\n` +
        `  ${m(parsecAgent)} ${appName} auto-start LaunchAgent\n` +
        `  ${m(slackAgent)} Slack auto-start LaunchAgent\n` +
        `  ${/FileVault is On/i.test(filevault) ? '!! ' : 'OK '} FileVault ${
          /FileVault is On/i.test(filevault)
            ? 'ON (blocks auto-login — disable for unattended reboot)'
            : 'off'
        }`
    );
  }

  /** Enable the SSH server (Remote Login) so a headless host accepts SSH in. */
  private async enableRemoteLogin(): Promise<void> {
    // launchctl-first: bring sshd up directly. This path does NOT need Full Disk
    // Access for the calling terminal (which `systemsetup -setremotelogin` does,
    // and which a non-FDA terminal fails on — the "sudo was cancelled or failed"
    // symptom). 'already bootstrapped' (exit 37) is success.
    await this.sudoNonInteractive(
      'launchctl',
      ['enable', 'system/com.openssh.sshd'],
      'SSH Remote Login (enable sshd)'
    );
    await this.sudoNonInteractive(
      'launchctl',
      ['bootstrap', 'system', '/System/Library/LaunchDaemons/ssh.plist'],
      'SSH Remote Login (bootstrap sshd)'
    );
    // Canonical toggle too (flips the Sharing pref + handles older macOS). If the
    // terminal lacks Full Disk Access this one warns; the launchctl path above
    // already brought sshd up, so SSH still works.
    await this.sudoNonInteractive(
      'systemsetup',
      ['-setremotelogin', 'on'],
      'SSH Remote Login (systemsetup; needs Full Disk Access on the terminal — grant via MDM PPPC if it fails)'
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
    // Modern bootstrap (replaces the deprecated `launchctl load -w`). 'already
    // bootstrapped' (exit 37) is success.
    await this.sudoNonInteractive(
      'launchctl',
      [
        'bootstrap',
        'system',
        '/System/Library/LaunchDaemons/com.apple.screensharing.plist',
      ],
      'Screen Sharing (bootstrap daemon)'
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
          '-allowAccessFor',
          '-allUsers',
        ],
        'Remote Management / ARD (System Settings > General > Sharing > Remote Management)'
      );
    }
  }

  /**
   * Obfuscate a cleartext password into /etc/kcpassword bytes. Must match
   * loginwindow exactly: (1) XOR each plaintext byte with KEY[i % 11]; (2) if the
   * plaintext length is an exact multiple of 11, append one extra full key cycle;
   * (3) pad with key bytes (continuing the cycle) to a multiple of 12.
   */
  private encodeKcpassword(password: string): Buffer {
    const key = RemoteAccessInstaller.KCPASSWORD_KEY;
    const plain = Buffer.from(password, 'utf8');
    const out: number[] = [];
    for (let i = 0; i < plain.length; i++) {
      out.push(plain[i] ^ key[i % key.length]);
    }
    if (plain.length % key.length === 0) {
      for (let i = 0; i < key.length; i++) out.push(key[i]);
    }
    while (out.length % 12 !== 0) {
      out.push(key[out.length % key.length]);
    }
    return Buffer.from(out);
  }

  /** True when FileVault is enabled (it overrides/blocks kcpassword auto-login). */
  private async filevaultEnabled(): Promise<boolean> {
    const r = await execa('fdesetup', ['status'], {
      timeout: 10_000,
      reject: false,
    });
    return /FileVault is On/i.test(r.stdout ?? '');
  }

  /** Resolve the auto-login password: config -> env -> interactive hidden prompt. */
  private async resolveAutoLoginPassword(
    cfg: RemoteAccessConfig
  ): Promise<string | null> {
    const fromCfgOrEnv =
      cfg.autoLoginPassword || process.env.WUNDR_AUTOLOGIN_PASSWORD;
    if (fromCfgOrEnv) return fromCfgOrEnv;
    if (!isInteractive()) {
      this.logger.warn(
        'Auto-login skipped: no password supplied. Set WUNDR_AUTOLOGIN_PASSWORD ' +
          '(or profile.remoteAccess.autoLoginPassword) for unattended provisioning.'
      );
      return null;
    }
    const { pw } = await inquirer.prompt<{ pw: string }>([
      {
        type: 'password',
        name: 'pw',
        mask: '',
        message:
          'macOS account password for auto-login (writes /etc/kcpassword; not stored, not echoed):',
      },
    ]);
    return pw ? pw : null;
  }

  /**
   * Configure macOS auto-login so a GUI session exists after an unattended
   * reboot (required for Parsec/Screen Sharing + the per-user LaunchAgents to
   * come up). Writes autoLoginUser + /etc/kcpassword (XOR-obfuscated, root:wheel
   * 0600). Host mode only, after the sudoers facet so the privileged writes go
   * through `sudo -n`. No-op + warn when FileVault is on, sudo is unavailable, or
   * no password is supplied. Never blocks; never puts the secret in argv.
   */
  private async configureAutoLogin(cfg: RemoteAccessConfig): Promise<void> {
    if (cfg.autoLogin === false) {
      this.logger.info('Auto-login disabled in config — skipping.');
      return;
    }
    if (!this.passwordlessSudo) {
      this.logger.warn(
        'Auto-login skipped: passwordless sudo unavailable (configure ' +
          '/etc/sudoers.d/wundr-<user> first, then re-run).'
      );
      return;
    }
    if (await this.filevaultEnabled()) {
      this.logger.warn(
        'Auto-login skipped: FileVault is ON. FileVault forces a pre-boot unlock ' +
          'that overrides kcpassword auto-login. Disable FileVault for unattended boot.'
      );
      return;
    }

    const user =
      cfg.autoLoginUser ||
      resolveInvokingUser()?.user ||
      os.userInfo().username;
    const password = await this.resolveAutoLoginPassword(cfg);
    if (!password) return;

    // 1) autoLoginUser plist key (username only — no secret in argv).
    await this.sudoNonInteractive(
      'defaults',
      [
        'write',
        '/Library/Preferences/com.apple.loginwindow',
        'autoLoginUser',
        user,
      ],
      `auto-login user (${user})`
    );

    // 2) /etc/kcpassword — move the obfuscated bytes via a 0600 base64 temp so
    //    the password NEVER appears in argv / the process table, then sudo-decode
    //    it into place as root:wheel 0600.
    const encoded = this.encodeKcpassword(password);
    const tmpDir = path.join(os.homedir(), '.wundr', 'remote-access');
    const tmpB64 = path.join(tmpDir, '.kcpassword.b64');
    try {
      await fs.ensureDir(tmpDir);
      await fs.writeFile(tmpB64, encoded.toString('base64'), { mode: 0o600 });
      await this.sudoNonInteractive(
        'bash',
        [
          '-c',
          `/usr/bin/base64 -d ${tmpB64} > /etc/kcpassword && ` +
            `/usr/sbin/chown root:wheel /etc/kcpassword && ` +
            `/bin/chmod 600 /etc/kcpassword`,
        ],
        '/etc/kcpassword (auto-login secret)'
      );
      this.logger.info(
        `Configured auto-login for ${user} (autoLoginUser + /etc/kcpassword, root:wheel 0600).`
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not configure auto-login: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      try {
        await fs.remove(tmpB64);
      } catch {
        /* best-effort */
      }
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
      // Launch the app (backgrounded, no focus steal) so tailscaled / the
      // network extension start before `tailscale up`, and the "allow network
      // extension" approval prompt fires in the GUI session. Give the daemon a
      // moment to come up.
      await execa('open', ['-ga', 'Tailscale'], {
        reject: false,
        timeout: 15_000,
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
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

    // argv array — NO eval, no shell interpolation of the auth key. `--ssh` makes
    // the host accept Tailscale SSH (a core remote-access path for the fleet).
    const args = [
      'up',
      `--hostname=${deviceName}`,
      '--ssh',
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
      if (authKey) {
        // Unattended join: bounded, never reads stdin (so it can't poison the
        // next sudo). `--timeout` makes tailscale itself give up cleanly.
        await runProcess(tailscaleBin, [...args, '--timeout=30s'], {
          timeout: 60_000,
          reject: false,
          stdin: 'ignore',
        });
        this.logger.info('Ran `tailscale up` (auth key).');
        return;
      }
      // Interactive, no auth key: open the browser login + the app, then run
      // `tailscale up` with a SHORT bounded wait so we do NOT block the run for
      // 2 minutes — the user finishes the browser sign-in out-of-band. stdin is
      // detached so the immediately-following sudo calls can't fail at EOF.
      this.logger.info(
        'Joining the tailnet — finish sign-in in the browser that just opened ' +
          '(setup continues; the host joins once you authenticate)...'
      );
      await execa('open', ['https://login.tailscale.com/start'], {
        reject: false,
        timeout: 10_000,
      });
      await execa('open', ['-a', 'Tailscale'], {
        reject: false,
        timeout: 10_000,
      });
      await runProcess(tailscaleBin, [...args, '--timeout=15s'], {
        timeout: 20_000,
        reject: false,
        stdin: 'ignore',
      });
      this.logger.info(
        'Ran `tailscale up` (complete browser sign-in to join).'
      );
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
    // Always-on agent host: default the display to NEVER blank (0). pmset
    // displaysleep governs the backlight; com.apple.screensaver idleTime (set by
    // mac-installer.configureMacOS) governs the saver — both 0 = genuinely
    // always-on for headless ARD/Parsec capture.
    const displaySleep = cfg.displaySleepMinutes ?? 0;

    await this.backupPowerSettings();

    // Reachability/recovery keys first (always), then the sleep-disables (only
    // when preventSleep), then High Power mode last (Apple-Silicon Pro/Max/Ultra
    // only — applyPmsetKey tolerates "unsupported" without failing the run).
    const keys: Array<[string, string]> = [
      ['womp', '1'], // wake-on-LAN / wake-on-network
      ['autorestart', '1'], // restart automatically after a power failure
      ['acwake', '1'], // wake when AC power changes
      ['tcpkeepalive', '1'], // keep TCP alive so SSH/Tailscale survive idle
    ];
    if (preventSleep) {
      keys.push(
        ['sleep', '0'],
        ['displaysleep', String(displaySleep)],
        ['disksleep', '0'],
        ['hibernatemode', '0'],
        ['autopoweroff', '0'],
        ['standby', '0'],
        ['powernap', '0']
      );
    }
    // High Power mode (sustained max performance) — best-effort, last.
    keys.push(['powermode', '2']);

    for (const [key, value] of keys) {
      await this.applyPmsetKey(key, value);
    }

    await this.configureSystemSetupPower(preventSleep);
  }

  /**
   * Apply a single `pmset -a <key> <value>` via `sudo -n`. Distinguishes a key
   * that is simply unsupported on this hardware (e.g. powermode on a non-Pro
   * Mac) — logged and skipped — from an applied key. Never latches the run.
   */
  private async applyPmsetKey(key: string, value: string): Promise<void> {
    if (!this.passwordlessSudo) return;
    const r = await execa('sudo', ['-n', 'pmset', '-a', key, value], {
      stdin: 'ignore',
      timeout: 20_000,
      reject: false,
    });
    if (r.exitCode !== 0) {
      const why = `${r.stderr || r.stdout || ''}`.trim();
      this.logger.warn(
        `pmset ${key} ${value} not applied (${
          why || `exit ${r.exitCode}`
        }) — likely unsupported on this hardware; continuing.`
      );
    }
  }

  /**
   * Belt-and-suspenders systemsetup layer for never-sleep + power resilience.
   * Complements pmset; both via the non-latching `sudo -n` path.
   */
  private async configureSystemSetupPower(
    preventSleep: boolean
  ): Promise<void> {
    if (preventSleep) {
      await this.sudoNonInteractive(
        'systemsetup',
        ['-setcomputersleep', 'Never'],
        'never sleep (systemsetup)'
      );
      await this.sudoNonInteractive(
        'systemsetup',
        ['-setdisplaysleep', 'Never'],
        'never display-sleep (systemsetup)'
      );
      await this.sudoNonInteractive(
        'systemsetup',
        ['-setharddisksleep', 'Never'],
        'never disk-sleep (systemsetup)'
      );
    }
    await this.sudoNonInteractive(
      'systemsetup',
      ['-setwakeonnetworkaccess', 'on'],
      'wake-on-network (systemsetup)'
    );
    await this.sudoNonInteractive(
      'systemsetup',
      ['-setrestartpowerfailure', 'on'],
      'restart-after-power-failure (systemsetup)'
    );
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
        'acwake',
        'tcpkeepalive',
        'sleep',
        'displaysleep',
        'disksleep',
        'hibernatemode',
        'autopoweroff',
        'standby',
        'powernap',
        'powermode',
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

  /**
   * Run a privileged command unattended via `sudo -n` — NEVER prompts, NEVER
   * reads stdin (so a prior stdin:'inherit' child can't make it fail at EOF),
   * and NEVER latches the rest of the run off. Each call probes sudo
   * independently; on a non-zero exit we log the exact manual command and skip
   * ONLY this step. Returns true on success so callers can branch.
   */
  private async sudoNonInteractive(
    command: string,
    args: string[],
    context: string
  ): Promise<boolean> {
    // Capability flag (set by ensurePasswordlessSudo), NOT a failure latch:
    // don't spawn doomed probes when we already know sudo isn't usable.
    if (!this.passwordlessSudo) {
      this.logger.warn(
        `Skipping ${context}: passwordless sudo unavailable. ` +
          `Run \`sudo ${command} ${args.join(' ')}\` manually, or provision ` +
          '/etc/sudoers.d/wundr-<user> (NOPASSWD) and re-run.'
      );
      return false;
    }

    const result = await execa('sudo', ['-n', command, ...args], {
      stdin: 'ignore', // never inherit — can't be poisoned, can't prompt
      timeout: 30_000,
      reject: false,
    });

    if (result.exitCode !== 0) {
      // Skip ONLY this command; the next sudoNonInteractive still runs.
      this.logger.warn(
        `Skipping ${context}: \`sudo -n ${command} ${args.join(' ')}\` exited ` +
          `${result.exitCode}${result.timedOut ? ' (timed out)' : ''}. ` +
          `Run \`sudo ${command} ${args.join(' ')}\` yourself to finish.`
      );
      return false;
    }
    return true;
  }
}
