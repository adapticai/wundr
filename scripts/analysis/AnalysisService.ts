/**
 * Base Analysis Service - Common functionality for all analysis services
 */
import { BaseService, ServiceResult } from '../core/BaseService';
import { AppError, FileSystemError, AnalysisError } from '../core/errors';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';

export interface AnalysisConfig {
  targetDir: string;
  excludeDirs: string[];
  includeTests: boolean;
  outputFormat: 'json' | 'html' | 'markdown';
}

export interface AnalysisReport {
  timestamp: string;
  targetDir: string;
  filesAnalyzed: number;
  totalEntities: number;
  issues: AnalysisIssue[];
  summary: Record<string, any>;
}

export interface AnalysisIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
}

export abstract class AnalysisService extends BaseService {
  protected config: AnalysisConfig;
  protected program: ts.Program | null = null;
  protected checker: ts.TypeChecker | null = null;

  constructor(name: string, config: Partial<AnalysisConfig>) {
    super(name, {
      outputDir: path.join(process.cwd(), 'analysis-output', name.toLowerCase()),
    });
    
    this.config = {
      targetDir: process.cwd(),
      excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git'],
      includeTests: false,
      outputFormat: 'json',
      ...config
    };
  }

  /**
   * Run the analysis
   */
  async analyze(): ServiceResult<AnalysisReport> {
    return this.executeOperation('analyze', async () => {
      const files = await this.getTargetFiles();
      
      if (files.length === 0) {
        throw new AnalysisError('No files found to analyze');
      }

      this.log('info', `Found ${files.length} files to analyze`);

      // Create TypeScript program
      this.createProgram(files);

      // Run specific analysis
      const issues: AnalysisIssue[] = [];
      const summary = await this.performAnalysis(files, issues);

      const report: AnalysisReport = {
        timestamp: new Date().toISOString(),
        targetDir: this.config.targetDir,
        filesAnalyzed: files.length,
        totalEntities: summary.totalEntities || 0,
        issues,
        summary
      };

      // Save report
      await this.saveReport(report);

      return report;
    });
  }

  /**
   * Get TypeScript files to analyze
   */
  protected async getTargetFiles(): Promise<string[]> {
    const pattern = path.join(this.config.targetDir, '**/*.{ts,tsx}');
    const excludePatterns = this.config.excludeDirs.map(
      dir => path.join(this.config.targetDir, dir, '**')
    );

    if (!this.config.includeTests) {
      excludePatterns.push(
        path.join(this.config.targetDir, '**/*.test.ts'),
        path.join(this.config.targetDir, '**/*.spec.ts'),
        path.join(this.config.targetDir, '**/__tests__/**')
      );
    }

    return new Promise((resolve, reject) => {
      glob(pattern, { ignore: excludePatterns }, (err, files) => {
        if (err) {
          reject(new FileSystemError('glob', pattern, err));
        } else {
          resolve(files);
        }
      });
    });
  }

  /**
   * Create TypeScript program for analysis
   */
  protected createProgram(files: string[]): void {
    const configPath = ts.findConfigFile(
      this.config.targetDir,
      ts.sys.fileExists,
      'tsconfig.json'
    );

    let compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      lib: ['es2020'],
      allowJs: true,
      checkJs: false,
      skipLibCheck: true,
    };

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );
      compilerOptions = parsedConfig.options;
    }

    this.program = ts.createProgram(files, compilerOptions);
    this.checker = this.program.getTypeChecker();
  }

  /**
   * Save analysis report
   */
  protected async saveReport(report: AnalysisReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-report-${timestamp}.${this.config.outputFormat}`;

    let content: string;
    switch (this.config.outputFormat) {
      case 'json':
        content = JSON.stringify(report, null, 2);
        break;
      case 'html':
        content = this.generateHtmlReport(report);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(report);
        break;
      default:
        content = JSON.stringify(report, null, 2);
    }

    await this.saveOutput(filename, content);
    await this.saveOutput(`latest.${this.config.outputFormat}`, content);
  }

  /**
   * Generate HTML report
   */
  protected generateHtmlReport(report: AnalysisReport): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${this.name} Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 10px; margin-bottom: 20px; }
    .issue { margin: 10px 0; padding: 10px; border-left: 3px solid; }
    .issue.error { border-color: #ff0000; background: #ffe0e0; }
    .issue.warning { border-color: #ffa500; background: #fff0e0; }
    .issue.info { border-color: #0080ff; background: #e0f0ff; }
  </style>
</head>
<body>
  <h1>${this.name} Analysis Report</h1>
  <div class="summary">
    <p>Timestamp: ${report.timestamp}</p>
    <p>Files Analyzed: ${report.filesAnalyzed}</p>
    <p>Total Issues: ${report.issues.length}</p>
  </div>
  <h2>Issues</h2>
  ${report.issues.map(issue => `
    <div class="issue ${issue.severity}">
      <strong>${issue.severity.toUpperCase()}</strong>: ${issue.message}<br>
      File: ${issue.file}${issue.line ? ` (line ${issue.line})` : ''}
    </div>
  `).join('')}
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  protected generateMarkdownReport(report: AnalysisReport): string {
    return `# ${this.name} Analysis Report

## Summary
- **Timestamp**: ${report.timestamp}
- **Files Analyzed**: ${report.filesAnalyzed}
- **Total Issues**: ${report.issues.length}

## Issues

${report.issues.map(issue => 
`### ${issue.severity.toUpperCase()}: ${issue.type}
- **Message**: ${issue.message}
- **File**: ${issue.file}${issue.line ? ` (line ${issue.line})` : ''}
`).join('\n')}

## Detailed Summary
\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`
`;
  }

  /**
   * Get AST node from source file
   */
  protected getSourceFile(filePath: string): ts.SourceFile | undefined {
    return this.program?.getSourceFile(filePath);
  }

  /**
   * Visit all nodes in AST
   */
  protected visitNode(node: ts.Node, visitor: (node: ts.Node) => void): void {
    visitor(node);
    ts.forEachChild(node, child => this.visitNode(child, visitor));
  }

  /**
   * Get position info for node
   */
  protected getPositionInfo(node: ts.Node, sourceFile: ts.SourceFile): {
    line: number;
    column: number;
  } {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );
    return { line: line + 1, column: character + 1 };
  }

  protected async onInitialize(): Promise<void> {
    await fs.ensureDir(this.config.outputDir!);
  }

  protected async onShutdown(): Promise<void> {
    this.program = null;
    this.checker = null;
  }

  protected checkHealth(): boolean {
    return true;
  }

  /**
   * Abstract method to be implemented by specific analyzers
   */
  protected abstract performAnalysis(
    files: string[],
    issues: AnalysisIssue[]
  ): Promise<Record<string, any>>;
}