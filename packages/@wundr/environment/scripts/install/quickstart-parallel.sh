#!/bin/bash

# Ultra-fast parallel installation script for <5 minute setup
# Optimized for concurrent execution with smart caching

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="$HOME/.wundr/cache"
LOG_DIR="$HOME/.wundr/logs"
PARALLEL_JOBS=${PARALLEL_JOBS:-4}
TIMEOUT=${TIMEOUT:-300}
PRESET=${PRESET:-standard}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Progress tracking
TOTAL_STEPS=0
CURRENT_STEP=0
START_TIME=$(date +%s)

mkdir -p "$CACHE_DIR" "$LOG_DIR"

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/quickstart.log"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/quickstart.log"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/quickstart.log"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/quickstart.log"
}

progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local elapsed=$(($(date +%s) - START_TIME))
    local percent=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    echo -e "${PURPLE}[$CURRENT_STEP/$TOTAL_STEPS - ${percent}% - ${elapsed}s]${NC} $1"
}

# Check if command exists
has_command() {
    command -v "$1" &> /dev/null
}

# Check if application exists (macOS)
has_app() {
    [[ -d "/Applications/$1" ]] || [[ -d "$HOME/Applications/$1" ]]
}

# Execute with timeout and logging
execute_with_timeout() {
    local cmd="$1"
    local desc="$2"
    local timeout="${3:-60}"
    
    progress "$desc"
    
    if timeout "$timeout" bash -c "$cmd" >> "$LOG_DIR/quickstart.log" 2>&1; then
        log "✅ $desc completed"
        return 0
    else
        error "❌ $desc failed or timed out"
        return 1
    fi
}

# Parallel execution wrapper
run_parallel() {
    local -a pids=()
    local -a tasks=()
    local max_jobs=${1:-$PARALLEL_JOBS}
    shift
    
    tasks=("$@")
    
    for task in "${tasks[@]}"; do
        # Wait if we have too many background jobs
        while (( $(jobs -r | wc -l) >= max_jobs )); do
            sleep 0.1
        done
        
        # Execute task in background
        eval "$task" &
        pids+=($!)
    done
    
    # Wait for all background jobs to complete
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            failed=$((failed + 1))
        fi
    done
    
    return $failed
}

# System analysis
analyze_system() {
    info "🔍 Analyzing system state..."
    
    local os_type=""
    case "$(uname -s)" in
        Darwin) os_type="macos" ;;
        Linux)  os_type="linux" ;;
        *)      os_type="unknown" ;;
    esac
    
    # Create analysis cache
    cat > "$CACHE_DIR/system_analysis.json" << EOF
{
  "timestamp": $(date +%s),
  "os_type": "$os_type",
  "has_homebrew": $(has_command brew && echo true || echo false),
  "has_node": $(has_command node && echo true || echo false),
  "has_git": $(has_command git && echo true || echo false),
  "has_docker": $(has_command docker && echo true || echo false),
  "has_claude": $(has_command claude && echo true || echo false),
  "has_claude_flow": $(has_command claude-flow && echo true || echo false),
  "has_vscode": $(has_command code && echo true || echo false),
  "preset": "$PRESET"
}
EOF
    
    log "📊 System analysis completed"
}

# Install Homebrew (macOS/Linux)
install_homebrew() {
    if has_command brew; then
        progress "Homebrew already installed, updating..."
        brew update >> "$LOG_DIR/quickstart.log" 2>&1
        return 0
    fi
    
    progress "Installing Homebrew..."
    
    # Use cached installer if available
    local installer_path="$CACHE_DIR/homebrew-install.sh"
    if [[ ! -f "$installer_path" || $(($(date +%s) - $(stat -c %Y "$installer_path" 2>/dev/null || echo 0))) -gt 86400 ]]; then
        curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh > "$installer_path"
    fi
    
    NONINTERACTIVE=1 bash "$installer_path" >> "$LOG_DIR/quickstart.log" 2>&1
    
    # Add to PATH
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> "$HOME/.zprofile"
    elif [[ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]]; then
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "$HOME/.profile"
    fi
    
    log "🍺 Homebrew installed successfully"
}

# Install core tools in parallel
install_core_tools_parallel() {
    local tasks=()
    
    # Essential tools that can be installed in parallel
    if ! has_command git; then
        tasks+=("execute_with_timeout 'brew install git' 'Git installation' 120")
    fi
    
    if ! has_command curl; then
        tasks+=("execute_with_timeout 'brew install curl' 'cURL installation' 60")
    fi
    
    if ! has_command jq; then
        tasks+=("execute_with_timeout 'brew install jq' 'jq installation' 60")
    fi
    
    if ! has_command tree; then
        tasks+=("execute_with_timeout 'brew install tree' 'tree installation' 60")
    fi
    
    if ! has_command fzf; then
        tasks+=("execute_with_timeout 'brew install fzf' 'fzf installation' 60")
    fi
    
    if [[ ${#tasks[@]} -gt 0 ]]; then
        progress "Installing core tools in parallel..."
        run_parallel 4 "${tasks[@]}"
    else
        progress "Core tools already installed"
    fi
}

# Install Node.js ecosystem
install_node_ecosystem() {
    if has_command node && has_command npm; then
        progress "Node.js already installed, checking version..."
        local node_version=$(node --version 2>/dev/null || echo "unknown")
        log "📦 Node.js version: $node_version"
        return 0
    fi
    
    progress "Installing Node.js ecosystem..."
    
    # Install Node.js via Homebrew (faster than NVM for quickstart)
    execute_with_timeout 'brew install node' 'Node.js installation' 180
    
    # Configure npm for speed
    npm config set registry https://registry.npmjs.org/
    npm config set fetch-retries 3
    npm config set fetch-retry-factor 10
    npm config set fetch-retry-mintimeout 10000
    npm config set fetch-retry-maxtimeout 60000
    
    log "📦 Node.js ecosystem installed"
}

# Install essential global packages in parallel
install_global_packages_parallel() {
    local packages=()
    
    # Check which packages are missing
    local essential_packages=("typescript" "tsx" "prettier" "eslint")
    
    for pkg in "${essential_packages[@]}"; do
        if ! npm list -g "$pkg" &>/dev/null; then
            packages+=("$pkg")
        fi
    done
    
    if [[ ${#packages[@]} -gt 0 ]]; then
        progress "Installing global packages: ${packages[*]}"
        # Install all packages in one command for speed
        npm install -g "${packages[@]}" >> "$LOG_DIR/quickstart.log" 2>&1
    else
        progress "Essential global packages already installed"
    fi
}

# Install Docker (minimal setup)
install_docker_minimal() {
    if has_command docker; then
        progress "Docker already installed"
        return 0
    fi
    
    progress "Installing Docker..."
    
    if [[ "$(uname -s)" == "Darwin" ]]; then
        # Use Homebrew for faster installation
        execute_with_timeout 'brew install --cask docker' 'Docker Desktop installation' 300
    else
        # Linux - install docker.io package
        execute_with_timeout 'sudo apt-get update && sudo apt-get install -y docker.io' 'Docker installation' 180
        execute_with_timeout 'sudo systemctl enable docker' 'Docker service enable' 30
        execute_with_timeout 'sudo usermod -aG docker $USER' 'Docker user setup' 30
    fi
    
    log "🐳 Docker installed"
}

# Install VS Code with essential extensions
install_vscode_optimized() {
    if has_command code || has_app "Visual Studio Code.app"; then
        progress "VS Code already installed"
        return 0
    fi
    
    progress "Installing VS Code..."
    
    if [[ "$(uname -s)" == "Darwin" ]]; then
        execute_with_timeout 'brew install --cask visual-studio-code' 'VS Code installation' 180
    else
        # Linux installation
        execute_with_timeout '
        wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg &&
        sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/ &&
        echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list &&
        sudo apt-get update &&
        sudo apt-get install -y code
        ' 'VS Code installation' 240
    fi
    
    # Install essential extensions in background
    if has_command code; then
        local extensions=("ms-vscode.vscode-typescript-next" "esbenp.prettier-vscode" "ms-vscode.vscode-eslint")
        for ext in "${extensions[@]}"; do
            code --install-extension "$ext" >> "$LOG_DIR/quickstart.log" 2>&1 &
        done
    fi
    
    log "📝 VS Code installed with extensions"
}

# Install Claude AI tools (optimized)
install_claude_optimized() {
    local has_claude=$(has_command claude)
    local has_claude_flow=$(has_command claude-flow)
    
    if [[ "$has_claude" == true && "$has_claude_flow" == true ]]; then
        progress "Claude tools already installed"
        return 0
    fi
    
    progress "Installing Claude AI tools..."
    
    local tasks=()
    
    if [[ "$has_claude" != true ]]; then
        tasks+=("execute_with_timeout 'npm install -g @anthropic-ai/claude-code || curl -fsSL claude.ai/install.sh | bash' 'Claude Code installation' 120")
    fi
    
    if [[ "$has_claude_flow" != true ]]; then
        tasks+=("execute_with_timeout 'npm install -g claude-flow@alpha' 'Claude Flow installation' 120")
    fi
    
    if [[ ${#tasks[@]} -gt 0 ]]; then
        run_parallel 2 "${tasks[@]}"
    fi
    
    # Create basic configuration
    mkdir -p "$HOME/.config/claude" "$HOME/.claude-flow"
    
    cat > "$HOME/.config/claude/config.json" << EOF
{
  "model": {
    "default": "claude-3-5-sonnet-20241022",
    "enforceModel": false
  },
  "editor": "code",
  "theme": "dark",
  "autoSave": true,
  "telemetry": false
}
EOF
    
    cat > "$HOME/.claude-flow/global-config.json" << EOF
{
  "version": "2.0.0-alpha",
  "global": {
    "defaultModel": "claude-3-5-sonnet-20241022",
    "maxConcurrentAgents": 4
  },
  "swarm": {
    "enabled": true,
    "workers": {
      "count": 4
    }
  }
}
EOF
    
    log "🤖 Claude AI tools configured"
}

# Setup development environment
setup_development_environment() {
    progress "Setting up development environment..."
    
    # Create directory structure
    mkdir -p "$HOME/Development"/{projects,tools,templates}
    
    # Create shell aliases
    local shell_config=""
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == *"zsh" ]]; then
        shell_config="$HOME/.zshrc"
    else
        shell_config="$HOME/.bashrc"
    fi
    
    # Add aliases if not already present
    if ! grep -q "# Wundr Quick Setup" "$shell_config" 2>/dev/null; then
        cat >> "$shell_config" << 'EOF'

# Wundr Quick Setup Aliases
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
alias clf='claude-flow'

export PATH="$HOME/.npm-global/bin:$PATH"
EOF
    fi
    
    log "🏗️ Development environment configured"
}

# Cleanup and optimization
cleanup_and_optimize() {
    progress "Cleaning up and optimizing..."
    
    # Clean package caches
    if has_command brew; then
        brew cleanup >> "$LOG_DIR/quickstart.log" 2>&1 &
    fi
    
    if has_command npm; then
        npm cache clean --force >> "$LOG_DIR/quickstart.log" 2>&1 &
    fi
    
    # Create completion marker
    cat > "$CACHE_DIR/quickstart_completed.json" << EOF
{
  "timestamp": $(date +%s),
  "preset": "$PRESET",
  "version": "1.0.0",
  "duration_seconds": $(($(date +%s) - START_TIME))
}
EOF
    
    log "🧹 Cleanup completed"
}

# Validate installation
validate_installation() {
    progress "Validating installation..."
    
    local validation_results=()
    local tools=("git" "node" "npm" "code")
    
    if [[ "$PRESET" != "minimal" ]]; then
        tools+=("docker" "claude")
    fi
    
    for tool in "${tools[@]}"; do
        if has_command "$tool"; then
            validation_results+=("✅ $tool")
        else
            validation_results+=("❌ $tool")
        fi
    done
    
    log "🔍 Validation results:"
    printf '%s\n' "${validation_results[@]}"
}

# Main execution function
main() {
    local preset_tasks=()
    
    # Set total steps based on preset
    case "$PRESET" in
        "minimal")
            TOTAL_STEPS=8
            preset_tasks=(
                "analyze_system"
                "install_homebrew"
                "install_core_tools_parallel"
                "install_node_ecosystem"
                "install_global_packages_parallel"
                "setup_development_environment"
                "cleanup_and_optimize"
                "validate_installation"
            )
            ;;
        "standard"|*)
            TOTAL_STEPS=10
            preset_tasks=(
                "analyze_system"
                "install_homebrew"
                "install_core_tools_parallel"
                "install_node_ecosystem"
                "install_global_packages_parallel"
                "install_docker_minimal"
                "install_vscode_optimized"
                "install_claude_optimized"
                "setup_development_environment"
                "cleanup_and_optimize"
                "validate_installation"
            )
            ;;
        "full")
            TOTAL_STEPS=11
            preset_tasks=(
                "analyze_system"
                "install_homebrew"
                "install_core_tools_parallel"
                "install_node_ecosystem"
                "install_global_packages_parallel"
                "install_docker_minimal"
                "install_vscode_optimized"
                "install_claude_optimized"
                "setup_development_environment"
                "cleanup_and_optimize"
                "validate_installation"
            )
            ;;
    esac
    
    log "🚀 Starting ultra-fast environment setup (preset: $PRESET)"
    log "⏱️  Target time: <300 seconds"
    
    # Execute tasks
    for task in "${preset_tasks[@]}"; do
        if ! $task; then
            error "Task $task failed"
            exit 1
        fi
    done
    
    local total_time=$(($(date +%s) - START_TIME))
    local status_icon=""
    local status_message=""
    
    if (( total_time < 300 )); then
        status_icon="🎉"
        status_message="SUCCESS: Environment setup completed in ${total_time}s (target: <300s)"
    else
        status_icon="⚠️"
        status_message="COMPLETED: Environment setup finished in ${total_time}s (exceeded 300s target)"
    fi
    
    echo -e "\n${GREEN}$status_icon $status_message${NC}"
    echo -e "${CYAN}📊 Setup Summary:${NC}"
    echo "   ⏱️  Total time: ${total_time} seconds"
    echo "   🎯 Target: <300 seconds"
    echo "   🔧 Preset: $PRESET"
    echo "   📁 Logs: $LOG_DIR/quickstart.log"
    
    echo -e "\n${YELLOW}🚀 Quick start commands:${NC}"
    echo "   wundr-env validate     # Check installation"
    echo "   wundr-env status       # Show environment status"
    echo "   dev                    # Go to Development folder"
    echo "   claude                 # Start Claude AI assistant"
    
    if has_command claude-flow; then
        echo "   claude-flow status     # Check AI agents"
    fi
    
    echo -e "\n${GREEN}✨ Your optimized development environment is ready!${NC}"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --preset)
            PRESET="$2"
            shift 2
            ;;
        --parallel-jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Execute main function
main "$@"