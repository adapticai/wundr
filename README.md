# Wundr - Unified Developer Platform

<div align="center">

  <h1>🚀 Wundr</h1>

  <p>
    <strong>The Complete Developer Platform - From Machine Setup to Code Excellence</strong>
  </p>

  <p>
    Three powerful tools in one unified platform: Computer Setup, Project Creation, and Code Governance
  </p>

  <p>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-Get_Started_in_5_Minutes-brightgreen?style=for-the-badge" alt="Quick Start"></a>
    <a href="#three-core-features"><img src="https://img.shields.io/badge/Features-Three_Core_Tools-blue?style=for-the-badge" alt="Features"></a>
    <a href="#documentation"><img src="https://img.shields.io/badge/Docs-Comprehensive_Guide-orange?style=for-the-badge" alt="Documentation"></a>
  </p>

  <p>
    <img src="https://img.shields.io/npm/v/@wundr/cli?style=flat-square&logo=npm" alt="npm version">
    <img src="https://img.shields.io/github/license/adapticai/wundr?style=flat-square" alt="License">
    <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
    <img src="https://img.shields.io/badge/TypeScript-5.2+-blue?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Turborepo-Optimized-purple?style=flat-square" alt="Turborepo">
  </p>

  <p>
    <a href="https://github.com/adapticai/wundr/actions/workflows/enterprise-ci.yml">
      <img src="https://github.com/adapticai/wundr/workflows/🔄%20Enterprise%20CI/CD%20Pipeline/badge.svg" alt="CI/CD Pipeline">
    </a>
    <a href="https://github.com/adapticai/wundr/actions/workflows/enterprise-release.yml">
      <img src="https://github.com/adapticai/wundr/workflows/🚀%20Enterprise%20Release%20Pipeline/badge.svg" alt="Release Pipeline">
    </a>
    <a href="https://codecov.io/gh/adapticai/wundr">
      <img src="https://codecov.io/gh/adapticai/wundr/branch/main/graph/badge.svg" alt="Code Coverage">
    </a>
    <a href="https://github.com/adapticai/wundr/security/code-scanning">
      <img src="https://img.shields.io/github/actions/workflow/status/adapticai/wundr/enterprise-ci.yml?label=CodeQL&logo=github" alt="CodeQL">
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/github/last-commit/adapticai/wundr?style=flat-square&logo=github" alt="Last Commit">
    <img src="https://img.shields.io/github/commit-activity/m/adapticai/wundr?style=flat-square&logo=github" alt="Commit Activity">
    <img src="https://img.shields.io/github/contributors/adapticai/wundr?style=flat-square&logo=github" alt="Contributors">
    <img src="https://img.shields.io/github/issues/adapticai/wundr?style=flat-square&logo=github" alt="Issues">
    <img src="https://img.shields.io/github/pull-requests/adapticai/wundr?style=flat-square&logo=github" alt="Pull Requests">
  </p>

  <p>
    <img src="https://img.shields.io/docker/v/wundr/cli?style=flat-square&logo=docker&label=Docker" alt="Docker Version">
    <img src="https://img.shields.io/docker/image-size/wundr/cli?style=flat-square&logo=docker" alt="Docker Image Size">
    <img src="https://img.shields.io/badge/Maintained-Yes-brightgreen?style=flat-square" alt="Maintained">
    <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  </p>

</div>

---

## What is Wundr?

Wundr is a comprehensive unified developer platform that provides three distinct but complementary
features to support the entire developer lifecycle:

1. **Computer Setup** - Automated developer machine provisioning with global tools and
   configurations
2. **Project Creation** - Scaffold new projects with Wundr-compliant best practices built-in
3. **Code Governance** - Analyze and improve existing codebases with AI-powered insights

Each feature serves a specific purpose in the development workflow, from initial machine setup
through project creation to ongoing code quality management.

---

## Three-Tier Agent Hierarchy

Wundr implements a production-grade **Three-Tier Agent Hierarchy** for fleet-scale autonomous
engineering:

```
                    +---------------------------+
                    |    HUMAN CORTEX (Tier 0)  |
                    |  Architects | Guardians   |
                    +-------------+-------------+
                                  |
                                  v
            +---------------------+---------------------+
            |        VP SUPERVISOR DAEMON (Tier 1)      |
            |           Machine-Level Orchestration     |
            |  - Strategy & triage across all projects  |
            |  - Resource allocation & rate limiting    |
            |  - Slack/notification integration         |
            |  - PTY-based automated CLI approval       |
            +---------------------+---------------------+
                                  |
            +---------+-----------+-----------+---------+
            |         |           |           |         |
            v         v           v           v         v
    +-------+--+ +----+-----+ +---+------+ +-+--------+ +--------+
    | Session  | | Session  | | Session  | | Session  | | ...    |
    | Manager  | | Manager  | | Manager  | | Manager  | |        |
    | (Tier 2) | | (Tier 2) | | (Tier 2) | | (Tier 2) | |        |
    +----+-----+ +----+-----+ +----+-----+ +----+-----+ +--------+
         |            |            |            |
    +----+----+  +----+----+  +----+----+  +----+----+
    |Sub-Agent|  |Sub-Agent|  |Sub-Agent|  |Sub-Agent|
    | Workers |  | Workers |  | Workers |  | Workers |
    | (Tier 3)|  | (Tier 3)|  | (Tier 3)|  | (Tier 3)|
    +---------+  +---------+  +---------+  +---------+
```

### Tier 1: VP Supervisor Daemon (Machine-Level)

- **Scope**: One per development machine (node)
- **Responsibilities**: Strategic oversight, request triage, resource allocation, rate limiting
- **Features**: Identity management, Slack integration, process lifecycle, PTY-based approval

### Tier 2: Session Managers (Project-Level)

- **Scope**: 5-10 per VP Supervisor (~160 total across fleet)
- **Responsibilities**: Feature implementation, git management, memory bank coordination
- **Features**: `activeContext.md` tracking, `progress.md` logging, sub-agent delegation

### Tier 3: Sub-Agent Workers (Task-Level)

- **Scope**: ~20 per Session Manager (~3,200 total across fleet)
- **Responsibilities**: Specialized tasks (coding, testing, reviewing, documentation)
- **Features**: Git worktree isolation, quality gate hooks, focused task execution

**Maximum Scale**: 3,376 autonomous agents (16 VPs + 160 Sessions + 3,200 Workers) directed by a
12-person human cortex = **281:1 leverage ratio**

## 🌟 Three Core Features

### 1. Computer Setup (New Developer Onboarding)

**Purpose**: Set up new developer machines with all required global tools

```bash
# Interactive setup wizard
wundr computer-setup

# Setup with specific profile
wundr computer-setup --profile fullstack

# Apply team configurations
wundr computer-setup --team platform
```

**What it installs**:

- ✅ Development runtimes (Node.js, Python, Go, Rust)
- ✅ Global CLI tools (git, docker, aws-cli, gh)
- ✅ Package managers (npm, pnpm, yarn, pip)
- ✅ Editors and extensions (VS Code, Vim)
- ✅ Database clients and tools
- ✅ AI development tools (Claude Code, Ruflo)
- ✅ Hardware-adaptive Claude Code optimizations

**Standalone Claude Code Optimization**: Need just the performance optimizations without a full
setup?

First, ensure `wundr` CLI is installed:

```bash
# Install globally
npm install -g @wundr.io/cli

# OR link for development
cd packages/@wundr/cli && pnpm link --global

# OR run via npx (no installation)
npx @wundr.io/cli claude-setup optimize
```

Then run the optimization setup:

```bash
# Setup hardware-adaptive Claude Code optimizations
wundr claude-setup optimize

# Features:
# • 3.5x heap size increase (4GB → 14GB on 24GB RAM)
# • 7x context window expansion (~50k → ~350k tokens)
# • 90% reduction in OOM crashes
# • Automatic hardware detection and V8 tuning
```

See [CLAUDE-CODE-STANDALONE-OPTIMIZATION.md](docs/CLAUDE-CODE-STANDALONE-OPTIMIZATION.md) for
details.

**Available Profiles**:

- Frontend Developer
- Backend Developer
- Full Stack Developer
- DevOps Engineer
- Machine Learning Engineer
- Mobile Developer

### 2. Project Creation (Start New Projects Right)

**Purpose**: Create new projects with all Wundr best practices pre-configured

```bash
# Create a Next.js frontend application
wundr create frontend my-app

# Create a Fastify backend API
wundr create backend my-api

# Create a Turborepo monorepo
wundr create monorepo my-platform

# Create a full-stack application
wundr create fullstack my-project
```

**What it includes**:

- ✅ TypeScript with strict configuration
- ✅ ESLint + Prettier pre-configured
- ✅ Jest/Vitest testing setup
- ✅ Husky pre-commit hooks
- ✅ GitHub Actions CI/CD
- ✅ Wundr governance baselines
- ✅ CLAUDE.md for AI assistance
- ✅ Docker configuration (optional)

**Project Templates**:

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Fastify + Prisma + OpenAPI
- **Monorepo**: Turborepo + multiple packages
- **Full-stack**: Complete application setup

### 3. Code Analysis & Governance (Maintain Quality)

**Purpose**: Analyze and improve existing codebases

```bash
# Analyze current codebase
wundr analyze

# Create governance baseline
wundr govern baseline

# Check for drift from standards
wundr govern check

# Generate compliance reports
wundr govern report
```

**Analysis Capabilities**:

- ✅ AST-powered code analysis
- ✅ Duplicate detection and consolidation
- ✅ Complexity metrics and quality scoring
- ✅ Circular dependency detection
- ✅ Security vulnerability scanning
- ✅ Performance bottleneck identification

## Quick Start

### Global Setup (Recommended)

Set up your entire development environment with a single command:

```bash
# Complete machine setup with Three-Tier Hierarchy support
npx tsx packages/@wundr/computer-setup/dev.ts global-setup

# This installs:
# - VP Supervisor Daemon infrastructure
# - Session Manager templates and memory banks
# - Sub-Agent worker templates with git worktree support
# - All MCP tools and registries
# - Claude Code with hardware-adaptive optimizations
# - Token budgeting and governance systems
```

### Installation (CLI Only)

```bash
# Install globally (recommended)
npm install -g @wundr.io/cli

# Or use with npx
npx @wundr.io/cli --help
```

### Development Setup (For Contributors)

```bash
# Clone the repository
git clone https://github.com/adapticai/wundr.git
cd wundr

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

### Quick Development Commands

For quick development without building:

```bash
# Check what tools are installed
npx tsx packages/@wundr/computer-setup/dev.ts check-tools

# List available profiles
npx tsx packages/@wundr/computer-setup/dev.ts list-profiles

# Dry run a profile (safe)
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend

# Create a new project (after dependencies installed)
npx tsx packages/@wundr/cli/src/index.ts create frontend my-app
```

See [DEV_QUICKSTART.md](./DEV_QUICKSTART.md) for more development shortcuts.

## Monorepo Structure

Wundr is built as a monorepo using Turborepo for optimized builds and caching:

### Core Packages

```
packages/@wundr/
├── cli                      # Unified command interface
├── core                     # Shared utilities and event bus
├── config                   # Configuration management
├── plugin-system            # Plugin lifecycle management
├── computer-setup           # Machine provisioning system
├── project-templates        # Project scaffolding templates
├── analysis-engine          # Code analysis capabilities
├── dashboard                # Web dashboard interface
├── ai-integration           # AI and Ruflo integration
├── security                 # Security scanning and compliance
├── environment              # Environment management
├── mcp-server               # MCP server implementation
└── docs                     # Documentation site
```

### Agent Orchestration Packages (New)

```
packages/@wundr/
├── crew-orchestrator        # CrewAI-style role-based multi-agent teams
├── langgraph-orchestrator   # LangGraph cyclic state-driven workflows
├── autogen-orchestrator     # AutoGen conversational agent orchestration
├── agent-delegation         # Sub-agent task delegation framework
├── agent-memory             # MemGPT-inspired tiered memory (scratchpad + persistent)
├── agent-eval               # Agent performance evaluation and benchmarking
└── agent-observability      # Telemetry, tracing, and monitoring for agents
```

### Context & Intelligence Packages (New)

```
packages/@wundr/
├── jit-tools                # Just-In-Time tool loading via semantic search
├── rag-utils                # RAG-based retrieval and context building
├── token-budget             # Token budgeting and rate limiting
├── mcp-registry             # Central MCP tool registry and discovery
├── hydra-config             # Hydra-style hierarchical configuration composition
├── prompt-security          # Action-Selector/Interceptor for prompt injection defense
├── prompt-templates         # Jinja2-style dynamic prompt templating
├── structured-output        # Pydantic/Instructor-style structured LLM outputs
├── typechat-output          # TypeChat-based structured output validation
└── governance               # IPRE governance pipeline and compliance
```

### New Packages Reference

| Package                            | Description                | Key Features                                                           |
| ---------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `@wundr.io/prompt-security`        | Prompt injection defense   | Action-Selector pattern, input sanitization, threat detection          |
| `@wundr.io/crew-orchestrator`      | CrewAI-style orchestration | Role-based teams, task delegation, collaborative workflows             |
| `@wundr.io/langgraph-orchestrator` | LangGraph integration      | Cyclic state machines, conditional routing, checkpointing              |
| `@wundr.io/autogen-orchestrator`   | AutoGen patterns           | Conversational agents, group chat, function calling                    |
| `@wundr.io/jit-tools`              | Just-In-Time tool loading  | Semantic search, dynamic injection, context optimization               |
| `@wundr.io/agent-memory`           | Tiered memory system       | MemGPT-inspired scratchpad, episodic/semantic stores, forgetting curve |
| `@wundr.io/agent-delegation`       | Sub-agent management       | Task routing, worktree isolation, quality gates                        |
| `@wundr.io/governance`             | IPRE pipeline              | Intent-Policy-Reward-Evaluator, compliance checking, alignment debt    |
| `@wundr.io/hydra-config`           | Hierarchical config        | Composition, overrides, environment-aware configuration                |
| `@wundr.io/mcp-registry`           | MCP tool registry          | Central catalog, semantic discovery, permission management             |
| `@wundr.io/rag-utils`              | RAG utilities              | Vector stores, agentic retrieval, context compaction                   |
| `@wundr.io/token-budget`           | Token management           | Rate limiting, tiered allocation, budget tracking                      |
| `@wundr.io/agent-eval`             | Agent evaluation           | Benchmarking, performance metrics, regression testing                  |
| `@wundr.io/agent-observability`    | Agent monitoring           | Telemetry, tracing, decision logging, dashboards                       |

## Command Reference

### Computer Setup Commands

```bash
# Main setup command
wundr computer-setup                    # Interactive setup wizard
wundr computer-setup --profile <role>   # Use specific profile
wundr computer-setup --dry-run          # Preview without installing
wundr computer-setup validate           # Verify installations
wundr computer-setup doctor             # Diagnose issues

# Profile management
wundr computer-setup profile list       # List available profiles
wundr computer-setup profile show <name> # Show profile details
wundr computer-setup profile export     # Export current setup
wundr computer-setup profile import <file> # Import profile

# Team configurations
wundr computer-setup team <name>        # Apply team settings
wundr computer-setup team list          # List team configs
```

### Project Creation Commands

```bash
# Create projects
wundr create frontend <name>      # Next.js application
wundr create backend <name>        # Fastify API
wundr create monorepo <name>       # Turborepo platform
wundr create fullstack <name>      # Full-stack app

# With options
wundr create frontend my-app --no-git     # Skip git init
wundr create backend my-api --no-install  # Skip deps install
wundr create monorepo my-platform --docker # Include Docker

# List available templates
wundr create list                  # Show all templates
```

### Code Analysis Commands

```bash
# Analysis
wundr analyze                      # Full analysis
wundr analyze --focus duplicates   # Specific analysis
wundr analyze ./src                # Analyze directory

# Governance
wundr govern baseline              # Create baseline
wundr govern check                 # Check compliance
wundr govern report                # Generate report
wundr govern drift                 # Check for drift

# Dashboard
wundr dashboard                    # Start web UI
wundr dashboard --port 4000        # Custom port
```

## ⚙️ Configuration

Wundr uses a flexible configuration system in `wundr.config.json`:

```json
{
  "project": {
    "name": "My Project",
    "type": "monorepo",
    "framework": "turborepo"
  },
  "computerSetup": {
    "profile": "fullstack",
    "team": "platform",
    "autoUpdate": true
  },
  "analysis": {
    "targetPath": "./src",
    "excludePatterns": ["node_modules", "dist"],
    "complexity": {
      "maxCyclomatic": 10,
      "maxCognitive": 15
    }
  },
  "governance": {
    "enforceStandards": true,
    "failOnViolation": false,
    "standards": ["eslint", "prettier", "typescript"]
  }
}
```

## Architecture

Wundr is built with a modular, event-driven architecture organized around the Three-Tier Agent
Hierarchy:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           HUMAN CORTEX (Tier 0)                              │
│    Guardian Dashboard    Architect Tools    Intent-Setter Interface          │
├──────────────────────────────────────────────────────────────────────────────┤
│                         PRESENTATION LAYER                                    │
│    CLI Interface    Web Dashboard    IDE Extensions    Slack Integration      │
├──────────────────────────────────────────────────────────────────────────────┤
│                       ORCHESTRATION LAYER (Tier 1: VP)                        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Token Budget   │  │ MCP Registry   │  │ Governance     │                  │
│  │ Management     │  │ & Discovery    │  │ (IPRE Pipeline)│                  │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Agent          │  │ Prompt         │  │ Hydra Config   │                  │
│  │ Observability  │  │ Security       │  │ Composition    │                  │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                  AGENT ORCHESTRATION LAYER (Tier 2: Session Managers)         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ CrewAI         │  │ LangGraph      │  │ AutoGen        │                  │
│  │ Orchestrator   │  │ Orchestrator   │  │ Orchestrator   │                  │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Agent Memory   │  │ Agent          │  │ JIT Tools      │                  │
│  │ (MemGPT-style) │  │ Delegation     │  │ Retrieval      │                  │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                     SERVICE LAYER (Tier 3: Sub-Agent Workers)                 │
│    Computer Setup   Project Templates   Analysis Engine   RAG Utils           │
│    AI Integration   Security           Environment       Agent Eval           │
├──────────────────────────────────────────────────────────────────────────────┤
│                           INFRASTRUCTURE LAYER                                │
│    File System   Git Worktrees   Process Management   MCP Servers   Network   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Request → CLI/Dashboard
                    ↓
            VP Supervisor (Tier 1)
            ├── Token Budget Check
            ├── Governance Validation
            └── Route to Session Manager
                    ↓
            Session Manager (Tier 2)
            ├── Context Loading (Agent Memory)
            ├── Tool Selection (JIT Tools + MCP Registry)
            └── Delegate to Sub-Agents
                    ↓
            Sub-Agent Workers (Tier 3)
            ├── Execute in Git Worktree
            ├── Use RAG for Context
            └── Report via Observability
                    ↓
            Results → Quality Gates → Session Manager → VP → User
```

### Technology Stack

- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript 5.2+
- **Build**: Turborepo + esbuild
- **CLI**: Commander.js
- **Web**: Next.js 15 + React 19
- **Testing**: Jest + Playwright
- **Package Manager**: pnpm (recommended)

## 🎯 Use Cases

### 1. New Team Member Onboarding

```bash
# Day 1: Set up developer machine
wundr computer-setup --profile fullstack --team platform

# Day 2: Create first project
wundr create frontend onboarding-app

# Ongoing: Maintain code quality
wundr analyze
wundr govern check
```

### 2. Starting a New Project

```bash
# Create project with best practices
wundr create monorepo my-platform

# Project includes:
# - TypeScript configuration
# - Testing setup
# - CI/CD pipelines
# - Governance baselines
# - AI integration
```

### 3. Maintaining Code Quality

```bash
# Regular quality checks
wundr analyze --watch
wundr govern drift
wundr dashboard

# CI/CD integration
wundr analyze --ci --fail-on-issues
```

## Documentation

### Getting Started

- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Development Guide](docs/DEVELOPMENT_GUIDE.md)
- [CLI Reference](packages/@wundr/cli/README.md)
- [Computer Setup Guide](packages/@wundr/computer-setup/README.md)

### Architecture & Design

- [Architecture Overview](docs/architecture/UNIFIED_PLATFORM_ARCHITECTURE.md)
- [Three-Tier Architecture Implementation Plan](docs/THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md)
- [Further Enhancements to Three-Tier Hierarchy](docs/FURTHER-ENHANCEMENTS-TO-THE-THREE-TIER-HIERARCHY-IMPLEMENTATION-PLAN.md)
- [Dynamic Context Compilation](docs/Dynamic_Context_Compilation_and_Hierarchical_Organization_Generation_for_AI_Agents.md)

### Package Documentation

- [Platform Completion Report](docs/PLATFORM_COMPLETION_REPORT.md)
- [Project Templates](packages/@wundr/project-templates/README.md)

## 📦 NPM Publishing

This project automatically publishes to npm under the `@wundr.io` scope.

### For End Users

Install packages from npm:

```bash
# Install CLI globally
npm install -g @wundr.io/cli

# Or use specific packages
npm install @wundr.io/core
npm install @wundr.io/analysis-engine
```

### For Maintainers

**Setup npm publishing** (one-time): See
[NPM Organization Setup Guide](docs/NPM-ORGANIZATION-SETUP.md) for detailed instructions.

Quick setup:

1. Create npm account and organization `@wundr.io`
2. Generate automation token
3. Add `NPM_TOKEN` secret to GitHub
4. Packages auto-publish on push to master

**Publishing workflows:**

- **Auto-publish (dev)**: Push to `master` → publishes `@wundr.io/cli@dev`
- **Stable release**: Create tag `v1.0.0` → publishes `@wundr.io/cli@latest`

See also:

- [NPM Setup Checklist](docs/NPM-SETUP-CHECKLIST.md) - Quick 5-step guide
- [NPM Organization Setup](docs/NPM-ORGANIZATION-SETUP.md) - Comprehensive guide

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run in development mode
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## 📊 Performance

Wundr is optimized for performance using Turborepo:

- **Parallel builds**: 2.8-4.4x faster builds
- **Smart caching**: 80% cache hit rate
- **Incremental builds**: Only rebuild what changed
- **Optimized pipelines**: Automatic task scheduling

## 🔒 Security

- All packages regularly updated
- Security scanning integrated
- Credential management built-in
- Audit logging for compliance

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with ❤️ by the Wundr team using:

- [Turborepo](https://turbo.build) for monorepo management
- [Commander.js](https://github.com/tj/commander.js) for CLI
- [Next.js](https://nextjs.org) for dashboard
- [TypeScript](https://www.typescriptlang.org) for type safety

---

<div align="center">
  <p>
    <strong>Transform your development workflow with Wundr</strong>
  </p>
  <p>
    From machine setup to code excellence - we've got you covered
  </p>
</div>
