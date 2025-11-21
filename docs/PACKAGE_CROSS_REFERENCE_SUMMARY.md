# @wundr.io Package Cross-Reference - Executive Summary

> Quick overview and navigation guide for the Wundr package ecosystem

---

## 📚 Documentation Overview

This cross-reference documentation consists of three comprehensive guides:

1. **[PACKAGE_CROSS_REFERENCE.md](./PACKAGE_CROSS_REFERENCE.md)** - Complete mapping guide
2. **[PACKAGE_DEPENDENCY_GRAPH.md](./PACKAGE_DEPENDENCY_GRAPH.md)** - Visual dependency analysis
3. **[PACKAGE_INTEGRATION_GUIDE.md](./PACKAGE_INTEGRATION_GUIDE.md)** - Integration examples and
   patterns

---

## 🎯 Quick Navigation

### I want to understand...

| Topic                               | Document                     | Section                      |
| ----------------------------------- | ---------------------------- | ---------------------------- |
| **All packages and their purpose**  | PACKAGE_CROSS_REFERENCE.md   | Package Overview             |
| **Which packages depend on which**  | PACKAGE_DEPENDENCY_GRAPH.md  | Complete Dependency Graph    |
| **How to choose the right package** | PACKAGE_CROSS_REFERENCE.md   | Package Selection Guide      |
| **Common usage workflows**          | PACKAGE_CROSS_REFERENCE.md   | Common Workflows             |
| **Integration code examples**       | PACKAGE_INTEGRATION_GUIDE.md | Common Integration Scenarios |
| **Package relationships**           | PACKAGE_CROSS_REFERENCE.md   | Package Relationship Matrix  |
| **Build order and dependencies**    | PACKAGE_DEPENDENCY_GRAPH.md  | Build Order                  |
| **Bundle sizes and weight**         | PACKAGE_DEPENDENCY_GRAPH.md  | Package Size Comparison      |

---

## 📦 Package Categories at a Glance

### Core Packages (Foundational)

Essential building blocks with no internal dependencies.

- **@wundr.io/core** - Logging, events, validation
- **@wundr.io/core-simple** - Lightweight utilities
- **@wundr.io/shared-config** - ESLint/Prettier configs

### Engine Packages (Specialized)

Advanced features built on core packages.

- **@wundr.io/analysis-engine** - Full-featured code analysis
- **@wundr.io/analysis-engine-simple** - Lightweight analysis
- **@wundr.io/ai-integration** - Claude Code/Flow orchestration
- **@wundr.io/security** - Enterprise security features

### Tool Packages (Application)

User-facing tools and interfaces.

- **@wundr.io/cli** - Full-featured CLI (OCLIF)
- **@wundr.io/cli-simple** - Lightweight CLI
- **@wundr.io/computer-setup** - Developer provisioning
- **@wundr.io/plugin-system** - Plugin architecture
- **@wundr.io/project-templates** - Project scaffolding

### UI Packages

Web interface components.

- **@wundr.io/web-client-simple** - React components

### Configuration Packages

Configuration and setup.

- **@wundr.io/config** - Configuration management
- **@wundr.io/setup-toolkit-simple** - Setup utilities

---

## 🚀 Quick Start by Use Case

### Use Case 1: Building a CLI Tool

```bash
npm install @wundr.io/core @wundr.io/config commander
```

**What you get:** Logging, configuration, CLI framework **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Scenario 2

---

### Use Case 2: Code Analysis

```bash
npm install @wundr.io/analysis-engine
```

**What you get:** AST parsing, complexity metrics, duplicate detection **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Scenario 3

---

### Use Case 3: Developer Onboarding

```bash
npm install @wundr.io/computer-setup @wundr.io/core @wundr.io/config
```

**What you get:** Automated machine setup, tool installation **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Scenario 4

---

### Use Case 4: Lightweight Scripts

```bash
npm install @wundr.io/core-simple @wundr.io/cli-simple
```

**What you get:** Minimal dependencies, basic utilities **Documentation:**
PACKAGE_INTEGRATION_GUIDE.md → Scenario 6

---

### Use Case 5: Full Platform

```bash
npm install -g @wundr.io/cli
```

**What you get:** Everything (CLI, setup, plugins, templates) **Documentation:**
PACKAGE_CROSS_REFERENCE.md → Workflow 1-6

---

## 🔗 Dependency Quick Reference

### Zero Dependencies (Start Here)

```
@wundr.io/core
@wundr.io/core-simple
@wundr.io/shared-config
```

### Single Dependency

```
@wundr.io/config → core
@wundr.io/plugin-system → core
@wundr.io/project-templates → core
@wundr.io/analysis-engine-simple → core-simple
@wundr.io/setup-toolkit-simple → core-simple
@wundr.io/web-client-simple → core-simple
```

### Multiple Dependencies

```
@wundr.io/computer-setup → core + config
@wundr.io/cli-simple → core-simple + analysis-engine-simple + setup-toolkit-simple
@wundr.io/cli → core + config + computer-setup
```

**Full details:** PACKAGE_DEPENDENCY_GRAPH.md → Dependency Depth Analysis

---

## 📊 Key Architecture Diagrams

### 1. Package Tiers

```
APPLICATION TIER    → @wundr.io/cli, @wundr.io/cli-simple
        ↓
SPECIALIZED TIER    → @wundr.io/analysis-engine, @wundr.io/ai-integration
        ↓
FOUNDATIONAL TIER   → @wundr.io/core, @wundr.io/config
```

**See:** PACKAGE_CROSS_REFERENCE.md → Package Architecture Tiers

---

### 2. Data Flow

```
User Input → CLI → Config → Core Services → Analysis/Setup/Templates → Output
```

**See:** PACKAGE_DEPENDENCY_GRAPH.md → Data Flow Architecture

---

### 3. Module Interactions

```
CLI Commands → Services (Logger, EventBus, Config) → Engines (Analysis, AI, Security)
```

**See:** PACKAGE_DEPENDENCY_GRAPH.md → Module Interaction Architecture

---

## 🎓 Common Integration Patterns

### Pattern 1: Logging

```typescript
import { Logger } from '@wundr.io/core';
const logger = new Logger('MyApp');
logger.info('Message', { meta: 'data' });
```

**See:** PACKAGE_INTEGRATION_GUIDE.md → Use Case 1

---

### Pattern 2: Configuration

```typescript
import { ConfigManager } from '@wundr.io/config';
const config = await new ConfigManager().load();
```

**See:** PACKAGE_INTEGRATION_GUIDE.md → Use Case 2

---

### Pattern 3: Events

```typescript
import { EventBus } from '@wundr.io/core';
const events = EventBus.getInstance();
events.on('event', handler);
```

**See:** PACKAGE_INTEGRATION_GUIDE.md → Use Case 3

---

### Pattern 4: Analysis

```typescript
import { CodeAnalyzer } from '@wundr.io/analysis-engine';
const analyzer = new CodeAnalyzer({ projectPath: './src' });
const results = await analyzer.analyze();
```

**See:** PACKAGE_INTEGRATION_GUIDE.md → Use Case 5

---

## 🔍 Package Selection Decision Tree

```
Do you need full platform features?
├─ YES → Install @wundr.io/cli
└─ NO → Continue

Do you need lightweight/minimal dependencies?
├─ YES → Use "simple" packages (@wundr.io/core-simple, etc.)
└─ NO → Use full packages (@wundr.io/core, etc.)

What's your primary use case?
├─ CLI tool → @wundr.io/core + @wundr.io/config
├─ Code analysis → @wundr.io/analysis-engine
├─ Developer setup → @wundr.io/computer-setup
├─ React app → @wundr.io/web-client-simple
├─ AI integration → @wundr.io/ai-integration
└─ Security → @wundr.io/security
```

**See:** PACKAGE_CROSS_REFERENCE.md → Package Selection Guide

---

## 📈 Common Workflows

### Workflow 1: Full Code Analysis

```
CLI → Config → Core → Analysis Engine → Report
```

**Packages:** cli, config, core, analysis-engine **See:** PACKAGE_CROSS_REFERENCE.md → Workflow 1

---

### Workflow 2: Developer Setup

```
CLI → Config → Core → Computer Setup → Verification
```

**Packages:** cli, config, core, computer-setup **See:** PACKAGE_CROSS_REFERENCE.md → Workflow 2

---

### Workflow 3: Project Creation

```
CLI → Core → Project Templates → Package Init
```

**Packages:** cli, core, project-templates **See:** PACKAGE_CROSS_REFERENCE.md → Workflow 3

---

### Workflow 4: AI Refactoring

```
CLI → Analysis Engine → AI Integration → Code Transform
```

**Packages:** cli, analysis-engine, ai-integration, core **See:** PACKAGE_CROSS_REFERENCE.md →
Workflow 4

---

### Workflow 5: Security Audit

```
CLI → Security → Analysis Engine → Report
```

**Packages:** cli, security, analysis-engine, core **See:** PACKAGE_CROSS_REFERENCE.md → Workflow 5

---

## 🛠️ Troubleshooting Quick Reference

| Issue              | Solution                          | Document                     |
| ------------------ | --------------------------------- | ---------------------------- |
| Module not found   | `npm install @wundr.io/[package]` | PACKAGE_INTEGRATION_GUIDE.md |
| Type errors        | Check TypeScript config           | PACKAGE_INTEGRATION_GUIDE.md |
| Logger not working | Set log level                     | PACKAGE_INTEGRATION_GUIDE.md |
| Config not loading | Use explicit path                 | PACKAGE_INTEGRATION_GUIDE.md |

**Full troubleshooting:** PACKAGE_INTEGRATION_GUIDE.md → Troubleshooting

---

## 📖 Best Practices

1. **Start with foundational packages** - Build up from @wundr.io/core
2. **Choose "simple" for lightweight** - Use when minimal dependencies needed
3. **Use full packages for production** - Complete features and integrations
4. **Follow dependency hierarchy** - Update from bottom to top
5. **Check compatibility matrix** - Ensure version compatibility

**Detailed practices:** PACKAGE_INTEGRATION_GUIDE.md → Best Practices

---

## 🎯 Next Steps

1. **First-time users:**
   - Read PACKAGE_CROSS_REFERENCE.md → Package Overview
   - Review PACKAGE_INTEGRATION_GUIDE.md → Scenario 1

2. **Building something specific:**
   - Check PACKAGE_CROSS_REFERENCE.md → Package Selection Guide
   - Follow PACKAGE_INTEGRATION_GUIDE.md → Relevant Scenario

3. **Understanding architecture:**
   - Study PACKAGE_DEPENDENCY_GRAPH.md → Complete Dependency Graph
   - Review PACKAGE_CROSS_REFERENCE.md → Architecture Diagrams

4. **Integrating into existing project:**
   - Read PACKAGE_INTEGRATION_GUIDE.md → Common Integration Scenarios
   - Follow PACKAGE_INTEGRATION_GUIDE.md → Integration Patterns

---

## 📚 Full Documentation Index

### PACKAGE_CROSS_REFERENCE.md

- Package Overview
- Package Architecture Tiers
- Dependency Graph (Mermaid)
- Package Relationship Matrix
- Integration Patterns (7 patterns)
- Common Workflows (6 workflows)
- Package Selection Guide
- Architecture Diagrams
- Quick Reference
- Version Compatibility Matrix
- Migration Guides

### PACKAGE_DEPENDENCY_GRAPH.md

- Complete Dependency Graph (ASCII)
- Simplified Dependency Tree
- Dependency Depth Analysis
- Package Relationship Clusters (5 clusters)
- Dependency Weight Analysis
- Circular Dependency Check
- Peer Dependency Requirements
- Transitive Dependency Graph
- Build Order (Topological Sort)
- Package Size Comparison
- Recommended Installation Patterns
- Dependency Update Strategy

### PACKAGE_INTEGRATION_GUIDE.md

- Getting Started
- Common Integration Scenarios (7 scenarios)
- Code Examples by Use Case (6 use cases)
- Integration Patterns (3 patterns)
- Troubleshooting (4 issues)
- Best Practices (4 practices)

---

## 🔗 Related Resources

- **Main Documentation:** [/docs/README.md](./README.md)
- **API Reference:** [/docs/API.md](./API.md)
- **Contributing:** [/CONTRIBUTING.md](../CONTRIBUTING.md)
- **Examples:** [/examples](../examples)
- **GitHub:** https://github.com/adapticai/wundr

---

## 📞 Support

**Questions?** Open an issue at https://github.com/adapticai/wundr/issues

**Last Updated:** 2025-11-21 **Maintained By:** Wundr Team
