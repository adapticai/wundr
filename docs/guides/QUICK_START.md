# Quick Start Guide: Claude Code + Ruflo Integration

Get up and running with enhanced Claude Code and Ruflo integration in just 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Claude Code CLI installed
- Git repository initialized
- npm or yarn package manager

## Step 1: Install Ruflo (1 minute)

```bash
# Install Ruflo globally or use npx
npm install -g @ruvnet/ruflo@latest

# OR use npx (no installation needed)
npx @ruvnet/ruflo@latest --version
```

## Step 2: Add MCP Server (1 minute)

```bash
# Add Ruflo MCP server to Claude Code
claude mcp add ruflo npx ruflo@latest mcp start

# Verify installation
claude mcp list
```

You should see `ruflo` in the list of MCP servers.

## Step 3: Initialize Your Project (2 minutes)

```bash
# Navigate to your project
cd /path/to/your/project

# Initialize Ruflo
npx ruflo@latest init

# Set up SPARC configuration
npx ruflo@latest sparc init
```

This creates:

- `.ruflo/` - Configuration directory
- `CLAUDE.md` - Project instructions for Claude Code
- `.sparc/` - SPARC workflow configuration
- Git hooks for automation

## Step 4: Test the Integration (1 minute)

### Test Basic SPARC Workflow

```bash
# List available SPARC modes
npx ruflo@latest sparc modes

# Run a simple specification
npx ruflo@latest sparc run spec-pseudocode "Create a user authentication module"
```

### Test Agent Spawning

Open Claude Code and try:

```
Start a swarm with a researcher and coder to analyze authentication patterns
```

Claude Code will:

1. Use MCP to initialize the swarm
2. Spawn researcher and coder agents
3. Coordinate their work automatically

## Step 5: Your First Real Task

Let's build a simple feature using the full workflow:

```bash
# Run complete TDD workflow
npx ruflo@latest sparc tdd "Add user login with email validation"
```

This will:

1. **Specification**: Analyze requirements
2. **Pseudocode**: Design algorithm
3. **Architecture**: Plan structure
4. **Refinement**: Implement with TDD
5. **Completion**: Integrate and verify

## What Just Happened?

### Behind the Scenes

1. **MCP Tools Coordinated**: Ruflo managed agent orchestration
2. **Claude Code Executed**: All file operations and code generation
3. **Hooks Automated**: Pre/post operations handled automatically
4. **Memory Persisted**: Context saved for future sessions
5. **Tests Generated**: TDD approach created tests first

## Quick Reference Commands

### SPARC Operations

```bash
# List all modes
npx ruflo@latest sparc modes

# Run specific mode
npx ruflo@latest sparc run <mode> "<task>"

# Full TDD workflow
npx ruflo@latest sparc tdd "<feature>"
```

### Agent Management

```bash
# Initialize swarm
npx ruflo@latest swarm init

# Spawn agent
npx ruflo@latest agent spawn --type coder

# List active agents
npx ruflo@latest agent list
```

## Next Steps

1. **Read the Git-Worktree Guide**: Learn advanced parallel development workflows
2. **Customize Your Agents**: Configure agents for your specific needs
3. **Create Custom Hooks**: Automate your unique workflows
4. **Explore Templates**: Adapt templates for different project types

## Getting Help

- **Documentation**: `/docs/guides/` - All guides
- **Troubleshooting**: `/docs/guides/RUFLO_TROUBLESHOOTING.md`
- **API Reference**: `/docs/reference/API.md`
- **Issues**: https://github.com/ruvnet/ruflo/issues

---

**Remember**: Ruflo coordinates, Claude Code creates, quality tools ensure excellence!
