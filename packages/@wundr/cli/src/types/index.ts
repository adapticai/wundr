import { Command } from 'commander';

/**
 * Core types for the Wundr CLI
 */

export interface WundrConfig {
  version: string;
  defaultMode: 'cli' | 'interactive' | 'chat' | 'tui';
  plugins: string[];
  integrations: {
    github?: GitHubIntegration;
    slack?: SlackIntegration;
    jira?: JiraIntegration;
  };
  ai: {
    provider: string;
    model: string;
    apiKey?: string;
  };
  analysis: {
    patterns: string[];
    excludes: string[];
    maxDepth: number;
  };
  governance: {
    rules: string[];
    severity: 'error' | 'warning' | 'info';
  };
}

export interface GitHubIntegration {
  token: string;
  owner: string;
  repo: string;
  webhooks?: boolean;
}

export interface SlackIntegration {
  token: string;
  channel: string;
  webhooks?: boolean;
}

export interface JiraIntegration {
  url: string;
  email: string;
  token: string;
}

export interface CommandContext {
  config: WundrConfig;
  logger: Logger;
  spinner: Spinner;
  interactive: boolean;
  dryRun: boolean;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

export interface Spinner {
  start(text?: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  info(text?: string): void;
  stop(): void;
  text: string;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  commands?: PluginCommand[];
  hooks?: PluginHook[];
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

export interface PluginCommand {
  name: string;
  description: string;
  options?: CommandOption[];
  action: (args: any[], options: any, context: CommandContext) => Promise<void>;
}

export interface PluginHook {
  event: string;
  handler: (data: any, context: CommandContext) => Promise<void>;
}

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: any;
}

export interface PluginContext {
  config: WundrConfig;
  logger: Logger;
  registerCommand(command: PluginCommand): void;
  registerHook(hook: PluginHook): void;
}

export interface BatchJob {
  name: string;
  description?: string;
  commands: BatchCommand[];
  parallel?: boolean;
  continueOnError?: boolean;
  timeout?: number;
}

export interface BatchCommand {
  command: string;
  args?: string[];
  options?: Record<string, any>;
  condition?: string;
  retry?: number;
  timeout?: number;
}

export interface WatchConfig {
  patterns: string[];
  ignore?: string[];
  commands: WatchCommand[];
  debounce?: number;
  recursive?: boolean;
}

export interface WatchCommand {
  trigger: 'change' | 'add' | 'delete' | 'rename';
  command: string;
  args?: string[];
  condition?: string;
}

export interface TUILayout {
  name: string;
  widgets: TUIWidget[];
  keybindings?: Keybinding[];
}

export interface TUIWidget {
  type: 'log' | 'chart' | 'table' | 'progress' | 'text';
  position: {
    top: string | number;
    left: string | number;
    width: string | number;
    height: string | number;
  };
  options: Record<string, any>;
  dataSource?: string;
}

export interface Keybinding {
  key: string;
  action: string;
  description: string;
}

export interface ChatSession {
  id: string;
  model: string;
  context?: string;
  history: ChatMessage[];
  created: Date;
  updated: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AnalysisResult {
  type: 'dependency' | 'quality' | 'security' | 'performance';
  findings: Finding[];
  metrics: Record<string, number>;
  recommendations: Recommendation[];
  timestamp: Date;
}

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  rule: string;
  fixable: boolean;
  fix?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  actions: RecommendationAction[];
}

export interface RecommendationAction {
  type: 'command' | 'file_change' | 'config_change';
  description: string;
  command?: string;
  file?: string;
  changes?: any;
}

/**
 * Base command interface for all command categories
 */
export interface BaseCommand {
  program: Command;
  config: WundrConfig;
  logger: Logger;
  registerCommands(): void;
}

/**
 * Interactive mode types
 */
export interface InteractiveSession {
  mode: 'wizard' | 'chat' | 'tui' | 'watch';
  config: any;
  state: Record<string, any>;
  active: boolean;
}

/**
 * Error handling types
 */
export interface WundrError extends Error {
  code?: string;
  context?: Record<string, any>;
  recoverable?: boolean;
}