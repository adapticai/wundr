/**
 * YAML configuration source
 */

import YAML from 'yaml';

import { FileConfigSource } from './file-source.js';

export class YamlConfigSource extends FileConfigSource {
  constructor(filePath: string, name?: string, priority = 50) {
    super(filePath, name || `yaml:${filePath}`, priority);
  }

  protected parseContent(content: string): Record<string, unknown> {
    try {
      return YAML.parse(content) || {};
    } catch (error) {
      throw new Error(
        `Invalid YAML in configuration file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  protected stringifyContent(config: Record<string, unknown>): string {
    return YAML.stringify(config, {
      indent: 2,
      lineWidth: 120,
      minContentWidth: 20,
    });
  }
}
