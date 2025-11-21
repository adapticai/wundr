# Claude Code Configuration - Project Template

## Project Overview

<!-- CUSTOMIZE: Replace with your project description -->
This is a template configuration for Claude Code. Customize this file to define your project's specific rules, workflows, and best practices.

**Project Type**: <!-- web app / mobile app / API / library / CLI tool / etc. -->
**Tech Stack**: <!-- React, Node.js, Python, etc. -->
**Development Methodology**: <!-- SPARC, TDD, Agile, etc. -->

## 🚨 CRITICAL: VERIFICATION PROTOCOL

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: If something fails, report immediately with "❌ FAILED:"
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**NEVER claim completion without:**
- Actual terminal output proving it works
- Build command succeeding
- Tests passing (if applicable)
- The feature demonstrably working

## 🚨 CRITICAL: FILE ORGANIZATION

**ABSOLUTE RULES**:
1. **NEVER save files to the root directory** (except package.json, README.md, config files)
2. ALWAYS organize files in appropriate subdirectories
3. Use the directory structure defined in this file

### Directory Structure

<!-- CUSTOMIZE: Define your project's directory structure -->
```
project-root/
├── src/                  # Source code
│   ├── components/      # UI components
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript definitions
├── tests/               # Test files
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── docs/                # Documentation
├── scripts/             # Build and utility scripts
├── config/              # Configuration files
└── examples/            # Example usage
```

## Code Style & Best Practices

<!-- CUSTOMIZE: Define your coding standards -->

### General Principles
- **Modular Design**: Keep files under 500 lines
- **Single Responsibility**: One purpose per file/function
- **Clear Naming**: Descriptive, consistent naming conventions
- **Documentation**: Document complex logic and public APIs
- **Error Handling**: Always handle errors gracefully

### Language-Specific Standards

**TypeScript/JavaScript**:
- Use TypeScript for type safety
- Prefer functional programming patterns
- Use async/await over promises
- Follow ESLint and Prettier configurations

**Python**:
- Follow PEP 8 style guide
- Use type hints
- Write docstrings for public APIs
- Prefer list comprehensions over loops

<!-- Add more languages as needed -->

### Testing Standards
- Write tests BEFORE implementation (TDD)
- Maintain minimum 80% code coverage
- Test edge cases and error conditions
- Use descriptive test names

## Development Workflow

<!-- CUSTOMIZE: Define your preferred workflow -->

### Standard Development Process

1. **Planning**: Analyze requirements and create specification
2. **Design**: Define architecture and interfaces
3. **Implementation**: Write tests first, then code
4. **Review**: Self-review changes before committing
5. **Testing**: Run full test suite
6. **Documentation**: Update relevant docs

### Git Workflow

<!-- CUSTOMIZE: Define your git conventions -->
- **Branch naming**: `feature/`, `bugfix/`, `hotfix/`, `refactor/`
- **Commit messages**: Follow conventional commits format
- **Pull requests**: Required for all changes
- **Code review**: At least one approval required

### Build Commands

<!-- CUSTOMIZE: Add your project's build commands -->
```bash
npm run build          # Build project
npm run test           # Run tests
npm run lint           # Run linter
npm run typecheck      # Type checking
npm run format         # Format code
```

## Tools & Integrations

### Claude Code Tool Usage

**Claude Code handles**:
- File operations (Read, Write, Edit, Glob, Grep)
- Code generation and refactoring
- Bash commands and terminal operations
- Git operations
- Package management
- Testing and debugging

**MCP Tools handle** (if available):
- Coordination and planning
- Memory management
- Performance tracking
- External integrations

### Available MCP Tools

<!-- CUSTOMIZE: List your MCP tools if any -->

#### Wundr MCP Tools (if installed)

```bash
# Add Wundr MCP server
claude mcp add wundr "node /path/to/wundr/mcp-tools/dist/server.js"

# Verify installation
claude mcp list
```

**Available Wundr MCP Tools:**

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `mcp__wundr__drift_detection` | Monitor code quality drift | `{ action: "detect" }` |
| `mcp__wundr__pattern_standardize` | Auto-fix code patterns | `{ action: "run" }` |
| `mcp__wundr__monorepo_manage` | Monorepo management | `{ action: "check-deps" }` |
| `mcp__wundr__governance_report` | Generate governance reports | `{ reportType: "weekly" }` |
| `mcp__wundr__dependency_analyze` | Analyze dependencies | `{ scope: "circular" }` |
| `mcp__wundr__test_baseline` | Manage test coverage | `{ action: "compare" }` |
| `mcp__wundr__claude_config` | Generate Claude configs | `{ configType: "all" }` |

## Project-Specific Rules

<!-- CUSTOMIZE: Add your project-specific rules -->

### File Naming Conventions
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Tests: `*.test.ts` or `*.spec.ts`
- Constants: `UPPER_SNAKE_CASE.ts`

### Import Ordering
1. External dependencies
2. Internal modules
3. Relative imports
4. Type imports
5. CSS/styles

### Error Handling Patterns
```typescript
// Example error handling pattern
try {
  // operation
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new ApplicationError('User-friendly message', { cause: error });
}
```

### API Response Format
```typescript
// Example API response structure
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Environment & Configuration

### Environment Variables
<!-- CUSTOMIZE: Document your environment variables -->
```bash
# Required
API_KEY=your-api-key
DATABASE_URL=your-database-url

# Optional
LOG_LEVEL=info
FEATURE_FLAG_X=true
```

### Configuration Files
<!-- CUSTOMIZE: List important config files -->
- `tsconfig.json`: TypeScript configuration
- `.eslintrc.js`: ESLint rules
- `.prettierrc`: Code formatting
- `jest.config.js`: Test configuration

## Security Guidelines

<!-- CUSTOMIZE: Add your security requirements -->
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Validate all user inputs
- Sanitize data before database queries
- Use HTTPS for all external communications
- Keep dependencies up to date

## Performance Guidelines

<!-- CUSTOMIZE: Add your performance requirements -->
- Optimize bundle size (target: < X MB)
- Lazy load large components
- Implement caching strategies
- Monitor Core Web Vitals
- Use CDN for static assets

## Accessibility Standards

<!-- CUSTOMIZE: Add your accessibility requirements -->
- Follow WCAG 2.1 Level AA guidelines
- Use semantic HTML
- Provide alt text for images
- Ensure keyboard navigation
- Test with screen readers

## Documentation Standards

<!-- CUSTOMIZE: Define documentation requirements -->

### Code Documentation
- Document all public APIs
- Explain complex algorithms
- Include usage examples
- Keep docs close to code

### Project Documentation
- README.md: Project overview and setup
- CONTRIBUTING.md: Contribution guidelines
- CHANGELOG.md: Version history
- API.md: API documentation (if applicable)

## Troubleshooting

<!-- CUSTOMIZE: Add common issues and solutions -->

### Common Issues

**Build failures**:
1. Clear cache: `rm -rf node_modules && npm install`
2. Check Node.js version: `node --version`
3. Verify environment variables are set

**Test failures**:
1. Run tests in watch mode: `npm run test:watch`
2. Check test isolation
3. Verify test data setup

## Resources

<!-- CUSTOMIZE: Add your project resources -->
- **Documentation**: [link]
- **Issue Tracker**: [link]
- **CI/CD**: [link]
- **Design System**: [link]
- **API Docs**: [link]

## Team Conventions

<!-- CUSTOMIZE: Add team-specific conventions -->

### Communication
- Daily standups at [time]
- Code reviews within 24 hours
- Use [Slack/Teams] for quick questions
- Document decisions in [tool]

### Review Guidelines
- Check for test coverage
- Verify documentation updates
- Test locally before approving
- Provide constructive feedback

## Maintenance

### Regular Tasks
- [ ] Update dependencies monthly
- [ ] Review and update documentation
- [ ] Clean up deprecated code
- [ ] Audit security vulnerabilities
- [ ] Review and optimize performance

### Versioning
<!-- CUSTOMIZE: Define versioning strategy -->
- Follow Semantic Versioning (SemVer)
- Tag releases in git
- Maintain CHANGELOG.md
- Document breaking changes

## 🔧 Wundr MCP Tools Integration (Optional)

If your project uses Wundr MCP tools, this section provides comprehensive documentation.

### Installation & Setup

```bash
# Add Wundr MCP server to Claude Code
claude mcp add wundr "node /path/to/wundr/mcp-tools/dist/server.js"

# Or if using npm global install
npm install -g @wundr/mcp-tools
claude mcp add wundr "wundr-mcp-server"

# Verify installation
claude mcp list
```

### Complete MCP Tool Reference (7 Core Tools)

#### 1. **mcp__wundr__drift_detection** - Code Quality Drift Monitoring

| Action | Description |
|--------|-------------|
| `create-baseline` | Create new quality baseline |
| `detect` | Compare current state against baseline |
| `list-baselines` | List all available baselines |
| `trends` | Show drift trends over time |

```javascript
// Usage examples
mcp__wundr__drift_detection { action: "create-baseline" }
mcp__wundr__drift_detection { action: "detect", baselineVersion: "v1.0" }
```

#### 2. **mcp__wundr__pattern_standardize** - Code Pattern Standardization

| Action | Description |
|--------|-------------|
| `run` | Apply fixes automatically |
| `review` | Show patterns needing manual review |
| `check` | Check which patterns need fixing |

**Available Rules:** `consistent-error-handling`, `async-await-pattern`, `enum-standardization`, `service-lifecycle`, `import-ordering`, `naming-conventions`, `optional-chaining`, `type-assertions`

```javascript
// Usage examples
mcp__wundr__pattern_standardize { action: "run" }
mcp__wundr__pattern_standardize { action: "run", dryRun: true }
mcp__wundr__pattern_standardize { action: "run", rules: ["import-ordering"] }
```

#### 3. **mcp__wundr__monorepo_manage** - Monorepo Management

| Action | Description |
|--------|-------------|
| `init` | Initialize monorepo structure |
| `plan` | Generate migration plan |
| `add-package` | Create new package |
| `check-deps` | Check circular dependencies |

```javascript
// Usage examples
mcp__wundr__monorepo_manage { action: "init" }
mcp__wundr__monorepo_manage { action: "add-package", packageName: "utils", packageType: "package" }
mcp__wundr__monorepo_manage { action: "check-deps" }
```

#### 4. **mcp__wundr__governance_report** - Governance Reports

| Report Type | Description | Formats |
|-------------|-------------|---------|
| `weekly` | Weekly summary | markdown, json, html |
| `drift` | Drift analysis | markdown, json, html |
| `quality` | Code quality metrics | markdown, json, html |
| `compliance` | Standards compliance | markdown, json, html |

```javascript
// Usage examples
mcp__wundr__governance_report { reportType: "weekly", format: "markdown" }
mcp__wundr__governance_report { reportType: "quality", period: "30d" }
```

#### 5. **mcp__wundr__dependency_analyze** - Dependency Analysis

| Scope | Description | Output Formats |
|-------|-------------|----------------|
| `all` | Complete analysis | graph, json, markdown |
| `circular` | Find circular deps | json |
| `unused` | Find unused packages | json |
| `external` | External deps analysis | json |

```javascript
// Usage examples
mcp__wundr__dependency_analyze { scope: "circular" }
mcp__wundr__dependency_analyze { scope: "all", outputFormat: "markdown" }
```

#### 6. **mcp__wundr__test_baseline** - Test Coverage Management

| Action | Description | Test Types |
|--------|-------------|------------|
| `create` | Create coverage baseline | unit, integration, e2e, all |
| `compare` | Compare against baseline | unit, integration, e2e, all |
| `update` | Update baseline | unit, integration, e2e, all |

```javascript
// Usage examples
mcp__wundr__test_baseline { action: "create", testType: "all", threshold: 80 }
mcp__wundr__test_baseline { action: "compare", testType: "unit" }
```

#### 7. **mcp__wundr__claude_config** - Claude Code Configuration

| Config Type | Description |
|-------------|-------------|
| `claude-md` | Generate CLAUDE.md |
| `hooks` | Generate automation hooks |
| `conventions` | Generate coding conventions |
| `all` | Generate all configs |

```javascript
// Usage examples
mcp__wundr__claude_config { configType: "all" }
mcp__wundr__claude_config { configType: "claude-md", features: ["ai-assistance"] }
```

### Workflow Examples with MCP Tools

#### Daily Quality Check
```javascript
[BatchTool]:
  mcp__wundr__drift_detection { action: "detect" }
  mcp__wundr__dependency_analyze { scope: "circular" }
  mcp__wundr__test_baseline { action: "compare" }
```

#### Pre-Commit Validation
```javascript
[BatchTool]:
  mcp__wundr__pattern_standardize { action: "run" }
  mcp__wundr__monorepo_manage { action: "check-deps" }
  mcp__wundr__drift_detection { action: "detect" }
```

#### Weekly Maintenance
```javascript
[BatchTool]:
  mcp__wundr__drift_detection { action: "create-baseline" }
  mcp__wundr__test_baseline { action: "update", threshold: 80 }
  mcp__wundr__governance_report { reportType: "weekly" }
```

### Troubleshooting MCP Tools

```bash
# Server not found
claude mcp remove wundr
claude mcp add wundr "node /path/to/wundr/mcp-tools/dist/server.js"

# Check logs
claude mcp logs wundr

# Restart server
claude mcp restart wundr
```

## Support

For questions or issues:
1. Check project documentation
2. Search existing issues
3. Ask in team chat
4. Create new issue with template

---

**Last Updated**: [Date]
**Version**: 1.0.0
**Maintainer**: [Name/Team]
