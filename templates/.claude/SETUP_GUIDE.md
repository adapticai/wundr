# .claude Directory Setup Guide

Complete guide for setting up and customizing the .claude directory structure in your project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Directory Structure](#directory-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Customization](#customization)
6. [Usage Examples](#usage-examples)
7. [Advanced Topics](#advanced-topics)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Copy Template to Your Project

```bash
# Copy the entire .claude directory to your project root
cp -r /path/to/templates/.claude /path/to/your/project/

# Navigate to your project
cd /path/to/your/project
```

### 2. Make Hooks Executable

```bash
chmod +x .claude/hooks/*.sh
```

### 3. Customize for Your Project

Edit the following files to match your project:

1. `.claude/CLAUDE.md` - Master configuration
2. `.claude/conventions.md` - Coding standards
3. `.claude/hooks/*.sh` - Automation scripts (optional)
4. `.claude/commands/*.md` - Custom commands (optional)

### 4. Verify Setup

Claude Code will automatically read `.claude/CLAUDE.md` when you start it in your project directory:

```bash
cd /path/to/your/project
claude
```

## Directory Structure

```
.claude/
├── README.md              # Documentation about the structure
├── CLAUDE.md              # Master configuration (READ BY CLAUDE CODE)
├── conventions.md         # Project coding standards
├── SETUP_GUIDE.md         # This file
│
├── agents/                # Agent role definitions
│   ├── core/             # Essential development agents
│   │   ├── coder.md
│   │   ├── reviewer.md
│   │   ├── tester.md
│   │   ├── planner.md
│   │   └── researcher.md
│   │
│   ├── swarm/            # Coordination agents
│   │   ├── coordinator.md
│   │   └── memory-manager.md
│   │
│   ├── github/           # GitHub integration agents
│   │   ├── pr-manager.md
│   │   └── issue-tracker.md
│   │
│   ├── sparc/            # SPARC methodology agents
│   │   ├── specification.md
│   │   └── architecture.md
│   │
│   └── specialized/      # Domain-specific agents
│       └── backend-dev.md
│
├── hooks/                 # Automation scripts (OPTIONAL)
│   ├── pre-task.sh       # Before task execution
│   ├── post-task.sh      # After task completion
│   ├── post-edit.sh      # After file edits
│   └── session-end.sh    # On session end
│
└── commands/              # Custom slash commands (OPTIONAL)
    ├── test-suite.md
    ├── review-changes.md
    └── setup-project.md
```

## Installation

### Option 1: Fresh Project

```bash
# Copy template to new project
cp -r /path/to/templates/.claude /path/to/new-project/
cd /path/to/new-project

# Make hooks executable
chmod +x .claude/hooks/*.sh

# Initialize git (if not already done)
git init
git add .claude/
git commit -m "chore: add Claude Code configuration"
```

### Option 2: Existing Project

```bash
# Navigate to existing project
cd /path/to/existing-project

# Copy template
cp -r /path/to/templates/.claude ./

# Make hooks executable
chmod +x .claude/hooks/*.sh

# Review and customize CLAUDE.md
vim .claude/CLAUDE.md

# Commit to version control
git add .claude/
git commit -m "chore: add Claude Code configuration"
```

### Option 3: Team Project

When setting up for a team:

1. One team member installs the template (Option 1 or 2)
2. Customize for project needs
3. Commit and push to shared repository
4. Other team members pull the changes

```bash
# Team members just need to make hooks executable
chmod +x .claude/hooks/*.sh
```

## Configuration

### Essential Configuration (REQUIRED)

#### 1. CLAUDE.md

This is the **most important file** - Claude Code reads this automatically.

**What to customize**:

```markdown
# At the top of CLAUDE.md

## Project Overview

<!-- REPLACE with your project info -->
**Project Type**: Web Application
**Tech Stack**: React, Node.js, PostgreSQL, Redis
**Development Methodology**: SPARC + TDD

## Directory Structure

<!-- REPLACE with your actual structure -->
```
project-root/
├── src/
│   ├── components/      # React components
│   ├── pages/           # Page components
│   ├── services/        # API services
│   └── utils/           # Utilities
├── server/              # Backend code
│   ├── api/            # API routes
│   ├── services/       # Business logic
│   └── models/         # Database models
└── tests/              # All tests
```

<!-- Update build commands -->
## Build Commands

```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm test               # Run tests
npm run lint           # Run linter
npm run typecheck      # Type checking
```
```

**Key sections to review**:
- Project Overview
- Directory Structure
- Build Commands
- Code Style & Best Practices
- Project-Specific Rules

#### 2. conventions.md

**What to customize**:

1. **Naming Conventions** - Match your project style
2. **Code Organization** - Match your directory structure
3. **API Design** - Match your API patterns
4. **Database** - Match your database schema patterns
5. **Testing** - Match your testing approach

Example customizations:

```markdown
# In conventions.md

## TypeScript/JavaScript

### Our Project Conventions

**Variable naming**:
- Use camelCase for variables
- Use PascalCase for React components
- Use UPPER_SNAKE_CASE for constants

**File naming**:
- Components: `ComponentName.tsx`
- Hooks: `useHookName.ts`
- Services: `service-name.service.ts`
- Tests: `*.test.ts` or `*.spec.ts`

**Import ordering** (specific to our project):
1. React imports
2. External dependencies
3. Internal aliases (@/...)
4. Relative imports
5. Types
6. Styles
```

### Optional Configuration

#### 3. Hooks (OPTIONAL)

Hooks are automation scripts. Enable only if you need automation.

**To enable hooks**:

```bash
# Make executable
chmod +x .claude/hooks/*.sh

# Test a hook
.claude/hooks/pre-task.sh "Test task"
```

**Customize hooks**:

Edit the scripts and modify the section marked `# CUSTOMIZE: Add your ... here`

Example - customize `post-edit.sh` for your project:

```bash
# In .claude/hooks/post-edit.sh

# Add your project-specific formatting
case "$FILE_EXT" in
    ts|tsx|js|jsx)
        # Use your project's formatting command
        npm run format "$FILE_PATH" 2>/dev/null || true

        # Use your project's linter
        npm run lint:fix "$FILE_PATH" 2>/dev/null || true
        ;;
esac
```

#### 4. Commands (OPTIONAL)

Custom commands are slash commands you can invoke in Claude Code.

**To create a command**:

1. Create `.claude/commands/my-command.md`
2. Write command documentation
3. (Optionally) Create implementation script

Example:

```markdown
# .claude/commands/deploy.md

# Deploy Command

Deploy the application to staging or production.

## Usage

```bash
/deploy --env staging
/deploy --env production
```

## What This Command Does

1. Run tests
2. Build application
3. Deploy to specified environment
4. Run smoke tests
5. Notify team

## Implementation

```bash
#!/bin/bash
ENV="${1:-staging}"

echo "🚀 Deploying to $ENV..."

# Run tests
npm test || exit 1

# Build
npm run build || exit 1

# Deploy (customize for your setup)
./scripts/deploy.sh "$ENV"

echo "✅ Deployed to $ENV"
```
```

## Customization

### For Different Project Types

#### React/Frontend Project

```markdown
# In CLAUDE.md

## Directory Structure

```
src/
├── components/          # Reusable components
├── pages/               # Page components
├── hooks/               # Custom hooks
├── contexts/            # React contexts
├── services/            # API services
├── utils/               # Utilities
└── types/               # TypeScript types
```

## Build Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm run test             # Run tests
npm run lint             # ESLint
npm run type-check       # TypeScript
```
```

#### Node.js/Backend Project

```markdown
# In CLAUDE.md

## Directory Structure

```
src/
├── api/                 # API routes
├── services/            # Business logic
├── repositories/        # Database access
├── middleware/          # Express middleware
├── utils/               # Utilities
└── types/               # TypeScript types
```

## Build Commands

```bash
npm run dev              # Development server
npm run build            # TypeScript build
npm run test             # Run tests
npm run lint             # ESLint
npm run migrate          # Run migrations
```
```

#### Monorepo Project

```markdown
# In CLAUDE.md

## Directory Structure

```
packages/
├── web/                 # Web application
├── api/                 # API server
├── shared/              # Shared code
└── mobile/              # Mobile app
```

## Build Commands

```bash
npm run dev              # Start all services
npm run build            # Build all packages
npm run test             # Test all packages
npm run lint             # Lint all packages
```
```

### For Different Team Sizes

#### Solo Developer

**Minimal setup**:
- Keep CLAUDE.md simple
- Focus on conventions.md
- Skip hooks initially
- Add custom commands as needed

#### Small Team (2-5 developers)

**Recommended setup**:
- Detailed CLAUDE.md
- Comprehensive conventions.md
- Basic hooks (post-edit.sh for formatting)
- Essential commands (test-suite, review-changes)

#### Large Team (6+ developers)

**Full setup**:
- Very detailed CLAUDE.md
- Strict conventions.md
- All hooks configured
- Many custom commands
- Regular review and updates

## Usage Examples

### Basic Usage

```bash
# Start Claude Code in your project
cd /path/to/project
claude

# Claude automatically reads .claude/CLAUDE.md
# Now ask Claude to help with development tasks
```

### Using Agents

```markdown
You: "Act as the Coder agent and implement user authentication"

Claude will:
1. Read .claude/agents/core/coder.md
2. Follow the coder agent responsibilities
3. Apply project conventions from CLAUDE.md
4. Implement following project structure
```

### Using Custom Commands

```markdown
You: "Run the test suite"
or
You: "/test-suite"

Claude will:
1. Read .claude/commands/test-suite.md
2. Execute the test suite workflow
3. Report results
```

### Using SPARC Methodology

```bash
# If using claude-flow

# Run SPARC TDD workflow
npx claude-flow sparc tdd "Implement user authentication"

# This will:
# 1. Read specifications from .claude/agents/sparc/specification.md
# 2. Create architecture using .claude/agents/sparc/architecture.md
# 3. Follow project conventions from .claude/conventions.md
# 4. Apply coding standards from .claude/CLAUDE.md
```

## Advanced Topics

### Integrating with Git Hooks

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit ".claude/hooks/post-edit.sh"

# Add pre-push hook
npx husky add .husky/pre-push "npm test"
```

### Integrating with CI/CD

```yaml
# .github/workflows/quality.yml
name: Quality Checks

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # Make hooks executable
      - name: Setup hooks
        run: chmod +x .claude/hooks/*.sh

      # Run post-task hook for validation
      - name: Run quality checks
        run: .claude/hooks/post-task.sh "CI-build" "CI quality check"
```

### Sharing Across Projects

Create a template repository:

```bash
# Create template repo
mkdir claude-template
cp -r .claude/ claude-template/

# Initialize git
cd claude-template
git init
git add .
git commit -m "Initial Claude template"
git remote add origin <your-template-repo-url>
git push -u origin main

# Use in new projects
git clone <your-template-repo-url> my-new-project
cd my-new-project
rm -rf .git
git init
# Start your project
```

### Environment-Specific Configuration

```markdown
# .claude/CLAUDE.md

## Environment Configuration

### Development
- Database: PostgreSQL (local)
- Redis: Local instance
- API: http://localhost:3000

### Staging
- Database: PostgreSQL (staging)
- Redis: Redis Cloud
- API: https://staging-api.example.com

### Production
- Database: PostgreSQL (production)
- Redis: Redis Cloud
- API: https://api.example.com
```

## Troubleshooting

### Claude Doesn't Read CLAUDE.md

**Problem**: Claude doesn't seem to follow the conventions in CLAUDE.md

**Solutions**:
1. Verify file location: Must be at `.claude/CLAUDE.md` (relative to project root)
2. Check file encoding: Must be UTF-8
3. Verify permissions: File must be readable
4. Restart Claude Code in project directory

### Hooks Don't Execute

**Problem**: Automation scripts don't run

**Solutions**:
```bash
# Make executable
chmod +x .claude/hooks/*.sh

# Test directly
.claude/hooks/pre-task.sh "test"

# Check for errors
bash -n .claude/hooks/pre-task.sh

# Verify shebang
head -1 .claude/hooks/pre-task.sh
# Should output: #!/bin/bash
```

### Commands Not Found

**Problem**: Custom slash commands don't work

**Solutions**:
1. Verify file extension: Must be `.md`
2. Check file location: Must be in `.claude/commands/`
3. Verify file is readable
4. File name becomes command name (e.g., `test-suite.md` → `/test-suite`)

### Merge Conflicts

**Problem**: Conflicts when multiple people update .claude/

**Solutions**:
```bash
# Communicate changes with team
# Consider making one person "config owner"

# If conflicts occur:
git checkout --ours .claude/CLAUDE.md  # Keep your version
# or
git checkout --theirs .claude/CLAUDE.md  # Keep their version

# Then manually merge important parts
```

## Best Practices

### 1. Keep It Updated

- Review CLAUDE.md monthly
- Update conventions.md when patterns change
- Remove obsolete agent definitions
- Update commands as workflows evolve

### 2. Document Changes

```bash
# When updating configuration
git commit -m "docs(claude): update API conventions

- Added new REST endpoint patterns
- Updated error handling guidelines
- Documented new authentication flow"
```

### 3. Team Alignment

- Review changes in team meetings
- Get consensus on conventions
- Document decisions in CLAUDE.md
- Share updates in team chat

### 4. Start Simple

- Begin with basic CLAUDE.md
- Add complexity as needed
- Don't over-configure initially
- Let patterns emerge naturally

### 5. Version Control

```bash
# Always commit .claude/ to git
git add .claude/
git commit -m "chore: update Claude configuration"

# Tag major configuration updates
git tag -a claude-config-v2.0 -m "Major config update"
git push --tags
```

## Getting Help

### Resources

- **Claude Code Documentation**: [https://docs.anthropic.com/claude-code](https://docs.anthropic.com/claude-code)
- **This Template**: Check README.md in templates/.claude/
- **Examples**: See agent files for examples

### Common Questions

**Q: Do I need all the agent files?**
A: No, use only what you need. Core agents (coder, reviewer, tester) are most useful.

**Q: Can I modify the templates?**
A: Yes! They're meant to be customized for your project.

**Q: Should I commit .claude/ to git?**
A: Yes, share configuration with your team.

**Q: How often should I update CLAUDE.md?**
A: Review monthly or when project patterns change significantly.

**Q: Can I have project-specific agents?**
A: Yes! Create new agent .md files in .claude/agents/specialized/

---

## Quick Reference

### File Priority (What to Customize First)

1. ✅ **CLAUDE.md** - REQUIRED, read by Claude Code
2. ✅ **conventions.md** - REQUIRED, defines standards
3. ⚠️ **hooks/\*.sh** - OPTIONAL, for automation
4. ⚠️ **commands/\*.md** - OPTIONAL, for custom workflows
5. ℹ️ **agents/\*.md** - OPTIONAL, for role-specific guidance

### Minimal Setup Checklist

- [ ] Copy .claude/ to project root
- [ ] Edit CLAUDE.md (project info, structure, commands)
- [ ] Edit conventions.md (coding standards)
- [ ] Make hooks executable (if using hooks)
- [ ] Test with Claude Code
- [ ] Commit to version control

### Full Setup Checklist

- [ ] All minimal setup items
- [ ] Customize all hooks
- [ ] Create custom commands
- [ ] Add project-specific agents
- [ ] Integrate with CI/CD
- [ ] Set up git hooks (husky)
- [ ] Document for team
- [ ] Train team on usage

---

**Need help?** Check the README.md or agent files for more examples and documentation.
