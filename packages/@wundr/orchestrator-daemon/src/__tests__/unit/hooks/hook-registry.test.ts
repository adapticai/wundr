/**
 * Tests for the HookRegistry class (src/hooks/hook-registry.ts).
 *
 * Covers:
 *  - Hook registration (valid, invalid, replacement)
 *  - Hook deregistration
 *  - Hook lookup by event type
 *  - Priority-based ordering
 *  - Enable / disable toggling
 *  - Filtering of disabled hooks from getHooksForEvent
 *  - Config loading (loadFromConfig)
 *  - Per-hook overrides (applyOverrides)
 *  - Registry clearing
 *  - Diagnostics summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookRegistry, createHookRegistry } from '../../../hooks/hook-registry';

import type {
  HookRegistration,
  HooksConfig,
  HookLogger,
} from '../../../hooks/hook-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogger(): HookLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeHook(
  overrides: Partial<HookRegistration> & {
    id: string;
    event: HookRegistration['event'];
  }
): HookRegistration {
  return {
    type: 'command',
    command: 'echo ok',
    priority: 0,
    enabled: true,
    catchErrors: true,
    source: 'programmatic',
    ...overrides,
  } as HookRegistration;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HookRegistry', () => {
  let registry: HookRegistry;
  let logger: HookLogger;

  beforeEach(() => {
    logger = createLogger();
    registry = new HookRegistry({ logger });
  });

  // =========================================================================
  // Registration
  // =========================================================================

  describe('register', () => {
    it('should register a valid command hook', () => {
      registry.register(
        makeHook({ id: 'h1', event: 'SessionStart', command: 'echo hi' })
      );

      expect(registry.getHookById('h1')).toBeDefined();
      expect(registry.getHookById('h1')?.event).toBe('SessionStart');
    });

    it('should register a hook with a direct handler and no command', () => {
      registry.register(
        makeHook({
          id: 'h-handler',
          event: 'PostToolUse',
          type: 'command',
          command: undefined,
          handler: (async () => {}) as any,
        })
      );

      expect(registry.getHookById('h-handler')).toBeDefined();
    });

    it('should throw when id is missing', () => {
      expect(() =>
        registry.register({
          event: 'SessionStart',
          type: 'command',
          command: 'x',
        } as any)
      ).toThrow('must have an id');
    });

    it('should throw when event is missing', () => {
      expect(() =>
        registry.register({ id: 'x', type: 'command', command: 'y' } as any)
      ).toThrow('must have an event');
    });

    it('should throw when type and handler are both missing', () => {
      expect(() =>
        registry.register({ id: 'x', event: 'SessionStart' } as any)
      ).toThrow('must have a type');
    });

    it('should throw when command type has neither command nor handler', () => {
      expect(() =>
        registry.register({
          id: 'x',
          event: 'SessionStart',
          type: 'command',
        } as HookRegistration)
      ).toThrow('must have a command string or handler');
    });

    it('should throw when prompt type has neither promptTemplate nor handler', () => {
      expect(() =>
        registry.register({
          id: 'x',
          event: 'SessionStart',
          type: 'prompt',
        } as HookRegistration)
      ).toThrow('must have a promptTemplate or handler');
    });

    it('should replace an existing hook with the same id and log a warning', () => {
      registry.register(
        makeHook({ id: 'dup', event: 'SessionStart', command: 'first' })
      );
      registry.register(
        makeHook({ id: 'dup', event: 'SessionEnd', command: 'second' })
      );

      expect(registry.getHookById('dup')?.event).toBe('SessionEnd');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Replacing existing hook "dup"')
      );
    });

    it('should apply default timeout based on hook type', () => {
      registry.register(
        makeHook({
          id: 'cmd',
          event: 'SessionStart',
          type: 'command',
          command: 'x',
        })
      );
      expect(registry.getHookById('cmd')?.timeoutMs).toBe(10_000);

      registry.register(
        makeHook({
          id: 'pmt',
          event: 'SessionStart',
          type: 'prompt',
          promptTemplate: 'x',
        })
      );
      expect(registry.getHookById('pmt')?.timeoutMs).toBe(30_000);

      registry.register(
        makeHook({
          id: 'agt',
          event: 'SessionStart',
          type: 'agent',
          agentConfig: 'x',
        } as any)
      );
      expect(registry.getHookById('agt')?.timeoutMs).toBe(60_000);
    });

    it('should honour an explicit timeoutMs over the default', () => {
      registry.register(
        makeHook({
          id: 'h',
          event: 'SessionStart',
          command: 'x',
          timeoutMs: 999,
        })
      );
      expect(registry.getHookById('h')?.timeoutMs).toBe(999);
    });

    it('should default enabled to true and source to programmatic', () => {
      // Register without specifying enabled or source so the registry applies its defaults.
      registry.register({
        id: 'h',
        event: 'SessionStart',
        type: 'command',
        command: 'x',
      } as HookRegistration);
      const h = registry.getHookById('h');
      expect(h?.enabled).toBe(true);
      expect(h?.source).toBe('programmatic');
    });
  });

  // =========================================================================
  // Deregistration
  // =========================================================================

  describe('unregister', () => {
    it('should remove a registered hook and return true', () => {
      registry.register(
        makeHook({ id: 'h1', event: 'SessionStart', command: 'x' })
      );
      expect(registry.unregister('h1')).toBe(true);
      expect(registry.getHookById('h1')).toBeUndefined();
    });

    it('should return false when hook id does not exist', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('should remove the hook from the event index', () => {
      registry.register(
        makeHook({ id: 'h1', event: 'PostToolUse', command: 'x' })
      );
      registry.unregister('h1');
      expect(registry.getHooksForEvent('PostToolUse')).toHaveLength(0);
    });
  });

  // =========================================================================
  // Query by event
  // =========================================================================

  describe('getHooksForEvent', () => {
    it('should return an empty array when no hooks are registered for the event', () => {
      expect(registry.getHooksForEvent('SessionStart')).toEqual([]);
    });

    it('should return only hooks for the requested event', () => {
      registry.register(
        makeHook({ id: 'a', event: 'SessionStart', command: 'x' })
      );
      registry.register(
        makeHook({ id: 'b', event: 'SessionEnd', command: 'x' })
      );
      registry.register(
        makeHook({ id: 'c', event: 'SessionStart', command: 'x' })
      );

      const hooks = registry.getHooksForEvent('SessionStart');
      expect(hooks).toHaveLength(2);
      expect(hooks.map(h => h.id).sort()).toEqual(['a', 'c']);
    });

    it('should exclude disabled hooks', () => {
      registry.register(
        makeHook({ id: 'a', event: 'Stop', command: 'x', enabled: true })
      );
      registry.register(
        makeHook({ id: 'b', event: 'Stop', command: 'x', enabled: false })
      );

      const hooks = registry.getHooksForEvent('Stop');
      expect(hooks).toHaveLength(1);
      expect(hooks[0].id).toBe('a');
    });

    it('should sort hooks by priority descending (higher first)', () => {
      registry.register(
        makeHook({
          id: 'low',
          event: 'PreToolUse',
          command: 'x',
          priority: -10,
        })
      );
      registry.register(
        makeHook({
          id: 'high',
          event: 'PreToolUse',
          command: 'x',
          priority: 100,
        })
      );
      registry.register(
        makeHook({ id: 'mid', event: 'PreToolUse', command: 'x', priority: 50 })
      );

      const hooks = registry.getHooksForEvent('PreToolUse');
      expect(hooks.map(h => h.id)).toEqual(['high', 'mid', 'low']);
    });
  });

  // =========================================================================
  // getAllHooks
  // =========================================================================

  describe('getAllHooks', () => {
    it('should return all hooks including disabled ones', () => {
      registry.register(
        makeHook({ id: 'a', event: 'SessionStart', command: 'x' })
      );
      registry.register(
        makeHook({ id: 'b', event: 'SessionEnd', command: 'y', enabled: false })
      );

      const all = registry.getAllHooks();
      expect(all).toHaveLength(2);
    });
  });

  // =========================================================================
  // Enable / Disable
  // =========================================================================

  describe('setEnabled', () => {
    it('should disable an enabled hook', () => {
      registry.register(makeHook({ id: 'h', event: 'Stop', command: 'x' }));

      expect(registry.setEnabled('h', false)).toBe(true);
      expect(registry.getHookById('h')?.enabled).toBe(false);
      expect(registry.getHooksForEvent('Stop')).toHaveLength(0);
    });

    it('should re-enable a disabled hook', () => {
      registry.register(
        makeHook({ id: 'h', event: 'Stop', command: 'x', enabled: false })
      );

      expect(registry.setEnabled('h', true)).toBe(true);
      expect(registry.getHookById('h')?.enabled).toBe(true);
      expect(registry.getHooksForEvent('Stop')).toHaveLength(1);
    });

    it('should return false for an unknown hook id', () => {
      expect(registry.setEnabled('nope', true)).toBe(false);
    });
  });

  // =========================================================================
  // clear
  // =========================================================================

  describe('clear', () => {
    it('should remove all registrations', () => {
      registry.register(
        makeHook({ id: 'a', event: 'SessionStart', command: 'x' })
      );
      registry.register(
        makeHook({ id: 'b', event: 'SessionEnd', command: 'y' })
      );
      registry.clear();

      expect(registry.getAllHooks()).toHaveLength(0);
      expect(registry.getHooksForEvent('SessionStart')).toHaveLength(0);
      expect(registry.getHooksForEvent('SessionEnd')).toHaveLength(0);
    });
  });

  // =========================================================================
  // loadFromConfig
  // =========================================================================

  describe('loadFromConfig', () => {
    it('should load hooks from a config object', () => {
      const config: HooksConfig = {
        hooks: [
          {
            id: 'cfg1',
            event: 'SessionStart',
            type: 'command',
            command: 'echo 1',
          },
          {
            id: 'cfg2',
            event: 'PostToolUse',
            type: 'command',
            command: 'echo 2',
          },
        ],
      };

      registry.loadFromConfig(config);

      expect(registry.getHookById('cfg1')).toBeDefined();
      expect(registry.getHookById('cfg1')?.source).toBe('config-file');
      expect(registry.getHookById('cfg2')).toBeDefined();
    });

    it('should skip loading when enabled is false', () => {
      const config: HooksConfig = {
        enabled: false,
        hooks: [
          { id: 'x', event: 'SessionStart', type: 'command', command: 'echo' },
        ],
      };

      registry.loadFromConfig(config);
      expect(registry.getAllHooks()).toHaveLength(0);
    });

    it('should apply defaultTimeoutMs from config', () => {
      const config: HooksConfig = {
        defaultTimeoutMs: 42_000,
        hooks: [
          { id: 'h1', event: 'SessionStart', type: 'command', command: 'echo' },
        ],
      };

      registry.loadFromConfig(config);
      expect(registry.getHookById('h1')?.timeoutMs).toBe(42_000);
    });

    it('should apply hookOverrides after loading hooks', () => {
      const config: HooksConfig = {
        hooks: [
          {
            id: 'h1',
            event: 'SessionStart',
            type: 'command',
            command: 'echo',
            priority: 0,
          },
        ],
        hookOverrides: {
          h1: { enabled: false, priority: 999 },
        },
      };

      registry.loadFromConfig(config);
      const h = registry.getHookById('h1');
      expect(h?.enabled).toBe(false);
      expect(h?.priority).toBe(999);
    });

    it('should log errors for invalid hook definitions without crashing', () => {
      const config: HooksConfig = {
        hooks: [
          {
            id: '',
            event: 'SessionStart',
            type: 'command',
            command: 'echo',
          } as any,
          {
            id: 'good',
            event: 'SessionStart',
            type: 'command',
            command: 'echo',
          },
        ],
      };

      registry.loadFromConfig(config);

      // The invalid one should not be registered; the good one should be.
      expect(registry.getHookById('good')).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not clear existing hooks when loading config', () => {
      registry.register(
        makeHook({ id: 'existing', event: 'Stop', command: 'x' })
      );

      registry.loadFromConfig({
        hooks: [
          { id: 'new', event: 'SessionStart', type: 'command', command: 'y' },
        ],
      });

      expect(registry.getHookById('existing')).toBeDefined();
      expect(registry.getHookById('new')).toBeDefined();
    });
  });

  // =========================================================================
  // applyOverrides
  // =========================================================================

  describe('applyOverrides', () => {
    it('should apply env override by merging environment variables', () => {
      registry.register(
        makeHook({
          id: 'h1',
          event: 'SessionStart',
          command: 'x',
          env: { A: '1' },
        })
      );

      registry.applyOverrides({
        h1: { env: { B: '2' } },
      });

      const h = registry.getHookById('h1');
      expect(h?.env).toEqual({ A: '1', B: '2' });
    });

    it('should match overrides by hook name when id does not match', () => {
      registry.register(
        makeHook({
          id: 'discovered:my-hook:SessionStart',
          name: 'my-hook',
          event: 'SessionStart',
          command: 'x',
        })
      );

      registry.applyOverrides({
        'my-hook': { timeoutMs: 5000 },
      });

      expect(
        registry.getHookById('discovered:my-hook:SessionStart')?.timeoutMs
      ).toBe(5000);
    });

    it('should silently ignore overrides for unknown hooks', () => {
      registry.applyOverrides({ unknown: { enabled: false } });
      // No error should be thrown; debug log should indicate no match.
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('did not match any registered hook')
      );
    });
  });

  // =========================================================================
  // getSummary
  // =========================================================================

  describe('getSummary', () => {
    it('should return accurate statistics', () => {
      registry.register(
        makeHook({
          id: 'a',
          event: 'SessionStart',
          command: 'x',
          source: 'built-in',
        })
      );
      registry.register(
        makeHook({
          id: 'b',
          event: 'SessionStart',
          command: 'y',
          enabled: false,
          source: 'config-file',
        })
      );
      registry.register(
        makeHook({
          id: 'c',
          event: 'PostToolUse',
          command: 'z',
          source: 'built-in',
        })
      );

      const summary = registry.getSummary();

      expect(summary.totalHooks).toBe(3);
      expect(summary.enabledHooks).toBe(2);
      expect(summary.disabledHooks).toBe(1);
      expect(summary.hooksByEvent).toEqual({ SessionStart: 2, PostToolUse: 1 });
      expect(summary.hooksBySource).toEqual({
        'built-in': 2,
        'config-file': 1,
      });
    });
  });

  // =========================================================================
  // createHookRegistry factory
  // =========================================================================

  describe('createHookRegistry', () => {
    it('should create a registry and optionally load config', () => {
      const reg = createHookRegistry({
        logger,
        config: {
          hooks: [
            {
              id: 'f1',
              event: 'SessionStart',
              type: 'command',
              command: 'echo',
            },
          ],
        },
      });

      expect(reg.getHookById('f1')).toBeDefined();
    });

    it('should create an empty registry when called with no args', () => {
      const reg = createHookRegistry();
      expect(reg.getAllHooks()).toHaveLength(0);
    });
  });
});
