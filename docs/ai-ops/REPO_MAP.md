# Repository Map

## Purpose

This file provides a structural map of the Wundr monorepo. Claude should read this before exploring
the codebase to understand where code lives and how it is organized.

## Top-Level Structure

```
/
├── packages/               # All packages (core monorepo)
│   ├── @wundr/             # Scoped Wundr packages (35+)
│   ├── @neolith/           # Neolith database package
│   ├── analysis-engine/    # Code analysis engine
│   ├── cli/                # CLI package
│   ├── core/               # Core orchestration
│   ├── setup-toolkit/      # Setup utilities
│   ├── shared-config/      # Shared configuration
│   └── web-client/         # Web client package
├── src/                    # Root source code
├── scripts/                # Build and utility scripts
├── config/                 # Root configuration files
├── docs/                   # Documentation (150+ files)
│   ├── ai-ops/             # AI agent operating docs (this directory)
│   └── agents/             # Agent-specific documentation
├── tests/                  # Root-level test suites
├── tasks/                  # Task tracking and lessons
│   ├── todo.md
│   ├── lessons.md
│   ├── active/
│   └── reviews/
├── tools/                  # Development tools
├── templates/              # Project templates
├── mcp-tools/              # MCP tool implementations
├── hooks/                  # Git and lifecycle hooks
├── k8s/                    # Kubernetes configuration
├── examples/               # Usage examples
├── setup/                  # Setup scripts
├── bin/                    # CLI binaries
├── demo/                   # Demo files
├── quality/                # Quality gate definitions
├── monitoring/             # Monitoring configuration
├── logs/                   # Application logs
├── memory/                 # Session memory files
├── .claude/                # Claude Code agent definitions
│   └── agents/             # Custom agent configurations
├── .github/                # GitHub Actions workflows
├── .husky/                 # Git hooks (husky)
└── .turbo/                 # Turborepo cache and config
```

## Neolith Sub-Monorepo

```
packages/@wundr/neolith/
├── apps/
│   ├── web/                # Next.js web application
│   ├── desktop/            # Electron desktop app
│   └── mobile/             # React Native mobile app
├── packages/
│   ├── @neolith/           # Shared Neolith packages
│   │   ├── core/           # Shared platform logic
│   │   ├── ui/             # Component library
│   │   ├── database/       # Prisma schema + client
│   │   ├── api-types/      # Shared API types
│   │   ├── daemon-sdk/     # Background service SDK
│   │   ├── org-integration/# Org integration layer
│   │   ├── file-processor/ # File processing
│   │   ├── eslint-config/  # ESLint config
│   │   ├── tailwind-config/# Tailwind config
│   │   └── typescript-config/ # TS config
│   └── @genesis/
│       └── core/           # Org structure generation
├── docker/                 # Docker configuration
└── scripts/                # Neolith-specific scripts
```

## Key Package Categories

### AI Agent Infrastructure

| Package                         | Purpose                            |
| ------------------------------- | ---------------------------------- |
| `@wundr/crew-orchestrator`      | CrewAI-style multi-agent workflows |
| `@wundr/langgraph-orchestrator` | LangGraph-style agent graphs       |
| `@wundr/autogen-orchestrator`   | AutoGen-style collaboration        |
| `@wundr/agent-delegation`       | Task delegation between agents     |
| `@wundr/agent-memory`           | Persistent agent memory            |
| `@wundr/agent-eval`             | Agent performance evaluation       |
| `@wundr/agent-observability`    | Agent monitoring and tracing       |
| `@wundr/ai-integration`         | AI provider integrations           |

### Security & Governance

| Package                  | Purpose                  |
| ------------------------ | ------------------------ |
| `@wundr/prompt-security` | Prompt injection defense |
| `@wundr/security`        | Security utilities       |
| `@wundr/governance`      | Code quality governance  |
| `@wundr/token-budget`    | Token usage budgeting    |
| `@wundr/risk-twin`       | Risk assessment          |

### Configuration & Output

| Package                    | Purpose                      |
| -------------------------- | ---------------------------- |
| `@wundr/config`            | Shared configuration         |
| `@wundr/hydra-config`      | Multi-head config management |
| `@wundr/structured-output` | Zod-based structured output  |
| `@wundr/typechat-output`   | TypeChat output formatting   |
| `@wundr/prompt-templates`  | AI prompt templates          |
| `@wundr/project-templates` | Project scaffolding          |

### Infrastructure & Tooling

| Package                      | Purpose                         |
| ---------------------------- | ------------------------------- |
| `@wundr/mcp-server`          | MCP server implementation       |
| `@wundr/mcp-registry`        | MCP tool registry               |
| `@wundr/neolith-mcp-server`  | Neolith-specific MCP server     |
| `@wundr/computer-setup`      | Dev machine provisioning        |
| `@wundr/jit-tools`           | Just-in-time tool installation  |
| `@wundr/orchestrator-daemon` | Background orchestration        |
| `@wundr/environment`         | Environment variable management |
| `@wundr/slack-agent`         | Slack integration agent         |

### Applications & UI

| Package                     | Purpose                                |
| --------------------------- | -------------------------------------- |
| `@wundr/neolith`            | Platform monorepo (web/desktop/mobile) |
| `@wundr/dashboard`          | Dashboard package                      |
| `@wundr/guardian-dashboard` | Security guardian dashboard            |
| `@wundr/genesis-app`        | Genesis application                    |
| `packages/web-client`       | Web client package                     |

## Important Configuration Files

| File                  | Purpose                               |
| --------------------- | ------------------------------------- |
| `CLAUDE.md`           | AI agent operating manual (this repo) |
| `turbo.json`          | Turborepo pipeline configuration      |
| `pnpm-workspace.yaml` | pnpm workspace package definitions    |
| `tsconfig.json`       | Root TypeScript configuration         |
| `.eslintrc.js`        | Root ESLint configuration             |
| `.prettierrc`         | Prettier formatting rules             |
| `railway.json`        | Railway deployment configuration      |
| `netlify.toml`        | Netlify deployment configuration      |
| `docker-compose.yml`  | Docker service definitions            |
| `jest.config.json`    | Root Jest test configuration          |
| `primer.md`           | Session-to-session context handoff    |
| `memory.sh`           | Live git context injection script     |
| `project_memory.log`  | Append-only commit history log        |
