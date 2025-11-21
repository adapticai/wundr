# @wundr.io Package Dependency Graph

> Visual representation of package dependencies and relationships

---

## Complete Dependency Graph (ASCII)

```
                    ┌─────────────────────────────────────┐
                    │    @wundr.io/shared-config          │
                    │    (ESLint/Prettier configs)        │
                    └─────────────────────────────────────┘
                                   │ (devDependency for all)
                                   │
        ┌──────────────────────────┴─────────────────────────────┐
        │                                                          │
        ▼                                                          ▼
┌─────────────────┐                                    ┌─────────────────┐
│ @wundr.io/core  │                                    │@wundr.io/core-  │
│                 │                                    │     simple      │
│ - Logger        │                                    │                 │
│ - EventBus      │                                    │ - Basic Logger  │
│ - Validators    │                                    │ - EventEmitter  │
│ - Winston       │                                    │ - Zod           │
└────────┬────────┘                                    └────────┬────────┘
         │                                                      │
         │                                                      │
    ┌────┴────────────────────────┬─────────────┬─────────────┼──────────┐
    │                             │             │             │          │
    ▼                             ▼             ▼             ▼          ▼
┌────────────┐            ┌──────────────┐ ┌─────────┐  ┌────────────┐ ┌───────────┐
│@wundr.io/  │            │ @wundr.io/   │ │@wundr.io│  │@wundr.io/  │ │@wundr.io/ │
│  config    │            │plugin-system │ │project- │  │analysis-   │ │web-client-│
│            │            │              │ │templates│  │engine-     │ │  simple   │
│ Config Mgr │            │ PluginMgr    │ │         │  │  simple    │ │           │
│ Schema     │            │ Lifecycle    │ │Template │  │            │ │React UI   │
│ Validation │            │              │ │ Gen     │  │AST Parser  │ │Components │
└─────┬──────┘            └──────────────┘ └─────────┘  └─────┬──────┘ └───────────┘
      │                                                         │
      │                 ┌───────────────────────────────────────┘
      │                 │
      ▼                 ▼
┌──────────────────────────────┐            ┌───────────────────────────┐
│  @wundr.io/computer-setup    │            │@wundr.io/setup-toolkit-   │
│                              │            │        simple             │
│  - SetupOrchestrator         │            │                           │
│  - Hardware Detection        │            │  - Setup Tasks            │
│  - Tool Installation         │            │  - Validation             │
│  - Claude Code Setup         │            │                           │
└──────────────┬───────────────┘            └────────────┬──────────────┘
               │                                         │
               │                                         │
               ▼                                         ▼
       ┌──────────────────┐                    ┌──────────────────┐
       │  @wundr.io/cli   │                    │ @wundr.io/cli-   │
       │                  │                    │     simple       │
       │  - Commands      │                    │                  │
       │  - TUI           │                    │  - Basic CLI     │
       │  - Orchestration │                    │  - Commander     │
       └──────────────────┘                    └──────────────────┘


STANDALONE PACKAGES (No internal dependencies):

┌─────────────────────────────┐    ┌─────────────────────────────┐
│ @wundr.io/analysis-engine   │    │ @wundr.io/security          │
│                             │    │                             │
│ - AST Parsing (ts-morph)    │    │ - Encryption                │
│ - Complexity Metrics        │    │ - RBAC                      │
│ - Duplicate Detection       │    │ - Vulnerability Scanning    │
│ - Circular Dependencies     │    │ - JWT/Auth                  │
└─────────────────────────────┘    └─────────────────────────────┘

┌─────────────────────────────┐
│ @wundr.io/ai-integration    │
│                             │
│ - Claude Code Integration   │
│ - Claude Flow Orchestration │
│ - MCP Tools                 │
│ - Neural Networks           │
│ - Agent Coordination        │
└─────────────────────────────┘
```

---

## Simplified Dependency Tree

```
📦 @wundr.io packages
│
├── 🏗️  FOUNDATIONAL (No dependencies)
│   ├── @wundr.io/core
│   ├── @wundr.io/core-simple
│   └── @wundr.io/shared-config
│
├── 🔧 SPECIALIZED (Level 1 - Depends on foundational)
│   ├── @wundr.io/config
│   │   └── → @wundr.io/core
│   ├── @wundr.io/plugin-system
│   │   └── → @wundr.io/core
│   ├── @wundr.io/project-templates
│   │   └── → @wundr.io/core
│   ├── @wundr.io/analysis-engine-simple
│   │   └── → @wundr.io/core-simple
│   ├── @wundr.io/setup-toolkit-simple
│   │   └── → @wundr.io/core-simple
│   └── @wundr.io/web-client-simple
│       └── → @wundr.io/core-simple
│
├── ⚙️  APPLICATION (Level 2 - Depends on specialized)
│   ├── @wundr.io/computer-setup
│   │   ├── → @wundr.io/core
│   │   └── → @wundr.io/config
│   └── @wundr.io/cli-simple
│       ├── → @wundr.io/core-simple
│       ├── → @wundr.io/analysis-engine-simple
│       └── → @wundr.io/setup-toolkit-simple
│
├── 🚀 PLATFORM (Level 3 - Top level)
│   └── @wundr.io/cli
│       ├── → @wundr.io/core
│       ├── → @wundr.io/config
│       └── → @wundr.io/computer-setup
│
└── 🔌 STANDALONE (No internal dependencies)
    ├── @wundr.io/analysis-engine
    ├── @wundr.io/ai-integration
    └── @wundr.io/security
```

---

## Dependency Depth Analysis

### Level 0: No Dependencies (Foundational)

```
@wundr.io/core ──────────────┐
@wundr.io/core-simple ────────┼─── No internal dependencies
@wundr.io/shared-config ──────┘
```

**Use these when:**

- Building new foundational features
- Creating minimal tools
- Need maximum flexibility

---

### Level 1: Single Dependency

```
@wundr.io/config ─────────────────────> @wundr.io/core
@wundr.io/plugin-system ──────────────> @wundr.io/core
@wundr.io/project-templates ──────────> @wundr.io/core
@wundr.io/analysis-engine-simple ─────> @wundr.io/core-simple
@wundr.io/setup-toolkit-simple ───────> @wundr.io/core-simple
@wundr.io/web-client-simple ──────────> @wundr.io/core-simple
```

**Use these when:**

- Need basic Wundr features
- Building modular tools
- Want to avoid deep dependency chains

---

### Level 2: Multiple Dependencies

```
@wundr.io/computer-setup ─┬─> @wundr.io/core
                          └─> @wundr.io/config

@wundr.io/cli-simple ─────┬─> @wundr.io/core-simple
                          ├─> @wundr.io/analysis-engine-simple
                          └─> @wundr.io/setup-toolkit-simple
```

**Use these when:**

- Building complete features
- Need orchestration capabilities
- Want pre-integrated tools

---

### Level 3: Full Platform

```
@wundr.io/cli ─┬─> @wundr.io/core
               ├─> @wundr.io/config
               └─> @wundr.io/computer-setup
                   ├─> @wundr.io/core
                   └─> @wundr.io/config
```

**Use this when:**

- Building full applications
- Need all platform features
- Want complete integration

---

## Package Relationship Clusters

### Cluster 1: Core Utilities

```
┌────────────────────────────────────────┐
│         CORE UTILITIES CLUSTER         │
├────────────────────────────────────────┤
│                                        │
│  @wundr.io/core ──────────────────┐   │
│    │                               │   │
│    ├─> Logger (Winston)            │   │
│    ├─> EventBus (EventEmitter3)    │   │
│    ├─> Validators (Zod)            │   │
│    └─> Utilities                   │   │
│                                    │   │
│  @wundr.io/core-simple ────────────┤   │
│    │                               │   │
│    ├─> Simple Logger               │   │
│    ├─> EventEmitter                │   │
│    └─> Basic Validators            │   │
│                                        │
└────────────────────────────────────────┘
```

---

### Cluster 2: Configuration Management

```
┌────────────────────────────────────────┐
│    CONFIGURATION MANAGEMENT CLUSTER    │
├────────────────────────────────────────┤
│                                        │
│  @wundr.io/config ─────────────────┐  │
│    │                                │  │
│    ├─> ConfigManager                │  │
│    ├─> Schema Validation            │  │
│    ├─> Environment Loading          │  │
│    └─> Multi-source Merging         │  │
│        (file, env, CLI)              │  │
│                                     │  │
│  Uses: @wundr.io/core               │  │
│                                        │
└────────────────────────────────────────┘
```

---

### Cluster 3: Analysis Tools

```
┌────────────────────────────────────────┐
│       CODE ANALYSIS CLUSTER            │
├────────────────────────────────────────┤
│                                        │
│  @wundr.io/analysis-engine ────────┐  │
│    │                                │  │
│    ├─> AST Parser (ts-morph)        │  │
│    ├─> Complexity Metrics           │  │
│    ├─> Duplicate Detection          │  │
│    ├─> Circular Dependencies        │  │
│    └─> Code Smells                  │  │
│                                     │  │
│  @wundr.io/analysis-engine-simple ─┤  │
│    │                                │  │
│    ├─> Basic AST Parsing            │  │
│    ├─> Simple Metrics               │  │
│    └─> Lightweight Analysis         │  │
│                                        │
└────────────────────────────────────────┘
```

---

### Cluster 4: Developer Setup

```
┌────────────────────────────────────────┐
│      DEVELOPER SETUP CLUSTER           │
├────────────────────────────────────────┤
│                                        │
│  @wundr.io/computer-setup ─────────┐  │
│    │                                │  │
│    ├─> Platform Detection           │  │
│    ├─> Tool Installation            │  │
│    ├─> Claude Code Setup            │  │
│    ├─> Hardware Optimization        │  │
│    └─> Verification                 │  │
│                                     │  │
│  @wundr.io/setup-toolkit-simple ───┤  │
│    │                                │  │
│    ├─> Basic Setup Tasks            │  │
│    └─> Simple Validation            │  │
│                                        │
│  Uses: @wundr.io/core                  │
│        @wundr.io/config                │
│                                        │
└────────────────────────────────────────┘
```

---

### Cluster 5: CLI Interfaces

```
┌────────────────────────────────────────┐
│         CLI INTERFACES CLUSTER         │
├────────────────────────────────────────┤
│                                        │
│  @wundr.io/cli ────────────────────┐  │
│    │                                │  │
│    ├─> OCLIF Framework              │  │
│    ├─> Command Router               │  │
│    ├─> TUI/Interactive UI           │  │
│    ├─> Plugin System Integration    │  │
│    └─> Full Platform Access         │  │
│                                     │  │
│  @wundr.io/cli-simple ─────────────┤  │
│    │                                │  │
│    ├─> Commander.js                 │  │
│    ├─> Simple Commands              │  │
│    └─> Lightweight Interface        │  │
│                                        │
└────────────────────────────────────────┘
```

---

## Dependency Weight Analysis

### Lightest Dependencies (< 5 packages)

```
@wundr.io/core-simple:
  ├── eventemitter3
  ├── uuid
  └── zod
  Total: 3 packages ✓ LIGHTWEIGHT

@wundr.io/shared-config:
  ├── eslint-config-prettier
  └── prettier
  Total: 2 packages ✓ LIGHTWEIGHT
```

---

### Medium Dependencies (5-15 packages)

```
@wundr.io/core:
  ├── chalk
  ├── winston
  ├── zod
  ├── uuid
  └── eventemitter3
  Total: 5 packages ✓ MODERATE

@wundr.io/config:
  ├── dotenv
  ├── fs-extra
  ├── yaml
  ├── zod
  └── @wundr.io/core
  Total: 5 packages ✓ MODERATE
```

---

### Heavy Dependencies (> 15 packages)

```
@wundr.io/cli:
  ├── @oclif/core
  ├── @oclif/plugin-help
  ├── @oclif/plugin-plugins
  ├── commander
  ├── inquirer
  ├── blessed
  ├── blessed-contrib
  ├── (20+ more packages)
  └── @wundr.io dependencies (core, config, computer-setup)
  Total: 30+ packages ⚠️ HEAVY

@wundr.io/ai-integration:
  ├── @anthropic-ai/sdk
  ├── @octokit/rest
  ├── axios
  ├── ws
  ├── sqlite3
  ├── ioredis
  ├── (15+ more packages)
  Total: 20+ packages ⚠️ HEAVY
```

---

## Circular Dependency Check

```
✅ NO CIRCULAR DEPENDENCIES DETECTED

All packages follow a strict hierarchical dependency model:
- Foundational packages have no internal dependencies
- Each level only depends on lower levels
- No package depends on packages that depend on it
```

---

## Peer Dependency Requirements

```
@wundr.io/analysis-engine:
  peerDependencies:
    typescript: ">=4.0.0"

@wundr.io/web-client-simple:
  peerDependencies:
    react: "^19.1.0"
    react-dom: "^19.1.0"

All other packages:
  No peer dependencies required ✓
```

---

## Transitive Dependency Graph

### Installing @wundr.io/cli gives you:

```
@wundr.io/cli
  └── @wundr.io/core
  └── @wundr.io/config
      └── @wundr.io/core (deduplicated)
  └── @wundr.io/computer-setup
      └── @wundr.io/core (deduplicated)
      └── @wundr.io/config (deduplicated)

Total unique @wundr.io packages: 4
Total external packages: ~40+
```

---

### Installing @wundr.io/cli-simple gives you:

```
@wundr.io/cli-simple
  └── @wundr.io/core-simple
  └── @wundr.io/analysis-engine-simple
      └── @wundr.io/core-simple (deduplicated)
  └── @wundr.io/setup-toolkit-simple
      └── @wundr.io/core-simple (deduplicated)

Total unique @wundr.io packages: 4
Total external packages: ~15
```

---

## Build Order (Topological Sort)

```
1. Build @wundr.io/core
2. Build @wundr.io/core-simple
3. Build @wundr.io/shared-config
   │
   ↓
4. Build @wundr.io/config (depends on core)
5. Build @wundr.io/plugin-system (depends on core)
6. Build @wundr.io/project-templates (depends on core)
7. Build @wundr.io/analysis-engine-simple (depends on core-simple)
8. Build @wundr.io/setup-toolkit-simple (depends on core-simple)
9. Build @wundr.io/web-client-simple (depends on core-simple)
   │
   ↓
10. Build @wundr.io/computer-setup (depends on core, config)
11. Build @wundr.io/cli-simple (depends on core-simple, analysis-engine-simple, setup-toolkit-simple)
    │
    ↓
12. Build @wundr.io/cli (depends on core, config, computer-setup)

Standalone (can build anytime):
- @wundr.io/analysis-engine
- @wundr.io/ai-integration
- @wundr.io/security
```

---

## Package Size Comparison

```
Estimated Bundle Sizes (minified):

LIGHTWEIGHT (<100KB):
  @wundr.io/core-simple          ~45KB
  @wundr.io/shared-config         ~10KB
  @wundr.io/plugin-system         ~35KB

MODERATE (100-500KB):
  @wundr.io/core                 ~180KB
  @wundr.io/config               ~95KB
  @wundr.io/analysis-engine-simple ~250KB

HEAVY (>500KB):
  @wundr.io/analysis-engine      ~850KB (ts-morph)
  @wundr.io/cli                  ~1.2MB (OCLIF, blessed)
  @wundr.io/ai-integration       ~2.5MB (Anthropic SDK, SQLite)

Note: Sizes include dependencies
```

---

## Recommended Installation Patterns

### Pattern 1: Minimal Setup (Lightweight)

```bash
npm install @wundr.io/core-simple @wundr.io/cli-simple

# Use for:
# - Simple scripts
# - Lightweight tools
# - Quick prototypes
```

---

### Pattern 2: Standard Setup (Balanced)

```bash
npm install @wundr.io/core @wundr.io/config

# Use for:
# - Production applications
# - Standard features
# - Balanced dependencies
```

---

### Pattern 3: Full Platform (Complete)

```bash
npm install -g @wundr.io/cli

# Includes:
# - All core features
# - Computer setup
# - Full CLI
# - Plugin system
```

---

### Pattern 4: Custom Setup (Modular)

```bash
# Pick exactly what you need
npm install @wundr.io/core
npm install @wundr.io/analysis-engine
npm install @wundr.io/ai-integration

# Use for:
# - Custom tools
# - Specific features
# - Minimal footprint
```

---

## Dependency Update Strategy

```
When updating dependencies:

1. Update foundational packages first:
   @wundr.io/core
   @wundr.io/core-simple
   @wundr.io/shared-config

2. Then update level 1 packages:
   @wundr.io/config
   @wundr.io/plugin-system
   (etc.)

3. Then update level 2 packages:
   @wundr.io/computer-setup
   @wundr.io/cli-simple

4. Finally update top-level packages:
   @wundr.io/cli

This ensures compatibility at each level.
```

---

**Last Updated:** 2025-11-21 **Maintained By:** Wundr Team
