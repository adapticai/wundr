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
```bash
# Example MCP tools
claude mcp list

# Project-specific MCP tools
# - tool_name: description
```

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
