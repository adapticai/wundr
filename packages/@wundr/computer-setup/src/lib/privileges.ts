/**
 * Privilege helpers for computer-setup.
 *
 * Deliberately dependency-light — only Node's `child_process` — so the
 * package's public barrel (index.ts) can re-export these without dragging the
 * heavier `execa`/`fs-extra` type graph of {@link ./headless} through every
 * downstream consumer's module resolution.
 */
import { execFileSync } from 'child_process';

/** Minimal logger surface used by {@link dropPrivilegesIfRoot}. */
export interface PrivilegeLogger {
  info(message: string): void;
}

/** True when the current process's effective UID is 0 (root). */
export function isRoot(): boolean {
  return (process.getuid?.() ?? -1) === 0;
}

export interface InvokingUser {
  user: string;
  uid: number;
  gid: number;
  home: string;
}

/**
 * Resolve the non-root user who launched us via `sudo` (from $SUDO_USER),
 * including their uid/gid/home. Returns null when there is no recoverable
 * non-root user (a genuine root login, or $SUDO_USER unset / "root").
 */
export function resolveInvokingUser(): InvokingUser | null {
  const user = process.env.SUDO_USER;
  if (!user || user === 'root') return null;
  try {
    const uid = Number(
      execFileSync('id', ['-u', user], { encoding: 'utf8' }).trim()
    );
    const gid = Number(
      execFileSync('id', ['-g', user], { encoding: 'utf8' }).trim()
    );
    if (!Number.isInteger(uid) || !Number.isInteger(gid)) return null;

    let home = '';
    if (process.platform === 'darwin') {
      try {
        const out = execFileSync(
          'dscl',
          ['.', '-read', `/Users/${user}`, 'NFSHomeDirectory'],
          { encoding: 'utf8' }
        );
        home = (out.match(/NFSHomeDirectory:\s*(\S+)/)?.[1] ?? '').trim();
      } catch {
        // fall through to the conventional default below
      }
    } else {
      try {
        // getent passwd <user> -> name:x:uid:gid:gecos:HOME:shell
        home =
          execFileSync('getent', ['passwd', user], {
            encoding: 'utf8',
          }).split(':')[5] ?? '';
      } catch {
        // fall through
      }
    }
    if (!home) {
      home = process.platform === 'darwin' ? `/Users/${user}` : `/home/${user}`;
    }
    return { user, uid, gid, home };
  } catch {
    return null;
  }
}

/**
 * computer-setup configures the *invoking user's* environment (Homebrew, nvm,
 * npm globals, shell profiles) and must never run as root: Homebrew refuses
 * EUID 0 outright ("Don't run this as root!"), and anything that did run would
 * scatter root-owned files through /var/root and the user's home.
 *
 * When launched via `sudo`, drop back to the invoking user (gid then uid, then
 * repoint HOME/USER/LOGNAME). When running as a bare root login with no
 * recoverable user, throw an actionable error. No-op (returns null) when we are
 * already non-root.
 */
export function dropPrivilegesIfRoot(
  logger?: PrivilegeLogger
): InvokingUser | null {
  if (!isRoot()) return null;

  const invoker = resolveInvokingUser();
  if (!invoker) {
    throw new Error(
      'computer-setup must not be run as root.\n' +
        'Homebrew and other per-user tools refuse to run as root, and a root run ' +
        'would create root-owned files under /var/root and in your home directory.\n' +
        'Re-run as a normal admin user WITHOUT sudo:\n' +
        '    wundr computer-setup ...\n' +
        "(It uses 'sudo' only for the few steps that genuinely need elevation.)"
    );
  }

  // Order matters: shed supplementary groups and the gid BEFORE the uid — once
  // the uid is lowered the process can no longer change its group membership.
  try {
    process.setgroups?.([invoker.gid]);
  } catch {
    // best-effort; not fatal if supplementary groups can't be trimmed
  }
  process.setgid?.(invoker.gid);
  process.setuid?.(invoker.uid);

  // Under sudo, HOME/USER still point at root — repoint them so os.homedir()
  // and every "~"-based path resolve to the real user's home.
  process.env.HOME = invoker.home;
  process.env.USER = invoker.user;
  process.env.LOGNAME = invoker.user;

  logger?.info(
    `Detected root (via sudo); dropped privileges to ${invoker.user} ` +
      `(uid ${invoker.uid}). User-level installs run as ${invoker.user}, not root.`
  );
  return invoker;
}
