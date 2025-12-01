# Git Workflow Conventions

**Version**: 1.0.0 **Last Updated**: 2024-11-21 **Category**: Development Process

This document defines Git branching strategies, commit conventions, and MCP tool integration for
repository management.

---

## Table of Contents

1. [Branching Strategy](#branching-strategy)
2. [Branch Naming](#branch-naming)
3. [Commit Conventions](#commit-conventions)
4. [Pull Request Guidelines](#pull-request-guidelines)
5. [Code Review Process](#code-review-process)
6. [Release Process](#release-process)
7. [MCP Tool Integration](#mcp-tool-integration)

---

## Branching Strategy

### Branch Types

```
main (or master)
  └── develop
        ├── feature/user-authentication
        ├── feature/payment-integration
        ├── bugfix/login-validation
        └── refactor/database-queries
```

### Branch Purposes

| Branch      | Purpose             | Base      | Merges To          |
| ----------- | ------------------- | --------- | ------------------ |
| `main`      | Production code     | -         | -                  |
| `develop`   | Integration branch  | `main`    | `main`             |
| `feature/*` | New features        | `develop` | `develop`          |
| `bugfix/*`  | Bug fixes           | `develop` | `develop`          |
| `hotfix/*`  | Production fixes    | `main`    | `main` & `develop` |
| `release/*` | Release preparation | `develop` | `main` & `develop` |

### Branch Lifecycle

```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/user-authentication

# Work on feature
git add .
git commit -m "feat(auth): add login form component"

# Keep updated with develop
git fetch origin develop
git rebase origin/develop

# Push and create PR
git push -u origin feature/user-authentication
```

---

## Branch Naming

### Format

```
<type>/<description>
```

### Types

| Type       | Purpose                 | Example                   |
| ---------- | ----------------------- | ------------------------- |
| `feature`  | New functionality       | `feature/user-dashboard`  |
| `bugfix`   | Bug fix                 | `bugfix/login-validation` |
| `hotfix`   | Critical production fix | `hotfix/security-patch`   |
| `refactor` | Code restructuring      | `refactor/api-endpoints`  |
| `docs`     | Documentation           | `docs/api-reference`      |
| `test`     | Test additions          | `test/auth-integration`   |
| `chore`    | Maintenance             | `chore/update-deps`       |

### Naming Rules

**Good:**

```
feature/user-authentication
bugfix/email-validation
hotfix/xss-vulnerability
refactor/database-queries
```

**Bad:**

```
feature/UserAuthentication   # No PascalCase
my-feature                   # Missing type prefix
feature/fix                  # Too vague
feature/implement-login-form-with-oauth-and-2fa-support  # Too long
```

---

## Commit Conventions

### Conventional Commits Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description             | Example                                |
| ---------- | ----------------------- | -------------------------------------- |
| `feat`     | New feature             | `feat(auth): add OAuth2 login`         |
| `fix`      | Bug fix                 | `fix(api): handle null response`       |
| `docs`     | Documentation           | `docs(readme): add setup instructions` |
| `style`    | Code style (formatting) | `style(lint): fix indentation`         |
| `refactor` | Code restructuring      | `refactor(db): optimize queries`       |
| `test`     | Adding tests            | `test(auth): add login tests`          |
| `chore`    | Maintenance tasks       | `chore(deps): update lodash`           |
| `perf`     | Performance improvement | `perf(api): add response caching`      |
| `ci`       | CI/CD changes           | `ci(github): add test workflow`        |
| `build`    | Build system changes    | `build(webpack): optimize bundle`      |
| `revert`   | Revert previous commit  | `revert: feat(auth): add OAuth2`       |

### Scopes

Scopes indicate the area affected:

- `auth`, `api`, `ui`, `db`, `config`
- Package names in monorepos
- Feature areas

### Subject Rules

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Keep under 50 characters

### Body and Footer

```
feat(auth): add OAuth2 authentication

Implement OAuth2 login flow with Google and GitHub providers.
Includes token refresh and session management.

- Add OAuth2 provider configuration
- Implement token exchange flow
- Add session persistence
- Create auth context provider

BREAKING CHANGE: Auth API now requires OAuth2 configuration
Closes #123
```

### Examples

```bash
# Feature with scope
git commit -m "feat(dashboard): add real-time notifications"

# Bug fix with issue reference
git commit -m "fix(api): handle null user response

Add null check before accessing user data to prevent
runtime errors when service returns empty response.

Fixes #456"

# Breaking change
git commit -m "feat(api)!: change response format

BREAKING CHANGE: API responses now use camelCase keys
instead of snake_case. Update your client code accordingly."

# Chore without scope
git commit -m "chore: update dependencies to latest versions"
```

---

## Pull Request Guidelines

### PR Title Format

Follow the same format as commits:

```
<type>(<scope>): <description>
```

Examples:

```
feat(auth): implement OAuth2 authentication
fix(api): resolve race condition in user fetch
docs(readme): update installation instructions
```

### PR Description Template

```markdown
## Summary

Brief description of what this PR does.

## Changes

- Added OAuth2 provider configuration
- Implemented token exchange flow
- Added session persistence

## Related Issues

Closes #123 Related to #456

## Type of Change

- [x] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing

- [x] Unit tests added/updated
- [x] Integration tests added/updated
- [ ] E2E tests added/updated
- [x] Manual testing completed

## Checklist

- [x] Code follows project conventions
- [x] Self-review completed
- [x] Documentation updated
- [x] No new warnings
- [x] Tests pass locally
- [x] MCP drift detection passes

## Screenshots (if applicable)

[Add screenshots here]

## Additional Notes

[Any additional information]
```

### PR Size Guidelines

| Size | Lines Changed | Review Time        |
| ---- | ------------- | ------------------ |
| XS   | < 50          | Minutes            |
| S    | 50-200        | < 1 hour           |
| M    | 200-500       | 1-2 hours          |
| L    | 500-1000      | 2-4 hours          |
| XL   | > 1000        | Consider splitting |

**Best Practice:** Keep PRs under 400 lines for effective review.

---

## Code Review Process

### Review Checklist

**Functionality:**

- [ ] Code does what it claims
- [ ] Edge cases handled
- [ ] Error handling appropriate
- [ ] No security vulnerabilities

**Code Quality:**

- [ ] Follows naming conventions
- [ ] Well-structured and readable
- [ ] No code duplication
- [ ] Appropriate abstractions

**Testing:**

- [ ] Adequate test coverage
- [ ] Tests are meaningful
- [ ] Edge cases tested
- [ ] Tests are maintainable

**Documentation:**

- [ ] Complex logic explained
- [ ] Public APIs documented
- [ ] README updated if needed

### Review Etiquette

**For Reviewers:**

- Be constructive, not critical
- Explain _why_, not just _what_
- Suggest alternatives
- Acknowledge good work
- Use "nit:" for minor issues

**For Authors:**

- Respond to all comments
- Explain decisions when asked
- Don't take feedback personally
- Thank reviewers for feedback

### Comment Prefixes

```
# Blocking issues
blocker: This will cause production failures

# Important suggestions
suggestion: Consider using async/await here

# Optional improvements
nit: Prefer const over let here

# Questions
question: What happens if user is null?

# Praise
praise: Great error handling here!
```

---

## Release Process

### Semantic Versioning

```
MAJOR.MINOR.PATCH

1.0.0 -> 1.0.1  (patch: bug fixes)
1.0.1 -> 1.1.0  (minor: new features)
1.1.0 -> 2.0.0  (major: breaking changes)
```

### Release Branch Workflow

```bash
# Create release branch
git checkout develop
git checkout -b release/1.2.0

# Bump version
npm version minor

# Create release
git commit -m "chore(release): prepare v1.2.0"
git push -u origin release/1.2.0

# After approval, merge to main
git checkout main
git merge release/1.2.0
git tag v1.2.0
git push origin main --tags

# Merge back to develop
git checkout develop
git merge release/1.2.0
git push origin develop
```

### Changelog Format

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added

- OAuth2 authentication with Google and GitHub (#123)
- Real-time notifications dashboard (#145)

### Changed

- Improved API response times by 40% (#167)

### Fixed

- Login validation error on mobile devices (#134)
- Race condition in user fetch (#156)

### Deprecated

- Legacy authentication API (will be removed in v2.0)

### Security

- Fixed XSS vulnerability in user input (#189)
```

---

## MCP Tool Integration

### GitHub Integration

**PR Management:**

```javascript
// Analyze PR for quality
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Check PR compliance
mcp__wundr__governance_report {
  reportType: "compliance"
}
```

**Repository Analysis:**

```javascript
// Check for circular dependencies
mcp__wundr__dependency_analyze {
  scope: "circular"
}

// Full repository analysis
mcp__wundr__dependency_analyze {
  scope: "all",
  outputFormat: "markdown"
}
```

### Pre-Merge Verification

```javascript
// Pre-merge quality check
[BatchTool]:
  // 1. Check code quality drift
  mcp__wundr__drift_detection {
    action: "detect"
  }

  // 2. Verify test coverage
  mcp__wundr__test_baseline {
    action: "compare",
    testType: "all"
  }

  // 3. Check dependencies
  mcp__wundr__dependency_analyze {
    scope: "circular"
  }

  // 4. Run pattern checks
  mcp__wundr__pattern_standardize {
    action: "check"
  }
```

### Release Preparation

```javascript
// Pre-release verification
[BatchTool]:
  // 1. Create quality baseline
  mcp__wundr__drift_detection {
    action: "create-baseline"
  }

  // 2. Update test baseline
  mcp__wundr__test_baseline {
    action: "update",
    testType: "all"
  }

  // 3. Generate release report
  mcp__wundr__governance_report {
    reportType: "weekly",
    format: "markdown"
  }

  // 4. Check compliance
  mcp__wundr__governance_report {
    reportType: "compliance"
  }
```

### Weekly Repository Health

```javascript
// Weekly repository health check
[BatchTool]:
  // 1. View drift trends
  mcp__wundr__drift_detection {
    action: "trends"
  }

  // 2. Check unused dependencies
  mcp__wundr__dependency_analyze {
    scope: "unused"
  }

  // 3. Generate weekly report
  mcp__wundr__governance_report {
    reportType: "weekly",
    period: "7d"
  }
```

---

## Git Hooks Integration

### Pre-commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# MCP pattern check (if available)
wundr-cli pattern-standardize --action check || exit 1
```

### Commit-msg Hook

```bash
#!/bin/sh
# .husky/commit-msg

# Validate commit message format
npx commitlint --edit $1
```

### Pre-push Hook

```bash
#!/bin/sh
# .husky/pre-push

# Full test suite
npm run test:all

# MCP drift check (if available)
wundr-cli drift-detection --action detect || exit 1
```

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [07-documentation.md](./07-documentation.md) - Documentation standards
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [Documentation Conventions](./07-documentation.md)
