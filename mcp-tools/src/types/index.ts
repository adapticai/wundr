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

// RAG Tool Arguments
export interface RagFileSearchArgs {
  query: string;
  paths?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  minScore?: number;
  mode?: 'semantic' | 'keyword' | 'hybrid';
  includeContent?: boolean;
  maxContentLength?: number;
}

export interface RagStoreManageArgs {
  action: 'create' | 'delete' | 'list' | 'status' | 'index' | 'clear' | 'optimize' | 'backup' | 'restore';
  storeName?: string;
  config?: {
    type?: string;
    embeddingModel?: string;
    dimensions?: number;
    metadata?: Record<string, unknown>;
  };
  indexPaths?: string[];
  backupPath?: string;
  force?: boolean;
}

export interface RagContextBuilderArgs {
  query: string;
  strategy?: 'relevant' | 'recent' | 'comprehensive' | 'focused' | 'custom';
  sources?: Array<'files' | 'store' | 'memory' | 'combined'>;
  maxTokens?: number;
  storeName?: string;
  additionalPaths?: string[];
  includeCode?: boolean;
  includeDocs?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  format?: 'plain' | 'markdown' | 'structured';
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