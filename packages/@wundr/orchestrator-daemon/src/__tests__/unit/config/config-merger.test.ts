/**
 * Tests for the Config Merger module (src/config/config-merger.ts).
 *
 * Covers:
 *  - All 5 array merge strategies (concat, replace, union, prepend, byKey)
 *  - Deep object merging (recursive, source wins, missing keys)
 *  - Per-path array strategy overrides
 *  - mergeConfigSection with unsetOnUndefined
 *  - $include resolution (single, array, nested, circular detection, depth limit)
 *  - Environment variable substitution (happy, missing, escaped)
 *  - Runtime overrides (set, unset, apply, reset)
 *  - Config diff (diffConfigPaths)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  deepMerge,
  mergeConfigSection,
  resolveConfigIncludes,
  resolveEnvVars,
  setOverride,
  unsetOverride,
  getOverrides,
  resetOverrides,
  applyOverrides,
  diffConfigPaths,
  CircularIncludeError,
  ConfigIncludeError,
  MissingEnvVarError,
  INCLUDE_KEY,
  MAX_INCLUDE_DEPTH,
  type IncludeResolver,
} from '../../../config/config-merger';

// ---------------------------------------------------------------------------
// deepMerge -- Array Strategies
// ---------------------------------------------------------------------------

describe('deepMerge', () => {
  describe('array strategy: concat (default)', () => {
    it('should concatenate arrays', () => {
      const result = deepMerge([1, 2], [3, 4]);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should concatenate nested arrays within objects', () => {
      const target = { items: ['a', 'b'] };
      const source = { items: ['c'] };
      const result = deepMerge(target, source);
      expect(result).toEqual({ items: ['a', 'b', 'c'] });
    });

    it('should handle empty source array', () => {
      const result = deepMerge([1, 2], []);
      expect(result).toEqual([1, 2]);
    });

    it('should handle empty target array', () => {
      const result = deepMerge([], [3, 4]);
      expect(result).toEqual([3, 4]);
    });
  });

  describe('array strategy: replace', () => {
    it('should replace target array with source', () => {
      const result = deepMerge([1, 2], [3, 4], { arrayStrategy: 'replace' });
      expect(result).toEqual([3, 4]);
    });

    it('should replace nested arrays within objects', () => {
      const target = { items: ['a', 'b', 'c'] };
      const source = { items: ['x'] };
      const result = deepMerge(target, source, { arrayStrategy: 'replace' });
      expect(result).toEqual({ items: ['x'] });
    });

    it('should produce an empty array when source is empty', () => {
      const result = deepMerge([1, 2, 3], [], { arrayStrategy: 'replace' });
      expect(result).toEqual([]);
    });
  });

  describe('array strategy: union', () => {
    it('should deduplicate primitive values', () => {
      const result = deepMerge([1, 2, 3], [2, 3, 4], { arrayStrategy: 'union' });
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should deduplicate string values', () => {
      const result = deepMerge(['a', 'b'], ['b', 'c'], { arrayStrategy: 'union' });
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should not deduplicate objects (strict equality)', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 1 }; // different reference
      const result = deepMerge([obj1], [obj2], { arrayStrategy: 'union' });
      // obj2 is a different reference so it will be added
      expect(result).toEqual([{ id: 1 }, { id: 1 }]);
    });

    it('should keep all items if no duplicates exist', () => {
      const result = deepMerge([1, 2], [3, 4], { arrayStrategy: 'union' });
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should handle fully overlapping arrays', () => {
      const result = deepMerge([1, 2, 3], [1, 2, 3], { arrayStrategy: 'union' });
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('array strategy: prepend', () => {
    it('should prepend source before target', () => {
      const result = deepMerge([3, 4], [1, 2], { arrayStrategy: 'prepend' });
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should work with nested object arrays', () => {
      const target = { list: ['c', 'd'] };
      const source = { list: ['a', 'b'] };
      const result = deepMerge(target, source, { arrayStrategy: 'prepend' });
      expect(result).toEqual({ list: ['a', 'b', 'c', 'd'] });
    });

    it('should handle empty target', () => {
      const result = deepMerge([], [1, 2], { arrayStrategy: 'prepend' });
      expect(result).toEqual([1, 2]);
    });
  });

  describe('array strategy: byKey', () => {
    it('should merge array-of-objects by default key "id"', () => {
      const target = [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
      ];
      const source = [
        { id: 'b', value: 20, extra: true },
        { id: 'c', value: 3 },
      ];
      const result = deepMerge(target, source, { arrayStrategy: 'byKey' }) as any[];
      expect(result).toHaveLength(3);
      expect(result.find((r: any) => r.id === 'a')).toEqual({ id: 'a', value: 1 });
      expect(result.find((r: any) => r.id === 'b')).toEqual({ id: 'b', value: 20, extra: true });
      expect(result.find((r: any) => r.id === 'c')).toEqual({ id: 'c', value: 3 });
    });

    it('should use custom merge key', () => {
      const target = [{ name: 'alpha', score: 10 }];
      const source = [{ name: 'alpha', score: 20 }];
      const result = deepMerge(target, source, {
        arrayStrategy: 'byKey',
        arrayMergeKey: 'name',
      }) as any[];
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'alpha', score: 20 });
    });

    it('should append items without the merge key', () => {
      const target = [{ id: 'a', v: 1 }];
      const source = ['raw-string', 42];
      const result = deepMerge(target, source, { arrayStrategy: 'byKey' }) as any[];
      expect(result).toHaveLength(3);
      expect(result).toContain('raw-string');
      expect(result).toContain(42);
    });
  });

  // ---------------------------------------------------------------------------
  // Per-path array strategy overrides
  // ---------------------------------------------------------------------------

  describe('arrayStrategyByPath', () => {
    it('should apply path-specific strategy to matching paths', () => {
      const target = {
        agents: { list: [{ id: 'a', v: 1 }] },
        cors: { origins: ['http://a.com'] },
      };
      const source = {
        agents: { list: [{ id: 'a', v: 2 }, { id: 'b', v: 3 }] },
        cors: { origins: ['http://a.com', 'http://b.com'] },
      };
      const result = deepMerge(target, source, {
        arrayStrategy: 'concat', // default
        arrayStrategyByPath: {
          'agents.list': 'byKey',
          'cors.origins': 'union',
        },
      }) as any;

      // agents.list should be byKey-merged
      expect(result.agents.list).toHaveLength(2);
      expect(result.agents.list.find((a: any) => a.id === 'a')).toEqual({ id: 'a', v: 2 });

      // cors.origins should be union-merged
      expect(result.cors.origins).toEqual(['http://a.com', 'http://b.com']);
    });

    it('should fall back to default strategy for unmatched paths', () => {
      const target = { other: [1] };
      const source = { other: [2] };
      const result = deepMerge(target, source, {
        arrayStrategy: 'replace',
        arrayStrategyByPath: { 'foo.bar': 'union' },
      }) as any;
      // 'other' does not match 'foo.bar', so uses default 'replace'
      expect(result.other).toEqual([2]);
    });
  });

  // ---------------------------------------------------------------------------
  // Deep Object Merging
  // ---------------------------------------------------------------------------

  describe('deep object merging', () => {
    it('should recursively merge nested objects', () => {
      const target = { a: { b: { c: 1, d: 2 } } };
      const source = { a: { b: { c: 10, e: 3 } } };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: { b: { c: 10, d: 2, e: 3 } } });
    });

    it('should prefer source value for conflicting primitives', () => {
      const result = deepMerge({ a: 1 }, { a: 2 });
      expect(result).toEqual({ a: 2 });
    });

    it('should add new keys from source', () => {
      const result = deepMerge({ a: 1 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should not mutate the original objects', () => {
      const target = { a: { b: 1 } };
      const source = { a: { c: 2 } };
      const targetCopy = JSON.parse(JSON.stringify(target));
      const sourceCopy = JSON.parse(JSON.stringify(source));
      deepMerge(target, source);
      expect(target).toEqual(targetCopy);
      expect(source).toEqual(sourceCopy);
    });

    it('should replace object with primitive if source is primitive', () => {
      const result = deepMerge({ a: { nested: true } }, { a: 42 });
      expect(result).toEqual({ a: 42 });
    });

    it('should replace primitive with object if source is object', () => {
      const result = deepMerge({ a: 42 }, { a: { nested: true } });
      expect(result).toEqual({ a: { nested: true } });
    });

    it('should handle null values correctly', () => {
      const result = deepMerge({ a: { b: 1 } }, { a: null });
      expect(result).toEqual({ a: null });
    });

    it('should handle deeply nested structures', () => {
      const target = { l1: { l2: { l3: { l4: { val: 'old' } } } } };
      const source = { l1: { l2: { l3: { l4: { val: 'new', extra: true } } } } };
      const result = deepMerge(target, source) as any;
      expect(result.l1.l2.l3.l4).toEqual({ val: 'new', extra: true });
    });
  });

  // ---------------------------------------------------------------------------
  // mergeConfigSection
  // ---------------------------------------------------------------------------

  describe('mergeConfigSection', () => {
    it('should merge a patch into a base object', () => {
      const base = { host: '0.0.0.0', port: 8080 };
      const patch = { port: 9090 };
      const result = mergeConfigSection(base, patch);
      expect(result).toEqual({ host: '0.0.0.0', port: 9090 });
    });

    it('should skip undefined patch values by default', () => {
      const base = { a: 1, b: 2 };
      const patch = { a: undefined, b: 3 };
      const result = mergeConfigSection(base, patch);
      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should delete keys listed in unsetOnUndefined when patch value is undefined', () => {
      const base = { a: 1, b: 2, c: 3 } as Record<string, unknown>;
      const patch = { a: undefined };
      const result = mergeConfigSection(base, patch, { unsetOnUndefined: ['a'] });
      expect(result).not.toHaveProperty('a');
      expect(result).toEqual({ b: 2, c: 3 });
    });

    it('should handle undefined base', () => {
      const result = mergeConfigSection(undefined, { a: 1, b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  // ---------------------------------------------------------------------------
  // resolveConfigIncludes
  // ---------------------------------------------------------------------------

  describe('resolveConfigIncludes', () => {
    const createResolver = (files: Record<string, unknown>): IncludeResolver => ({
      readFile: (filePath: string) => {
        if (filePath in files) {
          return JSON.stringify(files[filePath]);
        }
        throw new Error(`ENOENT: ${filePath}`);
      },
      parseJson: (raw: string) => JSON.parse(raw),
    });

    it('should resolve a single $include string', () => {
      const resolver = createResolver({
        '/config/base.json': { port: 8080 },
      });
      const obj = { [INCLUDE_KEY]: '/config/base.json' };
      const result = resolveConfigIncludes(obj, '/config/main.json', resolver);
      expect(result).toEqual({ port: 8080 });
    });

    it('should resolve an $include array (merge in order)', () => {
      const resolver = createResolver({
        '/config/a.json': { a: 1, shared: 'from-a' },
        '/config/b.json': { b: 2, shared: 'from-b' },
      });
      const obj = { [INCLUDE_KEY]: ['/config/a.json', '/config/b.json'] };
      const result = resolveConfigIncludes(obj, '/config/main.json', resolver);
      expect(result).toEqual({ a: 1, b: 2, shared: 'from-b' });
    });

    it('should merge sibling keys with included content', () => {
      const resolver = createResolver({
        '/config/base.json': { port: 8080, host: '0.0.0.0' },
      });
      const obj = {
        [INCLUDE_KEY]: '/config/base.json',
        port: 9090,
      };
      const result = resolveConfigIncludes(obj, '/config/main.json', resolver) as any;
      expect(result.port).toBe(9090);
      expect(result.host).toBe('0.0.0.0');
    });

    it('should detect circular includes', () => {
      const resolver: IncludeResolver = {
        readFile: (filePath: string) => {
          if (filePath === '/a.json') {
return JSON.stringify({ [INCLUDE_KEY]: '/b.json' });
}
          if (filePath === '/b.json') {
return JSON.stringify({ [INCLUDE_KEY]: '/a.json' });
}
          throw new Error(`ENOENT: ${filePath}`);
        },
        parseJson: (raw: string) => JSON.parse(raw),
      };
      const obj = { [INCLUDE_KEY]: '/a.json' };
      expect(() =>
        resolveConfigIncludes(obj, '/main.json', resolver),
      ).toThrow(CircularIncludeError);
    });

    it('should enforce maximum include depth', () => {
      // Build a chain: file0 includes file1 includes file2 ... includes file11
      const files: Record<string, unknown> = {};
      for (let i = 0; i <= MAX_INCLUDE_DEPTH + 1; i++) {
        files[`/chain/${i}.json`] = { [INCLUDE_KEY]: `/chain/${i + 1}.json` };
      }
      files[`/chain/${MAX_INCLUDE_DEPTH + 2}.json`] = { end: true };

      const resolver = createResolver(files);
      const obj = { [INCLUDE_KEY]: '/chain/0.json' };
      expect(() =>
        resolveConfigIncludes(obj, '/start.json', resolver),
      ).toThrow(ConfigIncludeError);
    });

    it('should throw ConfigIncludeError when include file is not found', () => {
      const resolver = createResolver({});
      const obj = { [INCLUDE_KEY]: '/missing.json' };
      expect(() =>
        resolveConfigIncludes(obj, '/config/main.json', resolver),
      ).toThrow(ConfigIncludeError);
    });

    it('should throw ConfigIncludeError for invalid include value types', () => {
      const resolver = createResolver({});
      const obj = { [INCLUDE_KEY]: 42 };
      expect(() =>
        resolveConfigIncludes(obj, '/config/main.json', resolver),
      ).toThrow(ConfigIncludeError);
    });

    it('should pass through objects without $include unchanged', () => {
      const resolver = createResolver({});
      const obj = { port: 8080, host: '0.0.0.0' };
      const result = resolveConfigIncludes(obj, '/config/main.json', resolver);
      expect(result).toEqual({ port: 8080, host: '0.0.0.0' });
    });

    it('should recursively process nested $include directives', () => {
      const resolver = createResolver({
        '/config/partial.json': { nested: { [INCLUDE_KEY]: '/config/deep.json' } },
        '/config/deep.json': { value: 42 },
      });
      const obj = { [INCLUDE_KEY]: '/config/partial.json' };
      const result = resolveConfigIncludes(obj, '/config/main.json', resolver) as any;
      expect(result.nested).toEqual({ value: 42 });
    });
  });

  // ---------------------------------------------------------------------------
  // resolveEnvVars
  // ---------------------------------------------------------------------------

  describe('resolveEnvVars', () => {
    it('should substitute ${VAR} with env value', () => {
      const result = resolveEnvVars(
        { url: 'https://${HOST}:${PORT}' },
        { HOST: 'localhost', PORT: '8080' },
      ) as any;
      expect(result.url).toBe('https://localhost:8080');
    });

    it('should throw MissingEnvVarError for missing env var', () => {
      expect(() =>
        resolveEnvVars({ key: '${MISSING_VAR}' }, {}),
      ).toThrow(MissingEnvVarError);
    });

    it('should throw MissingEnvVarError for empty env var', () => {
      expect(() =>
        resolveEnvVars({ key: '${EMPTY_VAR}' }, { EMPTY_VAR: '' }),
      ).toThrow(MissingEnvVarError);
    });

    it('should preserve escaped $${VAR} as literal ${VAR}', () => {
      const result = resolveEnvVars(
        { escaped: '$${HOST}' },
        { HOST: 'should-not-resolve' },
      ) as any;
      expect(result.escaped).toBe('${HOST}');
    });

    it('should handle arrays', () => {
      const result = resolveEnvVars(
        ['${KEY_A}', '${KEY_B}'],
        { KEY_A: 'alpha', KEY_B: 'bravo' },
      );
      expect(result).toEqual(['alpha', 'bravo']);
    });

    it('should handle nested objects', () => {
      const result = resolveEnvVars(
        { outer: { inner: '${VALUE}' } },
        { VALUE: 'resolved' },
      ) as any;
      expect(result.outer.inner).toBe('resolved');
    });

    it('should leave non-string values unchanged', () => {
      const result = resolveEnvVars({ num: 42, flag: true, nil: null }, {});
      expect(result).toEqual({ num: 42, flag: true, nil: null });
    });

    it('should leave strings without $ unchanged', () => {
      const result = resolveEnvVars({ plain: 'hello world' }, {});
      expect(result).toEqual({ plain: 'hello world' });
    });

    it('should only match uppercase env var names', () => {
      // ${lowercase} should not be substituted
      const result = resolveEnvVars({ val: '${lowercase}' }, { lowercase: 'nope' });
      expect(result).toEqual({ val: '${lowercase}' });
    });
  });

  // ---------------------------------------------------------------------------
  // Runtime Overrides
  // ---------------------------------------------------------------------------

  describe('runtime overrides', () => {
    beforeEach(() => {
      resetOverrides();
    });

    it('should set a value at a dot path', () => {
      const result = setOverride('daemon.port', 9090);
      expect(result.ok).toBe(true);
      expect(getOverrides()).toEqual({ daemon: { port: 9090 } });
    });

    it('should set nested paths creating intermediate objects', () => {
      setOverride('a.b.c', 'deep');
      expect(getOverrides()).toEqual({ a: { b: { c: 'deep' } } });
    });

    it('should return error for empty path', () => {
      const result = setOverride('', 'value');
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should unset an existing override', () => {
      setOverride('daemon.port', 9090);
      const result = unsetOverride('daemon.port');
      expect(result.ok).toBe(true);
      expect(result.removed).toBe(true);
    });

    it('should report removed=false for non-existing override', () => {
      const result = unsetOverride('nonexistent.path');
      expect(result.ok).toBe(true);
      expect(result.removed).toBe(false);
    });

    it('should apply overrides to a config object', () => {
      setOverride('daemon.port', 9090);
      setOverride('daemon.host', '0.0.0.0');
      const config = { daemon: { port: 8080, host: '127.0.0.1', name: 'test' } };
      const result = applyOverrides(config) as any;
      expect(result.daemon.port).toBe(9090);
      expect(result.daemon.host).toBe('0.0.0.0');
      expect(result.daemon.name).toBe('test');
    });

    it('should return config unchanged when no overrides exist', () => {
      const config = { daemon: { port: 8080 } };
      expect(applyOverrides(config)).toEqual(config);
    });

    it('should reset all overrides', () => {
      setOverride('a', 1);
      setOverride('b', 2);
      resetOverrides();
      expect(getOverrides()).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // diffConfigPaths
  // ---------------------------------------------------------------------------

  describe('diffConfigPaths', () => {
    it('should return empty array for identical objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      expect(diffConfigPaths(obj, obj)).toEqual([]);
    });

    it('should detect changed primitive values', () => {
      const prev = { port: 8080 };
      const next = { port: 9090 };
      expect(diffConfigPaths(prev, next)).toEqual(['port']);
    });

    it('should detect nested changes', () => {
      const prev = { daemon: { port: 8080, host: '0.0.0.0' } };
      const next = { daemon: { port: 9090, host: '0.0.0.0' } };
      expect(diffConfigPaths(prev, next)).toEqual(['daemon.port']);
    });

    it('should detect added keys', () => {
      const prev = { a: 1 };
      const next = { a: 1, b: 2 };
      expect(diffConfigPaths(prev, next)).toEqual(['b']);
    });

    it('should detect removed keys', () => {
      const prev = { a: 1, b: 2 };
      const next = { a: 1 };
      expect(diffConfigPaths(prev, next)).toEqual(['b']);
    });

    it('should detect array changes', () => {
      const prev = { items: [1, 2, 3] };
      const next = { items: [1, 2, 4] };
      expect(diffConfigPaths(prev, next)).toEqual(['items']);
    });

    it('should treat identical arrays as equal', () => {
      const prev = { items: [1, 2, 3] };
      const next = { items: [1, 2, 3] };
      expect(diffConfigPaths(prev, next)).toEqual([]);
    });

    it('should return <root> for top-level primitive changes', () => {
      expect(diffConfigPaths(1, 2)).toEqual(['<root>']);
    });

    it('should report multiple changed paths', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const next = { a: 10, b: 2, c: 30 };
      const result = diffConfigPaths(prev, next);
      expect(result).toContain('a');
      expect(result).toContain('c');
      expect(result).not.toContain('b');
    });
  });
});
