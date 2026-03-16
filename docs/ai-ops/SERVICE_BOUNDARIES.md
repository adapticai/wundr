# Service Boundaries

## Purpose

Defines how packages and services interact within Wundr. AI agents must respect these boundaries and
not cross them without justification.

## Boundary Rules

1. Packages must declare explicit dependencies in `package.json`
2. No circular dependencies between packages
3. Shared types flow through `@wundr/core` or `@neolith/api-types`
4. Configuration flows from shared-config packages downward
5. UI components live in `@neolith/ui`, not in application code

## CLI Layer

Responsibilities:

- Command parsing and user interaction
- Delegating to core engine packages
- Output formatting and display

Depends on: `core`, `analysis-engine`, `config`

Must NOT: contain business logic, directly access database, manage agent state

## Core Engine

Responsibilities:

- Package orchestration
- Type definitions and shared interfaces
- Plugin system coordination

Depends on: `shared-config`

Must NOT: contain UI code, handle CLI I/O, manage database connections

## AI Orchestration

Responsibilities:

- Agent lifecycle management
- Task delegation and coordination
- Memory management
- Token budget enforcement

Packages: `crew-orchestrator`, `langgraph-orchestrator`, `autogen-orchestrator`, `agent-delegation`,
`agent-memory`, `agent-eval`, `agent-observability`

Depends on: `core`, `ai-integration`, `prompt-templates`, `structured-output`

Must NOT: directly access database, render UI, handle HTTP requests

## Security Layer

Responsibilities:

- Prompt injection detection
- Credential management
- Risk assessment
- Token budget enforcement

Packages: `prompt-security`, `security`, `risk-twin`, `token-budget`

Must NOT: contain business logic unrelated to security, manage UI state

## Neolith Platform

Responsibilities:

- User-facing web/desktop/mobile applications
- Workspace and organization management
- File processing
- Database access (via Prisma)

Boundary: Neolith is a self-contained sub-monorepo. Changes to Neolith packages should not require
changes to root-level Wundr packages and vice versa.

Internal boundaries:

- `@neolith/database` is the ONLY package that touches Prisma directly
- `@neolith/ui` is the ONLY source of shared components
- `@neolith/api-types` is the ONLY source of shared API types
- `@genesis/core` handles org structure generation logic

## MCP Infrastructure

Responsibilities:

- Tool registration and discovery
- Protocol handling
- Server lifecycle

Packages: `mcp-server`, `mcp-registry`, `neolith-mcp-server`

Must NOT: contain business logic, manage database, render UI

## Configuration

Responsibilities:

- Shared TypeScript, ESLint, Tailwind, and Prettier configuration
- Environment variable management
- Build pipeline settings

Flow: shared-config -> package-specific config -> application config

Must NOT: contain runtime logic, import application code

## Cross-Boundary Communication

When packages need to communicate across boundaries:

1. Use explicit dependency declarations
2. Communicate through typed interfaces defined in shared packages
3. Avoid direct imports across boundary lines
4. Use event-based patterns for loose coupling where appropriate
