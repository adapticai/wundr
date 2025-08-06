// Type definitions for MCP tool arguments

export interface DriftDetectionArgs {
  action: 'create-baseline' | 'detect' | 'list-baselines' | 'trends';
  baselineVersion?: string;
}

export interface PatternStandardizeArgs {
  action: 'run' | 'review' | 'check';
  rules?: string[];
  dryRun?: boolean;
}

export interface MonorepoManageArgs {
  action: 'init' | 'plan' | 'add-package' | 'check-deps';
  packageName?: string;
  packageType?: 'app' | 'package' | 'tool';
  analysisReport?: string;
}

export interface GovernanceReportArgs {
  reportType: 'weekly' | 'drift' | 'quality' | 'compliance';
  format?: 'markdown' | 'json' | 'html';
  period?: string;
}

export interface DependencyAnalyzeArgs {
  scope: 'all' | 'circular' | 'unused' | 'external';
  target?: string;
  outputFormat?: 'graph' | 'json' | 'markdown';
}

export interface TestBaselineArgs {
  action: 'create' | 'compare' | 'update';
  testType?: 'unit' | 'integration' | 'e2e' | 'all';
  threshold?: number;
}

export interface ClaudeConfigArgs {
  configType: 'claude-md' | 'hooks' | 'conventions' | 'all';
  features?: string[];
}

// Common result types
export interface MCPToolResult {
  success: boolean;
  action?: string;
  message: string;
  details?: any;
  error?: string;
}

export interface BaselineResult extends MCPToolResult {
  version?: string;
  metrics?: Record<string, number>;
}

export interface ReportResult extends MCPToolResult {
  reportPath?: string;
  format?: string;
  summary?: Record<string, any>;
}