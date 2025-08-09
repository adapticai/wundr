# Installation

Get started with Wundr by installing it in your project or globally on your system.

## Prerequisites

Before installing Wundr, ensure you have:

- **Node.js** version 16 or higher
- **npm** version 7+ or **pnpm** version 6+
- **Git** (for repository analysis features)

## Installation Options

### Global Installation (Recommended)

Install Wundr globally to use it across all your projects:

```bash
npm install -g @wundr/cli
# or
pnpm add -g @wundr/cli
# or
yarn global add @wundr/cli
```

Verify the installation:

```bash
wundr --version
```

### Project-Specific Installation

Install Wundr as a development dependency in your project:

```bash
npm install --save-dev @wundr/cli
# or
pnpm add -D @wundr/cli
# or
yarn add -D @wundr/cli
```

## Platform-Specific Setup

### macOS

Install using Homebrew for the latest version:

```bash
brew tap wundr/wundr
brew install wundr
```

### Linux

Download and install the latest release:

```bash
curl -fsSL https://install.wundr.io | sh
```

Or install via snap:

```bash
sudo snap install wundr
```

### Windows

Install via Chocolatey:

```powershell
choco install wundr
```

Or download the Windows installer from [releases](https://github.com/adapticai/wundr/releases).

## IDE Extensions

Enhance your development experience with IDE extensions:

### Visual Studio Code

Install the official Wundr extension:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Wundr"
4. Install the extension

Or install from command line:

```bash
code --install-extension wundr.wundr-vscode
```

### JetBrains IDEs

Available for IntelliJ IDEA, WebStorm, and other JetBrains IDEs:

1. Go to Settings → Plugins
2. Search for "Wundr"
3. Install and restart

## Docker Setup

Run Wundr in a containerized environment:

```bash
docker pull wundr/wundr:latest
docker run -v $(pwd):/workspace wundr/wundr analyze /workspace
```

Or use Docker Compose:

```yaml
version: '3.8'
services:
  wundr:
    image: wundr/wundr:latest
    volumes:
      - .:/workspace
    command: analyze /workspace
```

## Configuration

### Initialize Configuration

Create a configuration file in your project:

```bash
wundr init
```

This creates a `wundr.config.json` file:

```json
{
  "version": "2.0.0",
  "analysis": {
    "patterns": ["**/*.{ts,tsx,js,jsx}"],
    "ignore": ["node_modules/**", "dist/**", "build/**"],
    "rules": {
      "duplicateDetection": true,
      "complexityThreshold": 15,
      "maintainabilityIndex": true
    }
  },
  "reporting": {
    "format": "json",
    "output": "./reports",
    "includeCharts": true
  },
  "integrations": {
    "git": true,
    "ci": false
  }
}
```

### Environment Variables

Configure Wundr using environment variables:

```bash
export WUNDR_CONFIG_PATH="/path/to/config"
export WUNDR_LOG_LEVEL="debug"
export WUNDR_API_TOKEN="your-api-token"
export WUNDR_CACHE_DIR="/tmp/wundr-cache"
```

## Verification

Verify your installation by running:

```bash
wundr --help
```

You should see the command-line help output.

Run a quick analysis:

```bash
wundr analyze --sample
```

This will analyze sample code and generate a test report.

## Troubleshooting

### Permission Issues

If you encounter permission errors:

```bash
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

### Node Version Issues

Ensure you're using a compatible Node.js version:

```bash
node --version  # Should be 16+
```

Use nvm to manage Node versions:

```bash
nvm install 18
nvm use 18
```

### Cache Issues

Clear the Wundr cache:

```bash
wundr cache clear
```

### Network Issues

If you're behind a proxy, configure npm:

```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

## What's Next?

- [Quick Start Guide](./quick-start.md) - Run your first analysis
- [Configuration Guide](../configuration/overview.md) - Customize Wundr for your needs
- [CLI Reference](../cli/commands.md) - Learn all available commands
- [Web Dashboard](../web-dashboard/overview.md) - Use the visual interface

## Getting Help

- [Documentation](https://docs.wundr.io)
- [GitHub Issues](https://github.com/adapticai/wundr/issues)
- [Discord Community](https://discord.gg/wundr)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/wundr)