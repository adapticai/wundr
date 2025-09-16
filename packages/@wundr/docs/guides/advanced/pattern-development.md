# Pattern Development Guide

Learn how to create custom patterns for your codebase analysis and enforcement.

## Overview

Wundr allows you to create custom patterns that match your team's specific coding standards and architectural decisions.

## Pattern Basics

### Pattern Structure

```typescript
export interface CustomPattern {
  name: string;
  description: string;
  category: 'syntax' | 'architecture' | 'security' | 'performance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  rules: PatternRule[];
}
```

### Simple Pattern Example

```typescript
export const noConsoleLogPattern: CustomPattern = {
  name: 'no-console-log',
  description: 'Prevent console.log statements in production code',
  category: 'syntax',
  severity: 'warning',
  rules: [
    {
      selector: 'CallExpression[callee.object.name="console"][callee.property.name="log"]',
      message: 'Use proper logging instead of console.log',
      fixable: true,
      fix: (node) => `logger.debug(${node.arguments.map(arg => arg.source()).join(', ')})`
    }
  ]
};
```

## Advanced Patterns

### Architecture Patterns

```typescript
export const layeredArchitecturePattern: CustomPattern = {
  name: 'layered-architecture',
  description: 'Enforce layered architecture boundaries',
  category: 'architecture',
  severity: 'error',
  rules: [
    {
      selector: 'ImportDeclaration',
      test: (node, context) => {
        const currentLayer = getLayerFromPath(context.filename);
        const importedLayer = getLayerFromPath(node.source.value);

        return !isValidLayerDependency(currentLayer, importedLayer);
      },
      message: 'Invalid layer dependency: {{currentLayer}} cannot import from {{importedLayer}}'
    }
  ]
};
```

### Security Patterns

```typescript
export const sqlInjectionPattern: CustomPattern = {
  name: 'sql-injection-prevention',
  description: 'Detect potential SQL injection vulnerabilities',
  category: 'security',
  severity: 'critical',
  rules: [
    {
      selector: 'TemplateLiteral',
      test: (node) => {
        return containsSQLKeywords(node.quasis) && hasUserInput(node.expressions);
      },
      message: 'Potential SQL injection: Use parameterized queries instead'
    }
  ]
};
```

## Pattern Testing

### Unit Tests

```typescript
import { testPattern } from '@wundr.io/pattern-tester';

describe('NoConsoleLogPattern', () => {
  it('should detect console.log statements', () => {
    const code = `
      function debug() {
        console.log('debugging info');
      }
    `;

    const results = testPattern(noConsoleLogPattern, code);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Use proper logging');
  });

  it('should provide fixes', () => {
    const code = `console.log('test');`;
    const result = testPattern(noConsoleLogPattern, code);

    expect(result[0].fix).toBe(`logger.debug('test');`);
  });
});
```

### Integration Testing

```typescript
import { analyzeProject } from '@wundr.io/cli';

describe('Custom Patterns Integration', () => {
  it('should work with real codebase', async () => {
    const results = await analyzeProject('./test-project', {
      patterns: [noConsoleLogPattern, layeredArchitecturePattern]
    });

    expect(results.patterns.violations).toMatchSnapshot();
  });
});
```

## Pattern Distribution

### Package Structure

```
my-wundr-patterns/
├── src/
│   ├── patterns/
│   │   ├── security/
│   │   ├── architecture/
│   │   └── syntax/
│   ├── utils/
│   └── index.ts
├── tests/
├── package.json
└── README.md
```

### Publishing

```json
{
  "name": "@company/wundr-patterns",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["wundr", "patterns", "code-quality"],
  "peerDependencies": {
    "@wundr.io/core": "^2.0.0"
  }
}
```

### Usage

```typescript
// wundr.config.ts
import { companyPatterns } from '@company/wundr-patterns';

export default {
  patterns: {
    enabled: true,
    custom: [
      ...companyPatterns,
      {
        // Additional project-specific patterns
      }
    ]
  }
};
```

## Best Practices

### Pattern Design

1. **Single Responsibility**: Each pattern should check one specific rule
2. **Clear Messages**: Provide actionable error messages
3. **Performance**: Use efficient selectors and early returns
4. **Maintainability**: Keep patterns simple and well-documented

### Testing Strategy

1. **Unit Test Each Rule**: Test individual pattern rules
2. **Integration Testing**: Test with real codebases
3. **Performance Testing**: Ensure patterns don't slow analysis
4. **Edge Cases**: Test boundary conditions

### Documentation

Document patterns with:
- Clear description and rationale
- Code examples (good and bad)
- Configuration options
- Migration guides

## Contributing

### Pattern Submission

1. Follow the pattern template
2. Include comprehensive tests
3. Add documentation
4. Submit via pull request

### Pattern Review Process

1. Code review for quality
2. Performance impact assessment
3. Community feedback
4. Integration testing

## Next Steps

- Learn about [Performance Optimization](./performance-optimization.md)
- Explore [Team Collaboration](/team/collaboration)
- Check out [Pattern Examples](../examples/)