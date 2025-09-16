/**
 * Plugin hook registry implementation
 */

import { getLogger, getEventBus } from '@wundr.io/core';
import {
  PluginHook,
  PluginHookRegistry,
  PLUGIN_EVENTS,
} from '../types/index.js';

export class WundrHookRegistry implements PluginHookRegistry {
  private hooks = new Map<string, PluginHook[]>();
  private readonly logger = getLogger();
  private readonly eventBus = getEventBus();

  register<T>(name: string, hook: PluginHook<T>): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }

    const hooks = this.hooks.get(name)!;
    
    // Prevent duplicate registration
    if (!hooks.includes(hook)) {
      hooks.push(hook);
      
      this.logger.debug(`Hook registered: ${name}`, {
        hookName: name,
        hookDescription: hook.description,
        totalHooks: hooks.length,
      });

      this.eventBus.emit(PLUGIN_EVENTS.HOOK_REGISTERED, {
        name,
        hook,
        totalHooks: hooks.length,
      });
    }
  }

  unregister(name: string, hook: PluginHook): void {
    const hooks = this.hooks.get(name);
    if (!hooks) {
      return;
    }

    const index = hooks.indexOf(hook);
    if (index !== -1) {
      hooks.splice(index, 1);
      
      this.logger.debug(`Hook unregistered: ${name}`, {
        hookName: name,
        remainingHooks: hooks.length,
      });

      this.eventBus.emit(PLUGIN_EVENTS.HOOK_UNREGISTERED, {
        name,
        hook,
        remainingHooks: hooks.length,
      });

      // Clean up empty hook arrays
      if (hooks.length === 0) {
        this.hooks.delete(name);
      }
    }
  }

  async execute<T>(name: string, ...args: any[]): Promise<T[]> {
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) {
      return [];
    }

    const results: T[] = [];
    const startTime = performance.now();

    this.logger.debug(`Executing hooks: ${name}`, {
      hookName: name,
      hookCount: hooks.length,
      args: args.map(arg => typeof arg),
    });

    for (const hook of hooks) {
      try {
        const hookStartTime = performance.now();
        const result = await hook.execute(...args);
        const duration = performance.now() - hookStartTime;
        
        results.push(result);
        
        this.logger.debug(`Hook executed successfully: ${name}`, {
          hookName: name,
          duration: `${duration.toFixed(2)}ms`,
        });
      } catch (error) {
        this.logger.error(`Hook execution failed: ${name}`, {
          hookName: name,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Continue with other hooks even if one fails
        continue;
      }
    }

    const totalDuration = performance.now() - startTime;
    
    this.eventBus.emit(PLUGIN_EVENTS.HOOK_EXECUTED, {
      name,
      args,
      resultCount: results.length,
      duration: totalDuration,
    });

    return results;
  }

  executeSync<T>(name: string, ...args: any[]): T[] {
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) {
      return [];
    }

    const results: T[] = [];
    const startTime = performance.now();

    this.logger.debug(`Executing hooks synchronously: ${name}`, {
      hookName: name,
      hookCount: hooks.length,
    });

    for (const hook of hooks) {
      try {
        const hookStartTime = performance.now();
        const result = hook.execute(...args);
        const duration = performance.now() - hookStartTime;
        
        // Ensure we're not dealing with a Promise
        if (result && typeof result === 'object' && 'then' in result) {
          this.logger.warn(`Hook ${name} returned a Promise in synchronous execution`);
          continue;
        }
        
        results.push(result as T);
        
        this.logger.debug(`Hook executed synchronously: ${name}`, {
          hookName: name,
          duration: `${duration.toFixed(2)}ms`,
        });
      } catch (error) {
        this.logger.error(`Synchronous hook execution failed: ${name}`, {
          hookName: name,
          error: error instanceof Error ? error.message : String(error),
        });
        
        continue;
      }
    }

    const totalDuration = performance.now() - startTime;
    
    this.eventBus.emit(PLUGIN_EVENTS.HOOK_EXECUTED, {
      name,
      args,
      resultCount: results.length,
      duration: totalDuration,
      synchronous: true,
    });

    return results;
  }

  has(name: string): boolean {
    const hooks = this.hooks.get(name);
    return hooks !== undefined && hooks.length > 0;
  }

  getHooks(name: string): PluginHook[] {
    return [...(this.hooks.get(name) || [])];
  }

  clear(name?: string): void {
    if (name) {
      const hooks = this.hooks.get(name);
      if (hooks) {
        this.hooks.delete(name);
        
        this.logger.debug(`Cleared hooks: ${name}`, {
          hookName: name,
          clearedCount: hooks.length,
        });
      }
    } else {
      const totalHooks = Array.from(this.hooks.values()).reduce(
        (sum, hooks) => sum + hooks.length,
        0
      );
      
      this.hooks.clear();
      
      this.logger.debug('Cleared all hooks', {
        clearedCount: totalHooks,
      });
    }
  }

  /**
   * Get all registered hook names
   */
  getHookNames(): string[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get statistics about registered hooks
   */
  getStats(): {
    totalHookNames: number;
    totalHooks: number;
    hooksByName: Record<string, number>;
  } {
    const hooksByName: Record<string, number> = {};
    let totalHooks = 0;

    for (const [name, hooks] of this.hooks) {
      hooksByName[name] = hooks.length;
      totalHooks += hooks.length;
    }

    return {
      totalHookNames: this.hooks.size,
      totalHooks,
      hooksByName,
    };
  }
}

/**
 * Create a new hook registry instance
 */
export function createHookRegistry(): PluginHookRegistry {
  return new WundrHookRegistry();
}

// Default hook registry instance
let defaultHookRegistry: PluginHookRegistry;

/**
 * Get the default hook registry instance
 */
export function getHookRegistry(): PluginHookRegistry {
  if (!defaultHookRegistry) {
    defaultHookRegistry = new WundrHookRegistry();
  }
  return defaultHookRegistry;
}

/**
 * Set the default hook registry instance
 */
export function setDefaultHookRegistry(registry: PluginHookRegistry): void {
  defaultHookRegistry = registry;
}