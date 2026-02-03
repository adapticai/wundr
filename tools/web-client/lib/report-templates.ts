/**
 * Report Template System
 * Provides structured templates for different types of reports
 */

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'analysis' | 'quality' | 'dependency' | 'performance';
  sections: ReportSection[];
  metadata: {
    version: string;
    author: string;
    tags: string[];
    lastUpdated: Date;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  order: number;
  type: 'summary' | 'metrics' | 'table' | 'chart' | 'text' | 'recommendations';
  required: boolean;
  template: string;
  dataMapping?: Record<string, string>;
  formatting?: {
    showHeaders?: boolean;
    highlightThresholds?: Record<string, number>;
    chartType?: 'bar' | 'line' | 'pie' | 'scatter';
  };
}

/**
 * Analysis Report Template
 */
export const analysisReportTemplate: ReportTemplate = {
  id: 'analysis-standard',
  name: 'Standard Analysis Report',
  description: 'Comprehensive analysis report with metrics and recommendations',
  type: 'analysis',
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      order: 1,
      type: 'summary',
      required: true,
      template: `
# {{title}}

**Analysis Date:** {{createdAt}}
**Status:** {{status}}

## Key Findings
- Total items analyzed: {{summary.totalItems}}
- Success rate: {{successRate}}%
- Critical issues found: {{criticalIssuesCount}}

## Overall Health Score
{{healthScore}}/100

{{#if summary.errorCount}}
⚠️ **{{summary.errorCount}}** errors require immediate attention.
{{/if}}
      `,
      dataMapping: {
        successRate:
          '(summary.successCount / summary.totalItems * 100).toFixed(1)',
        criticalIssuesCount:
          'issues.filter(i => i.severity === "critical").length',
      },
    },
    {
      id: 'metrics-overview',
      title: 'Metrics Overview',
      order: 2,
      type: 'metrics',
      required: true,
      template: `
## Performance Metrics

{{#each metrics.performance}}
- **{{@key}}:** {{this}}
{{/each}}

## Quality Metrics

{{#each metrics.quality}}
- **{{@key}}:** {{this}}
{{/each}}

## Coverage Metrics

{{#each metrics.coverage}}
- **{{@key}}:** {{this}}%
{{/each}}
      `,
      formatting: {
        highlightThresholds: {
          coverage: 80,
          quality: 85,
        },
      },
    },
    {
      id: 'issues-table',
      title: 'Issues & Findings',
      order: 3,
      type: 'table',
      required: true,
      template: `
## Issues Breakdown

| Severity | Count | Percentage |
|----------|-------|------------|
{{#each issueBreakdown}}
| {{severity}} | {{count}} | {{percentage}}% |
{{/each}}

### Critical Issues
{{#each criticalIssues}}
- **{{category}}:** {{message}} {{#if file}}({{file}}:{{line}}){{/if}}
{{/each}}
      `,
      formatting: {
        showHeaders: true,
      },
    },
    {
      id: 'recommendations',
      title: 'Recommendations',
      order: 4,
      type: 'recommendations',
      required: true,
      template: `
## Action Items

{{#each recommendations}}
### {{priority}}. {{title}}

{{description}}

**Actions to take:**
{{#each actionItems}}
- {{this}}
{{/each}}

---
{{/each}}
      `,
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'Wundr Analysis Engine',
    tags: ['analysis', 'standard', 'comprehensive'],
    lastUpdated: new Date(),
  },
};

/**
 * Quality Report Template
 */
export const qualityReportTemplate: ReportTemplate = {
  id: 'quality-assessment',
  name: 'Code Quality Assessment',
  description: 'Focused on code quality metrics and violations',
  type: 'quality',
  sections: [
    {
      id: 'quality-score',
      title: 'Quality Score',
      order: 1,
      type: 'summary',
      required: true,
      template: `
# Code Quality Report

**Overall Quality Score:** {{qualityScore}}/100

## Quality Breakdown
- **Maintainability:** {{metrics.quality.maintainability}}/100
- **Reliability:** {{metrics.quality.reliability}}/100
- **Security:** {{metrics.quality.security}}/100
- **Technical Debt:** {{metrics.quality.technicalDebt}} hours

{{#if metrics.quality.maintainability < 70}}
🔴 **Maintainability is below acceptable threshold**
{{else if metrics.quality.maintainability < 85}}
🟡 **Maintainability needs improvement**
{{else}}
🟢 **Good maintainability score**
{{/if}}
      `,
    },
    {
      id: 'violations-chart',
      title: 'Code Violations',
      order: 2,
      type: 'chart',
      required: true,
      template: `
## Violations by Category

{{chartData}}

### Top Violation Types
{{#each topViolations}}
1. **{{type}}:** {{count}} occurrences
{{/each}}
      `,
      formatting: {
        chartType: 'bar',
      },
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'Wundr Quality Engine',
    tags: ['quality', 'code-review', 'maintainability'],
    lastUpdated: new Date(),
  },
};

/**
 * Dependency Report Template
 */
export const dependencyReportTemplate: ReportTemplate = {
  id: 'dependency-analysis',
  name: 'Dependency Analysis Report',
  description: 'Analysis of project dependencies and security vulnerabilities',
  type: 'dependency',
  sections: [
    {
      id: 'dependency-summary',
      title: 'Dependency Overview',
      order: 1,
      type: 'summary',
      required: true,
      template: `
# Dependency Analysis Report

## Summary
- **Total Dependencies:** {{summary.totalItems}}
- **Direct Dependencies:** {{directCount}}
- **Transitive Dependencies:** {{transitiveCount}}
- **Outdated Packages:** {{outdatedCount}}
- **Vulnerabilities Found:** {{vulnerabilityCount}}

## Security Status
{{#if vulnerabilityCount > 0}}
⚠️ **{{criticalVulns}} critical** and **{{highVulns}} high** severity vulnerabilities found
{{else}}
✅ No known security vulnerabilities detected
{{/if}}
      `,
    },
    {
      id: 'vulnerabilities',
      title: 'Security Vulnerabilities',
      order: 2,
      type: 'table',
      required: true,
      template: `
## Security Issues

{{#if issues.length > 0}}
| Severity | Package | Vulnerability | Fixed In |
|----------|---------|---------------|----------|
{{#each securityIssues}}
| {{severity}} | {{package}} | {{title}} | {{fixedIn}} |
{{/each}}
{{else}}
No security vulnerabilities found. ✅
{{/if}}
      `,
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'Wundr Security Scanner',
    tags: ['dependencies', 'security', 'vulnerabilities'],
    lastUpdated: new Date(),
  },
};

/**
 * Performance Report Template
 */
export const performanceReportTemplate: ReportTemplate = {
  id: 'performance-analysis',
  name: 'Performance Analysis Report',
  description: 'Performance metrics and optimization recommendations',
  type: 'performance',
  sections: [
    {
      id: 'performance-summary',
      title: 'Performance Summary',
      order: 1,
      type: 'summary',
      required: true,
      template: `
# Performance Analysis Report

## Key Metrics
- **Load Time:** {{metrics.performance.loadTime}}ms
- **First Contentful Paint:** {{metrics.performance.fcp}}ms
- **Largest Contentful Paint:** {{metrics.performance.lcp}}ms
- **Cumulative Layout Shift:** {{metrics.performance.cls}}
- **Bundle Size:** {{metrics.performance.bundleSize}}KB

## Performance Score: {{performanceScore}}/100

{{#if performanceScore < 50}}
🔴 **Poor performance** - Immediate optimization needed
{{else if performanceScore < 75}}
🟡 **Moderate performance** - Consider optimizations
{{else}}
🟢 **Good performance** - Minor optimizations possible
{{/if}}
      `,
    },
    {
      id: 'bottlenecks',
      title: 'Performance Bottlenecks',
      order: 2,
      type: 'table',
      required: true,
      template: `
## Identified Bottlenecks

{{#each performanceIssues}}
### {{category}} - {{impact}} Impact
**{{message}}**
{{#if file}}
*Location:* {{file}}{{#if line}}:{{line}}{{/if}}
{{/if}}

---
{{/each}}
      `,
    },
  ],
  metadata: {
    version: '1.0.0',
    author: 'Wundr Performance Analyzer',
    tags: ['performance', 'optimization', 'metrics'],
    lastUpdated: new Date(),
  },
};

/**
 * Template Registry
 */
export const reportTemplates = {
  'analysis-standard': analysisReportTemplate,
  'quality-assessment': qualityReportTemplate,
  'dependency-analysis': dependencyReportTemplate,
  'performance-analysis': performanceReportTemplate,
} as const;

/**
 * Get template by ID
 */
export function getReportTemplate(id: string): ReportTemplate | undefined {
  return reportTemplates[id as keyof typeof reportTemplates];
}

/**
 * Get templates by type
 */
export function getTemplatesByType(
  type: ReportTemplate['type']
): ReportTemplate[] {
  return Object.values(reportTemplates).filter(
    template => template.type === type
  );
}

/**
 * List all available templates
 */
export function listAllTemplates(): {
  id: string;
  name: string;
  description: string;
  type: string;
}[] {
  return Object.entries(reportTemplates).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    type: template.type,
  }));
}

/**
 * Template renderer utility
 */
export class ReportTemplateRenderer {
  private static interpolateTemplate(template: string, data: any): string {
    // Simple Handlebars-like template interpolation
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      // Handle array access like 'items[0]'
      if (key.includes('[')) {
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Render a report using a template
   */
  static renderReport(template: ReportTemplate, data: any): string {
    let output = '';

    // Sort sections by order
    const sortedSections = [...template.sections].sort(
      (a, b) => a.order - b.order
    );

    for (const section of sortedSections) {
      if (section.required || data[section.id]) {
        const sectionData = {
          ...data,
          ...data[section.id],
        };

        const renderedSection = this.interpolateTemplate(
          section.template,
          sectionData
        );
        output += renderedSection + '\n\n';
      }
    }

    return output.trim();
  }

  /**
   * Validate data against template requirements
   */
  static validateData(
    template: ReportTemplate,
    data: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const section of template.sections) {
      if (
        section.required &&
        !data[section.id] &&
        !this.hasRequiredFields(data, section)
      ) {
        errors.push(`Missing required section data: ${section.id}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static hasRequiredFields(data: any, section: ReportSection): boolean {
    // Check if the main data object has the fields needed for this section
    const templateFields = this.extractTemplateFields(section.template);
    return templateFields.some(
      field => this.getNestedValue(data, field) !== undefined
    );
  }

  private static extractTemplateFields(template: string): string[] {
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    return matches
      ? matches.map(match => match.replace(/[{}]/g, '').trim())
      : [];
  }
}

// Additional utility functions for report generation
export const ReportTemplateEngine = {
  ...ReportTemplateRenderer,

  /**
   * Generate detailed sections for analysis data
   * @param analysisData - The complete analysis data
   * @returns Array of section strings
   */
  generateDetailedSections(analysisData: any): string[] {
    const sections: string[] = [];

    // Overview section
    sections.push(`## Project Overview

- **Name:** ${analysisData.metadata?.projectInfo?.name || 'Unknown'}
- **Language:** ${analysisData.metadata?.projectInfo?.language || 'Unknown'}
- **Framework:** ${analysisData.metadata?.projectInfo?.framework || 'N/A'}
- **Total Files:** ${analysisData.metrics?.overview?.totalFiles || 0}
- **Total Lines:** ${analysisData.metrics?.overview?.totalLines || 0}
`);

    // Metrics section
    if (analysisData.metrics) {
      sections.push(`## Quality Metrics

- **Maintainability Index:** ${analysisData.metrics.quality?.maintainabilityIndex || 0}/100
- **Technical Debt:** ${analysisData.metrics.quality?.technicalDebt?.minutes || 0} minutes (${analysisData.metrics.quality?.technicalDebt?.rating || 'N/A'})
- **Duplicate Ratio:** ${((analysisData.metrics.quality?.duplicateRatio || 0) * 100).toFixed(1)}%
- **Test Coverage:** ${analysisData.metrics.quality?.testCoverage?.lines || 0}%
`);
    }

    // Issues section
    if (analysisData.metrics?.issues) {
      sections.push(`## Issues Summary

- **Total Issues:** ${analysisData.metrics.issues.total || 0}
- **Critical:** ${analysisData.metrics.issues.bySeverity?.critical || 0}
- **High:** ${analysisData.metrics.issues.bySeverity?.high || 0}
- **Medium:** ${analysisData.metrics.issues.bySeverity?.medium || 0}
- **Low:** ${analysisData.metrics.issues.bySeverity?.low || 0}
`);
    }

    // Dependencies section
    if (analysisData.metrics?.dependencies) {
      sections.push(`## Dependencies Analysis

- **Total Dependencies:** ${analysisData.metrics.dependencies.total || 0}
- **Circular Dependencies:** ${analysisData.metrics.dependencies.circular || 0}
- **Outdated Packages:** ${analysisData.metrics.dependencies.outdated || 0}
- **Vulnerable Packages:** ${analysisData.metrics.dependencies.vulnerable || 0}
`);
    }

    return sections;
  },

  /**
   * Generate recommendations section
   * @param analysisData - The complete analysis data
   * @returns Recommendations section string
   */
  generateRecommendationsSection(analysisData: any): string {
    let section = '## Recommendations\n\n';

    if (
      analysisData.recommendations &&
      analysisData.recommendations.length > 0
    ) {
      analysisData.recommendations.forEach((rec: any, index: number) => {
        section += `### ${index + 1}. ${rec.title || 'Recommendation'}\n\n`;
        section += `${rec.description || 'No description available'}\n\n`;
        section += `**Priority:** ${rec.priority || 'Medium'}\n`;
        section += `**Effort:** ${rec.effort?.level || 'Unknown'}\n\n`;

        if (rec.implementation?.steps && rec.implementation.steps.length > 0) {
          section += '**Implementation Steps:**\n';
          rec.implementation.steps.forEach((step: string) => {
            section += `- ${step}\n`;
          });
          section += '\n';
        }

        section += '---\n\n';
      });
    } else {
      section += 'No specific recommendations available at this time.\n';
    }

    return section;
  },

  /**
   * Generate complete markdown report
   * @param analysisData - The complete analysis data
   * @param template - The report template
   * @param content - The report content
   * @returns Complete markdown report
   */
  generateMarkdownReport(
    analysisData: any,
    template: any,
    content: any
  ): string {
    const frontmatter = {
      title:
        content.summary?.executiveSummary?.split('.')[0] || 'Analysis Report',
      description: `Analysis report for ${analysisData.metadata?.projectInfo?.name || 'project'}`,
      generated: new Date().toISOString(),
      template: template.name || 'Standard Report',
      version: analysisData.metadata?.version || '1.0.0',
    };

    let markdown = '---\n';
    Object.entries(frontmatter).forEach(([key, value]) => {
      markdown += `${key}: ${JSON.stringify(value)}\n`;
    });
    markdown += '---\n\n';

    // Add executive summary
    if (content.summary?.executiveSummary) {
      markdown += `# Analysis Report\n\n${content.summary.executiveSummary}\n\n`;
    }

    // Add key findings
    if (
      content.summary?.keyFindings &&
      content.summary.keyFindings.length > 0
    ) {
      markdown += '## Key Findings\n\n';
      content.summary.keyFindings.forEach((finding: string) => {
        markdown += `- ${finding}\n`;
      });
      markdown += '\n';
    }

    // Add sections
    if (content.sections && content.sections.length > 0) {
      content.sections.forEach((section: any) => {
        if (section.title && section.content) {
          markdown += `## ${section.title}\n\n`;
          section.content.forEach((contentItem: any) => {
            if (contentItem.type === 'markdown') {
              markdown += contentItem.content + '\n\n';
            }
          });
        }
      });
    }

    return markdown;
  },
};

export default reportTemplates;
