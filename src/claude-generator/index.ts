/**
 * Claude Generator System - Main Export Module
 * 
 * This module provides the complete dynamic CLAUDE.md generation system
 * with intelligent project detection, quality analysis, and configuration.
 */

// Core generator classes
export { ClaudeConfigGenerator } from './claude-config-generator.js';
export { ProjectDetector } from './project-detector.js';
export { QualityAnalyzer } from './quality-analyzer.js';
export { RepositoryAuditor } from './repository-auditor.js';
export { TemplateEngine } from './template-engine.js';

// Type definitions
export type {
  ClaudeConfig,
  ProjectMetadata,
  PackageJsonData,
  ProjectType,
  ProjectStructure,
  QualityStandards,
  AgentConfiguration,
  MCPToolConfig,
  TemplateContext,
  AuditResult
} from './types.js';

// Utility functions
export const createClaudeConfig = async (repoPath: string = process.cwd()) => {
  const { ClaudeConfigGenerator } = await import('./claude-config-generator.js');
  const generator = new ClaudeConfigGenerator(repoPath);
  return generator.generateConfig();
};

export const generateClaudeMarkdown = async (repoPath: string = process.cwd()) => {
  const { ClaudeConfigGenerator } = await import('./claude-config-generator.js');
  const generator = new ClaudeConfigGenerator(repoPath);
  return generator.generateClaudeMarkdown();
};

export const auditRepository = async (repoPath: string = process.cwd()) => {
  const { ClaudeConfigGenerator } = await import('./claude-config-generator.js');
  const generator = new ClaudeConfigGenerator(repoPath);
  return generator.auditRepository();
};

export const detectProjectType = async (repoPath: string = process.cwd()) => {
  const { ProjectDetector } = await import('./project-detector.js');
  const detector = new ProjectDetector(repoPath);
  return detector.detectProjectType();
};

// Version information
export const VERSION = '1.0.0';

// Default configurations
export const DEFAULT_AGENT_CONFIG = {
  swarmTopology: 'mesh' as const,
  maxAgents: 6,
  baseAgents: ['coder', 'reviewer', 'tester', 'planner', 'researcher']
};

export const DEFAULT_MCP_TOOLS = [
  'drift_detection',
  'pattern_standardize', 
  'dependency_analyze',
  'test_baseline',
  'claude_config'
];

export const SUPPORTED_PROJECT_TYPES = [
  'react',
  'nextjs', 
  'nodejs',
  'typescript',
  'python',
  'monorepo',
  'library',
  'cli',
  'full-stack'
] as const;