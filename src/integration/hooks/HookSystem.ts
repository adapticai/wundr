/**
 * Hooks and Callbacks System for Consumer Integration
 * Enables consumers to integrate with existing tools and workflows
 */

import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Hook Event Types
export type HookEvent = 
  | 'before-analysis'
  | 'after-analysis'
  | 'before-dashboard-start'
  | 'after-dashboard-start'
  | 'before-script-execution'
  | 'after-script-execution'
  | 'config-changed'
  | 'plugin-loaded'
  | 'plugin-unloaded'
  | 'error-occurred'
  | 'data-updated';

// Hook Types
export type HookType = 'sync' | 'async' | 'waterfall' | 'parallel';

export interface HookDefinition {
  name: string;
  event: HookEvent;
  type: HookType;
  description: string;
  callback: HookCallback;
  priority?: number;
  enabled?: boolean;
  conditions?: HookCondition[];
}

export interface HookCallback {
  (context: HookContext): Promise<any> | any;
}

export interface HookContext {
  event: HookEvent;
  data: any;
  config: any;
  metadata: Record<string, any>;
  services: {
    logger: Logger;
    executor: any;
    configAPI: any;
  };
  utilities: {
    formatOutput: (data: any) => string;
    validateData: (data: any, schema: any) => boolean;
    cacheGet: (key: string) => any;
    cacheSet: (key: string, value: any, ttl?: number) => void;
  };
}

export interface HookCondition {
  type: 'config' | 'environment' | 'data' | 'time';
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
  value: any;
  path?: string;
}

export interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  events: HookEvent[];
}

/**
 * Hook Registry manages all registered hooks
 */
export class HookRegistry {
  private hooks = new Map<string, HookDefinition[]>();
  private eventEmitter = new EventEmitter();
  private webhooks: WebhookConfig[] = [];

  /**
   * Register a hook for a specific event
   */
  register(hookDef: HookDefinition): void {
    const eventHooks = this.hooks.get(hookDef.event) || [];
    
    // Check for duplicate names
    const existing = eventHooks.find(h => h.name === hookDef.name);
    if (existing) {
      throw new Error(`Hook with name '${hookDef.name}' already exists for event '${hookDef.event}'`);
    }

    eventHooks.push(hookDef);
    eventHooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.hooks.set(hookDef.event, eventHooks);
  }

  /**
   * Unregister a hook
   */
  unregister(event: HookEvent, name: string): void {
    const eventHooks = this.hooks.get(event) || [];
    const filtered = eventHooks.filter(h => h.name !== name);
    this.hooks.set(event, filtered);
  }

  /**
   * Get all hooks for an event
   */
  getHooksForEvent(event: HookEvent): HookDefinition[] {
    return this.hooks.get(event) || [];
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): Map<string, HookDefinition[]> {
    return new Map(this.hooks);
  }

  /**
   * Enable/disable a hook
   */
  toggleHook(event: HookEvent, name: string, enabled: boolean): void {
    const eventHooks = this.hooks.get(event) || [];
    const hook = eventHooks.find(h => h.name === name);
    if (hook) {
      hook.enabled = enabled;
    }
  }

  /**
   * Register webhook
   */
  registerWebhook(webhook: WebhookConfig): void {
    this.webhooks.push(webhook);
  }

  /**
   * Get webhooks for event
   */
  getWebhooksForEvent(event: HookEvent): WebhookConfig[] {
    return this.webhooks.filter(w => w.events.includes(event));
  }
}

/**
 * Hook Executor handles running hooks with proper error handling
 */
export class HookExecutor {
  private cache = new Map<string, { value: any; expires: number }>();

  constructor(
    private registry: HookRegistry,
    private logger: Logger
  ) {}

  /**
   * Execute hooks for a specific event
   */
  async executeHooks(
    event: HookEvent,
    data: any = {},
    config: any = {},
    metadata: Record<string, any> = {}
  ): Promise<any> {
    const hooks = this.registry.getHooksForEvent(event);
    const enabledHooks = hooks.filter(h => h.enabled !== false);

    if (enabledHooks.length === 0) {
      return data;
    }

    this.logger.debug(`Executing ${enabledHooks.length} hooks for event: ${event}`);

    const context = this.createHookContext(event, data, config, metadata);

    // Group hooks by type for optimal execution
    const syncHooks = enabledHooks.filter(h => h.type === 'sync');
    const asyncHooks = enabledHooks.filter(h => h.type === 'async');
    const waterfallHooks = enabledHooks.filter(h => h.type === 'waterfall');
    const parallelHooks = enabledHooks.filter(h => h.type === 'parallel');

    let result = data;

    try {
      // Execute sync hooks first
      for (const hook of syncHooks) {
        if (this.shouldExecuteHook(hook, context)) {
          result = await this.executeHook(hook, { ...context, data: result });
        }
      }

      // Execute waterfall hooks (each gets output of previous)
      for (const hook of waterfallHooks) {
        if (this.shouldExecuteHook(hook, context)) {
          result = await this.executeHook(hook, { ...context, data: result });
        }
      }

      // Execute parallel hooks (all get same input)
      if (parallelHooks.length > 0) {
        const parallelResults = await Promise.allSettled(
          parallelHooks
            .filter(hook => this.shouldExecuteHook(hook, context))
            .map(hook => this.executeHook(hook, { ...context, data: result }))
        );

        // Handle parallel results (could merge or use first successful)
        const successfulResults = parallelResults
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<any>).value);

        if (successfulResults.length > 0) {
          result = successfulResults[0]; // Use first successful result
        }
      }

      // Execute async hooks (fire and forget)
      asyncHooks
        .filter(hook => this.shouldExecuteHook(hook, context))
        .forEach(hook => {
          this.executeHook(hook, { ...context, data: result }).catch(error => {
            this.logger.error(`Async hook '${hook.name}' failed:`, error);
          });
        });

      // Execute webhooks
      await this.executeWebhooks(event, result);

      return result;

    } catch (error) {
      this.logger.error(`Hook execution failed for event '${event}':`, error);
      throw error;
    }
  }

  /**
   * Execute a single hook with error handling
   */
  private async executeHook(hook: HookDefinition, context: HookContext): Promise<any> {
    try {
      this.logger.debug(`Executing hook: ${hook.name}`);
      const startTime = Date.now();
      
      const result = await hook.callback(context);
      
      const duration = Date.now() - startTime;
      this.logger.debug(`Hook '${hook.name}' completed in ${duration}ms`);
      
      return result !== undefined ? result : context.data;

    } catch (error) {
      this.logger.error(`Hook '${hook.name}' failed:`, error);
      
      // Decide whether to continue or stop based on hook type
      if (hook.type === 'waterfall' || hook.type === 'sync') {
        throw error; // Critical hooks should stop execution
      }
      
      return context.data; // Continue with original data for non-critical hooks
    }
  }

  /**
   * Check if hook should execute based on conditions
   */
  private shouldExecuteHook(hook: HookDefinition, context: HookContext): boolean {
    if (!hook.conditions || hook.conditions.length === 0) {
      return true;
    }

    return hook.conditions.every(condition => {
      let actualValue: any;

      switch (condition.type) {
        case 'config':
          actualValue = condition.path 
            ? this.getNestedValue(context.config, condition.path)
            : context.config;
          break;
        case 'environment':
          actualValue = process.env[condition.path || ''];
          break;
        case 'data':
          actualValue = condition.path 
            ? this.getNestedValue(context.data, condition.path)
            : context.data;
          break;
        case 'time':
          actualValue = new Date().getHours();
          break;
        default:
          return false;
      }

      return this.evaluateCondition(actualValue, condition.operator, condition.value);
    });
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not-equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'greater-than':
        return Number(actual) > Number(expected);
      case 'less-than':
        return Number(actual) < Number(expected);
      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Execute webhooks for event
   */
  private async executeWebhooks(event: HookEvent, data: any): Promise<void> {
    const webhooks = this.registry.getWebhooksForEvent(event);
    
    for (const webhook of webhooks) {
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers,
          },
          body: JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

        this.logger.debug(`Webhook executed successfully: ${webhook.url}`);

      } catch (error) {
        this.logger.error(`Webhook execution failed: ${webhook.url}`, error);
      }
    }
  }

  /**
   * Create hook execution context
   */
  private createHookContext(
    event: HookEvent,
    data: any,
    config: any,
    metadata: Record<string, any>
  ): HookContext {
    return {
      event,
      data,
      config,
      metadata,
      services: {
        logger: this.logger,
        executor: null, // Will be injected by system
        configAPI: null, // Will be injected by system
      },
      utilities: {
        formatOutput: (data: any) => JSON.stringify(data, null, 2),
        validateData: (data: any, schema: any) => {
          // Simple validation - could use Joi or Zod
          return typeof data === typeof schema;
        },
        cacheGet: (key: string) => this.cacheGet(key),
        cacheSet: (key: string, value: any, ttl?: number) => this.cacheSet(key, value, ttl),
      },
    };
  }

  /**
   * Cache utilities
   */
  private cacheGet(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    
    if (cached.expires > 0 && Date.now() > cached.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.value;
  }

  private cacheSet(key: string, value: any, ttlMs: number = 0): void {
    const expires = ttlMs > 0 ? Date.now() + ttlMs : 0;
    this.cache.set(key, { value, expires });
  }
}

/**
 * Hook System Manager
 */
export class HookSystem {
  private registry: HookRegistry;
  private executor: HookExecutor;

  constructor(logger: Logger) {
    this.registry = new HookRegistry();
    this.executor = new HookExecutor(this.registry, logger);
  }

  /**
   * Register a hook
   */
  registerHook(hookDef: HookDefinition): void {
    this.registry.register(hookDef);
  }

  /**
   * Register multiple hooks from configuration
   */
  async loadHooksFromConfig(configPath: string): Promise<void> {
    if (!existsSync(configPath)) {
      return;
    }

    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    const hooksConfig = config.integration?.hooks || [];

    for (const hookConfig of hooksConfig) {
      // Convert configuration to hook definition
      const hookDef: HookDefinition = {
        name: hookConfig.name,
        event: hookConfig.event,
        type: hookConfig.type || 'async',
        description: hookConfig.description || '',
        callback: this.createCallbackFromConfig(hookConfig),
        priority: hookConfig.priority || 0,
        enabled: hookConfig.enabled !== false,
        conditions: hookConfig.conditions || [],
      };

      this.registerHook(hookDef);
    }

    // Load webhooks
    const webhooks = config.integration?.webhooks || [];
    for (const webhook of webhooks) {
      this.registry.registerWebhook(webhook);
    }
  }

  /**
   * Execute hooks for an event
   */
  async trigger(event: HookEvent, data?: any, config?: any, metadata?: Record<string, any>): Promise<any> {
    return this.executor.executeHooks(event, data, config, metadata);
  }

  /**
   * Get registry for direct access
   */
  getRegistry(): HookRegistry {
    return this.registry;
  }

  /**
   * Create example hooks configuration
   */
  static createExampleConfig(): any {
    return {
      integration: {
        hooks: [
          {
            name: 'slack-notification',
            event: 'after-analysis',
            type: 'async',
            description: 'Send analysis results to Slack',
            command: 'curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL -d @-',
            conditions: [
              {
                type: 'config',
                path: 'notifications.slack.enabled',
                operator: 'equals',
                value: true,
              },
            ],
          },
          {
            name: 'git-commit-results',
            event: 'after-analysis',
            type: 'waterfall',
            description: 'Commit analysis results to git',
            command: 'git add analysis-results.json && git commit -m "Update analysis results"',
            conditions: [
              {
                type: 'config',
                path: 'git.autoCommit',
                operator: 'equals',
                value: true,
              },
            ],
          },
        ],
        webhooks: [
          {
            url: 'https://api.example.com/wundr-webhook',
            method: 'POST',
            events: ['after-analysis', 'error-occurred'],
            headers: {
              'Authorization': 'Bearer ${WEBHOOK_TOKEN}',
            },
          },
        ],
      },
    };
  }

  /**
   * Create callback from configuration
   */
  private createCallbackFromConfig(hookConfig: any): HookCallback {
    return async (context: HookContext) => {
      if (hookConfig.command) {
        // Execute shell command
        const { ScriptExecutor } = await import('../security/ScriptExecutor');
        const executor = new ScriptExecutor();
        const result = await executor.executeCommand(hookConfig.command);
        if (result.exitCode !== 0) {
          console.error(`Hook command failed: ${result.stderr}`);
        }
        return context.data;
      }

      if (hookConfig.script) {
        // Execute JavaScript/TypeScript
        const Function = eval; // Note: This is unsafe in production
        const script = Function(hookConfig.script);
        return script(context);
      }

      return context.data;
    };
  }
}

export default HookSystem;