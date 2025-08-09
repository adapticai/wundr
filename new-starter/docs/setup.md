# Setup Guide

This guide will walk you through setting up your development environment using new-starter.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Setup Process](#setup-process)
- [Tool Selection](#tool-selection)
- [Post-Setup Steps](#post-setup-steps)
- [Verification](#verification)

## Prerequisites

Before running new-starter, ensure you have:

- **Operating System**: macOS (10.15+) or Ubuntu Linux (20.04+)
- **Node.js**: Version 18 or higher (will be installed if missing)
- **Internet Connection**: Required for downloading tools
- **Admin Access**: Some installations require sudo privileges
- **Terminal Access**: Basic command-line knowledge

## Installation Methods

### Method 1: NPM Global Install (Recommended)

```bash
npm install -g @adapticai/new-starter
new-starter setup
```

### Method 2: NPX (No Install)

```bash
npx @adapticai/new-starter setup
```

### Method 3: Clone Repository

```bash
git clone https://github.com/adapticai/new-starter.git
cd new-starter
npm install
npm run build
npm run setup:local
```

## Setup Process

### Interactive Setup

The easiest way to get started:

```bash
new-starter
```

This launches an interactive wizard that will:
1. Prompt for your information
2. Let you select tools to install
3. Configure everything automatically

### Non-Interactive Setup

For automated deployments:

```bash
new-starter setup \
  --email "john.doe@company.com" \
  --github-username "johndoe" \
  --name "John Doe" \
  --company "Awesome Corp" \
  --root-dir "~/Development" \
  --skip-prompts
```

### Custom Root Directory

By default, development tools are installed in `~/Development`. To customize:

```bash
new-starter setup --root-dir "~/MyWorkspace"
```

This will create:
- `~/MyWorkspace/projects/` - Your project directories
- `~/MyWorkspace/tools/` - Development tools
- `~/MyWorkspace/sandbox/` - Experimental work
- `~/MyWorkspace/.config/` - Configuration files
- `~/MyWorkspace/.claude-flow/` - AI tool configurations

## Tool Selection

### Install Specific Tools Only

```bash
new-starter setup --only "brew,node,docker,vscode"
```

Available tools:
- `permissions` - Fix file permissions (always runs first)
- `brew` - Homebrew package manager
- `node` - Node.js, npm, pnpm, yarn via NVM
- `docker` - Docker Desktop
- `github` - Git configuration and GitHub CLI
- `vscode` - VS Code with extensions
- `slack` - Slack desktop app
- `claude` - Claude Code and Claude Flow
- `config` - Development configurations (ESLint, Prettier, etc.)

### Exclude Specific Tools

```bash
new-starter setup --exclude "slack,docker"
```

## Tool Details

### Homebrew
- Package manager for macOS/Linux
- Installs: git, curl, wget, jq, ripgrep, fzf, and more
- Configures: shell aliases and paths

### Node.js Environment
- **NVM**: Node Version Manager
- **Node.js**: Versions 18, 20, 22 (default: 20)
- **Package Managers**: npm, pnpm, yarn
- **Global Packages**:
  - TypeScript, tsx, ts-node
  - ESLint, Prettier, Biome
  - Turbo, Nx, Lerna
  - PM2, nodemon, concurrently

### Docker
- Docker Desktop installation
- Docker Compose
- Development tools: dive, lazydocker, ctop
- Template configurations
- Shell aliases for common commands

### Git & GitHub
- Git configuration with aliases
- GitHub CLI (gh)
- SSH key generation
- GPG key setup for commit signing
- Global .gitignore
- PR and issue templates

### VS Code
- Installation with CLI tools
- 50+ curated extensions:
  - Language support (TypeScript, React, etc.)
  - Linting and formatting
  - Git integration (GitLens)
  - AI assistants (Copilot)
  - Testing tools
  - Themes and icons
- Custom settings and keybindings

### Claude AI Tools
- **Claude Code**: AI pair programming
- **Claude Flow**: Advanced orchestration
  - Hive-mind intelligence
  - 8 specialized agents
  - 87 MCP tools
  - GitHub integration
- Global configuration in root directory

### Development Config
- ESLint configuration
- Prettier settings
- TypeScript configs
- Jest testing setup
- Husky git hooks
- EditorConfig

## Post-Setup Steps

### 1. Restart Terminal

```bash
# macOS
source ~/.zshrc

# Linux
source ~/.bashrc
```

### 2. Authenticate Services

#### GitHub
```bash
gh auth login
```

#### Claude
```bash
claude
```

#### SSH Key
```bash
# Add to GitHub
gh ssh-key add ~/.ssh/id_ed25519.pub

# Test connection
ssh -T git@github.com
```

### 3. Verify Installation

```bash
new-starter validate
```

This checks all installed tools and reports their status.

### 4. Fix Issues

If validation finds problems:

```bash
new-starter validate --fix
```

## Environment Variables

The following are set in your shell profile:

```bash
# NVM
export NVM_DIR="$HOME/.nvm"

# npm global packages
export PATH="$HOME/.npm-global/bin:$PATH"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Homebrew
export HOMEBREW_NO_ANALYTICS=1

# Development root
export DEV_ROOT="$HOME/Development"  # Or your custom path
```

## Shell Aliases

Useful aliases added to your shell:

### Git
- `git st` - status
- `git co` - checkout
- `git br` - branch
- `git cm` - commit with message
- `git lg` - pretty log graph
- `git sync` - fetch and pull
- `git undo` - undo last commit

### Node.js
- `ni` - npm install
- `nr` - npm run
- `ns` - npm start
- `nt` - npm test
- `nb` - npm build

### Docker
- `dps` - docker ps
- `di` - docker images
- `dex` - docker exec -it
- `dcp` - docker-compose up
- `dcd` - docker-compose down

### Claude Flow
- `clf` - claude-flow
- `swarm` - Run swarm task
- `hive-mind` - Spawn hive mind

## Troubleshooting During Setup

### Permission Denied

If you see permission errors:

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### Homebrew Installation Fails

On macOS with Apple Silicon:

```bash
# Install Rosetta 2
softwareupdate --install-rosetta --agree-to-license

# Retry Homebrew installation
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Docker Not Starting

1. Open Docker Desktop manually
2. Check virtualization is enabled in BIOS
3. On Mac, ensure you have enough disk space

### Node Version Issues

```bash
# List installed versions
nvm list

# Install specific version
nvm install 20

# Set default
nvm alias default 20
nvm use default
```

## Advanced Configuration

### Custom Setup Script

Create `.new-starter.json` in your home directory:

```json
{
  "email": "your.email@company.com",
  "githubUsername": "yourusername",
  "name": "Your Name",
  "company": "Your Company",
  "rootDir": "~/CustomDev",
  "tools": ["brew", "node", "docker", "vscode", "claude"],
  "skipPrompts": true
}
```

Then run:

```bash
new-starter setup
```

### Enterprise Proxy

For corporate environments:

```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1

new-starter setup
```

## Getting Help

- **Documentation**: [GitHub Repository](https://github.com/adapticai/new-starter)
- **Issues**: [Report bugs](https://github.com/adapticai/new-starter/issues)
- **Discussions**: [Community forum](https://github.com/adapticai/new-starter/discussions)

## Next Steps

After successful setup:

1. Create your first project:
   ```bash
   cd ~/Development/projects
   npx create-next-app my-app
   ```

2. Start Claude for AI assistance:
   ```bash
   claude
   ```

3. Initialize Claude Flow for a project:
   ```bash
   cd my-app
   claude-flow init
   ```

Happy coding! 🚀