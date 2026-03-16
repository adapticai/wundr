# Subagent Protocol

## Purpose

Subagents preserve the main context window and enable parallel work. This document defines the
formal protocol for when and how to delegate work to subagents.

Each subagent must have:

- One clearly defined objective
- Bounded scope
- An explicit deliverable
- Concise output summarized back to main context

## When to Use Subagents

- Codebase exploration across multiple packages
- Research requiring many file reads
- Parallel analysis of independent concerns
- Large file inspection that would pollute main context
- Complex dependency tracing across the monorepo

## When NOT to Use Subagents

- Simple, directed searches (use Grep/Glob directly)
- Reading a single known file
- Running a single build or test command
- Tasks that require sequential reasoning on main context

## Allowed Subagent Types

### 1. Repo Explorer

Use for: locating files, finding related modules, identifying call paths across the monorepo

Output: relevant files, key functions, package dependencies

Example prompt: "Find all packages that import from `@wundr/core` and list the specific exports they
use"

### 2. Architecture Analyst

Use for: assessing whether a change fits existing patterns, checking service boundaries, evaluating
design consistency

Output: current pattern description, mismatches or concerns, recommended approach

Example prompt: "Evaluate whether adding database access to `@wundr/agent-memory` violates the
service boundary with `@neolith/database`"

### 3. Bug Investigator

Use for: tracing root causes, inspecting logs, identifying likely failure points across packages

Output: probable root cause, evidence, candidate fix paths

Example prompt: "The build fails with a type error in `@wundr/structured-output`. Trace the cause
and identify whether it originates in this package or a dependency"

### 4. Test Auditor

Use for: identifying missing test coverage, checking relevant test suites, suggesting verification
steps

Output: tests to run, coverage gaps, recommended new tests

Example prompt: "Check test coverage for `@wundr/prompt-security` and identify untested code paths"

### 5. Refactor Reviewer

Use for: reviewing code elegance, identifying simplifications, spotting excess complexity

Output: unnecessary complexity identified, simplification opportunities, safer refactor suggestions

Example prompt: "Review the orchestrator implementations and identify duplicated patterns that could
be extracted into a shared base"

### 6. Dependency Analyst

Use for: tracing package dependency chains, identifying circular dependencies, checking version
alignment

Output: dependency graph for the target, circular dependency paths, version mismatches

Example prompt: "Map the full dependency chain for `@wundr/neolith` and flag any circular
dependencies"

## Output Format

Subagents should return structured findings:

```
## Findings

### Files Examined
- path/to/file1.ts (relevant because...)
- path/to/file2.ts (relevant because...)

### Key Observations
- Observation 1
- Observation 2

### Recommendation
Brief, actionable recommendation
```

## Rules

1. Never spawn a subagent for work you could do with a single Grep or Glob
2. Each subagent gets ONE task; don't overload with multiple objectives
3. Summarize subagent findings before acting on them
4. If a subagent's findings are surprising, verify independently before proceeding
5. Spawn multiple subagents in parallel when their tasks are independent
