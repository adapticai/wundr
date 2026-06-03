/**
 * TCC / PPPC Installer — enterprise-scale TCC permissions for macOS 15.
 *
 * HONEST LIMITATION: Screen Recording (kTCCServiceScreenCapture), Accessibility
 * (kTCCServiceAccessibility), Full Disk Access (kTCCServiceSystemPolicyAllFiles)
 * and Apple Events (kTCCServiceAppleEvents) live in SIP-protected TCC.db files
 * that even root cannot edit for these privacy services on macOS 15. `tccutil`
 * can only RESET, never GRANT. The ONLY sanctioned fleet path to PRE-GRANT them
 * unattended is an MDM-delivered PPPC configuration profile
 * (payload com.apple.TCC.configuration-profile-policy). This installer therefore:
 *   1. GENERATES a deployable .mobileconfig with REAL CodeRequirement strings
 *      extracted from the installed app bundles (codesign -dr -),
 *   2. writes it for MDM upload (Jamf/Kandji/Mosyle) and prints the exact
 *      `profiles install` command for MDM-enrolled macs,
 *   3. DETECTS current grant state read-only and prints a PASS/FAIL matrix,
 *   4. NEVER claims it granted anything it didn't — a manual install is NOT
 *      honoured for ScreenCapture/Accessibility/FDA unless the mac is MDM/supervised.
 * The best-effort non-MDM path (opening the Privacy panes) stays in
 * remote-access-installer.ts (openManualSettings()).
 */
import { execa } from 'execa';
import * as os from 'os';
import * as path from 'path';

import * as fs from 'fs-extra';

import { isInteractive } from '../lib/headless';
import { Logger } from '../utils/logger';

import type { DeveloperProfile, SetupPlatform, SetupStep } from '../types';
import type { BaseInstaller } from './index';

interface TccApp {
  /** Human label for logs. */
  label: string;
  /** /Applications path (or absolute binary path for the agent runtime). */
  appPath: string;
  /** CFBundleIdentifier (or absolute path for a path-identified payload). */
  bundleId: string;
  /** 'bundleID' for a .app, 'path' for a bare binary. */
  identifierType: 'bundleID' | 'path';
  /** Fallback CodeRequirement when `codesign -dr -` can't be read. */
  fallbackCodeReq: string;
}

const TCC_SERVICES = [
  'Accessibility', // kTCCServiceAccessibility
  'ScreenCapture', // kTCCServiceScreenCapture
  'SystemPolicyAllFiles', // kTCCServiceSystemPolicyAllFiles (Full Disk Access)
  'AppleEvents', // kTCCServiceAppleEvents
] as const;

export class TccPppcInstaller implements BaseInstaller {
  name = 'tcc-pppc';
  private readonly logger = new Logger({ name: 'TccPppcInstaller' });

  isSupported(platform: SetupPlatform): boolean {
    return platform.os === 'darwin';
  }

  async isInstalled(): Promise<boolean> {
    return fs.pathExists(this.profilePath());
  }

  async getVersion(): Promise<string | null> {
    return null;
  }

  async validate(): Promise<boolean> {
    // "Valid" == the deployable artifact exists. Grants themselves are MDM-gated.
    return this.isInstalled();
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'configure-tcc-pppc',
        name: 'Generate TCC / PPPC Profile',
        description:
          'Generate an MDM-deployable PPPC profile (Screen Recording, Accessibility, Full Disk Access, Apple Events) for Parsec/Terminal/iTerm + the agent runtime',
        category: 'system',
        required: false,
        dependencies: ['install-applications', 'configure-remote-access'],
        estimatedTime: 30,
        validator: () => this.validate(),
        installer: () => this.install(profile, platform),
      },
    ];
  }

  private profilePath(): string {
    return path.join(
      os.homedir(),
      '.wundr',
      'remote-access',
      'wundr-tcc-pppc.mobileconfig'
    );
  }

  private apps(profile: DeveloperProfile): TccApp[] {
    const list: TccApp[] = [
      {
        label: 'Parsec',
        appPath: '/Applications/Parsec.app',
        bundleId: 'com.parsecgaming.parsec',
        identifierType: 'bundleID',
        fallbackCodeReq:
          'identifier "com.parsecgaming.parsec" and anchor apple generic',
      },
      {
        label: 'Terminal',
        appPath: '/System/Applications/Utilities/Terminal.app',
        bundleId: 'com.apple.Terminal',
        identifierType: 'bundleID',
        fallbackCodeReq: 'identifier "com.apple.Terminal" and anchor apple',
      },
      {
        label: 'iTerm2',
        appPath: '/Applications/iTerm.app',
        bundleId: 'com.googlecode.iterm2',
        identifierType: 'bundleID',
        fallbackCodeReq:
          'identifier "com.googlecode.iterm2" and anchor apple generic',
      },
    ];

    const agentPath = profile.remoteAccess?.agentRuntimePath;
    if (agentPath) {
      list.push({
        label: 'Agent runtime',
        appPath: agentPath,
        bundleId: agentPath, // path-identified payloads use the absolute path
        identifierType: 'path',
        fallbackCodeReq: `path = "${agentPath}"`,
      });
    }

    for (const extra of profile.remoteAccess?.tccExtraBundleIds ?? []) {
      list.push({
        label: extra,
        appPath: `/Applications/${extra}.app`,
        bundleId: extra,
        identifierType: 'bundleID',
        fallbackCodeReq: `identifier "${extra}" and anchor apple generic`,
      });
    }
    return list;
  }

  async install(
    profile: DeveloperProfile,
    _platform: SetupPlatform
  ): Promise<void> {
    if (profile.remoteAccess?.enabled === false) return;

    const org =
      profile.remoteAccess?.mdmOrganization ?? profile.company ?? 'Wundr';
    const apps = this.apps(profile);

    // Always generate the artifact — even headless — so an MDM admin can upload it.
    const file = await this.generateProfile(apps, org);

    this.logger.warn(
      'TCC permissions (Screen Recording, Accessibility, Full Disk Access, Apple Events) ' +
        'CANNOT be granted by any script on macOS 15 — TCC.db is SIP-protected and tccd ' +
        'rejects out-of-band writes for these services. The ONLY unattended/fleet path is ' +
        'an MDM-delivered PPPC profile. A ready-to-deploy profile was written to:\n' +
        `    ${file}\n` +
        '  • Upload it to your MDM (Jamf/Kandji/Mosyle) as a PPPC payload to grant it ' +
        'silently across the fleet.\n' +
        '  • On an MDM-enrolled/supervised mac you can also run:\n' +
        `      sudo profiles install -type configuration -path "${file}"\n` +
        '  • NOTE: a MANUAL `profiles install` is NOT honoured for ScreenCapture/' +
        'Accessibility/SystemPolicyAllFiles unless the mac is MDM-enrolled/supervised; ' +
        'those services REQUIRE MDM delivery. For a non-MDM machine, use the System ' +
        'Settings panes the remote-access step opens.'
    );

    // Only attempt a local `profiles install` when interactive AND MDM-enrolled.
    if (isInteractive() && (await this.isMdmEnrolled())) {
      await this.attemptManualInstall(file);
    }

    await this.detectGrantState(apps);
  }

  /** True only if the mac is enrolled in an MDM (so PPPC TCC payloads are honoured). */
  private async isMdmEnrolled(): Promise<boolean> {
    const r = await execa('profiles', ['status', '-type', 'enrollment'], {
      reject: false,
      timeout: 15_000,
      stdin: 'ignore',
    });
    return /MDM enrollment:\s*Yes/i.test(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  }

  private async attemptManualInstall(file: string): Promise<void> {
    this.logger.info(
      'MDM-enrolled mac detected — installing the PPPC profile...'
    );
    const r = await execa(
      'sudo',
      ['profiles', 'install', '-type', 'configuration', '-path', file],
      { reject: false, timeout: 60_000, stdin: 'inherit' }
    );
    if (r.exitCode !== 0) {
      this.logger.warn(
        `profiles install exited ${r.exitCode}: ${String(r.stderr ?? '')
          .split('\n')
          .filter(Boolean)
          .slice(-2)
          .join(' ')}. Upload the profile via MDM instead.`
      );
    } else {
      this.logger.info('PPPC profile installed via `profiles`.');
    }
  }

  /**
   * Extract the live Designated Requirement of an app/binary; fall back to the
   * hardcoded anchor-based requirement when codesign can't read it (app absent /
   * unsigned). Prefer the live value so the PPPC grant matches the running binary.
   */
  private async codeRequirement(app: TccApp): Promise<string> {
    if (!(await fs.pathExists(app.appPath))) {
      this.logger.warn(
        `${app.label} not present at ${app.appPath} — using fallback CodeRequirement.`
      );
      return app.fallbackCodeReq;
    }
    const r = await execa('codesign', ['-dr', '-', app.appPath], {
      reject: false,
      timeout: 15_000,
      stdin: 'ignore',
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    const m = out.match(/designated\s+=>\s+(.+)/);
    const req = m?.[1]?.trim();
    if (!req) {
      this.logger.warn(
        `Could not read codesign requirement for ${app.label}; using fallback.`
      );
      return app.fallbackCodeReq;
    }
    return req;
  }

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
      .toUpperCase();
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async generateProfile(apps: TccApp[], org: string): Promise<string> {
    // Each service maps to an array of auth dicts. macOS 13+ reads
    // Authorization=Allow (and ignores the legacy Allowed bool); we emit both for
    // 12→15 compatibility.
    const serviceBlocks: string[] = [];
    for (const service of TCC_SERVICES) {
      const entries: string[] = [];
      for (const app of apps) {
        const codeReq = this.escapeXml(await this.codeRequirement(app));
        const idType = app.identifierType;
        const ident = this.escapeXml(app.bundleId);
        // AppleEvents needs an AEReceiver* triple to name the target; a general
        // "may send to System Events" grant targets com.apple.systemevents.
        const ae =
          service === 'AppleEvents'
            ? `\n          <key>AEReceiverIdentifier</key>\n          <string>com.apple.systemevents</string>\n          <key>AEReceiverIdentifierType</key>\n          <string>bundleID</string>\n          <key>AEReceiverCodeRequirement</key>\n          <string>identifier "com.apple.systemevents" and anchor apple</string>`
            : '';
        entries.push(
          `        <dict>
          <key>Allowed</key>
          <true/>
          <key>Authorization</key>
          <string>Allow</string>
          <key>Identifier</key>
          <string>${ident}</string>
          <key>IdentifierType</key>
          <string>${idType}</string>
          <key>CodeRequirement</key>
          <string>${codeReq}</string>${ae}
        </dict>`
        );
      }
      serviceBlocks.push(
        `      <key>${service}</key>\n      <array>\n${entries.join(
          '\n'
        )}\n      </array>`
      );
    }

    const payloadUuid = this.uuid();
    const innerUuid = this.uuid();
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadIdentifier</key>
  <string>com.wundr.tcc.pppc</string>
  <key>PayloadUUID</key>
  <string>${payloadUuid}</string>
  <key>PayloadDisplayName</key>
  <string>Wundr Agent TCC (PPPC)</string>
  <key>PayloadOrganization</key>
  <string>${this.escapeXml(org)}</string>
  <key>PayloadDescription</key>
  <string>Grants Screen Recording, Accessibility, Full Disk Access and Apple Events to Parsec, Terminal, iTerm and the agent runtime for unattended remote operation. Honoured only when delivered via MDM.</string>
  <key>PayloadScope</key>
  <string>System</string>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.TCC.configuration-profile-policy</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.wundr.tcc.pppc.policy</string>
      <key>PayloadUUID</key>
      <string>${innerUuid}</string>
      <key>PayloadDisplayName</key>
      <string>Privacy Preferences Policy Control</string>
      <key>PayloadOrganization</key>
      <string>${this.escapeXml(org)}</string>
      <key>Services</key>
      <dict>
${serviceBlocks.join('\n')}
      </dict>
    </dict>
  </array>
</dict>
</plist>
`;

    const file = this.profilePath();
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, plist, 'utf8');
    this.logger.info(`Wrote PPPC profile to ${file}`);
    return file;
  }

  /**
   * Read-only grant-state probe. Reads the system TCC.db directly (via sudo -n).
   * If it can't be opened, that almost always means the calling terminal lacks
   * Full Disk Access — report UNKNOWN rather than a false DENIED.
   */
  private async detectGrantState(apps: TccApp[]): Promise<void> {
    const inClause = TCC_SERVICES.map(s => `'kTCCService${s}'`).join(',');
    const sql = `select client,service,auth_value from access where service in (${inClause});`;
    const systemDb = '/Library/Application Support/com.apple.TCC/TCC.db';

    const r = await execa('sudo', ['-n', 'sqlite3', systemDb, sql], {
      reject: false,
      timeout: 15_000,
      stdin: 'ignore',
    });
    if (r.exitCode !== 0) {
      const why = /unable to open|denied|not permitted/i.test(
        String(r.stderr ?? '')
      )
        ? 'UNKNOWN — the calling terminal needs Full Disk Access (grant via MDM PPPC), or sudo is unavailable'
        : `UNKNOWN — could not read TCC.db (${String(r.stderr ?? '')
            .trim()
            .slice(0, 80)})`;
      this.logger.info(`TCC grant state: ${why}.`);
      return;
    }

    // rows: client|service|auth_value (2 == allowed on macOS 13+).
    const granted = new Set<string>();
    for (const line of String(r.stdout ?? '').split('\n')) {
      const [client, service, auth] = line.split('|');
      if (client && service && Number(auth) >= 2) {
        granted.add(`${client}::${service}`);
      }
    }
    const lines = ['TCC grant state (read back, system TCC.db):'];
    for (const app of apps) {
      for (const service of TCC_SERVICES) {
        const ok = granted.has(`${app.bundleId}::kTCCService${service}`);
        lines.push(`  ${ok ? 'OK ' : 'NO '} ${app.label} — ${service}`);
      }
    }
    lines.push(
      '  (NO = needs the PPPC profile delivered via MDM, or a one-time manual grant in System Settings > Privacy & Security.)'
    );
    this.logger.info(lines.join('\n'));
  }
}
