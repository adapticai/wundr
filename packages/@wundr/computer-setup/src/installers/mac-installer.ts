/**
 * macOS Platform Installer - macOS-specific tools and configurations
 */
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import * as fs from 'fs-extra';
import which from 'which';

import {
  installXcodeCommandLineTools as ensureXcodeCommandLineTools,
  isInteractive,
  nonInteractiveEnv,
  runShellScript,
} from '../lib/headless';
import { isRoot } from '../lib/privileges';
import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

interface ExecaError extends Error {
  stderr?: string;
  timedOut?: boolean;
}

/**
 * The CURATED Dock: the work apps we pin for an always-on agent host, in order.
 * Only those whose .app is actually present are added (Tailscale/Parsec install
 * in the remote-access step, so the Dock step is ordered AFTER it). This is a
 * fixed list on purpose — NOT every installed app — so utilities like
 * Rectangle/Raycast/iTerm/The Unarchiver stay installed but undocked.
 */
const DOCK_APPS: ReadonlyArray<string> = [
  'Google Chrome',
  'Visual Studio Code',
  'Slack',
  'GitHub Desktop',
  'Docker',
  'Tailscale',
  'Parsec',
];

/**
 * Default Apple/consumer + utility apps to REMOVE from the Dock. Keeps Finder,
 * Safari, System Settings, Launchpad-replacement etc. clean. The four utilities
 * (Rectangle/Raycast/iTerm/The Unarchiver) are removed from the Dock but remain
 * installed (user decision).
 */
const DOCK_REMOVE: ReadonlyArray<string> = [
  // Apple consumer apps
  'Maps',
  'Contacts',
  'Reminders',
  'TV',
  'Music',
  'Podcasts',
  'News',
  'Books',
  'Stocks',
  'Freeform',
  'FaceTime',
  'Mail',
  'Messages',
  'Phone',
  'Keynote',
  'Pages',
  'Numbers',
  'Calendar',
  'Launchpad',
  // Installed utilities — keep installed, undock
  'Rectangle',
  'Raycast',
  'iTerm',
  'The Unarchiver',
  // No longer installed — undock it if an earlier run pinned it.
  'WhatsApp',
];

/**
 * Apps that should auto-start at login on an always-on agent host. A per-app
 * LaunchAgent (RunAtLoad, no KeepAlive) is written for each whose .app exists.
 */
const AUTO_START_APPS: ReadonlyArray<string> = ['Tailscale', 'Parsec', 'Slack'];

export class MacInstaller implements BaseInstaller {
  name = 'mac-platform';
  private readonly logger = new Logger({ name: 'MacInstaller' });

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin';
  }

  async isInstalled(): Promise<boolean> {
    // Check if essential macOS dev tools are installed
    try {
      await which('brew');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('sw_vers', ['-productVersion']);
      return `macOS ${stdout.trim()}`;
    } catch {
      return null;
    }
  }

  async install(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    // Install Xcode Command Line Tools
    await this.installXcodeCommandLineTools();

    // Install Homebrew
    await this.installHomebrew();

    // Install essential development packages
    await this.installEssentialPackages(profile);

    // Install applications
    await this.installApplications(profile);

    // Configure macOS settings
    await this.configureMacOS(profile);
  }

  async configure(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    await this.configureMacOS(profile);
    await this.configureShell(profile);
    await this.setupDotfiles(profile);
  }

  async validate(): Promise<boolean> {
    try {
      await which('brew');
      await execa('xcode-select', ['-p']);
      return true;
    } catch {
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, _platform: SetupPlatform): SetupStep[] {
    const steps: SetupStep[] = [
      {
        // KEYSTONE: must run first so Homebrew + every later privileged step run
        // unattended via `sudo -n`. required:false — never aborts core setup.
        id: 'configure-passwordless-sudo',
        name: 'Configure Passwordless Sudo',
        description:
          'Grant the setup user NOPASSWD sudo (visudo-validated /etc/sudoers.d drop-in) so every later step runs unattended',
        category: 'system',
        required: false,
        dependencies: [],
        estimatedTime: 15,
        validator: () => this.validatePasswordlessSudo(),
        installer: () => this.configurePasswordlessSudo(),
      },
      {
        id: 'install-xcode-cli-tools',
        name: 'Install Xcode Command Line Tools',
        description: 'Install essential development tools and compilers',
        category: 'system',
        required: true,
        dependencies: ['configure-passwordless-sudo'],
        estimatedTime: 300,
        validator: () => this.validateXcodeCommandLineTools(),
        installer: () => this.installXcodeCommandLineTools(),
      },
      {
        id: 'install-homebrew',
        name: 'Install Homebrew',
        description: 'Install Homebrew package manager',
        category: 'system',
        required: true,
        dependencies: [
          'install-xcode-cli-tools',
          'configure-passwordless-sudo',
        ],
        estimatedTime: 120,
        validator: () => this.validateHomebrew(),
        installer: () => this.installHomebrew(),
      },
      {
        id: 'install-essential-packages',
        name: 'Install Essential Packages',
        description: 'Install essential development packages via Homebrew',
        category: 'development',
        required: true,
        dependencies: ['install-homebrew'],
        estimatedTime: 180,
        validator: () => this.validateEssentialPackages(),
        installer: () => this.installEssentialPackages(profile),
      },
      {
        id: 'install-applications',
        name: 'Install Applications',
        description: 'Install development applications and tools',
        category: 'development',
        required: false,
        dependencies: ['install-homebrew'],
        estimatedTime: 300,
        validator: () => this.validateApplications(profile),
        installer: () => this.installApplications(profile),
      },
      {
        id: 'configure-macos',
        name: 'Configure macOS Settings',
        description: 'Configure macOS for development workflow',
        category: 'configuration',
        required: false,
        dependencies: [],
        estimatedTime: 60,
        validator: () => this.validateMacOSConfig(),
        installer: () => this.configureMacOS(profile),
      },
      {
        id: 'configure-shell',
        name: 'Configure Shell',
        description: 'Set up and configure preferred shell',
        category: 'configuration',
        required: true,
        dependencies: ['install-essential-packages'],
        estimatedTime: 30,
        validator: () => this.validateShellConfig(profile),
        installer: () => this.configureShell(profile),
      },
      {
        // Owns ALL auto-start LaunchAgents (Tailscale/Parsec/Slack);
        // depends on the app installs + remote-access so every target exists.
        id: 'configure-auto-start',
        name: 'Configure Auto-Start Apps',
        description:
          'Auto-start Tailscale, Parsec and Slack at login (per-app LaunchAgents)',
        category: 'configuration',
        required: false,
        dependencies: ['install-applications', 'configure-remote-access'],
        estimatedTime: 15,
        installer: () => this.installAutoStartLoginItems(profile),
      },
      {
        // Ordered LAST: depends on configure-remote-access so Tailscale/Parsec
        // are installed before the Dock is built (missing dep ids are skipped).
        id: 'configure-dock',
        name: 'Configure Dock',
        description: 'Pin the curated work apps to the Dock and remove clutter',
        category: 'configuration',
        required: false,
        dependencies: [
          'install-essential-packages',
          'install-applications',
          'configure-remote-access',
          'configure-auto-start',
        ],
        estimatedTime: 20,
        installer: () => this.configureDock(profile),
      },
    ];

    return steps;
  }

  /**
   * Curate the macOS Dock with `dockutil`: pin a fixed curated set of work apps
   * (DOCK_APPS — only those actually present) and remove the Apple consumer
   * clutter + installed utilities (DOCK_REMOVE). This is a CURATED list, not
   * every installed app, so Rectangle/Raycast/iTerm/The Unarchiver stay
   * installed but undocked. Idempotent (each add is a remove-then-add; removing
   * an absent item is a no-op). Ordered LAST in the step graph (after
   * configure-remote-access) so Tailscale/Parsec exist when it runs. Per-user,
   * no sudo.
   */
  private async configureDock(_profile: DeveloperProfile): Promise<void> {
    // dockutil is installed in installEssentialPackages, but on a fresh machine
    // that step can race/fail — so SELF-HEAL by installing it here rather than
    // silently skipping the whole Dock (the "icons never got added" symptom).
    const hasDockutil = async (): Promise<boolean> => {
      try {
        await which('dockutil');
        return true;
      } catch {
        return false;
      }
    };
    if (!(await hasDockutil())) {
      this.logger.info(
        'dockutil missing — installing it so the Dock can be set...'
      );
      await execa('brew', ['install', 'dockutil'], {
        timeout: 3 * 60 * 1000,
        reject: false,
        stdin: 'ignore',
        env: nonInteractiveEnv(),
      });
    }
    if (!(await hasDockutil())) {
      this.logger.warn(
        'dockutil could not be installed — skipping Dock configuration. ' +
          'Install it with `brew install dockutil` and re-run.'
      );
      return;
    }

    const dockutil = async (args: string[]): Promise<number> => {
      const result = await execa('dockutil', args, {
        timeout: 30_000,
        reject: false,
        stdin: 'ignore',
      });
      return result.exitCode ?? 1;
    };

    // Remove clutter + undocked utilities (no-op if the item isn't there).
    for (const label of DOCK_REMOVE) {
      await dockutil(['--remove', label, '--no-restart']);
    }

    // Add the curated work apps idempotently (remove-then-add), preserving the
    // DOCK_APPS order, only when the .app is actually present.
    const docked: string[] = [];
    const missing: string[] = [];
    for (const appName of DOCK_APPS) {
      const appPath = `/Applications/${appName}.app`;
      if (!(await fs.pathExists(appPath))) {
        missing.push(appName);
        continue;
      }
      await dockutil(['--remove', appName, '--no-restart']);
      const code = await dockutil(['--add', appPath, '--no-restart']);
      if (code === 0) docked.push(appName);
      else missing.push(`${appName} (dockutil failed)`);
    }

    // Apply everything with a single Dock restart.
    await execa('killall', ['Dock'], { timeout: 10_000, reject: false });

    this.logger.info(
      `Dock configured: pinned ${docked.length} app(s) [${docked.join(', ')}], ` +
        `removed ${DOCK_REMOVE.length} default/utility item(s).`
    );
    if (missing.length) {
      this.logger.warn(
        `Dock: could not pin ${missing.join(', ')} (app not installed yet). ` +
          'Re-run after the app installs.'
      );
    }
  }

  /**
   * Write a per-app LaunchAgent (RunAtLoad, NO KeepAlive) for each app in
   * AUTO_START_APPS that is actually installed, so the always-on host auto-
   * starts Tailscale/Parsec/Slack at login (after auto-login). NO
   * KeepAlive: `open -a` exits immediately, so KeepAlive would relaunch it in a
   * tight loop. Idempotent unload+load. Per-user (~/Library/LaunchAgents), no
   * sudo. Also removes the legacy single-app `com.adaptic.<stack>.plist` agents.
   */
  private async installAutoStartLoginItems(
    _profile: DeveloperProfile
  ): Promise<void> {
    const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    await fs.ensureDir(agentsDir);

    // Tear down legacy looping/competing agents from older setups.
    for (const legacy of ['com.adaptic.parsec', 'com.adaptic.rustdesk']) {
      const p = path.join(agentsDir, `${legacy}.plist`);
      if (await fs.pathExists(p)) {
        await execa('launchctl', ['unload', p], {
          reject: false,
          timeout: 10_000,
        });
        try {
          await fs.remove(p);
        } catch {
          /* best-effort */
        }
      }
    }

    const uid = os.userInfo().uid;
    let installed = 0;
    let loaded = 0;
    for (const appName of AUTO_START_APPS) {
      if (!(await fs.pathExists(`/Applications/${appName}.app`))) continue;
      const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const label = `com.adaptic.autostart.${slug}`;
      const plistPath = path.join(agentsDir, `${label}.plist`);
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
        await fs.writeFile(plistPath, plist);
        // Load into the GUI domain so the app starts NOW *and* persists across
        // logins. `bootstrap gui/<uid>` is the modern, HEADLESS-safe loader — the
        // old `launchctl load -w` was gated on an interactive TTY, so a piped /
        // headless fleet run wrote the plist but NEVER activated it (apps only
        // appeared after a manual login). bootout first for idempotency. If no
        // GUI session exists yet (pure SSH, no console), bootstrap is a no-op and
        // RunAtLoad still fires at the next auto-login.
        const domain = `gui/${uid}`;
        await execa('launchctl', ['bootout', `${domain}/${label}`], {
          reject: false,
          timeout: 15_000,
        });
        const boot = await execa(
          'launchctl',
          ['bootstrap', domain, plistPath],
          {
            reject: false,
            timeout: 15_000,
          }
        );
        const loadedNow = boot.exitCode === 0;
        if (loadedNow) loaded++;
        installed++;
        this.logger.info(
          `  Auto-start ${appName}: agent written${
            loadedNow
              ? ' + loaded into the current session'
              : ' (will launch at next login)'
          }.`
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Could not install auto-start agent for ${appName}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    this.logger.info(
      `Auto-start configured: ${installed}/${AUTO_START_APPS.length} app LaunchAgent(s) written (${loaded} live now); all RunAtLoad after auto-login.`
    );
  }

  /**
   * Grant the setup user permanent passwordless sudo via a visudo-validated
   * /etc/sudoers.d drop-in. Keystone first step: with this in place, Homebrew,
   * pkg casks, systemsetup, pmset, launchctl, ARD and the agent itself all run
   * unattended via `sudo -n`. SECURITY: this is full root with no password for
   * the user/agent — intended ONLY for an isolated single-purpose agent box.
   * Always validates with `visudo -cf` before installing (a broken drop-in
   * disables sudo system-wide), installs atomically as root:wheel 0440, and
   * proves it took effect on a cold timestamp. Idempotent + never aborts setup.
   */
  private async configurePasswordlessSudo(): Promise<void> {
    if (process.env.WUNDR_NO_PASSWORDLESS_SUDO) {
      this.logger.info(
        'Passwordless sudo opt-out (WUNDR_NO_PASSWORDLESS_SUDO) — skipping.'
      );
      return;
    }
    const user = this.getInvokingUser();
    if (!user) {
      this.logger.warn(
        'Could not resolve a non-root target user for passwordless sudo — ' +
          'skipping. (Run as a normal admin user.)'
      );
      return;
    }
    if (await this.hasPersistentNopasswd()) {
      this.logger.info(
        `Passwordless sudo drop-in already present for ${user} — no changes needed.`
      );
      return;
    }
    if (!(await this.primeSudoOnce(user))) return;

    const dropInPath = `/etc/sudoers.d/wundr-${user}`;
    const line = `${user} ALL=(ALL) NOPASSWD: ALL\n`;
    const tmpPath = path.join(
      os.tmpdir(),
      `wundr-sudoers-${process.pid}-${crypto.randomBytes(6).toString('hex')}`
    );
    try {
      await fs.writeFile(tmpPath, line, { mode: 0o600 });
      // Validate BEFORE it can influence sudo — an unvalidated write can lock
      // the box out of sudo entirely.
      const check = await execa('sudo', ['-n', 'visudo', '-cf', tmpPath], {
        reject: false,
        timeout: 15_000,
      });
      if (check.exitCode !== 0) {
        this.logger.warn(
          `Refusing to install passwordless-sudo drop-in: visudo validation ` +
            `failed (${(check.stderr || check.stdout || '').trim()}).`
        );
        return;
      }
      // Atomic install with the exact mode+owner sudoers requires (it ignores
      // the whole dir if any file is group/world-writable or mis-owned).
      const placed = await execa(
        'sudo',
        [
          '-n',
          '/usr/bin/install',
          '-m',
          '0440',
          '-o',
          'root',
          '-g',
          'wheel',
          tmpPath,
          dropInPath,
        ],
        { reject: false, timeout: 15_000 }
      );
      if (placed.exitCode !== 0) {
        this.logger.warn(
          `Failed to install ${dropInPath} (${(placed.stderr || '').trim()}).`
        );
        return;
      }
      // Prove it on a COLD timestamp (sudo -k clears any cached grant first).
      await execa('sudo', ['-k'], { reject: false, timeout: 5_000 });
      const verified =
        (
          await execa('sudo', ['-n', 'true'], {
            reject: false,
            timeout: 5_000,
          })
        ).exitCode === 0;
      this.logger.info(
        verified
          ? `Passwordless sudo configured for ${user} (0440 root:wheel at ${dropInPath}) — later steps run unattended.`
          : `Wrote ${dropInPath} but passwordless sudo still inactive — check that /etc/sudoers has '@includedir /private/etc/sudoers.d'.`
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not configure passwordless sudo: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      try {
        await fs.remove(tmpPath);
      } catch {
        /* best-effort cleanup of the candidate file */
      }
    }
  }

  /** Validator: true only when the PERSISTENT NOPASSWD rule is in place. */
  private async validatePasswordlessSudo(): Promise<boolean> {
    return this.hasPersistentNopasswd();
  }

  /** The invoking (non-root) user — $SUDO_USER under sudo, else the login. */
  private getInvokingUser(): string | null {
    const candidate =
      (process.env.SUDO_USER && process.env.SUDO_USER !== 'root'
        ? process.env.SUDO_USER
        : undefined) ?? os.userInfo().username;
    if (!candidate || candidate === 'root') return null;
    return candidate;
  }

  /**
   * True when a PERSISTENT NOPASSWD sudoers rule exists for the user — NOT merely
   * a cached sudo timestamp.
   *
   * This is the crux of running under `sudo wundr`: the outer sudo leaves a live
   * credential timestamp, so a naive `sudo -n true` returns 0 even though no
   * NOPASSWD drop-in is installed. That fooled the keystone into reporting
   * "already active" and skipping the install — then the per-tty timestamp
   * expired/mismatched mid-run and every later `sudo -n` (Remote Login, Screen
   * Sharing, ARD kickstart, kcpassword) failed, so those settings silently never
   * applied. `sudo -n -l` lists the actual sudoers rules; the NOPASSWD line only
   * appears when the persistent drop-in is genuinely in place. With no rule AND
   * no timestamp it exits non-zero, which we also (correctly) treat as "not
   * configured" so the installer proceeds to write the drop-in.
   */
  private async hasPersistentNopasswd(): Promise<boolean> {
    const r = await execa('sudo', ['-n', '-l'], {
      reject: false,
      stdin: 'ignore',
      timeout: 5_000,
    });
    return (
      r.exitCode === 0 &&
      /NOPASSWD/i.test(`${r.stdout ?? ''}\n${r.stderr ?? ''}`)
    );
  }

  /** Obtain ONE elevation to write the drop-in (interactive prompt / cached). */
  private async primeSudoOnce(user: string): Promise<boolean> {
    if (isInteractive()) {
      this.logger.warn(
        `macOS password needed ONCE to grant ${user} passwordless sudo so the ` +
          'rest of setup (Homebrew, Tailscale/Parsec, Remote Login, power) runs ' +
          'unattended — type it at the prompt below.'
      );
      const r = await execa('sudo', ['-v'], {
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
        timeout: 60_000,
        reject: false,
      });
      if (r.exitCode === 0) return true;
      this.logger.warn(
        `No sudo granted (${
          r.timedOut ? 'no password in time' : 'cancelled'
        }) — passwordless sudo not configured; later privileged steps will be skipped.`
      );
      return false;
    }
    const r = await execa('sudo', ['-n', '-v'], {
      reject: false,
      stdin: 'ignore',
      timeout: 10_000,
    });
    if (r.exitCode === 0) return true;
    this.logger.warn(
      'Headless run with no cached/seeded sudo — cannot configure passwordless ' +
        'sudo. Seed the first sudo once (MDM / admin-run first invocation / baked ' +
        'image) and re-run; everything after will be unattended.'
    );
    return false;
  }

  private async installXcodeCommandLineTools(): Promise<void> {
    // Headless-safe install: softwareupdate-based, bounded timeout, GUI fallback
    // only when a real console is attached. See lib/headless.ts.
    await ensureXcodeCommandLineTools({ logger: this.logger });
  }

  private async installHomebrew(): Promise<void> {
    // Defense in depth: the CLI/manager drops root before we get here, but if
    // this installer is driven directly we must refuse rather than let
    // Homebrew's install.sh abort with the raw "Don't run this as root!".
    if (isRoot()) {
      throw new Error(
        'Homebrew cannot be installed as root. Re-run computer-setup as a ' +
          'normal admin user (without sudo).'
      );
    }

    try {
      await which('brew');
      this.logger.info('Homebrew already installed');
      return;
    } catch {
      // not installed yet
    }

    this.logger.info('Installing Homebrew...');
    // TTY-safe official form. `curl | bash` made install.sh's STDIN the curl
    // PIPE (not the terminal), so Homebrew saw `[ ! -t 0 ]`, declared itself
    // non-interactive, and aborted ("stdin is not a TTY ... Need sudo access").
    // Command substitution `$(curl ...)` instead feeds the script TEXT to bash,
    // leaving stdin = the inherited TTY (interactive) so Homebrew can prompt for
    // (or, with our passwordless sudoers, silently use) sudo. NONINTERACTIVE=1 +
    // CI=1 drop the "Press RETURN to continue" gate so a fleet run never blocks.
    await runShellScript(
      'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      {
        timeout: 15 * 60 * 1000,
        env: nonInteractiveEnv({ NONINTERACTIVE: '1', CI: '1' }),
      }
    );

    // Put brew on PATH for the remainder of this process so the very next
    // `brew install` resolves on a fresh Apple Silicon machine.
    const brewPrefix = (await fs.pathExists('/opt/homebrew/bin/brew'))
      ? '/opt/homebrew'
      : '/usr/local';
    const brewBin = `${brewPrefix}/bin`;
    // 1) Make brew resolvable in THIS process immediately (cheap, always works).
    if (!(process.env.PATH || '').split(path.delimiter).includes(brewBin)) {
      process.env.PATH = `${brewBin}:${brewPrefix}/sbin:${process.env.PATH || ''}`;
    }
    process.env.HOMEBREW_NO_ANALYTICS = '1';
    // 2) Authoritatively import the full brew environment (HOMEBREW_PREFIX,
    //    HOMEBREW_CELLAR, HOMEBREW_REPOSITORY, MANPATH, PATH) for the rest of the
    //    process so every later `brew install`/`brew list` resolves. `brew
    //    shellenv` prints `export KEY="value"` lines; parse and apply them.
    try {
      const { stdout } = await execa(`${brewBin}/brew`, ['shellenv'], {
        timeout: 30_000,
        env: nonInteractiveEnv(),
      });
      for (const line of stdout.split('\n')) {
        const m = line.match(/^export\s+([A-Z_]+)="(.*)"$/);
        if (!m) continue;
        const [, key, rawVal] = m;
        // shellenv emits PATH/MANPATH with literal $PATH suffixes — expand them.
        process.env[key] = rawVal.replace(
          /\$(\w+)/g,
          (_, name) => process.env[name] ?? ''
        );
      }
    } catch {
      // Fall back to the manual PATH above plus an explicit prefix.
      process.env.HOMEBREW_PREFIX = brewPrefix;
    }
    if (!process.env.HOMEBREW_PREFIX) process.env.HOMEBREW_PREFIX = brewPrefix;
  }

  private async installEssentialPackages(
    profile: DeveloperProfile
  ): Promise<void> {
    const essentialPackages = [
      'curl',
      'wget',
      'jq',
      'tree',
      'htop',
      'ncdu',
      'ripgrep',
      'fd',
      'bat',
      'eza',
      'fzf',
      'gh', // GitHub CLI
      'git-delta',
      'mas', // Mac App Store CLI
      'dockutil', // manage the Dock (add/remove items reliably)
      'gnupg', // gpg — required for commit signing (Configure GPG signing step)
    ];

    // Add shell-specific packages
    if (profile.preferences?.shell === 'zsh') {
      essentialPackages.push('zsh-autosuggestions', 'zsh-syntax-highlighting');
    } else if (profile.preferences?.shell === 'fish') {
      essentialPackages.push('fish');
    }

    // Install packages (idempotent + bounded so a stalled formula can't hang).
    for (const pkg of essentialPackages) {
      try {
        const existing = await execa('brew', ['list', '--formula', pkg], {
          timeout: 30_000,
          reject: false,
        });
        if (existing.exitCode === 0) {
          continue;
        }
        await execa('brew', ['install', pkg], {
          timeout: 5 * 60 * 1000,
          stdin: 'ignore',
          env: nonInteractiveEnv(),
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to install ${pkg}: ${errorMessage}`);
      }
    }
  }

  private async installApplications(profile: DeveloperProfile): Promise<void> {
    const applications = this.getApplicationsForProfile(profile);

    // Install cask applications. reject:false everywhere so we can VERIFY each
    // landed (brew can exit non-zero, time out, or no-op on a stale receipt while
    // the .app never appears) and retry with `reinstall --cask --force` — the old
    // loop swallowed failures as warnings and moved on, which is how fresh
    // machines ended up missing VS Code / Docker with no hard signal.
    const totalApps = applications.casks.length;
    const failedCasks: string[] = [];
    for (let i = 0; i < totalApps; i++) {
      const app = applications.casks[i];
      // Already present? (brew receipt exists)
      const listed =
        (
          await execa('brew', ['list', '--cask', app], {
            timeout: 20_000,
            reject: false,
          })
        ).exitCode === 0;
      if (listed) {
        this.logger.info(
          `${app} already installed, skipping (${i + 1}/${totalApps})`
        );
        continue;
      }

      this.logger.info(`Installing ${app} (${i + 1}/${totalApps})...`);
      const opts = {
        timeout: 12 * 60 * 1000, // Docker Desktop etc. are large downloads
        reject: false,
        stdin: 'ignore' as const,
        env: nonInteractiveEnv(),
      };
      let result = await execa('brew', ['install', '--cask', app], opts);
      // Verify via the receipt; if the install didn't take, repair-reinstall once
      // (fixes the stale-Caskroom-receipt no-op that leaves the .app missing).
      let ok =
        (
          await execa('brew', ['list', '--cask', app], {
            timeout: 20_000,
            reject: false,
          })
        ).exitCode === 0;
      if (!ok) {
        this.logger.warn(
          `${app} did not install cleanly (brew exited ${result.exitCode}${
            result.timedOut ? ', timed out' : ''
          }) — retrying with \`reinstall --cask --force\`...`
        );
        result = await execa(
          'brew',
          ['reinstall', '--cask', '--force', app],
          opts
        );
        ok =
          (
            await execa('brew', ['list', '--cask', app], {
              timeout: 20_000,
              reject: false,
            })
          ).exitCode === 0;
      }
      if (ok) {
        this.logger.info(`Installed ${app}`);
      } else {
        failedCasks.push(app);
        const tail = String(result.stderr || result.stdout || '')
          .split('\n')
          .filter(Boolean)
          .slice(-2)
          .join(' ')
          .trim();
        this.logger.warn(
          `FAILED to install ${app}${tail ? `: ${tail}` : ''}. Install it ` +
            `manually with \`brew install --cask ${app}\`.`
        );
      }
    }
    if (failedCasks.length) {
      this.logger.warn(
        `Applications step: ${failedCasks.length} cask(s) did NOT install — ${failedCasks.join(', ')}. ` +
          'Re-run computer-setup or install them manually.'
      );
    } else {
      this.logger.info(
        `Applications step: all ${totalApps} cask app(s) present.`
      );
    }

    // Install Mac App Store applications
    for (const app of applications.masApps) {
      try {
        await execa('mas', ['install', app.id]);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to install ${app.name}: ${errorMessage}`);
      }
    }
  }

  private getApplicationsForProfile(profile: DeveloperProfile): {
    casks: string[];
    masApps: Array<{ id: string; name: string }>;
  } {
    const casks: string[] = [];
    const masApps: Array<{ id: string; name: string }> = [];

    // Editor-specific applications
    const editor = profile.preferences?.editor || 'vscode';
    switch (editor) {
      case 'vscode':
        casks.push('visual-studio-code');
        break;
      case 'sublime':
        casks.push('sublime-text');
        break;
      case 'intellij':
        casks.push('intellij-idea-ce');
        break;
    }

    // Role-specific applications
    switch (profile.role) {
      case 'frontend':
      case 'fullstack':
        casks.push('firefox', 'google-chrome');
        break;
      case 'backend':
      case 'devops':
        casks.push('docker-desktop', 'postman', 'tableplus');
        break;
      case 'mobile':
        casks.push('android-studio', 'simulator');
        masApps.push({ id: '497799835', name: 'Xcode' });
        break;
      case 'ml':
        casks.push('anaconda', 'jupyter-notebook-viewer');
        break;
    }

    // Communication tools. Slack is installed unconditionally in the common
    // block below (it was previously gated behind a profile flag that defaults
    // to false, so it silently never installed); teams/discord/zoom stay opt-in.
    if (profile.tools?.communication?.teams) {
      casks.push('microsoft-teams');
    }
    if (profile.tools?.communication?.discord) {
      casks.push('discord');
    }
    if (profile.tools?.communication?.zoom) {
      casks.push('zoom');
    }

    // Common applications — installed on EVERY run, regardless of role/profile.
    casks.push(
      'slack', // team chat
      'github', // GitHub Desktop
      'google-chrome', // default browser for all roles
      'iterm2',
      'rectangle', // Window manager
      'raycast', // Spotlight replacement
      // Docker Desktop on EVERY profile (the per-role list only added it for
      // backend/devops, so fullstack never got it). Canonical cask is
      // `docker-desktop`; it's an App artifact (no sudo / pkg prompt).
      'docker-desktop',
      // Note-taking / markdown is covered by VS Code (installed above) and the
      // Claude/memory-bank docs system — no separate notes app installed.
      'the-unarchiver'
    );

    // De-duplicate — e.g. google-chrome is also added by the frontend/fullstack
    // role block, and a profile could list an app twice.
    return { casks: [...new Set(casks)], masApps };
  }

  private async configureMacOS(_profile: DeveloperProfile): Promise<void> {
    const commands = [
      // Show hidden files in Finder
      'defaults write com.apple.finder AppleShowAllFiles -bool true',

      // Show all filename extensions
      'defaults write NSGlobalDomain AppleShowAllExtensions -bool true',

      // Disable the warning when changing a file extension
      'defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false',

      // Show path bar in Finder
      'defaults write com.apple.finder ShowPathbar -bool true',

      // Show status bar in Finder
      'defaults write com.apple.finder ShowStatusBar -bool true',

      // Faster key repeat
      'defaults write NSGlobalDomain KeyRepeat -int 2',
      'defaults write NSGlobalDomain InitialKeyRepeat -int 15',

      // Disable automatic capitalization
      'defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false',

      // Disable smart quotes
      'defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false',

      // Disable smart dashes
      'defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false',

      // Enable tap to click
      'defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true',
      'defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1',

      // Three-finger drag
      'defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadThreeFingerDrag -bool true',
      'defaults write com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag -bool true',

      // --- Always-on host: never blank, never screensaver, never lock ---------
      // Per-currentHost screensaver idle timeout = 0 (never start). The modern
      // screensaver domain is per-host, so a plain `defaults write` (no
      // -currentHost) is IGNORED — must use -currentHost.
      'defaults -currentHost write com.apple.screensaver idleTime -int 0',
      // Also clear the legacy global-domain key in case an MDM/profile set it.
      'defaults write com.apple.screensaver idleTime -int 0',
      // Do NOT require a password after sleep/screensaver — combined with
      // auto-login this keeps the Aqua session unlocked for ARD/Parsec/SSH.
      'defaults write com.apple.screensaver askForPassword -int 0',
      'defaults write com.apple.screensaver askForPasswordDelay -int 0',

      // Hot corners: action 0 = no-op. NEVER use 5 (Start Screen Saver) or 13
      // (Lock Screen) on an always-on host; pin the modifier to 0 too.
      'defaults write com.apple.dock wvous-tl-corner -int 0',
      'defaults write com.apple.dock wvous-tl-modifier -int 0',
      'defaults write com.apple.dock wvous-tr-corner -int 0',
      'defaults write com.apple.dock wvous-tr-modifier -int 0',
      'defaults write com.apple.dock wvous-bl-corner -int 0',
      'defaults write com.apple.dock wvous-bl-modifier -int 0',
      'defaults write com.apple.dock wvous-br-corner -int 0',
      'defaults write com.apple.dock wvous-br-modifier -int 0',

      // Dock settings
      'defaults write com.apple.dock autohide -bool true',
      'defaults write com.apple.dock autohide-delay -float 0',
      'defaults write com.apple.dock autohide-time-modifier -float 0.5',
      'defaults write com.apple.dock magnification -bool false',
      'defaults write com.apple.dock tilesize -int 48',
      'defaults write com.apple.dock orientation -string "bottom"',

      // Menu bar
      'defaults write com.apple.menuextra.clock DateFormat -string "EEE MMM d  h:mm:ss a"',
      'defaults write com.apple.menuextra.battery ShowPercent -string "YES"',
    ];

    for (const cmd of commands) {
      try {
        await execa('bash', ['-c', cmd], { timeout: 30_000, stdin: 'ignore' });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to execute: ${cmd} - ${errorMessage}`);
      }
    }

    // Restart affected services (best-effort; not running on a headless
    // machine). cfprefsd FIRST so the just-written -currentHost screensaver pref
    // is flushed and not served stale to the saver agent.
    for (const service of ['cfprefsd', 'Finder', 'Dock', 'SystemUIServer']) {
      try {
        await execa('killall', [service], { timeout: 10_000 });
      } catch {
        // Service not running (e.g. headless) — safe to ignore.
      }
    }
  }

  private async configureShell(profile: DeveloperProfile): Promise<void> {
    const shell = profile.preferences?.shell || 'bash';

    switch (shell) {
      case 'zsh':
        await this.configureZsh(profile);
        break;
      case 'fish':
        await this.configureFish(profile);
        break;
      case 'bash':
        await this.configureBash(profile);
        break;
    }
  }

  private async configureZsh(_profile: DeveloperProfile): Promise<void> {
    const homeDir = os.homedir();
    const zshrcPath = path.join(homeDir, '.zshrc');

    // Install Oh My Zsh if not present (non-interactive: RUNZSH/CHSH/KEEP_ZSHRC
    // set by nonInteractiveEnv so it neither launches zsh nor overwrites .zshrc).
    const ohmyzshDir = path.join(homeDir, '.oh-my-zsh');
    if (!(await fs.pathExists(ohmyzshDir))) {
      await runShellScript(
        'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"',
        { timeout: 10 * 60 * 1000 }
      );
    }

    // Configure .zshrc
    const zshrcContent = `
# Oh My Zsh configuration
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git node npm brew docker aws)

source $ZSH/oh-my-zsh.sh

# Homebrew
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Development aliases
alias ll="exa -la"
alias cat="bat"
alias find="fd"
alias grep="rg"

# Node.js (NVM)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"

# FZF
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# Custom functions
function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function cleanup() {
  find . -type f -name "*.DS_Store" -delete
}
`;

    await this.writeManagedBlock(
      zshrcPath,
      'wundr-computer-setup',
      zshrcContent
    );

    // Set zsh as default shell (only when interactive: chsh prompts for a password).
    await this.setDefaultShell('/bin/zsh');
  }

  private async configureFish(_profile: DeveloperProfile): Promise<void> {
    const configDir = path.join(os.homedir(), '.config', 'fish');
    await fs.ensureDir(configDir);

    const configPath = path.join(configDir, 'config.fish');
    const fishConfig = `
# Fish configuration
set -x PATH /opt/homebrew/bin /usr/local/bin $PATH

# Aliases
alias ll "exa -la"
alias cat "bat"
alias find "fd"
alias grep "rg"

# Functions
function mkcd
    mkdir -p $argv[1]; and cd $argv[1]
end

function cleanup
    find . -type f -name "*.DS_Store" -delete
end
`;

    await this.writeManagedBlock(
      configPath,
      'wundr-computer-setup',
      fishConfig
    );

    // Set fish as default shell (only when interactive + the binary exists).
    const fishPath = (await fs.pathExists('/opt/homebrew/bin/fish'))
      ? '/opt/homebrew/bin/fish'
      : '/usr/local/bin/fish';
    if (await fs.pathExists(fishPath)) {
      await this.setDefaultShell(fishPath);
    }
  }

  private async configureBash(_profile: DeveloperProfile): Promise<void> {
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const bashrcContent = `
# Bash configuration
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Aliases
alias ll="exa -la"
alias cat="bat"
alias find="fd"
alias grep="rg"

# Functions
function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function cleanup() {
  find . -type f -name "*.DS_Store" -delete
}

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;

    await this.writeManagedBlock(
      bashrcPath,
      'wundr-computer-setup',
      bashrcContent
    );

    // Source in .bash_profile
    const bashProfilePath = path.join(os.homedir(), '.bash_profile');
    const bashProfileContent = `
if [ -f ~/.bashrc ]; then
  source ~/.bashrc
fi
`;

    await this.writeManagedBlock(
      bashProfilePath,
      'wundr-computer-setup-bashrc',
      bashProfileContent
    );
  }

  private async setupDotfiles(_profile: DeveloperProfile): Promise<void> {
    // This could set up a dotfiles repository
    // For now, just ensure basic dotfiles exist
    const homeDir = os.homedir();

    // Create .gitignore_global
    const gitignoreGlobal = path.join(homeDir, '.gitignore_global');
    const gitignoreContent = `
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
node_modules/
*.log
.env
.env.local
*.swp
*.swo
*~
`;

    await fs.writeFile(gitignoreGlobal, gitignoreContent.trim());
    await execa('git', [
      'config',
      '--global',
      'core.excludesfile',
      gitignoreGlobal,
    ]);
  }

  /**
   * Idempotently write a marker-delimited block into a shell rc file. Existing
   * user content is preserved; re-running setup replaces only the managed block
   * (never the whole file), so dotfiles are never clobbered or duplicated.
   */
  private async writeManagedBlock(
    filePath: string,
    marker: string,
    body: string
  ): Promise<void> {
    const begin = `# >>> ${marker} >>>`;
    const end = `# <<< ${marker} <<<`;
    const block = `${begin}\n${body.trim()}\n${end}\n`;

    let existing = '';
    if (await fs.pathExists(filePath)) {
      existing = await fs.readFile(filePath, 'utf8');
    }

    if (existing.includes(begin) && existing.includes(end)) {
      const escape = (value: string): string =>
        value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `${escape(begin)}[\\s\\S]*?${escape(end)}\\n?`
      );
      await fs.writeFile(filePath, existing.replace(pattern, block));
      return;
    }

    const separator =
      existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await fs.writeFile(filePath, `${existing}${separator}${block}`);
  }

  /**
   * Set the login shell, but only when a real console is attached — `chsh`
   * prompts for the user's password and would otherwise hang an unattended run.
   */
  private async setDefaultShell(shellPath: string): Promise<void> {
    if (!isInteractive()) {
      this.logger.info(
        `Skipping default-shell change to ${shellPath} (no interactive console; chsh would prompt for a password).`
      );
      return;
    }
    try {
      await execa('chsh', ['-s', shellPath], { timeout: 30_000 });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not set ${shellPath} as the default shell: ${errorMessage}`
      );
    }
  }

  // Validation methods
  private async validateXcodeCommandLineTools(): Promise<boolean> {
    try {
      await execa('xcode-select', ['-p']);
      return true;
    } catch {
      return false;
    }
  }

  private async validateHomebrew(): Promise<boolean> {
    try {
      await which('brew');
      return true;
    } catch {
      return false;
    }
  }

  private async validateEssentialPackages(): Promise<boolean> {
    const essentialTools = ['curl', 'wget', 'jq', 'tree', 'gh'];

    for (const tool of essentialTools) {
      try {
        await which(tool);
      } catch {
        return false;
      }
    }

    return true;
  }

  private async validateApplications(
    profile: DeveloperProfile
  ): Promise<boolean> {
    // Basic validation - check if key applications are installed
    const applications = this.getApplicationsForProfile(profile);

    // This is a simplified check
    return applications.casks.length > 0;
  }

  private async validateMacOSConfig(): Promise<boolean> {
    try {
      // Check if some key settings are applied
      const { stdout } = await execa('defaults', [
        'read',
        'com.apple.finder',
        'ShowPathbar',
      ]);
      return stdout.trim() === '1';
    } catch {
      return false;
    }
  }

  private async validateShellConfig(
    profile: DeveloperProfile
  ): Promise<boolean> {
    try {
      const { stdout } = await execa('echo', ['$SHELL']);
      const expectedShell =
        profile.preferences?.shell === 'zsh'
          ? 'zsh'
          : profile.preferences?.shell === 'fish'
            ? 'fish'
            : 'bash';
      return stdout.includes(expectedShell);
    } catch {
      return false;
    }
  }
}
