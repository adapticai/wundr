# Project Conventions

**Version**: 1.0.0 **Last Updated**: 2024-11-21

This directory contains comprehensive coding conventions and standards for the project, with
integrated MCP tool references for automated quality management.

---

## Convention Files

| File                                                         | Topic                                            | Key MCP Tools                             |
| ------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------- |
| [01-general-principles.md](./01-general-principles.md)       | Core coding principles, SOLID, quality metrics   | `drift_detection`, `pattern_standardize`  |
| [02-typescript-javascript.md](./02-typescript-javascript.md) | TypeScript/JS standards, modules, async patterns | `pattern_standardize`                     |
| [03-testing.md](./03-testing.md)                             | TDD, test organization, coverage                 | `test_baseline`, `governance_report`      |
| [04-error-handling.md](./04-error-handling.md)               | Error types, patterns, logging                   | `pattern_standardize`                     |
| [05-api-design.md](./05-api-design.md)                       | REST API, responses, versioning                  | `dependency_analyze`, `governance_report` |
| [06-git-workflow.md](./06-git-workflow.md)                   | Branching, commits, PRs                          | `drift_detection`, `governance_report`    |
| [07-documentation.md](./07-documentation.md)                 | Code comments, JSDoc, README                     | `claude_config`                           |
| [08-mcp-tools.md](./08-mcp-tools.md)                         | Complete MCP tools guide                         | All tools                                 |

---

## Quick Start

### For New Team Members

1. Read [01-general-principles.md](./01-general-principles.md) for core principles
2. Read [02-typescript-javascript.md](./02-typescript-javascript.md) for language standards
3. Review [08-mcp-tools.md](./08-mcp-tools.md) for automated tools

### For Code Review

1. Reference [03-testing.md](./03-testing.md) for test requirements
2. Check [04-error-handling.md](./04-error-handling.md) for error patterns
3. Verify against [06-git-workflow.md](./06-git-workflow.md) for PR standards

### For MCP Tool Usage

1. Start with [08-mcp-tools.md](./08-mcp-tools.md) for comprehensive guide
2. Reference individual convention files for specific tool contexts

---

## MCP Tools Overview

### Available Wundr MCP Tools

| Tool                  | Purpose              | Key Actions                     |
| --------------------- | -------------------- | ------------------------------- |
| `drift_detection`     | Monitor code quality | create-baseline, detect, trends |
| `pattern_standardize` | Auto-fix patterns    | run, review, check              |
| `monorepo_manage`     | Monorepo management  | init, add-package, check-deps   |
| `governance_report`   | Generate reports     | weekly, quality, compliance     |
| `dependency_analyze`  | Analyze dependencies | all, circular, unused           |
| `test_baseline`       | Test coverage        | create, compare, update         |
| `claude_config`       | Configuration        | claude-md, hooks, conventions   |

### Common Workflows

```javascript
// Daily Quality Check
[BatchTool]:
  mcp__wundr__drift_detection { action: "detect" }
  mcp__wundr__dependency_analyze { scope: "circular" }
  mcp__wundr__test_baseline { action: "compare" }

// Pre-Commit Validation
[BatchTool]:
  mcp__wundr__pattern_standardize { action: "run" }
  mcp__wundr__drift_detection { action: "detect" }

// Weekly Maintenance
[BatchTool]:
  mcp__wundr__drift_detection { action: "create-baseline" }
  mcp__wundr__governance_report { reportType: "weekly" }
  mcp__wundr__dependency_analyze { scope: "unused" }
```

---

## Convention Structure

Each convention file follows this structure:

1. **Header**: Version, date, category
2. **Table of Contents**: Quick navigation
3. **Core Content**: Standards and examples
4. **MCP Tool Integration**: Relevant tool usage
5. **Enforcement**: How standards are enforced
6. **Related Conventions**: Cross-references

---

## Versioning

Conventions follow semantic versioning:

- **MAJOR**: Breaking changes to standards
- **MINOR**: New conventions added
- **PATCH**: Clarifications and fixes

### Change Process

1. Propose changes via PR
2. Review with team leads
3. Update version and date
4. Communicate changes to team

---

## Integration

### With CLAUDE.md

These conventions integrate with the project's CLAUDE.md file. Reference specific conventions in
CLAUDE.md for Claude Code to follow:

```markdown
## Project Conventions

Follow the conventions defined in:

- /packages/@wundr/computer-setup/resources/conventions/
```

### With CI/CD

Conventions can be enforced in CI/CD:

```yaml
# .github/workflows/conventions.yml
- name: Check Conventions
  run: |
    wundr-cli pattern-standardize --action check
    wundr-cli drift-detection --action detect
```

### With Pre-commit Hooks

```bash
#!/bin/sh
# .husky/pre-commit
wundr-cli pattern-standardize --action run
wundr-cli drift-detection --action detect || exit 1
```

---

## Support

- Questions: Ask in team chat
- Issues: Create GitHub issue with `conventions` label
- Updates: Submit PR with changes

---

**Maintainer**: Wundr Team
