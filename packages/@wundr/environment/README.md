# @wundr/environment

Cross-platform development environment setup and management tools for modern software development workflows.

## 🚀 Features

- **Multi-Platform Support**: macOS, Linux, Windows, and Docker
- **Profile-Based Setup**: Human developer, AI agent, and CI/CD runner profiles
- **Tool Management**: Automated installation and configuration of development tools
- **AI Agent Integration**: Claude Code, Claude Flow, and MCP tools support
- **Package Manager Support**: npm, pnpm, and yarn integration
- **Environment Validation**: Comprehensive health checks and validation
- **Docker Support**: Containerized development environments
- **CLI Interface**: Powerful command-line interface for environment management

## 📦 Installation

### As a Package

```bash
# Install globally
npm install -g @wundr/environment

# Or use with npx
npx @wundr/environment init
```

### From Source

```bash
# Clone the repository
git clone https://github.com/wundr/wundr.git
cd wundr/packages/@wundr/environment

# Install dependencies
pnpm install

# Build the package
pnpm run build

# Link globally for development
pnpm link --global
```

## 🎯 Quick Start

### Initialize a New Environment

```bash
# Human developer environment (default)
wundr-env init --profile human --email your@email.com --name "Your Name"

# AI agent environment
wundr-env init --profile ai-agent --email agent@company.com --name "AI Agent"

# CI/CD runner environment
wundr-env init --profile ci-runner --yes
```

### Install Environment Tools

```bash
# Install all configured tools
wundr-env install

# Force reinstall existing tools
wundr-env install --force
```

### Validate Environment

```bash
# Quick validation
wundr-env validate

# Detailed validation with verbose output
wundr-env validate --verbose
```

### Check Environment Status

```bash
# Show current environment status
wundr-env status

# List available profiles
wundr-env profiles
```

## 📋 Environment Profiles

### Human Developer Profile

Complete development environment for human developers:

- **Tools**: Node.js, Git, Docker, VS Code, Claude Code, GitHub CLI
- **Features**: Full IDE setup, extensions, AI assistance
- **Use Case**: Daily development work, coding, debugging

### AI Agent Profile

Optimized environment for AI agents and automation:

- **Tools**: Node.js, Git, Claude Code, Claude Flow, MCP tools
- **Features**: Swarm intelligence, neural patterns, automation
- **Use Case**: Autonomous code generation, AI-driven development

### CI/CD Runner Profile

Minimal environment for continuous integration:

- **Tools**: Node.js, Git, essential build tools
- **Features**: Fast builds, testing framework, minimal footprint
- **Use Case**: Automated builds, testing, deployment pipelines

## 🛠️ Platform Support

### macOS

```bash
# Automatic installation with Homebrew
./scripts/install/macos.sh
```

**Features:**
- Homebrew package management
- Xcode Command Line Tools integration
- Native app installations (VS Code, Docker Desktop)

### Linux

```bash
# Supports Ubuntu, Debian, Fedora, CentOS, Arch
./scripts/install/linux.sh
```

**Features:**
- Multiple distribution support
- Package manager detection (apt, dnf, yum, pacman)
- Homebrew for Linux support

### Windows

```powershell
# PowerShell script with Chocolatey and Winget
.\scripts\install\windows.ps1
```

**Features:**
- Chocolatey and Windows Package Manager
- WSL2 integration
- PowerShell profile configuration

### Docker

```bash
# Build and run containerized environments
docker-compose up human-dev    # Human developer environment
docker-compose up ai-agent     # AI agent environment
docker-compose up ci-runner    # CI/CD runner environment
```

## 🧠 AI Agent Integration

### Claude Code Integration

```bash
# Configure Claude Code with optimal settings
wundr-env update --profile ai-agent
```

**Features:**
- Automatic model selection (Claude Opus 4.1)
- Code generation optimization
- Integration with development workflow

### Claude Flow Orchestration

```bash
# Initialize swarm capabilities
claude-flow swarm init --agents 54
```

**Features:**
- 54-agent swarm topology
- Neural pattern recognition
- Distributed memory system
- Consensus protocols

### MCP Tools Support

```bash
# Available MCP tools
- claude-flow: Orchestration and swarm management
- wundr-toolkit: Quality and governance tools
- filesystem: File operations
- git: Version control operations
- docker: Container management
```

## 🔧 Configuration

### Environment Configuration

The environment configuration is stored in `~/.wundr/environment.json`:

```json
{
  "profile": "human",
  "platform": "macos",
  "tools": [...],
  "preferences": {
    "editor": "vscode",
    "shell": "zsh",
    "packageManager": "pnpm",
    "theme": "dark"
  },
  "paths": {
    "development": "/Users/username/Development",
    "config": "/Users/username/.wundr",
    "cache": "/Users/username/.wundr/cache"
  }
}
```

### Profile Templates

Profiles are defined in `templates/profiles/`:

- `human-developer.json`: Full development environment
- `ai-agent.json`: AI agent optimized setup
- `ci-runner.json`: Minimal CI/CD setup

### Tool Configuration

Tools are configured with dependencies, installers, and platform support:

```json
{
  "name": "vscode",
  "required": true,
  "installer": "brew",
  "platform": ["macos", "linux"],
  "config": {
    "extensions": ["ms-vscode.vscode-typescript-next"],
    "settings": {"editor.formatOnSave": true}
  }
}
```

## 🚢 Docker Environments

### Human Developer Container

```bash
# Start with VS Code Server
docker-compose up human-dev
# Access VS Code at http://localhost:8080
```

### AI Agent Container

```bash
# Start with Claude Flow orchestration
docker-compose up ai-agent
# Claude Flow API at http://localhost:3100
```

### Development with Docker

```bash
# Override for development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔍 Validation & Health Checks

### Environment Validation

```bash
# Comprehensive validation
wundr-env validate --verbose
```

**Checks:**
- Tool installation and versions
- Platform compatibility
- Dependency resolution
- Configuration integrity

### Quick Health Check

```bash
# Essential tools check
node --version && npm --version && git --version
```

### Automated Monitoring

- Health check endpoints in Docker containers
- Prometheus metrics collection
- Grafana dashboard visualization

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Test full environment setup
pnpm test:integration

# Test specific platform
PLATFORM=macos pnpm test:integration
```

### End-to-End Tests

```bash
# Test complete workflow
pnpm test:e2e
```

## 📚 API Reference

### EnvironmentManager

Main class for environment management:

```typescript
import { EnvironmentManager } from '@wundr/environment';

const manager = new EnvironmentManager();

// Initialize environment
await manager.initialize('human', {
  email: 'user@example.com',
  fullName: 'User Name'
});

// Install tools
await manager.installEnvironment();

// Validate setup
const health = await manager.validateEnvironment();
```

### ProfileManager

Manage environment profiles:

```typescript
import { ProfileManager } from '@wundr/environment';

const profiles = new ProfileManager();

// Get profile template
const template = await profiles.getProfileTemplate('ai-agent');

// Register custom profile
profiles.registerProfile(customProfile);
```

### ToolManager

Handle tool installation and validation:

```typescript
import { ToolManager } from '@wundr/environment';

const tools = new ToolManager();

// Install tool
await tools.installTool(toolConfig);

// Validate tool
const result = await tools.validateTool(toolConfig);
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/wundr/wundr.git
cd wundr/packages/@wundr/environment

# Install dependencies
pnpm install

# Start development
pnpm run dev

# Run tests
pnpm test

# Build package
pnpm run build
```

### Adding New Profiles

1. Create profile template in `templates/profiles/`
2. Add profile type to `src/types/index.ts`
3. Update `ProfileManager` with new profile
4. Add tests for the new profile
5. Update documentation

### Adding New Installers

1. Extend `BaseInstaller` class
2. Implement `install()` and `validate()` methods
3. Register installer in `ToolManager`
4. Add platform-specific logic
5. Add comprehensive tests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../../LICENSE) file for details.

## 🙏 Acknowledgments

- [Homebrew](https://brew.sh/) for macOS package management
- [Chocolatey](https://chocolatey.org/) for Windows package management
- [NodeSource](https://nodesource.com/) for Node.js distributions
- [Anthropic](https://anthropic.com/) for Claude AI integration
- All contributors and maintainers

---

Built with ❤️ by the Wundr team for the developer community.