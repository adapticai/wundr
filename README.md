# Wundr Dashboard - Consumer Integration System

<div align="center">

  <h1>🚀 Wundr Dashboard</h1>

  <p>
    <strong>Consumer Integration System for Intelligent Code Analysis</strong>
  </p>

  <p>
    Transform your development workflow with customizable dashboards, plugins, and secure script execution
  </p>

  <p>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-Get_Started_in_5_Minutes-brightgreen?style=for-the-badge" alt="Quick Start"></a>
    <a href="#integration"><img src="https://img.shields.io/badge/Integration-Plugin_System-blue?style=for-the-badge" alt="Integration"></a>
    <a href="#documentation"><img src="https://img.shields.io/badge/Docs-API_Reference-orange?style=for-the-badge" alt="Documentation"></a>
  </p>

  <p>
    <img src="https://img.shields.io/npm/v/@lumic/wundr?style=flat-square" alt="npm version">
    <img src="https://img.shields.io/github/license/lumicai/wundr?style=flat-square" alt="License">
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node Version">
    <img src="https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square" alt="TypeScript">
  </p>

</div>

---

## 🎯 What is Wundr Dashboard?

Wundr Dashboard is a comprehensive consumer integration system that enables developers to embed intelligent code analysis capabilities into their existing projects. Built by [Lumic.ai](https://lumic.ai), it provides a flexible, secure, and extensible platform for running analysis scripts, creating custom visualizations, and integrating with your development workflow.

### 🌟 Why Choose Wundr Dashboard?

- **🎨 Complete Customization** - Brand the dashboard with your colors, logo, and styling
- **🔌 Extensible Plugin System** - Add custom pages, components, and functionality
- **🛡️ Enterprise Security** - Multi-level security model for safe script execution
- **⚡ Real-time Integration** - Hooks and callbacks for CI/CD and external tools
- **📊 Rich Analytics** - Built-in analysis capabilities with custom metric support
- **🚀 Quick Setup** - Get running in minutes with `npx wundr init-dashboard`

## 🚀 Quick Start

Get your custom dashboard running in under 5 minutes:

```bash
# Initialize dashboard in your project
npx wundr init-dashboard

# Interactive setup (recommended)
npx wundr init-dashboard --interactive

# Start development server
npm run wundr:dev

# View your dashboard
open http://localhost:3000
```

That's it! Your branded dashboard is ready with your project's analysis capabilities.

## 🎬 See It In Action

```bash
$ npx wundr init-dashboard --interactive

🚀 Wundr Dashboard Initialization

✓ Environment validated
📋 Configuration Setup
? What is your project name? My Awesome Project
? Primary color (hex): #0066CC
? Default analysis path: ./src
? Enable plugin system? Yes

✓ Directory structure created
✓ Configuration files generated
✓ Starter files created
✓ Dependencies installed
✓ Helper scripts created

✅ Dashboard initialization complete!

📋 Next Steps:
1. Review configuration in wundr.config.json
2. Customize theme in wundr-dashboard/themes/custom.css
3. Start the dashboard: npm run wundr:dev
4. Open in browser: http://localhost:3000
```

## 🛠️ Core Features

### 1. 🎨 **Complete Customization**
- **Brand Integration** - Your logo, colors, and styling throughout the dashboard
- **Environment Variables** - Override any setting with environment variables
- **Theme System** - Custom CSS support with hot reloading
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile

### 2. 🔌 **Extensible Plugin System**
- **Custom Pages** - Add new dashboard pages with React components
- **API Endpoints** - Create custom REST endpoints for data integration
- **Menu Integration** - Seamlessly add items to the navigation menu  
- **Lifecycle Hooks** - React to analysis events and configuration changes

### 3. 🛡️ **Multi-Level Security**
- **Safe Mode** - Whitelist-only commands with no shell access
- **Moderate Mode** - Limited shell features with command validation
- **Unsafe Mode** - Full shell access for trusted environments only
- **Resource Limits** - Memory, CPU, and timeout constraints

### 4. ⚡ **Real-time Integration**
- **Webhook Support** - Push events to Slack, Teams, or custom endpoints
- **Hook System** - Before/after callbacks for analysis and script execution
- **External APIs** - Integrate with GitHub, Jira, or any REST service
- **Live Updates** - Real-time dashboard updates during analysis

### 5. 📊 **Rich Analytics Platform**
- **Built-in Analysis** - Code quality, complexity, and dependency analysis
- **Custom Scripts** - Run your own analysis tools through the dashboard
- **Historical Tracking** - Track metrics over time with trend analysis
- **Export Options** - JSON, CSV, and Markdown export formats

## 🔧 Integration Architecture

The Wundr Dashboard follows a modular architecture designed for maximum flexibility:

```
┌─────────────────────────────────────────────────────────────┐
│                    Consumer Project                         │
├─────────────────────────────────────────────────────────────┤
│  wundr.config.json  │  .env.wundr  │  package.json          │
├─────────────┬───────────────┬───────────────┬──────────────┤
│ Plugin API  │  Hook System  │  Config API   │ Script API   │
├─────────────┴───────────────┴───────────────┴──────────────┤
│                   Wundr Integration Layer                   │
│    • Configuration Manager  • Security Engine              │
│    • Plugin Registry       • Execution Engine              │
├─────────────────────────────────────────────────────────────┤
│                      Dashboard UI                           │
│    • React Components  • Real-time Updates  • Theming     │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Configuration Layer** - Centralized settings with environment override
2. **Plugin System** - Modular extension capabilities
3. **Hook System** - Event-driven integration with external tools
4. **Security Layer** - Safe script execution with multiple safety levels
5. **UI Framework** - Customizable React-based dashboard

## 💻 CLI Commands

### Dashboard Management

```bash
# Initialization
npx wundr init-dashboard           # Initialize dashboard
npx wundr init-dashboard --interactive  # Interactive setup
npx wundr init-dashboard ./path    # Custom path

# Dashboard Operations
wundr dashboard                    # Start dashboard server
wundr dashboard --dev             # Development mode
wundr dashboard --port 4000       # Custom port
wundr dashboard --build           # Build for production

# Configuration
wundr config                      # Interactive config manager
wundr status                      # System status and diagnostics
```

### Analysis & Scripts

```bash
# Analysis
wundr analyze                     # Run analysis on default path
wundr analyze --path ./src       # Analyze specific path
wundr analyze --format table     # Output as table
wundr analyze --output results.json  # Save to file

# Script Management
wundr scripts                     # List available scripts
wundr script <name>               # Execute registered script
wundr script test --safety safe   # Execute with safety level
wundr script build --timeout 60000  # Custom timeout
```

### Advanced Usage

```bash
# Custom configuration
WUNDR_PRIMARY_COLOR="#FF6B35" wundr dashboard --dev

# Environment-specific execution
NODE_ENV=production wundr script deploy --safety moderate

# Export analysis with custom format
wundr analyze --format markdown --output ./reports/analysis.md

# Run with external integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/... wundr analyze
```

## 📊 Configuration Examples

### Basic Configuration

```json
{
  "branding": {
    "appName": "My Project Dashboard",
    "primaryColor": "#0066CC",
    "logo": "./assets/logo.png"
  },
  "analysis": {
    "defaultPath": "./src",
    "excludePatterns": ["node_modules", "dist"],
    "includeExtensions": [".ts", ".tsx", ".js", ".jsx"]
  },
  "integration": {
    "customScripts": [
      {
        "name": "run-tests",
        "command": "npm test",
        "description": "Run project tests",
        "safetyLevel": "safe"
      }
    ]
  }
}
```

### Advanced Configuration with Hooks

```javascript
// wundr.config.js
module.exports = {
  branding: {
    appName: process.env.WUNDR_APP_NAME || 'Advanced Dashboard',
    primaryColor: process.env.WUNDR_PRIMARY_COLOR || '#0066CC'
  },
  integration: {
    hooks: [
      {
        name: 'slack-notification',
        event: 'after-analysis',
        type: 'async',
        script: `
          const webhook = process.env.SLACK_WEBHOOK_URL;
          if (webhook) {
            await fetch(webhook, {
              method: 'POST',
              body: JSON.stringify({
                text: \`Analysis completed: \${context.data.summary}\`
              })
            });
          }
        `
      }
    ],
    webhooks: [
      {
        url: process.env.CUSTOM_WEBHOOK_URL,
        method: 'POST',
        events: ['after-analysis', 'error-occurred']
      }
    ]
  }
};
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- npm 8+
- Git (for repository analysis)

### Quick Installation

```bash
# Install globally (recommended)
npm install -g @lumic/wundr

# Or use directly with npx
npx @lumic/wundr init-dashboard
```

### Development Installation

```bash
# Add to your project
npm install --save-dev @lumic/wundr

# Add scripts to package.json
{
  "scripts": {
    "wundr:dev": "wundr dashboard --dev",
    "wundr:start": "wundr dashboard",
    "wundr:analyze": "wundr analyze"
  }
}
```

### Docker Setup

```bash
# Using official image
docker pull lumic/wundr:latest

# Run dashboard in container
docker run -p 3000:3000 -v $(pwd):/workspace lumic/wundr dashboard

# Or build your own
FROM node:18-alpine
RUN npm install -g @lumic/wundr
WORKDIR /app
COPY . .
RUN wundr init-dashboard --no-interactive
EXPOSE 3000
CMD ["wundr", "dashboard"]
```

## 🎯 Use Cases

### 1. **Development Team Dashboard**
Create a branded dashboard for your development team:
```bash
# Setup team dashboard
npx wundr init-dashboard --interactive
# Configure team branding and scripts
WUNDR_APP_NAME="Team Alpha Dashboard" npm run wundr:dev
```

### 2. **CI/CD Integration**
Integrate analysis into your continuous integration:
```bash
# GitHub Actions integration
wundr analyze --format json --output analysis-results.json
# Webhook to Slack/Teams
SLACK_WEBHOOK_URL=${{ secrets.SLACK_WEBHOOK }} wundr analyze
```

### 3. **Custom Analysis Tools**
Run your own analysis tools through the dashboard:
```bash
# Register custom script
wundr script security-audit --safety moderate
# View results in dashboard
wundr dashboard --dev
```

### 4. **Multi-Project Monitoring**
Monitor multiple projects from a single dashboard:
```bash
# Setup multi-project configuration
wundr init-dashboard ./project-a
wundr init-dashboard ./project-b
# Aggregate dashboard
wundr dashboard --multi-project
```

## 🔌 Plugin Examples

### Simple Analytics Plugin

```javascript
// plugins/analytics/index.js
module.exports = {
  async initialize({ api, logger }) {
    api.addMenuItem({
      id: 'analytics',
      label: 'Analytics',
      path: '/analytics'
    });
    
    logger.info('Analytics plugin loaded');
  },
  
  component: () => React.createElement('div', null, 'Custom Analytics Page')
};
```

### Integration Hook Example

```javascript
// Custom hook for GitHub integration
{
  name: 'github-pr-comment',
  event: 'after-analysis',
  type: 'async',
  script: `
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_PR) {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      await octokit.issues.createComment({
        owner: process.env.GITHUB_REPOSITORY_OWNER,
        repo: process.env.GITHUB_REPOSITORY_NAME,
        issue_number: process.env.GITHUB_PR,
        body: \`## Analysis Results\\n\\n\${context.data.summary}\`
      });
    }
  `
}
```

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/lumicai/wundr
cd wundr

# Install dependencies
npm install

# Run tests
npm test

# Submit PR
git checkout -b feature/amazing-feature
git commit -m 'Add amazing feature'
git push origin feature/amazing-feature
```

## 📚 Documentation

- [Complete Integration API Guide](docs/integration/INTEGRATION_API.md)
- [Configuration Reference](docs/integration/INTEGRATION_API.md#configuration-api)
- [Plugin Development Guide](docs/integration/INTEGRATION_API.md#plugin-system)
- [Hook System Documentation](docs/integration/INTEGRATION_API.md#hooks-and-callbacks)
- [Security Best Practices](docs/integration/INTEGRATION_API.md#security-model)
- [Example Templates](templates/consumer-integration/)

## 🆘 Support

- **Documentation**: [docs.wundr.io](https://docs.wundr.io)
- **Discord Community**: [discord.gg/wundr](https://discord.gg/wundr)
- **GitHub Issues**: [github.com/lumicai/wundr/issues](https://github.com/lumicai/wundr/issues)
- **Enterprise Support**: [enterprise@lumic.ai](mailto:enterprise@lumic.ai)

## 📄 License

Wundr is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lumicai/wundr&type=Date)](https://star-history.com/#lumicai/wundr&Date)

---

<div align="center">
  <p>
    <strong>Built with ❤️ by <a href="https://lumic.ai">Lumic.ai</a></strong>
  </p>
  <p>
    <a href="https://twitter.com/lumic_ai">Twitter</a> •
    <a href="https://linkedin.com/company/lumicai">LinkedIn</a> •
    <a href="https://blog.lumic.ai">Blog</a>
  </p>
</div>
