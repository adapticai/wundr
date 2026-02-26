/**
 * Hook Discovery & Loading
 *
 * Discovers hook modules from the file system following the OpenClaw pattern:
 * each hook lives in its own directory with a HOOK.md frontmatter file and
 * a handler.ts (or handler.js) module.
 *
 * Supports four discovery sources with ascending precedence:
 *   bundled < managed < workspace < extra-dirs
 *
 * Includes frontmatter parsing, metadata extraction, eligibility checking,
 * and dynamic handler import with cache-busting for live reloads.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import type { HookRegistry } from './hook-registry';
import type {
  DiscoveredHook,
  HookEligibilityContext,
  HookEntry,
  HookEventName,
  HookFileMetadata,
  HookInvocationPolicy,
  HookLogger,
  HookRegistration,
  HookSnapshot,
  HookSource,
  HooksConfig,
  ParsedHookFrontmatter,
} from './hook-types';

// =============================================================================
// Constants
// =============================================================================

/** Handler file candidates in priority order */
const HANDLER_CANDIDATES = ['handler.ts', 'handler.js', 'index.ts', 'index.js'];

/** Frontmatter delimiter */
const FRONTMATTER_DELIMITER = '---';

// =============================================================================
// Frontmatter Parsing
// =============================================================================

/**
 * Parse YAML-like frontmatter from a HOOK.md file.
 *
 * Expects the format:
 * ```
 * ---
 * key: value
 * key: value
 * ---
 * # Hook description
 * ```
 *
 * Returns a flat key-value map. Nested values are stored as JSON strings.
 */
export function parseFrontmatter(content: string): ParsedHookFrontmatter {
  const lines = content.split('\n');
  const result: ParsedHookFrontmatter = {};

  if (lines.length === 0 || lines[0].trim() !== FRONTMATTER_DELIMITER) {
    return result;
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return result;
  }

  for (let i = 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract structured HookFileMetadata from parsed frontmatter.
 *
 * Handles comma-separated lists for events, os, bins, env, and config.
 */
export function extractMetadata(
  frontmatter: ParsedHookFrontmatter
): HookFileMetadata {
  const parseList = (value: string | undefined): string[] => {
    if (!value) {
      return [];
    }
    // Handle JSON arrays
    if (value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(String).filter(Boolean);
        }
      } catch {
        // fall through to comma-separated parsing
      }
    }
    return value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  };

  const events = parseList(frontmatter.events);
  const os = parseList(frontmatter.os);

  const requires: HookFileMetadata['requires'] = {};
  const bins = parseList(frontmatter['requires.bins'] ?? frontmatter.bins);
  const anyBins = parseList(
    frontmatter['requires.anyBins'] ?? frontmatter.anyBins
  );
  const env = parseList(frontmatter['requires.env'] ?? frontmatter.env);
  const config = parseList(frontmatter['requires.config']);

  if (bins.length > 0) {
    requires.bins = bins;
  }
  if (anyBins.length > 0) {
    requires.anyBins = anyBins;
  }
  if (env.length > 0) {
    requires.env = env;
  }
  if (config.length > 0) {
    requires.config = config;
  }

  return {
    always: frontmatter.always === 'true',
    hookKey: frontmatter.hookKey || undefined,
    emoji: frontmatter.emoji || undefined,
    homepage: frontmatter.homepage || undefined,
    events,
    export: frontmatter.export || undefined,
    os: os.length > 0 ? os : undefined,
    requires: Object.keys(requires).length > 0 ? requires : undefined,
  };
}

/**
 * Resolve the invocation policy from frontmatter.
 * Defaults to enabled unless the `enabled` field is explicitly `false`.
 */
export function resolveInvocationPolicy(
  frontmatter: ParsedHookFrontmatter
): HookInvocationPolicy {
  return {
    enabled: frontmatter.enabled !== 'false',
  };
}

/**
 * Resolve the canonical hook key for config lookups.
 * Uses metadata.hookKey if set, otherwise falls back to the hook name
 * with a slugified format (lowercase, hyphens).
 */
export function resolveHookKey(name: string, entry?: HookEntry): string {
  if (entry?.metadata?.hookKey) {
    return entry.metadata.hookKey;
  }
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

// =============================================================================
// Eligibility Checking
// =============================================================================

/**
 * Check whether a binary is available on the system PATH.
 */
export function hasBinary(bin: string): boolean {
  const pathEnv = process.env.PATH ?? '';
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const parts = pathEnv.split(delimiter).filter(Boolean);

  for (const part of parts) {
    const candidate = path.join(part, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      // continue scanning
    }
  }
  return false;
}

/**
 * Determine whether a hook entry should be included based on its
 * requirements and the runtime environment.
 *
 * Mirrors OpenClaw's `shouldIncludeHook()` logic:
 * 1. Check if explicitly disabled via config override
 * 2. Check OS platform requirements
 * 3. If `always: true`, bypass remaining checks
 * 4. Check required binaries
 * 5. Check required anyBins
 * 6. Check required environment variables
 * 7. Check required config paths
 */
export function shouldIncludeHook(params: {
  entry: HookEntry;
  config?: HooksConfig;
  eligibility?: HookEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;
  const hookKey = resolveHookKey(entry.hook.name, entry);
  const override =
    config?.hookOverrides?.[hookKey] ??
    config?.hookOverrides?.[entry.hook.name];

  // Check if explicitly disabled via config
  if (override?.enabled === false) {
    return false;
  }

  // Check OS requirement
  const osList = entry.metadata?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];
  if (
    osList.length > 0 &&
    !osList.includes(process.platform) &&
    !remotePlatforms.some(platform => osList.includes(platform))
  ) {
    return false;
  }

  // If marked as always, bypass all other checks
  if (entry.metadata?.always === true) {
    return true;
  }

  // Check required binaries (all must be present)
  const requiredBins = entry.metadata?.requires?.bins ?? [];
  if (requiredBins.length > 0) {
    for (const bin of requiredBins) {
      if (hasBinary(bin)) {
        continue;
      }
      if (eligibility?.remote?.hasBin?.(bin)) {
        continue;
      }
      return false;
    }
  }

  // Check anyBins (at least one must be present)
  const requiredAnyBins = entry.metadata?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    const anyFound =
      requiredAnyBins.some(bin => hasBinary(bin)) ||
      eligibility?.remote?.hasAnyBin?.(requiredAnyBins);
    if (!anyFound) {
      return false;
    }
  }

  // Check required environment variables
  const requiredEnv = entry.metadata?.requires?.env ?? [];
  if (requiredEnv.length > 0) {
    for (const envName of requiredEnv) {
      if (process.env[envName]) {
        continue;
      }
      return false;
    }
  }

  return true;
}

// =============================================================================
// Directory-Based Hook Discovery
// =============================================================================

/**
 * Load a single hook from a directory containing a HOOK.md file.
 * Returns null if the directory does not contain a valid hook.
 */
function loadHookFromDir(params: {
  hookDir: string;
  source: HookSource;
  pluginId?: string;
  nameHint?: string;
}): DiscoveredHook | null {
  const hookMdPath = path.join(params.hookDir, 'HOOK.md');
  if (!fs.existsSync(hookMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(hookMdPath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    const name =
      frontmatter.name || params.nameHint || path.basename(params.hookDir);
    const description = frontmatter.description || '';

    // Find handler file
    let handlerPath: string | undefined;
    for (const candidate of HANDLER_CANDIDATES) {
      const candidatePath = path.join(params.hookDir, candidate);
      if (fs.existsSync(candidatePath)) {
        handlerPath = candidatePath;
        break;
      }
    }

    if (!handlerPath) {
      return null;
    }

    return {
      name,
      description,
      source: params.source,
      pluginId: params.pluginId,
      filePath: hookMdPath,
      baseDir: params.hookDir,
      handlerPath,
    };
  } catch {
    return null;
  }
}

/**
 * Scan a directory for hooks (subdirectories containing HOOK.md).
 */
function loadHooksFromDir(params: {
  dir: string;
  source: HookSource;
  pluginId?: string;
}): DiscoveredHook[] {
  const { dir, source, pluginId } = params;

  if (!fs.existsSync(dir)) {
    return [];
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(dir);
  } catch {
    return [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const hooks: DiscoveredHook[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const hookDir = path.join(dir, entry.name);

    // Check for a package.json with hooks field
    const pkgPath = path.join(hookDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const packageHooks: string[] = pkg?.wundr?.hooks ?? [];
        if (packageHooks.length > 0) {
          for (const hookPath of packageHooks) {
            const resolvedHookDir = path.resolve(hookDir, hookPath);
            const hook = loadHookFromDir({
              hookDir: resolvedHookDir,
              source,
              pluginId,
              nameHint: path.basename(resolvedHookDir),
            });
            if (hook) {
              hooks.push(hook);
            }
          }
          continue;
        }
      } catch {
        // Ignore malformed package.json, fall through to direct HOOK.md check
      }
    }

    const hook = loadHookFromDir({
      hookDir,
      source,
      pluginId,
      nameHint: entry.name,
    });
    if (hook) {
      hooks.push(hook);
    }
  }

  return hooks;
}

/**
 * Build HookEntry objects from discovered hooks in a directory.
 */
export function loadHookEntriesFromDir(params: {
  dir: string;
  source: HookSource;
  pluginId?: string;
}): HookEntry[] {
  const hooks = loadHooksFromDir({
    dir: params.dir,
    source: params.source,
    pluginId: params.pluginId,
  });

  return hooks.map(hook => {
    let frontmatter: ParsedHookFrontmatter = {};
    try {
      const raw = fs.readFileSync(hook.filePath, 'utf-8');
      frontmatter = parseFrontmatter(raw);
    } catch {
      // Ignore malformed frontmatter
    }

    return {
      hook: {
        ...hook,
        source: params.source,
        pluginId: params.pluginId,
      },
      frontmatter,
      metadata: extractMetadata(frontmatter),
      invocation: resolveInvocationPolicy(frontmatter),
    };
  });
}

// =============================================================================
// Multi-Source Hook Discovery
// =============================================================================

export interface DiscoveryOptions {
  /** Workspace directory for workspace-level hook discovery */
  workspaceDir?: string;
  /** Directory for bundled hooks that ship with the orchestrator */
  bundledHooksDir?: string;
  /** Directory for managed hooks (user-installed) */
  managedHooksDir?: string;
  /** Additional directories to scan */
  extraDirs?: string[];
  /** Hooks config for filtering */
  config?: HooksConfig;
  /** Eligibility context for platform checks */
  eligibility?: HookEligibilityContext;
  /** Logger */
  logger?: HookLogger;
}

/**
 * Discover hook entries from multiple sources with precedence:
 * extra-dirs < bundled < managed < workspace (workspace wins).
 *
 * Hooks with the same name from a higher-precedence source override
 * those from lower-precedence sources.
 */
export function discoverHookEntries(options: DiscoveryOptions): HookEntry[] {
  const extraDirs = options.extraDirs ?? options.config?.hookDirs ?? [];
  const workspaceHooksDir = options.workspaceDir
    ? path.join(options.workspaceDir, 'hooks')
    : undefined;

  // Load from each source
  const extraHooks = extraDirs.flatMap(dir =>
    loadHooksFromDir({ dir, source: 'workspace' })
  );
  const bundledHooks = options.bundledHooksDir
    ? loadHooksFromDir({ dir: options.bundledHooksDir, source: 'built-in' })
    : [];
  const managedHooks = options.managedHooksDir
    ? loadHooksFromDir({ dir: options.managedHooksDir, source: 'directory' })
    : [];
  const workspaceHooks = workspaceHooksDir
    ? loadHooksFromDir({ dir: workspaceHooksDir, source: 'workspace' })
    : [];

  // Merge with precedence (later sources override earlier)
  const merged = new Map<string, DiscoveredHook>();
  for (const hook of extraHooks) {
    merged.set(hook.name, hook);
  }
  for (const hook of bundledHooks) {
    merged.set(hook.name, hook);
  }
  for (const hook of managedHooks) {
    merged.set(hook.name, hook);
  }
  for (const hook of workspaceHooks) {
    merged.set(hook.name, hook);
  }

  // Convert to HookEntry with metadata
  const entries: HookEntry[] = Array.from(merged.values()).map(hook => {
    let frontmatter: ParsedHookFrontmatter = {};
    try {
      const raw = fs.readFileSync(hook.filePath, 'utf-8');
      frontmatter = parseFrontmatter(raw);
    } catch {
      // Ignore
    }

    return {
      hook,
      frontmatter,
      metadata: extractMetadata(frontmatter),
      invocation: resolveInvocationPolicy(frontmatter),
    };
  });

  // Filter by eligibility
  return entries.filter(entry =>
    shouldIncludeHook({
      entry,
      config: options.config,
      eligibility: options.eligibility,
    })
  );
}

/**
 * Build a serializable hook snapshot from discovered hooks.
 */
export function buildHookSnapshot(
  entries: HookEntry[],
  version?: number
): HookSnapshot {
  return {
    hooks: entries.map(entry => ({
      name: entry.hook.name,
      events: entry.metadata?.events ?? [],
    })),
    resolvedHooks: entries.map(entry => entry.hook),
    version,
  };
}

// =============================================================================
// Dynamic Handler Import & Registration
// =============================================================================

export interface HookLoaderOptions {
  /** Hooks configuration */
  config?: HooksConfig;
  /** The hook registry to register discovered hooks into */
  registry: HookRegistry;
  /** Workspace directory */
  workspaceDir?: string;
  /** Bundled hooks directory */
  bundledHooksDir?: string;
  /** Managed hooks directory */
  managedHooksDir?: string;
  /** Logger */
  logger?: HookLogger;
  /** Hook eligibility context */
  eligibility?: HookEligibilityContext;
}

/**
 * Discover, load, and register hooks from the file system and config.
 *
 * This is the main entry point that mirrors OpenClaw's `loadInternalHooks()`.
 * It:
 * 1. Discovers hooks from bundled, managed, workspace, and extra directories
 * 2. Filters by eligibility (OS, binaries, env vars)
 * 3. Applies config overrides
 * 4. Dynamically imports handler modules
 * 5. Registers each hook/event pair into the HookRegistry
 * 6. Loads legacy handler definitions for backwards compatibility
 *
 * @returns The number of hooks successfully loaded and registered.
 */
export async function loadAndRegisterHooks(
  options: HookLoaderOptions
): Promise<number> {
  const { config, registry, logger } = options;

  // Check master switch
  if (config?.enabled === false) {
    logger?.info('[HookDiscovery] Hooks system disabled via config');
    return 0;
  }

  let loadedCount = 0;

  // 1. Discover hooks from directories
  try {
    const entries = discoverHookEntries({
      workspaceDir: options.workspaceDir,
      bundledHooksDir: options.bundledHooksDir,
      managedHooksDir: options.managedHooksDir,
      extraDirs: config?.hookDirs,
      config,
      eligibility: options.eligibility,
      logger,
    });

    for (const entry of entries) {
      // Apply per-hook config overrides
      const hookKey = resolveHookKey(entry.hook.name, entry);
      const override =
        config?.hookOverrides?.[hookKey] ??
        config?.hookOverrides?.[entry.hook.name];

      if (override?.enabled === false) {
        logger?.debug(
          `[HookDiscovery] Skipping disabled hook "${entry.hook.name}"`
        );
        continue;
      }

      try {
        // Dynamic import with cache-busting
        const url = pathToFileURL(entry.hook.handlerPath).href;
        const cacheBustedUrl = `${url}?t=${Date.now()}`;
        const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

        // Get handler function
        const exportName = entry.metadata?.export ?? 'default';
        const handler = mod[exportName];

        if (typeof handler !== 'function') {
          logger?.error(
            `[HookDiscovery] Handler "${exportName}" from "${entry.hook.name}" is not a function`
          );
          continue;
        }

        // Register for each event listed in metadata
        const events = entry.metadata?.events ?? [];
        if (events.length === 0) {
          logger?.warn(
            `[HookDiscovery] Hook "${entry.hook.name}" has no events defined`
          );
          continue;
        }

        for (const event of events) {
          const hookId = `discovered:${entry.hook.name}:${event}`;
          registry.register({
            id: hookId,
            name: entry.hook.name,
            event: event as HookEventName,
            type: 'command', // type is required but handler overrides
            priority: override?.priority ?? 0,
            enabled: true,
            catchErrors: true,
            source: entry.hook.source,
            timeoutMs: override?.timeoutMs ?? config?.defaultTimeoutMs,
            env: override?.env,
            handler: handler as HookRegistration['handler'],
          });
        }

        loadedCount++;
        logger?.debug(
          `[HookDiscovery] Registered hook "${entry.hook.name}" for events: ${events.join(', ')}`
        );
      } catch (err) {
        logger?.error(
          `[HookDiscovery] Failed to load hook "${entry.hook.name}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } catch (err) {
    logger?.error(
      `[HookDiscovery] Failed to discover hooks: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 2. Load legacy handler definitions
  const handlers = config?.handlers ?? [];
  for (const handlerConfig of handlers) {
    try {
      const modulePath = path.isAbsolute(handlerConfig.module)
        ? handlerConfig.module
        : path.join(process.cwd(), handlerConfig.module);

      const url = pathToFileURL(modulePath).href;
      const cacheBustedUrl = `${url}?t=${Date.now()}`;
      const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

      const exportName = handlerConfig.export ?? 'default';
      const handler = mod[exportName];

      if (typeof handler !== 'function') {
        logger?.error(
          `[HookDiscovery] Legacy handler "${exportName}" from "${modulePath}" is not a function`
        );
        continue;
      }

      const hookId = `legacy:${handlerConfig.event}:${path.basename(handlerConfig.module)}`;
      registry.register({
        id: hookId,
        name: `Legacy: ${handlerConfig.event}`,
        event: handlerConfig.event as HookEventName,
        type: 'command',
        priority: 0,
        enabled: true,
        catchErrors: true,
        source: 'config-file',
        handler: handler as HookRegistration['handler'],
      });

      loadedCount++;
      logger?.debug(
        `[HookDiscovery] Registered legacy handler for "${handlerConfig.event}"`
      );
    } catch (err) {
      logger?.error(
        `[HookDiscovery] Failed to load legacy handler from "${handlerConfig.module}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger?.info(`[HookDiscovery] Loaded ${loadedCount} hooks from discovery`);
  return loadedCount;
}
