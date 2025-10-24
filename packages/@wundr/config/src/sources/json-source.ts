/**
 * JSON configuration source
 */

import { FileConfigSource } from './file-source.js';

export class JsonConfigSource extends FileConfigSource {
  constructor(filePath: string, name?: string, priority = 50) {
    super(filePath, name || `json:${filePath}`, priority);
  }

  protected parseContent(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) || {};
    } catch (error) {
      throw new Error(
        `Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  protected stringifyContent(config: Record<string, unknown>): string {
    return JSON.stringify(config, null, 2);
  }
}
