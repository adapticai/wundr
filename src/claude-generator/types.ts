/**
 * Types for the Dynamic CLAUDE.md Generator System
 */

export interface ProjectMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  keywords?: string[];
  engines?: Record<string, string>;
  packageManager?: string;
}

export interface PackageJsonData {
  name: string;
  description?: string;
  version: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: any;
}

export type ProjectType = 
  | 'react'
  | 'nextjs'
  | 'nodejs'
  | 'typescript'
  | 'python'
  | 'monorepo'
  | 'library'
  | 'cli'
  | 'full-stack'
  | 'unknown';

export interface ProjectStructure {
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasTests: boolean;
  hasDocumentation: boolean;
  hasCI: boolean;
  hasDocker: boolean;
  frameworks: string[];
  buildTools: string[];
  testFrameworks: string[];
  directories: string[];
  fileTypes: Record<string, number>;
}

export interface QualityStandards {
  linting: {
    enabled: boolean;
    configs: string[];
    rules: string[];
  };
  typeChecking: {
    enabled: boolean;
    strict: boolean;
    configs: string[];
  };
  testing: {
    enabled: boolean;
    frameworks: string[];
    coverage: {
      enabled: boolean;
      threshold?: number;
    };
  };
  formatting: {
    enabled: boolean;
    tools: string[];
  };
  preCommitHooks: {
    enabled: boolean;
    hooks: string[];
  };
}

export interface AgentConfiguration {
  agents: string[];
  swarmTopology: 'mesh' | 'hierarchical' | 'adaptive';
  maxAgents: number;
  specializedAgents: {
    [projectType: string]: string[];
  };
}

export interface MCPToolConfig {
  enabled: boolean;
  tools: {
    name: string;
    config: Record<string, any>;
    description: string;
  }[];
  autoConfiguration: boolean;
}

export interface ClaudeConfig {
  projectMetadata: ProjectMetadata;
  projectType: ProjectType;
  projectStructure: ProjectStructure;
  qualityStandards: QualityStandards;
  agentConfiguration: AgentConfiguration;
  mcpTools: MCPToolConfig;
  customSections?: {
    name: string;
    content: string;
  }[];
}

export interface TemplateContext {
  project: ProjectMetadata;
  type: ProjectType;
  structure: ProjectStructure;
  quality: QualityStandards;
  agents: AgentConfiguration;
  mcp: MCPToolConfig;
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  customCommands: string[];
}

export interface AuditResult {
  score: number;
  issues: {
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    fix?: string;
  }[];
  recommendations: string[];
  structure: ProjectStructure;
  quality: QualityStandards;
}