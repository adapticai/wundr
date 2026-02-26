/**
 * Tests for the environment variable sanitizer (src/security/env-sanitizer.ts).
 *
 * Covers:
 *  - Blocked variable detection (universal + platform-specific)
 *  - Dangerous prefix matching (DYLD_*, LD_*)
 *  - Config-driven denylist / denyPrefixes
 *  - PATH sanitization (trusted dirs, home dirs, Nix, fallback)
 *  - Injection detection (command substitution, null bytes, control chars, pipe-to-shell)
 *  - Allowlist mode (only allowlisted + always-allowed vars pass)
 *  - Empty key handling
 *  - Subprocess env builder (buildSubprocessEnv)
 *  - Env validation for exec (validateEnvForExec)
 *  - Env redaction for logging (redactEnvForLogging, isSensitiveEnvVar)
 *  - Audit event emission
 *  - Exec approval pre-check (checkEnvForApproval)
 *  - Query helpers (getDangerousVarList, getDangerousPrefixList)
 *  - EnvSecurityError
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  sanitizeEnv,
  sanitizePath,
  validateEnvForExec,
  buildSubprocessEnv,
  redactEnvForLogging,
  isSensitiveEnvVar,
  getDangerousVarList,
  getDangerousPrefixList,
  checkEnvForApproval,
  EnvSecurityError,
  _testing,
  type EnvSanitizerConfig,
  type EnvAuditEvent,
} from '../../../security/env-sanitizer';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const SAFE_ENV: Record<string, string> = {
  HOME: '/home/testuser',
  USER: 'testuser',
  SHELL: '/bin/bash',
  TERM: 'xterm-256color',
  LANG: 'en_US.UTF-8',
  NODE_ENV: 'test',
};

/** Construct a minimal config object for tests. */
function makeConfig(
  overrides?: Partial<EnvSanitizerConfig>
): EnvSanitizerConfig {
  return {
    platform: 'linux',
    detectInjection: true,
    allowPathModification: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Dangerous Variable Detection
// ---------------------------------------------------------------------------

describe('EnvSanitizer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // sanitizeEnv - blocked variable detection
  // =========================================================================

  describe('sanitizeEnv - dangerous variable blocking', () => {
    const universalDangerousVars = [
      'NODE_OPTIONS',
      'NODE_EXTRA_CA_CERTS',
      'NODE_PATH',
      'NODE_REDIRECT_WARNINGS',
      'NODE_REPL_HISTORY',
      'NODE_TLS_REJECT_UNAUTHORIZED',
      'PYTHONPATH',
      'PYTHONHOME',
      'PYTHONSTARTUP',
      'PYTHONUSERSITE',
      'RUBYLIB',
      'RUBYOPT',
      'PERL5LIB',
      'PERL5OPT',
      'BASH_ENV',
      'ENV',
      'CDPATH',
      'GLOBIGNORE',
      'IFS',
      'PROMPT_COMMAND',
      'SHELLOPTS',
      'BASHOPTS',
      'PS4',
      'GCONV_PATH',
      'SSLKEYLOGFILE',
      'LOCALDOMAIN',
      'HOSTALIASES',
      'RES_OPTIONS',
      'JAVA_TOOL_OPTIONS',
      '_JAVA_OPTIONS',
      'JDK_JAVA_OPTIONS',
      'DOTNET_STARTUP_HOOKS',
      'COMPlus_EnableDiagnostics',
      'GIT_ASKPASS',
      'SSH_ASKPASS',
      'GIT_EXEC_PATH',
      'CMAKE_PREFIX_PATH',
      'CFLAGS',
      'CXXFLAGS',
      'LDFLAGS',
      'CPPFLAGS',
      'PKG_CONFIG_PATH',
    ];

    it.each(universalDangerousVars)(
      'should block universal dangerous variable: %s',
      varName => {
        const env = { ...SAFE_ENV, [varName]: 'malicious-value' };
        const result = sanitizeEnv(env, makeConfig());

        expect(result.env).not.toHaveProperty(varName);
        expect(result.blocked.some(b => b.key === varName)).toBe(true);
        expect(result.blocked.find(b => b.key === varName)?.reason).toBe(
          'dangerous_variable'
        );
        expect(result.changed).toBe(true);
      }
    );

    it('should block all 38+ universal dangerous variables', () => {
      expect(_testing.DANGEROUS_ENV_VARS_UNIVERSAL.size).toBeGreaterThanOrEqual(
        38
      );
    });

    describe('macOS-specific variables', () => {
      const macosVars = [
        'DYLD_INSERT_LIBRARIES',
        'DYLD_LIBRARY_PATH',
        'DYLD_FALLBACK_LIBRARY_PATH',
        'DYLD_FRAMEWORK_PATH',
        'DYLD_FALLBACK_FRAMEWORK_PATH',
        'DYLD_IMAGE_SUFFIX',
        'DYLD_FORCE_FLAT_NAMESPACE',
        'DYLD_PRINT_LIBRARIES',
        'DYLD_PRINT_APIS',
      ];

      it.each(macosVars)(
        'should block macOS variable %s on darwin',
        varName => {
          const env = { ...SAFE_ENV, [varName]: '/evil/lib.dylib' };
          const result = sanitizeEnv(env, makeConfig({ platform: 'darwin' }));

          expect(result.env).not.toHaveProperty(varName);
          expect(result.blocked.some(b => b.key === varName)).toBe(true);
        }
      );

      it('should NOT block macOS DYLD vars on linux via exact match (caught by prefix)', () => {
        // On linux, DYLD_ vars are not in the exact-match set but MIGHT NOT
        // be caught by prefix since DYLD_ is only a prefix on darwin.
        // They should pass through on linux.
        const env = { ...SAFE_ENV, DYLD_INSERT_LIBRARIES: '/lib.dylib' };
        const result = sanitizeEnv(env, makeConfig({ platform: 'linux' }));

        // DYLD_ prefix is NOT in linux prefix list, so it should pass through
        expect(result.env).toHaveProperty('DYLD_INSERT_LIBRARIES');
      });
    });

    describe('Linux-specific variables', () => {
      const linuxVars = [
        'LD_PRELOAD',
        'LD_LIBRARY_PATH',
        'LD_AUDIT',
        'LD_BIND_NOT',
        'LD_DEBUG',
        'LD_DEBUG_OUTPUT',
        'LD_DYNAMIC_WEAK',
        'LD_HWCAP_MASK',
        'LD_ORIGIN_PATH',
        'LD_PROFILE',
        'LD_PROFILE_OUTPUT',
        'LD_SHOW_AUXV',
        'LD_USE_LOAD_BIAS',
      ];

      it.each(linuxVars)('should block Linux variable %s on linux', varName => {
        const env = { ...SAFE_ENV, [varName]: '/evil/lib.so' };
        const result = sanitizeEnv(env, makeConfig({ platform: 'linux' }));

        expect(result.env).not.toHaveProperty(varName);
        expect(result.blocked.some(b => b.key === varName)).toBe(true);
      });
    });

    describe('Windows-specific variables', () => {
      it('should block COMSPEC on win32', () => {
        const env = { ...SAFE_ENV, COMSPEC: 'C:\\evil\\cmd.exe' };
        const result = sanitizeEnv(env, makeConfig({ platform: 'win32' }));

        expect(result.env).not.toHaveProperty('COMSPEC');
        expect(result.blocked.some(b => b.key === 'COMSPEC')).toBe(true);
      });

      it('should block PATHEXT on win32', () => {
        const env = { ...SAFE_ENV, PATHEXT: '.EXE;.BAT;.PS1' };
        const result = sanitizeEnv(env, makeConfig({ platform: 'win32' }));

        expect(result.env).not.toHaveProperty('PATHEXT');
      });
    });

    describe('unknown platform', () => {
      it('should include both Linux and macOS dangerous vars on unknown platforms', () => {
        const vars = _testing.resolveDangerousVars('haiku' as NodeJS.Platform);

        expect(vars.has('LD_PRELOAD')).toBe(true);
        expect(vars.has('DYLD_INSERT_LIBRARIES')).toBe(true);
        expect(vars.has('NODE_OPTIONS')).toBe(true);
      });
    });
  });

  // =========================================================================
  // sanitizeEnv - dangerous prefix matching
  // =========================================================================

  describe('sanitizeEnv - dangerous prefix matching', () => {
    it('should block variables with DYLD_ prefix on darwin', () => {
      const env = { ...SAFE_ENV, DYLD_CUSTOM_VAR: 'something' };
      const result = sanitizeEnv(env, makeConfig({ platform: 'darwin' }));

      expect(result.env).not.toHaveProperty('DYLD_CUSTOM_VAR');
      const entry = result.blocked.find(b => b.key === 'DYLD_CUSTOM_VAR');
      expect(entry).toBeDefined();
      expect(entry!.reason).toBe('dangerous_prefix');
    });

    it('should block variables with LD_ prefix on linux', () => {
      const env = { ...SAFE_ENV, LD_CUSTOM_VAR: 'something' };
      const result = sanitizeEnv(env, makeConfig({ platform: 'linux' }));

      expect(result.env).not.toHaveProperty('LD_CUSTOM_VAR');
      const entry = result.blocked.find(b => b.key === 'LD_CUSTOM_VAR');
      expect(entry).toBeDefined();
      expect(entry!.reason).toBe('dangerous_prefix');
    });

    it('should block variables with config denyPrefixes', () => {
      const env = { ...SAFE_ENV, CUSTOM_EVIL_VAR: 'bad' };
      const result = sanitizeEnv(
        env,
        makeConfig({ denyPrefixes: ['CUSTOM_EVIL_'] })
      );

      expect(result.env).not.toHaveProperty('CUSTOM_EVIL_VAR');
      const entry = result.blocked.find(b => b.key === 'CUSTOM_EVIL_VAR');
      expect(entry?.reason).toBe('dangerous_prefix');
    });

    it('should resolve correct prefixes per platform', () => {
      expect(_testing.DANGEROUS_PREFIXES_MACOS).toContain('DYLD_');
      expect(_testing.DANGEROUS_PREFIXES_LINUX).toContain('LD_');
    });
  });

  // =========================================================================
  // sanitizeEnv - config denylist
  // =========================================================================

  describe('sanitizeEnv - config denylist', () => {
    it('should block variables in the config denylist', () => {
      const env = { ...SAFE_ENV, MY_FORBIDDEN_VAR: 'secret' };
      const result = sanitizeEnv(
        env,
        makeConfig({ denylist: ['MY_FORBIDDEN_VAR'] })
      );

      expect(result.env).not.toHaveProperty('MY_FORBIDDEN_VAR');
      const entry = result.blocked.find(b => b.key === 'MY_FORBIDDEN_VAR');
      expect(entry?.reason).toBe('config_denylist');
    });

    it('should match denylist case-insensitively', () => {
      const env = { ...SAFE_ENV, my_var: 'value' };
      const result = sanitizeEnv(env, makeConfig({ denylist: ['MY_VAR'] }));

      expect(result.env).not.toHaveProperty('my_var');
    });
  });

  // =========================================================================
  // sanitizeEnv - injection detection
  // =========================================================================

  describe('sanitizeEnv - injection detection', () => {
    it('should detect command substitution via $()', () => {
      const env = { ...SAFE_ENV, EVIL: '$(rm -rf /)' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
      expect(result.blocked.find(b => b.key === 'EVIL')?.reason).toBe(
        'injection_detected'
      );
    });

    it('should detect backtick command substitution', () => {
      const env = { ...SAFE_ENV, EVIL: '`whoami`' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
      expect(result.blocked.find(b => b.key === 'EVIL')?.reason).toBe(
        'injection_detected'
      );
    });

    it('should detect null byte injection', () => {
      const env = { ...SAFE_ENV, EVIL: 'normal\x00injected' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
      expect(result.blocked.find(b => b.key === 'EVIL')?.reason).toBe(
        'injection_detected'
      );
    });

    it('should detect semicolon-separated command injection', () => {
      const env = {
        ...SAFE_ENV,
        EVIL: 'legit; rm -rf /important',
      };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
    });

    it('should detect pipe-to-shell injection', () => {
      const env = { ...SAFE_ENV, EVIL: 'data | bash -c "evil"' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
    });

    it('should detect control characters in values', () => {
      const env = { ...SAFE_ENV, EVIL: 'hello\x07world' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('EVIL');
    });

    it('should detect excessively long values', () => {
      const env = { ...SAFE_ENV, HUGE: 'A'.repeat(70_000) };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env).not.toHaveProperty('HUGE');
      expect(result.blocked.find(b => b.key === 'HUGE')?.reason).toBe(
        'injection_detected'
      );
    });

    it('should allow clean values when injection detection is enabled', () => {
      const env = {
        ...SAFE_ENV,
        MY_VAR: 'totally-fine-value-123',
      };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env.MY_VAR).toBe('totally-fine-value-123');
    });

    it('should skip injection detection when disabled', () => {
      const env = { ...SAFE_ENV, SKETCHY: '$(echo hi)' };
      const result = sanitizeEnv(env, makeConfig({ detectInjection: false }));

      expect(result.env.SKETCHY).toBe('$(echo hi)');
    });

    it('should have at least 4 injection patterns', () => {
      expect(_testing.INJECTION_PATTERNS.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // sanitizeEnv - allowlist mode
  // =========================================================================

  describe('sanitizeEnv - allowlist mode', () => {
    it('should only allow variables in the allowlist plus always-allowed', () => {
      const env = {
        ...SAFE_ENV,
        CUSTOM_VAR: 'allowed',
        FORBIDDEN_VAR: 'blocked',
      };
      const result = sanitizeEnv(
        env,
        makeConfig({ allowlist: ['CUSTOM_VAR'] })
      );

      expect(result.env).toHaveProperty('CUSTOM_VAR');
      expect(result.env).not.toHaveProperty('FORBIDDEN_VAR');
      // Always-allowed vars should still pass
      expect(result.env).toHaveProperty('HOME');
      expect(result.env).toHaveProperty('USER');
      expect(result.env).toHaveProperty('NODE_ENV');
    });

    it('should match allowlist case-insensitively', () => {
      const env = { ...SAFE_ENV, my_custom_var: 'value' };
      const result = sanitizeEnv(
        env,
        makeConfig({ allowlist: ['MY_CUSTOM_VAR'] })
      );

      expect(result.env).toHaveProperty('my_custom_var');
    });

    it('should block non-allowlisted vars with reason not_in_allowlist', () => {
      const env = { ...SAFE_ENV, EXTRA: 'value' };
      const result = sanitizeEnv(
        env,
        makeConfig({ allowlist: ['__PLACEHOLDER__'] })
      );

      const entry = result.blocked.find(b => b.key === 'EXTRA');
      expect(entry?.reason).toBe('not_in_allowlist');
    });

    it('should still block dangerous vars even if in allowlist', () => {
      // Dangerous vars are checked BEFORE the allowlist filter
      const env = { ...SAFE_ENV, NODE_OPTIONS: '--evil' };
      const result = sanitizeEnv(
        env,
        makeConfig({ allowlist: ['NODE_OPTIONS'] })
      );

      expect(result.env).not.toHaveProperty('NODE_OPTIONS');
    });
  });

  // =========================================================================
  // sanitizeEnv - empty key handling
  // =========================================================================

  describe('sanitizeEnv - empty key handling', () => {
    it('should block variables with empty keys', () => {
      const env: Record<string, string> = {
        ...SAFE_ENV,
        '': 'no-key',
      };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.blocked.some(b => b.reason === 'empty_key')).toBe(true);
    });

    it('should block variables with whitespace-only keys', () => {
      const env: Record<string, string> = {
        ...SAFE_ENV,
        '   ': 'whitespace-key',
      };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.blocked.some(b => b.reason === 'empty_key')).toBe(true);
    });
  });

  // =========================================================================
  // sanitizeEnv - PATH handling
  // =========================================================================

  describe('sanitizeEnv - PATH handling', () => {
    it('should block PATH when allowPathModification is false', () => {
      const env = {
        ...SAFE_ENV,
        PATH: '/usr/bin:/usr/local/bin',
      };
      const result = sanitizeEnv(
        env,
        makeConfig({ allowPathModification: false })
      );

      expect(result.env).not.toHaveProperty('PATH');
      const entry = result.blocked.find(b => b.key === 'PATH');
      expect(entry?.reason).toBe('path_modification_blocked');
    });

    it('should sanitize PATH when allowPathModification is true', () => {
      const env = {
        ...SAFE_ENV,
        PATH: '/usr/bin:/suspicious/path:/usr/local/bin',
      };
      const result = sanitizeEnv(
        env,
        makeConfig({
          allowPathModification: true,
          trustedPathDirs: ['/usr/bin', '/usr/local/bin'],
        })
      );

      expect(result.env.PATH).toContain('/usr/bin');
      expect(result.env.PATH).toContain('/usr/local/bin');
      expect(result.env.PATH).not.toContain('/suspicious/path');
    });

    it('should record modified PATH entries in the modified array', () => {
      const env = {
        ...SAFE_ENV,
        PATH: '/usr/bin:/evil/path',
      };
      const result = sanitizeEnv(
        env,
        makeConfig({
          allowPathModification: true,
          trustedPathDirs: ['/usr/bin'],
        })
      );

      expect(result.modified.some(m => m.key === 'PATH')).toBe(true);
      expect(result.changed).toBe(true);
    });

    it('should not record modification when PATH is unchanged', () => {
      const env = {
        ...SAFE_ENV,
        PATH: '/usr/bin:/usr/local/bin',
      };
      const result = sanitizeEnv(
        env,
        makeConfig({
          allowPathModification: true,
          trustedPathDirs: ['/usr/bin', '/usr/local/bin'],
        })
      );

      expect(result.modified.some(m => m.key === 'PATH')).toBe(false);
    });
  });

  // =========================================================================
  // sanitizeEnv - safe variables pass through
  // =========================================================================

  describe('sanitizeEnv - safe variables pass through', () => {
    it('should allow all always-allowed variables', () => {
      const alwaysAllowed = [..._testing.ALWAYS_ALLOWED_VARS];
      const env: Record<string, string> = {};
      for (const key of alwaysAllowed) {
        if (key !== 'PATH') {
          env[key] = `value-of-${key}`;
        }
      }

      const result = sanitizeEnv(env, makeConfig());

      for (const key of alwaysAllowed) {
        if (key !== 'PATH') {
          expect(result.env).toHaveProperty(key);
        }
      }
    });

    it('should pass through custom (non-dangerous) variables', () => {
      const env = { ...SAFE_ENV, MY_APP_VAR: 'hello' };
      const result = sanitizeEnv(env, makeConfig());

      expect(result.env.MY_APP_VAR).toBe('hello');
    });

    it('should return changed=false when nothing is blocked or modified', () => {
      const result = sanitizeEnv(SAFE_ENV, makeConfig());

      expect(result.changed).toBe(false);
      expect(result.blocked).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
    });
  });

  // =========================================================================
  // sanitizeEnv - audit event emission
  // =========================================================================

  describe('sanitizeEnv - audit events', () => {
    it('should emit audit events for blocked variables', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, NODE_OPTIONS: '--evil' };

      sanitizeEnv(env, makeConfig({ onAudit: e => events.push(e) }));

      const event = events.find(e => e.key === 'NODE_OPTIONS');
      expect(event).toBeDefined();
      expect(event!.action).toBe('blocked');
      expect(event!.severity).toBe('critical');
      expect(event!.timestamp).toBeGreaterThan(0);
    });

    it('should emit audit events for injection detection', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, EVIL: '$(rm -rf /)' };

      sanitizeEnv(env, makeConfig({ onAudit: e => events.push(e) }));

      const event = events.find(e => e.key === 'EVIL');
      expect(event).toBeDefined();
      expect(event!.action).toBe('injection_detected');
      expect(event!.severity).toBe('critical');
    });

    it('should emit audit events for PATH modification', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, PATH: '/usr/bin:/evil' };

      sanitizeEnv(
        env,
        makeConfig({
          allowPathModification: true,
          trustedPathDirs: ['/usr/bin'],
          onAudit: e => events.push(e),
        })
      );

      const event = events.find(
        e => e.key === 'PATH' && e.action === 'modified'
      );
      expect(event).toBeDefined();
    });

    it('should emit audit events for blocked PATH when not allowed', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, PATH: '/usr/bin' };

      sanitizeEnv(
        env,
        makeConfig({
          allowPathModification: false,
          onAudit: e => events.push(e),
        })
      );

      const event = events.find(
        e => e.key === 'PATH' && e.action === 'blocked'
      );
      expect(event).toBeDefined();
      expect(event!.severity).toBe('warn');
    });

    it('should emit audit events for empty keys', () => {
      const events: EnvAuditEvent[] = [];
      const env: Record<string, string> = { '': 'value' };

      sanitizeEnv(env, makeConfig({ onAudit: e => events.push(e) }));

      expect(events.some(e => e.action === 'blocked')).toBe(true);
    });

    it('should emit audit events for config denylist blocks', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, DENY_ME: 'val' };

      sanitizeEnv(
        env,
        makeConfig({
          denylist: ['DENY_ME'],
          onAudit: e => events.push(e),
        })
      );

      const event = events.find(e => e.key === 'DENY_ME');
      expect(event).toBeDefined();
      expect(event!.severity).toBe('warn');
    });

    it('should emit audit events for allowlist blocks', () => {
      const events: EnvAuditEvent[] = [];
      const env = { ...SAFE_ENV, NOT_ALLOWED: 'val' };

      sanitizeEnv(
        env,
        makeConfig({
          allowlist: ['__PLACEHOLDER__'],
          onAudit: e => events.push(e),
        })
      );

      const event = events.find(e => e.key === 'NOT_ALLOWED');
      expect(event).toBeDefined();
      expect(event!.severity).toBe('info');
    });
  });

  // =========================================================================
  // sanitizePath
  // =========================================================================

  describe('sanitizePath', () => {
    const trustedDirs = ['/usr/bin', '/usr/local/bin', '/sbin', '/bin'];

    it('should keep trusted directory entries', () => {
      const result = sanitizePath(
        '/usr/bin:/usr/local/bin:/sbin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/usr/bin');
      expect(result).toContain('/usr/local/bin');
      expect(result).toContain('/sbin');
    });

    it('should remove untrusted directory entries', () => {
      const result = sanitizePath(
        '/usr/bin:/evil/path:/usr/local/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).not.toContain('/evil/path');
    });

    it('should allow user home subdirectories', () => {
      const result = sanitizePath(
        '/usr/bin:/home/user/.local/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/home/user/.local/bin');
    });

    it('should allow Nix store paths', () => {
      const result = sanitizePath(
        '/usr/bin:/nix/store/abc123-pkg/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/nix/store/abc123-pkg/bin');
    });

    it('should allow /usr/lib/ paths', () => {
      const result = sanitizePath(
        '/usr/bin:/usr/lib/jvm/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/usr/lib/jvm/bin');
    });

    it('should allow /usr/share/ paths', () => {
      const result = sanitizePath(
        '/usr/bin:/usr/share/something/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/usr/share/something/bin');
    });

    it('should return FALLBACK_PATH when all entries are stripped', () => {
      const result = sanitizePath('/evil/a:/evil/b', trustedDirs, '/home/user');

      expect(result).toBe(_testing.FALLBACK_PATH);
    });

    it('should handle trailing slashes in path entries', () => {
      const result = sanitizePath(
        '/usr/bin/:/usr/local/bin/',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/usr/bin');
      expect(result).toContain('/usr/local/bin');
    });

    it('should handle empty entries gracefully', () => {
      const result = sanitizePath(
        '/usr/bin:::/usr/local/bin',
        trustedDirs,
        '/home/user'
      );

      expect(result).toContain('/usr/bin');
      expect(result).toContain('/usr/local/bin');
    });

    it('should use default trusted dirs when none provided', () => {
      const result = sanitizePath('/usr/bin:/usr/local/bin');

      expect(result).toContain('/usr/bin');
      expect(result).toContain('/usr/local/bin');
    });
  });

  // =========================================================================
  // validateEnvForExec
  // =========================================================================

  describe('validateEnvForExec', () => {
    it('should not throw for safe environment variables', () => {
      expect(() =>
        validateEnvForExec(SAFE_ENV, { platform: 'linux' })
      ).not.toThrow();
    });

    it('should throw EnvSecurityError for dangerous variables', () => {
      const env = { NODE_OPTIONS: '--evil' };

      expect(() => validateEnvForExec(env, { platform: 'linux' })).toThrow(
        EnvSecurityError
      );
    });

    it('should include variable key in the error', () => {
      const env = { NODE_OPTIONS: '--evil' };

      try {
        validateEnvForExec(env, { platform: 'linux' });
        expect.fail('Should have thrown');
      } catch (err) {
        const error = err as EnvSecurityError;
        expect(error.variableKey).toBe('NODE_OPTIONS');
        expect(error.blockReason).toBe('dangerous_variable');
      }
    });

    it('should throw for dangerous prefix variables', () => {
      const env = { DYLD_CUSTOM: 'val' };

      expect(() => validateEnvForExec(env, { platform: 'darwin' })).toThrow(
        EnvSecurityError
      );
    });

    it('should throw for PATH variable', () => {
      const env = { PATH: '/usr/bin' };

      expect(() => validateEnvForExec(env, { platform: 'linux' })).toThrow(
        EnvSecurityError
      );

      try {
        validateEnvForExec(env, { platform: 'linux' });
      } catch (err) {
        expect((err as EnvSecurityError).blockReason).toBe(
          'path_modification_blocked'
        );
      }
    });

    it('should throw for injection attempts', () => {
      const env = { EVIL: '$(rm -rf /)' };

      expect(() => validateEnvForExec(env, { platform: 'linux' })).toThrow(
        EnvSecurityError
      );

      try {
        validateEnvForExec(env, { platform: 'linux' });
      } catch (err) {
        expect((err as EnvSecurityError).blockReason).toBe(
          'injection_detected'
        );
      }
    });

    it('should throw for config denylist variables', () => {
      const env = { MY_BANNED: 'val' };

      expect(() =>
        validateEnvForExec(env, {
          platform: 'linux',
          denylist: ['MY_BANNED'],
        })
      ).toThrow(EnvSecurityError);
    });

    it('should skip empty keys without throwing', () => {
      const env: Record<string, string> = { '': 'val', HOME: '/home/user' };

      expect(() =>
        validateEnvForExec(env, { platform: 'linux' })
      ).not.toThrow();
    });
  });

  // =========================================================================
  // buildSubprocessEnv
  // =========================================================================

  describe('buildSubprocessEnv', () => {
    it('should return sanitized base environment', () => {
      const baseEnv: Record<string, string> = {
        HOME: '/home/user',
        USER: 'user',
        PATH: '/usr/bin:/usr/local/bin',
        NODE_OPTIONS: '--evil',
      };

      const result = buildSubprocessEnv(null, {
        platform: 'linux',
        baseEnv,
        trustedPathDirs: ['/usr/bin', '/usr/local/bin'],
      });

      expect(result.env).toHaveProperty('HOME');
      expect(result.env).not.toHaveProperty('NODE_OPTIONS');
      expect(result.env.PATH).toBeDefined();
    });

    it('should inject Wundr metadata variables', () => {
      const result = buildSubprocessEnv(null, {
        platform: 'linux',
        baseEnv: { HOME: '/home/user', PATH: '/usr/bin' },
        trustedPathDirs: ['/usr/bin'],
        sessionId: 'sess-123',
        agentId: 'agent-456',
        cwd: '/workspace',
      });

      expect(result.env.WUNDR_SESSION_ID).toBe('sess-123');
      expect(result.env.WUNDR_AGENT_ID).toBe('agent-456');
      expect(result.env.WUNDR_CWD).toBe('/workspace');
    });

    it('should merge overrides after sanitization', () => {
      const baseEnv: Record<string, string> = {
        HOME: '/home/user',
        PATH: '/usr/bin',
      };
      const overrides: Record<string, string> = {
        MY_CUSTOM: 'value',
      };

      const result = buildSubprocessEnv(overrides, {
        platform: 'linux',
        baseEnv,
        trustedPathDirs: ['/usr/bin'],
      });

      expect(result.env.MY_CUSTOM).toBe('value');
    });

    it('should block dangerous overrides', () => {
      const baseEnv: Record<string, string> = {
        HOME: '/home/user',
        PATH: '/usr/bin',
      };
      const overrides: Record<string, string> = {
        NODE_OPTIONS: '--evil',
        CLEAN_VAR: 'ok',
      };

      const result = buildSubprocessEnv(overrides, {
        platform: 'linux',
        baseEnv,
        trustedPathDirs: ['/usr/bin'],
      });

      expect(result.env).not.toHaveProperty('NODE_OPTIONS');
      expect(result.env.CLEAN_VAR).toBe('ok');
      expect(result.blocked.some(b => b.key === 'NODE_OPTIONS')).toBe(true);
    });

    it('should provide a sanitized PATH even when base has no PATH', () => {
      const result = buildSubprocessEnv(null, {
        platform: 'linux',
        baseEnv: { HOME: '/home/user' },
      });

      expect(result.env.PATH).toBeDefined();
      expect(result.env.PATH.length).toBeGreaterThan(0);
    });

    it('should merge PATH overrides by appending', () => {
      const baseEnv: Record<string, string> = {
        HOME: '/home/user',
        PATH: '/usr/bin',
      };
      const overrides: Record<string, string> = {
        PATH: '/usr/local/bin',
      };

      const result = buildSubprocessEnv(overrides, {
        platform: 'linux',
        baseEnv,
        trustedPathDirs: ['/usr/bin', '/usr/local/bin'],
        allowPathModification: true,
      });

      expect(result.env.PATH).toContain('/usr/bin');
      expect(result.env.PATH).toContain('/usr/local/bin');
    });

    it('should handle null overrides gracefully', () => {
      const result = buildSubprocessEnv(null, {
        platform: 'linux',
        baseEnv: { HOME: '/home/user', PATH: '/usr/bin' },
        trustedPathDirs: ['/usr/bin'],
      });

      expect(result.env.HOME).toBe('/home/user');
    });

    it('should handle empty overrides object', () => {
      const result = buildSubprocessEnv(
        {},
        {
          platform: 'linux',
          baseEnv: { HOME: '/home/user', PATH: '/usr/bin' },
          trustedPathDirs: ['/usr/bin'],
        }
      );

      expect(result.env.HOME).toBe('/home/user');
    });
  });

  // =========================================================================
  // redactEnvForLogging + isSensitiveEnvVar
  // =========================================================================

  describe('redactEnvForLogging', () => {
    it('should redact sensitive variable values', () => {
      const env = {
        OPENAI_API_KEY: 'sk-abc123',
        HOME: '/home/user',
      };

      const redacted = redactEnvForLogging(env);

      expect(redacted.OPENAI_API_KEY).toBe('<redacted>');
      expect(redacted.HOME).toBe('/home/user');
    });

    it('should truncate long non-sensitive values', () => {
      const env = {
        LONG_VAR: 'A'.repeat(300),
      };

      const redacted = redactEnvForLogging(env);

      expect(redacted.LONG_VAR).toContain('...');
      expect(redacted.LONG_VAR).toContain('300 chars');
      expect(redacted.LONG_VAR.length).toBeLessThan(300);
    });

    it('should pass through short non-sensitive values unchanged', () => {
      const env = { MY_VAR: 'hello' };
      const redacted = redactEnvForLogging(env);

      expect(redacted.MY_VAR).toBe('hello');
    });
  });

  describe('isSensitiveEnvVar', () => {
    const exactSensitiveVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DAEMON_JWT_SECRET',
      'REDIS_PASSWORD',
      'REDIS_URL',
      'DATABASE_URL',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'GITHUB_TOKEN',
      'GITHUB_PAT',
      'SLACK_TOKEN',
      'SLACK_SIGNING_SECRET',
      'NEOLITH_API_KEY',
      'NEOLITH_API_SECRET',
      'WUNDR_API_KEY',
      'WUNDR_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SENDGRID_API_KEY',
      'TWILIO_AUTH_TOKEN',
      'SENTRY_DSN',
    ];

    it.each(exactSensitiveVars)(
      'should detect exact sensitive var: %s',
      varName => {
        expect(isSensitiveEnvVar(varName)).toBe(true);
      }
    );

    const patternSensitiveVars = [
      'MY_API_KEY',
      'CUSTOM_TOKEN',
      'APP_SECRET',
      'DB_PASSWORD',
      'MY_PASSWD',
      'SOME_CREDENTIAL',
      'SSH_PRIVATE_KEY',
      'CUSTOM_DSN',
      'DB_HOST',
    ];

    it.each(patternSensitiveVars)(
      'should detect pattern-matched sensitive var: %s',
      varName => {
        expect(isSensitiveEnvVar(varName)).toBe(true);
      }
    );

    it('should not flag non-sensitive variables', () => {
      expect(isSensitiveEnvVar('HOME')).toBe(false);
      expect(isSensitiveEnvVar('PATH')).toBe(false);
      expect(isSensitiveEnvVar('NODE_ENV')).toBe(false);
      expect(isSensitiveEnvVar('LANG')).toBe(false);
      expect(isSensitiveEnvVar('MY_APP_SETTING')).toBe(false);
    });
  });

  // =========================================================================
  // checkEnvForApproval
  // =========================================================================

  describe('checkEnvForApproval', () => {
    it('should approve safe environment', () => {
      const result = checkEnvForApproval(SAFE_ENV, makeConfig());

      expect(result.approved).toBe(true);
      expect(result.criticalCount).toBe(0);
    });

    it('should reject environment with dangerous variables', () => {
      const env = { ...SAFE_ENV, NODE_OPTIONS: '--evil' };
      const result = checkEnvForApproval(env, makeConfig());

      expect(result.approved).toBe(false);
      expect(result.criticalCount).toBeGreaterThan(0);
      expect(result.message).toContain('NODE_OPTIONS');
    });

    it('should reject environment with injection attempts', () => {
      const env = { ...SAFE_ENV, EVIL: '$(rm -rf /)' };
      const result = checkEnvForApproval(env, makeConfig());

      expect(result.approved).toBe(false);
      expect(result.criticalCount).toBeGreaterThan(0);
    });

    it('should approve with non-critical blocks (e.g., allowlist filtering)', () => {
      const env = { ...SAFE_ENV, EXTRA: 'val' };
      const result = checkEnvForApproval(
        env,
        makeConfig({ allowlist: ['__PLACEHOLDER__'] })
      );

      // The variable is blocked as not_in_allowlist (not critical)
      expect(result.approved).toBe(true);
      expect(result.blockedCount).toBeGreaterThan(0);
      expect(result.criticalCount).toBe(0);
    });

    it('should return meaningful message when vars are filtered', () => {
      const env = { ...SAFE_ENV, EXTRA: 'val' };
      const result = checkEnvForApproval(
        env,
        makeConfig({ allowlist: ['__PLACEHOLDER__'] })
      );

      expect(result.message).toContain('filtered');
    });

    it('should return clean message when all pass', () => {
      const result = checkEnvForApproval(SAFE_ENV, makeConfig());

      expect(result.message).toContain('passed');
    });
  });

  // =========================================================================
  // getDangerousVarList / getDangerousPrefixList
  // =========================================================================

  describe('getDangerousVarList', () => {
    it('should return a sorted array of dangerous variable names', () => {
      const vars = getDangerousVarList('linux');

      expect(Array.isArray(vars)).toBe(true);
      expect(vars.length).toBeGreaterThan(30);
      // Check sorted
      const sorted = [...vars].sort();
      expect(vars).toEqual(sorted);
    });

    it('should include platform-specific vars for linux', () => {
      const vars = getDangerousVarList('linux');

      expect(vars).toContain('LD_PRELOAD');
      expect(vars).toContain('NODE_OPTIONS');
    });

    it('should include platform-specific vars for darwin', () => {
      const vars = getDangerousVarList('darwin');

      expect(vars).toContain('DYLD_INSERT_LIBRARIES');
      expect(vars).toContain('NODE_OPTIONS');
    });
  });

  describe('getDangerousPrefixList', () => {
    it('should return LD_ prefix for linux', () => {
      const prefixes = getDangerousPrefixList('linux');

      expect(prefixes).toContain('LD_');
    });

    it('should return DYLD_ prefix for darwin', () => {
      const prefixes = getDangerousPrefixList('darwin');

      expect(prefixes).toContain('DYLD_');
    });

    it('should return both for unknown platforms', () => {
      const prefixes = getDangerousPrefixList('haiku' as NodeJS.Platform);

      expect(prefixes).toContain('LD_');
      expect(prefixes).toContain('DYLD_');
    });
  });

  // =========================================================================
  // EnvSecurityError
  // =========================================================================

  describe('EnvSecurityError', () => {
    it('should be an instance of Error', () => {
      const error = new EnvSecurityError('test', 'KEY', 'dangerous_variable');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EnvSecurityError);
    });

    it('should expose variableKey and blockReason', () => {
      const error = new EnvSecurityError(
        'message',
        'NODE_OPTIONS',
        'dangerous_variable'
      );

      expect(error.variableKey).toBe('NODE_OPTIONS');
      expect(error.blockReason).toBe('dangerous_variable');
      expect(error.name).toBe('EnvSecurityError');
      expect(error.message).toBe('message');
    });
  });

  // =========================================================================
  // _testing helpers (internal)
  // =========================================================================

  describe('_testing helpers', () => {
    describe('redactEnvValue', () => {
      it('should return *** for short values', () => {
        expect(_testing.redactEnvValue('short')).toBe('***');
      });

      it('should truncate medium values', () => {
        const result = _testing.redactEnvValue('medium-length-value-here');
        expect(result).toContain('...');
        expect(result).toContain('chars');
      });

      it('should truncate long values with head and tail', () => {
        const longVal = 'A'.repeat(100);
        const result = _testing.redactEnvValue(longVal);

        expect(result).toContain('100 chars');
        expect(result.startsWith('AAAAAA')).toBe(true);
        expect(result.endsWith('AAAA')).toBe(true);
      });
    });

    describe('isPathEntryTrusted', () => {
      it('should return true for exact match in trusted dirs', () => {
        expect(
          _testing.isPathEntryTrusted('/usr/bin', ['/usr/bin'], '/home/user')
        ).toBe(true);
      });

      it('should return false for untrusted path', () => {
        expect(
          _testing.isPathEntryTrusted('/evil', ['/usr/bin'], '/home/user')
        ).toBe(false);
      });

      it('should return true for home subdirectory', () => {
        expect(
          _testing.isPathEntryTrusted('/home/user/.local/bin', [], '/home/user')
        ).toBe(true);
      });

      it('should return true for Nix store paths', () => {
        expect(
          _testing.isPathEntryTrusted(
            '/nix/store/abc-pkg/bin',
            [],
            '/home/user'
          )
        ).toBe(true);
      });

      it('should return false for empty path', () => {
        expect(
          _testing.isPathEntryTrusted('', ['/usr/bin'], '/home/user')
        ).toBe(false);
      });

      it('should strip trailing slashes before matching', () => {
        expect(
          _testing.isPathEntryTrusted('/usr/bin/', ['/usr/bin'], '/home/user')
        ).toBe(true);
      });
    });

    describe('detectInjection', () => {
      it('should return null for clean values', () => {
        expect(_testing.detectInjection('KEY', 'clean-value')).toBeNull();
      });

      it('should detect command substitution', () => {
        const result = _testing.detectInjection('KEY', '$(whoami)');
        expect(result).not.toBeNull();
        expect(result).toContain('injection pattern');
      });

      it('should detect excessive length', () => {
        const result = _testing.detectInjection('KEY', 'X'.repeat(70_000));
        expect(result).not.toBeNull();
        expect(result).toContain('maximum length');
      });

      it('should detect control characters', () => {
        const result = _testing.detectInjection('KEY', 'abc\x01def');
        expect(result).not.toBeNull();
        expect(result).toContain('control characters');
      });

      it('should allow tab, newline, carriage return', () => {
        expect(
          _testing.detectInjection('KEY', 'line1\nline2\r\n\ttab')
        ).toBeNull();
      });
    });
  });
});
