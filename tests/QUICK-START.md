# Wundr Test Suite - Quick Start Guide

## TL;DR

```bash
cd tests
./run-all-tests.sh
```

## What Gets Tested

1. **CLAUDE.md** - Configuration file syntax and completeness
2. **Agent Files** - Frontmatter validation against JSON schema
3. **Git Hooks** - Functionality and integration
4. **Git Worktrees** - Workflow correctness
5. **Templates** - Installation procedures
6. **Cross-Platform** - macOS/Linux/Windows compatibility
7. **Integration** - End-to-end workflows

## Quick Commands

### Run Everything
```bash
./run-all-tests.sh
```

### Run with Options
```bash
./run-all-tests.sh --verbose              # Show detailed output
./run-all-tests.sh --stop-on-failure      # Stop on first failure
./run-all-tests.sh --no-report            # Don't save report file
```

### Run Individual Tests
```bash
./validators/claude-md-validator.sh       # Test CLAUDE.md
./validators/agent-frontmatter-validator.sh  # Test agent files
./validators/hook-validator.sh            # Test hooks
./validators/git-worktree-validator.sh    # Test worktrees
./validators/template-validator.sh        # Test templates
./validators/platform-validator.sh        # Test cross-platform
./integration/full-workflow-test.sh       # Test workflows
```

### Cleanup
```bash
./utils/cleanup-test-artifacts.sh         # Clean test artifacts
./utils/cleanup-test-artifacts.sh --dry-run  # Show what would be cleaned
./utils/cleanup-test-artifacts.sh --verify   # Verify cleanup only
```

## Expected Output

### Success
```
======================================================================
  Test Suite Summary
======================================================================

Overall Results:
  Total Suites:    7
  Passed:          7
  Failed:          0
  Skipped:         0

  Pass Rate:       100%

All tests passed!
```

### Failure
```
======================================================================
  Test Suite Summary
======================================================================

Overall Results:
  Total Suites:    7
  Passed:          6
  Failed:          1
  Skipped:         0

  Pass Rate:       85%

Failure Details:
  [FAILED] CLAUDE.md Validation
    - Missing required section: Verification Protocol
    - Invalid code block syntax on line 145
```

## Common Issues

### Permission Denied
```bash
chmod +x tests/**/*.sh
```

### ajv Not Found
```bash
npm install -g ajv-cli ajv-formats
```

### Tests Fail on Windows
```bash
# Use Git Bash or WSL
git config core.autocrlf false
```

## What Each Test Does

### CLAUDE.md Validator
Checks that your CLAUDE.md file:
- Has all required sections
- Uses correct markdown syntax
- Follows best practices
- Contains proper examples

### Agent Frontmatter Validator
Verifies agent files:
- Have valid YAML frontmatter
- Match the JSON schema
- Use correct naming conventions
- Include required fields

### Hook Validator
Tests that git hooks:
- Are executable
- Have valid syntax
- Include proper checks
- Handle errors correctly

### Git Worktree Validator
Validates worktree workflows:
- Can create/remove worktrees
- Maintain isolation
- Support parallel development
- Clean up properly

### Template Validator
Checks templates:
- Have valid structure
- Include manifests
- Install correctly
- Build successfully

### Platform Validator
Ensures cross-platform compatibility:
- Portable shebangs
- Correct line endings
- Compatible commands
- No platform-specific code

### Integration Tests
Validates complete workflows:
- Project setup
- Feature development
- Multi-agent coordination
- Build and deployment

## Reading the Report

Test results are saved to `test-results.txt` with:
- Overall statistics
- Detailed results per suite
- Failure information
- Execution times

## Pre-Commit Integration

Add to `.git/hooks/pre-commit`:
```bash
#!/usr/bin/env bash
set -e
cd tests
./run-all-tests.sh --stop-on-failure
```

## CI/CD Integration

GitHub Actions snippet:
```yaml
- name: Run Test Suite
  run: |
    cd tests
    chmod +x run-all-tests.sh
    ./run-all-tests.sh
```

## File Locations

```
tests/
├── run-all-tests.sh           ← Master runner
├── validators/                ← 6 validation suites
├── integration/               ← Integration tests
├── utils/                     ← Cleanup utilities
└── schemas/                   ← JSON schemas
```

## Need Help?

1. Run with `--help`: `./run-all-tests.sh --help`
2. Check `README.md` for detailed docs
3. Review `TEST-SUITE-SUMMARY.md` for implementation details
4. Examine individual test scripts for specific checks

## Dependencies

Required:
- bash
- git
- node
- npm

Optional:
- yq (YAML parser)
- ajv-cli (installed automatically)

## Best Practices

1. Run tests before committing
2. Fix failures immediately
3. Keep tests fast (<2 minutes total)
4. Update tests when changing code
5. Review test results in CI/CD

---

**Quick Reference**: Run `./run-all-tests.sh` and you're good to go!
