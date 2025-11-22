# Quality Gate Hooks System

This directory contains the Quality Gate hook configuration files that enforce code quality
standards throughout the development workflow. These hooks integrate with Claude-Flow to provide
automated checks, AI-powered reviews, and comprehensive validation at critical points in the
development lifecycle.

## Overview

The Quality Gate system implements a three-tier validation architecture:

1. **Pre-Commit** - Fast, blocking checks that run before code is committed
2. **Post-Commit** - Verification checks that run after commits for feedback
3. **Pre-Push** - Comprehensive validation before code reaches remote repositories

## Hook Files

### pre-commit.yaml

Triggered before any commit is finalized. Ensures immediate code quality standards are met.

**Blocking Checks:**

- `lint` - Code style and formatting (auto-fix enabled)
- `type_check` - TypeScript type safety verification
- `reviewer_agent` - AI-powered code review

**Non-Blocking Checks:**

- `static_analysis` - Static code analysis for potential issues

**Failure Policies:**

- Lint failures trigger auto-fix and retry
- Type check failures block the commit
- Reviewer rejections escalate to session manager

### post-commit.yaml

Triggered after successful commits. Provides quality feedback without blocking.

**Checks:**

- `unit_tests` - Execute unit test suite
- `coverage_check` - Verify test coverage thresholds (80% minimum)
- `documentation_check` - Validate JSDoc and inline documentation
- `dependency_audit` - Check for known vulnerabilities
- `metrics_collector` - Collect and store quality metrics

**Coverage Thresholds:**

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### pre-push.yaml

Triggered before pushing to remote. Comprehensive validation for production readiness.

**Blocking Checks:**

- `build_verification` - Ensure project builds successfully
- `integration_tests` - Run integration test suite
- `security_scan` - SAST, secrets, and dependency scanning
- `security_reviewer` - AI-powered security analysis

**Non-Blocking Checks:**

- `e2e_tests` - End-to-end test scenarios
- `license_compliance` - Dependency license verification
- `performance_regression` - Performance benchmark validation
- `architecture_validator` - Architectural consistency checks

## Configuration Schema

### Check Definition

```yaml
checks:
  - name: check_name # Unique identifier for the check
    command: 'npm run ...' # Command to execute (for command-type checks)
    type: agent # Optional: 'agent' for AI-powered checks
    agent: agent-name # Required if type is 'agent'
    blocking: true|false # Whether failure blocks the operation
    description: '...' # Human-readable description
    timeout: 60000 # Timeout in milliseconds
    continueOnError: false # Continue even if check fails
    retry:
      attempts: 1 # Number of retry attempts
      delay: 1000 # Delay between retries in ms
    config: # Agent-specific configuration
      # ... agent options
```

### Failure Policies

```yaml
failurePolicy:
  onCheckNameFail: 'action'
```

**Available Actions:**

- `auto_fix_and_retry` - Attempt automatic fix and retry the check
- `block_and_report` - Block the operation and generate report
- `warn_and_continue` - Log warning but allow operation to proceed
- `escalate_to_session_manager` - Escalate to session manager for review
- `escalate_if_critical` - Only escalate for critical severity issues

### Notifications

```yaml
notifications:
  onSuccess: true|false
  onFailure: true|false
  channels:
    - type: console
    - type: agent_notification
      target: session_manager
    - type: memory_store
      key: 'swarm/path/to/store'
```

## Agent Integration

Quality Gate hooks integrate with Claude-Flow agents for AI-powered checks:

### Code Reviewer Agent

Used in pre-commit to review code changes:

```yaml
- name: reviewer_agent
  type: agent
  agent: code-reviewer
  config:
    autoApproveIf:
      - linesChanged < 50
      - confidence > 0.95
    escalateIf:
      - securityConcern: true
      - architecturalChange: true
```

### Security Reviewer Agent

Used in pre-push for security analysis:

```yaml
- name: security_reviewer
  type: agent
  agent: security-reviewer
  config:
    scanPatterns:
      - authentication
      - authorization
      - dataValidation
```

## Usage

### Manual Execution

Run hooks manually using Claude-Flow:

```bash
# Run pre-commit checks
npx claude-flow hooks pre-commit

# Run post-commit verification
npx claude-flow hooks post-commit

# Run pre-push validation
npx claude-flow hooks pre-push
```

### Git Integration

Hooks are automatically triggered by Git operations when configured:

```bash
# Install Git hooks
npx claude-flow hooks install

# Verify installation
npx claude-flow hooks status
```

### Skip Hooks (Use with Caution)

```bash
# Skip pre-commit (emergency only)
git commit --no-verify -m "emergency fix"

# Skip pre-push (emergency only)
git push --no-verify
```

## Customization

### Adding New Checks

1. Add a new check entry to the appropriate hook file
2. Ensure the command exists in `package.json` scripts
3. Set appropriate timeout and blocking status
4. Configure retry and failure policies

### Modifying Thresholds

Update threshold values in the relevant hook file:

```yaml
thresholds:
  statements: 85 # Increase from 80%
  branches: 80
  functions: 85
  lines: 85
```

### Custom Agents

Create custom agents in `.claude/agents/` and reference them:

```yaml
- name: custom_check
  type: agent
  agent: my-custom-agent
  config:
    # Custom configuration
```

## Troubleshooting

### Check Timeouts

Increase timeout values for slow operations:

```yaml
timeout: 600000 # 10 minutes
```

### Flaky Tests

Configure retries for intermittent failures:

```yaml
retry:
  attempts: 3
  delay: 5000
```

### Emergency Bypass

For critical situations, hooks can be bypassed:

```bash
SKIP_QUALITY_GATE=true git push
```

**Warning:** Bypassing quality gates should be exceptional and documented.

## Best Practices

1. **Keep pre-commit fast** - Target under 30 seconds for blocking checks
2. **Use non-blocking for slow checks** - Move time-consuming validations to post-commit
3. **Configure appropriate thresholds** - Balance quality with developer productivity
4. **Monitor metrics** - Track check durations and failure rates
5. **Document exceptions** - Record when and why hooks are bypassed

## Related Documentation

- [Claude-Flow Hooks Documentation](https://github.com/ruvnet/claude-flow)
- [SPARC Development Workflow](../../../CLAUDE.md)
- [Agent Configuration](../../agents/README.md)

## Version History

| Version | Date       | Changes                               |
| ------- | ---------- | ------------------------------------- |
| 1.0.0   | 2025-11-22 | Initial release with three-tier hooks |
