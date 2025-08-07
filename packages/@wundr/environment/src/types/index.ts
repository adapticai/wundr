/**
 * Core types for environment management
 */

export interface EnvironmentConfig {
  profile: ProfileType;
  platform: Platform;
  tools: ToolConfiguration[];
  preferences: UserPreferences;
  paths: EnvironmentPaths;
  version: string;
}

export type ProfileType = 'human' | 'ai-agent' | 'ci-runner';

export type Platform = 'macos' | 'linux' | 'windows' | 'docker';

export interface ToolConfiguration {
  name: string;
  version?: string;
  required: boolean;
  installer: InstallerType;
  config?: Record<string, any>;
  dependencies?: string[];
  platform?: Platform[];
  profile?: ProfileType[];
}

export type InstallerType = 'brew' | 'apt' | 'npm' | 'yarn' | 'pnpm' | 'chocolatey' | 'winget' | 'docker' | 'manual';

export interface UserPreferences {
  email?: string;
  fullName?: string;
  githubUsername?: string;
  company?: string;
  editor: EditorPreference;
  shell: ShellPreference;
  packageManager: PackageManager;
  theme: ThemePreference;
}

export type EditorPreference = 'vscode' | 'cursor' | 'webstorm' | 'vim' | 'emacs';
export type ShellPreference = 'bash' | 'zsh' | 'fish' | 'powershell';
export type PackageManager = 'npm' | 'yarn' | 'pnpm';
export type ThemePreference = 'dark' | 'light' | 'auto';

export interface EnvironmentPaths {
  home: string;
  development: string;
  config: string;
  cache: string;
  logs: string;
}

export interface InstallationResult {
  success: boolean;
  tool: string;
  version?: string;
  message: string;
  warnings?: string[];
  errors?: string[];
}

export interface ValidationResult {
  valid: boolean;
  tool: string;
  version?: string;
  issues?: string[];
  suggestions?: string[];
}

export interface HealthCheckResult {
  healthy: boolean;
  environment: EnvironmentConfig;
  tools: ValidationResult[];
  system: SystemInfo;
  recommendations?: string[];
}

export interface SystemInfo {
  platform: Platform;
  architecture: string;
  nodeVersion: string;
  npmVersion?: string;
  dockerVersion?: string;
  gitVersion?: string;
  shell: string;
  terminal: string;
}

export interface AgentConfiguration {
  claudeCode: boolean;
  claudeFlow: boolean;
  mcpTools: string[];
  swarmCapabilities: boolean;
  neuralFeatures: boolean;
}

export interface ProfileTemplate {
  name: string;
  description: string;
  profile: ProfileType;
  tools: ToolConfiguration[];
  preferences: Partial<UserPreferences>;
  agentConfig?: AgentConfiguration;
  customScripts?: string[];
}