'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer, FileContentViewer } from '@/components/markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseReportMarkdown, formatReportNumber } from '@/lib/markdown-utils';
import { ReportTemplateEngine } from '@/lib/report-templates';
import {
  CompleteAnalysisData,
  ReportTemplate,
  ReportContent,
  ReportSection,
} from '@/types/reports';

const SAMPLE_MARKDOWN = `---
title: "Markdown Rendering Demo"
description: "A comprehensive demonstration of the markdown rendering system"
author: "Dashboard Team"
date: "2024-01-15"
tags: ["markdown", "demo", "documentation"]
---

# Welcome to the Markdown Rendering System

This is a comprehensive demonstration of our markdown rendering capabilities with **full support** for GitHub Flavored Markdown and syntax highlighting.

## Features

- ✅ Frontmatter metadata support
- ✅ GitHub Flavored Markdown (GFM)
- ✅ Syntax highlighting for code blocks
- ✅ Table of contents generation
- ✅ Dark/light mode support
- ✅ Responsive design

## Code Examples

### JavaScript

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

### TypeScript

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

class UserService {
  private users: User[] = [];

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Date.now(),
      ...userData
    };
    this.users.push(user);
    return user;
  }
}
\`\`\`

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Basic Markdown | ✅ Complete | Full CommonMark support |
| GFM Extensions | ✅ Complete | Tables, strikethrough, etc. |
| Syntax Highlighting | ✅ Complete | 100+ languages supported |
| Dark Mode | ✅ Complete | Automatic theme switching |

## Lists and Tasks

### Regular Lists
1. First item
2. Second item
   - Nested bullet
   - Another nested item
3. Third item

### Task Lists
- [x] Implement basic rendering
- [x] Add syntax highlighting
- [x] Create responsive design
- [ ] Add more themes
- [ ] Performance optimizations

## Blockquotes

> This is a blockquote example. It can contain **bold text**, *italic text*, and even \`inline code\`.
> 
> Multiple paragraphs are supported as well.

## Links and Images

Visit our [documentation](https://example.com) for more information.

## Horizontal Rules

---

## Math Support (if enabled)

Inline math: $E = mc^2$

Block math:
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

---

*This demo showcases the full capabilities of our markdown rendering system.*`;

const SAMPLE_CODE_FILE = `// Sample TypeScript file
export interface Config {
  theme: 'light' | 'dark';
  language: string;
  features: {
    syntax: boolean;
    gfm: boolean;
    toc: boolean;
  };
}

export class MarkdownProcessor {
  constructor(private config: Config) {}
  
  async process(content: string): Promise<string> {
    // Processing logic here
    return content;
  }
}`;

// Sample analysis data for report generation
const SAMPLE_ANALYSIS_DATA: CompleteAnalysisData = {
  metadata: {
    version: '2.0.0',
    generator: 'Wundr Analysis Engine',
    timestamp: new Date(),
    configuration: {
      includeTests: true,
      scanDepth: 3,
    },
    projectInfo: {
      name: 'Sample React Project',
      path: '/projects/sample-react',
      language: 'TypeScript',
      framework: 'React',
      packageManager: 'npm',
    },
  },
  entities: [
    {
      id: 'entity-1',
      name: 'UserService',
      path: 'src/services/user.ts',
      type: 'class',
      dependencies: ['DatabaseService', 'ValidationService'],
      dependents: ['UserController', 'AuthService'],
      complexity: {
        cyclomatic: 15,
        cognitive: 12,
        halstead: {
          volume: 245.6,
          difficulty: 8.2,
          effort: 2014.2,
        },
      },
      metrics: {
        linesOfCode: 156,
        maintainabilityIndex: 68,
        testCoverage: 85,
      },
      issues: [
        {
          id: 'issue-1',
          type: 'code-smell',
          severity: 'medium',
          message: 'Complex method should be refactored',
          rule: 'complexity-threshold',
          startLine: 45,
          endLine: 78,
          suggestions: ['Extract method', 'Simplify logic'],
        },
      ],
      tags: ['service', 'user-management'],
      lastModified: new Date('2024-01-15'),
    },
  ],
  duplicates: [
    {
      id: 'dup-1',
      type: 'structural',
      severity: 'high',
      similarity: 89,
      occurrences: [
        {
          path: 'src/utils/validate.ts',
          startLine: 10,
          endLine: 25,
          content: 'function validateEmail(email: string) { ... }',
          context: 'Email validation utility',
        },
        {
          path: 'src/components/forms/validation.ts',
          startLine: 5,
          endLine: 20,
          content: 'function validateEmail(email: string) { ... }',
          context: 'Form validation helper',
        },
      ],
      linesCount: 15,
      tokensCount: 142,
      recommendation:
        'Extract common validation logic into a shared utility module',
      effort: 'low',
      impact: 'medium',
    },
  ],
  circularDependencies: [
    {
      id: 'circular-1',
      severity: 'warning',
      cycle: [
        { from: 'UserService', to: 'AuthService', type: 'import', line: 5 },
        { from: 'AuthService', to: 'UserService', type: 'import', line: 8 },
      ],
      depth: 2,
      recommendation:
        'Break circular dependency by introducing an interface or moving shared code',
      breakpoints: [
        {
          from: 'AuthService',
          to: 'UserService',
          reason: 'Extract shared types to separate module',
          effort: 'medium',
        },
      ],
    },
  ],
  securityIssues: [
    {
      id: 'security-1',
      type: 'vulnerability',
      severity: 'high',
      cve: 'CVE-2023-1234',
      cvss: 7.2,
      path: 'package.json',
      description:
        'Vulnerable dependency: lodash@4.17.20 has known security issues',
      recommendation: 'Update lodash to version 4.17.21 or higher',
      references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-1234'],
      fixable: true,
      fixCommand: 'npm update lodash',
    },
  ],
  metrics: {
    overview: {
      totalFiles: 45,
      totalLines: 5420,
      totalEntities: 23,
      analysisTime: 1250,
      timestamp: new Date(),
    },
    quality: {
      maintainabilityIndex: 72,
      technicalDebt: {
        minutes: 180,
        rating: 'B',
      },
      duplicateLines: 156,
      duplicateRatio: 0.029,
      testCoverage: {
        lines: 78,
        functions: 85,
        branches: 72,
        statements: 80,
      },
    },
    complexity: {
      average: 8.2,
      highest: 15,
      distribution: {
        low: 15,
        medium: 6,
        high: 2,
        veryHigh: 0,
      },
    },
    issues: {
      total: 12,
      byType: {
        'code-smell': 8,
        bug: 2,
        vulnerability: 1,
        maintainability: 1,
      },
      bySeverity: {
        critical: 0,
        high: 1,
        medium: 5,
        low: 6,
      },
    },
    dependencies: {
      total: 34,
      circular: 1,
      unused: 3,
      outdated: 7,
      vulnerable: 1,
    },
  },
  recommendations: [
    {
      id: 'rec-1',
      title: 'Reduce UserService Complexity',
      description:
        'The UserService class has high cyclomatic complexity and should be refactored into smaller, focused methods.',
      category: 'maintainability',
      priority: 'high',
      effort: {
        level: 'medium',
        hours: 4,
        description: 'Refactor complex methods into smaller functions',
      },
      impact: {
        level: 'high',
        metrics: ['maintainability', 'readability'],
        description: 'Improved code maintainability and reduced technical debt',
      },
      affectedFiles: ['src/services/user.ts'],
      implementation: {
        steps: [
          'Extract validation logic to separate methods',
          'Split large methods into smaller functions',
          'Add unit tests for new methods',
        ],
        codeExamples: [
          {
            before: 'complex method with multiple responsibilities',
            after: 'simplified method calling extracted functions',
            language: 'typescript',
          },
        ],
        automatable: false,
        tools: ['ESLint', 'SonarQube'],
      },
      references: [
        'https://refactoring.guru/extract-method',
        'https://martinfowler.com/refactoring/',
      ],
      tags: ['complexity', 'refactoring'],
    },
  ],
  rawData: {
    dependencies: {
      UserService: ['DatabaseService', 'ValidationService'],
      PaymentProcessor: ['PaymentGateway', 'Logger'],
    },
    fileTree: {
      src: {
        type: 'directory',
        children: ['services', 'components'],
      },
      'src/services': {
        type: 'directory',
        children: ['user.ts', 'payment.ts'],
      },
      'src/components': {
        type: 'directory',
        children: ['UserForm.tsx', 'PaymentForm.tsx'],
      },
      'src/services/user.ts': {
        type: 'file',
        size: 2456,
        lastModified: new Date('2024-01-15'),
      },
      'src/services/payment.ts': {
        type: 'file',
        size: 1823,
        lastModified: new Date('2024-01-14'),
      },
      'src/components/UserForm.tsx': {
        type: 'file',
        size: 3201,
        lastModified: new Date('2024-01-15'),
      },
      'src/components/PaymentForm.tsx': {
        type: 'file',
        size: 2987,
        lastModified: new Date('2024-01-13'),
      },
    },
    packageInfo: {
      name: 'sample-react-project',
      version: '1.0.0',
    },
  },
};

const SAMPLE_REPORT_TEMPLATE: ReportTemplate = {
  id: 'comprehensive-demo',
  name: 'Comprehensive Analysis Demo',
  description: 'Demonstration template showing all report features',
  type: 'code-quality',
  category: 'standard',
  parameters: [],
  estimatedDuration: 300,
};

export default function MarkdownDemoPage() {
  const [activeTab, setActiveTab] = useState('renderer');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [reportContent, setReportContent] = useState<ReportContent | null>(
    null
  );

  // Generate sample report on component mount
  React.useEffect(() => {
    try {
      // Generate report content using ReportService logic
      const summary = {
        executiveSummary: `Analysis of ${SAMPLE_ANALYSIS_DATA.metadata.projectInfo.name} reveals a TypeScript project with ${SAMPLE_ANALYSIS_DATA.metrics.overview.totalFiles} files containing ${formatReportNumber(SAMPLE_ANALYSIS_DATA.metrics.overview.totalLines)} lines of code. The codebase shows a maintainability index of ${SAMPLE_ANALYSIS_DATA.metrics.quality.maintainabilityIndex}/100 with ${SAMPLE_ANALYSIS_DATA.metrics.issues.total} issues identified.`,
        keyFindings: [
          '1 high-severity security vulnerability detected',
          '1 circular dependency requiring attention',
          'Code duplication ratio of 2.9%',
          'Test coverage at 78% (acceptable)',
        ],
        recommendations: SAMPLE_ANALYSIS_DATA.recommendations.map(r => r.title),
        metrics: [
          {
            label: 'Total Files',
            value: SAMPLE_ANALYSIS_DATA.metrics.overview.totalFiles,
          },
          {
            label: 'Lines of Code',
            value: formatReportNumber(
              SAMPLE_ANALYSIS_DATA.metrics.overview.totalLines
            ),
          },
          {
            label: 'Technical Debt',
            value: `${SAMPLE_ANALYSIS_DATA.metrics.quality.technicalDebt.minutes}m (${SAMPLE_ANALYSIS_DATA.metrics.quality.technicalDebt.rating})`,
          },
          {
            label: 'Maintainability',
            value: `${SAMPLE_ANALYSIS_DATA.metrics.quality.maintainabilityIndex}/100`,
          },
          {
            label: 'Issues Found',
            value: SAMPLE_ANALYSIS_DATA.metrics.issues.total,
          },
          {
            label: 'Test Coverage',
            value: `${SAMPLE_ANALYSIS_DATA.metrics.quality.testCoverage?.lines || 0}%`,
          },
        ],
        riskAssessment: {
          level: 'medium' as const,
          factors: [
            'High-severity security vulnerability in dependencies',
            'Circular dependency may cause build issues',
            'Some methods exceed complexity thresholds',
          ],
          mitigation: [
            'Update vulnerable dependencies immediately',
            'Refactor circular dependency',
            'Break down complex methods',
          ],
        },
      };

      const sectionStrings =
        ReportTemplateEngine.generateDetailedSections(SAMPLE_ANALYSIS_DATA);
      sectionStrings.push(
        ReportTemplateEngine.generateRecommendationsSection(
          SAMPLE_ANALYSIS_DATA
        )
      );

      // Convert strings to proper ReportSection format
      const sections: ReportSection[] = sectionStrings.map(
        (sectionString, index) => {
          const lines = sectionString.split('\n');
          const title =
            lines[0].replace(/^#+\s*/, '') || `Section ${index + 1}`;
          const content = lines.slice(1).join('\n').trim();

          return {
            id: `section-${index + 1}`,
            title,
            content: [
              {
                type: 'markdown' as const,
                content,
              },
            ],
            order: index + 1,
          };
        }
      );

      const content: ReportContent = { summary, sections };
      setReportContent(content);

      const markdown = ReportTemplateEngine.generateMarkdownReport(
        SAMPLE_ANALYSIS_DATA,
        SAMPLE_REPORT_TEMPLATE,
        content
      );
      setReportMarkdown(markdown);
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  }, []);

  return (
    <div className='container mx-auto py-6 space-y-6'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>Markdown Rendering System</h1>
        <p className='text-muted-foreground'>
          A comprehensive system for rendering markdown files with syntax
          highlighting, frontmatter support, and GitHub Flavored Markdown.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6'>
        <Card className='p-4'>
          <h3 className='font-semibold mb-2'>Key Features</h3>
          <div className='space-y-1 text-sm'>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary' className='text-xs'>
                GFM
              </Badge>
              <span>GitHub Flavored Markdown</span>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary' className='text-xs'>
                Syntax
              </Badge>
              <span>Code highlighting</span>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary' className='text-xs'>
                Meta
              </Badge>
              <span>Frontmatter support</span>
            </div>
          </div>
        </Card>

        <Card className='p-4'>
          <h3 className='font-semibold mb-2'>Supported Languages</h3>
          <div className='flex flex-wrap gap-1 text-xs'>
            {[
              'JavaScript',
              'TypeScript',
              'Python',
              'Rust',
              'Go',
              'Java',
              'C++',
              'CSS',
            ].map(lang => (
              <Badge key={lang} variant='outline' className='text-xs'>
                {lang}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className='p-4'>
          <h3 className='font-semibold mb-2'>Themes</h3>
          <div className='space-y-1 text-sm'>
            <div>✅ Light mode support</div>
            <div>✅ Dark mode support</div>
            <div>✅ System preference</div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='renderer'>Markdown Renderer</TabsTrigger>
          <TabsTrigger value='viewer'>File Content Viewer</TabsTrigger>
          <TabsTrigger value='reports'>Report Generation</TabsTrigger>
        </TabsList>

        <TabsContent value='renderer' className='space-y-4'>
          <Card className='p-4'>
            <h3 className='font-semibold mb-2'>MarkdownRenderer Component</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Renders markdown content with full GFM support, syntax
              highlighting, and metadata display.
            </p>

            <MarkdownRenderer
              content={SAMPLE_MARKDOWN}
              showMetadata={true}
              showTableOfContents={true}
            />
          </Card>
        </TabsContent>

        <TabsContent value='viewer' className='space-y-4'>
          <Card className='p-4'>
            <h3 className='font-semibold mb-2'>FileContentViewer Component</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Automatically detects file types and renders them appropriately
              with download and copy functionality.
            </p>
          </Card>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            <FileContentViewer
              filePath='/demo/sample.md'
              fileName='sample.md'
              fileSize={SAMPLE_MARKDOWN.length}
              content={SAMPLE_MARKDOWN}
            />

            <FileContentViewer
              filePath='/demo/config.ts'
              fileName='config.ts'
              fileSize={SAMPLE_CODE_FILE.length}
              content={SAMPLE_CODE_FILE}
            />
          </div>
        </TabsContent>

        <TabsContent value='reports' className='space-y-4'>
          <Card className='p-4'>
            <h3 className='font-semibold mb-2'>Report Generation System</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Demonstrates the complete report generation pipeline from analysis
              data to formatted reports with markdown rendering.
            </p>

            {reportContent && (
              <div className='space-y-4'>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
                  <div className='text-center p-3 bg-muted rounded'>
                    <div className='text-2xl font-bold text-primary'>
                      {reportContent.sections.length}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Sections
                    </div>
                  </div>
                  <div className='text-center p-3 bg-muted rounded'>
                    <div className='text-2xl font-bold text-primary'>
                      {reportContent.sections.reduce(
                        (acc, section) => acc + (section.charts?.length || 0),
                        0
                      )}
                    </div>
                    <div className='text-sm text-muted-foreground'>Charts</div>
                  </div>
                  <div className='text-center p-3 bg-muted rounded'>
                    <div className='text-2xl font-bold text-primary'>
                      {reportContent.sections.reduce(
                        (acc, section) => acc + (section.tables?.length || 0),
                        0
                      )}
                    </div>
                    <div className='text-sm text-muted-foreground'>Tables</div>
                  </div>
                  <div className='text-center p-3 bg-muted rounded'>
                    <div className='text-2xl font-bold text-primary'>
                      {reportContent.summary.recommendations.length}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Recommendations
                    </div>
                  </div>
                </div>

                <div className='border rounded-lg p-4 bg-muted/50'>
                  <h4 className='font-medium mb-2'>Table of Contents</h4>
                  <div className='text-sm space-y-1'>
                    {reportContent.sections.map((section, index) => (
                      <div key={index} className='flex items-center gap-2'>
                        <span className='text-muted-foreground'>•</span>
                        <span>{section.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <h4 className='font-medium'>Generated Report (Markdown)</h4>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        const blob = new Blob([reportMarkdown], {
                          type: 'text/markdown',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample-report.md';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download Markdown
                    </Button>
                  </div>

                  <div className='max-h-96 overflow-auto'>
                    <MarkdownRenderer
                      content={reportMarkdown}
                      showMetadata={true}
                      showTableOfContents={true}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Card className='p-6'>
        <h3 className='font-semibold mb-4'>Usage Examples</h3>

        <div className='space-y-4'>
          <div>
            <h4 className='font-medium mb-2'>Basic Markdown Rendering</h4>
            <pre className='bg-muted p-3 rounded text-sm overflow-x-auto'>
              <code>{`import { MarkdownRenderer } from '@/components/markdown';

<MarkdownRenderer
  content="# Hello World\\n\\nThis is **bold** text."
  showMetadata={true}
  showTableOfContents={true}
/>`}</code>
            </pre>
          </div>

          <div>
            <h4 className='font-medium mb-2'>File Content Viewing</h4>
            <pre className='bg-muted p-3 rounded text-sm overflow-x-auto'>
              <code>{`import { FileContentViewer } from '@/components/markdown';

<FileContentViewer
  filePath="/path/to/file.md"
  fileName="README.md"
  fileSize={1024}
  content={fileContent}
/>`}</code>
            </pre>
          </div>

          <div>
            <h4 className='font-medium mb-2'>Report Generation</h4>
            <pre className='bg-muted p-3 rounded text-sm overflow-x-auto'>
              <code>{`import { ReportService } from '@/lib/services/report-service';
import { generateReportMarkdown } from '@/lib/markdown-utils';

// Parse analysis file
const analysisData = await ReportService.parseAnalysisFile(file);

// Generate report content
const reportContent = ReportService.generateReport(analysisData, template);

// Generate markdown
const markdown = generateReportMarkdown(analysisData, template, reportContent);

// Export to various formats
await ReportService.exportReport(reportContent, 'html', 'my-report');`}</code>
            </pre>
          </div>

          <div>
            <h4 className='font-medium mb-2'>Advanced Markdown Processing</h4>
            <pre className='bg-muted p-3 rounded text-sm overflow-x-auto'>
              <code>{`import { 
  parseReportMarkdown, 
  extractReportStats, 
  generateReportTOC 
} from '@/lib/markdown-utils';

// Enhanced parsing with report features
const html = await parseReportMarkdown(markdown, {
  showCharts: true,
  maxTableRows: 50,
  theme: 'dark'
});

// Extract statistics
const stats = extractReportStats(reportContent);

// Generate table of contents
const toc = generateReportTOC(reportContent);`}</code>
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
