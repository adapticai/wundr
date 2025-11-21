# @wundr.io Package Architecture - Complete Overview

> Comprehensive architecture documentation for the Wundr package ecosystem

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Principles](#architecture-principles)
3. [Package Ecosystem Map](#package-ecosystem-map)
4. [Key Architecture Decisions](#key-architecture-decisions)
5. [Technology Stack](#technology-stack)
6. [Integration Strategies](#integration-strategies)
7. [Performance Characteristics](#performance-characteristics)
8. [Security Considerations](#security-considerations)
9. [Scalability & Growth](#scalability--growth)
10. [Documentation Index](#documentation-index)

---

## Executive Summary

The @wundr.io package ecosystem consists of **15 core packages** organized into a **hierarchical
architecture** with three distinct tiers:

- **Foundational Tier (3 packages):** Core utilities, configuration, shared configs
- **Specialized Tier (8 packages):** Analysis engines, AI integration, security, plugins
- **Application Tier (4 packages):** CLI tools, computer setup, web clients

**Key Metrics:**

- Total Packages: 15
- Total Lines of Code: ~50,000+
- Dependencies: Strictly hierarchical (zero circular dependencies)
- Coverage: Full TypeScript, ESLint, Prettier
- Node Requirement: >=18.0.0

---

## Architecture Principles

### 1. Separation of Concerns

Each package has a **single, well-defined responsibility:**

```
@wundr.io/core         → Logging, events, validation
@wundr.io/config       → Configuration management
@wundr.io/analysis-engine → Code analysis
@wundr.io/cli          → User interface
```

**Benefits:**

- Maintainability
- Testability
- Reusability
- Clear boundaries

---

### 2. Dependency Hierarchy

**Strict hierarchical dependencies** with no circular references:

```
Level 0 (Foundation)
  ↓
Level 1 (Specialized)
  ↓
Level 2 (Application)
  ↓
Level 3 (Platform)
```

**Benefits:**

- Predictable build order
- Easy to understand
- Prevents coupling
- Enables tree-shaking

---

### 3. Progressive Enhancement

Packages offer **progressive feature sets:**

```
@wundr.io/core-simple     → Basic features, minimal deps
@wundr.io/core            → Full features, rich functionality
```

**Benefits:**

- Choose right tool for job
- Optimize bundle size
- Flexibility
- Performance

---

### 4. Convention over Configuration

**Sensible defaults** with configuration options:

```typescript
// Works out of the box
const logger = new Logger('App');

// Customizable when needed
const logger = new Logger('App', {
  level: 'debug',
  format: 'json',
  transports: [consoleTransport, fileTransport],
});
```

**Benefits:**

- Quick to start
- Easy to use
- Flexible when needed
- Best practices built-in

---

### 5. Fail-Fast Validation

**Early validation** with clear error messages:

```typescript
// Schema validation at runtime
const config = await ConfigManager.load();
// Throws descriptive error if invalid

// Type safety at compile time
const user: User = validateUser(data);
// TypeScript catches type errors
```

**Benefits:**

- Catch errors early
- Clear error messages
- Type safety
- Reliability

---

## Package Ecosystem Map

### Visual Representation

```
                    @wundr.io Package Ecosystem

┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACES                      │
│   @wundr.io/cli (Full CLI)                             │
│   @wundr.io/cli-simple (Lightweight CLI)               │
│   @wundr.io/web-client-simple (React Components)       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  APPLICATION SERVICES                   │
│   @wundr.io/computer-setup (Developer provisioning)    │
│   @wundr.io/project-templates (Project scaffolding)    │
│   @wundr.io/plugin-system (Extensibility)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  SPECIALIZED ENGINES                    │
│   @wundr.io/analysis-engine (Full analysis)            │
│   @wundr.io/analysis-engine-simple (Light analysis)    │
│   @wundr.io/ai-integration (Claude Code/Flow/MCP)      │
│   @wundr.io/security (Enterprise security)             │
│   @wundr.io/setup-toolkit-simple (Setup utilities)     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   CORE INFRASTRUCTURE                   │
│   @wundr.io/core (Full utilities)                      │
│   @wundr.io/core-simple (Minimal utilities)            │
│   @wundr.io/config (Configuration)                     │
│   @wundr.io/shared-config (Dev configs)                │
└─────────────────────────────────────────────────────────┘
```

---

### Package Clustering

#### Cluster 1: Core Infrastructure (4 packages)

```
@wundr.io/core
@wundr.io/core-simple
@wundr.io/config
@wundr.io/shared-config
```

**Purpose:** Foundation for all other packages **Dependencies:** External only **Size:** ~200KB
total

---

#### Cluster 2: Analysis & Quality (2 packages)

```
@wundr.io/analysis-engine
@wundr.io/analysis-engine-simple
```

**Purpose:** Code analysis, metrics, quality **Dependencies:** Core + ts-morph **Size:** ~1.1MB
total

---

#### Cluster 3: Developer Tools (3 packages)

```
@wundr.io/computer-setup
@wundr.io/setup-toolkit-simple
@wundr.io/project-templates
```

**Purpose:** Developer onboarding, project creation **Dependencies:** Core + Config **Size:** ~300KB
total

---

#### Cluster 4: Extensibility (1 package)

```
@wundr.io/plugin-system
```

**Purpose:** Plugin architecture **Dependencies:** Core **Size:** ~35KB

---

#### Cluster 5: Advanced Features (2 packages)

```
@wundr.io/ai-integration
@wundr.io/security
```

**Purpose:** AI orchestration, security **Dependencies:** External (heavy) **Size:** ~3.5MB total

---

#### Cluster 6: User Interfaces (3 packages)

```
@wundr.io/cli
@wundr.io/cli-simple
@wundr.io/web-client-simple
```

**Purpose:** User interaction **Dependencies:** All clusters **Size:** ~2MB total

---

## Key Architecture Decisions

### Decision 1: Monorepo Structure

**Decision:** Use pnpm workspaces monorepo

**Rationale:**

- Shared dependencies
- Atomic commits
- Consistent tooling
- Cross-package refactoring

**Trade-offs:**

- Initial complexity
- Build coordination
- Version management

**Outcome:** ✅ Successful - enables rapid development

---

### Decision 2: TypeScript First

**Decision:** Write everything in TypeScript

**Rationale:**

- Type safety
- Better IDE support
- Self-documenting code
- Catch errors early

**Trade-offs:**

- Build step required
- Learning curve
- Longer compile times

**Outcome:** ✅ Successful - improved quality

---

### Decision 3: Dual Package Strategy

**Decision:** Offer both "full" and "simple" versions

**Rationale:**

- Flexibility for users
- Optimize bundle sizes
- Progressive enhancement
- Different use cases

**Trade-offs:**

- More packages to maintain
- Documentation complexity
- User confusion

**Outcome:** ✅ Successful - users choose right tool

---

### Decision 4: OCLIF for Full CLI

**Decision:** Use OCLIF framework for @wundr.io/cli

**Rationale:**

- Plugin system built-in
- Rich feature set
- Industry standard
- Great developer experience

**Trade-offs:**

- Heavy dependencies
- Opinionated structure
- Learning curve

**Outcome:** ✅ Successful - professional CLI

---

### Decision 5: Zero Circular Dependencies

**Decision:** Enforce strict hierarchical dependencies

**Rationale:**

- Predictable behavior
- Easy to reason about
- Better tree-shaking
- Avoid deadlocks

**Trade-offs:**

- Requires careful planning
- May require code duplication
- Refactoring challenges

**Outcome:** ✅ Successful - clean architecture

---

## Technology Stack

### Core Technologies

```
Language:       TypeScript 5.2+
Runtime:        Node.js 18+
Package Manager: pnpm 8+
Build Tool:     TypeScript Compiler (tsc)
Test Runner:    Jest 29+
Linter:         ESLint 8+
Formatter:      Prettier 3+
```

---

### Key Dependencies by Package

#### @wundr.io/core

```
winston         → Logging
zod             → Validation
eventemitter3   → Events
chalk           → Terminal colors
uuid            → ID generation
```

#### @wundr.io/config

```
dotenv          → Environment variables
yaml            → YAML parsing
fs-extra        → File operations
```

#### @wundr.io/analysis-engine

```
ts-morph        → AST manipulation
madge           → Dependency analysis
glob            → File matching
```

#### @wundr.io/cli

```
@oclif/core     → CLI framework
inquirer        → Interactive prompts
blessed         → Terminal UI
listr2          → Task lists
```

#### @wundr.io/ai-integration

```
@anthropic-ai/sdk → Claude API
ws              → WebSocket
sqlite3         → Storage
ioredis         → Caching
```

---

### Development Tools

```
TypeScript      → Type checking
ESLint          → Code linting
Prettier        → Code formatting
Jest            → Testing
Turbo           → Build orchestration
Husky           → Git hooks
lint-staged     → Pre-commit checks
```

---

## Integration Strategies

### Strategy 1: Import-Based Integration

**Pattern:**

```typescript
import { Logger } from '@wundr.io/core';
import { ConfigManager } from '@wundr.io/config';
```

**Use when:** Building applications **Benefits:** Type safety, tree-shaking **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md

---

### Strategy 2: CLI-Based Integration

**Pattern:**

```bash
wundr analyze --path ./src
wundr setup --profile backend-dev
```

**Use when:** End-user tools **Benefits:** User-friendly, no coding **Documentation:** CLI
documentation

---

### Strategy 3: Plugin-Based Integration

**Pattern:**

```typescript
class MyPlugin implements Plugin {
  name = 'my-plugin';
  async execute(context) {
    /* ... */
  }
}
```

**Use when:** Extending functionality **Benefits:** Modular, reusable **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Scenario 5

---

### Strategy 4: API-Based Integration

**Pattern:**

```typescript
const analyzer = new CodeAnalyzer(options);
const results = await analyzer.analyze();
```

**Use when:** Programmatic access **Benefits:** Flexible, powerful **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Use Case 5

---

## Performance Characteristics

### Bundle Sizes

```
Lightweight (<100KB):
  @wundr.io/core-simple          45KB
  @wundr.io/shared-config         10KB
  @wundr.io/plugin-system         35KB

Medium (100KB-500KB):
  @wundr.io/core                 180KB
  @wundr.io/config                95KB
  @wundr.io/analysis-engine-simple 250KB

Heavy (>500KB):
  @wundr.io/analysis-engine      850KB
  @wundr.io/cli                  1.2MB
  @wundr.io/ai-integration       2.5MB
```

---

### Runtime Performance

```
Logger (Winston):
  ~10,000 logs/second
  Minimal overhead

Config Loading:
  File: <10ms
  Validation: <5ms
  Total: <15ms

Code Analysis:
  Small project (100 files): ~2 seconds
  Medium project (1000 files): ~15 seconds
  Large project (5000 files): ~60 seconds

Setup Orchestration:
  Tool installation: 30-120 seconds
  Configuration: <5 seconds
  Verification: <10 seconds
```

---

### Memory Usage

```
Minimal Setup:
  @wundr.io/core-simple: ~10MB

Standard Setup:
  @wundr.io/core + config: ~30MB

Full CLI:
  @wundr.io/cli: ~80MB

Analysis Engine:
  Small project: ~50MB
  Large project: ~200MB
```

---

## Security Considerations

### 1. Dependency Security

```
Regular audits:
  npm audit
  Snyk scanning
  Dependabot updates

Minimal dependencies:
  Simple packages: <10 deps
  Full packages: <30 deps
```

---

### 2. Data Protection

```
@wundr.io/security provides:
  ✅ Encryption at rest
  ✅ Encryption in transit
  ✅ Secure credential storage (keytar)
  ✅ JWT authentication
  ✅ RBAC authorization
```

---

### 3. Input Validation

```
All inputs validated:
  Schema validation (Zod)
  Type checking (TypeScript)
  Runtime checks
  Sanitization
```

---

### 4. Secure Defaults

```
Logging:
  ❌ Never log passwords
  ❌ Never log API keys
  ✅ Sanitize sensitive data
  ✅ Configurable redaction

Configuration:
  ✅ Use environment variables
  ✅ Support .env files
  ❌ Never commit secrets
  ✅ Validation of all inputs
```

---

## Scalability & Growth

### Current State

```
Packages: 15
Total LOC: ~50,000
Active development: 10+ contributors
Release cadence: Bi-weekly
```

---

### Growth Strategy

#### Phase 1: Stabilization (Current)

- Fix critical bugs
- Improve documentation
- Add missing tests
- Optimize performance

#### Phase 2: Feature Expansion (Q1 2026)

- New analysis capabilities
- Enhanced AI integration
- Advanced plugin system
- Web dashboard

#### Phase 3: Ecosystem Growth (Q2 2026)

- Third-party plugins
- Community templates
- Marketplace
- Enterprise features

---

### Versioning Strategy

```
Major (X.0.0):
  Breaking changes
  Architecture changes
  API redesign

Minor (0.X.0):
  New features
  Deprecations
  Non-breaking changes

Patch (0.0.X):
  Bug fixes
  Documentation
  Performance improvements
```

---

## Documentation Index

### Primary Documentation (This Repository)

1. **PACKAGE_ARCHITECTURE_OVERVIEW.md** (This file)
   - Architecture principles
   - Technology decisions
   - Performance characteristics

2. **PACKAGE_CROSS_REFERENCE.md**
   - Complete package mapping
   - Dependency graphs
   - Integration patterns
   - Common workflows

3. **PACKAGE_DEPENDENCY_GRAPH.md**
   - Visual dependency graphs
   - Dependency analysis
   - Build order
   - Size comparisons

4. **PACKAGE_INTEGRATION_GUIDE.md**
   - Integration scenarios
   - Code examples
   - Troubleshooting
   - Best practices

5. **PACKAGE_CROSS_REFERENCE_SUMMARY.md**
   - Quick overview
   - Navigation guide
   - Quick starts

---

### Additional Resources

- **README.md** - Project overview
- **CONTRIBUTING.md** - Contribution guidelines
- **API.md** - API reference
- **CHANGELOG.md** - Version history
- **LICENSE** - MIT License

---

### Package-Specific Documentation

Each package includes:

- **README.md** - Package overview, usage
- **API.md** - Detailed API documentation
- **CHANGELOG.md** - Version history
- **Examples** - Code examples

---

## Quick Reference Card

### For New Users

```
1. Read: PACKAGE_CROSS_REFERENCE_SUMMARY.md
2. Choose: Package Selection Guide
3. Install: npm install @wundr.io/[package]
4. Follow: PACKAGE_INTEGRATION_GUIDE.md → Scenario
```

---

### For Package Developers

```
1. Read: PACKAGE_ARCHITECTURE_OVERVIEW.md (this file)
2. Understand: Dependency hierarchy
3. Follow: Architecture principles
4. Test: Integration patterns
```

---

### For System Architects

```
1. Study: PACKAGE_DEPENDENCY_GRAPH.md
2. Review: Architecture diagrams
3. Analyze: Performance characteristics
4. Plan: Integration strategies
```

---

### For Contributors

```
1. Read: CONTRIBUTING.md
2. Review: Package structure
3. Follow: Best practices
4. Submit: Pull requests
```

---

## Glossary

**AST:** Abstract Syntax Tree - code representation for analysis

**CLI:** Command Line Interface - terminal-based user interface

**MCP:** Model Context Protocol - AI tool integration protocol

**OCLIF:** Open CLI Framework - CLI building framework

**SPARC:** Specification, Pseudocode, Architecture, Refinement, Completion

**TDD:** Test-Driven Development - write tests before code

**TUI:** Terminal User Interface - interactive terminal UI

**Monorepo:** Single repository containing multiple packages

**Workspace:** pnpm workspace - manages multiple packages

**Tree-shaking:** Removing unused code from bundles

**Progressive Enhancement:** Start simple, add features as needed

---

## Conclusion

The @wundr.io package ecosystem is a **well-architected, modular platform** designed for:

✅ **Flexibility** - Choose the right packages for your needs ✅ **Performance** - Optimized bundle
sizes and runtime ✅ **Reliability** - Type-safe, well-tested, validated ✅ **Scalability** -
Hierarchical architecture supports growth ✅ **Developer Experience** - Clear documentation, helpful
tools

**Architecture highlights:**

- 15 packages in 3 tiers
- Zero circular dependencies
- Dual package strategy (full/simple)
- Progressive enhancement
- Type-safe throughout

**Next steps:**

- Explore PACKAGE_CROSS_REFERENCE.md for detailed mapping
- Try PACKAGE_INTEGRATION_GUIDE.md for code examples
- Review PACKAGE_DEPENDENCY_GRAPH.md for visual dependencies

---

**Last Updated:** 2025-11-21 **Version:** 1.0.0 **Maintained By:** Wundr Team **Questions?**
https://github.com/adapticai/wundr/issues
