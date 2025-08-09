# Configuration Guide

This guide explains how to configure new-starter and customize your development environment.

## Table of Contents

- [Configuration File](#configuration-file)
- [CLI Configuration](#cli-configuration)
- [Tool Configurations](#tool-configurations)
- [Environment Variables](#environment-variables)
- [Shell Profiles](#shell-profiles)
- [Templates](#templates)

## Configuration File

New-starter stores configuration in `~/.new-starter/config.json`.

### Default Configuration

```json
{
  "rootDir": "~/Development",
  "skipPrompts": false,
  "verbose": false,
  "tools": [
    "permissions",
    "brew",
    "node",
    "docker",
    "github",
    "vscode",
    "claude",
    "config"
  ]
}
```

### Managing Configuration

#### View Current Configuration

```bash
new-starter config --list
```

#### Get Specific Value

```bash
new-starter config --get rootDir
```

#### Set Configuration Value

```bash
# Set root directory
new-starter config --set rootDir=~/MyWorkspace

# Enable verbose mode
new-starter config --set verbose=true

# Set default tools
new-starter config --set tools='["brew","node","vscode"]'
```

#### Reset to Defaults

```bash
new-starter config --reset
```

## CLI Configuration

### Command-Line Options

All setup options can be configured via CLI flags:

```bash
new-starter setup \
  --email "user@example.com" \
  --github-username "username" \
  --github-email "git@example.com" \
  --name "Full Name" \
  --company "Company Name" \
  --root-dir "~/Development" \
  --skip-prompts \
  --verbose
```

### Environment File

Create `.env.new-starter` in your home directory:

```bash
# ~/.env.new-starter
SETUP_EMAIL="user@example.com"
SETUP_GITHUB_USERNAME="username"
SETUP_NAME="Full Name"
SETUP_COMPANY="Company Name"
SETUP_ROOT_DIR="~/Development"
SETUP_SKIP_PROMPTS=true
```

## Tool Configurations

### Node.js Configuration

#### NVM Settings

```bash
# ~/.nvmrc in project root
20.11.0
```

#### NPM Configuration

```bash
# View npm config
npm config list

# Set registry
npm config set registry https://registry.npmjs.org/

# Set author info
npm config set init-author-name "Your Name"
npm config set init-author-email "email@example.com"
npm config set init-license "MIT"
```

#### PNPM Configuration

```bash
# ~/.npmrc or project .npmrc
store-dir=~/.pnpm-store
auto-install-peers=true
strict-peer-dependencies=false
```

### Git Configuration

#### Global Git Config

```bash
# ~/.gitconfig
[user]
    name = Your Name
    email = email@example.com
    signingkey = XXXXXXXXX

[core]
    editor = code --wait
    excludesfile = ~/.gitignore_global

[init]
    defaultBranch = main

[pull]
    rebase = false

[push]
    autoSetupRemote = true
```

#### Git Aliases

```bash
[alias]
    st = status
    co = checkout
    br = branch
    cm = commit -m
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'
```

### VS Code Configuration

#### Settings Location

- **macOS**: `~/Library/Application Support/Code/User/settings.json`
- **Linux**: `~/.config/Code/User/settings.json`

#### Key Settings

```json
{
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', monospace",
  "editor.fontLigatures": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.fontSize": 14,
  "workbench.colorTheme": "GitHub Dark Default",
  "workbench.iconTheme": "material-icon-theme"
}
```

### Docker Configuration

#### Docker Desktop Settings

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": true,
  "features": {
    "buildkit": true
  }
}
```

#### Docker Compose Aliases

```bash
# ~/.zshrc or ~/.bashrc
alias dc='docker-compose'
alias dcup='docker-compose up'
alias dcupd='docker-compose up -d'
alias dcdown='docker-compose down'
```

### Claude Flow Configuration

#### Global Configuration

Located in `<root-dir>/.claude-flow/global-config.json`:

```json
{
  "version": "2.0.0-alpha",
  "global": {
    "defaultRootDir": "~/Development",
    "maxConcurrentAgents": 8,
    "memoryBackend": "sqlite",
    "enableHooks": true
  },
  "orchestrator": {
    "port": 3000,
    "daemon": false,
    "autoStart": true
  },
  "swarm": {
    "enabled": true,
    "queen": {
      "model": "claude-3-opus",
      "temperature": 0.7
    },
    "workers": {
      "count": 8,
      "types": {
        "architect": { "count": 1 },
        "coder": { "count": 3 },
        "tester": { "count": 2 }
      }
    }
  }
}
```

## Environment Variables

### System Environment

Set in `~/.zshrc` or `~/.bashrc`:

```bash
# Development root
export DEV_ROOT="$HOME/Development"

# Node.js
export NVM_DIR="$HOME/.nvm"
export NODE_ENV="development"

# npm
export PATH="$HOME/.npm-global/bin:$PATH"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Homebrew
export HOMEBREW_NO_ANALYTICS=1
export PATH="/opt/homebrew/bin:$PATH"  # Apple Silicon
export PATH="/usr/local/bin:$PATH"     # Intel

# Editor
export EDITOR="code --wait"
export VISUAL="code --wait"
```

### Project Environment

Create `.env` in project root:

```bash
# API Keys (never commit!)
API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:pass@localhost/db

# Development
DEBUG=true
LOG_LEVEL=debug
PORT=3000
```

## Shell Profiles

### Zsh Configuration

```bash
# ~/.zshrc

# Oh My Zsh
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git node npm docker docker-compose)

# Custom prompt
PROMPT='%F{cyan}%n@%m%f %F{yellow}%~%f %F{green}$(git_prompt_info)%f
$ '

# Auto-suggestions
source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh
```

### Bash Configuration

```bash
# ~/.bashrc

# Prompt
PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# History
HISTSIZE=10000
HISTFILESIZE=20000
HISTCONTROL=ignoreboth

# Completion
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
fi
```

## Templates

### Project Templates

Located in `scripts/templates/`:

#### Node.js Project

```json
// package.json template
{
  "name": "@company/project",
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  }
}
```

#### TypeScript Config

```json
// tsconfig.json template
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

#### ESLint Config

```javascript
// .eslintrc.js template
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error'
  }
};
```

### Docker Templates

Located in `templates/docker/`:

- `Dockerfile.node` - Node.js application
- `docker-compose.yml` - Development stack
- `.dockerignore` - Exclude patterns

### GitHub Templates

Located in `templates/github/`:

- `pull_request_template.md`
- `ISSUE_TEMPLATE/bug_report.md`
- `ISSUE_TEMPLATE/feature_request.md`

## Advanced Configuration

### Custom Setup Scripts

Create custom setup scripts in `~/.new-starter/scripts/`:

```bash
#!/bin/bash
# ~/.new-starter/scripts/custom-tool.sh

log() {
    echo "[CUSTOM] $1"
}

install_custom_tool() {
    log "Installing custom tool..."
    # Your installation logic here
}

main() {
    install_custom_tool
}

main
```

### Hooks

Create pre/post setup hooks:

```bash
# ~/.new-starter/hooks/pre-setup.sh
echo "Running pre-setup tasks..."

# ~/.new-starter/hooks/post-setup.sh
echo "Running post-setup cleanup..."
```

## Profiles

Save different configurations as profiles:

```bash
# Save current config as profile
cp ~/.new-starter/config.json ~/.new-starter/profiles/work.json

# Load profile
cp ~/.new-starter/profiles/personal.json ~/.new-starter/config.json
```

## Backup and Restore

### Backup Configuration

```bash
# Backup all configs
tar -czf new-starter-backup.tar.gz \
  ~/.new-starter \
  ~/.gitconfig \
  ~/.zshrc \
  ~/.npmrc
```

### Restore Configuration

```bash
# Restore from backup
tar -xzf new-starter-backup.tar.gz -C ~/
```

## Security Considerations

### Sensitive Data

Never store sensitive data in:
- Git repositories
- Shell profiles
- Global configurations

Instead use:
- Environment variables
- Secret management tools
- `.env` files (git-ignored)

### File Permissions

```bash
# Secure config files
chmod 600 ~/.new-starter/config.json
chmod 600 ~/.ssh/config
chmod 700 ~/.ssh
```

## Troubleshooting Configuration

### Config Not Loading

```bash
# Check config location
ls -la ~/.new-starter/

# Validate JSON
cat ~/.new-starter/config.json | jq .

# Reset if corrupted
new-starter config --reset
```

### Path Issues

```bash
# Verify PATH
echo $PATH

# Reload shell config
source ~/.zshrc  # or ~/.bashrc
```

## Related Documentation

- [Setup Guide](./setup.md) - Initial setup process
- [Troubleshooting](./troubleshooting.md) - Common issues
- [API Reference](./api.md) - Programmatic usage