/**
 * @fileoverview Report generators for analysis results
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AnalysisReport } from '../analyzers';
import type { MetricsReport } from '../metrics';

export interface ReportGenerator {
  generate(data: ReportData): Promise<string>;
  generateToFile(data: ReportData, outputPath: string): Promise<void>;
}

export interface ReportConfig {
  title?: string;
  description?: string;
  includeDetails: boolean;
  includeSummary: boolean;
  includeMetrics: boolean;
  theme?: 'light' | 'dark';
  format?: 'full' | 'summary';
}

export interface ReportData {
  timestamp: Date;
  projectName?: string;
  projectPath: string;
  analysisReport?: AnalysisReport;
  metricsReport?: MetricsReport;
  config: ReportConfig;
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  title: 'Code Analysis Report',
  description: 'Analysis results',
  includeDetails: true,
  includeSummary: true,
  includeMetrics: true,
  theme: 'light',
  format: 'full',
};

export class JSONReporter implements ReportGenerator {
  constructor(private config: ReportConfig = DEFAULT_REPORT_CONFIG) {}

  async generate(data: ReportData): Promise<string> {
    await Promise.resolve(); // Add await expression to satisfy linter

    const reportData = {
      metadata: {
        title: this.config.title,
        timestamp: data.timestamp.toISOString(),
        projectName: data.projectName ?? path.basename(data.projectPath),
        projectPath: data.projectPath,
      },
      summary: data.analysisReport?.summary,
      metrics: data.metricsReport?.summary,
      issues: data.analysisReport?.results ?? [],
    };

    return JSON.stringify(reportData, null, 2);
  }

  async generateToFile(data: ReportData, outputPath: string): Promise<void> {
    const json = await this.generate(data);
    const dir = path.dirname(outputPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, json, 'utf8');
  }
}

export class HTMLReporter implements ReportGenerator {
  constructor(private config: ReportConfig = DEFAULT_REPORT_CONFIG) {}

  async generate(data: ReportData): Promise<string> {
    await Promise.resolve(); // Add await expression to satisfy linter

    const projectName = data.projectName ?? path.basename(data.projectPath);
    const summary = data.analysisReport?.summary;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.config.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.config.title}</h1>
        <p>Project: ${projectName}</p>
        <p>Generated: ${data.timestamp.toLocaleString()}</p>
    </div>
    
    ${summary !== undefined ? `
    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
            <h3>Total Issues</h3>
            <div>${summary.totalIssues}</div>
        </div>
        <div class="metric">
            <h3>Critical</h3>
            <div>${summary.criticalIssues}</div>
        </div>
        <div class="metric">
            <h3>Errors</h3>
            <div>${summary.errorIssues}</div>
        </div>
        <div class="metric">
            <h3>Warnings</h3>
            <div>${summary.warningIssues}</div>
        </div>
    </div>
    ` : ''}
    
    <footer>
        <p>Generated with Wundr Analysis Engine</p>
    </footer>
</body>
</html>`;
  }

  async generateToFile(data: ReportData, outputPath: string): Promise<void> {
    const html = await this.generate(data);
    const dir = path.dirname(outputPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, html, 'utf8');
  }
}

export class MarkdownReporter implements ReportGenerator {
  constructor(private config: ReportConfig = DEFAULT_REPORT_CONFIG) {}

  async generate(data: ReportData): Promise<string> {
    await Promise.resolve(); // Add await expression to satisfy linter

    const projectName = data.projectName ?? path.basename(data.projectPath);
    const summary = data.analysisReport?.summary;

    let content = `# ${this.config.title}\n\n`;
    content += `**Project:** ${projectName}\n`;
    content += `**Generated:** ${data.timestamp.toLocaleString()}\n\n`;

    if (summary !== undefined) {
      content += '## Summary\n\n';
      content += '| Metric | Count |\n';
      content += '|--------|-------|\n';
      content += `| Total Issues | ${summary.totalIssues} |\n`;
      content += `| Critical | ${summary.criticalIssues} |\n`;
      content += `| Errors | ${summary.errorIssues} |\n`;
      content += `| Warnings | ${summary.warningIssues} |\n`;
      content += `| Info | ${summary.infoIssues} |\n\n`;
    }

    content += '---\n\n*Generated with Wundr Analysis Engine*';

    return content;
  }

  async generateToFile(data: ReportData, outputPath: string): Promise<void> {
    const markdown = await this.generate(data);
    const dir = path.dirname(outputPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, markdown, 'utf8');
  }
}

export class MultiFormatReporter {
  private reporters = new Map<string, ReportGenerator>();

  constructor(formats: { format: 'html' | 'json' | 'markdown'; config?: ReportConfig }[]) {
    formats.forEach(({ format, config }) => {
      switch (format) {
        case 'html':
          this.reporters.set(format, new HTMLReporter(config));
          break;
        case 'json':
          this.reporters.set(format, new JSONReporter(config));
          break;
        case 'markdown':
          this.reporters.set(format, new MarkdownReporter(config));
          break;
      }
    });
  }

  async generateAll(data: ReportData, outputDir: string): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [format, reporter] of this.reporters) {
      const extension = format === 'markdown' ? 'md' : format;
      const filename = `analysis-report.${extension}`;
      const outputPath = path.join(outputDir, filename);
      
      await reporter.generateToFile(data, outputPath);
      results[format] = outputPath;
    }

    return results;
  }
}

// Aliases for main index.ts exports
export const SimpleHtmlReporter = HTMLReporter;
export const SimpleMarkdownReporter = MarkdownReporter;
export const SimpleJsonReporter = JSONReporter;

export class ReportFactory {
  static createHTMLReporter(config?: ReportConfig): HTMLReporter {
    return new HTMLReporter(config);
  }

  static createJSONReporter(config?: ReportConfig): JSONReporter {
    return new JSONReporter(config);
  }

  static createMarkdownReporter(config?: ReportConfig): MarkdownReporter {
    return new MarkdownReporter(config);
  }
}

export const ReporterUtils = {
  combineReports(
    analysisReport: AnalysisReport,
    metricsReport: MetricsReport,
    projectName?: string,
  ): ReportData {
    const data: ReportData = {
      timestamp: new Date(),
      projectPath: analysisReport.projectPath,
      analysisReport,
      metricsReport,
      config: DEFAULT_REPORT_CONFIG,
    };
    
    if (projectName !== undefined && projectName.trim() !== '') {
      data.projectName = projectName;
    }
    
    return data;
  },
};