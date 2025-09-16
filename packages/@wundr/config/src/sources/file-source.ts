/**
 * File-based configuration source
 */

import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import { ConfigSource } from '../types/index.js';
import { getLogger } from '@wundr.io/core';

const logger = getLogger();

export abstract class FileConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;
  protected readonly filePath: string;
  private watcher?: ReturnType<typeof watch>;

  constructor(filePath: string, name?: string, priority = 50) {
    this.filePath = path.resolve(filePath);
    this.name = name || `file:${path.basename(filePath)}`;
    this.priority = priority;
  }

  async load(): Promise<Record<string, any>> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug(`Configuration file not found: ${this.filePath}`);
        return {};
      }
      
      logger.error(`Failed to load configuration from ${this.filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }

  async save(config: Record<string, any>): Promise<void> {
    try {
      const content = this.stringifyContent(config);
      const dir = path.dirname(this.filePath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      // Write to temporary file first, then rename for atomicity
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, this.filePath);
      
      logger.debug(`Configuration saved to ${this.filePath}`);
    } catch (error) {
      logger.error(`Failed to save configuration to ${this.filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }

  watch(callback: (config: Record<string, any>) => void): () => void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(this.filePath, { persistent: false }, async (eventType) => {
      if (eventType === 'change') {
        try {
          const config = await this.load();
          callback(config);
        } catch (error) {
          logger.warn(`Failed to reload configuration from ${this.filePath}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    logger.debug(`Watching configuration file: ${this.filePath}`);

    return () => {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = undefined;
        logger.debug(`Stopped watching configuration file: ${this.filePath}`);
      }
    };
  }

  protected abstract parseContent(content: string): Record<string, any>;
  protected abstract stringifyContent(config: Record<string, any>): string;
}