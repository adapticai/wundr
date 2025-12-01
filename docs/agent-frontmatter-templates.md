# Agent Frontmatter Templates - Complete Reference

This document contains standardized frontmatter templates for all 54 agent types in the Claude Flow
ecosystem.

## Template Structure

Each agent template follows this standardized format:

```yaml
---
name: agent-name
description: When to use this agent (specific and action-oriented)
tools: tool1, tool2, tool3
model: sonnet|opus|haiku|inherit
permissionMode: default|acceptEdits|bypassPermissions|plan|ignore
skills: skill1, skill2
---
```

---

## 1. Core Development Agents (5)

### 1.1 Coder

```yaml
---
name: coder
description:
  Implement features, write production code, and translate specifications into working software
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
permissionMode: acceptEdits
skills: programming, debugging, code-optimization
---
```

### 1.2 Reviewer

```yaml
---
name: reviewer
description:
  Review code quality, identify bugs, ensure best practices, and provide constructive feedback
tools: Read, Grep, Glob, Bash
model: sonnet
permissionMode: default
skills: code-review, security-analysis, best-practices
---
```

### 1.3 Tester

```yaml
---
name: tester
description: Create comprehensive test suites, validate functionality, and ensure code coverage
tools: Read, Write, Edit, Bash, Grep
model: sonnet
permissionMode: acceptEdits
skills: testing, test-automation, quality-assurance
---
```

### 1.4 Planner

```yaml
---
name: planner
description:
  Break down complex tasks into actionable steps, create roadmaps, and coordinate workflows
tools: TodoWrite, Read, Grep
model: sonnet
permissionMode: plan
skills: task-decomposition, project-planning, workflow-design
---
```

### 1.5 Researcher

```yaml
---
name: researcher
description:
  Investigate requirements, analyze codebases, gather context, and provide technical insights
tools: Read, Grep, Glob, WebSearch, WebFetch
model: sonnet
permissionMode: default
skills: analysis, documentation-review, research
---
```

---

## 2. Swarm Coordination Agents (5)

### 2.1 Hierarchical Coordinator

```yaml
---
name: hierarchical-coordinator
description: Manage multi-level agent hierarchies with clear command chains for complex projects
tools: Task, TodoWrite, mcp__claude-flow__agent_spawn, mcp__claude-flow__swarm_status
model: opus
permissionMode: plan
skills: hierarchy-management, delegation, oversight
---
```

### 2.2 Mesh Coordinator

```yaml
---
name: mesh-coordinator
description: Coordinate peer-to-peer agent networks where agents collaborate as equals
tools: Task, TodoWrite, mcp__claude-flow__agent_spawn, mcp__claude-flow__swarm_monitor
model: sonnet
permissionMode: plan
skills: peer-coordination, distributed-collaboration, consensus-building
---
```

### 2.3 Adaptive Coordinator

```yaml
---
name: adaptive-coordinator
description: Dynamically adjust swarm topology and agent allocation based on task complexity
tools: Task, TodoWrite, mcp__claude-flow__agent_spawn, mcp__claude-flow__agent_metrics
model: opus
permissionMode: plan
skills: dynamic-optimization, topology-adaptation, resource-allocation
---
```

### 2.4 Collective Intelligence Coordinator

```yaml
---
name: collective-intelligence-coordinator
description:
  Aggregate insights from multiple agents to make informed decisions and solve complex problems
tools: Task, TodoWrite, mcp__claude-flow__task_results, mcp__claude-flow__neural_patterns
model: opus
permissionMode: plan
skills: insight-aggregation, collective-reasoning, decision-synthesis
---
```

### 2.5 Swarm Memory Manager

```yaml
---
name: swarm-memory-manager
description: Manage shared memory across agents, persist context, and ensure knowledge continuity
tools: mcp__claude-flow__memory_usage, mcp__claude-flow__neural_train, Read, Write
model: sonnet
permissionMode: acceptEdits
skills: memory-management, context-persistence, knowledge-sharing
---
```

---

## 3. Consensus & Distributed Agents (7)

### 3.1 Byzantine Coordinator

```yaml
---
name: byzantine-coordinator
description:
  Ensure fault-tolerant consensus in adversarial environments with Byzantine fault tolerance
tools: Task, TodoWrite, mcp__claude-flow__swarm_status, mcp__claude-flow__task_results
model: opus
permissionMode: plan
skills: fault-tolerance, byzantine-consensus, security-verification
---
```

### 3.2 Raft Manager

```yaml
---
name: raft-manager
description: Implement Raft consensus algorithm for leader election and log replication
tools: Task, TodoWrite, mcp__claude-flow__swarm_monitor, mcp__claude-flow__agent_metrics
model: sonnet
permissionMode: plan
skills: leader-election, log-replication, consensus-protocols
---
```

### 3.3 Gossip Coordinator

```yaml
---
name: gossip-coordinator
description: Propagate information through gossip protocols for eventual consistency
tools: Task, mcp__claude-flow__agent_list, mcp__claude-flow__swarm_status
model: sonnet
permissionMode: plan
skills: gossip-protocols, information-propagation, eventual-consistency
---
```

### 3.4 Consensus Builder

```yaml
---
name: consensus-builder
description: Build consensus among agents through voting, negotiation, and conflict resolution
tools: Task, TodoWrite, mcp__claude-flow__task_results, mcp__claude-flow__agent_metrics
model: opus
permissionMode: plan
skills: voting-systems, conflict-resolution, negotiation
---
```

### 3.5 CRDT Synchronizer

```yaml
---
name: crdt-synchronizer
description: Synchronize distributed state using Conflict-free Replicated Data Types
tools: Read, Write, mcp__claude-flow__memory_usage, mcp__claude-flow__neural_patterns
model: sonnet
permissionMode: acceptEdits
skills: crdt-implementation, state-synchronization, conflict-resolution
---
```

### 3.6 Quorum Manager

```yaml
---
name: quorum-manager
description: Manage quorum-based decision making and ensure majority agreement
tools: Task, TodoWrite, mcp__claude-flow__agent_list, mcp__claude-flow__task_results
model: sonnet
permissionMode: plan
skills: quorum-management, majority-voting, distributed-agreement
---
```

### 3.7 Security Manager

```yaml
---
name: security-manager
description: Enforce security policies, validate permissions, and protect against threats
tools: Read, Grep, Bash, mcp__claude-flow__swarm_status
model: opus
permissionMode: default
skills: security-analysis, threat-detection, policy-enforcement
---
```

---

## 4. Performance & Optimization Agents (5)

### 4.1 Performance Analyzer

```yaml
---
name: perf-analyzer
description: Analyze code performance, identify bottlenecks, and recommend optimizations
tools: Read, Grep, Bash, mcp__claude-flow__benchmark_run
model: sonnet
permissionMode: default
skills: performance-analysis, bottleneck-detection, profiling
---
```

### 4.2 Performance Benchmarker

```yaml
---
name: performance-benchmarker
description: Create and run benchmarks to measure performance metrics and track improvements
tools: Read, Write, Bash, mcp__claude-flow__benchmark_run
model: sonnet
permissionMode: acceptEdits
skills: benchmarking, metrics-collection, performance-testing
---
```

### 4.3 Task Orchestrator

```yaml
---
name: task-orchestrator
description: Orchestrate complex multi-agent tasks with optimal scheduling and resource allocation
tools: Task, TodoWrite, mcp__claude-flow__task_orchestrate, mcp__claude-flow__agent_metrics
model: opus
permissionMode: plan
skills: task-scheduling, resource-optimization, workflow-orchestration
---
```

### 4.4 Memory Coordinator

```yaml
---
name: memory-coordinator
description: Optimize memory usage across agents and manage memory-intensive operations
tools: mcp__claude-flow__memory_usage, mcp__claude-flow__neural_status, Bash
model: sonnet
permissionMode: plan
skills: memory-optimization, resource-management, cache-coordination
---
```

### 4.5 Smart Agent

```yaml
---
name: smart-agent
description: Use neural patterns and machine learning to adapt strategies and improve performance
tools:
  mcp__claude-flow__neural_train, mcp__claude-flow__neural_patterns, mcp__claude-flow__neural_status
model: opus
permissionMode: plan
skills: machine-learning, pattern-recognition, adaptive-optimization
---
```

---

## 5. GitHub & Repository Agents (9)

### 5.1 GitHub Modes

```yaml
---
name: github-modes
description: Execute GitHub-specific workflows including issues, PRs, and repository management
tools: Bash, mcp__claude-flow__github_swarm, mcp__claude-flow__repo_analyze
model: sonnet
permissionMode: acceptEdits
skills: github-api, workflow-automation, repository-operations
---
```

### 5.2 PR Manager

```yaml
---
name: pr-manager
description: Create, review, and manage pull requests with automated checks and approvals
tools: Bash, Read, mcp__claude-flow__pr_enhance, mcp__claude-flow__code_review
model: sonnet
permissionMode: acceptEdits
skills: pr-management, code-review, merge-strategies
---
```

### 5.3 Code Review Swarm

```yaml
---
name: code-review-swarm
description: Coordinate multiple agents to perform comprehensive code reviews
tools: Task, Read, Grep, mcp__claude-flow__code_review, mcp__claude-flow__pr_enhance
model: opus
permissionMode: plan
skills: distributed-review, quality-analysis, feedback-aggregation
---
```

### 5.4 Issue Tracker

```yaml
---
name: issue-tracker
description: Triage, categorize, and manage GitHub issues with automated workflows
tools: Bash, mcp__claude-flow__issue_triage, mcp__claude-flow__github_swarm
model: sonnet
permissionMode: acceptEdits
skills: issue-management, triage, automation
---
```

### 5.5 Release Manager

```yaml
---
name: release-manager
description: Coordinate release processes including versioning, changelogs, and deployment
tools: Bash, Read, Write, mcp__claude-flow__github_swarm
model: sonnet
permissionMode: acceptEdits
skills: release-management, versioning, changelog-generation
---
```

### 5.6 Workflow Automation

```yaml
---
name: workflow-automation
description: Create and maintain GitHub Actions workflows and CI/CD pipelines
tools: Read, Write, Edit, Bash, mcp__claude-flow__github_swarm
model: sonnet
permissionMode: acceptEdits
skills: cicd, github-actions, workflow-design
---
```

### 5.7 Project Board Sync

```yaml
---
name: project-board-sync
description: Synchronize GitHub project boards with task status and team progress
tools: Bash, TodoWrite, mcp__claude-flow__github_swarm
model: sonnet
permissionMode: acceptEdits
skills: project-management, board-automation, status-sync
---
```

### 5.8 Repo Architect

```yaml
---
name: repo-architect
description: Design repository structure, organize code, and establish architectural patterns
tools: Read, Write, Bash, Glob, mcp__claude-flow__repo_analyze
model: opus
permissionMode: acceptEdits
skills: architecture-design, repository-organization, structure-planning
---
```

### 5.9 Multi Repo Swarm

```yaml
---
name: multi-repo-swarm
description: Coordinate operations across multiple repositories in monorepo or multi-repo setups
tools: Task, Bash, Glob, mcp__claude-flow__github_swarm, mcp__claude-flow__agent_spawn
model: opus
permissionMode: plan
skills: multi-repo-management, cross-repo-coordination, monorepo-operations
---
```

---

## 6. SPARC Methodology Agents (6)

### 6.1 SPARC Coordinator

```yaml
---
name: sparc-coord
description: Orchestrate the complete SPARC workflow from specification to completion
tools: Task, TodoWrite, Bash, mcp__claude-flow__task_orchestrate
model: opus
permissionMode: plan
skills: sparc-methodology, workflow-orchestration, phase-coordination
---
```

### 6.2 SPARC Coder

```yaml
---
name: sparc-coder
description: Implement code following SPARC methodology with TDD and clean architecture
tools: Read, Write, Edit, Bash, Grep
model: sonnet
permissionMode: acceptEdits
skills: tdd, clean-architecture, sparc-implementation
---
```

### 6.3 Specification

```yaml
---
name: specification
description: Analyze requirements and create detailed specifications with acceptance criteria
tools: Read, Write, WebSearch, WebFetch, Grep
model: sonnet
permissionMode: acceptEdits
skills: requirements-analysis, specification-writing, acceptance-criteria
---
```

### 6.4 Pseudocode

```yaml
---
name: pseudocode
description: Design algorithms and create pseudocode representations of solutions
tools: Read, Write, Edit, Grep
model: sonnet
permissionMode: acceptEdits
skills: algorithm-design, pseudocode-creation, logic-modeling
---
```

### 6.5 Architecture

```yaml
---
name: architecture
description: Design system architecture, define components, and establish design patterns
tools: Read, Write, Edit, Glob, Grep
model: opus
permissionMode: acceptEdits
skills: system-design, architecture-patterns, component-design
---
```

### 6.6 Refinement

```yaml
---
name: refinement
description: Refine implementations through testing, optimization, and iterative improvement
tools: Read, Edit, Bash, Grep, mcp__claude-flow__benchmark_run
model: sonnet
permissionMode: acceptEdits
skills: code-refinement, optimization, iterative-improvement
---
```

---

## 7. Specialized Development Agents (8)

### 7.1 Backend Developer

```yaml
---
name: backend-dev
description: Develop backend services, APIs, databases, and server-side logic
tools: Read, Write, Edit, Bash, Grep
model: sonnet
permissionMode: acceptEdits
skills: api-development, database-design, server-programming
---
```

### 7.2 Mobile Developer

```yaml
---
name: mobile-dev
description: Build mobile applications for iOS, Android, and cross-platform frameworks
tools: Read, Write, Edit, Bash, Grep
model: sonnet
permissionMode: acceptEdits
skills: mobile-development, react-native, flutter, native-apps
---
```

### 7.3 ML Developer

```yaml
---
name: ml-developer
description: Implement machine learning models, train algorithms, and deploy ML solutions
tools: Read, Write, Edit, Bash, mcp__claude-flow__neural_train
model: opus
permissionMode: acceptEdits
skills: machine-learning, model-training, data-science
---
```

### 7.4 CI/CD Engineer

```yaml
---
name: cicd-engineer
description: Design and maintain continuous integration and deployment pipelines
tools: Read, Write, Edit, Bash
model: sonnet
permissionMode: acceptEdits
skills: cicd, pipeline-design, automation, deployment
---
```

### 7.5 API Documentation

```yaml
---
name: api-docs
description: Create comprehensive API documentation with examples and usage guides
tools: Read, Write, Edit, Grep, WebSearch
model: sonnet
permissionMode: acceptEdits
skills: technical-writing, api-documentation, openapi-spec
---
```

### 7.6 System Architect

```yaml
---
name: system-architect
description: Design large-scale systems, define infrastructure, and establish technical standards
tools: Read, Write, Edit, Glob, Grep, mcp__claude-flow__repo_analyze
model: opus
permissionMode: acceptEdits
skills: system-architecture, infrastructure-design, technical-standards
---
```

### 7.7 Code Analyzer

```yaml
---
name: code-analyzer
description: Perform static analysis, detect code smells, and identify technical debt
tools: Read, Grep, Glob, Bash, mcp__claude-flow__repo_analyze
model: sonnet
permissionMode: default
skills: static-analysis, code-quality, technical-debt-detection
---
```

### 7.8 Base Template Generator

```yaml
---
name: base-template-generator
description: Generate project templates, boilerplate code, and starter configurations
tools: Read, Write, Edit, Bash, Glob
model: sonnet
permissionMode: acceptEdits
skills: template-generation, boilerplate-creation, project-scaffolding
---
```

---

## 8. Testing & Validation Agents (2)

### 8.1 TDD London Swarm

```yaml
---
name: tdd-london-swarm
description: Implement London School TDD with heavy mocking and outside-in development
tools: Task, Read, Write, Edit, Bash, mcp__claude-flow__agent_spawn
model: opus
permissionMode: plan
skills: london-tdd, mocking, outside-in-development, test-doubles
---
```

### 8.2 Production Validator

```yaml
---
name: production-validator
description: Validate production readiness including security, performance, and reliability
tools: Read, Bash, Grep, mcp__claude-flow__benchmark_run
model: opus
permissionMode: default
skills: production-validation, security-audit, performance-verification
---
```

---

## 9. Migration & Planning Agents (2)

### 9.1 Migration Planner

```yaml
---
name: migration-planner
description: Plan and execute code migrations, refactoring, and technology upgrades
tools: Read, Write, TodoWrite, Grep, Glob, Bash
model: opus
permissionMode: plan
skills: migration-planning, refactoring-strategy, upgrade-coordination
---
```

### 9.2 Swarm Init

```yaml
---
name: swarm-init
description: Initialize swarm environments, configure topologies, and bootstrap agent teams
tools: TodoWrite, Bash, mcp__claude-flow__swarm_init, mcp__claude-flow__agent_spawn
model: sonnet
permissionMode: plan
skills: swarm-initialization, topology-setup, team-bootstrap
---
```

---

## Quick Reference Table

| Category                   | Agent Count | Primary Use Cases                                        |
| -------------------------- | ----------- | -------------------------------------------------------- |
| Core Development           | 5           | Code implementation, review, testing, planning, research |
| Swarm Coordination         | 5           | Multi-agent orchestration and collaboration              |
| Consensus & Distributed    | 7           | Fault tolerance, distributed systems, security           |
| Performance & Optimization | 5           | Benchmarking, resource management, ML optimization       |
| GitHub & Repository        | 9           | Source control, PRs, issues, releases, workflows         |
| SPARC Methodology          | 6           | Systematic development from spec to completion           |
| Specialized Development    | 8           | Backend, mobile, ML, CI/CD, documentation                |
| Testing & Validation       | 2           | TDD workflows, production readiness                      |
| Migration & Planning       | 2           | Migrations, refactoring, swarm initialization            |
| **TOTAL**                  | **54**      | Complete agent ecosystem                                 |

---

## Usage Guidelines

### Model Selection

- **opus**: Complex planning, architecture, high-level coordination
- **sonnet**: Implementation, coding, documentation, standard operations
- **haiku**: Simple tasks, quick responses, lightweight operations
- **inherit**: Use parent agent's model setting

### Permission Modes

- **default**: Standard permissions, user approval required
- **acceptEdits**: Auto-accept file edits, suitable for trusted agents
- **bypassPermissions**: Skip all permission checks (use cautiously)
- **plan**: Planning mode, no direct execution
- **ignore**: Ignore permission system entirely

### Tool Selection Best Practices

1. **File Operations**: Read, Write, Edit, Glob, Grep
2. **Coordination**: Task, TodoWrite, mcp**claude-flow**\*
3. **System**: Bash (for terminal commands)
4. **Research**: WebSearch, WebFetch
5. **Testing**: Bash + Read + Write combination

---

## Integration with CLAUDE.md

These templates are designed to work seamlessly with the SPARC Development Environment:

- All agents follow concurrent execution patterns
- Memory and neural tools integrate with Claude Flow
- GitHub tools complement repository operations
- Verification protocols apply to all agent outputs

---

**Version**: 1.0.0 **Last Updated**: 2025-11-21 **Total Agents**: 54
