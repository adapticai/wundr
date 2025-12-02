"use strict";
/**
 * Wundr-specific files included in all templates
 * Governance, AI integration, and best practices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wundrFiles = void 0;
exports.wundrFiles = [
    {
        path: '.wundr/baseline.json',
        content: `{
  "version": "1.0.0",
  "timestamp": "${new Date().toISOString()}",
  "metrics": {
    "complexity": {
      "max": 15,
      "warning": 10,
      "current": 0
    },
    "coverage": {
      "minimum": 70,
      "target": 85,
      "current": 0
    },
    "duplicates": {
      "maxPercentage": 5,
      "current": 0
    },
    "dependencies": {
      "maxDepth": 5,
      "allowCircular": false,
      "current": {
        "depth": 0,
        "circular": []
      }
    },
    "performance": {
      "buildTime": {
        "max": 30000,
        "warning": 20000
      },
      "bundleSize": {
        "max": 5000000,
        "warning": 3000000
      }
    }
  },
  "patterns": {
    "approved": [
      "error-first-callbacks",
      "async-await",
      "functional-components",
      "hooks-only",
      "typed-exports"
    ],
    "deprecated": [
      "callbacks",
      "class-components",
      "var-declarations",
      "any-type"
    ]
  },
  "rules": {
    "naming": {
      "components": "PascalCase",
      "hooks": "camelCase-use-prefix",
      "utilities": "camelCase",
      "constants": "UPPER_SNAKE_CASE",
      "interfaces": "PascalCase-I-prefix"
    },
    "structure": {
      "maxFileLines": 500,
      "maxFunctionLines": 50,
      "maxComplexity": 10,
      "maxDepth": 4
    }
  }
}`,
    },
    {
        path: '.wundr/config.yaml',
        content: `# Wundr Configuration
version: 1.0.0

governance:
  enabled: true
  baseline: .wundr/baseline.json
  
drift:
  checkOnCommit: true
  blockOnDrift: true
  autoFix: false
  threshold: 10
  
analysis:
  enabled: true
  schedule: "0 0 * * *"
  targets:
    - src/**/*.ts
    - src/**/*.tsx
    - app/**/*.ts
    - app/**/*.tsx
  ignore:
    - node_modules
    - dist
    - build
    - .next
    - coverage
    
reporting:
  enabled: true
  format: json
  output: .wundr/reports
  
integrations:
  github:
    enabled: true
    checkOnPR: true
    commentOnPR: true
  claude:
    enabled: true
    configFile: CLAUDE.md
  slack:
    enabled: false
    webhook: ""
    
monitoring:
  metrics:
    - complexity
    - coverage
    - duplicates
    - dependencies
    - performance
  alerts:
    - type: threshold
      metric: complexity
      value: 15
      severity: error
    - type: threshold
      metric: coverage
      value: 70
      severity: warning`,
    },
    {
        path: '.wundr/patterns.yaml',
        content: `# Wundr Pattern Definitions
version: 1.0.0

patterns:
  error-handling:
    - name: try-catch-async
      description: All async functions must have try-catch
      pattern: |
        async function.*{
          try {
            .*
          } catch.*{
            .*
          }
        }
      severity: error
      
    - name: error-logging
      description: All errors must be logged
      pattern: |
        catch.*{
          .*logger.*
        }
      severity: warning
      
  imports:
    - name: absolute-imports
      description: Use absolute imports for internal modules
      pattern: |
        import .* from ['"]@/.*['"]
      severity: info
      
    - name: grouped-imports
      description: Group imports by type
      order:
        - react
        - external
        - internal
        - relative
        - styles
      severity: warning
      
  naming:
    - name: component-naming
      description: React components must be PascalCase
      pattern: |
        (function|const) [A-Z][a-zA-Z]*.*=.*=>.*JSX.Element
      severity: error
      
    - name: hook-naming
      description: Hooks must start with 'use'
      pattern: |
        (function|const) use[A-Z][a-zA-Z]*
      severity: error
      
  structure:
    - name: single-responsibility
      description: Functions should do one thing
      maxLines: 50
      maxComplexity: 10
      severity: warning
      
    - name: file-organization
      description: Files should be organized by feature
      structure:
        - components/
        - hooks/
        - utils/
        - types/
        - services/
      severity: info`,
    },
    {
        path: '.wundr/drift-check.yaml',
        content: `# Drift Detection Configuration
version: 1.0.0

checks:
  - name: complexity-drift
    type: metric
    metric: complexity
    baseline: .wundr/baseline.json
    threshold: 10
    action: warn
    
  - name: coverage-drift
    type: metric
    metric: coverage
    baseline: .wundr/baseline.json
    threshold: -5
    action: block
    
  - name: dependency-drift
    type: dependency
    baseline: .wundr/baseline.json
    checks:
      - circular-dependencies
      - max-depth
      - security-vulnerabilities
    action: warn
    
  - name: pattern-drift
    type: pattern
    baseline: .wundr/patterns.yaml
    checks:
      - deprecated-patterns
      - missing-patterns
    action: warn
    
  - name: performance-drift
    type: performance
    baseline: .wundr/baseline.json
    metrics:
      - build-time
      - bundle-size
      - runtime-performance
    threshold: 20
    action: warn
    
remediation:
  auto-fix:
    enabled: false
    patterns:
      - import-ordering
      - formatting
      - naming-conventions
      
  suggestions:
    enabled: true
    verbose: true
    
  reporting:
    enabled: true
    format: markdown
    output: .wundr/drift-report.md`,
    },
    {
        path: 'CLAUDE.md',
        content: `# Claude Code Configuration - {{projectName}}

## Project Overview
{{description}}

This is a wundr-compliant project with integrated governance, automated quality checks, and AI-assisted development.

## Key Commands

### Development
\`\`\`bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run typecheck    # TypeScript type checking
\`\`\`

### Wundr Governance
\`\`\`bash
npm run analyze      # Run wundr analysis
npm run govern       # Check governance compliance
wundr drift check    # Check for drift from baseline
wundr drift fix      # Auto-fix drift issues
\`\`\`

## Code Style Guidelines

### TypeScript
- Strict mode enabled
- No implicit any
- Explicit return types for functions
- Interfaces over types when possible

### React (if applicable)
- Functional components only
- Custom hooks for logic extraction
- Props interfaces for all components
- Memoization where appropriate

### Testing
- Minimum 70% coverage required
- Unit tests for utilities
- Integration tests for APIs
- E2E tests for critical paths

## Architecture Decisions

### State Management
- Zustand for global state
- React Query for server state
- Local state with useState/useReducer

### Styling
- Tailwind CSS for utilities
- CSS Modules for component styles
- shadcn/ui for base components

### Data Fetching
- React Query for caching
- Axios for HTTP client
- Error boundaries for failures

## AI Integration

### Claude Flow Configuration
- Swarm topology: mesh
- Max agents: 8
- Available agents: coder, reviewer, tester, planner

### MCP Tools
- code-analyzer
- performance-benchmarker
- test-generator
- documentation-writer

## Important Rules

1. **Never commit directly to main** - Always use feature branches
2. **All PRs require review** - Automated wundr checks must pass
3. **Keep complexity low** - Max cyclomatic complexity of 10
4. **Document complex logic** - Add comments for non-obvious code
5. **Follow naming conventions** - As defined in .wundr/baseline.json

## Troubleshooting

### Build Failures
1. Check TypeScript errors: \`npm run typecheck\`
2. Check linting: \`npm run lint\`
3. Check tests: \`npm run test\`

### Governance Failures
1. Run analysis: \`wundr analyze\`
2. Check drift: \`wundr drift check\`
3. Review report: \`.wundr/reports/latest.json\`

## Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Keep dependencies updated
- Run security audits regularly

## Performance

- Keep bundle size under 3MB
- Lazy load routes and components
- Optimize images and assets
- Use production builds for testing

## Contact

- Team Lead: {{author}}
- Documentation: /docs
- Issues: /issues`,
        template: true,
    },
    {
        path: '.github/workflows/wundr-check.yml',
        content: `name: Wundr Governance Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  governance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run linting
        run: pnpm lint
        
      - name: Run type checking
        run: pnpm typecheck
        
      - name: Run tests
        run: pnpm test --coverage
        
      - name: Install wundr CLI
        run: npm install -g @wundr/cli
        
      - name: Run wundr analysis
        run: wundr analyze
        
      - name: Check governance compliance
        run: wundr govern check
        
      - name: Check for drift
        run: wundr drift check
        
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
          
      - name: Upload wundr reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: wundr-reports
          path: .wundr/reports/
          
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('.wundr/reports/latest.json', 'utf8'));
            
            const comment = \`## 📊 Wundr Governance Report
            
            ### Metrics
            - **Complexity**: \${report.metrics.complexity.current} / \${report.metrics.complexity.max}
            - **Coverage**: \${report.metrics.coverage.current}% / \${report.metrics.coverage.minimum}%
            - **Duplicates**: \${report.metrics.duplicates.current}%
            
            ### Status: \${report.passed ? '✅ Passed' : '❌ Failed'}
            
            \${report.suggestions ? '### Suggestions\\n' + report.suggestions.join('\\n') : ''}
            \`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });`,
    },
    {
        path: '.husky/pre-commit',
        content: `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint
npm run typecheck
wundr drift check --quiet || (echo "❌ Drift detected! Run 'wundr drift fix' to resolve." && exit 1)`,
    },
    {
        path: '.husky/commit-msg',
        content: `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit $1`,
    },
    {
        path: 'commitlint.config.js',
        content: `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'revert',
        'ci',
        'build'
      ]
    ],
    'subject-case': [2, 'never', ['upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100]
  }
}`,
    },
    {
        path: '.eslintrc.json',
        content: `{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "project": ["./tsconfig.json"]
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  },
  "ignorePatterns": ["dist", "build", ".next", "node_modules", "coverage"]
}`,
    },
    {
        path: '.prettierrc',
        content: `{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}`,
    },
    {
        path: '.gitignore',
        content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Production
build/
dist/
.next/
out/

# Testing
coverage/
.nyc_output

# Misc
.DS_Store
*.pem
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# IDE
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea
*.swp
*.swo
*~

# Turborepo
.turbo

# Wundr
.wundr/reports/
.wundr/cache/
.wundr/*.log

# OS
Thumbs.db`,
    },
];
//# sourceMappingURL=wundr-files.js.map