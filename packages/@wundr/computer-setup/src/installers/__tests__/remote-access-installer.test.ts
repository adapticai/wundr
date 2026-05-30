import { RemoteAccessInstaller } from '../remote-access-installer';

import type { DeveloperProfile, SetupPlatform } from '../../types';

const darwin: SetupPlatform = { os: 'darwin', arch: 'arm64', version: 'v20' };
const win: SetupPlatform = { os: 'win32', arch: 'x64', version: 'v20' };

function profile(overrides: Partial<DeveloperProfile> = {}): DeveloperProfile {
  return { name: 'Test', role: 'fullstack', tools: {}, ...overrides };
}

describe('RemoteAccessInstaller', () => {
  const installer = new RemoteAccessInstaller();

  it('is macOS-only', () => {
    expect(installer.isSupported(darwin)).toBe(true);
    expect(installer.isSupported(win)).toBe(false);
  });

  it('exposes a single non-required step that never blocks core setup', () => {
    const steps = installer.getSteps(profile(), darwin);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('configure-remote-access');
    expect(steps[0].required).toBe(false);
  });

  it('short-circuits (no side effects) when remoteAccess.enabled is false', async () => {
    // If the gate did not short-circuit, install() would shell out to brew/which
    // and reject — resolving cleanly proves the gate works without touching the system.
    await expect(
      installer.install(profile({ remoteAccess: { enabled: false } }), darwin)
    ).resolves.toBeUndefined();
  });

  it('short-circuits when WUNDR_NO_REMOTE_ACCESS=1', async () => {
    const prev = process.env.WUNDR_NO_REMOTE_ACCESS;
    process.env.WUNDR_NO_REMOTE_ACCESS = '1';
    try {
      await expect(
        installer.install(profile(), darwin)
      ).resolves.toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.WUNDR_NO_REMOTE_ACCESS;
      else process.env.WUNDR_NO_REMOTE_ACCESS = prev;
    }
  });
});
