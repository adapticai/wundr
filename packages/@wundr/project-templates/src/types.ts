/**
 * Project Templates Types
 * Definitions for wundr-compliant project creation
 */

export type ProjectType = 
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'monorepo'
  | 'library'
  | 'cli'
  | 'api'
  | 'mobile';

export type FrameworkType = 
  | 'next'
  | 'react'
  | 'vue'
  | 'fastify'
  | 'express'
  | 'nestjs'
  | 'turborepo'
  | 'react-native';

export interface ProjectOptions {
  name: string;
  type: ProjectType;
  framework?: FrameworkType;
  description?: string;
  author?: string;
  license?: string;
  git?: boolean;
  install?: boolean;
  typescript?: boolean;
  testing?: boolean;
  ci?: boolean;
  docker?: boolean;
  path?: string;
}

export interface TemplateConfig {
  name: string;
  type: ProjectType;
  framework?: FrameworkType;
  displayName: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files: TemplateFile[];
  postInstall?: string[];
}

export interface TemplateFile {
  path: string;
  content: string | (() => string);
  template?: boolean;
}

export interface WundrConfig {
  version: string;
  baseline: GovernanceBaseline;
  patterns: Pattern[];
  drift: DriftConfig;
  ai: AIConfig;
}

export interface GovernanceBaseline {
  complexity: {
    max: number;
    warning: number;
  };
  coverage: {
    minimum: number;
    target: number;
  };
  duplicates: {
    maxPercentage: number;
  };
  dependencies: {
    maxDepth: number;
    allowCircular: boolean;
  };
}

export interface Pattern {
  name: string;
  type: 'error-handling' | 'naming' | 'structure' | 'import';
  rule: string;
  severity: 'error' | 'warning' | 'info';
}

export interface DriftConfig {
  checkOnCommit: boolean;
  blockOnDrift: boolean;
  autoFix: boolean;
}

export interface AIConfig {
  claudeFlow: boolean;
  swarmConfig?: {
    topology: 'mesh' | 'hierarchical' | 'star';
    maxAgents: number;
  };
  mcpTools: string[];
}

export interface ProjectMetadata {
  created: Date;
  wundrVersion: string;
  template: string;
  features: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TemplateContext {
  projectName: string;
  projectNameKebab: string;
  projectNamePascal: string;
  description: string;
  author: string;
  license: string;
  year: number;
  typescript: boolean;
  testing: boolean;
  ci: boolean;
  docker: boolean;
  wundrVersion: string;
}