# Claude Flow Troubleshooting Guide

Comprehensive guide to diagnosing and fixing common issues with Claude Code and Claude Flow
integration.

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
npx claude-flow@alpha diagnostics --full

# Quick health check
npx claude-flow@alpha health-check

# System info
npx claude-flow@alpha system-info
```

Expected output:

```
✓ Node.js version: 18.0.0 or higher
✓ Claude Flow installed: v2.0.0
✓ MCP server status: Running
✓ Git repository: Initialized
✓ Configuration: Valid
✓ Agents: 54 available
✓ Hooks: Installed
✓ Memory: Accessible
```

## Installation Issues

### Issue: `npx claude-flow@alpha` command not found

**Symptoms**:

```bash
$ npx claude-flow@alpha --version
npx: installed 0 in 0.123s
Command not found: claude-flow@alpha
```

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Try global installation
npm install -g @ruvnet/claude-flow@alpha

# Or use full package name
npx @ruvnet/claude-flow@alpha --version

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
Warning: Claude Flow version mismatch
Expected: >=2.0.0
Found: 1.x.x
```

**Solution**:

```bash
# Uninstall old version
npm uninstall -g claude-flow

# Install latest
npm install -g @ruvnet/claude-flow@alpha

# Verify version
npx claude-flow@alpha --version
```

## MCP Server Issues

### Issue: MCP server not starting

**Symptoms**:

```bash
$ claude mcp list
Error: MCP server 'claude-flow' not responding
```

**Solution**:

```bash
# Remove existing MCP server
claude mcp remove claude-flow

# Re-add MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Restart Claude Code
# (Close and reopen application)

# Verify MCP server
claude mcp list
claude mcp status claude-flow
```

### Issue: MCP tools not available

**Symptoms**:

- MCP tools don't appear in Claude Code
- "Tool not found" errors

**Solution**:

```bash
# Check MCP server logs
claude mcp logs claude-flow

# Restart MCP server
claude mcp restart claude-flow

# Verify tools are registered
npx claude-flow@alpha mcp list-tools

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
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
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
npx claude-flow@alpha agent list --all

# Verify agent type exists
npx claude-flow@alpha agent types

# Reset agent system
npx claude-flow@alpha agent reset

# Try spawning with debug
npx claude-flow@alpha agent spawn --type coder --debug
```

### Issue: Agent performance degradation

**Symptoms**:

- Slow response times
- Tasks taking longer than usual

**Solution**:

```bash
# Check agent metrics
npx claude-flow@alpha agent metrics --all

# Check resource usage
npx claude-flow@alpha monitor --agents

# Clear agent caches
npx claude-flow@alpha agent clear-cache --all

# Restart agents
npx claude-flow@alpha agent restart --all
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
npx claude-flow@alpha swarm status

# Reset swarm
npx claude-flow@alpha swarm reset

# Reinitialize with explicit topology
npx claude-flow@alpha swarm start \
  --topology mesh \
  --max-agents 5

# Check memory connectivity
npx claude-flow@alpha memory test-connection
```

## Common Error Messages

### Error: "SPARC mode not found"

```bash
Error: SPARC mode 'invalid-mode' not found
```

**Solution**:

```bash
# List available modes
npx claude-flow@alpha sparc modes

# Use correct mode name
npx claude-flow@alpha sparc run spec-pseudocode "task"
```

### Error: "Agent type not available"

```bash
Error: Agent type 'invalid-agent' not available
```

**Solution**:

```bash
# List available agent types
npx claude-flow@alpha agent types

# Use correct type
npx claude-flow@alpha agent spawn --type coder
```

### Error: "Configuration validation failed"

```bash
Error: Configuration validation failed
Invalid value for 'agents.timeout'
```

**Solution**:

```bash
# Validate configuration
npx claude-flow@alpha config validate

# Show configuration schema
npx claude-flow@alpha config schema

# Fix configuration
nano .claude-flow/config.json
```

## Debug Mode

### Enable Global Debug Mode

```bash
# Set debug environment variable
export DEBUG=claude-flow:*

# Or for specific modules
export DEBUG=claude-flow:agent,claude-flow:memory

# Run command with debug
npx claude-flow@alpha sparc tdd "task" --debug
```

### Debug Configuration

```json
// .claude-flow/config.json
{
  "debug": {
    "enabled": true,
    "level": "verbose",
    "logFile": ".claude-flow/debug.log",
    "modules": ["agents", "memory", "hooks", "sparc"]
  }
}
```

### Collect Debug Information

```bash
# Generate debug report
npx claude-flow@alpha debug-report \
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

- **GitHub Issues**: https://github.com/ruvnet/claude-flow/issues
- **Discussions**: https://github.com/ruvnet/claude-flow/discussions
- **Discord**: https://discord.gg/claude-flow

### Support Channels

1. **Check documentation first**
2. **Search existing issues**
3. **Run diagnostics**: `npx claude-flow@alpha diagnostics --full`
4. **Create debug report**: `npx claude-flow@alpha debug-report`
5. **Open GitHub issue with debug report**

### Report a Bug

```bash
# Generate bug report
npx claude-flow@alpha bug-report \
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
