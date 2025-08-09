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
    <img src="https://img.shields.io/npm/v/@wundr/cli?style=flat-square" alt="npm version">
    <img src="https://img.shields.io/github/license/adapticai/wundr?style=flat-square" alt="License">
    <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square" alt="Node Version">
    <img src="https://img.shields.io/badge/TypeScript-5.2+-blue?style=flat-square" alt="TypeScript">
    <img src="https://img.shields.io/badge/Turborepo-Optimized-purple?style=flat-square" alt="Turborepo">
  </p>

</div>

---

## 🎯 What is Wundr?

Wundr is a comprehensive unified developer platform that provides three distinct but complementary features to support the entire developer lifecycle:

1. **🖥️ Computer Setup** - Automated developer machine provisioning with global tools and configurations
2. **🏗️ Project Creation** - Scaffold new projects with Wundr-compliant best practices built-in
3. **📊 Code Governance** - Analyze and improve existing codebases with AI-powered insights

Each feature serves a specific purpose in the development workflow, from initial machine setup through project creation to ongoing code quality management.

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
- ✅ AI development tools (Claude Code, Claude Flow)

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

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g @wundr/cli

# Or use with npx
npx @wundr/cli --help
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

## 📦 Monorepo Structure

Wundr is built as a monorepo using Turborepo for optimized builds and caching:

```
packages/
├── @wundr/core              # Shared utilities and event bus
├── @wundr/config            # Configuration management
├── @wundr/plugin-system     # Plugin lifecycle management
├── @wundr/computer-setup    # Machine provisioning system
├── @wundr/project-templates # Project scaffolding templates
├── @wundr/cli               # Unified command interface
├── @wundr/analysis-engine   # Code analysis capabilities
├── @wundr/dashboard         # Web dashboard interface
├── @wundr/ai-integration    # AI and Claude Flow integration
├── @wundr/security          # Security scanning and compliance
├── @wundr/environment       # Environment management
└── @wundr/docs              # Documentation site
```

## 💻 Command Reference

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

## 🏗️ Architecture

Wundr is built with a modular, event-driven architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                        │
│  CLI Interface    Web Dashboard    IDE Extensions            │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Layer                        │
│  Event Bus       Plugin System      Configuration            │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                            │
│  Computer Setup   Project Templates   Analysis Engine        │
│  AI Integration   Governance          Security              │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  File System      Process Management   Network              │
└─────────────────────────────────────────────────────────────┘
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

## 📚 Documentation

- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Architecture Overview](docs/architecture/UNIFIED_PLATFORM_ARCHITECTURE.md)
- [Platform Completion Report](docs/PLATFORM_COMPLETION_REPORT.md)
- [Development Guide](docs/DEVELOPMENT_GUIDE.md)
- [CLI Reference](packages/@wundr/cli/README.md)
- [Computer Setup Guide](packages/@wundr/computer-setup/README.md)
- [Project Templates](packages/@wundr/project-templates/README.md)

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