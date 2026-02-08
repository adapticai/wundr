/**
 * Plugin Manifest Validation
 *
 * Defines Zod schemas for the wundr-plugin.json manifest format that every
 * plugin must provide. The manifest declares the plugin's identity, required
 * permissions, entry point, integrity hash, and dependency graph.
 *
 * Validation happens at install time and again at load time to catch tampering.
 */

import { z } from 'zod';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Trust Levels
// ---------------------------------------------------------------------------

/**
 * Trust levels determine which sandbox tier a plugin runs in:
 *   trusted    - in-process (first-party only)
 *   verified   - VM context sandbox
 *   community  - worker thread sandbox
 *   untrusted  - Docker container sandbox
 */
export const PluginTrustLevel = z.enum([
  'trusted',
  'verified',
  'community',
  'untrusted',
]);
export type PluginTrustLevel = z.infer<typeof PluginTrustLevel>;

// ---------------------------------------------------------------------------
// Permission Schemas
// ---------------------------------------------------------------------------

export const FilesystemPermissions = z.object({
  /** Glob patterns for readable paths (relative to plugin root or cwd). */
  read: z.array(z.string()).default([]),
  /** Glob patterns for writable paths (relative to plugin root or cwd). */
  write: z.array(z.string()).default([]),
});
export type FilesystemPermissions = z.infer<typeof FilesystemPermissions>;

export const NetworkPermissions = z.object({
  /** Hostnames the plugin is allowed to connect to. */
  hosts: z.array(z.string()).default([]),
  /** TCP ports the plugin is allowed to connect to. */
  ports: z.array(z.number().int().min(1).max(65535)).default([]),
});
export type NetworkPermissions = z.infer<typeof NetworkPermissions>;

export const ProcessPermissions = z.object({
  /** Executable names the plugin is allowed to spawn. */
  allowed: z.array(z.string()).default([]),
});
export type ProcessPermissions = z.infer<typeof ProcessPermissions>;

export const EnvPermissions = z.object({
  /** Environment variable names the plugin can read. */
  read: z.array(z.string()).default([]),
  /** Environment variable names the plugin can set. */
  write: z.array(z.string()).default([]),
});
export type EnvPermissions = z.infer<typeof EnvPermissions>;

export const McpToolPermissions = z.object({
  /** Tool name patterns the plugin is allowed to use/register. */
  allow: z.array(z.string()).default([]),
  /** Tool name patterns the plugin is explicitly denied. */
  deny: z.array(z.string()).default([]),
});
export type McpToolPermissions = z.infer<typeof McpToolPermissions>;

export const PluginPermissions = z.object({
  filesystem: FilesystemPermissions.default({}),
  network: NetworkPermissions.default({}),
  process: ProcessPermissions.default({}),
  env: EnvPermissions.default({}),
  mcpTools: McpToolPermissions.default({}),
});
export type PluginPermissions = z.infer<typeof PluginPermissions>;

// ---------------------------------------------------------------------------
// Dependency Schema
// ---------------------------------------------------------------------------

export const PluginDependencies = z.object({
  /** Other plugin names that must be loaded before this one. */
  plugins: z.array(z.string()).default([]),
  /** Runtime version constraints (e.g. { node: ">=18.0.0" }). */
  runtime: z.record(z.string(), z.string()).default({}),
});
export type PluginDependencies = z.infer<typeof PluginDependencies>;

// ---------------------------------------------------------------------------
// Main Manifest Schema
// ---------------------------------------------------------------------------

export const PluginManifestSchema = z.object({
  /** Unique plugin identifier, typically a scoped npm name. */
  name: z
    .string()
    .min(1)
    .max(214)
    .regex(
      /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/,
      'Plugin name must be a valid npm package name',
    ),

  /** Semver version string. */
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Version must be valid semver'),

  /** Human-readable description. */
  description: z.string().max(500).optional(),

  /** Semver range of compatible wundr versions. */
  wundrVersion: z.string().default('>=1.0.0'),

  /** Declared trust level. System policy may override to a lower level. */
  trustLevel: PluginTrustLevel.default('community'),

  /** Permissions the plugin requires. */
  permissions: PluginPermissions.default({}),

  /** Relative path to the entry point JS file. */
  entryPoint: z.string().default('dist/index.js'),

  /**
   * Subresource integrity hash (SRI format) of the entry point file.
   * Used to detect tampering between install and load.
   * Format: "sha384-<base64>"
   */
  integrity: z.string().optional(),

  /** Plugin dependencies. */
  dependencies: PluginDependencies.default({}),

  /** Author name or object. */
  author: z.union([z.string(), z.object({ name: z.string(), email: z.string().optional() })]).optional(),

  /** SPDX license identifier. */
  license: z.string().optional(),

  /** Repository URL. */
  repository: z.string().url().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ---------------------------------------------------------------------------
// Validation Results
// ---------------------------------------------------------------------------

export type ManifestValidationResult = {
  valid: boolean;
  manifest?: PluginManifest;
  errors: ManifestValidationError[];
  warnings: string[];
};

export type ManifestValidationError = {
  path: string;
  message: string;
  code: string;
};

// ---------------------------------------------------------------------------
// System Policy (administrator-configured limits on plugin permissions)
// ---------------------------------------------------------------------------

export type SystemPluginPolicy = {
  /** Maximum trust level any plugin can have. */
  maxTrustLevel: PluginTrustLevel;
  /** Filesystem paths that NO plugin may access. */
  deniedPaths: string[];
  /** Network hosts that NO plugin may connect to. */
  deniedHosts: string[];
  /** Process names that NO plugin may spawn. */
  deniedProcesses: string[];
  /** Environment variables that NO plugin may read. */
  deniedEnvVars: string[];
  /** MCP tools that NO plugin may register or use. */
  deniedMcpTools: string[];
  /** Whether to require integrity hashes on all plugins. */
  requireIntegrity: boolean;
  /** Whether to allow untrusted plugins at all. */
  allowUntrusted: boolean;
};

export const DEFAULT_SYSTEM_POLICY: SystemPluginPolicy = {
  maxTrustLevel: 'community',
  deniedPaths: ['/etc', '/sys', '/proc', '/dev', '/boot', '/root'],
  deniedHosts: [],
  deniedProcesses: ['rm', 'dd', 'mkfs', 'fdisk', 'mount', 'umount', 'shutdown', 'reboot'],
  deniedEnvVars: [],
  deniedMcpTools: [],
  requireIntegrity: false,
  allowUntrusted: false,
};

// ---------------------------------------------------------------------------
// Trust Level Ordering
// ---------------------------------------------------------------------------

const TRUST_LEVEL_ORDER: Record<PluginTrustLevel, number> = {
  untrusted: 0,
  community: 1,
  verified: 2,
  trusted: 3,
};

export function compareTrustLevels(a: PluginTrustLevel, b: PluginTrustLevel): number {
  return TRUST_LEVEL_ORDER[a] - TRUST_LEVEL_ORDER[b];
}

export function effectiveTrustLevel(
  declared: PluginTrustLevel,
  maxAllowed: PluginTrustLevel,
): PluginTrustLevel {
  if (TRUST_LEVEL_ORDER[declared] > TRUST_LEVEL_ORDER[maxAllowed]) {
    return maxAllowed;
  }
  return declared;
}

// ---------------------------------------------------------------------------
// Manifest Validation
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw manifest object against the Zod schema,
 * then cross-check permissions against the system policy.
 */
export function validateManifest(
  raw: unknown,
  systemPolicy: SystemPluginPolicy = DEFAULT_SYSTEM_POLICY,
): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  const warnings: string[] = [];

  // Step 1: Schema validation
  const parsed = PluginManifestSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      });
    }
    return { valid: false, errors, warnings };
  }

  const manifest = parsed.data;

  // Step 2: Trust level enforcement
  const effective = effectiveTrustLevel(manifest.trustLevel, systemPolicy.maxTrustLevel);
  if (effective !== manifest.trustLevel) {
    warnings.push(
      `Trust level downgraded from "${manifest.trustLevel}" to "${effective}" by system policy`,
    );
    manifest.trustLevel = effective;
  }

  if (manifest.trustLevel === 'untrusted' && !systemPolicy.allowUntrusted) {
    errors.push({
      path: 'trustLevel',
      message: 'Untrusted plugins are not allowed by system policy',
      code: 'policy_violation',
    });
  }

  // Step 3: Integrity requirement
  if (systemPolicy.requireIntegrity && !manifest.integrity) {
    errors.push({
      path: 'integrity',
      message: 'System policy requires an integrity hash for all plugins',
      code: 'policy_violation',
    });
  }

  // Step 4: Filesystem permission checks
  for (const readPath of manifest.permissions.filesystem.read) {
    for (const denied of systemPolicy.deniedPaths) {
      if (readPath.startsWith(denied)) {
        errors.push({
          path: 'permissions.filesystem.read',
          message: `Read access to "${readPath}" is denied by system policy (blocked prefix: ${denied})`,
          code: 'policy_violation',
        });
      }
    }
  }
  for (const writePath of manifest.permissions.filesystem.write) {
    for (const denied of systemPolicy.deniedPaths) {
      if (writePath.startsWith(denied)) {
        errors.push({
          path: 'permissions.filesystem.write',
          message: `Write access to "${writePath}" is denied by system policy (blocked prefix: ${denied})`,
          code: 'policy_violation',
        });
      }
    }
  }

  // Step 5: Network permission checks
  for (const host of manifest.permissions.network.hosts) {
    for (const denied of systemPolicy.deniedHosts) {
      if (host === denied || host.endsWith(`.${denied}`)) {
        errors.push({
          path: 'permissions.network.hosts',
          message: `Network access to "${host}" is denied by system policy`,
          code: 'policy_violation',
        });
      }
    }
  }

  // Step 6: Process permission checks
  for (const proc of manifest.permissions.process.allowed) {
    if (systemPolicy.deniedProcesses.includes(proc)) {
      errors.push({
        path: 'permissions.process.allowed',
        message: `Process execution of "${proc}" is denied by system policy`,
        code: 'policy_violation',
      });
    }
  }

  // Step 7: Env permission checks
  for (const envVar of manifest.permissions.env.read) {
    if (systemPolicy.deniedEnvVars.includes(envVar)) {
      errors.push({
        path: 'permissions.env.read',
        message: `Reading env var "${envVar}" is denied by system policy`,
        code: 'policy_violation',
      });
    }
  }

  // Step 8: MCP tool permission checks
  for (const tool of manifest.permissions.mcpTools.allow) {
    if (systemPolicy.deniedMcpTools.includes(tool)) {
      errors.push({
        path: 'permissions.mcpTools.allow',
        message: `MCP tool "${tool}" is denied by system policy`,
        code: 'policy_violation',
      });
    }
  }

  return {
    valid: errors.length === 0,
    manifest,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Manifest File Loading
// ---------------------------------------------------------------------------

const MANIFEST_FILENAME = 'wundr-plugin.json';

/**
 * Read and validate a plugin manifest from the filesystem.
 */
export async function loadManifest(
  pluginDir: string,
  systemPolicy?: SystemPluginPolicy,
): Promise<ManifestValidationResult> {
  const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);

  let raw: unknown;
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    raw = JSON.parse(content);
  } catch (err) {
    const message =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `Manifest file not found: ${manifestPath}`
        : `Failed to read manifest: ${err instanceof Error ? err.message : String(err)}`;
    return {
      valid: false,
      errors: [{ path: '', message, code: 'manifest_read_error' }],
      warnings: [],
    };
  }

  return validateManifest(raw, systemPolicy);
}

// ---------------------------------------------------------------------------
// Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Compute an SRI hash for a file. Returns format: "sha384-<base64>".
 */
export async function computeFileIntegrity(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

/**
 * Verify the integrity hash of a plugin's entry point.
 */
export async function verifyPluginIntegrity(
  pluginDir: string,
  manifest: PluginManifest,
): Promise<{ valid: boolean; expected?: string; actual?: string }> {
  if (!manifest.integrity) {
    return { valid: true }; // No integrity constraint declared
  }

  const entryPath = path.join(pluginDir, manifest.entryPoint);
  let actual: string;
  try {
    actual = await computeFileIntegrity(entryPath);
  } catch {
    return { valid: false, expected: manifest.integrity, actual: undefined };
  }

  return {
    valid: actual === manifest.integrity,
    expected: manifest.integrity,
    actual,
  };
}
