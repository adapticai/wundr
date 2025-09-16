# Common Issues and Solutions

Find solutions to frequently encountered issues when using Wundr.

## Installation Issues

### Node.js Version Compatibility

**Problem**: Installation fails with Node.js version error

**Solution**:
```bash
# Check your Node.js version
node --version

# Update to Node.js 16+ if needed
nvm install 16
nvm use 16
```

### Permission Errors

**Problem**: Permission denied during global installation

**Solution**:
```bash
# Use npm with sudo (Linux/Mac)
sudo npm install -g @wundr/cli

# Or configure npm to use a different directory
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Configuration Issues

### Configuration File Not Found

**Problem**: Wundr can't find configuration file

**Solution**:
1. Ensure configuration file is in project root
2. Check file naming: `wundr.config.json`, `wundr.config.js`, or `.wundrrc`
3. Validate JSON syntax if using JSON config

### Pattern Loading Errors

**Problem**: Custom patterns fail to load

**Solution**:
```bash
# Validate pattern syntax
wundr patterns validate

# Check pattern file paths in config
wundr config check
```

## Analysis Issues

### Large Project Performance

**Problem**: Analysis takes too long on large projects

**Solution**:
1. Exclude unnecessary directories in config:
```json
{
  "analysis": {
    "exclude": [
      "node_modules/**",
      "dist/**",
      "build/**"
    ]
  }
}
```

2. Use incremental analysis:
```bash
wundr analyze --incremental
```

### Memory Issues

**Problem**: Out of memory errors during analysis

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=8192" wundr analyze

# Or use chunked analysis
wundr analyze --chunk-size=1000
```

## Dashboard Issues

### Dashboard Won't Start

**Problem**: Web dashboard fails to start

**Solution**:
1. Check if port is available:
```bash
lsof -i :3000
```

2. Start on different port:
```bash
wundr dashboard --port=3001
```

3. Clear dashboard cache:
```bash
wundr dashboard --clear-cache
```

## Getting Help

If you encounter issues not covered here:

1. Check the [FAQ](../faq.md)
2. Search [GitHub Issues](https://github.com/adapticai/wundr/issues)
3. Join our [Discord Community](https://discord.gg/wundr)
4. Contact support at support@wundr.io