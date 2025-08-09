# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Wundr. If you don't find a solution here, please check our [FAQ](./FAQ.md) or reach out to our [community support](https://discord.gg/wundr).

## 🔍 Quick Diagnostics

Before diving into specific issues, run these diagnostic commands:

```bash
# Check system requirements
wundr doctor

# Validate installation
wundr --version
wundr config validate

# Check system status
wundr status --detailed

# Clear all caches
wundr cache clear --all
```

## 🛠️ Installation Issues

### Command Not Found

**Problem**: `wundr: command not found` or `'wundr' is not recognized as an internal or external command`

**Solutions**:

```bash
# Option 1: Verify global installation
npm list -g @adapticai/wundr

# Option 2: Reinstall globally
npm uninstall -g @adapticai/wundr
npm install -g @adapticai/wundr

# Option 3: Use npx directly
npx @adapticai/wundr --help

# Option 4: Check PATH (Linux/macOS)
echo $PATH
which wundr

# Option 5: Windows PowerShell execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Permission Errors

**Problem**: `EACCES: permission denied` during installation

**Solutions**:

```bash
# Option 1: Use npm prefix (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile
npm install -g @adapticai/wundr

# Option 2: Use sudo (not recommended)
sudo npm install -g @adapticai/wundr

# Option 3: Use node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g @adapticai/wundr
```

### Node.js Version Issues

**Problem**: `Node.js version 16.x.x is not supported. Please use 18.x.x or higher`

**Solutions**:

```bash
# Check current version
node --version

# Install Node.js 18+ using nvm
nvm install 18
nvm use 18

# Or download from nodejs.org
# Visit: https://nodejs.org/en/download/

# Verify installation
node --version
npm --version
```

## 🔍 Analysis Issues

### Out of Memory Errors

**Problem**: `JavaScript heap out of memory` during large codebase analysis

**Solutions**:

```bash
# Option 1: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
wundr analyze

# Option 2: Reduce analysis scope
wundr analyze ./src --exclude "**/*.test.ts" --exclude "**/node_modules/**"

# Option 3: Enable streaming mode
wundr analyze --streaming --chunk-size 50

# Option 4: Use performance mode
wundr analyze --performance-mode --max-files 5000

# Option 5: Exclude large directories
wundr analyze --exclude "dist/**" --exclude "build/**" --exclude "coverage/**"
```

### Slow Analysis Performance

**Problem**: Analysis takes too long or seems to hang

**Solutions**:

```bash
# Check system resources
wundr analyze --benchmark --profile

# Optimize concurrency
wundr analyze --max-concurrency 4  # Adjust based on CPU cores

# Enable caching
wundr config set analysis.enableCaching true

# Use incremental analysis
wundr analyze --incremental --since-commit HEAD~1

# Debug performance bottlenecks
wundr analyze --debug --verbose --profile-memory
```

### Analysis Errors

**Problem**: Analysis fails with various error messages

**Common solutions**:

```bash
# Clear analysis cache
wundr cache clear analysis

# Validate project structure
wundr validate project

# Check for unsupported file types
wundr analyze --dry-run --verbose

# Fix TypeScript configuration
wundr config fix typescript

# Reset to default configuration
wundr config reset --confirm
```

## 📊 Dashboard Issues

### Dashboard Won't Start

**Problem**: Dashboard fails to load or start

**Solutions**:

```bash
# Check if port is in use
lsof -ti:3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
wundr dashboard --port 3001

# Clear dashboard cache
wundr dashboard --clear-cache

# Reset dashboard configuration
wundr dashboard --reset-config

# Debug startup issues
wundr dashboard --debug --verbose
```

### WebSocket Connection Issues

**Problem**: Real-time updates not working, connection errors

**Solutions**:

```bash
# Test WebSocket connection
wundr test websocket

# Check firewall settings (allow port 8080)
# Windows Firewall / macOS System Preferences / Linux iptables

# Use alternative WebSocket port
wundr dashboard --ws-port 8081

# Disable WebSocket (fallback to polling)
wundr dashboard --disable-websocket

# Check proxy configuration
wundr config set dashboard.proxy.enabled false
```

### Dashboard Performance Issues

**Problem**: Dashboard is slow or unresponsive

**Solutions**:

```bash
# Enable performance mode
wundr dashboard --performance-mode

# Reduce data refresh rate
wundr dashboard --refresh-interval 10000

# Disable real-time updates
wundr dashboard --disable-realtime

# Clear browser cache and cookies
# Chrome: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete

# Use lightweight mode
wundr dashboard --lightweight
```

## 🤖 AI Integration Issues

### AI Features Not Working

**Problem**: AI commands fail or return errors

**Solutions**:

```bash
# Check AI configuration
wundr ai status

# Validate API key
wundr ai validate

# Reconfigure AI integration
wundr ai setup --reconfigure

# Test AI connectivity
wundr ai test --provider claude

# Check API key format
echo $CLAUDE_API_KEY | wc -c  # Should be around 100+ characters
```

### API Key Issues

**Problem**: Invalid API key or authentication errors

**Solutions**:

```bash
# Set API key via environment variable
export CLAUDE_API_KEY="your-api-key-here"

# Set API key via CLI
wundr ai config --api-key "your-api-key-here"

# Verify API key at provider console
# Claude: https://console.anthropic.com/
# OpenAI: https://platform.openai.com/

# Check API key permissions and quota
wundr ai quota

# Use different model
wundr ai config --model "claude-3-haiku"
```

### Rate Limiting Issues

**Problem**: API rate limit exceeded errors

**Solutions**:

```bash
# Check current usage
wundr ai usage

# Reduce AI analysis frequency
wundr config set ai.rateLimitDelay 2000

# Use different model tier
wundr ai config --model "claude-3-haiku"  # Lower cost/rate limits

# Implement request batching
wundr config set ai.batchRequests true

# Wait and retry
sleep 60 && wundr ai review
```

## 🔧 Configuration Issues

### Configuration File Errors

**Problem**: `wundr.config.json` is invalid or corrupted

**Solutions**:

```bash
# Validate configuration
wundr config validate

# Fix common issues automatically
wundr config fix --auto

# Reset to default configuration
wundr config reset

# Generate new configuration
wundr init --overwrite-config

# Backup and restore configuration
wundr config backup
wundr config restore backup-20231201.json
```

### Environment Variable Issues

**Problem**: Environment variables not being recognized

**Solutions**:

```bash
# Check current environment variables
wundr config env

# Reload environment variables
source ~/.bashrc  # Linux/macOS
# Or restart terminal

# Use .env file
echo "CLAUDE_API_KEY=your-key" > .env.wundr

# Windows PowerShell
$env:CLAUDE_API_KEY="your-key"

# Verify variable is set
echo $CLAUDE_API_KEY  # Linux/macOS
echo $env:CLAUDE_API_KEY  # Windows PowerShell
```

## 🔒 Security and Permission Issues

### File Access Denied

**Problem**: Cannot read/write files during analysis

**Solutions**:

```bash
# Check file permissions
ls -la ./src  # Linux/macOS
icacls .\src  # Windows

# Fix permissions
chmod -R 644 ./src  # Linux/macOS
# Windows: Right-click → Properties → Security

# Run as administrator (last resort)
sudo wundr analyze  # Linux/macOS
# Windows: Run PowerShell as Administrator

# Check for file locks
lsof +D ./src  # Linux/macOS
```

### Antivirus Interference

**Problem**: Antivirus software blocking Wundr

**Solutions**:

1. **Add exclusions** to your antivirus software:
   - Wundr installation directory
   - Project directories being analyzed
   - Node.js executable
   
2. **Temporarily disable** real-time scanning during analysis

3. **Whitelist Wundr processes**:
   - `wundr.exe` (Windows)
   - `node` process running Wundr

## 📦 Package Management Issues

### Dependency Conflicts

**Problem**: Conflicting package versions or missing dependencies

**Solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for duplicate packages
npm ls --depth=0

# Update all dependencies
npm update

# Use npm ci for clean installation
npm ci
```

### Package Installation Failures

**Problem**: `npm install @adapticai/wundr` fails

**Solutions**:

```bash
# Use different registry
npm install @adapticai/wundr --registry https://registry.npmjs.org/

# Clear npm cache
npm cache clean --force

# Use yarn instead of npm
yarn global add @adapticai/wundr

# Check npm configuration
npm config list

# Reset npm configuration
npm config delete proxy
npm config delete https-proxy
npm config delete registry
```

## 🌐 Network and Connectivity Issues

### Proxy Configuration

**Problem**: Wundr doesn't work behind corporate proxy

**Solutions**:

```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Configure Wundr proxy
wundr config set network.proxy.http "http://proxy.company.com:8080"
wundr config set network.proxy.https "http://proxy.company.com:8080"

# Skip SSL verification (not recommended for production)
npm config set strict-ssl false
wundr config set network.strictSSL false
```

### Firewall Issues

**Problem**: Network requests blocked by firewall

**Solutions**:

1. **Allow Wundr through firewall**:
   - Windows: Windows Defender Firewall → Allow an app
   - macOS: System Preferences → Security & Privacy → Firewall
   - Linux: Configure iptables or ufw

2. **Required ports**:
   - Dashboard: 3000 (default, configurable)
   - WebSocket: 8080 (default, configurable)
   - AI APIs: 443 (HTTPS)

## 🔄 CI/CD Integration Issues

### GitHub Actions Failures

**Problem**: Wundr fails in GitHub Actions workflow

**Solutions**:

```yaml
# .github/workflows/wundr.yml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    cache: 'npm'

- name: Install Wundr
  run: |
    npm cache clean --force
    npm install -g @adapticai/wundr@latest

- name: Run Analysis
  run: |
    export NODE_OPTIONS="--max-old-space-size=4096"
    wundr analyze --ci --timeout 600000
  env:
    CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

### Container Issues

**Problem**: Docker container fails to run Wundr

**Solutions**:

```dockerfile
# Use official Node.js image
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache git

# Install Wundr
RUN npm install -g @adapticai/wundr@latest

# Set memory limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

WORKDIR /workspace
CMD ["wundr", "analyze"]
```

## 📊 Performance Optimization

### Large Codebase Optimization

**Problem**: Poor performance with large codebases (10,000+ files)

**Solutions**:

```bash
# Enable performance mode
wundr analyze --performance-mode

# Optimize configuration
{
  "analysis": {
    "performance": {
      "maxConcurrency": 8,
      "chunkSize": 100,
      "enableCaching": true,
      "streamingMode": true
    },
    "excludePatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.min.js",
      "**/*.map"
    ]
  }
}

# Use incremental analysis
wundr analyze --incremental --baseline previous-analysis.json

# Profile memory usage
wundr analyze --profile-memory --max-memory 6144
```

## 🆘 Getting Additional Help

### Diagnostic Information

When reporting issues, include this diagnostic information:

```bash
# System information
wundr doctor --detailed > diagnostic-info.txt

# Configuration
wundr config show >> diagnostic-info.txt

# Recent logs
wundr logs --tail 50 >> diagnostic-info.txt

# Environment
wundr env >> diagnostic-info.txt
```

### Support Channels

1. **Community Support**:
   - [Discord Community](https://discord.gg/wundr)
   - [GitHub Discussions](https://github.com/adapticai/wundr/discussions)
   - [GitHub Issues](https://github.com/adapticai/wundr/issues)

2. **Professional Support**:
   - Enterprise Support: [enterprise@adaptic.ai](mailto:enterprise@adaptic.ai)
   - Priority Support for enterprise customers

3. **Documentation**:
   - [Complete Documentation](https://docs.wundr.io)
   - [API Reference](./API_REFERENCE.md)
   - [Best Practices](./BEST_PRACTICES.md)

### Creating Bug Reports

When creating a bug report, please include:

1. **Environment information** (from `wundr doctor`)
2. **Steps to reproduce** the issue
3. **Expected behavior** vs actual behavior
4. **Configuration files** (with sensitive data removed)
5. **Log output** or error messages
6. **Diagnostic information** (if applicable)

### Feature Requests

For feature requests, please:

1. Check existing [GitHub discussions](https://github.com/adapticai/wundr/discussions)
2. Provide a clear use case and rationale
3. Include examples or mockups if applicable
4. Consider contributing the feature yourself!

---

## 🔧 Emergency Recovery

### Complete Reset

If all else fails, perform a complete reset:

```bash
# 1. Uninstall Wundr
npm uninstall -g @adapticai/wundr

# 2. Clear all caches
npm cache clean --force
rm -rf ~/.wundr  # macOS/Linux
rmdir /s %USERPROFILE%\.wundr  # Windows

# 3. Clear Node.js cache
rm -rf ~/.npm  # macOS/Linux
rmdir /s %APPDATA%\npm-cache  # Windows

# 4. Reinstall with latest version
npm install -g @adapticai/wundr@latest

# 5. Verify installation
wundr --version
wundr doctor
```

### Backup and Restore

**Backup important data**:

```bash
# Backup configuration
wundr config backup

# Backup analysis results
cp -r wundr-output/ backup-$(date +%Y%m%d)/

# Backup custom plugins
cp -r ~/.wundr/plugins/ backup-plugins/
```

**Restore from backup**:

```bash
# Restore configuration
wundr config restore backup-20231201.json

# Restore analysis results
cp -r backup-20231201/ wundr-output/

# Restore plugins
cp -r backup-plugins/ ~/.wundr/plugins/
```

Remember: When in doubt, don't hesitate to reach out to our community for help! 🤝