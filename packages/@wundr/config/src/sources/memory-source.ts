/**
 * In-memory configuration source
 */

import { ConfigSource } from '../types/index.js';
import { deepClone } from '@wundr/core';

export class MemoryConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;
  private config: Record<string, any>;
  private watchCallbacks: Array<(config: Record<string, any>) => void> = [];

  constructor(initialConfig: Record<string, any> = {}, name = 'memory', priority = 0) {
    this.name = name;
    this.priority = priority;
    this.config = deepClone(initialConfig);
  }

  load(): Record<string, any> {
    return deepClone(this.config);
  }

  save(config: Record<string, any>): void {
    this.config = deepClone(config);
    this.notifyWatchers();
  }

  watch(callback: (config: Record<string, any>) => void): () => void {
    this.watchCallbacks.push(callback);

    return () => {
      const index = this.watchCallbacks.indexOf(callback);
      if (index !== -1) {
        this.watchCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update the configuration and notify watchers
   */
  update(updates: Record<string, any>): void {
    this.config = { ...this.config, ...deepClone(updates) };
    this.notifyWatchers();
  }

  /**
   * Clear all configuration
   */
  clear(): void {
    this.config = {};
    this.notifyWatchers();
  }

  /**
   * Get a copy of the current configuration
   */
  getConfig(): Record<string, any> {
    return deepClone(this.config);
  }

  private notifyWatchers(): void {
    const config = this.load();
    for (const callback of this.watchCallbacks) {
      try {
        callback(config);
      } catch (error) {
        // Log error but don't stop other watchers
        console.error('Error in config watcher:', error);
      }
    }
  }
}