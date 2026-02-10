/**
 * Skill Watcher
 *
 * Hot-reload support for SKILL.md files using Node's native fs.watch.
 * Watches all skill discovery directories and emits events when files
 * are added, changed, or removed. Debounces rapid changes to avoid
 * redundant reloads.
 *
 * @module skills/skill-watcher
 */

import * as fs from 'fs';
import * as path from 'path';

import { resolveDiscoveryDirs, clearParseCache } from './skill-loader';

import type {
  SkillFileEvent,
  SkillSource,
  SkillsConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 250;
const SKILL_FILENAME = 'SKILL.md';
const SKILL_EXTENSION = '.md';

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

/**
 * Callback invoked when a skill file changes.
 */
export type SkillChangeCallback = (event: SkillFileEvent) => void;

/**
 * Watches skill directories for changes and triggers reload callbacks.
 *
 * Usage:
 * ```typescript
 * const watcher = new SkillWatcher({
 *   workspaceDir: '/path/to/project',
 *   config: { load: { watch: true, watchDebounceMs: 300 } },
 * });
 *
 * watcher.onChange((event) => {
 *   console.log('Skill changed:', event);
 *   registry.load(); // Re-load skills
 * });
 *
 * watcher.start();
 *
 * // Later:
 * watcher.stop();
 * ```
 */
export class SkillWatcher {
  private workspaceDir: string;
  private config?: SkillsConfig;
  private managedSkillsDir?: string;
  private bundledSkillsDir?: string;
  private debounceMs: number;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private callbacks: SkillChangeCallback[] = [];
  private running = false;

  constructor(opts: {
    workspaceDir: string;
    config?: SkillsConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
  }) {
    this.workspaceDir = opts.workspaceDir;
    this.config = opts.config;
    this.managedSkillsDir = opts.managedSkillsDir;
    this.bundledSkillsDir = opts.bundledSkillsDir;
    this.debounceMs = opts.config?.load?.watchDebounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  /**
   * Register a callback for skill file change events.
   * Returns an unsubscribe function.
   */
  onChange(callback: SkillChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const idx = this.callbacks.indexOf(callback);
      if (idx >= 0) {
this.callbacks.splice(idx, 1);
}
    };
  }

  /**
   * Start watching all skill discovery directories.
   */
  start(): void {
    if (this.running) {
return;
}
    this.running = true;

    const dirs = resolveDiscoveryDirs(
      this.workspaceDir,
      this.config,
      this.managedSkillsDir,
      this.bundledSkillsDir,
    );

    for (const { dir, source } of dirs) {
      this.watchDirectory(dir, source);
    }
  }

  /**
   * Stop all file watchers and clean up timers.
   */
  stop(): void {
    this.running = false;

    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors
      }
    }
    this.watchers = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Whether the watcher is currently active.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Update the workspace directory and restart watchers.
   */
  setWorkspaceDir(workspaceDir: string): void {
    const wasRunning = this.running;
    if (wasRunning) {
this.stop();
}
    this.workspaceDir = workspaceDir;
    if (wasRunning) {
this.start();
}
  }

  /**
   * Update the configuration and restart watchers.
   */
  updateConfig(config: SkillsConfig): void {
    const wasRunning = this.running;
    if (wasRunning) {
this.stop();
}
    this.config = config;
    this.debounceMs = config.load?.watchDebounceMs ?? DEFAULT_DEBOUNCE_MS;
    if (wasRunning) {
this.start();
}
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private watchDirectory(dir: string, _source: SkillSource): void {
    if (!fs.existsSync(dir)) {
return;
}

    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) {
return;
}
        if (!this.isSkillFile(filename)) {
return;
}

        const fullPath = path.join(dir, filename);
        this.handleChange(fullPath, eventType);
      });

      watcher.on('error', (err) => {
        console.warn(`[SkillWatcher] Error watching ${dir}:`, err);
      });

      this.watchers.push(watcher);
    } catch (err) {
      // Directory may not exist or be unwatchable
      console.warn(`[SkillWatcher] Cannot watch ${dir}:`, err);
    }
  }

  private isSkillFile(filename: string): boolean {
    const base = path.basename(filename);
    return base === SKILL_FILENAME || (base.endsWith(SKILL_EXTENSION) && base !== 'README.md');
  }

  private handleChange(filePath: string, eventType: string): void {
    // Debounce rapid changes to the same file
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);

      // Invalidate the parse cache for this file
      clearParseCache();

      // Determine event type
      let type: SkillFileEvent['type'];
      if (eventType === 'rename') {
        type = fs.existsSync(filePath) ? 'add' : 'unlink';
      } else {
        type = 'change';
      }

      // Try to determine skill name from path
      const skillName = this.extractSkillName(filePath);

      const event: SkillFileEvent = {
        type,
        filePath,
        skillName,
      };

      this.emit(event);
    }, this.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private extractSkillName(filePath: string): string | undefined {
    const basename = path.basename(filePath);
    if (basename === SKILL_FILENAME) {
      // Nested layout: use parent directory name
      return path.basename(path.dirname(filePath));
    }
    if (basename.endsWith(SKILL_EXTENSION)) {
      // Flat layout: use filename without extension
      return path.basename(basename, SKILL_EXTENSION);
    }
    return undefined;
  }

  private emit(event: SkillFileEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (err) {
        console.warn('[SkillWatcher] Callback error:', err);
      }
    }
  }
}
