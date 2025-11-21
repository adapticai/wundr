# .claude Directory Structure

This directory contains Claude Code configuration, agent definitions, automation hooks, and custom commands for your project.

## Directory Structure

```
.claude/
├── README.md              # This file - explains the structure
├── CLAUDE.md              # Master configuration for Claude Code
├── conventions.md         # Project coding standards and conventions
├── agents/                # Agent role definitions
│   ├── core/             # Essential development agents
│   ├── swarm/            # Coordination and orchestration agents
│   ├── github/           # GitHub integration agents
│   ├── sparc/            # SPARC methodology agents
│   └── specialized/      # Domain-specific agents
├── hooks/                 # Automation scripts triggered by events
│   ├── pre-task.sh       # Before task execution
│   ├── post-task.sh      # After task completion
│   ├── pre-edit.sh       # Before file edits
│   ├── post-edit.sh      # After file edits
│   └── session-*.sh      # Session lifecycle hooks
└── commands/              # Custom slash commands
    └── *.md              # Command definitions

```

## File Purposes

### Root Configuration Files

- **CLAUDE.md**: Master configuration file that Claude Code reads on startup. Defines project rules, workflows, tool usage, and best practices.
- **conventions.md**: Project-specific coding standards, naming conventions, architecture patterns, and style guides.
- **README.md**: This file - documentation about the .claude directory structure.

### Agents Directory

Agent files define specialized roles and personas for different tasks:

- **core/**: Essential agents for everyday development (coder, reviewer, tester, planner, researcher)
- **swarm/**: Coordination agents for multi-agent orchestration
- **github/**: GitHub-specific agents for PR management, code review, issue tracking
- **sparc/**: SPARC methodology agents for systematic development
- **specialized/**: Domain-specific agents (backend, frontend, mobile, ML, etc.)

### Hooks Directory

Bash scripts that automate workflows at key lifecycle points:

- **pre-task.sh**: Validate environment, check dependencies before task starts
- **post-task.sh**: Run tests, format code, update docs after task completes
- **pre-edit.sh**: Backup files, check permissions before editing
- **post-edit.sh**: Auto-format, lint, update imports after editing
- **session-start.sh**: Initialize workspace, restore context
- **session-end.sh**: Save state, generate summaries, export metrics

### Commands Directory

Custom slash commands for project-specific workflows:

- Each `.md` file defines a reusable command
- Commands can be invoked with `/command-name` in Claude Code
- Useful for repetitive tasks, complex workflows, project conventions

## Getting Started

### 1. Initialize Your Project

Copy this `.claude` directory to your project root:

```bash
cp -r templates/.claude /path/to/your/project/
```

### 2. Customize Configuration

Edit these files for your project:

1. **CLAUDE.md**: Update project-specific rules, tools, workflows
2. **conventions.md**: Define your coding standards
3. **agents/**: Add or modify agent roles as needed
4. **hooks/**: Customize automation scripts
5. **commands/**: Create project-specific commands

### 3. Enable Hooks (Optional)

Make hook scripts executable:

```bash
chmod +x .claude/hooks/*.sh
```

### 4. Test Your Setup

Start Claude Code in your project directory and verify:

```bash
cd /path/to/your/project
claude
```

Claude should automatically read `.claude/CLAUDE.md` on startup.

## Customization Guide

### When to Modify Each Component

**CLAUDE.md**: Modify when you need to:
- Change development workflows
- Add new tools or integrations
- Define project-specific rules
- Update file organization standards

**conventions.md**: Modify when you need to:
- Establish coding standards
- Define naming conventions
- Set architecture patterns
- Document API design guidelines

**agents/**: Modify when you need to:
- Add new specialized roles
- Customize agent behaviors
- Create domain-specific experts
- Adjust agent coordination

**hooks/**: Modify when you need to:
- Automate repetitive tasks
- Enforce quality gates
- Integrate with external tools
- Customize workflows

**commands/**: Modify when you need to:
- Create shortcuts for common tasks
- Package complex workflows
- Standardize team processes
- Document procedures as executable commands

## Best Practices

1. **Version Control**: Commit the entire `.claude` directory to share configuration with your team
2. **Documentation**: Keep README.md and CLAUDE.md up to date as your project evolves
3. **Modularity**: Break complex configurations into separate files
4. **Testing**: Test hooks and commands in a safe environment before deploying
5. **Team Alignment**: Review and discuss configuration changes with your team
6. **Incremental Adoption**: Start with basic configuration and add complexity as needed

## Examples

### Creating a Custom Command

Create `.claude/commands/test-suite.md`:

```markdown
# Test Suite Command

Run the complete test suite with coverage reporting.

## Steps

1. Clean previous test artifacts
2. Run unit tests
3. Run integration tests
4. Generate coverage report
5. Open coverage in browser
```

Invoke with: `/test-suite`

### Creating a Custom Agent

Create `.claude/agents/specialized/api-designer.md`:

```markdown
# API Designer Agent

Expert in RESTful API design, following project conventions.

## Responsibilities
- Design API endpoints
- Define request/response schemas
- Document API contracts
- Ensure consistency with existing APIs

## Guidelines
- Follow OpenAPI 3.0 specification
- Use project naming conventions
- Include error handling patterns
- Provide usage examples
```

### Adding a Hook

Create `.claude/hooks/post-edit.sh`:

```bash
#!/bin/bash
# Auto-format code after editing

FILE="$1"

if [[ "$FILE" == *.js ]] || [[ "$FILE" == *.ts ]]; then
  npx prettier --write "$FILE"
  npx eslint --fix "$FILE"
fi
```

## Troubleshooting

**Claude doesn't read CLAUDE.md**:
- Ensure file is in project root: `.claude/CLAUDE.md`
- Check file permissions are readable
- Verify file encoding is UTF-8

**Hooks don't execute**:
- Make scripts executable: `chmod +x .claude/hooks/*.sh`
- Check script syntax: `bash -n .claude/hooks/script.sh`
- Verify shebang is correct: `#!/bin/bash`

**Commands not found**:
- Ensure command files are in `.claude/commands/`
- Check file extension is `.md`
- Verify command name matches filename

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [SPARC Methodology](https://github.com/ruvnet/claude-flow)
- [MCP Tools](https://github.com/ruvnet/wundr)

## Support

For issues or questions:
1. Check project documentation
2. Review example configurations
3. Consult team guidelines
4. Create an issue in project repository
