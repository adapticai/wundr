# Troubleshooting Guide

This guide helps you resolve common issues with new-starter and your development environment.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Permission Errors](#permission-errors)
- [Tool-Specific Issues](#tool-specific-issues)
- [Network and Proxy Issues](#network-and-proxy-issues)
- [Shell and Path Issues](#shell-and-path-issues)
- [Validation Failures](#validation-failures)
- [Recovery Steps](#recovery-steps)

## Installation Issues

### npm install fails

#### Error: EACCES permission denied

**Solution:**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Reinstall
npm install -g @adapticai/new-starter
```

#### Error: npm not found

**Solution:**
```bash
# Install Node.js first
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20
```

### new-starter command not found

**After global install:**
```bash
# Check npm global bin location
npm config get prefix

# Add to PATH (replace with your prefix)
export PATH="/usr/local/bin:$PATH"

# Or use npx
npx @adapticai/new-starter
```

## Permission Errors

### Sudo password required repeatedly

**Solution:**
```bash
# Enable Touch ID for sudo (macOS)
sudo sed -i '' '2i\
auth       sufficient     pam_tid.so
' /etc/pam.d/sudo

# Extend sudo timeout
sudo sh -c 'echo "Defaults timestamp_timeout=30" >> /etc/sudoers'
```

### Cannot write to /usr/local

**macOS Solution:**
```bash
# Fix Homebrew permissions
sudo chown -R $(whoami) /usr/local/bin /usr/local/lib /usr/local/share
```

**Alternative:**
```bash
# Use Homebrew's recommended location
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Permission denied on ~/.npm or ~/.nvm

```bash
# Fix ownership
sudo chown -R $(whoami) ~/.npm ~/.nvm ~/.pnpm ~/.yarn

# Fix permissions
chmod -R 755 ~/.npm ~/.nvm
```

## Tool-Specific Issues

### Homebrew

#### Installation hangs

```bash
# Kill existing processes
pkill -f brew

# Clean and retry
rm -rf /usr/local/Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### brew: command not found (Apple Silicon)

```bash
# Add Homebrew to PATH
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

#### brew: command not found (Intel)

```bash
# Add Homebrew to PATH
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"
```

### Node.js / NVM

#### nvm: command not found

```bash
# Reinstall NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Add to shell profile
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
```

#### Node version not changing

```bash
# Clear NVM cache
nvm cache clear

# Reinstall Node version
nvm uninstall 20
nvm install 20
nvm alias default 20
nvm use default
```

#### Global packages not found

```bash
# Check npm prefix
npm config get prefix

# Should be in NVM directory
npm config set prefix "$NVM_DIR/versions/node/$(node -v)/lib"

# Reinstall global packages
npm install -g typescript eslint prettier
```

### Docker

#### Docker daemon not running

**macOS:**
```bash
# Start Docker Desktop
open -a Docker

# Wait for startup (may take 1-2 minutes)
while ! docker system info > /dev/null 2>&1; do
    echo "Waiting for Docker to start..."
    sleep 2
done
```

**Linux:**
```bash
# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Cannot connect to Docker daemon

```bash
# Check Docker status
docker version

# Reset Docker Desktop (macOS)
killall Docker
rm -rf ~/Library/Containers/com.docker.docker
open -a Docker
```

### VS Code

#### code: command not found

**macOS:**
```bash
# Install code command from VS Code
# Open VS Code > Cmd+Shift+P > "Shell Command: Install 'code' command in PATH"

# Or manually add
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
```

**Linux:**
```bash
# Add to PATH
export PATH="$PATH:/usr/share/code/bin"
```

#### Extensions not installing

```bash
# Clear extension cache
rm -rf ~/.vscode/extensions

# Install manually
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

### GitHub CLI

#### gh: command not found

```bash
# Install via Homebrew
brew install gh

# Or download directly
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

#### gh auth login fails

```bash
# Use token authentication
gh auth login --with-token < ~/.github-token

# Or use browser
gh auth login --web
```

### Claude Tools

#### Claude Code not installing

```bash
# Try alternative installation
curl -fsSL claude.ai/install.sh | bash

# Or use npm directly
npm install -g @anthropic-ai/claude-code
```

#### Claude Flow fails to start

```bash
# Check prerequisites
claude --version  # Must be installed first

# Reinstall
npm uninstall -g claude-flow
npm install -g claude-flow

# Initialize config
claude-flow config init
```

## Network and Proxy Issues

### Behind Corporate Proxy

```bash
# Set proxy environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1,.company.com

# Configure npm
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Configure git
git config --global http.proxy http://proxy.company.com:8080
git config --global https.proxy http://proxy.company.com:8080
```

### SSL Certificate Issues

```bash
# Temporary fix (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm config set strict-ssl false

# Better solution - add corporate cert
export NODE_EXTRA_CA_CERTS=/path/to/corporate-cert.pem
```

### Slow Downloads

```bash
# Use different npm registry
npm config set registry https://registry.npmmirror.com

# Use different Homebrew mirror
export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.aliyun.com/homebrew/homebrew-bottles
```

## Shell and Path Issues

### Changes not taking effect

```bash
# Reload shell configuration
source ~/.zshrc  # for Zsh
source ~/.bashrc # for Bash

# Or start new terminal session
exec $SHELL
```

### Wrong shell being used

```bash
# Check current shell
echo $SHELL

# Change default shell to Zsh
chsh -s /bin/zsh

# Change default shell to Bash
chsh -s /bin/bash
```

### PATH variable corrupted

```bash
# Reset PATH to default
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Then add required paths
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.nvm/versions/node/v20.0.0/bin:$PATH"
export PATH="/opt/homebrew/bin:$PATH"  # Apple Silicon
```

## Validation Failures

### Running validation

```bash
new-starter validate
```

### Common validation errors

#### Homebrew not found
```bash
# Reinstall Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Node.js not found
```bash
# Install via NVM
nvm install 20
nvm use 20
nvm alias default 20
```

#### Docker not running
```bash
# Start Docker Desktop
open -a Docker  # macOS
systemctl start docker  # Linux
```

### Auto-fix issues

```bash
new-starter validate --fix
```

## Recovery Steps

### Complete Reset

```bash
# 1. Backup existing configuration
cp -r ~/.new-starter ~/.new-starter.backup

# 2. Remove all configurations
rm -rf ~/.new-starter
rm -rf ~/.npm ~/.nvm ~/.pnpm
rm -f ~/.zshrc ~/.bashrc

# 3. Reinstall shell profile
touch ~/.zshrc
echo 'export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"' >> ~/.zshrc

# 4. Reinstall new-starter
npm install -g @adapticai/new-starter

# 5. Run setup again
new-starter setup --skip-prompts
```

### Partial Recovery

```bash
# Reset specific tool
new-starter setup --only node

# Reset configuration only
new-starter config --reset

# Reinstall specific components
brew reinstall node
npm install -g npm@latest
```

### Rollback Changes

```bash
# Restore from Time Machine (macOS)
tmutil restore ~/.zshrc /path/to/backup

# Restore from backup
cp ~/.zshrc.backup ~/.zshrc
cp ~/.npmrc.backup ~/.npmrc
source ~/.zshrc
```

## Debug Mode

### Enable verbose output

```bash
# Run with verbose flag
new-starter setup --verbose

# Enable debug logging
export DEBUG=*
new-starter setup
```

### Check logs

```bash
# View setup logs
ls -la logs/
cat logs/setup_*.log

# View npm logs
npm config get cache
ls -la $(npm config get cache)/_logs/
```

### System Information

```bash
# Gather system info for bug reports
echo "OS: $(uname -a)"
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
echo "Shell: $SHELL"
echo "PATH: $PATH"
```

## Getting Help

### Resources

1. **GitHub Issues**: [Report bugs](https://github.com/adapticai/new-starter/issues)
2. **Discussions**: [Ask questions](https://github.com/adapticai/new-starter/discussions)
3. **Documentation**: [Full docs](https://github.com/adapticai/new-starter)

### Reporting Issues

When reporting issues, include:

1. **Error message** (full output)
2. **System information**:
   ```bash
   new-starter --version
   node --version
   npm --version
   uname -a
   ```
3. **Steps to reproduce**
4. **What you expected vs what happened**
5. **Logs** from `logs/` directory

### Common Solutions Checklist

- [ ] Restart terminal
- [ ] Run with sudo (if needed)
- [ ] Check internet connection
- [ ] Verify no proxy issues
- [ ] Update to latest version
- [ ] Clear npm cache: `npm cache clean --force`
- [ ] Reset configuration: `new-starter config --reset`
- [ ] Try with `--verbose` flag
- [ ] Check disk space: `df -h`
- [ ] Verify system requirements

## Platform-Specific Issues

### macOS Specific

#### Xcode Command Line Tools

```bash
# Install Xcode CLI tools
xcode-select --install

# Accept license
sudo xcodebuild -license accept
```

#### Rosetta 2 (Apple Silicon)

```bash
# Install Rosetta 2
softwareupdate --install-rosetta --agree-to-license
```

### Linux Specific

#### Missing dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y curl wget git build-essential

# RHEL/CentOS
sudo yum groupinstall "Development Tools"
sudo yum install curl wget git
```

#### SELinux issues

```bash
# Check SELinux status
sestatus

# Temporarily disable (not recommended for production)
sudo setenforce 0
```

## Emergency Contacts

If all else fails:

1. Create issue: https://github.com/adapticai/new-starter/issues
2. Email support: support@adapticai.com (if available)
3. Community Discord: [Join Discord](https://discord.gg/adapticai)

Remember: Most issues can be resolved by:
1. Restarting your terminal
2. Running `source ~/.zshrc`
3. Reinstalling the problematic tool
4. Checking file permissions