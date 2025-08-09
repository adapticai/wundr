# @wundr/cli

The unified CLI framework for the Wundr platform - Transform monolithic chaos into architectural
elegance with AI-powered development tools.

## 🚀 Features

- **Commander.js Foundation** - Robust command structure with comprehensive help
- **Interactive Modes** - Wizard, Chat, TUI, and Watch interfaces
- **Plugin System** - Extensible architecture with hot-loading
- **Batch Processing** - YAML-based automation and scripting
- **AI Integration** - Natural language development assistance
- **Cross-Platform** - Works on macOS, Linux, and Windows
- **Real-time Monitoring** - File watching and live updates
- **Web Dashboard** - Rich visualization and reporting

## 📦 Installation

```bash
npm install -g @wundr/cli
```

Or use with npx:

```bash
npx @wundr/cli --help
```

## 🎯 Quick Start

### Initialize a new project

```bash
wundr init project my-app
wundr init config --interactive
```

### Launch interactive wizard

```bash
wundr wizard
# or
wundr w
```

### Analyze your code

```bash
wundr analyze deps --circular --unused
wundr analyze quality --complexity --duplication
wundr analyze all --report
```

### Generate code

```bash
wundr create component UserCard --type react --with-tests
wundr create service UserService --framework express --with-docs
```

### AI-powered development

```bash
wundr ai chat
wundr ai review src/components/
wundr ai generate function --prompt "Sort array by date"
```

### Start dashboard

```bash
wundr dashboard start --open
```

## 📋 Command Categories

### `wundr init`

- `init project [name]` - Initialize new project
- `init config` - Setup configuration
- `init workspace` - Create multi-project workspace
- `init plugins` - Setup plugin system

### `wundr create`

- `create component <name>` - Generate components
- `create service <name>` - Generate services
- `create package <name>` - Create monorepo packages
- `create template <name>` - Create code templates
- `create workflow <name>` - Generate CI/CD workflows

### `wundr analyze`

- `analyze deps` - Dependency analysis
- `analyze quality` - Code quality metrics
- `analyze perf` - Performance analysis
- `analyze arch` - Architecture review
- `analyze all` - Comprehensive analysis

### `wundr govern`

- `govern check` - Run compliance checks
- `govern rules` - Manage governance rules
- `govern policy` - Policy management
- `govern gate` - Quality gates
- `govern audit` - Governance auditing

### `wundr ai`

- `ai setup` - Setup AI configuration and API keys
- `ai status` - Check AI configuration status
- `ai validate` - Validate AI connection
- `ai generate <type>` - Code generation
- `ai review [files...]` - Code review
- `ai refactor <target>` - Code refactoring
- `ai docs <target>` - Documentation generation
- `ai chat` - Interactive AI chat
- `ai analyze <target>` - AI-powered analysis
- `ai test <target>` - Generate tests
- `ai optimize <target>` - Performance optimization

### `wundr dashboard`

- `dashboard start` - Launch web dashboard
- `dashboard stop` - Stop dashboard
- `dashboard config` - Configure dashboard
- `dashboard report <type>` - Generate reports

### `wundr watch`

- `watch start [patterns...]` - Start file watching
- `watch test` - Watch and run tests
- `watch build` - Watch and build
- `watch lint` - Watch and lint

### `wundr batch`

- `batch run <file>` - Execute batch job
- `batch create <name>` - Create batch job
- `batch validate <file>` - Validate batch YAML
- `batch schedule <file>` - Schedule execution

### `wundr chat`

- `chat start` - Start chat session
- `chat ask <message>` - Single question
- `chat file <file>` - Chat about file
- `chat resume <sessionId>` - Resume session

### `wundr plugin`

- `plugin list` - List plugins
- `plugin install <plugin>` - Install plugin
- `plugin create <name>` - Create plugin
- `plugin dev link <path>` - Link for development

## 🧙 Interactive Modes

### Wizard Mode

Step-by-step guided setup and configuration:

```bash
wundr wizard          # General wizard
wundr wizard setup    # Project setup
wundr wizard analyze  # Analysis configuration
wundr wizard create   # Code generation
```

### Chat Mode

Natural language interface for development:

```bash
wundr chat start
wundr chat ask "How do I optimize this React component?"
wundr chat file src/component.tsx --action review
```

### TUI Mode

Terminal user interface with real-time updates:

```bash
wundr tui              # Dashboard layout
wundr tui --layout monitor  # Monitoring layout
wundr tui --layout debug    # Debug information
```

### Watch Mode

Real-time file monitoring and automation:

```bash
wundr watch start "src/**/*.ts" --command "npm run build"
wundr watch test       # Auto-run tests on changes
wundr watch lint --fix # Auto-fix linting issues
```

## 🔧 Configuration

### Global Configuration

Stored in `~/.wundr/config.json`:

```json
{
  "defaultMode": "cli",
  "ai": {
    "provider": "claude",
    "model": "claude-3"
  },
  "plugins": ["@wundr/plugin-git"],
  "integrations": {
    "github": {
      "token": "your-token",
      "owner": "your-org",
      "repo": "your-repo"
    }
  }
}
```

### Project Configuration

Project-specific settings in `wundr.config.json`:

```json
{
  "analysis": {
    "patterns": ["**/*.ts", "**/*.tsx"],
    "excludes": ["**/node_modules/**"],
    "maxDepth": 10
  },
  "governance": {
    "rules": ["no-console", "require-tests"],
    "severity": "warning"
  }
}
```

## 🔌 Plugin System

### Installing Plugins

```bash
wundr plugin install @wundr/plugin-docker
wundr plugin install my-custom-plugin
wundr plugin install git+https://github.com/user/plugin.git
```

### Creating Plugins

```bash
wundr plugin create my-awesome-plugin --interactive
cd my-awesome-plugin
npm install
wundr plugin dev link .
```

### Plugin Structure

```typescript
import { Plugin, PluginContext } from '@wundr/cli';

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

## 📊 Batch Processing

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

## 🤖 AI Integration

### Setup & Configuration

Wundr CLI integrates with AI providers for intelligent development assistance. Currently supports Claude (Anthropic) with OpenAI support coming soon.

#### Quick Setup

```bash
# Interactive setup (recommended)
wundr ai setup

# Manual setup
wundr ai setup --provider claude --api-key your-key-here

# Validate configuration
wundr ai validate
```

#### Environment Variables

Set your API key via environment variables:

```bash
# Claude (Anthropic)
export CLAUDE_API_KEY=your_api_key_here

# OpenAI (coming soon)
export OPENAI_API_KEY=your_api_key_here

# Optional: Provider and model selection
export WUNDR_AI_PROVIDER=claude
export WUNDR_AI_MODEL=claude-3-opus-20240229
```

#### Configuration File

Manually configure in `~/.wundr/config.json`:

```json
{
  "ai": {
    "provider": "claude",
    "model": "claude-3-opus-20240229",
    "apiKey": "your-api-key-here"
  }
}
```

#### Getting API Keys

**Claude (Anthropic)**:
1. Visit [Anthropic Console](https://console.anthropic.com)
2. Create an account or sign in
3. Generate an API key in your dashboard
4. Copy the key and use in setup

### AI Commands

```bash
# Setup and status
wundr ai setup          # Interactive setup wizard
wundr ai status         # Check configuration status
wundr ai validate       # Test API connection

# Code generation
wundr ai generate component --prompt "Create a user profile card"
wundr ai generate function --prompt "Sort array by date"

# Code review and analysis
wundr ai review src/ --focus security --suggest-fixes
wundr ai analyze src/component.tsx --suggestions

# Interactive assistance
wundr ai chat --context src/
wundr ai chat          # Start interactive session

# Documentation and tests
wundr ai docs src/utils.ts --type api --include-examples
wundr ai test src/service.ts --framework jest --coverage unit

# Code optimization
wundr ai optimize src/component.tsx --focus performance
wundr ai refactor src/legacy.js --type modernize
```

### Error Handling

If AI features aren't working:

```bash
# Check status
wundr ai status

# Validate connection
wundr ai validate

# Re-run setup if needed
wundr ai setup --validate
```

Common issues:
- **API key not configured**: Run `wundr ai setup`
- **Invalid API key**: Check your key at the provider console
- **Network issues**: Verify internet connection
- **Rate limits**: Wait and try again, or check your usage

## 📊 Dashboard & Monitoring

### Web Dashboard

```bash
wundr dashboard start --port 3000 --open
wundr dashboard config set theme dark
wundr dashboard widget add metrics --position '{"x": 0, "y": 0}'
```

### Real-time Monitoring

```bash
wundr watch analyze --type quality --threshold 80
wundr watch start "src/**" --command "wundr analyze quality"
```

## 🌍 Cross-Platform Compatibility

The Wundr CLI works seamlessly across platforms:

- **macOS**: Full feature support
- **Linux**: Full feature support
- **Windows**: Full feature support with PowerShell/CMD
- **Docker**: Container-ready

### Windows-specific Notes

```powershell
# PowerShell
wundr init project my-app
wundr wizard

# Command Prompt
wundr.cmd analyze deps
wundr.cmd dashboard start
```

## 🔍 Troubleshooting

### Common Issues

1. **Command not found**

   ```bash
   npm install -g @wundr/cli
   # or
   npx @wundr/cli --version
   ```

2. **Permission errors**

   ```bash
   sudo npm install -g @wundr/cli  # macOS/Linux
   # or use npm prefix
   npm config set prefix ~/.npm-global
   ```

3. **Plugin installation fails**

   ```bash
   wundr plugin list
   wundr plugin install <plugin> --force
   ```

4. **TypeScript compilation errors**
   ```bash
   npm run build
   wundr --version  # Verify installation
   ```

### Debug Mode

```bash
wundr --verbose <command>
wundr tui --layout debug
DEBUG=wundr:* wundr <command>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/cli
npm install
npm run build
npm link
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙋 Support

- 📚 [Documentation](https://wundr.io/docs)
- 💬 [Discord Community](https://discord.gg/wundr)
- 🐛 [Issue Tracker](https://github.com/adapticai/wundr/issues)
- 📧 [Email Support](mailto:support@wundr.io)

## 🚀 What's Next?

- Enhanced AI model support
- Visual Studio Code extension
- GitHub Actions integration
- Team collaboration features
- Performance analytics
- Custom rule engine

---

**Made with ❤️ by the Wundr team**

_Transform your development workflow with intelligent automation and architectural excellence._
