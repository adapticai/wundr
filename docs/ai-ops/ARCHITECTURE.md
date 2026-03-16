# Architecture

## Purpose

This document explains the high-level architecture of the Wundr platform so that contributors and AI
agents can understand system boundaries, major components, data flows, and key design decisions.

Consult this document before making architectural changes.

## System Overview

```
CLI (wundr)
    |
    v
Core Engine (analysis, orchestration, governance)
    |
    v
Package Layer (@wundr/* packages)
    |
    v
Neolith Platform (web, desktop, mobile)
    |
    v
Database (Prisma/PostgreSQL) + External Integrations
```

## Core Components

### 1. CLI (`packages/@wundr/cli`)

Responsibilities:

- User-facing command interface (`wundr` binary)
- Computer setup and environment configuration
- Project creation and scaffolding
- Analysis engine invocation

Technologies: Commander, Inquirer, Chalk, TypeScript

### 2. Core Engine (`packages/core`, `packages/@wundr/core`)

Responsibilities:

- Central orchestration logic
- Package coordination
- Shared type definitions
- Plugin system integration

### 3. Analysis Engine (`packages/analysis-engine`, `packages/@wundr/analysis-engine`)

Responsibilities:

- Codebase analysis and refactoring recommendations
- Code quality metrics
- Dependency graph analysis
- Architecture pattern detection

Technologies: ts-morph, AST analysis

### 4. AI Orchestration Layer

Multiple packages providing AI agent coordination:

- `@wundr/crew-orchestrator` - CrewAI-style multi-agent workflows
- `@wundr/langgraph-orchestrator` - LangGraph-style agent graphs
- `@wundr/autogen-orchestrator` - AutoGen-style agent collaboration
- `@wundr/agent-delegation` - Task delegation between agents
- `@wundr/agent-memory` - Persistent agent memory
- `@wundr/agent-eval` - Agent performance evaluation
- `@wundr/agent-observability` - Agent monitoring and tracing

### 5. Security & Governance

- `@wundr/prompt-security` - Prompt injection detection and sanitization
- `@wundr/security` - General security utilities
- `@wundr/governance` - Code quality governance rules
- `@wundr/token-budget` - Token usage tracking and budgeting
- `@wundr/risk-twin` - Risk assessment and digital twin

### 6. MCP Infrastructure

- `@wundr/mcp-server` - Model Context Protocol server
- `@wundr/mcp-registry` - MCP tool registry
- `@wundr/neolith-mcp-server` - Neolith-specific MCP server

### 7. Neolith Platform (`packages/@wundr/neolith`)

A nested monorepo containing the user-facing applications:

**Apps:**

- `apps/web` - Next.js web application (primary UI)
- `apps/desktop` - Electron desktop application
- `apps/mobile` - React Native mobile application

**Packages:**

- `@neolith/core` - Shared platform logic
- `@neolith/ui` - Shared UI component library
- `@neolith/database` - Prisma schema and database client
- `@neolith/api-types` - Shared API type definitions
- `@neolith/daemon-sdk` - Background service SDK
- `@neolith/org-integration` - Organization integration layer
- `@neolith/file-processor` - File processing utilities
- `@neolith/eslint-config` - Shared ESLint configuration
- `@neolith/tailwind-config` - Shared Tailwind configuration
- `@neolith/typescript-config` - Shared TypeScript configuration

**Genesis sub-packages:**

- `@genesis/core` - Organization structure generation engine

### 8. Configuration & Templates

- `@wundr/config` - Shared configuration
- `@wundr/shared-config` (`packages/shared-config`) - Base shared config
- `@wundr/hydra-config` - Multi-head configuration management
- `@wundr/project-templates` - Project scaffolding templates
- `@wundr/prompt-templates` - AI prompt templates
- `@wundr/structured-output` - Structured output schemas (Zod)
- `@wundr/typechat-output` - TypeChat output formatting

### 9. Infrastructure

- `@wundr/environment` - Environment variable management
- `@wundr/computer-setup` - Developer machine provisioning
- `@wundr/jit-tools` - Just-in-time tool installation
- `@wundr/orchestrator-daemon` - Background orchestration daemon
- `@wundr/org-genesis` - Organization bootstrapping

## Data Flow

### CLI Command Flow

```
User runs `wundr <command>`
    |
CLI parses command (Commander)
    |
Core engine resolves package dependencies
    |
Target package executes logic
    |
Results returned to CLI for display
```

### AI Agent Orchestration Flow

```
Task definition
    |
Orchestrator selects agent topology
    |
Agents spawned with bounded scope
    |
Agents execute in parallel where possible
    |
Results aggregated and verified
    |
Output returned to caller
```

### Neolith Web Request Flow

```
User action in Next.js app
    |
API route or server action
    |
Prisma database query
    |
Response rendered
```

## Key Architectural Principles

- **Monorepo-first**: All packages co-located, managed by pnpm + Turborepo
- **Package isolation**: Each package has clear boundaries and explicit dependencies
- **Configuration sharing**: Common config (ESLint, TypeScript, Tailwind) flows from shared packages
- **AI-native**: Agent orchestration and AI integration are first-class concerns
- **Multi-platform**: Single codebase targets web, desktop, and mobile

## Deployment Topology

- **Neolith Web** - Deployed to Railway (backend) and/or Netlify (frontend)
- **Wundr CLI** - Published to npm as `@adapticai/wundr`
- **MCP Servers** - Run locally via `npx` or deployed as services
- **Desktop** - Distributed via Electron
