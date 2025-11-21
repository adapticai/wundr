# General Coding Principles Convention

**Version**: 1.0.0
**Last Updated**: 2024-11-21
**Category**: Core Conventions

This document defines the foundational coding principles and quality standards for the project.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Code Quality Standards](#code-quality-standards)
3. [File Organization](#file-organization)
4. [MCP Tool Integration](#mcp-tool-integration)
5. [Verification Protocol](#verification-protocol)
6. [Enforcement](#enforcement)

---

## Core Principles

### SOLID Principles

1. **Single Responsibility (S)**: Each module/class should have one reason to change
2. **Open/Closed (O)**: Open for extension, closed for modification
3. **Liskov Substitution (L)**: Subtypes must be substitutable for base types
4. **Interface Segregation (I)**: Many specific interfaces over one general interface
5. **Dependency Inversion (D)**: Depend on abstractions, not concretions

### Development Mantras

- **Readability First**: Code is read more often than written
- **Explicit Over Implicit**: Clear intent beats clever tricks
- **DRY (Don't Repeat Yourself)**: Extract reusable logic
- **KISS (Keep It Simple)**: Simple solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)**: Don't add unused features

### Code Quality Metrics

| Metric | Maximum Allowed | Target |
|--------|-----------------|--------|
| File size | 500 lines | 300 lines |
| Function size | 50 lines | 25 lines |
| Function parameters | 5 | 3 |
| Cyclomatic complexity | 10 | 5 |
| Nesting depth | 4 levels | 2 levels |
| Line length | 100 characters | 80 characters |

---

## Code Quality Standards

### Naming Conventions

**Case Standards:**

| Type | Convention | Example |
|------|------------|---------|
| Variables, functions | camelCase | `userName`, `calculateTotal` |
| Classes, interfaces, types | PascalCase | `UserService`, `ApiResponse` |
| Constants, env vars | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_URL` |
| File names, CSS classes | kebab-case | `user-profile.ts`, `main-header` |

**Naming Patterns:**

```typescript
// Boolean variables: use is, has, should prefixes
const isAuthenticated = true;
const hasPermission = false;
const shouldUpdate = true;

// Functions: use verb prefixes
function getUser() {}
function setUserName() {}
function validateEmail() {}
function handleClick() {}

// Event handlers: use handle or on prefix
function handleSubmit() {}
function onUserLogin() {}

// Arrays: use plural nouns
const users = [];
const errorMessages = [];
```

### Code Structure

**Function Organization:**
```typescript
// 1. Early returns for edge cases
function processUser(user: User | null): Result {
  if (!user) {
    return { error: 'User not found' };
  }

  // 2. Main logic
  const processed = transform(user);

  // 3. Return result
  return { data: processed };
}
```

**Class Organization:**
```typescript
class UserService {
  // 1. Properties (public, then private)
  public readonly name: string;
  private _cache: Map<string, User>;

  // 2. Constructor
  constructor(private readonly db: Database) {}

  // 3. Public methods
  public async getUser(id: string): Promise<User> {}

  // 4. Private methods
  private validateId(id: string): boolean {}
}
```

---

## File Organization

### Directory Structure

```
project-root/
├── src/                  # Source code (NEVER save to root!)
│   ├── components/       # UI components
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript definitions
│   └── config/           # Runtime configuration
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                 # Documentation
├── scripts/              # Build and utility scripts
├── config/               # Build-time configuration
└── examples/             # Example usage
```

### File Placement Rules

**NEVER place in root directory:**
- Source code files
- Test files
- Working documents
- Temporary files

**Allowed in root:**
- `package.json`
- `README.md`
- Configuration files (`.eslintrc`, `tsconfig.json`, etc.)
- Lock files

---

## MCP Tool Integration

### Quality Monitoring with MCP Tools

Use Wundr MCP tools to enforce and monitor code quality:

**Drift Detection:**
```javascript
// Create baseline at project milestone
mcp__wundr__drift_detection { action: "create-baseline" }

// Check for quality drift before merge
mcp__wundr__drift_detection { action: "detect" }

// Review trends weekly
mcp__wundr__drift_detection { action: "trends" }
```

**Pattern Standardization:**
```javascript
// Check naming conventions
mcp__wundr__pattern_standardize {
  action: "check",
  rules: ["naming-conventions"]
}

// Auto-fix patterns
mcp__wundr__pattern_standardize {
  action: "run",
  rules: ["naming-conventions", "import-ordering"]
}
```

**Governance Reports:**
```javascript
// Generate quality metrics report
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Check compliance with standards
mcp__wundr__governance_report {
  reportType: "compliance"
}
```

### Automated Quality Checks

**Pre-Commit Workflow:**
```javascript
[BatchTool]:
  // 1. Standardize code patterns
  mcp__wundr__pattern_standardize { action: "run" }

  // 2. Detect quality drift
  mcp__wundr__drift_detection { action: "detect" }

  // 3. Check circular dependencies
  mcp__wundr__dependency_analyze { scope: "circular" }
```

**Weekly Maintenance:**
```javascript
[BatchTool]:
  // 1. Create new baseline
  mcp__wundr__drift_detection { action: "create-baseline" }

  // 2. Generate weekly report
  mcp__wundr__governance_report { reportType: "weekly" }

  // 3. Check for unused dependencies
  mcp__wundr__dependency_analyze { scope: "unused" }
```

---

## Verification Protocol

### MANDATORY: Always Verify, Never Assume

**After EVERY code change:**

1. **TEST IT**: Run actual commands and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: Report failures immediately with "FAILED:"
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**Verification Checklist:**

- [ ] Build succeeds (`npm run build` output shown)
- [ ] Tests pass (`npm run test` output shown)
- [ ] Linting passes (`npm run lint` output shown)
- [ ] Feature works (demonstrated execution)

### MCP Tool Verification

```javascript
// Verify quality before claiming completion
mcp__wundr__drift_detection { action: "detect" }
// Output must show: severity: "none" or "low"

// Verify test coverage
mcp__wundr__test_baseline { action: "compare" }
// Output must show: status: "STABLE" or "IMPROVED"
```

---

## Enforcement

### Automated Enforcement

These principles are enforced through:

1. **MCP Tools**: Automated drift detection and pattern standardization
2. **Linting**: ESLint rules configured in `.eslintrc`
3. **Type Checking**: TypeScript strict mode
4. **Pre-commit Hooks**: Husky or lint-staged
5. **CI/CD**: GitHub Actions workflow checks

### Manual Review Checklist

During code review, verify:

- [ ] Follows naming conventions
- [ ] Functions are appropriately sized
- [ ] No code duplication
- [ ] Proper error handling
- [ ] Files in correct directories
- [ ] MCP drift detection passes

---

## Related Conventions

- [02-typescript-javascript.md](./02-typescript-javascript.md) - Language-specific standards
- [03-testing.md](./03-testing.md) - Testing conventions
- [04-error-handling.md](./04-error-handling.md) - Error handling patterns
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [TypeScript/JavaScript Conventions](./02-typescript-javascript.md)
