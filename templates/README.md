# .claude Directory Template

Complete, production-ready .claude directory structure for Claude Code projects.

## Overview

This template provides everything you need to configure Claude Code for your project:

- **23 Files** across 9 directories
- **13 Agent Definitions** for specialized roles
- **4 Automation Hooks** for workflow automation
- **3 Custom Commands** for common tasks
- **Complete Documentation** with setup and usage guides

## Quick Start

```bash
# 1. Copy to your project
cp -r /path/to/templates/.claude /path/to/your/project/

# 2. Make hooks executable
chmod +x /path/to/your/project/.claude/hooks/*.sh

# 3. Customize for your project
cd /path/to/your/project
vim .claude/CLAUDE.md        # Update project info
vim .claude/conventions.md   # Update coding standards

# 4. Start Claude Code
claude
```

**Time to setup**: 10-30 minutes depending on customization needs.

## What's Included

### 📁 Directory Structure

```
.claude/
├── CLAUDE.md              ⭐ Master config (Claude reads this)
├── conventions.md         ⭐ Coding standards
├── README.md              📖 Directory documentation
├── SETUP_GUIDE.md         📖 Detailed setup instructions
│
├── agents/                🤖 Agent role definitions
│   ├── core/             (5 files) Essential development agents
│   ├── swarm/            (2 files) Coordination agents
│   ├── github/           (2 files) GitHub integration
│   ├── sparc/            (2 files) SPARC methodology
│   └── specialized/      (1 file)  Domain expertise
│
├── hooks/                 ⚙️  Automation scripts
│   ├── pre-task.sh       Before task execution
│   ├── post-task.sh      After task completion
│   ├── post-edit.sh      After file edits
│   └── session-end.sh    On session end
│
└── commands/              💬 Custom slash commands
    ├── test-suite.md
    ├── review-changes.md
    └── setup-project.md
```

### ⭐ Essential Files (Required)

**CLAUDE.md** (most important)
- Master configuration file
- Claude Code reads this automatically
- Defines project rules, structure, commands
- **You must customize this for your project**

**conventions.md**
- Coding standards and patterns
- Naming conventions
- Architecture guidelines
- **Customize to match your team's standards**

**README.md**
- Explains the directory structure
- Provides usage instructions
- Reference documentation

### 🤖 Agent Definitions (Optional)

**Core Agents** (5 agents)
- `coder.md` - Code implementation expert
- `reviewer.md` - Code quality and review expert
- `tester.md` - Testing and QA expert
- `planner.md` - Requirements and planning expert
- `researcher.md` - Research and analysis expert

**Swarm Agents** (2 agents)
- `coordinator.md` - Multi-agent orchestration
- `memory-manager.md` - Context and memory management

**GitHub Agents** (2 agents)
- `pr-manager.md` - Pull request management
- `issue-tracker.md` - Issue tracking and triage

**SPARC Agents** (2 agents)
- `specification.md` - Requirements specification
- `architecture.md` - System architecture design

**Specialized Agents** (1 agent)
- `backend-dev.md` - Backend development expert
- *Add more as needed for your domain*

### ⚙️ Automation Hooks (Optional)

**pre-task.sh**
- Runs before starting work
- Validates environment
- Checks prerequisites
- Restores context

**post-task.sh**
- Runs after completing work
- Runs tests and linting
- Validates quality
- Stores results

**post-edit.sh**
- Runs after file edits
- Auto-formats code
- Runs linters
- Updates imports

**session-end.sh**
- Runs when session ends
- Generates summary
- Saves state
- Archives logs

### 💬 Custom Commands (Optional)

**test-suite.md**
- Run complete test suite
- Generate coverage reports
- Display quality metrics

**review-changes.md**
- Review uncommitted changes
- Run quality checks
- Suggest improvements

**setup-project.md**
- Initialize development environment
- Install dependencies
- Configure tools

## Usage Examples

### Example 1: Minimal Setup (Solo Developer)

```bash
# Copy only what you need
cp -r .claude/CLAUDE.md /path/to/project/.claude/
cp -r .claude/conventions.md /path/to/project/.claude/
cp -r .claude/README.md /path/to/project/.claude/

# Customize
vim /path/to/project/.claude/CLAUDE.md
vim /path/to/project/.claude/conventions.md

# Start coding
cd /path/to/project
claude
```

### Example 2: Full Setup (Team Project)

```bash
# Copy everything
cp -r .claude /path/to/project/

# Make hooks executable
chmod +x /path/to/project/.claude/hooks/*.sh

# Customize for team
cd /path/to/project
vim .claude/CLAUDE.md
vim .claude/conventions.md

# Commit for team
git add .claude/
git commit -m "chore: add Claude Code configuration"
git push

# Team members pull and run
chmod +x .claude/hooks/*.sh
```

### Example 3: With SPARC Methodology

```bash
# Copy everything
cp -r .claude /path/to/project/

# Install claude-flow
npm install -g claude-flow@alpha

# Customize
vim .claude/CLAUDE.md
vim .claude/conventions.md

# Use SPARC workflow
cd /path/to/project
npx claude-flow sparc tdd "Implement user authentication"

# SPARC will use:
# - .claude/agents/sparc/specification.md
# - .claude/agents/sparc/architecture.md
# - .claude/conventions.md
# - .claude/CLAUDE.md
```

## Customization Guide

### Quick Customization (10 minutes)

1. **Update CLAUDE.md**:
   - Project type and tech stack
   - Directory structure
   - Build commands
   - Project-specific rules

2. **Update conventions.md**:
   - Naming conventions
   - Code organization
   - Specific patterns you use

### Full Customization (30 minutes)

1. All Quick Customization items
2. Enable and customize hooks
3. Create custom commands
4. Add project-specific agents
5. Configure for CI/CD

### For Different Project Types

**React/Frontend**:
- Focus on component conventions
- Add frontend-specific agents
- Update directory structure for src/components/

**Node.js/Backend**:
- Focus on API conventions
- Add backend-dev agent examples
- Update for src/api/ structure

**Fullstack**:
- Combine frontend and backend
- Add both sets of conventions
- Update for monorepo if needed

**Mobile**:
- Add mobile-specific patterns
- React Native conventions
- Platform-specific guidelines

## Features

### For Solo Developers
✅ Clear project configuration
✅ Coding standards reference
✅ Agent guidance for different tasks
✅ Optional automation

### For Teams
✅ Shared configuration via git
✅ Team coding standards
✅ Consistent development approach
✅ Onboarding documentation

### For Large Projects
✅ SPARC methodology integration
✅ Multi-agent coordination
✅ Memory and context management
✅ GitHub workflow automation

## Documentation

- **SETUP_GUIDE.md** - Detailed setup instructions (in .claude/)
- **USAGE_GUIDE.md** - Usage examples and best practices (in templates/)
- **README.md** - Directory structure explanation (in .claude/)
- **Agent .md files** - Role-specific guidance
- **Command .md files** - Command documentation
- **Hook .sh files** - Script comments explain usage

## File Sizes and Statistics

- **Total Files**: 23 files
- **Total Directories**: 9 directories
- **Documentation**: ~50,000 words
- **Code Examples**: 100+ code snippets
- **Agent Definitions**: 13 specialized roles
- **Automation Scripts**: 4 lifecycle hooks
- **Custom Commands**: 3 example commands

## Requirements

### Minimum
- Claude Code installed
- Text editor
- 5 minutes to customize CLAUDE.md

### Recommended
- Git for version control
- Node.js (if using hooks/commands)
- Team consensus on conventions

### Optional
- claude-flow for SPARC methodology
- Husky for git hooks integration
- CI/CD for automated quality checks

## Getting Started

### Step 1: Read This File
You're doing it! ✅

### Step 2: Copy Template
```bash
cp -r .claude /path/to/your/project/
```

### Step 3: Read Setup Guide
```bash
cat /path/to/your/project/.claude/SETUP_GUIDE.md
```

### Step 4: Customize
```bash
vim /path/to/your/project/.claude/CLAUDE.md
vim /path/to/your/project/.claude/conventions.md
```

### Step 5: Start Claude Code
```bash
cd /path/to/your/project
claude
```

## Support

### Documentation Locations

In `.claude/` directory:
- `SETUP_GUIDE.md` - Detailed setup instructions
- `README.md` - Directory structure reference
- `CLAUDE.md` - Master configuration template
- `conventions.md` - Coding standards template

In `templates/` directory:
- `USAGE_GUIDE.md` - Usage examples and scenarios
- `README.md` - This file

### Example Files

All agent, hook, and command files contain:
- Detailed documentation
- Usage examples
- Best practices
- Code snippets

### Getting Help

1. Check SETUP_GUIDE.md for setup issues
2. Check USAGE_GUIDE.md for usage questions
3. Review agent .md files for role examples
4. Review hook .sh files for automation examples

## Best Practices

### DO ✅
- Customize CLAUDE.md for your project
- Commit .claude/ to version control
- Update regularly as project evolves
- Get team consensus on conventions
- Start simple, add complexity as needed
- Document custom changes
- Review with team periodically

### DON'T ❌
- Use template without customization
- Hardcode secrets in configuration
- Over-configure initially
- Skip team alignment
- Forget to update documentation
- Make hooks required (they're optional)

## Version History

- **v1.0.0** (2025-11-21) - Initial release
  - 23 template files
  - 13 agent definitions
  - 4 automation hooks
  - 3 custom commands
  - Complete documentation

## License

This template is provided as part of the Wundr project.
Customize and use freely in your projects.

## Credits

Created for Claude Code projects using SPARC methodology and best practices from the development community.

---

**Ready to get started?**

1. Copy `.claude/` to your project: `cp -r .claude /path/to/project/`
2. Read the setup guide: `cat .claude/SETUP_GUIDE.md`
3. Customize for your project: `vim .claude/CLAUDE.md`
4. Start coding with Claude: `claude`

**Questions?** Check `USAGE_GUIDE.md` for examples and scenarios.

**Happy coding!** 🚀
