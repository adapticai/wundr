# Getting Started with Wundr

Welcome to Wundr! This comprehensive guide will help you set up and start using the Wundr platform for intelligent code analysis, refactoring, and development workflow optimization.

## 🎯 What You'll Learn

By the end of this guide, you'll be able to:
- Install and configure Wundr for your project
- Run your first code analysis
- Navigate the interactive dashboard
- Use AI-powered features for code improvement
- Set up automated workflows and integrations

## 📋 Prerequisites

Before you begin, ensure you have:

### System Requirements
- **Node.js 18+** (LTS recommended)
- **npm 8+** or **pnpm 8+** (we recommend pnpm for monorepos)
- **Git** (for repository analysis and version control integration)
- **8GB+ RAM** (recommended for analyzing large codebases)

### Operating System Support
- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, Debian, RHEL, and derivatives)
- **Windows** (Windows 10/11 with PowerShell or WSL2)

### Optional but Recommended
- **Claude API Key** (for AI-powered features)
- **GitHub Token** (for repository integrations)
- **Slack Webhook URL** (for team notifications)

## 🚀 Step 1: Installation

Choose the installation method that best fits your workflow:

### Option A: Global Installation (Recommended)

```bash
# Install Wundr globally
npm install -g @adapticai/wundr

# Verify installation
wundr --version
wundr --help
```

### Option B: Project-Specific Installation

```bash
# Navigate to your project directory
cd my-awesome-project

# Install as dev dependency
npm install --save-dev @adapticai/wundr
# or
pnpm add -D @adapticai/wundr
```

### Option C: Try Before Installing (npx)

```bash
# Use directly without installation
npx @adapticai/wundr --version
npx @adapticai/wundr init --demo
```

## ⚙️ Step 2: Project Initialization

Initialize Wundr in your project with the interactive setup wizard:

### Basic Initialization

```bash
# Navigate to your project root
cd /path/to/your/project

# Interactive setup (recommended for first-time users)
wundr init --interactive
```

### Advanced Initialization

```bash
# Enterprise setup with all features
wundr init --enterprise --ai-enabled

# Monorepo-specific setup
wundr init --monorepo --workspace-root

# Quick setup for TypeScript projects
wundr init --template typescript --dashboard
```

### What Happens During Initialization

1. **Environment Validation**: Checks Node.js version and dependencies
2. **Project Detection**: Analyzes your project structure and framework
3. **Configuration Creation**: Generates `wundr.config.json` with optimized settings
4. **Feature Selection**: Enables appropriate features based on your project
5. **Integration Setup**: Configures CI/CD and external integrations if requested

## 🔍 Step 3: Your First Analysis

Now let's analyze your codebase and see what Wundr can discover:

### Basic Analysis

```bash
# Run comprehensive analysis
wundr analyze

# Analyze specific directory
wundr analyze ./src

# Focus on specific analysis types
wundr analyze --focus duplicates,complexity,dependencies
```

### Advanced Analysis Options

```bash
# Include AI-powered insights (requires API key)
wundr analyze --ai-review

# Export results in multiple formats
wundr analyze --export-format json,html,markdown

# Performance benchmarking
wundr analyze --benchmark --profile-memory

# Verbose output for debugging
wundr analyze --verbose --debug
```

### Understanding Analysis Results

After analysis completes, you'll see a summary like this:

```
🔍 Analysis Complete! 

📊 Summary:
   • Files analyzed: 1,247
   • Duplicate clusters: 23 (89% consolidation opportunity)
   • Circular dependencies: 3
   • Average complexity: 4.2 (Good)
   • Quality score: 82/100

⚠️  Issues Found:
   • 12 files exceed recommended size (500+ lines)
   • 5 functions have high cyclomatic complexity (>15)
   • 3 potential security issues detected

💡 Next Steps:
   • View detailed results: wundr dashboard
   • Get AI suggestions: wundr ai review
   • Start refactoring: wundr refactor --guided
```

## 📊 Step 4: Explore the Dashboard

Launch the interactive web dashboard to visualize your analysis results:

```bash
# Start the dashboard
wundr dashboard

# Open in your default browser
wundr dashboard --open

# Custom port and theme
wundr dashboard --port 4000 --theme dark
```

### Dashboard Features

Once the dashboard opens (default: http://localhost:3000), you can explore:

1. **Overview Page**: High-level metrics and project health
2. **Dependencies**: Interactive dependency graphs and circular dependency detection
3. **Quality Metrics**: Complexity analysis and code smell detection
4. **Duplicates**: Clustered duplicate code with consolidation suggestions
5. **Performance**: Build times, bundle size analysis, and optimization opportunities
6. **Security**: Vulnerability scans and security recommendations

### Navigation Tips

- Use the **sidebar** to navigate between different analysis views
- Click on **charts and graphs** to drill down into specific data
- Use **filters** to focus on specific file types or directories
- Check the **real-time status** indicator for live updates

## 🤖 Step 5: AI-Powered Features

Wundr's AI integration provides intelligent insights and automated assistance:

### Setting Up AI Features

```bash
# Configure AI integration
wundr ai setup

# Test AI connectivity
wundr ai validate

# Interactive AI setup with API key configuration
wundr ai setup --interactive
```

### AI-Powered Code Review

```bash
# AI review of entire codebase
wundr ai review

# Focus on specific areas
wundr ai review --focus security,performance,maintainability

# Review specific files
wundr ai review ./src/components/UserProfile.tsx
```

### Natural Language Commands

```bash
# Ask questions about your code
wundr ai "What are the main architectural issues in this codebase?"

# Get refactoring suggestions
wundr ai "How can I reduce complexity in my React components?"

# Generate documentation
wundr ai "Create API documentation for my service layer"
```

## 🔧 Step 6: Refactoring and Improvements

Use Wundr's guided refactoring features to improve your code:

### Automated Pattern Detection

```bash
# Detect and fix common patterns
wundr refactor patterns

# Standardize code style and structure
wundr refactor standards

# Consolidate duplicate code
wundr refactor duplicates --interactive
```

### Guided Refactoring Workflow

```bash
# Start interactive refactoring session
wundr refactor --guided

# Batch refactoring with safety checks
wundr refactor --batch-size 10 --dry-run

# Focus on high-impact improvements
wundr refactor --priority high --max-changes 5
```

## 📈 Step 7: Monitoring and Continuous Improvement

Set up continuous monitoring to track your code quality over time:

### Quality Monitoring

```bash
# Create quality baseline
wundr baseline create

# Compare current state to baseline
wundr baseline compare

# Set up quality alerts
wundr alerts setup --slack-webhook $SLACK_URL
```

### Automated Workflows

```bash
# Watch for file changes and re-analyze
wundr watch --auto-analyze

# Schedule periodic analysis
wundr schedule weekly --report-email team@company.com

# CI/CD integration setup
wundr ci setup --github --quality-gates
```

## 🏗️ Step 8: Advanced Configuration

Customize Wundr to fit your team's specific needs:

### Configuration File (`wundr.config.json`)

```json
{
  "project": {
    "name": "My Project",
    "type": "typescript",
    "framework": "react"
  },
  "analysis": {
    "targetPath": "./src",
    "excludePatterns": [
      "node_modules/**",
      "dist/**",
      "**/*.test.ts"
    ],
    "complexity": {
      "maxCyclomatic": 10,
      "maxCognitive": 15
    },
    "duplicates": {
      "minSimilarity": 0.8,
      "enableSemanticAnalysis": true
    }
  },
  "ai": {
    "enabled": true,
    "provider": "claude",
    "features": {
      "codeReview": true,
      "refactoringSuggestions": true,
      "testGeneration": true
    }
  },
  "integrations": {
    "github": {
      "enabled": true,
      "webhookOnPR": true
    },
    "slack": {
      "webhook": "${SLACK_WEBHOOK_URL}",
      "channels": {
        "alerts": "#dev-alerts",
        "reports": "#dev-reports"
      }
    }
  }
}
```

### Environment Variables

Create a `.env.wundr` file for sensitive configuration:

```bash
# AI Configuration
CLAUDE_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Integration Tokens
GITHUB_TOKEN=your_github_token_here
SLACK_WEBHOOK_URL=your_slack_webhook_here

# Dashboard Configuration
WUNDR_DASHBOARD_PORT=3000
WUNDR_DASHBOARD_THEME=system
WUNDR_ENABLE_ANALYTICS=true

# Performance Settings
WUNDR_MAX_CONCURRENCY=10
WUNDR_CACHE_ENABLED=true
```

## 🔗 Step 9: Team Integration

Set up Wundr for your entire development team:

### Shared Configuration

```bash
# Generate team configuration template
wundr config generate-team --template enterprise

# Validate team configuration
wundr config validate

# Deploy team configuration
wundr config deploy --team-wide
```

### CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/wundr-analysis.yml
name: Code Quality Analysis
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Wundr
        run: npm install -g @adapticai/wundr
      
      - name: Run Analysis
        run: wundr analyze --ci --fail-on-issues
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: wundr-analysis
          path: wundr-output/
```

### Team Training Resources

```bash
# Generate team documentation
wundr docs generate --team-guide

# Create training materials
wundr training create --interactive-workshop

# Export best practices guide
wundr best-practices export --format markdown
```

## 🚦 Step 10: Troubleshooting and Support

### Common Issues and Solutions

#### Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Use latest Node.js LTS
nvm use --lts
nvm install --lts

# Check global installation
npm list -g @adapticai/wundr
```

#### Analysis Performance Issues

```bash
# Reduce analysis scope
wundr analyze ./src --exclude "**/*.test.ts"

# Enable performance mode
wundr analyze --performance-mode --max-files 5000

# Clear analysis cache
wundr cache clear
```

#### Dashboard Not Loading

```bash
# Check port availability
wundr dashboard --port 3001

# Restart with debug info
wundr dashboard --debug --verbose

# Clear dashboard cache
wundr dashboard --clear-cache
```

### Getting Help

1. **Documentation**: Visit [docs.wundr.io](https://docs.wundr.io) for comprehensive guides
2. **Community**: Join our [Discord community](https://discord.gg/wundr) for real-time help
3. **GitHub Issues**: Report bugs at [github.com/adapticai/wundr/issues](https://github.com/adapticai/wundr/issues)
4. **Enterprise Support**: Contact [enterprise@adaptic.ai](mailto:enterprise@adaptic.ai) for professional support

## 🎉 You're Ready to Go!

Congratulations! You now have Wundr set up and running. Here's what you can do next:

### Immediate Next Steps
1. **Explore the dashboard** to understand your codebase better
2. **Try AI-powered features** to get intelligent suggestions
3. **Set up quality monitoring** to track improvements over time
4. **Configure team integrations** for collaborative development

### Learning Resources
- [CLI Reference Guide](../packages/@wundr/cli/README.md) - Complete command documentation
- [Dashboard User Guide](../packages/@wundr/dashboard/README.md) - Web interface features
- [AI Integration Guide](./AI_INTEGRATION.md) - Advanced AI features
- [Best Practices](./BEST_PRACTICES.md) - Recommended usage patterns

### Community and Support
- Follow [@WundrAI](https://twitter.com/WundrAI) for updates and tips
- Join our [Discord community](https://discord.gg/wundr) for discussions
- Subscribe to our [newsletter](https://wundr.io/newsletter) for tutorials
- Check out [example projects](https://github.com/adapticai/wundr-examples) for inspiration

## 🤝 Contributing Back

As you become more familiar with Wundr, consider contributing to the community:

- **Share your experience** on social media or your blog
- **Report bugs** or suggest features on GitHub
- **Create plugins** for your favorite tools and frameworks
- **Contribute to documentation** to help other users
- **Participate in discussions** to help shape Wundr's future

Welcome to the Wundr community! We're excited to see what you'll build. 🚀