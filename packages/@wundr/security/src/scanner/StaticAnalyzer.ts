import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'security' | 'performance' | 'maintainability' | 'reliability';
  pattern: RegExp;
  languages: string[];
  cwe?: string;
  owasp?: string[];
  recommendation: string;
}

export interface SecurityIssue {
  rule: SecurityRule;
  file: string;
  line: number;
  column: number;
  message: string;
  snippet: string;
  severity: SecurityRule['severity'];
  category: SecurityRule['category'];
  fixSuggestion?: string;
}

export interface AnalysisResult {
  issues: SecurityIssue[];
  filesAnalyzed: number;
  filesSkipped: number;
  summary: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  scanDuration: number;
}

export interface AnalyzerOptions {
  rules?: SecurityRule[];
  excludePaths?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
  enableAutoFix?: boolean;
}

export class StaticAnalyzer extends EventEmitter {
  private static readonly DEFAULT_RULES: SecurityRule[] = [
    {
      id: 'sql-injection',
      name: 'Potential SQL Injection',
      description: 'SQL queries should use parameterized statements to prevent injection attacks',
      severity: 'critical',
      category: 'security',
      pattern: /(?:query|execute)\s*\(\s*['""`].*?\+.*?['""`]/gi,
      languages: ['js', 'ts', 'py', 'java', 'php'],
      cwe: 'CWE-89',
      owasp: ['A03:2021 - Injection'],
      recommendation: 'Use parameterized queries or prepared statements'
    },
    {
      id: 'xss-vulnerability',
      name: 'Cross-Site Scripting (XSS)',
      description: 'Potential XSS vulnerability from unescaped user input',
      severity: 'critical',
      category: 'security',
      pattern: /innerHTML\s*=\s*.*(?:req\.body|req\.query|req\.params|input|userInput)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-79',
      owasp: ['A03:2021 - Injection'],
      recommendation: 'Sanitize and escape user input before rendering'
    },
    {
      id: 'hardcoded-password',
      name: 'Hardcoded Password',
      description: 'Passwords should not be hardcoded in source code',
      severity: 'critical',
      category: 'security',
      pattern: /(?:password|pwd|passwd)\s*[:=]\s*['""][^'""]+['""](?!\s*\+)/gi,
      languages: ['js', 'ts', 'py', 'java', 'php', 'go'],
      cwe: 'CWE-798',
      owasp: ['A07:2021 - Identification and Authentication Failures'],
      recommendation: 'Use environment variables or secure credential storage'
    },
    {
      id: 'weak-crypto',
      name: 'Weak Cryptographic Algorithm',
      description: 'Weak or deprecated cryptographic algorithms detected',
      severity: 'error',
      category: 'security',
      pattern: /(?:createHash|createCipher)\s*\(\s*['"](?:md5|sha1|des|rc4)['"]\s*\)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-327',
      owasp: ['A02:2021 - Cryptographic Failures'],
      recommendation: 'Use strong cryptographic algorithms like SHA-256 or AES'
    },
    {
      id: 'path-traversal',
      name: 'Path Traversal Vulnerability',
      description: 'Potential path traversal attack from user input',
      severity: 'critical',
      category: 'security',
      pattern: /(?:readFile|readFileSync|createReadStream)\s*\(\s*.*(?:req\.body|req\.query|req\.params|\.\.\/)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-22',
      owasp: ['A01:2021 - Broken Access Control'],
      recommendation: 'Validate and sanitize file paths, use path.resolve()'
    },
    {
      id: 'command-injection',
      name: 'Command Injection',
      description: 'Potential command injection vulnerability',
      severity: 'critical',
      category: 'security',
      pattern: /(?:exec|spawn|execSync|spawnSync)\s*\(\s*.*(?:req\.body|req\.query|req\.params|input)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-78',
      owasp: ['A03:2021 - Injection'],
      recommendation: 'Validate input and use safe alternatives like child_process with arrays'
    },
    {
      id: 'insecure-random',
      name: 'Insecure Random Number Generation',
      description: 'Math.random() is not cryptographically secure',
      severity: 'warning',
      category: 'security',
      pattern: /Math\.random\(\)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-338',
      owasp: ['A02:2021 - Cryptographic Failures'],
      recommendation: 'Use crypto.randomBytes() for cryptographic purposes'
    },
    {
      id: 'eval-usage',
      name: 'Dangerous eval() Usage',
      description: 'eval() can execute arbitrary code and should be avoided',
      severity: 'critical',
      category: 'security',
      pattern: /\beval\s*\(/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-95',
      owasp: ['A03:2021 - Injection'],
      recommendation: 'Avoid eval() or use safe alternatives like JSON.parse()'
    },
    {
      id: 'unsafe-redirect',
      name: 'Unsafe Redirect',
      description: 'Unvalidated redirects can lead to phishing attacks',
      severity: 'error',
      category: 'security',
      pattern: /res\.redirect\s*\(\s*(?:req\.query|req\.body|req\.params)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-601',
      owasp: ['A01:2021 - Broken Access Control'],
      recommendation: 'Validate redirect URLs against a whitelist'
    },
    {
      id: 'insecure-cors',
      name: 'Insecure CORS Configuration',
      description: 'CORS allows all origins which can be dangerous',
      severity: 'warning',
      category: 'security',
      pattern: /Access-Control-Allow-Origin['"]\s*:\s*['"][*]['"]|cors\s*\(\s*\{\s*origin\s*:\s*['"]*\*['"]*\s*\}/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-942',
      owasp: ['A05:2021 - Security Misconfiguration'],
      recommendation: 'Specify allowed origins explicitly instead of using wildcard'
    },
    {
      id: 'missing-helmet',
      name: 'Missing Security Headers',
      description: 'Missing security middleware like Helmet.js',
      severity: 'warning',
      category: 'security',
      pattern: /express\s*\(\s*\)(?![\s\S]*helmet)/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-1021',
      owasp: ['A05:2021 - Security Misconfiguration'],
      recommendation: 'Use Helmet.js to set security headers'
    },
    {
      id: 'debug-code',
      name: 'Debug Code in Production',
      description: 'Debug statements may leak sensitive information',
      severity: 'info',
      category: 'security',
      pattern: /console\.(?:log|debug|info|warn|error)\s*\(/gi,
      languages: ['js', 'ts'],
      cwe: 'CWE-532',
      owasp: ['A09:2021 - Security Logging and Monitoring Failures'],
      recommendation: 'Remove or properly handle debug statements in production'
    }
  ];

  private rules: SecurityRule[];
  private excludePaths: string[];
  private includeExtensions: string[];
  private maxFileSize: number;
  private enableAutoFix: boolean;

  constructor(options: AnalyzerOptions = {}) {
    super();
    this.rules = options.rules || StaticAnalyzer.DEFAULT_RULES;
    this.excludePaths = options.excludePaths || ['node_modules', 'dist', 'build', '.git'];
    this.includeExtensions = options.includeExtensions || ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.php', '.go'];
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.enableAutoFix = options.enableAutoFix || false;
  }

  /**
   * Analyze directory for security issues
   */
  async analyzeDirectory(directoryPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let filesAnalyzed = 0;
    let filesSkipped = 0;

    try {
      this.emit('analysis:started', { directory: directoryPath });

      const files = await this.getAllFiles(directoryPath);
      
      for (const file of files) {
        try {
          if (await this.shouldSkipFile(file)) {
            filesSkipped++;
            continue;
          }

          this.emit('analysis:file', file);
          const fileIssues = await this.analyzeFile(file);
          issues.push(...fileIssues);
          filesAnalyzed++;

        } catch (error) {
          logger.warn(`Failed to analyze file ${file}:`, error);
          filesSkipped++;
        }
      }

      const scanDuration = Date.now() - startTime;
      const result: AnalysisResult = {
        issues,
        filesAnalyzed,
        filesSkipped,
        summary: this.createSummary(issues),
        scanDuration
      };

      this.emit('analysis:completed', result);
      return result;

    } catch (error) {
      logger.error('Static analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze single file
   */
  async analyzeFile(filePath: string): Promise<SecurityIssue[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const issues: SecurityIssue[] = [];
      const language = this.getLanguage(filePath);

      for (const rule of this.rules) {
        if (!rule.languages.includes(language)) {
          continue;
        }

        const matches = this.findMatches(content, lines, rule, filePath);
        issues.push(...matches);
      }

      // Apply auto-fixes if enabled
      if (this.enableAutoFix && issues.length > 0) {
        await this.applyAutoFixes(filePath, content, issues);
      }

      return issues;

    } catch (error) {
      logger.warn(`Failed to analyze file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Add custom rule
   */
  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): SecurityRule[] {
    return [...this.rules];
  }

  /**
   * Generate security report
   */
  generateReport(result: AnalysisResult): string {
    const report = [];
    
    report.push('# Static Security Analysis Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push(`Scan Duration: ${result.scanDuration}ms`);
    report.push(`Files Analyzed: ${result.filesAnalyzed}`);
    report.push(`Files Skipped: ${result.filesSkipped}`);
    report.push('');

    // Summary
    report.push('## Summary');
    report.push(`- Critical: ${result.summary.critical}`);
    report.push(`- Errors: ${result.summary.error}`);
    report.push(`- Warnings: ${result.summary.warning}`);
    report.push(`- Info: ${result.summary.info}`);
    report.push('');

    // Group issues by severity
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    const errorIssues = result.issues.filter(i => i.severity === 'error');
    const warningIssues = result.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length > 0) {
      report.push('## Critical Issues');
      criticalIssues.forEach(issue => {
        report.push(`### ${issue.rule.name}`);
        report.push(`**File:** ${issue.file}:${issue.line}:${issue.column}`);
        report.push(`**Description:** ${issue.rule.description}`);
        if (issue.rule.cwe) report.push(`**CWE:** ${issue.rule.cwe}`);
        if (issue.rule.owasp) report.push(`**OWASP:** ${issue.rule.owasp.join(', ')}`);
        report.push(`**Recommendation:** ${issue.rule.recommendation}`);
        report.push('```');
        report.push(issue.snippet);
        report.push('```');
        report.push('');
      });
    }

    if (errorIssues.length > 0) {
      report.push('## Error Issues');
      errorIssues.forEach(issue => {
        report.push(`- ${issue.rule.name} in ${issue.file}:${issue.line}`);
        report.push(`  ${issue.rule.recommendation}`);
      });
      report.push('');
    }

    if (warningIssues.length > 0) {
      report.push('## Warning Issues');
      warningIssues.forEach(issue => {
        report.push(`- ${issue.rule.name} in ${issue.file}:${issue.line}`);
      });
      report.push('');
    }

    // Recommendations
    report.push('## General Recommendations');
    report.push('1. Address critical and error issues immediately');
    report.push('2. Implement security code review processes');
    report.push('3. Use static analysis tools in CI/CD pipeline');
    report.push('4. Provide security training for development team');
    report.push('5. Follow secure coding practices and guidelines');

    return report.join('\n');
  }

  private async getAllFiles(dir: string, allFiles: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.isExcluded(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.getAllFiles(fullPath, allFiles);
        } else if (entry.isFile() && this.shouldIncludeFile(fullPath)) {
          allFiles.push(fullPath);
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
      filePath.includes(excludePath)
    );
  }

  private shouldIncludeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.includeExtensions.includes(ext);
  }

  private async shouldSkipFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size > this.maxFileSize;
    } catch {
      return true;
    }
  }

  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'js',
      '.jsx': 'js',
      '.ts': 'ts',
      '.tsx': 'ts',
      '.py': 'py',
      '.java': 'java',
      '.php': 'php',
      '.go': 'go',
      '.rb': 'rb',
      '.rs': 'rs',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'cs'
    };
    return languageMap[ext] || 'unknown';
  }

  private findMatches(content: string, lines: string[], rule: SecurityRule, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const regex = new RegExp(rule.pattern);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match;

      while ((match = regex.exec(line)) !== null) {
        const issue: SecurityIssue = {
          rule,
          file: filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          message: rule.description,
          snippet: this.getSnippet(lines, lineIndex, 2),
          severity: rule.severity,
          category: rule.category,
          fixSuggestion: this.generateFixSuggestion(rule, match[0])
        };

        issues.push(issue);
      }
    }

    return issues;
  }

  private getSnippet(lines: string[], lineIndex: number, context: number): string {
    const start = Math.max(0, lineIndex - context);
    const end = Math.min(lines.length, lineIndex + context + 1);
    
    const snippet = [];
    for (let i = start; i < end; i++) {
      const prefix = i === lineIndex ? '>>> ' : '    ';
      snippet.push(`${prefix}${i + 1}: ${lines[i]}`);
    }
    
    return snippet.join('\n');
  }

  private generateFixSuggestion(rule: SecurityRule, match: string): string {
    switch (rule.id) {
      case 'weak-crypto':
        return 'Replace with: createHash("sha256") or createCipher("aes-256-gcm")';
      case 'insecure-random':
        return 'Replace with: crypto.randomBytes().toString("hex")';
      case 'eval-usage':
        return 'Consider using JSON.parse() or Function constructor with validation';
      case 'debug-code':
        return 'Remove console statements or replace with proper logging';
      default:
        return rule.recommendation;
    }
  }

  private async applyAutoFixes(filePath: string, content: string, issues: SecurityIssue[]): Promise<void> {
    let modifiedContent = content;
    
    // Simple auto-fixes for specific rules
    for (const issue of issues) {
      switch (issue.rule.id) {
        case 'insecure-random':
          modifiedContent = modifiedContent.replace(
            /Math\.random\(\)/g,
            'crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF'
          );
          break;
        case 'weak-crypto':
          modifiedContent = modifiedContent.replace(
            /createHash\s*\(\s*['"]md5['"]\s*\)/g,
            'createHash("sha256")'
          );
          modifiedContent = modifiedContent.replace(
            /createHash\s*\(\s*['"]sha1['"]\s*\)/g,
            'createHash("sha256")'
          );
          break;
      }
    }

    if (modifiedContent !== content) {
      await fs.writeFile(filePath, modifiedContent, 'utf-8');
      this.emit('autofix:applied', { file: filePath, fixes: issues.length });
    }
  }

  private createSummary(issues: SecurityIssue[]) {
    const summary = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0
    };

    for (const issue of issues) {
      summary[issue.severity]++;
    }

    return summary;
  }
}