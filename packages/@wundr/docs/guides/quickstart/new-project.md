---
title: New Project Setup
description: Bootstrap a new project with Wundr best practices from day one
keywords: [quickstart, new-project, setup, configuration, best-practices]
sidebar_position: 1
---

# New Project Setup Guide

Set up Wundr in a new project with production-ready best practices in just 15 minutes. This guide walks you through creating a robust code quality foundation from day one.

## Prerequisites

Before we begin, ensure you have:

- **Node.js 18+** installed on your system
- **npm or pnpm** package manager
- **Git** for version control
- **VS Code** (recommended) for the best development experience

## Step 1: Create Your Project

First, let's create a new project directory:

```bash
mkdir my-awesome-project
cd my-awesome-project

# Initialize git repository
git init

# Create package.json
npm init -y
```

## Step 2: Install Wundr

Install Wundr as a development dependency:

```bash
# Using npm
npm install --save-dev @lumic/wundr

# Using pnpm (recommended)
pnpm add -D @lumic/wundr

# Or install globally for CLI access
npm install -g @lumic/wundr
```

## Step 3: Initialize Wundr Configuration

Run the interactive setup wizard:

```bash
npx wundr init
```

This will prompt you to configure:

- **Project type** (React, Node.js, Monorepo, etc.)
- **Analysis rules** and quality thresholds
- **Integration preferences** (VS Code, GitHub Actions)
- **Team settings** and collaboration features

The wizard creates several files:

```
my-awesome-project/
├── .wundr/
│   ├── config.json           # Main configuration
│   ├── patterns/             # Custom patterns
│   ├── rules/                # Quality rules
│   └── templates/            # Code templates
├── .wundr-ignore            # Files to ignore
└── wundr.config.js          # Optional JS config
```

## Step 4: Configure Your First Analysis

Let's set up a basic TypeScript/React project structure:

```bash
# Create source directories
mkdir -p src/{components,utils,hooks,services}
mkdir -p tests/{unit,integration}

# Create sample files
cat > src/index.ts << 'EOF'
export const greet = (name: string): string => {
  return `Hello, ${name}!`;
};

// Example of a pattern Wundr will detect
export const greetDuplicate = (name: string): string => {
  return `Hello, ${name}!`;  // Duplicate logic
};
EOF

cat > src/components/Button.tsx << 'EOF'
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn"
    >
      {label}
    </button>
  );
};
EOF
```

## Step 5: Run Your First Analysis

Now let's analyze the code:

```bash
# Run comprehensive analysis
npx wundr analyze

# Run specific analysis types
npx wundr analyze --duplicates --patterns --quality
```

You'll see output like:

```
🔍 Analyzing codebase...
┌─────────────────────────────────────────────┐
│               Analysis Results               │
├─────────────────────────────────────────────┤
│ Total Files:           4                    │
│ Total Lines:           45                   │
│ Duplicates Found:      1                    │
│ Quality Score:         87/100               │
│ Technical Debt:        0.5 hours            │
└─────────────────────────────────────────────┘

📋 Issues Found:
├── src/index.ts:6 - Duplicate code detected
└── src/components/Button.tsx:15 - Consider memoization

✨ Recommendations:
├── Consolidate duplicate greeting logic
└── Add React.memo for Button component
```

## Step 6: Start the Web Dashboard

Launch the interactive dashboard:

```bash
# Start dashboard on default port (3000)
npx wundr dashboard

# Or specify a custom port
npx wundr dashboard --port 8080
```

Open your browser to `http://localhost:3000` to see:

- **Analysis Overview** - Key metrics and trends
- **File Explorer** - Browse your codebase interactively
- **Dependency Graph** - Visualize module relationships
- **Quality Metrics** - Track technical debt over time
- **Batch Operations** - Apply fixes across multiple files

## Step 7: Configure Quality Gates

Set up automated quality checks:

```bash
# Generate quality gate configuration
npx wundr config quality-gates --interactive
```

This creates `.wundr/quality-gates.json`:

```json
{
  "gates": {
    "duplicates": {
      "threshold": 5,
      "severity": "error"
    },
    "complexity": {
      "maxCyclomatic": 10,
      "severity": "warning"
    },
    "coverage": {
      "minimum": 80,
      "severity": "error"
    },
    "maintainability": {
      "minimum": 70,
      "severity": "warning"
    }
  },
  "blocking": true,
  "reporting": {
    "format": ["json", "html"],
    "output": ".wundr/reports/"
  }
}
```

## Step 8: Set Up Git Integration

Configure git hooks for automatic quality checks:

```bash
# Install git hooks
npx wundr install-hooks

# Or manually add to package.json scripts
npm pkg set scripts.pre-commit="wundr check --staged"
npm pkg set scripts.pre-push="wundr analyze --quick"
```

## Step 9: VS Code Integration

If you use VS Code, install the Wundr extension:

1. Open VS Code in your project: `code .`
2. Install the extension: **Wundr Code Analysis**
3. Reload VS Code to activate the extension

You'll get:

- **Real-time analysis** as you type
- **Inline suggestions** for code improvements
- **Quick fixes** for common issues
- **Dashboard integration** within VS Code

## Step 10: Team Configuration

For team projects, commit the Wundr configuration:

```bash
# Add Wundr config to git
git add .wundr/ wundr.config.js .wundr-ignore
git commit -m "feat: add Wundr configuration

- Initialize Wundr for code quality analysis
- Configure quality gates and patterns
- Set up dashboard and git hooks"

# Create a team setup script
cat > scripts/setup-wundr.sh << 'EOF'
#!/bin/bash
echo "🔧 Setting up Wundr for the team..."

# Install dependencies
npm install

# Install git hooks
npx wundr install-hooks

# Verify setup
npx wundr verify-setup

echo "✅ Wundr setup complete!"
echo "Run 'npm run dashboard' to start the web interface"
EOF

chmod +x scripts/setup-wundr.sh
```

## Next Steps

Congratulations! You now have a fully configured Wundr environment. Here's what to explore next:

### Immediate Actions

1. **[Run your first refactoring](../workflow/daily-usage)** - Apply some suggested improvements
2. **[Explore the dashboard](../videos/dashboard-walkthrough)** - Get familiar with the web
   interface
3. **[Set up CI/CD integration](../integration/ci-cd-setup)** - Automate quality checks

### Learning Resources

- **[Daily Usage Patterns](../workflow/daily-usage)** - Make Wundr part of your routine
- **[Best Practices Guide](../best-practices/coding-standards)** - Establish quality standards
- **[Team Collaboration](../best-practices/team-collaboration)** - Work effectively with teammates

### Advanced Features

- **[Custom Patterns](../advanced/pattern-development)** - Create project-specific rules
- **[Performance Tuning](../advanced/performance-optimization)** - Optimize for large codebases
- **[API Integration](../../api/overview)** - Build custom tooling

## Troubleshooting

### Common Issues

**Issue**: `wundr: command not found`

```bash
# Solution: Install globally or use npx
npm install -g @lumic/wundr
# OR
npx wundr <command>
```

**Issue**: Dashboard won't start

```bash
# Check for port conflicts
npx wundr dashboard --port 8080

# Clear cache if needed
npx wundr cache clear
```

**Issue**: Analysis is slow

```bash
# Use quick mode for faster results
npx wundr analyze --quick

# Or analyze specific directories
npx wundr analyze src/
```

### Getting Help

- **[Community Forum](https://github.com/adapticai/wundr/discussions)** - Ask questions
- **[Troubleshooting Guide](../../troubleshooting/common-issues)** - Common solutions
- **[Discord Chat](https://discord.gg/wundr)** - Real-time help

## Summary

You've successfully:

- ✅ Installed and configured Wundr
- ✅ Run your first code analysis
- ✅ Set up the web dashboard
- ✅ Configured quality gates
- ✅ Integrated with git and VS Code
- ✅ Prepared for team collaboration

Your project is now equipped with powerful code analysis and quality management capabilities. Start
coding and let Wundr help you maintain excellence! 🚀
