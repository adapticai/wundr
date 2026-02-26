/**
 * DefaultToolRegistry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DefaultToolRegistry, createToolRegistry } from '../tool-registry';

import type { ToolHandler, ToolDescription } from '../tool-registry';

// =============================================================================
// Helpers
// =============================================================================

function makeDescription(name: string, desc = 'A test tool'): ToolDescription {
  return {
    name,
    description: desc,
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('DefaultToolRegistry', () => {
  let registry: DefaultToolRegistry;

  beforeEach(() => {
    registry = new DefaultToolRegistry();
  });

  // ---------------------------------------------------------------------------
  // Registration & Unregistration
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('should register a tool handler by name', () => {
      const handler: ToolHandler = vi.fn(async () => 'ok');

      registry.register('echo', handler);

      expect(registry.has('echo')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should store the description when provided', () => {
      const handler: ToolHandler = vi.fn(async () => 'ok');
      const desc = makeDescription('echo');

      registry.register('echo', handler, desc);

      const tools = registry.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('echo');
    });

    it('should silently replace existing handler on duplicate registration', () => {
      const first: ToolHandler = vi.fn(async () => 'first');
      const second: ToolHandler = vi.fn(async () => 'second');

      registry.register('dup', first, makeDescription('dup'));
      registry.register('dup', second, makeDescription('dup', 'Updated'));

      expect(registry.size).toBe(1);
      expect(registry.listTools()).toHaveLength(1);
      expect(registry.listTools()[0].description).toBe('Updated');
    });
  });

  describe('unregister', () => {
    it('should remove both handler and description', () => {
      registry.register('temp', vi.fn(async () => 'x'), makeDescription('temp'));
      expect(registry.has('temp')).toBe(true);

      registry.unregister('temp');

      expect(registry.has('temp')).toBe(false);
      expect(registry.size).toBe(0);
      expect(registry.listTools()).toHaveLength(0);
    });

    it('should no-op when unregistering a non-existent tool', () => {
      expect(() => registry.unregister('ghost')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  describe('execute', () => {
    it('should call the registered handler and return its result', async () => {
      const handler: ToolHandler = vi.fn(async (args) => `Hello ${args.value}`);
      registry.register('greet', handler);

      const result = await registry.execute('greet', { value: 'World' });

      expect(result).toBe('Hello World');
      expect(handler).toHaveBeenCalledWith({ value: 'World' });
    });

    it('should throw when executing an unregistered tool', async () => {
      await expect(registry.execute('missing', {})).rejects.toThrow(
        /No handler registered for tool: "missing"/,
      );
    });

    it('should wrap handler errors with a descriptive message', async () => {
      const failing: ToolHandler = vi.fn(async () => {
        throw new Error('disk full');
      });
      registry.register('fail', failing);

      await expect(registry.execute('fail', {})).rejects.toThrow(
        /Tool "fail" execution failed: disk full/,
      );
    });

    it('should wrap non-Error throws with String coercion', async () => {
      const failing: ToolHandler = vi.fn(async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });
      registry.register('fail-str', failing);

      await expect(registry.execute('fail-str', {})).rejects.toThrow(
        /Tool "fail-str" execution failed: string error/,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  describe('listTools', () => {
    it('should return only tools that have a description', () => {
      registry.register('with-desc', vi.fn(async () => null), makeDescription('with-desc'));
      registry.register('no-desc', vi.fn(async () => null));

      const tools = registry.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('with-desc');
    });
  });

  describe('toToolDefinitions', () => {
    it('should convert descriptions to ToolDefinition format', () => {
      registry.register('alpha', vi.fn(async () => null), makeDescription('alpha'));
      registry.register('beta', vi.fn(async () => null), makeDescription('beta'));

      const defs = registry.toToolDefinitions();

      expect(defs).toHaveLength(2);
      expect(defs[0]).toEqual(
        expect.objectContaining({ name: 'alpha', description: 'A test tool' }),
      );
      expect(defs[1]).toEqual(
        expect.objectContaining({ name: 'beta', description: 'A test tool' }),
      );
      expect(defs[0]).toHaveProperty('inputSchema');
    });

    it('should skip tools without descriptions', () => {
      registry.register('hidden', vi.fn(async () => null));

      expect(registry.toToolDefinitions()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  describe('createToolRegistry', () => {
    it('should return a fresh DefaultToolRegistry instance', () => {
      const created = createToolRegistry();
      expect(created).toBeInstanceOf(DefaultToolRegistry);
      expect(created.size).toBe(0);
    });
  });
});
