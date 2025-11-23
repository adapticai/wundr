/**
 * @wundr.io/structured-output - Grammar Enforcer
 *
 * Implements constrained decoding for LLM outputs using various grammar enforcement methods:
 * - JSON Schema validation
 * - Regex pattern matching
 * - PEG grammar (Parsing Expression Grammar)
 * - Context-Free Grammar (CFG)
 */

import { toJsonSchema, extractJson, introspectSchema } from './schema-utils';

import type {
  GrammarEnforcer,
  GrammarEnforcementMethod,
  GrammarEnforcementResult,
  GrammarError,
  GrammarConstraints,
  GrammarEnforcementConfig,
} from './types';
import type { ZodSchema } from 'zod';

// ============================================================================
// Base Grammar Enforcer
// ============================================================================

/**
 * Abstract base class for grammar enforcers
 */
abstract class BaseGrammarEnforcer implements GrammarEnforcer {
  protected readonly config: GrammarEnforcementConfig;

  constructor(config: Partial<GrammarEnforcementConfig> = {}) {
    this.config = {
      method: 'json-schema',
      strict: true,
      allowPartialMatches: false,
      ...config,
    };
  }

  abstract enforce(input: string, schema: ZodSchema): GrammarEnforcementResult;
  abstract generateConstraints(schema: ZodSchema): GrammarConstraints;
  abstract getMethod(): GrammarEnforcementMethod;

  /**
   * Create a grammar error
   */
  protected createError(
    position: number,
    expected: string,
    found: string,
    message: string
  ): GrammarError {
    return { position, expected, found, message };
  }
}

// ============================================================================
// JSON Schema Grammar Enforcer
// ============================================================================

/**
 * Enforces grammar using JSON Schema validation
 */
export class JsonSchemaGrammarEnforcer extends BaseGrammarEnforcer {
  getMethod(): GrammarEnforcementMethod {
    return 'json-schema';
  }

  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult {
    try {
      // Extract JSON from input
      const json = extractJson(input);

      // Validate against Zod schema
      const result = schema.safeParse(json);

      if (result.success) {
        return {
          valid: true,
          data: result.data,
          grammarUsed: 'json-schema',
        };
      }

      // Convert Zod errors to grammar errors
      const errors: GrammarError[] = result.error.issues.map(
        (issue, index) => ({
          position: index,
          expected:
            'expected' in issue ? String(issue.expected) : 'valid value',
          found: 'received' in issue ? String(issue.received) : 'invalid value',
          message: `${issue.path.join('.')}: ${issue.message}`,
        })
      );

      return {
        valid: false,
        errors,
        grammarUsed: 'json-schema',
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          this.createError(
            0,
            'valid JSON',
            input.substring(0, 50),
            error instanceof Error ? error.message : 'Failed to parse JSON'
          ),
        ],
        grammarUsed: 'json-schema',
      };
    }
  }

  generateConstraints(schema: ZodSchema): GrammarConstraints {
    const jsonSchema = toJsonSchema(schema);
    return { jsonSchema };
  }
}

// ============================================================================
// Regex Grammar Enforcer
// ============================================================================

/**
 * Enforces grammar using regex patterns
 */
export class RegexGrammarEnforcer extends BaseGrammarEnforcer {
  private patterns: Map<string, RegExp> = new Map();

  constructor(config: Partial<GrammarEnforcementConfig> = {}) {
    super({ ...config, method: 'regex' });
    this.initializeCommonPatterns();
  }

  private initializeCommonPatterns(): void {
    // Common validation patterns
    this.patterns.set('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    this.patterns.set('url', /^https?:\/\/[^\s/$.?#].[^\s]*$/i);
    this.patterns.set(
      'uuid',
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    this.patterns.set('date', /^\d{4}-\d{2}-\d{2}$/);
    this.patterns.set(
      'datetime',
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/
    );
    this.patterns.set('time', /^\d{2}:\d{2}:\d{2}$/);
    this.patterns.set('phone', /^\+?[\d\s-()]{10,}$/);
    this.patterns.set('integer', /^-?\d+$/);
    this.patterns.set('float', /^-?\d+(\.\d+)?$/);
    this.patterns.set('boolean', /^(true|false)$/i);
    this.patterns.set('alphanumeric', /^[a-zA-Z0-9]+$/);
    this.patterns.set('slug', /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }

  getMethod(): GrammarEnforcementMethod {
    return 'regex';
  }

  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult {
    // First try to parse as JSON
    let data: unknown;
    try {
      data = extractJson(input);
    } catch {
      // If not JSON, validate the raw string against regex
      const customPattern = this.config.customGrammar;
      if (customPattern) {
        const regex = new RegExp(customPattern);
        if (regex.test(input)) {
          return {
            valid: true,
            data: input,
            grammarUsed: 'regex',
          };
        }
        return {
          valid: false,
          errors: [
            this.createError(
              0,
              customPattern,
              input.substring(0, 50),
              'Input does not match pattern'
            ),
          ],
          grammarUsed: 'regex',
        };
      }

      return {
        valid: false,
        errors: [
          this.createError(
            0,
            'valid JSON or pattern',
            input.substring(0, 50),
            'Failed to parse input'
          ),
        ],
        grammarUsed: 'regex',
      };
    }

    // Validate with Zod schema
    const result = schema.safeParse(data);
    if (result.success) {
      return {
        valid: true,
        data: result.data,
        grammarUsed: 'regex',
      };
    }

    // Apply regex patterns to string fields
    const errors = this.validateWithPatterns(data, schema);
    if (errors.length === 0) {
      return {
        valid: true,
        data,
        grammarUsed: 'regex',
      };
    }

    return {
      valid: false,
      errors,
      grammarUsed: 'regex',
    };
  }

  private validateWithPatterns(
    data: unknown,
    schema: ZodSchema
  ): GrammarError[] {
    const errors: GrammarError[] = [];
    const metadata = introspectSchema(schema);

    if (
      metadata.type === 'object' &&
      metadata.fields &&
      typeof data === 'object' &&
      data !== null
    ) {
      const obj = data as Record<string, unknown>;

      for (const [key, fieldMeta] of Object.entries(metadata.fields)) {
        const value = obj[key];

        if (value === undefined || value === null) {
          if (!fieldMeta.optional && !fieldMeta.nullable) {
            errors.push(
              this.createError(
                0,
                'required field',
                'missing',
                `Field "${key}" is required`
              )
            );
          }
          continue;
        }

        // Check if the field description mentions a pattern
        if (
          fieldMeta.type === 'string' &&
          typeof value === 'string' &&
          fieldMeta.description
        ) {
          const patternMatch = fieldMeta.description.match(/pattern:\s*(\w+)/i);
          if (patternMatch) {
            const patternName = patternMatch[1]?.toLowerCase();
            if (patternName) {
              const pattern = this.patterns.get(patternName);
              if (pattern && !pattern.test(value)) {
                errors.push(
                  this.createError(
                    0,
                    patternName,
                    value.substring(0, 30),
                    `Field "${key}" does not match ${patternName} pattern`
                  )
                );
              }
            }
          }
        }
      }
    }

    return errors;
  }

  generateConstraints(schema: ZodSchema): GrammarConstraints {
    const metadata = introspectSchema(schema);
    const patterns: string[] = [];

    // Generate regex pattern from schema
    if (metadata.type === 'object' && metadata.fields) {
      const fieldPatterns = Object.entries(metadata.fields).map(
        ([key, field]) => {
          let valuePattern = '.*';
          switch (field.type) {
            case 'string':
              valuePattern = '"[^"]*"';
              break;
            case 'number':
              valuePattern = '-?\\d+(\\.\\d+)?';
              break;
            case 'boolean':
              valuePattern = '(true|false)';
              break;
            default:
              valuePattern = '.*';
          }
          return `"${key}"\\s*:\\s*${valuePattern}`;
        }
      );

      patterns.push(`\\{\\s*${fieldPatterns.join('\\s*,\\s*')}\\s*\\}`);
    }

    return {
      regexPattern: patterns.length > 0 ? patterns[0] : undefined,
    };
  }

  /**
   * Add a custom pattern
   */
  addPattern(name: string, pattern: RegExp): void {
    this.patterns.set(name.toLowerCase(), pattern);
  }

  /**
   * Validate a string against a named pattern
   */
  validatePattern(input: string, patternName: string): boolean {
    const pattern = this.patterns.get(patternName.toLowerCase());
    return pattern ? pattern.test(input) : false;
  }
}

// ============================================================================
// PEG Grammar Enforcer
// ============================================================================

/**
 * Enforces grammar using Parsing Expression Grammar (PEG)
 */
export class PegGrammarEnforcer extends BaseGrammarEnforcer {
  constructor(config: Partial<GrammarEnforcementConfig> = {}) {
    super({ ...config, method: 'peg-grammar' });
  }

  getMethod(): GrammarEnforcementMethod {
    return 'peg-grammar';
  }

  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult {
    // For PEG, we first try JSON validation, then apply PEG rules
    try {
      const data = extractJson(input);

      // If we have custom PEG grammar, apply it
      if (this.config.customGrammar) {
        const pegResult = this.applyPegGrammar(
          input,
          this.config.customGrammar
        );
        if (!pegResult.valid) {
          return pegResult;
        }
      }

      // Validate against Zod schema
      const result = schema.safeParse(data);
      if (result.success) {
        return {
          valid: true,
          data: result.data,
          grammarUsed: 'peg-grammar',
        };
      }

      const errors: GrammarError[] = result.error.issues.map(
        (issue, index) => ({
          position: index,
          expected:
            'expected' in issue ? String(issue.expected) : 'valid value',
          found: 'received' in issue ? String(issue.received) : 'invalid value',
          message: `${issue.path.join('.')}: ${issue.message}`,
        })
      );

      return {
        valid: false,
        errors,
        grammarUsed: 'peg-grammar',
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          this.createError(
            0,
            'valid PEG input',
            input.substring(0, 50),
            error instanceof Error ? error.message : 'Failed to parse'
          ),
        ],
        grammarUsed: 'peg-grammar',
      };
    }
  }

  /**
   * Apply custom PEG grammar rules
   * This is a simplified PEG implementation for common patterns
   */
  private applyPegGrammar(
    input: string,
    grammar: string
  ): GrammarEnforcementResult {
    // Parse the grammar definition
    const rules = this.parseGrammarDefinition(grammar);

    // Try to match the input against the rules
    let position = 0;
    const errors: GrammarError[] = [];

    for (const rule of rules) {
      const match = this.matchRule(input, position, rule);
      if (match.success) {
        position = match.newPosition;
      } else if (rule.required) {
        errors.push(
          this.createError(
            position,
            rule.name,
            input.substring(position, position + 20),
            match.error ?? 'Rule not matched'
          )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      grammarUsed: 'peg-grammar',
    };
  }

  private parseGrammarDefinition(grammar: string): PegRule[] {
    const rules: PegRule[] = [];
    const lines = grammar
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'));

    for (const line of lines) {
      const match = line.match(/^(\w+)\s*<-\s*(.+)$/);
      if (match) {
        const name = match[1];
        const pattern = match[2];
        if (name && pattern) {
          rules.push({
            name,
            pattern: pattern.trim(),
            required: !pattern.includes('?'),
          });
        }
      }
    }

    return rules;
  }

  private matchRule(
    input: string,
    position: number,
    rule: PegRule
  ): { success: boolean; newPosition: number; error?: string } {
    // Simple pattern matching for common PEG expressions
    const pattern = rule.pattern;

    // Handle string literals
    if (pattern.startsWith('"') && pattern.endsWith('"')) {
      const literal = pattern.slice(1, -1);
      if (input.substring(position).startsWith(literal)) {
        return { success: true, newPosition: position + literal.length };
      }
      return {
        success: false,
        newPosition: position,
        error: `Expected "${literal}"`,
      };
    }

    // Handle character classes
    if (pattern.startsWith('[') && pattern.includes(']')) {
      const classMatch = pattern.match(/\[([^\]]+)\]/);
      if (classMatch && classMatch[1]) {
        const chars = classMatch[1];
        const inputChar = input[position];
        if (inputChar && chars.includes(inputChar)) {
          return { success: true, newPosition: position + 1 };
        }
      }
      return {
        success: false,
        newPosition: position,
        error: `Expected one of ${pattern}`,
      };
    }

    // Handle whitespace
    if (pattern === 'ws' || pattern === 'whitespace') {
      let newPos = position;
      while (newPos < input.length && /\s/.test(input[newPos] ?? '')) {
        newPos++;
      }
      return { success: true, newPosition: newPos };
    }

    // Default: treat as regex
    try {
      const regex = new RegExp('^' + pattern);
      const remaining = input.substring(position);
      const regexMatch = remaining.match(regex);
      if (regexMatch) {
        return { success: true, newPosition: position + regexMatch[0].length };
      }
    } catch {
      // Invalid regex
    }

    return {
      success: false,
      newPosition: position,
      error: `Pattern "${rule.name}" not matched`,
    };
  }

  generateConstraints(schema: ZodSchema): GrammarConstraints {
    const metadata = introspectSchema(schema);
    const grammarLines: string[] = [];

    grammarLines.push('# Auto-generated PEG grammar');
    grammarLines.push('Start <- ws Value ws');

    if (metadata.type === 'object') {
      grammarLines.push('Value <- Object');
      grammarLines.push('Object <- "{" ws MemberList? ws "}"');
      grammarLines.push('MemberList <- Member ("," ws Member)*');
      grammarLines.push('Member <- String ws ":" ws Value');
    } else if (metadata.type === 'array') {
      grammarLines.push('Value <- Array');
      grammarLines.push('Array <- "[" ws ValueList? ws "]"');
      grammarLines.push('ValueList <- Value ("," ws Value)*');
    } else {
      grammarLines.push('Value <- String / Number / Boolean / Null');
    }

    grammarLines.push('String <- "\\"" [^"\\\\]* "\\""');
    grammarLines.push('Number <- "-"? [0-9]+ ("." [0-9]+)?');
    grammarLines.push('Boolean <- "true" / "false"');
    grammarLines.push('Null <- "null"');
    grammarLines.push('ws <- [ \\t\\n\\r]*');

    return {
      pegGrammar: grammarLines.join('\n'),
    };
  }
}

interface PegRule {
  name: string;
  pattern: string;
  required: boolean;
}

// ============================================================================
// Context-Free Grammar Enforcer
// ============================================================================

/**
 * Enforces grammar using Context-Free Grammar (CFG)
 */
export class CfgGrammarEnforcer extends BaseGrammarEnforcer {
  constructor(config: Partial<GrammarEnforcementConfig> = {}) {
    super({ ...config, method: 'context-free-grammar' });
  }

  getMethod(): GrammarEnforcementMethod {
    return 'context-free-grammar';
  }

  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult {
    try {
      const data = extractJson(input);

      // Apply CFG validation if custom grammar provided
      if (this.config.customGrammar) {
        const cfgResult = this.applyCfgGrammar(
          input,
          this.config.customGrammar
        );
        if (!cfgResult.valid) {
          return cfgResult;
        }
      }

      // Validate against Zod schema
      const result = schema.safeParse(data);
      if (result.success) {
        return {
          valid: true,
          data: result.data,
          grammarUsed: 'context-free-grammar',
        };
      }

      const errors: GrammarError[] = result.error.issues.map(
        (issue, index) => ({
          position: index,
          expected:
            'expected' in issue ? String(issue.expected) : 'valid value',
          found: 'received' in issue ? String(issue.received) : 'invalid value',
          message: `${issue.path.join('.')}: ${issue.message}`,
        })
      );

      return {
        valid: false,
        errors,
        grammarUsed: 'context-free-grammar',
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          this.createError(
            0,
            'valid CFG input',
            input.substring(0, 50),
            error instanceof Error ? error.message : 'Failed to parse'
          ),
        ],
        grammarUsed: 'context-free-grammar',
      };
    }
  }

  /**
   * Apply Context-Free Grammar rules
   */
  private applyCfgGrammar(
    input: string,
    grammar: string
  ): GrammarEnforcementResult {
    // Parse CFG rules
    const rules = this.parseCfgRules(grammar);

    if (rules.length === 0) {
      return { valid: true, grammarUsed: 'context-free-grammar' };
    }

    // Find start symbol (first rule by convention)
    const startRule = rules[0];
    if (!startRule) {
      return { valid: true, grammarUsed: 'context-free-grammar' };
    }
    const startSymbol = startRule.lhs;

    // Try to derive the input from the start symbol
    const derivable = this.canDerive(
      input.trim(),
      startSymbol,
      rules,
      new Set()
    );

    if (derivable) {
      return { valid: true, grammarUsed: 'context-free-grammar' };
    }

    return {
      valid: false,
      errors: [
        this.createError(
          0,
          startSymbol,
          input.substring(0, 50),
          'Input cannot be derived from grammar'
        ),
      ],
      grammarUsed: 'context-free-grammar',
    };
  }

  private parseCfgRules(grammar: string): CfgRule[] {
    const rules: CfgRule[] = [];
    const lines = grammar
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'));

    for (const line of lines) {
      // CFG rules: S -> A B | C
      const match = line.match(/^(\w+)\s*->\s*(.+)$/);
      if (match) {
        const lhs = match[1];
        const alternatives = match[2]?.split('|').map(alt => alt.trim()) ?? [];
        if (lhs) {
          for (const rhs of alternatives) {
            const symbols = rhs.split(/\s+/).filter(Boolean);
            rules.push({ lhs, rhs: symbols });
          }
        }
      }
    }

    return rules;
  }

  private canDerive(
    input: string,
    symbol: string,
    rules: CfgRule[],
    visited: Set<string>
  ): boolean {
    // Prevent infinite recursion
    const key = `${symbol}:${input}`;
    if (visited.has(key)) {
      return false;
    }
    visited.add(key);

    // Terminal symbol (lowercase by convention or quoted)
    if (symbol.startsWith('"') && symbol.endsWith('"')) {
      const terminal = symbol.slice(1, -1);
      return input === terminal;
    }

    if (symbol === symbol.toLowerCase() && !rules.some(r => r.lhs === symbol)) {
      return input === symbol;
    }

    // Find rules for this symbol
    const matchingRules = rules.filter(r => r.lhs === symbol);

    for (const rule of matchingRules) {
      if (this.tryDerive(input, rule.rhs, rules, visited)) {
        return true;
      }
    }

    return false;
  }

  private tryDerive(
    input: string,
    symbols: string[],
    rules: CfgRule[],
    visited: Set<string>
  ): boolean {
    if (symbols.length === 0) {
      return input.length === 0;
    }

    if (symbols.length === 1) {
      const sym = symbols[0];
      if (sym) {
        return this.canDerive(input, sym, rules, visited);
      }
      return false;
    }

    // For multiple symbols, try different splits
    const firstSymbol = symbols[0];
    const restSymbols = symbols.slice(1);

    if (!firstSymbol) {
      return false;
    }

    for (let i = 0; i <= input.length; i++) {
      const firstPart = input.substring(0, i);
      const restPart = input.substring(i);

      if (
        this.canDerive(firstPart, firstSymbol, rules, new Set(visited)) &&
        this.tryDerive(restPart, restSymbols, rules, visited)
      ) {
        return true;
      }
    }

    return false;
  }

  generateConstraints(schema: ZodSchema): GrammarConstraints {
    const metadata = introspectSchema(schema);
    const grammarLines: string[] = [];

    grammarLines.push('# Auto-generated CFG grammar');
    grammarLines.push('S -> VALUE');

    if (metadata.type === 'object') {
      grammarLines.push('VALUE -> OBJECT');
      grammarLines.push('OBJECT -> "{" MEMBERS "}" | "{" "}"');
      grammarLines.push('MEMBERS -> PAIR | PAIR "," MEMBERS');
      grammarLines.push('PAIR -> STRING ":" VALUE');
    } else if (metadata.type === 'array') {
      grammarLines.push('VALUE -> ARRAY');
      grammarLines.push('ARRAY -> "[" ELEMENTS "]" | "[" "]"');
      grammarLines.push('ELEMENTS -> VALUE | VALUE "," ELEMENTS');
    } else {
      grammarLines.push('VALUE -> STRING | NUMBER | BOOL | NULL');
    }

    grammarLines.push('STRING -> "\\"" CHARS "\\""');
    grammarLines.push('CHARS -> CHAR CHARS | epsilon');
    grammarLines.push('NUMBER -> DIGIT | DIGIT NUMBER');
    grammarLines.push(
      'DIGIT -> "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"'
    );
    grammarLines.push('BOOL -> "true" | "false"');
    grammarLines.push('NULL -> "null"');

    return {
      cfgGrammar: grammarLines.join('\n'),
    };
  }
}

interface CfgRule {
  lhs: string;
  rhs: string[];
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a grammar enforcer by method
 */
export function createGrammarEnforcer(
  method: GrammarEnforcementMethod,
  config?: Partial<GrammarEnforcementConfig>
): GrammarEnforcer {
  switch (method) {
    case 'json-schema':
      return new JsonSchemaGrammarEnforcer(config);
    case 'regex':
      return new RegexGrammarEnforcer(config);
    case 'peg-grammar':
      return new PegGrammarEnforcer(config);
    case 'context-free-grammar':
      return new CfgGrammarEnforcer(config);
    case 'none':
      return new NoOpGrammarEnforcer(config);
    default:
      throw new Error(`Unknown grammar enforcement method: ${method}`);
  }
}

/**
 * No-op grammar enforcer that performs no validation
 */
class NoOpGrammarEnforcer extends BaseGrammarEnforcer {
  getMethod(): GrammarEnforcementMethod {
    return 'none';
  }

  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult {
    try {
      const data = extractJson(input);
      const result = schema.safeParse(data);

      return {
        valid: result.success,
        data: result.success ? result.data : undefined,
        errors: result.success
          ? undefined
          : result.error.issues.map((issue, index) => ({
              position: index,
              expected: 'expected' in issue ? String(issue.expected) : 'valid',
              found: 'received' in issue ? String(issue.received) : 'invalid',
              message: issue.message,
            })),
        grammarUsed: 'none',
      };
    } catch {
      return {
        valid: false,
        errors: [
          this.createError(
            0,
            'valid JSON',
            input.substring(0, 50),
            'Failed to parse'
          ),
        ],
        grammarUsed: 'none',
      };
    }
  }

  generateConstraints(_schema: ZodSchema): GrammarConstraints {
    return {};
  }
}

// ============================================================================
// Exports
// ============================================================================

export { BaseGrammarEnforcer, NoOpGrammarEnforcer };
