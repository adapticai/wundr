# Organizational Genesis Package - Implementation Backlog

## Overview

This backlog defines the systematic implementation of the `@wundr/org-genesis` package, which
provides:

1. **Context Compiler** - Dynamic environment compilation based on discipline
2. **Global Agent Registry** - Centralized storage for Charters, Agents, Tools, Hooks
3. **Organizational Generator ("Genesis")** - Conversational interface to generate entire fleet
4. **Discipline Packs** - Per-discipline configuration bundles

## Architecture Reference

Based on:

- `docs/new/Architectural Framework for Autonomous High-Density Agentic Clusters.md`
- `docs/new/Agent Registry & Charters_ Dynamic Generation Schema.md`

## Package Structure

```
packages/@wundr/org-genesis/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                      # Main exports
│   │
│   ├── types/                        # Core type definitions
│   │   ├── index.ts
│   │   ├── organization.ts           # Org manifest types
│   │   ├── discipline.ts             # Discipline pack types
│   │   ├── charter.ts                # VP charter types
│   │   ├── agent.ts                  # Sub-agent definition types
│   │   ├── session.ts                # Session types
│   │   └── registry.ts               # Registry types
│   │
│   ├── context-compiler/             # Dynamic context compilation
│   │   ├── index.ts
│   │   ├── compiler.ts               # Main compiler engine
│   │   ├── discipline-loader.ts      # Load discipline packs
│   │   ├── template-renderer.ts      # Handlebars rendering
│   │   ├── worktree-writer.ts        # Write to git worktrees
│   │   └── config-generator.ts       # Generate CLAUDE.md, settings.json, etc.
│   │
│   ├── registry/                     # Global Agent Registry
│   │   ├── index.ts
│   │   ├── registry-manager.ts       # Main registry orchestrator
│   │   ├── discipline-registry.ts    # Discipline pack storage
│   │   ├── agent-registry.ts         # Sub-agent definitions
│   │   ├── charter-registry.ts       # VP charter storage
│   │   ├── tools-registry.ts         # MCP tool configurations
│   │   ├── hooks-registry.ts         # Hook configurations
│   │   └── storage/
│   │       ├── file-storage.ts       # File-based storage adapter
│   │       ├── memory-storage.ts     # In-memory storage adapter
│   │       └── storage-interface.ts  # Storage abstraction
│   │
│   ├── generator/                    # Organizational Generator
│   │   ├── index.ts
│   │   ├── genesis-engine.ts         # Main generation orchestrator
│   │   ├── vp-generator.ts           # Tier 1: VP generation
│   │   ├── discipline-generator.ts   # Tier 2: Discipline generation
│   │   ├── agent-generator.ts        # Tier 3: Sub-agent generation
│   │   ├── manifest-generator.ts     # Org manifest generation
│   │   └── prompts/
│   │       ├── vp-prompts.ts         # VP generation prompts
│   │       ├── discipline-prompts.ts # Discipline generation prompts
│   │       └── agent-prompts.ts      # Agent generation prompts
│   │
│   ├── cli/                          # Conversational CLI
│   │   ├── index.ts
│   │   ├── genesis-cli.ts            # Main CLI interface
│   │   ├── interactive-prompts.ts    # Interactive prompt flows
│   │   ├── commands/
│   │   │   ├── create-org.ts         # wundr org create
│   │   │   ├── add-vp.ts             # wundr org add-vp
│   │   │   ├── add-discipline.ts     # wundr org add-discipline
│   │   │   ├── add-agent.ts          # wundr org add-agent
│   │   │   ├── list.ts               # wundr org list
│   │   │   ├── compile.ts            # wundr org compile
│   │   │   └── export.ts             # wundr org export
│   │   └── formatters/
│   │       ├── tree-formatter.ts     # Display org as tree
│   │       └── table-formatter.ts    # Display as tables
│   │
│   ├── templates/                    # Built-in templates
│   │   ├── index.ts
│   │   ├── disciplines/
│   │   │   ├── engineering.ts
│   │   │   ├── legal.ts
│   │   │   ├── hr.ts
│   │   │   ├── marketing.ts
│   │   │   ├── finance.ts
│   │   │   └── operations.ts
│   │   ├── charters/
│   │   │   ├── vp-template.ts
│   │   │   └── session-manager-template.ts
│   │   └── agents/
│   │       ├── universal-agents.ts
│   │       └── specialized-agents.ts
│   │
│   └── utils/                        # Utilities
│       ├── index.ts
│       ├── handlebars-helpers.ts     # Template helpers
│       ├── validation.ts             # Schema validation
│       ├── git-worktree.ts           # Git worktree management
│       └── slug.ts                   # Name/ID generation
```

---

## Wave 1: Foundation (Package Setup & Core Types)

### 1.1 Package Configuration

- [ ] Create `packages/@wundr/org-genesis/package.json`
- [ ] Create `packages/@wundr/org-genesis/tsconfig.json`
- [ ] Create `packages/@wundr/org-genesis/src/index.ts`

### 1.2 Core Type Definitions

- [ ] `src/types/organization.ts` - OrganizationManifest, OrgConfig
- [ ] `src/types/discipline.ts` - DisciplinePack, DisciplineConfig
- [ ] `src/types/charter.ts` - VPCharter, SessionManagerCharter
- [ ] `src/types/agent.ts` - AgentDefinition, AgentCapabilities
- [ ] `src/types/session.ts` - SessionConfig, SessionContext
- [ ] `src/types/registry.ts` - RegistryEntry, RegistryQuery
- [ ] `src/types/index.ts` - Re-export all types

### 1.3 Utility Functions

- [ ] `src/utils/validation.ts` - Zod schemas for all types
- [ ] `src/utils/slug.ts` - ID/slug generation utilities
- [ ] `src/utils/handlebars-helpers.ts` - Template helpers
- [ ] `src/utils/git-worktree.ts` - Git worktree management
- [ ] `src/utils/index.ts` - Re-export utilities

**Verification:** `npm run lint && npm run typecheck && npm run build`

---

## Wave 2: Context Compiler

### 2.1 Template Renderer

- [ ] `src/context-compiler/template-renderer.ts` - Handlebars-based rendering

### 2.2 Discipline Loader

- [ ] `src/context-compiler/discipline-loader.ts` - Load discipline packs from registry

### 2.3 Config Generator

- [ ] `src/context-compiler/config-generator.ts` - Generate CLAUDE.md, claude_config.json,
      settings.json

### 2.4 Worktree Writer

- [ ] `src/context-compiler/worktree-writer.ts` - Write compiled configs to git worktrees

### 2.5 Main Compiler Engine

- [ ] `src/context-compiler/compiler.ts` - Main ContextCompiler class
- [ ] `src/context-compiler/index.ts` - Re-export

**Verification:** `npm run lint && npm run typecheck && npm run build`

---

## Wave 3: Global Registry

### 3.1 Storage Layer

- [ ] `src/registry/storage/storage-interface.ts` - IRegistryStorage interface
- [ ] `src/registry/storage/file-storage.ts` - File-based implementation
- [ ] `src/registry/storage/memory-storage.ts` - In-memory implementation

### 3.2 Individual Registries

- [ ] `src/registry/charter-registry.ts` - VP and Session Manager charters
- [ ] `src/registry/discipline-registry.ts` - Discipline packs
- [ ] `src/registry/agent-registry.ts` - Sub-agent definitions
- [ ] `src/registry/tools-registry.ts` - MCP tool configurations
- [ ] `src/registry/hooks-registry.ts` - Hook configurations

### 3.3 Registry Manager

- [ ] `src/registry/registry-manager.ts` - Unified registry orchestrator
- [ ] `src/registry/index.ts` - Re-export

**Verification:** `npm run lint && npm run typecheck && npm run build`

---

## Wave 4: Organizational Generator

### 4.1 Generation Prompts

- [ ] `src/generator/prompts/vp-prompts.ts` - Prompts for VP generation
- [ ] `src/generator/prompts/discipline-prompts.ts` - Prompts for discipline generation
- [ ] `src/generator/prompts/agent-prompts.ts` - Prompts for agent generation

### 4.2 Individual Generators

- [ ] `src/generator/vp-generator.ts` - Tier 1 VP generation
- [ ] `src/generator/discipline-generator.ts` - Tier 2 discipline generation
- [ ] `src/generator/agent-generator.ts` - Tier 3 agent generation
- [ ] `src/generator/manifest-generator.ts` - Org manifest generation

### 4.3 Genesis Engine

- [ ] `src/generator/genesis-engine.ts` - Main orchestrator (recursive generation)
- [ ] `src/generator/index.ts` - Re-export

**Verification:** `npm run lint && npm run typecheck && npm run build`

---

## Wave 5: CLI & Templates

### 5.1 Built-in Templates

- [ ] `src/templates/disciplines/engineering.ts`
- [ ] `src/templates/disciplines/legal.ts`
- [ ] `src/templates/disciplines/hr.ts`
- [ ] `src/templates/disciplines/marketing.ts`
- [ ] `src/templates/disciplines/finance.ts`
- [ ] `src/templates/disciplines/operations.ts`
- [ ] `src/templates/charters/vp-template.ts`
- [ ] `src/templates/charters/session-manager-template.ts`
- [ ] `src/templates/agents/universal-agents.ts`
- [ ] `src/templates/agents/specialized-agents.ts`
- [ ] `src/templates/index.ts`

### 5.2 CLI Commands

- [ ] `src/cli/commands/create-org.ts`
- [ ] `src/cli/commands/add-vp.ts`
- [ ] `src/cli/commands/add-discipline.ts`
- [ ] `src/cli/commands/add-agent.ts`
- [ ] `src/cli/commands/list.ts`
- [ ] `src/cli/commands/compile.ts`
- [ ] `src/cli/commands/export.ts`

### 5.3 CLI Infrastructure

- [ ] `src/cli/formatters/tree-formatter.ts`
- [ ] `src/cli/formatters/table-formatter.ts`
- [ ] `src/cli/interactive-prompts.ts`
- [ ] `src/cli/genesis-cli.ts`
- [ ] `src/cli/index.ts`

**Verification:** `npm run lint && npm run typecheck && npm run build`

---

## Wave 6: Integration & Documentation

### 6.1 Main Package Entry

- [ ] `src/index.ts` - Complete exports

### 6.2 Documentation

- [ ] `README.md` - Comprehensive package documentation
- [ ] JSDoc on all public APIs

### 6.3 Final Verification

- [ ] All lint errors resolved
- [ ] All type errors resolved
- [ ] Build succeeds
- [ ] Integration with existing packages verified

### 6.4 Git Push

- [ ] Commit all changes
- [ ] Push to origin/master

---

## Success Criteria

1. **Type Safety:** No `any` or `unknown` types except where absolutely necessary
2. **Lint Clean:** Zero ESLint errors or warnings
3. **Build Success:** `npm run build` completes without errors
4. **Documentation:** All public APIs have JSDoc comments
5. **Functional:** All features work as specified in architectural documents

## Dependencies

- `handlebars` - Template rendering
- `zod` - Schema validation
- `chalk` - CLI colors
- `inquirer` - Interactive prompts
- `@anthropic-ai/sdk` - LLM generation (optional, for Genesis agent)

## Estimated Scope

- **Files:** ~50 TypeScript files
- **Lines of Code:** ~8,000-12,000
- **Waves:** 6
- **Agents per Wave:** 20 parallel
