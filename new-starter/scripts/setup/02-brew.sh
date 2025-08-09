#!/bin/bash

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"

log() {
    echo -e "[BREW] $1" | tee -a "$LOG_FILE"
}

install_brew() {
    if command -v brew &> /dev/null; then
        log "Homebrew already installed"
        brew update
        return 0
    fi
    
    log "Installing Homebrew..."
    
    if [[ "$OS" == "macos" ]]; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/null
        
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            echo 'eval "$(/usr/local/bin/brew shellenv)"' >> "$HOME/.zprofile"
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    elif [[ "$OS" == "linux" ]]; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/null
        
        echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "$HOME/.profile"
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    fi
    
    log "Homebrew installed successfully"
}

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
        "watchman"
        "gnupg"
        "openssh"
        "coreutils"
    )
    
    for formula in "${formulas[@]}"; do
        if brew list "$formula" &>/dev/null; then
            log "$formula already installed"
        else
            log "Installing $formula..."
            brew install "$formula" || log "Failed to install $formula"
        fi
    done
}

install_dev_tools() {
    log "Installing development tools..."
    
    local dev_formulas=(
        "make"
        "cmake"
        "gcc"
        "python"
        "go"
        "rust"
        "sqlite"
        "postgresql"
        "redis"
        "nginx"
    )
    
    for formula in "${dev_formulas[@]}"; do
        if brew list "$formula" &>/dev/null; then
            log "$formula already installed"
        else
            log "Installing $formula..."
            brew install "$formula" || log "Warning: Failed to install $formula"
        fi
    done
}

configure_brew() {
    log "Configuring Homebrew settings..."
    
    export HOMEBREW_NO_ANALYTICS=1
    echo 'export HOMEBREW_NO_ANALYTICS=1' >> "$HOME/.zshrc"
    echo 'export HOMEBREW_NO_ANALYTICS=1' >> "$HOME/.bashrc"
    
    brew analytics off 2>/dev/null || true
    
    # These taps have been deprecated and are no longer needed
    # Fonts are now in homebrew/cask and services is built-in
    # brew tap homebrew/cask-fonts || true  # DEPRECATED
    # brew tap homebrew/services || true    # DEPRECATED
}

setup_brew_aliases() {
    log "Setting up Homebrew aliases..."
    
    cat >> "$HOME/.zshrc" << 'EOF'

# Homebrew aliases
alias brewup='brew update && brew upgrade && brew cleanup'
alias brewinfo='brew info'
alias brewsearch='brew search'
alias brewdeps='brew deps --tree --installed'
EOF
    
    cp "$HOME/.zshrc" "$HOME/.bashrc"
}

main() {
    log "Starting Homebrew setup..."
    
    install_brew
    
    if command -v brew &> /dev/null; then
        install_core_tools
        install_dev_tools
        configure_brew
        setup_brew_aliases
        
        log "Homebrew setup completed"
    else
        log "ERROR: Homebrew installation failed"
        exit 1
    fi
}

main