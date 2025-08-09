# @adapticai/new-starter 🚀

> **Automated development environment setup for Node.js engineers with AI tools integration**

[![npm version](https://img.shields.io/npm/v/@adapticai/new-starter.svg)](https://www.npmjs.com/package/@adapticai/new-starter)
[![CI](https://github.com/adapticai/new-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/adapticai/new-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@adapticai/new-starter.svg)](https://nodejs.org)
[![codecov](https://codecov.io/gh/adapticai/new-starter/branch/main/graph/badge.svg)](https://codecov.io/gh/adapticai/new-starter)

Transform your machine into a professional Node.js development powerhouse with a single command. Complete with AI assistants, containerization, and all the tools modern engineers need.

## ✨ Features

- **🎯 One Command Setup** - Get fully configured in minutes, not hours
- **🤖 AI-Powered Development** - Claude Code & Claude Flow with swarm intelligence
- **🔧 Complete Toolchain** - Node.js, Docker, VS Code, and 50+ extensions
- **🔒 Security First** - Automatic permission fixes and secure configurations
- **📦 Package Managers** - npm, pnpm, yarn, nvm all configured
- **🎨 Code Quality** - ESLint, Prettier, TypeScript with strict mode
- **🚀 CI/CD Ready** - GitHub Actions, automated releases, semantic versioning
- **💻 Cross-Platform** - macOS and Linux support

## 📦 Installation

```bash
# Install globally (recommended)
npm install -g @adapticai/new-starter

# Or use npx without installing
npx @adapticai/new-starter
```

## 🚀 Quick Start

### Interactive Mode (Recommended for First Time)

```bash
# Run the interactive wizard
new-starter

# Or with npx
npx @adapticai/new-starter
```

### One-Line Setup

```bash
npx @adapticai/new-starter setup \
  --email "your.email@company.com" \
  --github-username "yourusername" \
  --name "Your Name" \
  --skip-prompts
```

### Custom Configuration

```bash
new-starter setup \
  --email "john.doe@company.com" \
  --github-username "johndoe" \
  --name "John Doe" \
  --company "Awesome Corp" \
  --root-dir "~/MyWorkspace" \
  --only "brew,node,docker,vscode,claude" \
  --verbose
```

### Fully Configured Example

```bash
  OPENAI_API_KEY="your-openai-key" \
  SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  SLACK_APP_TOKEN="xapp-your-app-token" \
  SLACK_USER_TOKEN="xoxp-your-user-token" \
  SLACK_SIGNING_SECRET="your-signing-secret" \
  SLACK_CHANNEL_ID="C1234567890" \
  SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  COMPANY_NAME="YourCompany" \
  PLATFORM_DESCRIPTION="Enterprise SaaS Platform" \
  SETUP_ROLE="Software Engineer" \
  new-starter setup \
    --email kirk@example.com \
    --github-username kirk \
    --github-email kirk@example.com \
    --name "Kirk" \
    --company "YourCompany" \
    --root-dir "$HOME/Development" \
    --skip-prompts \
    --verbose
```

## 🛠️ What Gets Installed

### Core Development Tools
- **Homebrew** - Package manager for macOS/Linux
- **Git** - Version control with advanced aliases
- **GitHub CLI** - GitHub operations from terminal
- **Docker Desktop** - Container platform
- **VS Code** - IDE with 50+ curated extensions

### Node.js Ecosystem
- **NVM** - Node Version Manager
- **Node.js** - v18, v20, v22 (default: v20)
- **Package Managers** - npm, pnpm, yarn
- **Global Packages** - TypeScript, ESLint, Prettier, and more

### AI Development Tools
- **Claude Code** - AI pair programming
- **Claude Flow** - Swarm intelligence orchestration
  - 8 specialized agents
  - 87 MCP tools
  - GitHub integration
  - Neural pattern recognition

### Collaboration Tools
- **Slack** - Team communication
- **GitHub Integration** - PR/Issue management

## 📋 Commands

### `setup` - Install Development Environment

```bash
new-starter setup [options]

Options:
  -e, --email <email>              Email address
  -u, --github-username <username> GitHub username  
  -n, --name <name>                Full name
  -c, --company <company>          Company name
  -r, --root-dir <dir>             Development root directory (default: ~/Development)
  -s, --skip-prompts               Skip all confirmations
  --only <tools>                   Install only specified tools
  --exclude <tools>                Exclude specified tools
  -v, --verbose                    Verbose output
```

### `validate` - Check Installation Status

```bash
new-starter validate [options]

Options:
  --fix    Attempt to fix issues automatically
```

### `config` - Manage Settings

```bash
new-starter config [options]

Options:
  --list            Show all settings
  --get <key>       Get a setting value
  --set <key=value> Set a setting value
  --reset           Reset to defaults
```

## 🔧 Configuration

Settings are stored in `~/.new-starter/config.json`:

```json
{
  "rootDir": "~/Development",
  "skipPrompts": false,
  "verbose": false,
  "tools": ["permissions", "brew", "node", "docker", "github", "vscode", "claude", "config"]
}
```

## 🏗️ Project Structure

```
new-starter/
├── src/              # TypeScript source code
│   ├── cli.ts       # CLI entry point
│   ├── commands/    # Command implementations
│   └── utils/       # Utility functions
├── scripts/         # Shell setup scripts
│   └── setup/       # Individual tool installers
├── config/          # Configuration templates
├── templates/       # Project templates
└── tests/          # Test suite
```

## 🧪 Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/adapticai/new-starter.git
cd new-starter

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

### Available Scripts

```bash
npm run build        # Build TypeScript
npm run dev          # Development mode with watch
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint code
npm run format       # Format with Prettier
npm run type-check   # TypeScript type checking
```

### Running the actual One Line Setup Command within the Development Environment

```bash
  OPENAI_API_KEY="your-openai-key" \
  SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  SLACK_APP_TOKEN="xapp-your-app-token" \
  SLACK_USER_TOKEN="xoxp-your-user-token" \
  SLACK_SIGNING_SECRET="your-signing-secret" \
  SLACK_CHANNEL_ID="C1234567890" \
  SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  COMPANY_NAME="YourCompany" \
  PLATFORM_DESCRIPTION="Enterprise SaaS Platform" \
  SETUP_ROLE="Software Engineer" \
  ./setup.sh \
    --email kirk@example.com \
    --github-username kirk \
    --github-email kirk@example.com \
    --name "Kirk" \
    --company "YourCompany" \
    --root-dir "$HOME/Development" \
    --skip-prompts \
    --verbose
```

## 🚦 CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **CI Pipeline** - Runs on every push and PR
  - Linting and formatting checks
  - TypeScript type checking
  - Unit and integration tests
  - Multi-OS testing (Ubuntu, macOS)
  - Node.js version matrix (18, 20, 22)

- **Release Pipeline** - Automated npm publishing
  - Changeset-based versioning
  - Automated changelog generation
  - npm package publishing
  - GitHub release creation

## 📝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Troubleshooting

### Permission Errors

If you encounter EACCES errors:

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### Command Not Found

After installation, restart your terminal or run:

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Docker Not Starting

- Open Docker Desktop manually
- Ensure virtualization is enabled in BIOS
- Check system requirements

### VS Code Extensions Not Installing

```bash
# List installed extensions
code --list-extensions

# Manually install an extension
code --install-extension <extension-id>
```

## 📚 Documentation

- [Setup Guide](docs/setup.md)
- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [API Reference](docs/api.md)

## 🔗 Related Projects

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - AI coding assistant
- [Claude Flow](https://github.com/ruvnet/claude-flow) - AI orchestration platform
- [adapticai/wundr](https://github.com/adapticai/wundr) - Monorepo refactoring tool

## 📄 License

MIT © [AdapticAI](https://github.com/adapticai)

## 🙏 Acknowledgments

- Anthropic for Claude AI
- ruvnet for Claude Flow
- The open source community

---

<p align="center">
  <b>Built with ❤️ for Node.js developers</b><br>
  <sub>Making development environment setup painless since 2024</sub>
</p>

<p align="center">
  <a href="https://github.com/adapticai/new-starter/issues">Report Bug</a> •
  <a href="https://github.com/adapticai/new-starter/issues">Request Feature</a> •
  <a href="https://github.com/adapticai/new-starter/discussions">Discussions</a>
</p>