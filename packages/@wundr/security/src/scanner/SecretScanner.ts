import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

import { logger } from '../utils/logger';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export interface SecretMatch {
  pattern: SecretPattern;
  match: string;
  file: string;
  line: number;
  column: number;
  context: string;
  confidence: number;
}

export interface ScanOptions {
  patterns?: SecretPattern[];
  excludePaths?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
  followSymlinks?: boolean;
  scanBinary?: boolean;
}

export interface ScanResult {
  matches: SecretMatch[];
  filesScanned: number;
  filesSkipped: number;
  scanDuration: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export class SecretScanner extends EventEmitter {
  private static readonly DEFAULT_PATTERNS: SecretPattern[] = [
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      description: 'AWS Access Key ID',
      severity: 'critical',
      category: 'cloud'
    },
    {
      name: 'AWS Secret Key',
      pattern: /MY_AWS_SECRET_ACCESS_KEY\s*=\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
      description: 'AWS Secret Access Key',
      severity: 'critical',
      category: 'cloud'
    },
    {
      name: 'GitHub Token',
      pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
      description: 'GitHub Personal Access Token',
      severity: 'high',
      category: 'vcs'
    },
    {
      name: 'Generic API Key',
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
      description: 'Generic API Key',
      severity: 'medium',
      category: 'api'
    },
    {
      name: 'JWT Token',
      pattern: /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
      description: 'JSON Web Token',
      severity: 'medium',
      category: 'auth'
    },
    {
      name: 'Private Key',
      pattern: /-----BEGIN\s+(?:RSA\s+|DSA\s+|EC\s+)?PRIVATE\s+KEY-----/gi,
      description: 'Private Key',
      severity: 'critical',
      category: 'crypto'
    },
    {
      name: 'Database Connection String',
      pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^\s\n\r]+/gi,
      description: 'Database Connection String',
      severity: 'high',
      category: 'database'
    },
    {
      name: 'Slack Token',
      pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
      description: 'Slack Token',
      severity: 'medium',
      category: 'communication'
    },
    {
      name: 'Google API Key',
      pattern: /AIza[0-9A-Za-z\-_]{35}/g,
      description: 'Google API Key',
      severity: 'medium',
      category: 'cloud'
    },
    {
      name: 'Password in URL',
      pattern: /[a-zA-Z]{3,10}:\/\/[^/\s:]*:[^/\s:@]*@[^/\s@]+/gi,
      description: 'Password in URL',
      severity: 'high',
      category: 'auth'
    },
    {
      name: 'Credit Card Number',
      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      description: 'Credit Card Number',
      severity: 'critical',
      category: 'financial'
    },
    {
      name: 'Social Security Number',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      description: 'Social Security Number',
      severity: 'critical',
      category: 'pii'
    }
  ];

  private static readonly DEFAULT_EXCLUDE_PATHS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '*.min.js',
    '*.min.css',
    '*.map'
  ];

  private static readonly DEFAULT_EXTENSIONS = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.rb', '.php',
    '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.vb',
    '.json', '.yaml', '.yml', '.xml', '.env', '.config',
    '.properties', '.ini', '.cfg', '.conf', '.sh', '.bat',
    '.ps1', '.sql', '.md', '.txt', '.log'
  ];

  private patterns: SecretPattern[];
  private excludePaths: string[];
  private includeExtensions: string[];
  private maxFileSize: number;

  constructor(options: ScanOptions = {}) {
    super();
    this.patterns = options.patterns || SecretScanner.DEFAULT_PATTERNS;
    this.excludePaths = options.excludePaths || SecretScanner.DEFAULT_EXCLUDE_PATHS;
    this.includeExtensions = options.includeExtensions || SecretScanner.DEFAULT_EXTENSIONS;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
  }

  /**
   * Scan directory for secrets
   */
  async scanDirectory(directoryPath: string, options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();
    const matches: SecretMatch[] = [];
    let filesScanned = 0;
    let filesSkipped = 0;

    try {
      const files = await this.getAllFiles(directoryPath, options);
      
      this.emit('scan:started', { directory: directoryPath, totalFiles: files.length });

      for (const file of files) {
        try {
          this.emit('scan:file', file);
          
          if (await this.shouldSkipFile(file, options)) {
            filesSkipped++;
            continue;
          }

          const fileMatches = await this.scanFile(file);
          matches.push(...fileMatches);
          filesScanned++;

        } catch (error) {
          logger.warn(`Failed to scan file ${file}:`, error);
          filesSkipped++;
        }
      }

      const scanDuration = Date.now() - startTime;
      const result: ScanResult = {
        matches,
        filesScanned,
        filesSkipped,
        scanDuration,
        summary: this.createSummary(matches)
      };

      this.emit('scan:completed', result);
      return result;

    } catch (error) {
      logger.error('Failed to scan directory:', error);
      throw error;
    }
  }

  /**
   * Scan single file for secrets
   */
  async scanFile(filePath: string): Promise<SecretMatch[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: SecretMatch[] = [];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        for (const pattern of this.patterns) {
          const regex = new RegExp(pattern.pattern);
          let match;

          while ((match = regex.exec(line)) !== null) {
            const confidence = this.calculateConfidence(match[0], line, pattern);
            
            if (confidence > 0.3) { // Confidence threshold
              matches.push({
                pattern,
                match: match[0],
                file: filePath,
                line: lineIndex + 1,
                column: match.index + 1,
                context: this.getContext(lines, lineIndex),
                confidence
              });
            }
          }
        }
      }

      return matches;

    } catch (error: unknown) {
      if ((error as any)?.code === 'EISDIR') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Scan text content for secrets
   */
  scanText(text: string, fileName = 'unknown'): SecretMatch[] {
    const lines = text.split('\n');
    const matches: SecretMatch[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      for (const pattern of this.patterns) {
        const regex = new RegExp(pattern.pattern);
        let match;

        while ((match = regex.exec(line)) !== null) {
          const confidence = this.calculateConfidence(match[0], line, pattern);
          
          if (confidence > 0.3) {
            matches.push({
              pattern,
              match: match[0],
              file: fileName,
              line: lineIndex + 1,
              column: match.index + 1,
              context: this.getContext(lines, lineIndex),
              confidence
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: SecretPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by name
   */
  removePattern(name: string): void {
    this.patterns = this.patterns.filter(p => p.name !== name);
  }

  /**
   * Get all patterns
   */
  getPatterns(): SecretPattern[] {
    return [...this.patterns];
  }

  /**
   * Validate if string contains secrets
   */
  hasSecrets(text: string): boolean {
    return this.scanText(text).length > 0;
  }

  /**
   * Create remediation suggestions
   */
  createRemediationSuggestions(matches: SecretMatch[]): Array<{
    file: string;
    suggestions: string[];
  }> {
    const fileGroups = new Map<string, SecretMatch[]>();
    
    // Group matches by file
    for (const match of matches) {
      const existing = fileGroups.get(match.file) || [];
      existing.push(match);
      fileGroups.set(match.file, existing);
    }

    return Array.from(fileGroups.entries()).map(([file, fileMatches]) => ({
      file,
      suggestions: this.generateSuggestions(fileMatches)
    }));
  }

  private async getAllFiles(dir: string, options: ScanOptions, allFiles: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.isExcluded(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (options.followSymlinks || !entry.isSymbolicLink()) {
            await this.getAllFiles(fullPath, options, allFiles);
          }
        } else if (entry.isFile()) {
          if (this.shouldIncludeFile(fullPath)) {
            allFiles.push(fullPath);
          }
        }
      }

      return allFiles;
    } catch (error) {
      logger.warn(`Failed to read directory ${dir}:`, error);
      return allFiles;
    }
  }

  private isExcluded(filePath: string): boolean {
    return this.excludePaths.some(excludePath => 
      filePath.includes(excludePath) || path.basename(filePath).includes(excludePath)
    );
  }

  private shouldIncludeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.includeExtensions.includes(ext) || this.includeExtensions.includes('*');
  }

  private async shouldSkipFile(filePath: string, options: ScanOptions): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      // Skip if too large
      if (stats.size > this.maxFileSize) {
        return true;
      }

      // Skip binary files unless explicitly enabled
      if (!options.scanBinary && await this.isBinaryFile(filePath)) {
        return true;
      }

      return false;
    } catch {
      return true;
    }
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const chunk = buffer.slice(0, 1024);
      
      // Check for null bytes (common in binary files)
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch {
      return true;
    }
  }

  private calculateConfidence(match: string, line: string, pattern: SecretPattern): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for longer matches
    confidence += Math.min(match.length / 50, 0.3);
    
    // Lower confidence if in comments
    if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*')) {
      confidence -= 0.2;
    }
    
    // Higher confidence if pattern is specific
    if (pattern.severity === 'critical') {
      confidence += 0.2;
    }
    
    // Lower confidence if looks like placeholder
    if (/(?:example|test|dummy|placeholder|xxx|yyy|zzz)/i.test(match)) {
      confidence -= 0.4;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  private getContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 1);
    const end = Math.min(lines.length, lineIndex + 2);
    return lines.slice(start, end).join('\n');
  }

  private createSummary(matches: SecretMatch[]) {
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    
    for (const match of matches) {
      summary[match.pattern.severity]++;
    }
    
    return summary;
  }

  private generateSuggestions(matches: SecretMatch[]): string[] {
    const suggestions = new Set<string>();
    
    for (const match of matches) {
      switch (match.pattern.category) {
        case 'cloud':
          suggestions.add('Use environment variables or secure credential storage for cloud credentials');
          suggestions.add('Implement AWS IAM roles or similar cloud-native authentication');
          break;
        case 'database':
          suggestions.add('Use connection pooling with environment-based configuration');
          suggestions.add('Implement database credential rotation');
          break;
        case 'api':
          suggestions.add('Store API keys in secure key management systems');
          suggestions.add('Use OAuth or similar token-based authentication where possible');
          break;
        case 'crypto':
          suggestions.add('Store private keys in secure hardware or key management services');
          suggestions.add('Use certificate-based authentication instead of embedded keys');
          break;
        case 'pii':
          suggestions.add('Remove or mask PII data from source code');
          suggestions.add('Implement data anonymization techniques');
          break;
        default:
          suggestions.add('Remove hardcoded secrets and use secure configuration management');
      }
    }
    
    return Array.from(suggestions);
  }
}