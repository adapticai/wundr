#!/usr/bin/env node

/**
 * Wundr Environment Quickstart - Ultra-fast <5 minute setup
 * Standalone executable for immediate environment setup
 */

const { execSync, spawn } = require('child_process');
const { existsSync, writeFileSync } = require('fs');
const { join, dirname } = require('path');
const { homedir } = require('os');

// Configuration
const TARGET_TIME = 300; // 5 minutes
const CACHE_DIR = join(homedir(), '.wundr', 'cache');
const LOG_DIR = join(homedir(), '.wundr', 'logs');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utility functions
function log(message, color = 'green') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function progress(message) {
  log(`🚀 ${message}`, 'cyan');
}

function hasCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function executeCommand(cmd, description, timeoutMs = 60000) {
  progress(description);
  try {
    const result = execSync(cmd, { 
      stdio: 'pipe',
      timeout: timeoutMs,
      encoding: 'utf8'
    });
    success(`${description} completed`);
    return result;
  } catch (err) {
    error(`${description} failed: ${err.message}`);
    throw err;
  }
}

async function createDirectories() {
  const dirs = [CACHE_DIR, LOG_DIR, join(homedir(), 'Development')];
  
  for (const dir of dirs) {
    try {
      execSync(`mkdir -p "${dir}"`, { stdio: 'ignore' });
    } catch (err) {
      warning(`Failed to create directory ${dir}: ${err.message}`);
    }
  }
}

function checkPrerequisites() {
  const platform = process.platform;
  
  if (platform !== 'darwin' && platform !== 'linux') {
    throw new Error(`Unsupported platform: ${platform}. Only macOS and Linux are supported.`);
  }
  
  // Check if running as root (not recommended)
  if (process.getuid && process.getuid() === 0) {
    warning('Running as root is not recommended. Some installations may fail.');
  }
  
  return platform;
}

function installHomebrew(platform) {
  if (hasCommand('brew')) {
    info('Homebrew already installed, updating...');
    executeCommand('brew update', 'Updating Homebrew', 120000);
    return;
  }
  
  info('Installing Homebrew...');
  const installScript = 'curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';
  
  try {
    executeCommand(`NONINTERACTIVE=1 bash -c "${installScript}"`, 'Installing Homebrew', 300000);
    
    // Add Homebrew to PATH
    if (platform === 'darwin') {
      if (existsSync('/opt/homebrew/bin/brew')) {
        executeCommand('echo \'eval "$(/opt/homebrew/bin/brew shellenv)"\' >> ~/.zprofile', 'Adding Homebrew to PATH');
        process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`;
      } else if (existsSync('/usr/local/bin/brew')) {
        executeCommand('echo \'eval "$(/usr/local/bin/brew shellenv)"\' >> ~/.zprofile', 'Adding Homebrew to PATH');
        process.env.PATH = `/usr/local/bin:${process.env.PATH}`;
      }
    } else {
      executeCommand('echo \'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"\' >> ~/.profile', 'Adding Homebrew to PATH');
      process.env.PATH = `/home/linuxbrew/.linuxbrew/bin:${process.env.PATH}`;
    }
    
  } catch (err) {
    error('Homebrew installation failed. Falling back to system package manager...');
    
    if (platform === 'linux') {
      executeCommand('sudo apt-get update && sudo apt-get install -y curl git build-essential', 'Installing essential packages');
    } else {
      throw err;
    }
  }
}

function installCoreTools() {
  const tools = ['git', 'curl', 'jq', 'tree'];
  const missing = tools.filter(tool => !hasCommand(tool));
  
  if (missing.length === 0) {
    info('Core tools already installed');
    return;
  }
  
  progress(`Installing core tools: ${missing.join(', ')}`);
  
  if (hasCommand('brew')) {
    executeCommand(`brew install ${missing.join(' ')}`, 'Installing core tools via Homebrew', 180000);
  } else if (process.platform === 'linux') {
    executeCommand(`sudo apt-get install -y ${missing.join(' ')}`, 'Installing core tools via apt', 180000);
  }
}

function installNode() {
  if (hasCommand('node') && hasCommand('npm')) {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    info(`Node.js already installed: ${nodeVersion}`);
    return;
  }
  
  progress('Installing Node.js...');
  
  if (hasCommand('brew')) {
    executeCommand('brew install node', 'Installing Node.js via Homebrew', 240000);
  } else {
    // Install Node.js via NodeSource
    executeCommand('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -', 'Adding NodeSource repository', 120000);
    executeCommand('sudo apt-get install -y nodejs', 'Installing Node.js', 180000);
  }
  
  // Configure npm
  executeCommand('npm config set init-author-name "Developer"', 'Configuring npm');
  executeCommand('npm config set init-license "MIT"', 'Configuring npm license');
}

function installEssentialPackages() {
  const packages = ['typescript', 'tsx', 'prettier', 'eslint'];
  const missing = [];
  
  for (const pkg of packages) {
    try {
      execSync(`npm list -g ${pkg}`, { stdio: 'ignore' });
    } catch {
      missing.push(pkg);
    }
  }
  
  if (missing.length === 0) {
    info('Essential packages already installed');
    return;
  }
  
  progress(`Installing global packages: ${missing.join(', ')}`);
  executeCommand(`npm install -g ${missing.join(' ')}`, 'Installing essential npm packages', 180000);
}

function installVSCode(platform) {
  if (hasCommand('code') || (platform === 'darwin' && existsSync('/Applications/Visual Studio Code.app'))) {
    info('VS Code already installed');
    return;
  }
  
  progress('Installing VS Code...');
  
  if (platform === 'darwin') {
    executeCommand('brew install --cask visual-studio-code', 'Installing VS Code via Homebrew Cask', 240000);
  } else {
    executeCommand(`
      wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg &&
      sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/ &&
      echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list &&
      sudo apt-get update &&
      sudo apt-get install -y code
    `, 'Installing VS Code on Linux', 300000);
  }
}

function installClaude() {
  if (hasCommand('claude')) {
    info('Claude Code already installed');
    return;
  }
  
  progress('Installing Claude Code...');
  
  try {
    executeCommand('npm install -g @anthropic-ai/claude-code', 'Installing Claude Code via npm', 120000);
  } catch {
    warning('NPM installation failed, trying alternative method...');
    try {
      executeCommand('curl -fsSL claude.ai/install.sh | bash', 'Installing Claude Code via curl', 120000);
    } catch {
      warning('Claude Code installation failed. You can install it manually later.');
    }
  }
  
  // Create basic Claude configuration
  const claudeConfigDir = join(homedir(), '.config', 'claude');
  try {
    execSync(`mkdir -p "${claudeConfigDir}"`, { stdio: 'ignore' });
    
    const config = {
      model: { default: 'claude-3-5-sonnet-20241022' },
      editor: 'code',
      theme: 'dark',
      autoSave: true,
      telemetry: false
    };
    
    writeFileSync(join(claudeConfigDir, 'config.json'), JSON.stringify(config, null, 2));
    info('Claude Code configured');
  } catch (err) {
    warning('Failed to create Claude configuration');
  }
}

function setupDevelopmentEnvironment() {
  progress('Setting up development environment...');
  
  // Create development directory structure
  const devPaths = [
    'Development',
    'Development/projects',
    'Development/tools',
    'Development/templates'
  ];
  
  for (const path of devPaths) {
    try {
      execSync(`mkdir -p "${join(homedir(), path)}"`, { stdio: 'ignore' });
    } catch (err) {
      warning(`Failed to create directory ${path}`);
    }
  }
  
  // Setup shell aliases
  const aliases = `
# Wundr Quickstart Aliases
alias dev='cd ~/Development'
alias proj='cd ~/Development/projects'
alias ll='ls -la'
alias cls='clear'

# Development shortcuts
alias ni='npm install'
alias nr='npm run'
alias ns='npm start'
alias nt='npm test'

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'

# Claude shortcuts
alias cl='claude'

export PATH="$HOME/.npm-global/bin:$PATH"
`;

  const shellFiles = ['.zshrc', '.bashrc'];
  for (const shellFile of shellFiles) {
    const shellPath = join(homedir(), shellFile);
    try {
      let content = '';
      try {
        content = require('fs').readFileSync(shellPath, 'utf8');
      } catch {
        // File doesn't exist
      }
      
      if (!content.includes('# Wundr Quickstart Aliases')) {
        require('fs').appendFileSync(shellPath, aliases);
      }
    } catch (err) {
      warning(`Failed to update ${shellFile}`);
    }
  }
}

function createSampleProject() {
  const projectPath = join(homedir(), 'Development', 'projects', 'sample-project');
  
  try {
    execSync(`mkdir -p "${projectPath}"`, { stdio: 'ignore' });
    
    const packageJson = {
      name: 'sample-project',
      version: '1.0.0',
      description: 'Sample project created by Wundr Quickstart',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'nodemon index.js',
        test: 'echo "No tests specified"'
      },
      license: 'MIT'
    };
    
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    const indexJs = `// Sample project created by Wundr Quickstart
console.log("Hello from your development environment! 🚀");
console.log("Environment setup completed successfully!");
`;
    
    writeFileSync(join(projectPath, 'index.js'), indexJs);
    info('Sample project created in ~/Development/projects/sample-project');
  } catch (err) {
    warning('Failed to create sample project');
  }
}

function validateInstallation() {
  progress('Validating installation...');
  
  const tools = [
    { name: 'git', cmd: 'git --version' },
    { name: 'node', cmd: 'node --version' },
    { name: 'npm', cmd: 'npm --version' },
    { name: 'code', cmd: 'code --version' },
    { name: 'claude', cmd: 'claude --version' }
  ];
  
  const results = [];
  
  for (const tool of tools) {
    try {
      const version = execSync(tool.cmd, { encoding: 'utf8' }).trim().split('\n')[0];
      results.push(`✅ ${tool.name}: ${version}`);
    } catch {
      results.push(`❌ ${tool.name}: Not installed`);
    }
  }
  
  console.log('\n📊 Installation Summary:');
  results.forEach(result => console.log(`   ${result}`));
}

function printCompletionSummary(startTime, preset) {
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  const targetMet = duration < TARGET_TIME;
  
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.cyan}🎉 WUNDR ENVIRONMENT SETUP COMPLETED! 🎉${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`${colors.white}⏱️  Setup Time: ${duration} seconds${colors.reset}`);
  console.log(`${colors.white}🎯 Target Time: ${TARGET_TIME} seconds${colors.reset}`);
  console.log(`${colors.white}📊 Status: ${targetMet ? `${colors.green}✅ PASSED` : `${colors.yellow}⚠️  EXCEEDED`} (${targetMet ? 'Under' : 'Over'} target)${colors.reset}`);
  console.log(`${colors.white}🔧 Preset: ${preset}${colors.reset}`);
  console.log('='.repeat(60));
  
  console.log(`\n${colors.yellow}🚀 Quick Start Commands:${colors.reset}`);
  console.log('   dev                    # Go to Development folder');
  console.log('   proj                   # Go to Projects folder');
  console.log('   code .                 # Open VS Code');
  console.log('   claude                 # Start Claude AI assistant');
  console.log('   node index.js          # Run sample project');
  
  console.log(`\n${colors.yellow}📁 Directory Structure Created:${colors.reset}`);
  console.log('   ~/Development/         # Main development folder');
  console.log('   ~/Development/projects # Your projects');
  console.log('   ~/Development/tools    # Development tools');
  console.log('   ~/.wundr/              # Wundr configuration');
  
  console.log(`\n${colors.green}✨ Your optimized development environment is ready!${colors.reset}`);
  console.log(`${colors.blue}💡 Tip: Restart your terminal to apply all changes${colors.reset}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const preset = args.find(arg => arg.startsWith('--preset='))?.split('=')[1] || 'standard';
  const skipAI = args.includes('--skip-ai');
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log(`
Wundr Environment Quickstart - Ultra-fast development environment setup

USAGE:
  npx @wundr/environment quickstart [OPTIONS]

OPTIONS:
  --preset=<preset>    Setup preset: minimal, standard, full (default: standard)
  --skip-ai           Skip AI tools installation for faster setup
  --help, -h          Show this help message

PRESETS:
  minimal             Essential tools only (~2 minutes)
  standard            Full development environment (~5 minutes)  
  full                Everything including advanced tools (~7 minutes)

EXAMPLES:
  npx @wundr/environment quickstart
  npx @wundr/environment quickstart --preset=minimal
  npx @wundr/environment quickstart --skip-ai

TARGET: Complete setup in under 5 minutes (300 seconds)
`);
    return;
  }
  
  console.log(`${colors.magenta}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  🚀 WUNDR ENVIRONMENT QUICKSTART 🚀                         ║
║                                                               ║
║  Ultra-fast development environment setup in <5 minutes      ║
║  Preset: ${preset.padEnd(10)} | Target: ${TARGET_TIME} seconds                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  const startTime = Date.now();
  
  try {
    // Prerequisites check
    info('Checking prerequisites...');
    const platform = checkPrerequisites();
    success('Prerequisites check passed');
    
    // Create necessary directories
    await createDirectories();
    
    // Core installation steps
    installHomebrew(platform);
    installCoreTools();
    installNode();
    installEssentialPackages();
    
    if (preset !== 'minimal') {
      installVSCode(platform);
      
      if (!skipAI) {
        installClaude();
      }
    }
    
    // Environment setup
    setupDevelopmentEnvironment();
    createSampleProject();
    validateInstallation();
    
    // Completion summary
    printCompletionSummary(startTime, preset);
    
  } catch (err) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${colors.red}❌ Setup failed after ${duration} seconds${colors.reset}`);
    console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
    
    console.log(`\n${colors.yellow}💡 Recovery options:${colors.reset}`);
    console.log('   npx @wundr/environment quickstart --preset=minimal');
    console.log('   npx @wundr/environment quickstart --skip-ai');
    console.log(`   Check logs in: ${LOG_DIR}`);
    
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };