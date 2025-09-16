# Common Issues - Guides

Common issues encountered while following Wundr guides and tutorials.

## Guide-Specific Issues

### Getting Started Guides

#### Issue: Installation steps don't match my system

**Solution**: Installation varies by platform and setup:

**macOS with Homebrew**:
```bash
brew install node
npm install -g @wundr/cli
```

**Ubuntu/Debian**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g @wundr/cli
```

**Windows**:
```bash
# Using Chocolatey
choco install nodejs
npm install -g @wundr/cli
```

#### Issue: Quick start commands fail

**Common causes**:
1. Not in a valid project directory
2. Missing package.json file
3. Insufficient permissions

**Solution**:
```bash
# Ensure you're in a project directory
ls -la  # Should show package.json or similar project files

# Initialize if needed
npm init -y  # or git init

# Then try Wundr commands
wundr init
```

### Video Tutorial Issues

#### Issue: Video examples don't work with my project

**Solution**: Adapt examples to your project structure:

1. **Different file structure**: Modify paths in configuration
2. **Different language**: Use appropriate analyzers
3. **Different build system**: Adjust integration steps

#### Issue: Dashboard looks different than in videos

**Solution**:
- Check Wundr version: `wundr --version`
- Update to latest: `npm update -g @wundr/cli`
- Clear browser cache
- Try incognito/private browsing mode

### Configuration Guides

#### Issue: Configuration file not recognized

**Troubleshooting steps**:

1. **Check file location**:
```bash
# Should be in project root
ls -la wundr.config.json
```

2. **Validate JSON syntax**:
```bash
# Use a JSON validator
cat wundr.config.json | jq .
```

3. **Check file permissions**:
```bash
chmod 644 wundr.config.json
```

#### Issue: Custom patterns not working

**Debug steps**:

1. **Validate pattern syntax**:
```bash
wundr patterns validate ./patterns/
```

2. **Check pattern loading**:
```bash
wundr config show | grep patterns
```

3. **Test individual patterns**:
```bash
wundr analyze --pattern-only custom-pattern-name
```

## Environment-Specific Issues

### Docker Environments

**Issue**: Wundr not working in Docker containers

**Solution**:
```dockerfile
# In your Dockerfile
FROM node:18-alpine
RUN npm install -g @wundr/cli

# Ensure proper permissions
USER node
WORKDIR /app
COPY --chown=node:node . .
```

### CI/CD Environments

**Issue**: Analysis fails in CI/CD pipeline

**Common solutions**:

1. **Memory limits**:
```yaml
# GitHub Actions
- name: Increase Node memory
  run: export NODE_OPTIONS="--max-old-space-size=4096"
```

2. **Missing dependencies**:
```yaml
# Ensure all dependencies are installed
- run: npm ci
- run: npm install -g @wundr/cli
```

3. **File permissions**:
```bash
# Make files readable
chmod -R 755 .
```

### IDE Integration Issues

#### VS Code Extension Problems

**Issue**: Wundr VS Code extension not working

**Solutions**:
1. Reload VS Code window: `Cmd+Shift+P` → "Reload Window"
2. Check extension logs in Output panel
3. Verify Wundr CLI is in PATH: `which wundr`
4. Update extension to latest version

#### IntelliJ Plugin Issues

**Issue**: Plugin not detecting Wundr configuration

**Solutions**:
1. Invalidate caches: `File` → `Invalidate Caches and Restart`
2. Check project structure for config file
3. Verify plugin settings in preferences

## Performance Issues

### Large Project Analysis

**Issue**: Analysis takes too long or fails

**Optimization strategies**:

1. **Use incremental analysis**:
```json
{
  "analysis": {
    "incremental": true,
    "chunkSize": 1000
  }
}
```

2. **Exclude large directories**:
```json
{
  "analysis": {
    "exclude": [
      "node_modules/**",
      "build/**",
      "dist/**",
      "coverage/**",
      ".git/**"
    ]
  }
}
```

3. **Limit analysis depth**:
```json
{
  "analysis": {
    "depth": "shallow",
    "maxFiles": 5000
  }
}
```

### Memory Issues

**Issue**: Out of memory errors

**Solutions**:

1. **Increase Node.js memory**:
```bash
NODE_OPTIONS="--max-old-space-size=8192" wundr analyze
```

2. **Use streaming analysis**:
```bash
wundr analyze --stream --chunk-size=500
```

3. **Process in batches**:
```bash
# Analyze specific directories
wundr analyze src/
wundr analyze tests/
```

## Network and Connectivity

### Proxy Issues

**Issue**: Wundr can't connect through corporate proxy

**Solution**:
```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Or use environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

### Firewall Issues

**Issue**: Dashboard or API calls blocked

**Solution**:
1. Check corporate firewall rules
2. Use alternative ports: `wundr dashboard --port=8080`
3. Configure SSL certificates if needed

## Getting More Help

### Documentation

1. Main [FAQ](/faq)
2. [Installation Guide](/getting-started/installation)
3. [Configuration Reference](/configuration/overview)

### Community Support

1. [GitHub Discussions](https://github.com/adapticai/wundr/discussions)
2. [Discord Server](https://discord.gg/wundr)
3. [Stack Overflow](https://stackoverflow.com/questions/tagged/wundr)

### Professional Support

For enterprise users:
- Email: support@wundr.io
- Professional services available
- Priority support options