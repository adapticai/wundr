# Claude Directory Template - Usage Guide

Complete guide for using the .claude directory template in your projects.

## Overview

This template provides a comprehensive .claude directory structure for Claude Code projects, including:

- **Core Configuration**: CLAUDE.md and conventions.md
- **Agent Definitions**: 13+ specialized agent roles
- **Automation Hooks**: 4 lifecycle hooks
- **Custom Commands**: 3 example slash commands
- **Complete Documentation**: Setup guides and examples

## Quick Start (3 Minutes)

### 1. Copy to Your Project

```bash
# From the templates directory
cp -r .claude /path/to/your/project/

# Navigate to your project
cd /path/to/your/project
```

### 2. Make Hooks Executable

```bash
chmod +x .claude/hooks/*.sh
```

### 3. Customize Core Files

```bash
# Edit master configuration
vim .claude/CLAUDE.md

# Customize at minimum:
# - Project Overview (line ~15)
# - Directory Structure (line ~85)
# - Build Commands (line ~110)
```

### 4. Start Claude Code

```bash
# Claude automatically reads .claude/CLAUDE.md
claude
```

That's it! Claude Code now has your project context.

## What's Included

### Configuration Files (REQUIRED)

```
.claude/
├── CLAUDE.md          # Master config (Claude reads this automatically)
├── conventions.md     # Coding standards and patterns
├── README.md          # Directory structure documentation
└── SETUP_GUIDE.md     # Detailed setup instructions
```

**CLAUDE.md** is the most important file - Claude Code reads it on startup.

### Agent Definitions (OPTIONAL)

```
.claude/agents/
├── core/              # Essential development roles
│   ├── coder.md
│   ├── reviewer.md
│   ├── tester.md
│   ├── planner.md
│   └── researcher.md
│
├── swarm/             # Multi-agent coordination
│   ├── coordinator.md
│   └── memory-manager.md
│
├── github/            # GitHub workflows
│   ├── pr-manager.md
│   └── issue-tracker.md
│
├── sparc/             # SPARC methodology
│   ├── specification.md
│   └── architecture.md
│
└── specialized/       # Domain expertise
    └── backend-dev.md
```

Use agent definitions to guide Claude's behavior for specific tasks.

### Automation Hooks (OPTIONAL)

```
.claude/hooks/
├── pre-task.sh        # Before starting work
├── post-task.sh       # After completing work
├── post-edit.sh       # After editing files (auto-format, lint)
└── session-end.sh     # On session end (save state, summary)
```

Hooks automate repetitive tasks like formatting and validation.

### Custom Commands (OPTIONAL)

```
.claude/commands/
├── test-suite.md      # Run all tests with coverage
├── review-changes.md  # Review uncommitted changes
└── setup-project.md   # Setup development environment
```

Create slash commands for common workflows.

## Usage Scenarios

### Scenario 1: Solo Developer, Simple Project

**Use**: Minimal setup

```bash
# 1. Copy template
cp -r /path/to/templates/.claude ./

# 2. Edit only these files
vim .claude/CLAUDE.md        # Update project info
vim .claude/conventions.md   # Update coding style

# 3. Remove unused features (optional)
rm -rf .claude/hooks/        # No automation needed
rm -rf .claude/commands/     # No custom commands needed
rm -rf .claude/agents/swarm/ # No swarm coordination
rm -rf .claude/agents/github/ # Not using GitHub integration

# 4. Start coding
claude
```

**Time**: 10 minutes

### Scenario 2: Team Project, Standard Setup

**Use**: Full configuration with team alignment

```bash
# 1. Copy template
cp -r /path/to/templates/.claude ./

# 2. Customize for team
vim .claude/CLAUDE.md        # Detailed project rules
vim .claude/conventions.md   # Team coding standards

# 3. Enable automation
chmod +x .claude/hooks/*.sh

# 4. Create team-specific commands
# Add to .claude/commands/ as needed

# 5. Commit for team
git add .claude/
git commit -m "chore: add Claude Code configuration"
git push

# 6. Team members just need
chmod +x .claude/hooks/*.sh
```

**Time**: 30 minutes initial setup, 5 minutes per team member

### Scenario 3: Advanced Project with SPARC

**Use**: Full setup with methodology integration

```bash
# 1. Install claude-flow
npm install -g claude-flow@alpha

# 2. Copy template
cp -r /path/to/templates/.claude ./

# 3. Customize configuration
vim .claude/CLAUDE.md
vim .claude/conventions.md

# 4. Enable all features
chmod +x .claude/hooks/*.sh

# 5. Use SPARC workflow
npx claude-flow sparc tdd "Feature description"

# This will use:
# - .claude/agents/sparc/specification.md
# - .claude/agents/sparc/architecture.md
# - .claude/conventions.md
# - .claude/CLAUDE.md
```

**Time**: 1 hour initial setup

## Customization Examples

### Example 1: React Project

**CLAUDE.md customization**:

```markdown
## Project Overview

**Project Type**: React Web Application
**Tech Stack**: React 18, TypeScript, Vite, TailwindCSS
**State Management**: Zustand
**API**: REST + React Query

## Directory Structure

```
src/
├── components/          # Reusable components
│   ├── ui/             # Base UI components
│   └── features/       # Feature-specific components
├── pages/               # Page components (routes)
├── hooks/               # Custom React hooks
├── stores/              # Zustand stores
├── services/            # API services
├── utils/               # Utility functions
└── types/               # TypeScript types
```

## Build Commands

```bash
npm run dev              # Development server (Vite)
npm run build            # Production build
npm run preview          # Preview production build
npm run test             # Vitest tests
npm run lint             # ESLint
npm run type-check       # TypeScript check
```

## Code Style

### Component Structure
```typescript
// ComponentName.tsx
import { useState } from 'react';
import type { ComponentProps } from './types';

interface ComponentNameProps {
  // props
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // hooks
  const [state, setState] = useState();

  // handlers
  const handleClick = () => {};

  // render
  return <div>...</div>;
}
```

### File Naming
- Components: `ComponentName.tsx`
- Hooks: `useHookName.ts`
- Utils: `util-name.ts`
- Types: `types.ts` (co-located)
```

**conventions.md additions**:

```markdown
## React Specific Conventions

### Component Organization
1. Imports (React, external, internal, types, styles)
2. Type definitions
3. Component function
4. Exports

### Hooks Rules
- Always prefix with `use`
- Place at top of component
- Respect rules of hooks

### State Management
- Local state: `useState` for component-specific
- Shared state: Zustand stores
- Server state: React Query

### Styling
- Use TailwindCSS utility classes
- Create components in `components/ui/` for reusable styled elements
- Avoid inline styles unless dynamic
```

### Example 2: Node.js API Project

**CLAUDE.md customization**:

```markdown
## Project Overview

**Project Type**: REST API Backend
**Tech Stack**: Node.js, Express, TypeScript, PostgreSQL
**ORM**: Prisma
**Authentication**: JWT
**API Documentation**: OpenAPI/Swagger

## Directory Structure

```
src/
├── api/                 # API routes
│   ├── routes/         # Express routes
│   ├── controllers/    # Route controllers
│   └── validators/     # Request validators
├── services/            # Business logic
├── repositories/        # Database access layer
├── middleware/          # Express middleware
├── utils/               # Utilities
└── types/               # TypeScript types
```

## Build Commands

```bash
npm run dev              # Development with nodemon
npm run build            # TypeScript compilation
npm run start            # Production server
npm run test             # Jest tests
npm run migrate          # Prisma migrations
npm run db:studio        # Prisma Studio
```

## API Conventions

### Endpoint Structure
```
GET    /api/v1/users              # List
GET    /api/v1/users/:id          # Get one
POST   /api/v1/users              # Create
PUT    /api/v1/users/:id          # Update
DELETE /api/v1/users/:id          # Delete
```

### Response Format
```typescript
// Success
{
  success: true,
  data: {...}
}

// Error
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable message"
  }
}
```
```

### Example 3: Monorepo Setup

**CLAUDE.md customization**:

```markdown
## Project Overview

**Project Type**: Monorepo
**Packages**:
- `@myapp/web` - React web app
- `@myapp/api` - Node.js API
- `@myapp/shared` - Shared types and utils
- `@myapp/mobile` - React Native app

**Package Manager**: pnpm with workspaces
**Build Tool**: Turborepo

## Directory Structure

```
packages/
├── web/                 # Web application
│   └── src/
├── api/                 # API server
│   └── src/
├── shared/              # Shared code
│   ├── types/
│   └── utils/
└── mobile/              # Mobile app
    └── src/
```

## Build Commands

```bash
pnpm dev                 # Start all dev servers
pnpm build               # Build all packages
pnpm test                # Test all packages
pnpm lint                # Lint all packages
pnpm clean               # Clean all packages

# Package-specific
pnpm --filter @myapp/web dev
pnpm --filter @myapp/api test
```
```

## Advanced Features

### Using with Git Hooks (Husky)

```bash
# Install husky
npm install --save-dev husky

# Initialize
npx husky install

# Add post-edit hook to pre-commit
npx husky add .husky/pre-commit ".claude/hooks/post-edit.sh"

# Now files are auto-formatted on commit
```

### Using with CI/CD

```yaml
# .github/workflows/quality.yml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # Setup hooks
      - name: Make hooks executable
        run: chmod +x .claude/hooks/*.sh

      # Run post-task validation
      - name: Quality checks
        run: |
          .claude/hooks/post-task.sh "ci-build" "CI quality check"
```

### Creating Custom Agents

Create `.claude/agents/specialized/my-agent.md`:

```markdown
# My Custom Agent

Expert in [your domain].

## Role Description

This agent specializes in [specific tasks].

## Responsibilities

- Task 1
- Task 2
- Task 3

## Best Practices

[Your domain-specific best practices]

## Code Examples

[Your code examples]
```

Then reference it:

```
You: "Act as the My Custom agent and [task description]"
```

### Memory Integration (with claude-flow)

```bash
# Store important decisions
npx claude-flow memory store \
  --key "decisions/architecture/database" \
  --value "Using PostgreSQL with Prisma ORM"

# Retrieve later
npx claude-flow memory retrieve \
  --key "decisions/architecture/database"

# Enable automatic memory in hooks
# Uncomment memory sections in .claude/hooks/*.sh
```

## Tips and Best Practices

### DO ✅

1. **Start simple** - Use minimal setup initially
2. **Commit .claude/** - Share with team via version control
3. **Update regularly** - Review CLAUDE.md monthly
4. **Document changes** - Use conventional commits for config updates
5. **Team alignment** - Get consensus on conventions
6. **Use agent definitions** - Guide Claude's behavior
7. **Test hooks** - Verify automation scripts work

### DON'T ❌

1. **Over-configure** - Don't add complexity you don't need
2. **Ignore team input** - Configuration affects everyone
3. **Forget to update** - Keep configuration current
4. **Skip documentation** - Document custom changes
5. **Hardcode secrets** - Never put secrets in .claude/
6. **Make hooks required** - They're optional automation

## Troubleshooting

### Claude doesn't follow CLAUDE.md

**Cause**: File not in correct location or not readable

**Fix**:
```bash
# Verify location
ls -la .claude/CLAUDE.md

# Check from project root
pwd  # Should be project root
ls .claude/CLAUDE.md  # Should exist

# Verify permissions
chmod 644 .claude/CLAUDE.md
```

### Hooks don't execute

**Fix**:
```bash
# Make executable
chmod +x .claude/hooks/*.sh

# Test directly
.claude/hooks/pre-task.sh "test"

# Check syntax
bash -n .claude/hooks/pre-task.sh
```

### Commands not found

**Fix**:
```bash
# Verify location
ls .claude/commands/*.md

# Check file extension (must be .md)
# Check file names (become command names)
```

## Examples Library

See the following files for complete examples:

- **Core Agents**: `.claude/agents/core/*.md`
- **SPARC Workflow**: `.claude/agents/sparc/*.md`
- **GitHub Integration**: `.claude/agents/github/*.md`
- **Automation**: `.claude/hooks/*.sh`
- **Commands**: `.claude/commands/*.md`

## Getting Help

1. **Setup Issues**: Check `.claude/SETUP_GUIDE.md`
2. **Usage Questions**: Check this file (USAGE_GUIDE.md)
3. **Agent Examples**: Check `.claude/agents/` directory
4. **Hook Examples**: Check `.claude/hooks/` directory

## Next Steps

1. ✅ Copy template to your project
2. ✅ Customize CLAUDE.md for your project
3. ✅ Update conventions.md with your standards
4. ⚠️ Enable hooks if you want automation
5. ⚠️ Create custom commands for your workflows
6. ⚠️ Add project-specific agents as needed

**Happy coding with Claude!** 🚀

---

**Version**: 1.0.0
**Last Updated**: 2025-11-21
