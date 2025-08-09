#!/usr/bin/env node
/**
 * File Header Standardization Script
 * 
 * This script adds consistent headers to all script files in the repository
 * to improve documentation and maintainability.
 * 
 * @author Monorepo Refactoring Toolkit
 * @version 1.0.0
 * @since 2024-01-01
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface FileHeaderConfig {
  pattern: string;
  header: string;
  skipPatterns?: string[];
}

class FileHeaderManager {
  private configs: FileHeaderConfig[] = [
    {
      pattern: '**/*.ts',
      header: `/**
 * {{filename}}
 * 
 * {{description}}
 * 
 * @author Monorepo Refactoring Toolkit
 * @version 1.0.0
 * @since {{date}}
 * @license MIT
 */`,
      skipPatterns: ['**/*.d.ts', '**/node_modules/**']
    },
    {
      pattern: '**/*.js',
      header: `/**
 * {{filename}}
 * 
 * {{description}}
 * 
 * @author Monorepo Refactoring Toolkit
 * @version 1.0.0
 * @since {{date}}
 * @license MIT
 */`,
      skipPatterns: ['**/node_modules/**']
    },
    {
      pattern: '**/*.sh',
      header: `#!/bin/bash
#
# {{filename}}
# 
# {{description}}
# 
# Author: Monorepo Refactoring Toolkit
# Version: 1.0.0
# Since: {{date}}
# License: MIT
#`,
      skipPatterns: ['**/node_modules/**', '**/.git/**']
    }
  ];

  async addHeaders(): Promise<void> {
    console.log('📝 Adding file headers...');

    for (const config of this.configs) {
      const files = await glob(config.pattern, {
        ignore: config.skipPatterns || []
      });

      for (const file of files) {
        await this.processFile(file, config);
      }
    }

    console.log('✅ File headers added successfully');
  }

  private async processFile(filePath: string, config: FileHeaderConfig): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Skip if header already exists
      if (this.hasHeader(content, config)) {
        return;
      }

      const header = this.generateHeader(filePath, config);
      const newContent = this.insertHeader(content, header, config);

      await fs.promises.writeFile(filePath, newContent);
      console.log(`✓ Added header to ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, (error as Error).message);
    }
  }

  private hasHeader(content: string, config: FileHeaderConfig): boolean {
    const lines = content.split('\n');
    
    // Check if file already has a proper header
    if (config.pattern.endsWith('.sh')) {
      return lines[0].startsWith('#!') && 
             lines.slice(1, 10).some(line => line.includes('Author:') || line.includes('@author'));
    } else {
      return lines.slice(0, 10).some(line => 
        line.includes('@author') || line.includes('Monorepo Refactoring Toolkit')
      );
    }
  }

  private generateHeader(filePath: string, config: FileHeaderConfig): string {
    const filename = path.basename(filePath);
    const description = this.generateDescription(filePath);
    const date = new Date().toISOString().split('T')[0];

    return config.header
      .replace(/\{\{filename\}\}/g, filename)
      .replace(/\{\{description\}\}/g, description)
      .replace(/\{\{date\}\}/g, date);
  }

  private generateDescription(filePath: string): string {
    const filename = path.basename(filePath);
    const dir = path.dirname(filePath);

    // Generate contextual descriptions based on file location
    if (dir.includes('scripts/analysis')) {
      return 'Code analysis and duplicate detection functionality.';
    } else if (dir.includes('scripts/consolidation')) {
      return 'Code consolidation and refactoring utilities.';
    } else if (dir.includes('scripts/governance')) {
      return 'Code governance and quality enforcement tools.';
    } else if (dir.includes('scripts/testing')) {
      return 'Testing utilities and baseline management.';
    } else if (dir.includes('scripts/monorepo')) {
      return 'Monorepo setup and management scripts.';
    } else if (dir.includes('tools/dashboard')) {
      return 'Analysis dashboard and visualization tools.';
    } else if (dir.includes('config')) {
      return 'Configuration management and settings.';
    } else if (filename.includes('test') || filename.includes('spec')) {
      return 'Test cases and specifications.';
    } else {
      return 'Part of the monorepo refactoring toolkit.';
    }
  }

  private insertHeader(content: string, header: string, config: FileHeaderConfig): string {
    const lines = content.split('\n');
    
    if (config.pattern.endsWith('.sh')) {
      // For shell scripts, preserve shebang and insert header after
      if (lines[0].startsWith('#!')) {
        return [lines[0], '', header, '', ...lines.slice(1)].join('\n');
      } else {
        return [header, '', ...lines].join('\n');
      }
    } else if (config.pattern.endsWith('.ts') && lines[0].startsWith('#!')) {
      // For TypeScript files with shebang
      return [lines[0], '', header, '', ...lines.slice(1)].join('\n');
    } else {
      // For other files, insert header at the beginning
      return [header, '', ...lines].join('\n');
    }
  }
}

// CLI execution
if (require.main === module) {
  const headerManager = new FileHeaderManager();
  
  headerManager.addHeaders()
    .then(() => {
      console.log('🎉 File header standardization complete!');
    })
    .catch(error => {
      console.error('❌ Header standardization failed:', error);
      process.exit(1);
    });
}

export { FileHeaderManager };