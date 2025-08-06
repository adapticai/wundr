/**
 * Wundr Dashboard Consumer Integration System
 * Main entry point for all integration APIs
 */

// Import classes needed for WundrIntegration
import { ConfigurationAPI } from './config/ConfigurationAPI';
import { PluginSystem } from './plugins/PluginSystem';
import { HookSystem } from './hooks/HookSystem';
import { ScriptExecutor } from './security/ScriptExecutor';

// Configuration API
export { ConfigurationAPI, ConfigurationBuilder } from './config/ConfigurationAPI';
export type {
  DashboardConfig,
  BrandingConfig,
  AnalysisConfig,
  IntegrationConfig,
} from './config/ConfigurationAPI';

// Plugin System
export { PluginSystem, PluginRegistry, PluginLoader } from './plugins/PluginSystem';
export type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginAPI,
  MenuItem,
} from './plugins/PluginSystem';

// Hooks System
export { HookSystem, HookRegistry } from './hooks/HookSystem';
export type {
  HookEvent,
  HookDefinition,
  HookCallback,
  HookContext,
  WebhookConfig,
} from './hooks/HookSystem';

// Security & Script Execution
export { ScriptExecutor, SecurityPolicy } from './security/ScriptExecutor';
export type {
  ScriptExecutionOptions,
  ScriptExecutionResult,
  ScriptDefinition,
  SecurityViolation,
} from './security/ScriptExecutor';

// CLI Interface
export { DashboardCLI, createCLIProgram } from './cli/DashboardCLI';
export { InitCommand, createInitCommand } from './cli/InitCommand';
export type {
  CLIOptions,
  AnalysisOptions,
  ScriptOptions,
} from './cli/DashboardCLI';
export type { InitOptions } from './cli/InitCommand';

// Version info
export const VERSION = '1.0.0';
export const NAME = '@lumic/wundr';

/**
 * Quick start integration helper
 */
export class WundrIntegration {
  private configAPI: ConfigurationAPI;
  private pluginSystem: PluginSystem;
  private hookSystem: HookSystem;
  private scriptExecutor: ScriptExecutor;

  constructor(projectRoot: string = process.cwd()) {
    this.configAPI = new ConfigurationAPI(projectRoot);
    this.pluginSystem = new PluginSystem();
    this.hookSystem = new HookSystem(this.createLogger());
    this.scriptExecutor = new ScriptExecutor(projectRoot);
  }

  /**
   * Initialize the complete integration system
   */
  async initialize(): Promise<void> {
    // Load configuration
    await this.configAPI.loadConfig();
    const config = this.configAPI.getConfig();

    // Initialize plugins
    const pluginPaths = [
      './wundr-dashboard/plugins',
      './node_modules/@wundr/plugins',
      ...config.plugins.map(p => `./node_modules/${p}`),
    ];
    await this.pluginSystem.initialize(pluginPaths);

    // Load hooks from config
    await this.hookSystem.loadHooksFromConfig('./wundr.config.json');

    // Load custom scripts
    await this.scriptExecutor.loadScriptsFromConfig('./wundr.config.json');
  }

  /**
   * Get configuration API
   */
  getConfigAPI(): ConfigurationAPI {
    return this.configAPI;
  }

  /**
   * Get plugin system
   */
  getPluginSystem(): PluginSystem {
    return this.pluginSystem;
  }

  /**
   * Get hook system
   */
  getHookSystem(): HookSystem {
    return this.hookSystem;
  }

  /**
   * Get script executor
   */
  getScriptExecutor(): ScriptExecutor {
    return this.scriptExecutor;
  }

  /**
   * Shutdown integration system
   */
  async shutdown(): Promise<void> {
    await this.pluginSystem.shutdown();
  }

  private createLogger() {
    return {
      info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
      warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
      error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
      debug: (message: string, meta?: any) => {
        if (process.env.DEBUG) {
          console.debug(`[DEBUG] ${message}`, meta || '');
        }
      },
    };
  }
}

export default WundrIntegration;