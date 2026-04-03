# Ruflo Troubleshooting Guide

Comprehensive guide to diagnosing and fixing common issues with Claude Code and Ruflo integration.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [MCP Server Issues](#mcp-server-issues)
- [Agent Issues](#agent-issues)
- [Performance Issues](#performance-issues)
- [Git and Worktree Issues](#git-and-worktree-issues)
- [Hook Issues](#hook-issues)
- [Memory and State Issues](#memory-and-state-issues)
- [Build and Test Issues](#build-and-test-issues)
- [Common Error Messages](#common-error-messages)
- [Debug Mode](#debug-mode)
- [Getting Help](#getting-help)

## Quick Diagnostics

Run the diagnostic tool first:

```bash
# Run full diagnostics
npx ruflo@latest diagnostics --full

# Quick health check
npx ruflo@latest health-check

# System info
npx ruflo@latest system-info
```

Expected output:

```
✓ Node.js version: 18.0.0 or higher
✓ Ruflo installed: v2.0.0
✓ MCP server status: Running
✓ Git repository: Initialized
✓ Configuration: Valid
✓ Agents: 54 available
✓ Hooks: Installed
✓ Memory: Accessible
```

## Installation Issues

### Issue: `npx ruflo@latest` command not found

**Symptoms**:

```bash
$ npx ruflo@latest --version
npx: installed 0 in 0.123s
Command not found: ruflo@latest
```

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Try global installation
npm install -g @ruvnet/ruflo@latest

# Or use full package name
npx @ruvnet/ruflo@latest --version

# Check npm registry
npm config get registry
# Should be: https://registry.npmjs.org/
```

### Issue: Permission errors during installation

**Symptoms**:

```
Error: EACCES: permission denied
```

**Solution**:

```bash
# Fix npm permissions (Mac/Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use alternative installation location
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Add to ~/.bashrc or ~/.zshrc
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

### Issue: Version mismatch

**Symptoms**:

```
Warning: Ruflo version mismatch
Expected: >=2.0.0
Found: 1.x.x
```

**Solution**:

```bash
# Uninstall old version
npm uninstall -g ruflo

# Install latest
npm install -g @ruvnet/ruflo@latest

# Verify version
npx ruflo@latest --version
```

## MCP Server Issues

### Issue: MCP server not starting

**Symptoms**:

```bash
$ claude mcp list
Error: MCP server 'ruflo' not responding
```

**Solution**:

```bash
# Remove existing MCP server
claude mcp remove ruflo

# Re-add MCP server
claude mcp add ruflo npx ruflo@latest mcp start

# Restart Claude Code
# (Close and reopen application)

# Verify MCP server
claude mcp list
claude mcp status ruflo
```

### Issue: MCP tools not available

**Symptoms**:

- MCP tools don't appear in Claude Code
- "Tool not found" errors

**Solution**:

```bash
# Check MCP server logs
claude mcp logs ruflo

# Restart MCP server
claude mcp restart ruflo

# Verify tools are registered
npx ruflo@latest mcp list-tools

# Check configuration
cat ~/.config/claude-code/mcp.json
```

### Issue: MCP connection timeout

**Symptoms**:

```
Error: MCP connection timeout after 30s
```

**Solution**:

```bash
# Increase timeout in MCP config
# Edit ~/.config/claude-code/mcp.json
{
  "servers": {
    "ruflo": {
      "command": "npx",
      "args": ["ruflo@latest", "mcp", "start"],
      "timeout": 60000  // Increase to 60s
    }
  }
}

# Restart Claude Code
```

## Agent Issues

### Issue: Agent not spawning

**Symptoms**:

```
Error: Failed to spawn agent 'coder'
Agent initialization timeout
```

**Solution**:

```bash
# Check agent configuration
npx ruflo@latest agent list --all

# Verify agent type exists
npx ruflo@latest agent types

# Reset agent system
npx ruflo@latest agent reset

# Try spawning with debug
npx ruflo@latest agent spawn --type coder --debug
```

### Issue: Agent performance degradation

**Symptoms**:

- Slow response times
- Tasks taking longer than usual

**Solution**:

```bash
# Check agent metrics
npx ruflo@latest agent metrics --all

# Check resource usage
npx ruflo@latest monitor --agents

# Clear agent caches
npx ruflo@latest agent clear-cache --all

# Restart agents
npx ruflo@latest agent restart --all
```

### Issue: Agent coordination failures

**Symptoms**:

```
Error: Agent coordination failed
Agents not communicating
```

**Solution**:

```bash
# Check swarm status
npx ruflo@latest swarm status

# Reset swarm
npx ruflo@latest swarm reset

# Reinitialize with explicit topology
npx ruflo@latest swarm start \
  --topology mesh \
  --max-agents 5

# Check memory connectivity
npx ruflo@latest memory test-connection
```

## Common Error Messages

### Error: "SPARC mode not found"

```bash
Error: SPARC mode 'invalid-mode' not found
```

**Solution**:

```bash
# List available modes
npx ruflo@latest sparc modes

# Use correct mode name
npx ruflo@latest sparc run spec-pseudocode "task"
```

### Error: "Agent type not available"

```bash
Error: Agent type 'invalid-agent' not available
```

**Solution**:

```bash
# List available agent types
npx ruflo@latest agent types

# Use correct type
npx ruflo@latest agent spawn --type coder
```

### Error: "Configuration validation failed"

```bash
Error: Configuration validation failed
Invalid value for 'agents.timeout'
```

**Solution**:

```bash
# Validate configuration
npx ruflo@latest config validate

# Show configuration schema
npx ruflo@latest config schema

# Fix configuration
nano .ruflo/config.json
```

## Debug Mode

### Enable Global Debug Mode

```bash
# Set debug environment variable
export DEBUG=ruflo:*

# Or for specific modules
export DEBUG=ruflo:agent,ruflo:memory

# Run command with debug
npx ruflo@latest sparc tdd "task" --debug
```

### Debug Configuration

```json
// .ruflo/config.json
{
  "debug": {
    "enabled": true,
    "level": "verbose",
    "logFile": ".ruflo/debug.log",
    "modules": ["agents", "memory", "hooks", "sparc"]
  }
}
```

### Collect Debug Information

```bash
# Generate debug report
npx ruflo@latest debug-report \
  --output debug-report.zip \
  --include-logs \
  --include-config \
  --include-metrics

# Contents:
# - System information
# - Configuration files
# - Log files
# - Memory dump
# - Metrics data
```

## Getting Help

### Documentation

- **Quick Start**: `/docs/guides/QUICK_START.md`
- **API Reference**: `/docs/reference/API.md`
- **Examples**: `/docs/examples/`

### Community

- **GitHub Issues**: https://github.com/ruvnet/ruflo/issues
- **Discussions**: https://github.com/ruvnet/ruflo/discussions
- **Discord**: https://discord.gg/ruflo

### Support Channels

1. **Check documentation first**
2. **Search existing issues**
3. **Run diagnostics**: `npx ruflo@latest diagnostics --full`
4. **Create debug report**: `npx ruflo@latest debug-report`
5. **Open GitHub issue with debug report**

### Report a Bug

```bash
# Generate bug report
npx ruflo@latest bug-report \
  --output bug-report.zip \
  --description "Brief description of issue"

# Contains:
# - System info
# - Configuration
# - Logs
# - Steps to reproduce
# - Expected vs actual behavior
```

## Summary

Troubleshooting steps:

1. ✅ **Run diagnostics first**
2. ✅ **Check logs and error messages**
3. ✅ **Try simple fixes (restart, clear cache)**
4. ✅ **Enable debug mode for details**
5. ✅ **Search documentation and issues**
6. ✅ **Generate debug report**
7. ✅ **Ask for help with details**

**Next Steps**:

- [Migration Guide](./MIGRATION.md)
- [API Reference](../reference/API.md)
- [Quick Start](./QUICK_START.md)

---

**Remember**: Most issues can be resolved by restarting MCP server, clearing cache, or reinstalling.
When in doubt, run diagnostics!
