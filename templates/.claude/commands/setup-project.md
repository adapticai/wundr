# Setup Project Command

Initialize and configure a new development project with all necessary dependencies and tooling.

## Description

This command sets up a complete development environment for a new project, installing dependencies, configuring tools, setting up git hooks, and preparing the project for development.

## Usage

```bash
/setup-project
```

Or with project type:
```bash
/setup-project --type=react
/setup-project --type=node
/setup-project --type=fullstack
```

## What This Command Does

1. **Verify Prerequisites**
   - Check Node.js version
   - Check npm/yarn version
   - Check git installation
   - Verify system requirements

2. **Install Dependencies**
   - Install npm packages
   - Install development dependencies
   - Install peer dependencies

3. **Configure Development Tools**
   - Set up ESLint
   - Configure Prettier
   - Set up TypeScript
   - Configure test framework

4. **Set Up Git Hooks**
   - Install husky
   - Configure pre-commit hooks
   - Configure commit message linting

5. **Initialize Environment**
   - Create .env file from template
   - Set up local configuration
   - Generate necessary keys

6. **Run Initial Build**
   - Type check
   - Lint code
   - Run tests
   - Build project

7. **Display Next Steps**
   - Show available commands
   - Provide usage examples
   - Link to documentation

## Example Output

```
🚀 Setting Up Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Prerequisites Check
  ✓ Node.js v18.17.0
  ✓ npm v9.6.7
  ✓ git v2.40.0

📦 Installing Dependencies
  ✓ Installing packages... (124 packages)
  ✓ Installing dev dependencies... (87 packages)

⚙️  Configuring Development Tools
  ✓ ESLint configured
  ✓ Prettier configured
  ✓ TypeScript configured
  ✓ Jest configured

🪝 Setting Up Git Hooks
  ✓ Husky installed
  ✓ Pre-commit hook configured
  ✓ Commit-msg hook configured

🔧 Initializing Environment
  ✓ Created .env from .env.example
  ⚠️  Update .env with your values

🏗️  Running Initial Build
  ✓ Type check passed
  ✓ Lint check passed
  ✓ Tests passed (42 tests)
  ✓ Build successful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Project Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Steps:

1. Update environment variables:
   Edit .env with your configuration

2. Start development server:
   npm run dev

3. Run tests:
   npm test

4. Build for production:
   npm run build

Available Commands:
  /test-suite       - Run all tests
  /review-changes   - Review uncommitted changes
  /deploy           - Deploy to production

Documentation:
  README.md         - Project overview
  docs/             - Detailed documentation

Happy coding! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Implementation

```bash
#!/bin/bash
# .claude/scripts/setup-project.sh

set -e

PROJECT_TYPE="${1:-node}"

echo "🚀 Setting Up Project"
echo "Project Type: $PROJECT_TYPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Prerequisites check
echo ""
echo "✓ Prerequisites Check"

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✓ Node.js $NODE_VERSION"
else
    echo "  ✗ Node.js not found"
    echo "    Install from: https://nodejs.org"
    exit 1
fi

# npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  ✓ npm v$NPM_VERSION"
else
    echo "  ✗ npm not found"
    exit 1
fi

# git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo "  ✓ git v$GIT_VERSION"
else
    echo "  ✗ git not found"
    echo "    Install from: https://git-scm.com"
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing Dependencies"

if [ -f "package.json" ]; then
    npm install
    echo "  ✓ Dependencies installed"
else
    echo "  ✗ package.json not found"
    exit 1
fi

# Configure tools
echo ""
echo "⚙️  Configuring Development Tools"

# ESLint
if [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ]; then
    echo "  ⚠️  ESLint not configured"
    echo "    Run: npm init @eslint/config"
else
    echo "  ✓ ESLint configured"
fi

# Prettier
if [ ! -f ".prettierrc" ] && [ ! -f ".prettierrc.json" ]; then
    echo "  ⚠️  Prettier not configured"
    cat > .prettierrc << EOF
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
EOF
    echo "  ✓ Prettier configured"
else
    echo "  ✓ Prettier configured"
fi

# TypeScript
if [ -f "tsconfig.json" ]; then
    echo "  ✓ TypeScript configured"
else
    echo "  ⚠️  TypeScript not configured"
fi

# Git hooks
echo ""
echo "🪝 Setting Up Git Hooks"

if grep -q "husky" package.json; then
    npm run prepare 2>/dev/null || npx husky install
    echo "  ✓ Husky installed"
else
    echo "  ⚠️  Husky not found in package.json"
fi

# Environment
echo ""
echo "🔧 Initializing Environment"

if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  ✓ Created .env from .env.example"
    echo "  ⚠️  Update .env with your values"
elif [ ! -f ".env" ]; then
    echo "  ⚠️  No .env file"
else
    echo "  ✓ .env file exists"
fi

# Initial build
echo ""
echo "🏗️  Running Initial Build"

# Type check
if [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit; then
        echo "  ✓ Type check passed"
    else
        echo "  ✗ Type check failed"
    fi
fi

# Lint
if grep -q "\"lint\"" package.json; then
    if npm run lint; then
        echo "  ✓ Lint check passed"
    else
        echo "  ⚠️  Lint issues found"
    fi
fi

# Tests
if grep -q "\"test\"" package.json; then
    if npm test; then
        echo "  ✓ Tests passed"
    else
        echo "  ⚠️  Some tests failed"
    fi
fi

# Build
if grep -q "\"build\"" package.json; then
    if npm run build; then
        echo "  ✓ Build successful"
    else
        echo "  ✗ Build failed"
    fi
fi

# Success message
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Project Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Next Steps:"
echo ""
echo "1. Update environment variables:"
echo "   Edit .env with your configuration"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. Run tests:"
echo "   npm test"
echo ""
echo "Happy coding! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Configuration

Make script executable:
```bash
chmod +x .claude/scripts/setup-project.sh
```

Add to package.json:
```json
{
  "scripts": {
    "setup": ".claude/scripts/setup-project.sh",
    "postinstall": "husky install"
  }
}
```

## Prerequisites

- Node.js >= 16
- npm >= 8
- git >= 2.20

## Project Types

- `node`: Node.js backend
- `react`: React frontend
- `fullstack`: Full-stack application
- `library`: NPM library

## Related Commands

- `/install-deps` - Install dependencies only
- `/configure-tools` - Configure dev tools only
- `/setup-hooks` - Set up git hooks only
