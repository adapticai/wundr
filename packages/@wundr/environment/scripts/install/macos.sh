#!/bin/bash

# macOS Installation Script for Wundr Environment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/../../logs/install-macos.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${GREEN}[INSTALL-MACOS]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    error "This script is for macOS only"
fi

# Install Xcode Command Line Tools (headless-safe: never blocks on a prompt)
install_xcode_tools() {
    log "Installing Xcode Command Line Tools..."

    if xcode-select -p &>/dev/null; then
        log "Xcode Command Line Tools already installed"
        return 0
    fi

    # Non-interactive install via softwareupdate (no GUI dialog, no clicks).
    local sentinel="/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress"
    touch "$sentinel"
    local label
    label="$(softwareupdate --list 2>/dev/null \
        | grep -E 'Command Line Tools' \
        | sed -E 's/^[^C]*//' \
        | sort -V \
        | tail -n1)"
    if [ -n "$label" ]; then
        log "Installing \"$label\" via softwareupdate..."
        softwareupdate --install "$label" --verbose || true
    elif [ -t 0 ]; then
        # Interactive console available: fall back to the GUI installer, then
        # poll (bounded) for completion instead of waiting on a key press.
        log "Falling back to the GUI installer (console attached)..."
        xcode-select --install || true
        local waited=0
        while ! xcode-select -p &>/dev/null; do
            sleep 5
            waited=$((waited + 5))
            if [ "$waited" -ge 1800 ]; then
                break
            fi
        done
    fi
    rm -f "$sentinel"

    if xcode-select -p &>/dev/null; then
        log "Xcode Command Line Tools installed successfully"
    else
        error "Failed to install Xcode Command Line Tools (run 'xcode-select --install' manually, then re-run)"
    fi
}

# Install Homebrew
install_homebrew() {
    log "Installing Homebrew..."
    
    if command -v brew &>/dev/null; then
        log "Homebrew already installed"
        brew update
        return 0
    fi
    
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null
    
    # Add Homebrew to PATH
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> "$HOME/.zprofile"
    fi
    
    log "Homebrew installed successfully"
}

# Install core tools
install_core_tools() {
    log "Installing core development tools..."
    
    local formulas=(
        "git"
        "gh"
        "curl"
        "wget"
        "jq"
        "tree"
        "htop"
        "tmux"
        "ripgrep"
        "fzf"
        "bat"
        "eza"
        "fd"
        "direnv"
        "gnupg"
        "openssh"
        "coreutils"
    )
    
    for formula in "${formulas[@]}"; do
        log "Installing $formula..."
        brew install "$formula" || warning "Failed to install $formula"
    done
}

# Install Node.js via Homebrew
install_node() {
    log "Installing Node.js..."
    
    if command -v node &>/dev/null; then
        log "Node.js already installed: $(node --version)"
        return 0
    fi
    
    brew install node@18
    
    if [[ -d "/opt/homebrew/opt/node@18/bin" ]]; then
        echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> "$HOME/.zprofile"
        export PATH="/opt/homebrew/opt/node@18/bin:$PATH"
    fi
    
    log "Node.js installed: $(node --version)"
}

# Install package managers
install_package_managers() {
    log "Installing package managers..."
    
    # Install pnpm
    if ! command -v pnpm &>/dev/null; then
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
    fi
    
    # Install yarn
    if ! command -v yarn &>/dev/null; then
        npm install -g yarn
    fi
    
    log "Package managers installed"
}

# Install development applications
install_dev_apps() {
    log "Installing development applications..."
    
    local casks=(
        "visual-studio-code"
        "docker"
        "postman"
        "iterm2"
        "slack"
        "zoom"
        "chrome"
        "firefox"
    )
    
    for cask in "${casks[@]}"; do
        log "Installing $cask..."
        brew install --cask "$cask" || warning "Failed to install $cask"
    done
}

# Install Claude Code
install_claude_code() {
    log "Installing Claude Code..."
    
    if command -v claude &>/dev/null; then
        log "Claude Code already installed"
        return 0
    fi
    
    # Try npm install first
    npm install -g @anthropic-ai/claude-code || {
        log "Installing Claude Code via curl..."
        curl -fsSL claude.ai/install.sh | bash
    }
    
    if command -v claude &>/dev/null; then
        log "Claude Code installed successfully"
    else
        warning "Claude Code installation failed"
    fi
}

# Configure git
configure_git() {
    log "Configuring Git..."

    # Only prompt when an interactive console is attached; otherwise require the
    # SETUP_FULL_NAME / SETUP_EMAIL env vars so unattended runs never block.
    if [[ -z "${SETUP_FULL_NAME:-}" && -t 0 ]]; then
        read -p "Enter your full name for Git: " SETUP_FULL_NAME
    fi

    if [[ -z "${SETUP_EMAIL:-}" && -t 0 ]]; then
        read -p "Enter your email for Git: " SETUP_EMAIL
    fi

    if [[ -z "${SETUP_FULL_NAME:-}" || -z "${SETUP_EMAIL:-}" ]]; then
        warning "Skipping git identity config (set SETUP_FULL_NAME and SETUP_EMAIL to configure non-interactively)"
    else
        git config --global user.name "$SETUP_FULL_NAME"
        git config --global user.email "$SETUP_EMAIL"
    fi

    git config --global init.defaultBranch main
    git config --global pull.rebase false

    log "Git configured"
}

# Setup shell environment
setup_shell() {
    log "Setting up shell environment..."
    
    # Create ~/.zshrc if it doesn't exist
    touch "$HOME/.zshrc"
    
    # Add common aliases
    cat >> "$HOME/.zshrc" << 'EOF'

# Development aliases
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias cls='clear'

# Git aliases
alias g='git'
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'

# Node aliases
alias ni='npm install'
alias nr='npm run'
alias ns='npm start'
alias nt='npm test'
alias nb='npm run build'

# pnpm aliases
alias pi='pnpm install'
alias pr='pnpm run'
alias ps='pnpm start'
alias pt='pnpm test'
alias pb='pnpm build'
EOF

    log "Shell environment configured"
}

# Main installation function
main() {
    log "Starting macOS environment installation..."
    
    install_xcode_tools
    install_homebrew
    install_core_tools
    install_node
    install_package_managers
    install_dev_apps
    install_claude_code
    configure_git
    setup_shell
    
    log "macOS environment installation completed!"
    log "Please restart your terminal to apply all changes"
}

# Run main function
main "$@"