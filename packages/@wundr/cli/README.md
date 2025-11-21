# @wundr.io/cli

[![npm version](https://badge.fury.io/js/@wundr.io%2Fcli.svg)](https://www.npmjs.com/package/@wundr.io/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

**From chaos to excellence, systematically.**

The Wundr CLI is the unified command-line interface for the Wundr platform - your all-in-one toolkit
for developer machine provisioning, project scaffolding, and automated code governance. Built for
engineering teams who demand consistency, quality, and velocity.

## What is Wundr CLI?

Wundr CLI is the **crown jewel** of the Wundr platform - a powerful, AI-native developer toolkit
that transforms how teams:

- **Provision Machines**: Set up new developer workstations in minutes with role-based profiles
- **Create Projects**: Scaffold production-ready, governance-compliant projects instantly
- **Enforce Quality**: Automate code analysis, dependency management, and quality gates
- **Scale Teams**: Ensure consistency across developers, projects, and repositories

Whether you're onboarding new engineers, starting a new project, or maintaining code quality across
a monorepo, Wundr CLI provides the automation and intelligence you need.

## Core Features

### 1. Computer Setup & Provisioning

Automate the setup of developer workstations with comprehensive tool installations and
configurations.

**Key Capabilities:**

- 6 pre-configured developer profiles (Frontend, Backend, Full Stack, DevOps, ML, Mobile)
- Cross-platform support (macOS, Linux, Windows WSL2)
- Team configuration management
- Parallel installation with rollback support
- Validation and health checks

**Example:**

```bash
# Interactive setup wizard
wundr computer-setup

# Setup with specific profile
wundr computer-setup --profile fullstack

# Apply team configuration
wundr computer-setup --team platform-engineering

# Validate current setup
wundr computer-setup validate
```

### 2. Project Creation & Scaffolding

Create production-ready, Wundr-compliant projects with best practices built-in.

**Key Capabilities:**

- Multiple project templates (Next.js, Node.js, React, TypeScript libraries)
- Component and service generators
- Automatic governance configuration
- Monorepo support
- Custom template system

**Example:**

```bash
# Interactive project creation
wundr create project

# Create with specific template
wundr create project nextjs my-app --typescript

# Create component
wundr create component Button --type react

# Create service
wundr create service auth --template microservice
```

### 3. Code Governance & Quality

Automated code analysis, dependency management, and quality enforcement.

**Key Capabilities:**

- Dependency analysis (circular, unused, outdated, security)
- Code quality metrics and drift detection
- Automated pattern standardization
- Compliance reporting
- Real-time monitoring

**Example:**

```bash
# Analyze dependencies
wundr analyze deps --circular --security

# Check code quality
wundr analyze quality --path ./src

# Detect code drift
wundr analyze drift

# Generate compliance report
wundr govern report --weekly
```

## Quick Start

### Installation

Install globally via npm:

```bash
npm install -g @wundr.io/cli
```

Or use with npx (no installation required):

```bash
npx @wundr.io/cli --help
```

### First Command

Run the interactive wizard to get started:

```bash
wundr wizard
```

Or set up your development machine:

```bash
wundr computer-setup
```

### Verify Installation

```bash
wundr --version
wundr --help
```

## Core Commands

### Setup Commands

Configure development environments and workstations.

```bash
# Computer provisioning
wundr computer-setup [options]          # Interactive setup wizard
wundr computer-setup --profile <role>   # Setup with specific profile
wundr computer-setup --team <name>      # Apply team configuration
wundr computer-setup validate           # Validate current setup
wundr computer-setup doctor             # Diagnose issues

# Profile management
wundr computer-setup profile list       # List available profiles
wundr computer-setup profile show       # Show profile details
wundr computer-setup profile export     # Export current setup
wundr computer-setup profile import     # Import custom profile

# Claude Code integration
wundr claude-setup                      # Setup Claude Code optimization
wundr claude-init                       # Initialize Claude configuration
```

### Create Commands

Generate projects, components, and services.

```bash
# Project creation
wundr create project <type> [name]      # Create new project
wundr create project nextjs my-app      # Create Next.js project
wundr create project node-api server    # Create Node.js API

# Component generation
wundr create component <name>           # Create component
wundr create component Button --react   # Create React component
wundr create component --type vue       # Create Vue component

# Service generation
wundr create service <name>             # Create service
wundr create service auth               # Create auth service
wundr create service --template api     # Create from template

# Template management
wundr create template <name>            # Create custom template
wundr create from-template <template>   # Create from template
```

### Analyze Commands

Code analysis and dependency management.

```bash
# Dependency analysis
wundr analyze deps                      # Analyze all dependencies
wundr analyze deps --circular           # Find circular dependencies
wundr analyze deps --unused             # Find unused dependencies
wundr analyze deps --outdated           # Check for outdated packages
wundr analyze deps --security           # Run security audit

# Code quality analysis
wundr analyze quality                   # Analyze code quality
wundr analyze quality --path ./src      # Analyze specific path
wundr analyze quality --threshold 80    # Set quality threshold

# Performance analysis
wundr analyze performance               # Analyze performance
wundr analyze bundle                    # Analyze bundle size
wundr analyze metrics                   # Show code metrics

# Drift detection
wundr analyze drift                     # Detect code drift
wundr analyze drift --baseline          # Create drift baseline
wundr analyze drift --trends            # Show drift trends
```

### Govern Commands

Governance, compliance, and quality enforcement.

```bash
# Policy management
wundr govern policy list                # List policies
wundr govern policy apply <policy>      # Apply policy
wundr govern policy validate            # Validate against policies

# Compliance reporting
wundr govern report                     # Generate compliance report
wundr govern report --weekly            # Generate weekly report
wundr govern report --format json       # Export as JSON

# Pattern standardization
wundr govern standardize                # Auto-fix code patterns
wundr govern standardize --pattern      # Fix specific pattern
wundr govern standardize --review       # Review changes

# Quality gates
wundr govern gate check                 # Check quality gates
wundr govern gate enforce               # Enforce quality gates
wundr govern gate status                # Show gate status
```

### Init Commands

Project initialization and configuration.

```bash
# Project initialization
wundr init project [name]               # Initialize new project
wundr init project --template <type>    # Use specific template
wundr init project --monorepo           # Initialize as monorepo

# Configuration
wundr init config                       # Initialize configuration
wundr init config --interactive         # Interactive setup
wundr init config --global              # Global configuration

# Workspace setup
wundr init workspace                    # Create workspace
wundr init plugins                      # Setup plugin system
```

### AI Commands

AI-powered development features.

```bash
# Setup & configuration
wundr ai setup                          # Interactive AI setup
wundr ai status                         # Check AI status
wundr ai validate                       # Validate AI connection

# Code generation
wundr ai generate <type>                # Generate code
wundr ai generate component             # Generate component
wundr ai generate function --prompt     # Generate from prompt

# Code assistance
wundr ai review <file>                  # AI code review
wundr ai refactor <target>              # Refactor code
wundr ai optimize <target>              # Optimize performance

# Documentation & tests
wundr ai docs <target>                  # Generate docs
wundr ai test <target>                  # Generate tests
wundr ai analyze <target>               # AI analysis

# Interactive chat
wundr ai chat                           # Start AI chat
```

### Dashboard Commands

Monitoring and visualization.

```bash
# Dashboard control
wundr dashboard start                   # Launch web dashboard
wundr dashboard start --port 3000       # Specify port
wundr dashboard stop                    # Stop dashboard

# Configuration
wundr dashboard config                  # Configure dashboard
wundr dashboard config set theme dark   # Set theme

# Reports
wundr dashboard report <type>           # Generate report
```

### Watch Commands

Real-time monitoring and automation.

```bash
# File watching
wundr watch start [patterns]            # Watch files
wundr watch test                        # Watch and run tests
wundr watch build                       # Watch and build
wundr watch lint                        # Watch and lint

# Analysis watching
wundr watch analyze --type quality      # Watch quality
```

### Batch Commands

Batch operations and automation.

```bash
# Batch processing
wundr batch run <file>                  # Execute batch job
wundr batch create <name>               # Create batch job
wundr batch validate <file>             # Validate batch YAML
wundr batch schedule <file>             # Schedule execution
```

### Chat Commands

Natural language interface.

```bash
# Chat interaction
wundr chat start                        # Start chat session
wundr chat ask <message>                # Single question
wundr chat file <file>                  # Chat about file
wundr chat resume <sessionId>           # Resume session
```

### Plugin Commands

Plugin management and development.

```bash
# Plugin management
wundr plugin list                       # List installed plugins
wundr plugin install <plugin>           # Install plugin
wundr plugin create <name>              # Create new plugin
wundr plugin dev link <path>            # Link for development
```

## Interactive Modes

### Wizard Mode

Guided interactive setup for common tasks.

```bash
# Launch wizard
wundr wizard

# Specific wizard mode
wundr wizard --mode setup     # Setup wizard
wundr wizard --mode analyze   # Analysis wizard
wundr wizard --mode create    # Creation wizard
```

### Chat Interface

Natural language command interface (AI-powered).

```bash
# Launch chat
wundr chat

# Chat with specific context
wundr chat --context ./src

# Chat with specific model
wundr chat --model claude-3
```

### Terminal UI (TUI)

Full-featured terminal dashboard.

```bash
# Launch TUI
wundr tui

# Specific layout
wundr tui --layout dashboard    # Dashboard view
wundr tui --layout monitor      # Monitoring view
wundr tui --layout debug        # Debug view
```

## AI Integration

Wundr CLI is **AI-native** with deep integration for intelligent automation:

### Claude Code Optimization

Optimize your development environment for Claude Code AI assistant.

```bash
# Setup Claude Code
wundr claude-setup

# Initialize Claude configuration
wundr claude-init

# Generate CLAUDE.md configuration
wundr claude-init --generate
```

### AI Provider Setup

Wundr supports multiple AI providers for enhanced development assistance:

```bash
# Interactive setup (recommended)
wundr ai setup

# Manual setup with Claude
wundr ai setup --provider claude --api-key your-key

# Validate configuration
wundr ai validate

# Check status
wundr ai status
```

### Environment Variables

```bash
# Claude (Anthropic)
export CLAUDE_API_KEY=your_api_key_here

# OpenAI (coming soon)
export OPENAI_API_KEY=your_api_key_here

# Provider selection
export WUNDR_AI_PROVIDER=claude
export WUNDR_AI_MODEL=claude-3-opus-20240229
```

### AI-Powered Features

- **Smart Code Analysis**: AI-driven code quality insights
- **Intelligent Refactoring**: Context-aware code improvements
- **Auto-Documentation**: Generate documentation from code
- **Test Generation**: AI-generated test suites
- **Code Review**: Automated AI code reviews
- **Performance Optimization**: AI-powered performance suggestions

## Example Workflows

### Onboarding a New Developer

```bash
# 1. Setup development machine
wundr computer-setup --profile fullstack

# 2. Validate installation
wundr computer-setup validate

# 3. Clone and initialize project
git clone <repo>
cd <project>
wundr init config

# 4. Verify everything works
wundr govern gate check
```

### Starting a New Project

```bash
# 1. Create project
wundr create project nextjs my-startup-app

# 2. Navigate to project
cd my-startup-app

# 3. Initialize governance
wundr init config --interactive

# 4. Create initial components
wundr create component Hero
wundr create component Layout

# 5. Run quality check
wundr analyze quality
```

### Maintaining Code Quality

```bash
# 1. Check for drift
wundr analyze drift

# 2. Analyze dependencies
wundr analyze deps --circular --unused --security

# 3. Run quality analysis
wundr analyze quality --threshold 80

# 4. Auto-standardize patterns
wundr govern standardize

# 5. Generate compliance report
wundr govern report --weekly
```

### Team Configuration

```bash
# 1. Export your setup
wundr computer-setup profile export > team-setup.json

# 2. Share with team

# 3. Team members import
wundr computer-setup profile import team-setup.json

# 4. Apply team configuration
wundr computer-setup --team engineering
```

## Configuration

### Global Configuration

Create a global configuration file at `~/.wundr/config.json`:

```json
{
  "defaultProfile": "fullstack",
  "teamConfig": "platform-engineering",
  "ai": {
    "provider": "claude",
    "model": "claude-3-opus-20240229",
    "enabled": true
  },
  "governance": {
    "enforceGates": true,
    "autoStandardize": true
  },
  "dashboard": {
    "port": 3000,
    "theme": "dark"
  },
  "plugins": ["@wundr/plugin-git"],
  "integrations": {
    "github": {
      "token": "your-token",
      "owner": "your-org"
    }
  }
}
```

### Project Configuration

Create a project configuration file at `.wundr/config.json` or `wundr.config.json`:

```json
{
  "version": "1.0",
  "project": {
    "name": "my-project",
    "type": "nextjs",
    "framework": "react"
  },
  "analysis": {
    "patterns": ["**/*.ts", "**/*.tsx"],
    "excludes": ["**/node_modules/**"],
    "thresholds": {
      "quality": 80,
      "coverage": 75,
      "complexity": 10
    }
  },
  "governance": {
    "policies": ["security", "quality", "performance"],
    "rules": ["no-console", "require-tests"],
    "severity": "warning",
    "gates": {
      "preCommit": ["quality", "lint", "test"],
      "preMerge": ["coverage", "security", "review"]
    }
  }
}
```

### Environment Variables

```bash
# Configuration
WUNDR_CONFIG_PATH=~/.wundr/config.json
WUNDR_PROFILE=fullstack
WUNDR_TEAM=platform-engineering

# AI Configuration
WUNDR_AI_ENABLED=true
WUNDR_AI_PROVIDER=claude
WUNDR_AI_MODEL=claude-3-opus-20240229
CLAUDE_API_KEY=your_api_key_here

# Dashboard
WUNDR_DASHBOARD_PORT=3000
WUNDR_DASHBOARD_HOST=localhost

# Logging
WUNDR_LOG_LEVEL=info
WUNDR_LOG_FILE=~/.wundr/logs/wundr.log
```

## Plugin System

Extend Wundr CLI with custom plugins.

### Installing Plugins

```bash
# Install plugin
wundr plugin install @wundr/plugin-docker

# Install from npm
wundr plugin install my-custom-plugin

# Install from git
wundr plugin install git+https://github.com/user/plugin.git

# List plugins
wundr plugin list

# Remove plugin
wundr plugin uninstall @wundr/plugin-docker
```

### Creating Plugins

Create a new plugin:

```bash
wundr plugin create my-awesome-plugin --interactive
cd my-awesome-plugin
npm install
wundr plugin dev link .
```

Plugin structure:

```typescript
import { Plugin, PluginContext } from '@wundr.io/cli';

export default class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My awesome plugin';

  async activate(context: PluginContext): Promise<void> {
    context.registerCommand({
      name: 'my-command',
      description: 'My custom command',
      action: async (args, options, ctx) => {
        ctx.logger.info('Plugin command executed!');
      },
    });
  }

  async deactivate(): Promise<void> {
    // Cleanup
  }
}
```

## Batch Processing

### YAML Batch Jobs

Create `build-pipeline.yaml`:

```yaml
name: build-and-test
description: Complete build and test pipeline
parallel: false
continueOnError: false

commands:
  - command: 'npm install'
    retry: 2

  - command: 'npm run lint'
    condition: 'typescript-files'

  - command: 'npm run test'
    timeout: 300000

  - command: 'npm run build'

  - command: 'npm run deploy'
    condition: 'production'
```

Execute batch job:

```bash
wundr batch run build-pipeline.yaml
wundr batch run build-pipeline.yaml --dry-run
wundr batch run build-pipeline.yaml --vars '{"NODE_ENV": "production"}'
```

## Related Packages

Wundr CLI integrates with the entire Wundr ecosystem:

- **[@wundr.io/computer-setup](../computer-setup)** - Developer machine provisioning (integrated)
- **[@wundr.io/core](../core)** - Core utilities and shared functionality
- **[@wundr.io/config](../config)** - Configuration management system
- **[@wundr.io/analysis-engine](../analysis-engine)** - Code analysis and metrics
- **[@wundr.io/project-templates](../project-templates)** - Project scaffolding templates
- **[@wundr.io/dashboard](../dashboard)** - Web dashboard and visualization
- **[@wundr.io/security](../security)** - Security scanning and compliance
- **[@wundr.io/environment](../environment)** - Environment management utilities

## Documentation

- **[Full Documentation](../docs)** - Comprehensive guides and API reference
- **[Computer Setup Guide](../computer-setup/README.md)** - Developer provisioning details
- **[Configuration Guide](../docs/configuration.md)** - Configuration options
- **[Plugin Development](../docs/plugins.md)** - Creating custom plugins
- **[API Reference](../docs/api.md)** - CLI API documentation
- **[Examples](../docs/examples)** - Real-world usage examples

## Global Options

Available for all commands:

```bash
--config <path>          # Specify config file path
--verbose                # Enable verbose logging
--quiet                  # Suppress output
--no-color               # Disable colored output
--dry-run                # Show what would be done without executing
--interactive            # Force interactive mode
-v, --version            # Display version number
-h, --help               # Display help for command
```

## Advanced Usage

### Monorepo Support

Full support for monorepo architectures:

```bash
# Initialize monorepo
wundr init project --monorepo

# Analyze monorepo
wundr analyze deps --monorepo

# Create package
wundr create package <name>
```

### CI/CD Integration

Use Wundr CLI in your CI/CD pipelines:

```yaml
# .github/workflows/quality.yml
- name: Quality Check
  run: |
    npx @wundr.io/cli analyze quality --threshold 80
    npx @wundr.io/cli govern gate check
    npx @wundr.io/cli analyze deps --security
```

### Custom Profiles

Create custom developer profiles:

```bash
# Create custom profile
wundr computer-setup profile create

# Edit profile
wundr computer-setup profile edit my-profile

# Share profile
wundr computer-setup profile export my-profile > my-profile.json
```

## Troubleshooting

### Common Issues

**Command not found:**

```bash
# Ensure installation
npm list -g @wundr.io/cli

# Reinstall if needed
npm install -g @wundr.io/cli
```

**Permission errors:**

```bash
# Use npx instead
npx @wundr.io/cli <command>

# Or configure npm global
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

**AI features not working:**

```bash
# Check AI status
wundr ai status

# Validate connection
wundr ai validate

# Re-run setup
wundr ai setup --validate
```

**Configuration issues:**

```bash
# Reset configuration
wundr init config --reset

# Validate configuration
wundr init config --validate
```

### Debug Mode

```bash
# Verbose logging
wundr --verbose <command>

# Debug TUI
wundr tui --layout debug

# Environment debug
DEBUG=wundr:* wundr <command>
```

### Getting Help

```bash
# General help
wundr --help

# Command-specific help
wundr computer-setup --help
wundr create --help
wundr analyze --help

# Diagnostic mode
wundr computer-setup doctor
```

## Performance

Wundr CLI is optimized for speed and efficiency:

- **Parallel Execution**: Multiple operations run concurrently
- **Smart Caching**: Intelligent caching reduces redundant work
- **Incremental Analysis**: Only analyze changed files
- **Lazy Loading**: Plugins loaded on-demand
- **Minimal Dependencies**: Lean core with optional extensions

## Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0 (or pnpm/yarn)
- **Git**: >= 2.0.0 (for project creation)
- **Disk Space**: 500MB minimum (for full setup)
- **Network**: Required for package installation and AI features

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md).

### Development Setup

```bash
# Clone repository
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/cli

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Link for local development
npm link
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

MIT - See [LICENSE](../../../LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/adapticai/wundr/issues)
- **Documentation**: [https://wundr.io/docs](https://wundr.io)
- **Community**: [Discord](https://discord.gg/wundr)
- **Email**: support@wundr.io

---

**Built by [Adaptic.ai](https://adaptic.ai)** - Transforming how teams build software.

_From chaos to excellence, systematically._
