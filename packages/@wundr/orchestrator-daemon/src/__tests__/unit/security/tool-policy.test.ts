/**
 * Tests for the tool-policy security module (src/security/tool-policy.ts).
 *
 * Covers:
 *  - Pattern cache (LRU bounded at 256)
 *  - Tool categories with risk levels
 *  - Argument validation (5 check types: required, forbidden, pattern, max-length, one-of)
 *  - Per-tool rate limiting
 *  - Session-scoped tool permissions (grants, revocations)
 *  - Audit logging (10K bounded buffer, listeners)
 *  - Policy evaluation (allow / deny / require-approval)
 *  - Glob/wildcard pattern matching
 *  - Edge cases (aliases, normalization, empty inputs, error classes)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  // Core evaluation
  isToolAllowedByPolicy,
  isToolAllowedByPolicies,
  evaluateToolPolicy,
  evaluateToolAccess,

  // Filtering
  filterToolNamesByPolicy,
  filterToolsByPolicy,
  filterToolsByPolicies,

  // Pattern cache
  clearPatternCache,
  getPatternCacheSize,

  // Tool categories
  getToolClassification,
  getToolsByCategory,
  getToolsAtOrAboveRisk,
  toolRequiresApproval,

  // Argument validation
  validateToolArguments,

  // Rate limiting
  checkToolRateLimit,
  getToolRateLimitStatus,

  // Session permissions
  createSessionToolPermissions,
  grantSessionTool,
  revokeSessionTool,
  isToolAllowedBySession,

  // Audit logging
  ToolAuditLogger,

  // Resolution helpers
  resolveSubagentToolPolicy,
  resolveGroupToolPolicy,
  resolveToolProfilePolicy,
  resolveEffectiveToolPolicy,
  collectPolicies,

  // Utility exports
  normalizeToolName,
  normalizeToolList,
  expandToolGroups,
  getDefaultSubagentDenyList,
  isDefaultSubagentDenied,
  collectExplicitAllowlist,

  // Error types
  ToolPolicyDeniedError,
  ToolArgumentValidationError,
  ToolRateLimitError,

  // Types
  type ToolPolicy,
  type EffectiveToolPolicies,
  type SessionToolPermissions,
  type WundrToolPolicyConfig,
  TOOL_GROUPS,
} from '../../../security/tool-policy';

// =============================================================================
// Helpers
// =============================================================================

/** Create a minimal session for rate-limit / audit testing. */
function makeSession(id = 'test-session'): SessionToolPermissions {
  return createSessionToolPermissions({ sessionId: id });
}

/** Create a config with rate limits for a specific tool. */
function makeRateLimitConfig(
  tool: string,
  maxInvocations: number,
  windowMs: number
): WundrToolPolicyConfig {
  return {
    tools: {
      rateLimits: {
        [tool]: { maxInvocations, windowMs },
      },
    },
  };
}

/** Create a config with argument rules. */
function makeArgRuleConfig(
  tool: string,
  rules: WundrToolPolicyConfig['tools'] extends { argumentRules?: infer R }
    ? R extends Record<string, infer V>
      ? V
      : never
    : never
): WundrToolPolicyConfig {
  return {
    tools: {
      argumentRules: {
        [tool]: rules,
      },
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('tool-policy', () => {
  // ---------------------------------------------------------------------------
  // Cleanup between tests -- reset caches, audit state, and listeners.
  // ---------------------------------------------------------------------------
  beforeEach(() => {
    clearPatternCache();
    ToolAuditLogger.clear();
    ToolAuditLogger.clearListeners();
  });

  afterEach(() => {
    ToolAuditLogger.clearListeners();
  });

  // ===========================================================================
  // normalizeToolName
  // ===========================================================================

  describe('normalizeToolName', () => {
    it('should lowercase and trim tool names', () => {
      expect(normalizeToolName('  File_Read  ')).toBe('file_read');
      expect(normalizeToolName('FILE_WRITE')).toBe('file_write');
    });

    it('should resolve known aliases', () => {
      expect(normalizeToolName('bash')).toBe('bash_execute');
      expect(normalizeToolName('read')).toBe('file_read');
      expect(normalizeToolName('write')).toBe('file_write');
      expect(normalizeToolName('edit')).toBe('file_edit');
      expect(normalizeToolName('delete')).toBe('file_delete');
      expect(normalizeToolName('list')).toBe('file_list');
      expect(normalizeToolName('fetch')).toBe('web_fetch');
      expect(normalizeToolName('search')).toBe('web_search');
    });

    it('should return non-aliased names as-is (lowercased)', () => {
      expect(normalizeToolName('custom_tool')).toBe('custom_tool');
    });

    it('should handle empty and whitespace-only strings', () => {
      expect(normalizeToolName('')).toBe('');
      expect(normalizeToolName('   ')).toBe('');
    });
  });

  // ===========================================================================
  // normalizeToolList
  // ===========================================================================

  describe('normalizeToolList', () => {
    it('should normalize all entries and filter empties', () => {
      const result = normalizeToolList(['  Bash  ', '', 'READ', '   ']);
      expect(result).toEqual(['bash_execute', 'file_read']);
    });

    it('should return empty array for undefined or non-array input', () => {
      expect(normalizeToolList(undefined)).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(normalizeToolList(null as any)).toEqual([]);
    });
  });

  // ===========================================================================
  // expandToolGroups
  // ===========================================================================

  describe('expandToolGroups', () => {
    it('should expand group:fs to file tools', () => {
      const result = expandToolGroups(['group:fs']);
      expect(result).toContain('file_read');
      expect(result).toContain('file_write');
      expect(result).toContain('file_list');
      expect(result).toContain('file_delete');
      expect(result).toContain('file_edit');
    });

    it('should expand group:runtime to bash_execute', () => {
      expect(expandToolGroups(['group:runtime'])).toEqual(['bash_execute']);
    });

    it('should pass through non-group patterns unchanged', () => {
      const result = expandToolGroups(['file_read', 'custom_tool']);
      expect(result).toEqual(['file_read', 'custom_tool']);
    });

    it('should deduplicate results', () => {
      const result = expandToolGroups(['group:fs', 'file_read']);
      const fileReadOccurrences = result.filter(t => t === 'file_read');
      expect(fileReadOccurrences.length).toBe(1);
    });

    it('should handle empty/undefined input', () => {
      expect(expandToolGroups(undefined)).toEqual([]);
      expect(expandToolGroups([])).toEqual([]);
    });

    it('should normalize entries before expansion', () => {
      // "Bash" alias -> "bash_execute" -> not a group, passed through
      const result = expandToolGroups(['Bash']);
      expect(result).toEqual(['bash_execute']);
    });
  });

  // ===========================================================================
  // Pattern Cache (LRU 256)
  // ===========================================================================

  describe('pattern cache', () => {
    it('should start empty after clearPatternCache', () => {
      expect(getPatternCacheSize()).toBe(0);
    });

    it('should grow as patterns are compiled', () => {
      isToolAllowedByPolicy('file_read', { allow: ['file_*'] });
      expect(getPatternCacheSize()).toBeGreaterThan(0);
    });

    it('should cache and reuse compiled patterns', () => {
      const policy: ToolPolicy = { allow: ['file_*'], deny: ['file_delete'] };

      isToolAllowedByPolicy('file_read', policy);
      const sizeAfterFirst = getPatternCacheSize();

      isToolAllowedByPolicy('file_write', policy);
      const sizeAfterSecond = getPatternCacheSize();

      // Same pattern lists should not create new cache entries.
      expect(sizeAfterSecond).toBe(sizeAfterFirst);
    });

    it('should evict entries when exceeding 256 limit', () => {
      // Fill the cache beyond 256 by creating unique pattern lists.
      for (let i = 0; i < 270; i++) {
        isToolAllowedByPolicy('file_read', { allow: [`unique_tool_${i}`] });
      }

      // Cache should be at most 256.
      expect(getPatternCacheSize()).toBeLessThanOrEqual(256);
    });

    it('should produce correct results after eviction', () => {
      // Fill cache to trigger evictions.
      for (let i = 0; i < 260; i++) {
        isToolAllowedByPolicy('file_read', { allow: [`filler_${i}`] });
      }

      // Re-evaluate an early pattern that was likely evicted.
      expect(isToolAllowedByPolicy('filler_0', { allow: ['filler_0'] })).toBe(
        true
      );
      expect(isToolAllowedByPolicy('filler_0', { allow: ['filler_1'] })).toBe(
        false
      );
    });
  });

  // ===========================================================================
  // Single-Layer Policy Evaluation (isToolAllowedByPolicy)
  // ===========================================================================

  describe('isToolAllowedByPolicy', () => {
    it('should allow everything when no policy is provided', () => {
      expect(isToolAllowedByPolicy('anything')).toBe(true);
      expect(isToolAllowedByPolicy('anything', undefined)).toBe(true);
    });

    it('should allow everything when policy has no allow or deny', () => {
      expect(isToolAllowedByPolicy('file_read', {})).toBe(true);
    });

    it('should deny tools matching a deny pattern', () => {
      const policy: ToolPolicy = { deny: ['bash_execute'] };
      expect(isToolAllowedByPolicy('bash_execute', policy)).toBe(false);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
    });

    it('should restrict to allowlist when allow is specified', () => {
      const policy: ToolPolicy = { allow: ['file_read', 'file_list'] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_list', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_write', policy)).toBe(false);
    });

    it('should deny taking precedence over allow', () => {
      const policy: ToolPolicy = { allow: ['file_*'], deny: ['file_delete'] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_delete', policy)).toBe(false);
    });

    it('should support the * wildcard (all tools)', () => {
      const policy: ToolPolicy = { allow: ['*'] };
      expect(isToolAllowedByPolicy('anything_here', policy)).toBe(true);
    });

    it('should handle deny with * wildcard', () => {
      const policy: ToolPolicy = { deny: ['*'] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(false);
    });

    it('should resolve aliases in tool name lookups', () => {
      const policy: ToolPolicy = { allow: ['bash_execute'] };
      // "bash" is an alias for "bash_execute"
      expect(isToolAllowedByPolicy('bash', policy)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const policy: ToolPolicy = { allow: ['FILE_READ'] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
      expect(isToolAllowedByPolicy('File_Read', policy)).toBe(true);
    });
  });

  // ===========================================================================
  // Glob / Wildcard Pattern Matching
  // ===========================================================================

  describe('glob pattern matching', () => {
    it('should match prefix wildcards (file_*)', () => {
      const policy: ToolPolicy = { allow: ['file_*'] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_write', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_delete', policy)).toBe(true);
      expect(isToolAllowedByPolicy('bash_execute', policy)).toBe(false);
    });

    it('should match suffix wildcards (*_execute)', () => {
      const policy: ToolPolicy = { allow: ['*_execute'] };
      expect(isToolAllowedByPolicy('bash_execute', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(false);
    });

    it('should match middle wildcards (file_*_v2)', () => {
      const policy: ToolPolicy = { allow: ['file_*_v2'] };
      expect(isToolAllowedByPolicy('file_read_v2', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(false);
    });

    it('should match ? for single character', () => {
      const policy: ToolPolicy = { allow: ['file_???'] };
      // "file_get" is 3 chars after underscore? No: file_??? means "file_" + 3 chars
      expect(isToolAllowedByPolicy('file_get', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(false); // 4 chars
    });

    it('should expand group references in patterns', () => {
      const policy: ToolPolicy = { allow: ['group:memory'] };
      expect(isToolAllowedByPolicy('memory_search', policy)).toBe(true);
      expect(isToolAllowedByPolicy('memory_get', policy)).toBe(true);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(false);
    });

    it('should support multiple patterns in deny', () => {
      const policy: ToolPolicy = {
        deny: ['bash_execute', 'file_delete', 'web_*'],
      };
      expect(isToolAllowedByPolicy('bash_execute', policy)).toBe(false);
      expect(isToolAllowedByPolicy('file_delete', policy)).toBe(false);
      expect(isToolAllowedByPolicy('web_fetch', policy)).toBe(false);
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
    });
  });

  // ===========================================================================
  // Multi-Layer Policy Evaluation (isToolAllowedByPolicies)
  // ===========================================================================

  describe('isToolAllowedByPolicies', () => {
    it('should allow when all layers permit', () => {
      const policies: Array<ToolPolicy | undefined> = [
        { allow: ['file_*'] },
        undefined, // no restriction
        { deny: ['bash_execute'] },
      ];
      expect(isToolAllowedByPolicies('file_read', policies)).toBe(true);
    });

    it('should deny when any layer denies', () => {
      const policies: Array<ToolPolicy | undefined> = [
        { allow: ['*'] },
        { deny: ['file_read'] },
      ];
      expect(isToolAllowedByPolicies('file_read', policies)).toBe(false);
    });

    it('should deny when not in a restrictive allowlist layer', () => {
      const policies: Array<ToolPolicy | undefined> = [
        { allow: ['file_read', 'file_write'] },
        { allow: ['file_read'] },
      ];
      // file_write is in layer 0 but not layer 1
      expect(isToolAllowedByPolicies('file_write', policies)).toBe(false);
    });

    it('should allow everything when all policies are undefined', () => {
      expect(isToolAllowedByPolicies('anything', [undefined, undefined])).toBe(
        true
      );
    });
  });

  // ===========================================================================
  // evaluateToolPolicy (detailed multi-layer)
  // ===========================================================================

  describe('evaluateToolPolicy', () => {
    it('should return allowed=true with classification for permitted tools', () => {
      const policies: EffectiveToolPolicies = {};
      const result = evaluateToolPolicy('file_read', policies);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('read-only');
      expect(result.riskLevel).toBe('none');
    });

    it('should identify the denying layer', () => {
      const policies: EffectiveToolPolicies = {
        globalPolicy: { deny: ['bash_execute'] },
      };
      const result = evaluateToolPolicy('bash_execute', policies);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('global');
      expect(result.deniedByPattern).toBe('bash_execute');
    });

    it('should check layers in order: global -> provider -> agent -> group -> subagent', () => {
      // Agent policy denies file_write, but global allows it.
      const policies: EffectiveToolPolicies = {
        agentPolicy: { deny: ['file_write'] },
      };
      const result = evaluateToolPolicy('file_write', policies);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('agent');
    });

    it('should identify subagent layer denial', () => {
      const policies: EffectiveToolPolicies = {
        subagentPolicy: { deny: ['bash_execute'] },
      };
      const result = evaluateToolPolicy('bash_execute', policies);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('subagent');
    });

    it('should mark execute category tools as requiring approval', () => {
      const policies: EffectiveToolPolicies = {};
      const result = evaluateToolPolicy('bash_execute', policies);
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.category).toBe('execute');
      expect(result.riskLevel).toBe('high');
    });

    it('should not require approval for read-only tools', () => {
      const policies: EffectiveToolPolicies = {};
      const result = evaluateToolPolicy('file_read', policies);
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBeFalsy();
    });

    it('should return deniedByPattern as the pattern string for wildcard denials', () => {
      const policies: EffectiveToolPolicies = {
        globalPolicy: { deny: ['file_*'] },
      };
      const result = evaluateToolPolicy('file_read', policies);
      expect(result.allowed).toBe(false);
      expect(result.deniedByPattern).toBe('file_*');
    });
  });

  // ===========================================================================
  // Tool Categories with Risk Levels
  // ===========================================================================

  describe('tool categories and risk levels', () => {
    describe('getToolClassification', () => {
      it('should classify known read-only tools', () => {
        const info = getToolClassification('file_read');
        expect(info).toEqual({ category: 'read-only', riskLevel: 'none' });
      });

      it('should classify write tools', () => {
        const info = getToolClassification('file_write');
        expect(info).toEqual({ category: 'write', riskLevel: 'low' });
      });

      it('should classify file_delete as medium risk', () => {
        const info = getToolClassification('file_delete');
        expect(info).toEqual({ category: 'write', riskLevel: 'medium' });
      });

      it('should classify execute tools as high risk', () => {
        const info = getToolClassification('bash_execute');
        expect(info).toEqual({ category: 'execute', riskLevel: 'high' });
      });

      it('should classify network tools', () => {
        expect(getToolClassification('web_fetch')).toEqual({
          category: 'network',
          riskLevel: 'medium',
        });
        expect(getToolClassification('web_search')).toEqual({
          category: 'network',
          riskLevel: 'low',
        });
      });

      it('should classify session tools', () => {
        expect(getToolClassification('session_spawn')).toEqual({
          category: 'session',
          riskLevel: 'medium',
        });
        expect(getToolClassification('session_status')).toEqual({
          category: 'session',
          riskLevel: 'none',
        });
      });

      it('should return undefined for unknown tools', () => {
        expect(getToolClassification('unknown_tool')).toBeUndefined();
      });

      it('should resolve aliases before lookup', () => {
        expect(getToolClassification('bash')).toEqual({
          category: 'execute',
          riskLevel: 'high',
        });
        expect(getToolClassification('read')).toEqual({
          category: 'read-only',
          riskLevel: 'none',
        });
      });
    });

    describe('getToolsByCategory', () => {
      it('should return all read-only tools', () => {
        const tools = getToolsByCategory('read-only');
        expect(tools).toContain('file_read');
        expect(tools).toContain('file_list');
        expect(tools).toContain('memory_search');
        expect(tools).not.toContain('file_write');
      });

      it('should return all execute tools', () => {
        const tools = getToolsByCategory('execute');
        expect(tools).toContain('bash_execute');
        expect(tools).not.toContain('file_read');
      });

      it('should return empty for categories with no built-in tools', () => {
        const tools = getToolsByCategory('admin');
        expect(tools).toEqual([]);
      });
    });

    describe('getToolsAtOrAboveRisk', () => {
      it('should return all tools at risk level "none" or above (i.e., all)', () => {
        const tools = getToolsAtOrAboveRisk('none');
        expect(tools.length).toBeGreaterThan(0);
        expect(tools).toContain('file_read');
        expect(tools).toContain('bash_execute');
      });

      it('should return only high and critical risk tools for "high"', () => {
        const tools = getToolsAtOrAboveRisk('high');
        expect(tools).toContain('bash_execute');
        expect(tools).not.toContain('file_read');
        expect(tools).not.toContain('web_fetch');
      });

      it('should return empty for invalid risk level', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(getToolsAtOrAboveRisk('invalid' as any)).toEqual([]);
      });

      it('should include medium+ tools for "medium"', () => {
        const tools = getToolsAtOrAboveRisk('medium');
        expect(tools).toContain('file_delete');
        expect(tools).toContain('web_fetch');
        expect(tools).toContain('bash_execute');
        expect(tools).not.toContain('file_read'); // none
        expect(tools).not.toContain('file_write'); // low
      });
    });

    describe('toolRequiresApproval', () => {
      it('should require approval for execute category by default', () => {
        expect(toolRequiresApproval('bash_execute')).toBe(true);
      });

      it('should not require approval for read-only tools', () => {
        expect(toolRequiresApproval('file_read')).toBe(false);
      });

      it('should not require approval for unknown tools', () => {
        expect(toolRequiresApproval('unknown_tool')).toBe(false);
      });

      it('should respect config-level category overrides', () => {
        const config: WundrToolPolicyConfig = {
          tools: {
            categories: {
              execute: { requiresApproval: false },
            },
          },
        };
        // Override: execute no longer requires approval.
        expect(toolRequiresApproval('bash_execute', config)).toBe(false);
      });

      it('should allow config to add approval to write category', () => {
        const config: WundrToolPolicyConfig = {
          tools: {
            categories: {
              write: { requiresApproval: true },
            },
          },
        };
        expect(toolRequiresApproval('file_write', config)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Argument Validation (5 check types)
  // ===========================================================================

  describe('argument validation', () => {
    describe('required check', () => {
      it('should pass when argument is present', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: '/tmp/test' },
          config
        );
        expect(result.valid).toBe(true);
      });

      it('should fail when argument is undefined', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required', reason: 'path is mandatory' },
        ]);
        const result = validateToolArguments('file_write', {}, config);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('path is mandatory');
        expect(result.failedRule?.argument).toBe('path');
      });

      it('should fail when argument is null', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: null },
          config
        );
        expect(result.valid).toBe(false);
      });

      it('should fail when argument is empty string', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: '' },
          config
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('forbidden check', () => {
      it('should pass when argument is absent', () => {
        const config = makeArgRuleConfig('bash_execute', [
          { argument: 'sudo', check: 'forbidden' },
        ]);
        const result = validateToolArguments(
          'bash_execute',
          { command: 'ls' },
          config
        );
        expect(result.valid).toBe(true);
      });

      it('should fail when forbidden argument is present', () => {
        const config = makeArgRuleConfig('bash_execute', [
          {
            argument: 'sudo',
            check: 'forbidden',
            reason: 'sudo is not allowed',
          },
        ]);
        const result = validateToolArguments(
          'bash_execute',
          { command: 'ls', sudo: true },
          config
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe('sudo is not allowed');
      });

      it('should pass when forbidden argument is null', () => {
        const config = makeArgRuleConfig('bash_execute', [
          { argument: 'sudo', check: 'forbidden' },
        ]);
        const result = validateToolArguments(
          'bash_execute',
          { sudo: null },
          config
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('pattern check', () => {
      it('should pass when value matches regex', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'pattern', pattern: '^/workspace/' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: '/workspace/foo.txt' },
          config
        );
        expect(result.valid).toBe(true);
      });

      it('should fail when value does not match regex', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'pattern', pattern: '^/workspace/' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: '/etc/passwd' },
          config
        );
        expect(result.valid).toBe(false);
      });

      it('should pass when value is undefined (not validated)', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'pattern', pattern: '^/workspace/' },
        ]);
        const result = validateToolArguments('file_write', {}, config);
        expect(result.valid).toBe(true);
      });

      it('should pass when no pattern is provided in the rule', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'pattern' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { path: 'anything' },
          config
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('max-length check', () => {
      it('should pass when value is within max length', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'content', check: 'max-length', maxLength: 100 },
        ]);
        const result = validateToolArguments(
          'file_write',
          { content: 'short' },
          config
        );
        expect(result.valid).toBe(true);
      });

      it('should fail when value exceeds max length', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'content', check: 'max-length', maxLength: 5 },
        ]);
        const result = validateToolArguments(
          'file_write',
          { content: 'this is too long' },
          config
        );
        expect(result.valid).toBe(false);
        expect(result.message).toContain('max length');
      });

      it('should pass when value is undefined', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'content', check: 'max-length', maxLength: 5 },
        ]);
        const result = validateToolArguments('file_write', {}, config);
        expect(result.valid).toBe(true);
      });

      it('should pass when maxLength is not specified (Infinity)', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'content', check: 'max-length' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { content: 'x'.repeat(10000) },
          config
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('one-of check', () => {
      it('should pass when value is in the allowed set', () => {
        const config = makeArgRuleConfig('file_write', [
          {
            argument: 'mode',
            check: 'one-of',
            values: ['overwrite', 'append'],
          },
        ]);
        const result = validateToolArguments(
          'file_write',
          { mode: 'overwrite' },
          config
        );
        expect(result.valid).toBe(true);
      });

      it('should fail when value is not in the allowed set', () => {
        const config = makeArgRuleConfig('file_write', [
          {
            argument: 'mode',
            check: 'one-of',
            values: ['overwrite', 'append'],
          },
        ]);
        const result = validateToolArguments(
          'file_write',
          { mode: 'truncate' },
          config
        );
        expect(result.valid).toBe(false);
        expect(result.message).toContain('one of');
      });

      it('should pass when value is undefined', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'mode', check: 'one-of', values: ['overwrite'] },
        ]);
        const result = validateToolArguments('file_write', {}, config);
        expect(result.valid).toBe(true);
      });

      it('should fail when values array is not specified', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'mode', check: 'one-of' },
        ]);
        const result = validateToolArguments(
          'file_write',
          { mode: 'anything' },
          config
        );
        expect(result.valid).toBe(false);
      });
    });

    describe('dot-notation nested argument paths', () => {
      it('should resolve nested arguments', () => {
        const config = makeArgRuleConfig('web_fetch', [
          {
            argument: 'options.headers.authorization',
            check: 'forbidden',
            reason: 'no auth headers',
          },
        ]);
        const result = validateToolArguments(
          'web_fetch',
          {
            url: 'https://example.com',
            options: { headers: { authorization: 'Bearer xyz' } },
          },
          config
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe('no auth headers');
      });

      it('should pass when nested path does not exist', () => {
        const config = makeArgRuleConfig('web_fetch', [
          { argument: 'options.headers.authorization', check: 'forbidden' },
        ]);
        const result = validateToolArguments(
          'web_fetch',
          {
            url: 'https://example.com',
          },
          config
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('multiple rules and rule ordering', () => {
      it('should stop at the first failing rule', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required', reason: 'first rule fails' },
          {
            argument: 'content',
            check: 'required',
            reason: 'second rule fails',
          },
        ]);
        // Both path and content are missing, but the first rule should be reported.
        const result = validateToolArguments('file_write', {}, config);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('first rule fails');
      });

      it('should pass when all rules are satisfied', () => {
        const config = makeArgRuleConfig('file_write', [
          { argument: 'path', check: 'required' },
          { argument: 'content', check: 'max-length', maxLength: 1000 },
        ]);
        const result = validateToolArguments(
          'file_write',
          {
            path: '/tmp/test',
            content: 'hello',
          },
          config
        );
        expect(result.valid).toBe(true);
      });
    });

    it('should return valid when no rules are configured', () => {
      const result = validateToolArguments('file_read', { path: '/tmp' });
      expect(result.valid).toBe(true);
    });

    it('should resolve tool aliases before looking up rules', () => {
      // "write" alias -> "file_write"
      const config = makeArgRuleConfig('file_write', [
        { argument: 'path', check: 'required' },
      ]);
      const result = validateToolArguments('write', {}, config);
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // Per-Tool Rate Limiting
  // ===========================================================================

  describe('rate limiting', () => {
    describe('checkToolRateLimit', () => {
      it('should allow when no rate limit is configured', () => {
        const session = makeSession();
        expect(checkToolRateLimit('file_read', session)).toBe(true);
      });

      it('should allow invocations within the limit', () => {
        const config = makeRateLimitConfig('file_write', 3, 10_000);
        const session = makeSession();
        const now = 1000;

        expect(checkToolRateLimit('file_write', session, config, now)).toBe(
          true
        );
        expect(checkToolRateLimit('file_write', session, config, now + 1)).toBe(
          true
        );
        expect(checkToolRateLimit('file_write', session, config, now + 2)).toBe(
          true
        );
      });

      it('should deny when limit is exceeded', () => {
        const config = makeRateLimitConfig('file_write', 2, 10_000);
        const session = makeSession();
        const now = 1000;

        expect(checkToolRateLimit('file_write', session, config, now)).toBe(
          true
        );
        expect(checkToolRateLimit('file_write', session, config, now + 1)).toBe(
          true
        );
        expect(checkToolRateLimit('file_write', session, config, now + 2)).toBe(
          false
        );
      });

      it('should allow again after the window expires', () => {
        const config = makeRateLimitConfig('file_write', 2, 1_000);
        const session = makeSession();
        const now = 1000;

        expect(checkToolRateLimit('file_write', session, config, now)).toBe(
          true
        );
        expect(
          checkToolRateLimit('file_write', session, config, now + 100)
        ).toBe(true);
        expect(
          checkToolRateLimit('file_write', session, config, now + 200)
        ).toBe(false);

        // After the window (1000ms), the old timestamps expire.
        expect(
          checkToolRateLimit('file_write', session, config, now + 1100)
        ).toBe(true);
      });

      it('should resolve tool aliases', () => {
        // "write" alias -> "file_write"
        const config = makeRateLimitConfig('file_write', 1, 10_000);
        const session = makeSession();
        const now = 1000;

        expect(checkToolRateLimit('write', session, config, now)).toBe(true);
        expect(checkToolRateLimit('write', session, config, now + 1)).toBe(
          false
        );
      });

      it('should isolate rate limits per tool', () => {
        const config: WundrToolPolicyConfig = {
          tools: {
            rateLimits: {
              file_write: { maxInvocations: 1, windowMs: 10_000 },
              file_read: { maxInvocations: 1, windowMs: 10_000 },
            },
          },
        };
        const session = makeSession();
        const now = 1000;

        expect(checkToolRateLimit('file_write', session, config, now)).toBe(
          true
        );
        expect(checkToolRateLimit('file_write', session, config, now + 1)).toBe(
          false
        );

        // file_read has its own bucket.
        expect(checkToolRateLimit('file_read', session, config, now + 2)).toBe(
          true
        );
      });
    });

    describe('getToolRateLimitStatus', () => {
      it('should return undefined when no rate limit is configured', () => {
        const session = makeSession();
        expect(getToolRateLimitStatus('file_read', session)).toBeUndefined();
      });

      it('should show remaining invocations', () => {
        const config = makeRateLimitConfig('file_write', 5, 10_000);
        const session = makeSession();
        const now = 1000;

        checkToolRateLimit('file_write', session, config, now);
        checkToolRateLimit('file_write', session, config, now + 100);

        const status = getToolRateLimitStatus(
          'file_write',
          session,
          config,
          now + 200
        );
        expect(status).toBeDefined();
        expect(status!.remaining).toBe(3);
        expect(status!.limited).toBe(false);
      });

      it('should report limited when bucket is full', () => {
        const config = makeRateLimitConfig('file_write', 2, 10_000);
        const session = makeSession();
        const now = 1000;

        checkToolRateLimit('file_write', session, config, now);
        checkToolRateLimit('file_write', session, config, now + 100);

        const status = getToolRateLimitStatus(
          'file_write',
          session,
          config,
          now + 200
        );
        expect(status!.remaining).toBe(0);
        expect(status!.limited).toBe(true);
        expect(status!.resetMs).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // Session-Scoped Tool Permissions
  // ===========================================================================

  describe('session tool permissions', () => {
    describe('createSessionToolPermissions', () => {
      it('should create a session with empty grants and revocations', () => {
        const session = makeSession('sess-1');
        expect(session.sessionId).toBe('sess-1');
        expect(session.grants.size).toBe(0);
        expect(session.revocations.size).toBe(0);
        expect(session.auditLog).toEqual([]);
        expect(session.rateLimitBuckets.size).toBe(0);
        expect(session.createdAt).toBeGreaterThan(0);
      });

      it('should populate initial grants', () => {
        const session = createSessionToolPermissions({
          sessionId: 'sess-2',
          initialGrants: ['file_read', 'bash'],
        });
        expect(session.grants.has('file_read')).toBe(true);
        expect(session.grants.has('bash_execute')).toBe(true); // alias resolved
      });

      it('should populate initial revocations', () => {
        const session = createSessionToolPermissions({
          sessionId: 'sess-3',
          initialRevocations: ['bash_execute'],
        });
        expect(session.revocations.has('bash_execute')).toBe(true);
      });
    });

    describe('grantSessionTool', () => {
      it('should add the tool to grants', () => {
        const session = makeSession();
        grantSessionTool(session, 'file_write');
        expect(session.grants.has('file_write')).toBe(true);
      });

      it('should remove the tool from revocations if present', () => {
        const session = makeSession();
        revokeSessionTool(session, 'file_write');
        expect(session.revocations.has('file_write')).toBe(true);

        grantSessionTool(session, 'file_write');
        expect(session.revocations.has('file_write')).toBe(false);
        expect(session.grants.has('file_write')).toBe(true);
      });

      it('should normalize tool names (aliases)', () => {
        const session = makeSession();
        grantSessionTool(session, 'bash');
        expect(session.grants.has('bash_execute')).toBe(true);
      });
    });

    describe('revokeSessionTool', () => {
      it('should add the tool to revocations', () => {
        const session = makeSession();
        revokeSessionTool(session, 'bash_execute');
        expect(session.revocations.has('bash_execute')).toBe(true);
      });

      it('should remove the tool from grants if present', () => {
        const session = makeSession();
        grantSessionTool(session, 'bash_execute');
        expect(session.grants.has('bash_execute')).toBe(true);

        revokeSessionTool(session, 'bash_execute');
        expect(session.grants.has('bash_execute')).toBe(false);
        expect(session.revocations.has('bash_execute')).toBe(true);
      });
    });

    describe('isToolAllowedBySession', () => {
      it('should return undefined when no session is provided', () => {
        expect(isToolAllowedBySession('file_read')).toBeUndefined();
      });

      it('should return undefined when session has no opinion', () => {
        const session = makeSession();
        expect(isToolAllowedBySession('file_read', session)).toBeUndefined();
      });

      it('should return true for granted tools', () => {
        const session = makeSession();
        grantSessionTool(session, 'file_read');
        expect(isToolAllowedBySession('file_read', session)).toBe(true);
      });

      it('should return false for revoked tools', () => {
        const session = makeSession();
        revokeSessionTool(session, 'file_read');
        expect(isToolAllowedBySession('file_read', session)).toBe(false);
      });

      it('should resolve aliases', () => {
        const session = makeSession();
        grantSessionTool(session, 'bash_execute');
        expect(isToolAllowedBySession('bash', session)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Audit Logging (10K buffer)
  // ===========================================================================

  describe('ToolAuditLogger', () => {
    it('should start with an empty buffer after clear()', () => {
      expect(ToolAuditLogger.getBuffer().length).toBe(0);
    });

    it('should record entries to the global buffer', () => {
      ToolAuditLogger.record({
        timestamp: Date.now(),
        toolName: 'file_read',
        normalizedToolName: 'file_read',
        outcome: 'allowed',
      });
      expect(ToolAuditLogger.getBuffer().length).toBe(1);
    });

    it('should record entries to the session audit log', () => {
      const session = makeSession();
      ToolAuditLogger.record(
        {
          timestamp: Date.now(),
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          outcome: 'allowed',
          sessionId: session.sessionId,
        },
        session
      );
      expect(session.auditLog.length).toBe(1);
    });

    it('should notify registered listeners', () => {
      const listener = vi.fn();
      ToolAuditLogger.addListener(listener);

      ToolAuditLogger.record({
        timestamp: Date.now(),
        toolName: 'file_read',
        normalizedToolName: 'file_read',
        outcome: 'allowed',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'file_read', outcome: 'allowed' })
      );
    });

    it('should swallow listener errors without disrupting recording', () => {
      const throwingListener = () => {
        throw new Error('boom');
      };
      const goodListener = vi.fn();

      ToolAuditLogger.addListener(throwingListener);
      ToolAuditLogger.addListener(goodListener);

      // Should not throw.
      ToolAuditLogger.record({
        timestamp: Date.now(),
        toolName: 'file_read',
        normalizedToolName: 'file_read',
        outcome: 'allowed',
      });

      // The good listener should still be called.
      expect(goodListener).toHaveBeenCalledTimes(1);
      expect(ToolAuditLogger.getBuffer().length).toBe(1);
    });

    it('should remove listeners correctly', () => {
      const listener = vi.fn();
      ToolAuditLogger.addListener(listener);
      ToolAuditLogger.removeListener(listener);

      ToolAuditLogger.record({
        timestamp: Date.now(),
        toolName: 'file_read',
        normalizedToolName: 'file_read',
        outcome: 'allowed',
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle removing a non-registered listener gracefully', () => {
      const listener = vi.fn();
      // Should not throw.
      ToolAuditLogger.removeListener(listener);
    });

    it('should enforce the 10K buffer limit by dropping oldest 10%', () => {
      // Fill the buffer to just over the limit.
      for (let i = 0; i < 10_001; i++) {
        ToolAuditLogger.record({
          timestamp: i,
          toolName: `tool_${i}`,
          normalizedToolName: `tool_${i}`,
          outcome: 'allowed',
        });
      }

      const buffer = ToolAuditLogger.getBuffer();
      // After exceeding 10K, oldest 10% (1000) should be dropped.
      expect(buffer.length).toBeLessThanOrEqual(10_000);
      expect(buffer.length).toBeGreaterThanOrEqual(9_000);

      // The earliest entry should not be timestamp 0 (it was dropped).
      expect(buffer[0].timestamp).toBeGreaterThan(0);
    });

    describe('getEntriesForTool', () => {
      it('should filter by normalized tool name', () => {
        ToolAuditLogger.record({
          timestamp: 1,
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          outcome: 'allowed',
        });
        ToolAuditLogger.record({
          timestamp: 2,
          toolName: 'bash',
          normalizedToolName: 'bash_execute',
          outcome: 'denied',
        });
        ToolAuditLogger.record({
          timestamp: 3,
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          outcome: 'denied',
        });

        const entries = ToolAuditLogger.getEntriesForTool('file_read');
        expect(entries.length).toBe(2);
        expect(entries.every(e => e.normalizedToolName === 'file_read')).toBe(
          true
        );
      });

      it('should resolve aliases in lookups', () => {
        ToolAuditLogger.record({
          timestamp: 1,
          toolName: 'bash',
          normalizedToolName: 'bash_execute',
          outcome: 'allowed',
        });

        const entries = ToolAuditLogger.getEntriesForTool('bash');
        expect(entries.length).toBe(1);
      });
    });

    describe('getEntriesForSession', () => {
      it('should filter by session ID', () => {
        ToolAuditLogger.record({
          timestamp: 1,
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          outcome: 'allowed',
          sessionId: 'sess-a',
        });
        ToolAuditLogger.record({
          timestamp: 2,
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          outcome: 'denied',
          sessionId: 'sess-b',
        });

        const entries = ToolAuditLogger.getEntriesForSession('sess-a');
        expect(entries.length).toBe(1);
        expect(entries[0].sessionId).toBe('sess-a');
      });
    });

    describe('getSummary', () => {
      it('should aggregate counts by outcome and category', () => {
        ToolAuditLogger.record({
          timestamp: 1,
          toolName: 'file_read',
          normalizedToolName: 'file_read',
          category: 'read-only',
          outcome: 'allowed',
        });
        ToolAuditLogger.record({
          timestamp: 2,
          toolName: 'bash_execute',
          normalizedToolName: 'bash_execute',
          category: 'execute',
          outcome: 'denied',
        });
        ToolAuditLogger.record({
          timestamp: 3,
          toolName: 'file_write',
          normalizedToolName: 'file_write',
          category: 'write',
          outcome: 'rate-limited',
        });

        const summary = ToolAuditLogger.getSummary();
        expect(summary.total).toBe(3);
        expect(summary.allowed).toBe(1);
        expect(summary.denied).toBe(1);
        expect(summary.rateLimited).toBe(1);
        expect(summary.byCategory['read-only']).toBe(1);
        expect(summary.byCategory['execute']).toBe(1);
        expect(summary.byCategory['write']).toBe(1);
        expect(summary.byOutcome['allowed']).toBe(1);
        expect(summary.byOutcome['denied']).toBe(1);
        expect(summary.byOutcome['rate-limited']).toBe(1);
      });

      it('should handle empty buffer', () => {
        const summary = ToolAuditLogger.getSummary();
        expect(summary.total).toBe(0);
        expect(summary.allowed).toBe(0);
        expect(summary.denied).toBe(0);
        expect(summary.rateLimited).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Comprehensive Tool Evaluation (evaluateToolAccess)
  // ===========================================================================

  describe('evaluateToolAccess', () => {
    it('should allow a permitted tool with classification metadata', () => {
      const result = evaluateToolAccess({
        toolName: 'file_read',
        policies: {},
      });
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('read-only');
      expect(result.riskLevel).toBe('none');
    });

    it('should deny a session-revoked tool', () => {
      const session = makeSession();
      revokeSessionTool(session, 'file_read');

      const result = evaluateToolAccess({
        toolName: 'file_read',
        policies: {},
        session,
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedByPattern).toContain('session-revocation');
    });

    it('should skip policy checks for session-granted tools', () => {
      const session = makeSession();
      grantSessionTool(session, 'bash_execute');

      // The global policy denies bash_execute, but session grant overrides.
      const result = evaluateToolAccess({
        toolName: 'bash_execute',
        policies: { globalPolicy: { deny: ['bash_execute'] } },
        session,
      });
      expect(result.allowed).toBe(true);
    });

    it('should deny based on multi-layer policy', () => {
      const result = evaluateToolAccess({
        toolName: 'bash_execute',
        policies: { globalPolicy: { deny: ['bash_execute'] } },
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBe('global');
    });

    it('should deny when argument validation fails', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          argumentRules: {
            file_write: [{ argument: 'path', check: 'required' }],
          },
        },
      };

      const result = evaluateToolAccess({
        toolName: 'file_write',
        toolArgs: {},
        policies: {},
        config,
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedByPattern).toContain('path');
    });

    it('should deny when rate limit is exceeded', () => {
      const config = makeRateLimitConfig('file_write', 1, 60_000);
      const session = makeSession();

      // First call consumes the single allowed invocation.
      // Use evaluateToolAccess itself so the timestamp uses Date.now().
      const first = evaluateToolAccess({
        toolName: 'file_write',
        policies: {},
        session,
        config,
      });
      expect(first.allowed).toBe(true);

      // Second call should be rate-limited.
      const result = evaluateToolAccess({
        toolName: 'file_write',
        policies: {},
        session,
        config,
      });
      expect(result.allowed).toBe(false);
      expect(result.deniedByPattern).toContain('rate-limit');
    });

    it('should indicate approval requirement for execute tools', () => {
      const result = evaluateToolAccess({
        toolName: 'bash_execute',
        policies: {},
      });
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it('should record audit entries when audit is enabled', () => {
      const session = makeSession();

      evaluateToolAccess({
        toolName: 'file_read',
        policies: {},
        session,
        auditEnabled: true,
      });

      expect(ToolAuditLogger.getBuffer().length).toBe(1);
      expect(session.auditLog.length).toBe(1);
      expect(session.auditLog[0].outcome).toBe('allowed');
    });

    it('should not record audit entries when audit is disabled', () => {
      evaluateToolAccess({
        toolName: 'file_read',
        policies: {},
        auditEnabled: false,
      });

      expect(ToolAuditLogger.getBuffer().length).toBe(0);
    });

    it('should respect config-level auditEnabled', () => {
      const config: WundrToolPolicyConfig = {
        tools: { auditEnabled: true },
      };

      evaluateToolAccess({
        toolName: 'file_read',
        policies: {},
        config,
      });

      expect(ToolAuditLogger.getBuffer().length).toBe(1);
    });

    it('should audit denied events', () => {
      const session = makeSession();
      revokeSessionTool(session, 'bash_execute');

      evaluateToolAccess({
        toolName: 'bash_execute',
        policies: {},
        session,
        auditEnabled: true,
      });

      const buffer = ToolAuditLogger.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].outcome).toBe('denied');
      expect(buffer[0].deniedBy).toBe('session-revocation');
    });

    it('should audit approval-required outcome', () => {
      evaluateToolAccess({
        toolName: 'bash_execute',
        policies: {},
        auditEnabled: true,
      });

      const buffer = ToolAuditLogger.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].outcome).toBe('approval-required');
    });

    it('should audit rate-limited outcome', () => {
      const config = makeRateLimitConfig('file_write', 1, 10_000);
      const session = makeSession();

      // First call consumes the rate limit.
      evaluateToolAccess({
        toolName: 'file_write',
        policies: {},
        session,
        config,
        auditEnabled: true,
      });

      // Second call is rate-limited.
      evaluateToolAccess({
        toolName: 'file_write',
        policies: {},
        session,
        config,
        auditEnabled: true,
      });

      const buffer = ToolAuditLogger.getBuffer();
      expect(buffer.length).toBe(2);
      expect(buffer[1].outcome).toBe('rate-limited');
    });

    it('should audit argument-invalid outcome', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          auditEnabled: true,
          argumentRules: {
            file_write: [{ argument: 'path', check: 'required' }],
          },
        },
      };

      evaluateToolAccess({
        toolName: 'file_write',
        toolArgs: {},
        policies: {},
        config,
      });

      const buffer = ToolAuditLogger.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].outcome).toBe('argument-invalid');
    });
  });

  // ===========================================================================
  // Tool Filtering
  // ===========================================================================

  describe('filterToolNamesByPolicy', () => {
    it('should return all names when no policy is provided', () => {
      const names = ['file_read', 'bash_execute', 'web_fetch'];
      expect(filterToolNamesByPolicy(names)).toEqual(names);
    });

    it('should filter based on deny patterns', () => {
      const names = ['file_read', 'bash_execute', 'web_fetch'];
      const result = filterToolNamesByPolicy(names, { deny: ['bash_execute'] });
      expect(result).toEqual(['file_read', 'web_fetch']);
    });

    it('should filter based on allowlist', () => {
      const names = ['file_read', 'bash_execute', 'web_fetch'];
      const result = filterToolNamesByPolicy(names, { allow: ['file_read'] });
      expect(result).toEqual(['file_read']);
    });
  });

  describe('filterToolsByPolicy', () => {
    const tools = [
      { name: 'file_read', description: 'Read files' },
      { name: 'bash_execute', description: 'Run commands' },
      { name: 'web_fetch', description: 'Fetch URLs' },
    ];

    it('should return all tools when no policy is provided', () => {
      expect(filterToolsByPolicy(tools)).toEqual(tools);
    });

    it('should filter tool objects by policy', () => {
      const result = filterToolsByPolicy(tools, { deny: ['bash_execute'] });
      expect(result.length).toBe(2);
      expect(result.map(t => t.name)).toEqual(['file_read', 'web_fetch']);
    });
  });

  describe('filterToolsByPolicies', () => {
    const tools = [
      { name: 'file_read' },
      { name: 'bash_execute' },
      { name: 'web_fetch' },
      { name: 'session_spawn' },
    ];

    it('should filter by all policy layers conjunctively', () => {
      const policies: EffectiveToolPolicies = {
        globalPolicy: { deny: ['bash_execute'] },
        subagentPolicy: { deny: ['session_spawn'] },
      };
      const result = filterToolsByPolicies(tools, policies);
      expect(result.map(t => t.name)).toEqual(['file_read', 'web_fetch']);
    });

    it('should return all tools when no policies restrict anything', () => {
      const policies: EffectiveToolPolicies = {};
      const result = filterToolsByPolicies(tools, policies);
      expect(result.length).toBe(tools.length);
    });
  });

  // ===========================================================================
  // Subagent Policy Resolution
  // ===========================================================================

  describe('resolveSubagentToolPolicy', () => {
    it('should include default deny list', () => {
      const policy = resolveSubagentToolPolicy();
      expect(policy.deny).toContain('bash_execute');
      expect(policy.deny).toContain('session_spawn');
      expect(policy.deny).toContain('memory_search');
      expect(policy.deny).toContain('file_delete');
    });

    it('should merge configured deny patterns with defaults', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          subagents: {
            tools: {
              deny: ['web_fetch'],
            },
          },
        },
      };
      const policy = resolveSubagentToolPolicy(config);
      expect(policy.deny).toContain('web_fetch');
      expect(policy.deny).toContain('bash_execute');
    });

    it('should pass through configured allow patterns', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          subagents: {
            tools: {
              allow: ['file_read', 'file_list'],
            },
          },
        },
      };
      const policy = resolveSubagentToolPolicy(config);
      expect(policy.allow).toEqual(['file_read', 'file_list']);
    });
  });

  // ===========================================================================
  // Default Subagent Deny List
  // ===========================================================================

  describe('getDefaultSubagentDenyList / isDefaultSubagentDenied', () => {
    it('should return the deny list', () => {
      const list = getDefaultSubagentDenyList();
      expect(list.length).toBeGreaterThan(0);
      expect(list).toContain('bash_execute');
    });

    it('should correctly report denied tools', () => {
      expect(isDefaultSubagentDenied('bash_execute')).toBe(true);
      expect(isDefaultSubagentDenied('bash')).toBe(true); // alias
      expect(isDefaultSubagentDenied('file_read')).toBe(false);
    });
  });

  // ===========================================================================
  // Group Policy Resolution
  // ===========================================================================

  describe('resolveGroupToolPolicy', () => {
    it('should return undefined when no groups are configured', () => {
      expect(resolveGroupToolPolicy({ config: {} })).toBeUndefined();
      expect(resolveGroupToolPolicy({ config: undefined })).toBeUndefined();
    });

    it('should return undefined when groupId is not provided', () => {
      const config: WundrToolPolicyConfig = {
        groups: { team1: { deny: ['bash_execute'] } },
      };
      expect(resolveGroupToolPolicy({ config })).toBeUndefined();
    });

    it('should resolve group-level policy', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          team1: { deny: ['bash_execute'] },
        },
      };
      const policy = resolveGroupToolPolicy({ config, groupId: 'team1' });
      expect(policy).toBeDefined();
      expect(policy!.deny).toContain('bash_execute');
    });

    it('should resolve per-member overrides', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          team1: {
            deny: ['bash_execute'],
            toolsByMember: {
              alice: { allow: ['file_read', 'file_write'] },
            },
          },
        },
      };
      const policy = resolveGroupToolPolicy({
        config,
        groupId: 'team1',
        memberName: 'alice',
      });
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('file_read');
    });

    it('should normalize member name (case-insensitive, strip @)', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          team1: {
            toolsByMember: {
              alice: { allow: ['file_read'] },
            },
          },
        },
      };
      const policy = resolveGroupToolPolicy({
        config,
        groupId: 'team1',
        memberName: '@Alice',
      });
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('file_read');
    });

    it('should fall back to wildcard group when specific group is not found', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          '*': { deny: ['bash_execute'] },
        },
      };
      const policy = resolveGroupToolPolicy({
        config,
        groupId: 'unknown-team',
      });
      expect(policy).toBeDefined();
      expect(policy!.deny).toContain('bash_execute');
    });

    it('should fall back to wildcard member within a group', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          team1: {
            deny: ['session_spawn'],
            toolsByMember: {
              '*': { allow: ['file_read'] },
              alice: { allow: ['file_read', 'file_write'] },
            },
          },
        },
      };
      // Unknown member should get the wildcard policy.
      const policy = resolveGroupToolPolicy({
        config,
        groupId: 'team1',
        memberName: 'bob',
      });
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('file_read');
      expect(policy!.allow).not.toContain('file_write');
    });
  });

  // ===========================================================================
  // Profile Resolution
  // ===========================================================================

  describe('resolveToolProfilePolicy', () => {
    it('should return undefined for no profile', () => {
      expect(resolveToolProfilePolicy()).toBeUndefined();
      expect(resolveToolProfilePolicy('')).toBeUndefined();
    });

    it('should return undefined for unknown profile', () => {
      expect(resolveToolProfilePolicy('nonexistent')).toBeUndefined();
    });

    it('should resolve the "minimal" profile', () => {
      const policy = resolveToolProfilePolicy('minimal');
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('session_status');
      expect(policy!.allow!.length).toBe(1);
    });

    it('should resolve the "coding" profile with group references', () => {
      const policy = resolveToolProfilePolicy('coding');
      expect(policy).toBeDefined();
      expect(policy!.allow).toContain('group:fs');
      expect(policy!.allow).toContain('group:runtime');
    });

    it('should return undefined for the "full" profile (no restrictions)', () => {
      const policy = resolveToolProfilePolicy('full');
      // Full profile has no allow/deny, so it should be undefined.
      expect(policy).toBeUndefined();
    });
  });

  // ===========================================================================
  // Effective Policy Resolution
  // ===========================================================================

  describe('resolveEffectiveToolPolicy', () => {
    it('should resolve all layers from config', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          deny: ['bash_execute'],
        },
        agents: {
          coder: {
            tools: {
              allow: ['group:fs', 'group:runtime'],
            },
          },
        },
      };

      const policies = resolveEffectiveToolPolicy({
        config,
        agentId: 'coder',
      });

      expect(policies.globalPolicy).toBeDefined();
      expect(policies.globalPolicy!.deny).toContain('bash_execute');
      expect(policies.agentPolicy).toBeDefined();
      expect(policies.agentId).toBe('coder');
    });

    it('should resolve subagent policy when isSubagent is true', () => {
      const policies = resolveEffectiveToolPolicy({
        isSubagent: true,
      });
      expect(policies.subagentPolicy).toBeDefined();
      expect(policies.subagentPolicy!.deny).toContain('bash_execute');
    });

    it('should not include subagent policy when isSubagent is false', () => {
      const policies = resolveEffectiveToolPolicy({
        isSubagent: false,
      });
      expect(policies.subagentPolicy).toBeUndefined();
    });

    it('should resolve provider-specific policies', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          byProvider: {
            openai: { deny: ['web_fetch'] },
          },
        },
      };

      const policies = resolveEffectiveToolPolicy({
        config,
        modelProvider: 'openai',
      });

      expect(policies.globalProviderPolicy).toBeDefined();
      expect(policies.globalProviderPolicy!.deny).toContain('web_fetch');
    });

    it('should resolve group policies', () => {
      const config: WundrToolPolicyConfig = {
        groups: {
          devteam: { deny: ['bash_execute'] },
        },
      };

      const policies = resolveEffectiveToolPolicy({
        config,
        groupId: 'devteam',
      });

      expect(policies.groupPolicy).toBeDefined();
      expect(policies.groupPolicy!.deny).toContain('bash_execute');
    });
  });

  // ===========================================================================
  // collectPolicies
  // ===========================================================================

  describe('collectPolicies', () => {
    it('should collect all policy layers into a flat array', () => {
      const policies: EffectiveToolPolicies = {
        globalPolicy: { deny: ['a'] },
        agentPolicy: { allow: ['b'] },
      };
      const collected = collectPolicies(policies);
      expect(collected.length).toBe(6); // Always 6 slots
      expect(collected[0]).toEqual({ deny: ['a'] }); // global
      expect(collected[2]).toEqual({ allow: ['b'] }); // agent
    });
  });

  // ===========================================================================
  // collectExplicitAllowlist
  // ===========================================================================

  describe('collectExplicitAllowlist', () => {
    it('should collect allow entries from multiple policies', () => {
      const policies: Array<ToolPolicy | undefined> = [
        { allow: ['file_read', 'file_write'] },
        undefined,
        { allow: ['bash_execute'] },
      ];
      const result = collectExplicitAllowlist(policies);
      expect(result).toEqual(['file_read', 'file_write', 'bash_execute']);
    });

    it('should skip policies without allow lists', () => {
      const policies: Array<ToolPolicy | undefined> = [
        { deny: ['bash_execute'] },
        undefined,
      ];
      const result = collectExplicitAllowlist(policies);
      expect(result).toEqual([]);
    });

    it('should trim whitespace from entries', () => {
      const result = collectExplicitAllowlist([
        { allow: ['  file_read  ', '  '] },
      ]);
      expect(result).toContain('file_read');
      // Whitespace-only entries are filtered out.
      expect(result.length).toBe(1);
    });
  });

  // ===========================================================================
  // Error Types
  // ===========================================================================

  describe('error types', () => {
    describe('ToolPolicyDeniedError', () => {
      it('should contain tool name and deniedBy information', () => {
        const error = new ToolPolicyDeniedError('bash_execute', 'global');
        expect(error.name).toBe('ToolPolicyDeniedError');
        expect(error.toolName).toBe('bash_execute');
        expect(error.deniedBy).toBe('global');
        expect(error.message).toContain('bash_execute');
        expect(error.message).toContain('global');
        expect(error).toBeInstanceOf(Error);
      });

      it('should work without deniedBy', () => {
        const error = new ToolPolicyDeniedError('file_delete');
        expect(error.deniedBy).toBeUndefined();
        expect(error.message).toContain('file_delete');
      });
    });

    describe('ToolArgumentValidationError', () => {
      it('should contain tool name and failed rule', () => {
        const rule = { argument: 'path', check: 'required' as const };
        const error = new ToolArgumentValidationError(
          'file_write',
          'path is required',
          rule
        );
        expect(error.name).toBe('ToolArgumentValidationError');
        expect(error.toolName).toBe('file_write');
        expect(error.failedRule).toBe(rule);
        expect(error.message).toBe('path is required');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('ToolRateLimitError', () => {
      it('should contain tool name and reset hint', () => {
        const error = new ToolRateLimitError('file_write', 5000);
        expect(error.name).toBe('ToolRateLimitError');
        expect(error.toolName).toBe('file_write');
        expect(error.message).toContain('file_write');
        expect(error.message).toContain('rate limit');
        expect(error.message).toContain('5s');
        expect(error).toBeInstanceOf(Error);
      });

      it('should work without resetMs', () => {
        const error = new ToolRateLimitError('file_write');
        expect(error.message).toContain('rate limit');
        expect(error.message).not.toContain('resets in');
      });
    });
  });

  // ===========================================================================
  // TOOL_GROUPS constant
  // ===========================================================================

  describe('TOOL_GROUPS', () => {
    it('should define group:fs with file tools', () => {
      expect(TOOL_GROUPS['group:fs']).toContain('file_read');
      expect(TOOL_GROUPS['group:fs']).toContain('file_write');
    });

    it('should define group:wundr as a superset of all tools', () => {
      const wundr = TOOL_GROUPS['group:wundr'];
      expect(wundr).toContain('file_read');
      expect(wundr).toContain('bash_execute');
      expect(wundr).toContain('web_fetch');
      expect(wundr).toContain('session_spawn');
      expect(wundr).toContain('memory_search');
    });

    it('should define group:git', () => {
      expect(TOOL_GROUPS['group:git']).toContain('git_helpers');
      expect(TOOL_GROUPS['group:git']).toContain('git_worktree');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty allow and deny arrays', () => {
      const policy: ToolPolicy = { allow: [], deny: [] };
      // Empty allow = open (no restriction). Empty deny = no blocks.
      expect(isToolAllowedByPolicy('anything', policy)).toBe(true);
    });

    it('should handle policy with only empty strings', () => {
      const policy: ToolPolicy = { allow: ['', '  '], deny: ['', '  '] };
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
    });

    it('should handle non-array allow/deny gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policy: ToolPolicy = {
        allow: 'file_read' as any,
        deny: null as any,
      };
      // Non-array should be treated as no restriction.
      expect(isToolAllowedByPolicy('file_read', policy)).toBe(true);
    });

    it('should handle tool names with special regex characters', () => {
      // A tool name with characters that are special in regex.
      const policy: ToolPolicy = { allow: ['tool.name+special'] };
      expect(isToolAllowedByPolicy('tool.name+special', policy)).toBe(true);
    });

    it('should handle very long tool names', () => {
      const longName = 'x'.repeat(1000);
      expect(isToolAllowedByPolicy(longName, { allow: [longName] })).toBe(true);
    });

    it('should handle concurrent policy evaluations correctly', () => {
      // Evaluate many different policies in rapid succession.
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(
          isToolAllowedByPolicy(`tool_${i}`, { allow: [`tool_${i}`] })
        );
      }
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle evaluation of tools not in any category', () => {
      const policies: EffectiveToolPolicies = {};
      const result = evaluateToolPolicy('custom_unknown_tool', policies);
      expect(result.allowed).toBe(true);
      expect(result.category).toBeUndefined();
      expect(result.riskLevel).toBeUndefined();
      expect(result.requiresApproval).toBeUndefined();
    });

    it('should handle evaluateToolAccess with all features combined', () => {
      const config: WundrToolPolicyConfig = {
        tools: {
          auditEnabled: true,
          argumentRules: {
            file_write: [{ argument: 'path', check: 'required' }],
          },
          rateLimits: {
            file_write: { maxInvocations: 10, windowMs: 60_000 },
          },
        },
      };

      const session = makeSession();

      // Valid call should succeed.
      const result = evaluateToolAccess({
        toolName: 'file_write',
        toolArgs: { path: '/tmp/test' },
        policies: {},
        session,
        config,
      });
      expect(result.allowed).toBe(true);
      expect(ToolAuditLogger.getBuffer().length).toBe(1);
    });
  });
});
