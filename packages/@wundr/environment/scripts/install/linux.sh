#!/bin/bash

# Linux Installation Script for Wundr Environment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/../../logs/install-linux.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${GREEN}[INSTALL-LINUX]${NC} $1" | tee -a "$LOG_FILE"
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

# Detect Linux distribution
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        error "Cannot detect Linux distribution"
    fi
    
    log "Detected Linux distribution: $DISTRO $VERSION"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt update && sudo apt upgrade -y
            sudo apt install -y curl wget git build-essential software-properties-common
            ;;
        fedora)
            sudo dnf update -y
            sudo dnf install -y curl wget git @development-tools
            ;;
        centos|rhel)
            sudo yum update -y
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y curl wget git
            ;;
        arch)
            sudo pacman -Syu --noconfirm
            sudo pacman -S --noconfirm curl wget git base-devel
            ;;
        *)
            warning "Unsupported distribution: $DISTRO"
            ;;
    esac
    
    log "System packages updated"
}

# Install Homebrew for Linux
install_homebrew() {
    log "Installing Homebrew for Linux..."
    
    if command -v brew &>/dev/null; then
        log "Homebrew already installed"
        brew update
        return 0
    fi
    
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null
    
    # Add Homebrew to PATH
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "$HOME/.profile"
    
    log "Homebrew installed successfully"
}

# Install core tools via system package manager
install_core_tools_system() {
    log "Installing core tools via system package manager..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt install -y \
                jq tree htop tmux ripgrep fd-find bat exa \
                gnupg openssh-client coreutils
            ;;
        fedora)
            sudo dnf install -y \
                jq tree htop tmux ripgrep fd-find bat exa \
                gnupg2 openssh-clients coreutils
            ;;
        centos|rhel)
            # Enable EPEL for additional packages
            sudo yum install -y epel-release
            sudo yum install -y \
                jq tree htop tmux \
                gnupg2 openssh-clients coreutils
            ;;
        arch)
            sudo pacman -S --noconfirm \
                jq tree htop tmux ripgrep fd bat exa \
                gnupg openssh coreutils
            ;;
    esac
    
    log "Core system tools installed"
}

# Install additional tools via Homebrew
install_homebrew_tools() {
    log "Installing additional tools via Homebrew..."
    
    local formulas=(
        "fzf"
        "direnv"
        "gh"
    )
    
    for formula in "${formulas[@]}"; do
        log "Installing $formula..."
        brew install "$formula" || warning "Failed to install $formula"
    done
}

# Install Node.js via NodeSource
install_node() {
    log "Installing Node.js..."
    
    if command -v node &>/dev/null; then
        log "Node.js already installed: $(node --version)"
        return 0
    fi
    
    case $DISTRO in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora)
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo dnf install -y nodejs npm
            ;;
        centos|rhel)
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs npm
            ;;
        arch)
            sudo pacman -S --noconfirm nodejs npm
            ;;
    esac
    
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

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    if command -v docker &>/dev/null; then
        log "Docker already installed"
        return 0
    fi
    
    case $DISTRO in
        ubuntu|debian)
            curl -fsSL https://download.docker.com/linux/$DISTRO/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$DISTRO $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt update
            sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        fedora)
            sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel)
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        arch)
            sudo pacman -S --noconfirm docker docker-compose
            ;;
    esac
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log "Docker installed - please log out and back in for group changes to take effect"
}

# Install VS Code
install_vscode() {
    log "Installing Visual Studio Code..."
    
    if command -v code &>/dev/null; then
        log "VS Code already installed"
        return 0
    fi
    
    case $DISTRO in
        ubuntu|debian)
            wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
            sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
            echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list
            sudo apt update
            sudo apt install -y code
            ;;
        fedora)
            sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
            echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" | sudo tee /etc/yum.repos.d/vscode.repo
            sudo dnf install -y code
            ;;
        centos|rhel)
            sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
            echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" | sudo tee /etc/yum.repos.d/vscode.repo
            sudo yum install -y code
            ;;
        arch)
            yay -S --noconfirm visual-studio-code-bin || {
                log "Installing yay AUR helper first..."
                git clone https://aur.archlinux.org/yay.git
                cd yay
                makepkg -si --noconfirm
                cd ..
                rm -rf yay
                yay -S --noconfirm visual-studio-code-bin
            }
            ;;
    esac
    
    log "VS Code installed"
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
    
    if [[ -z "${SETUP_FULL_NAME:-}" ]]; then
        read -p "Enter your full name for Git: " SETUP_FULL_NAME
    fi
    
    if [[ -z "${SETUP_EMAIL:-}" ]]; then
        read -p "Enter your email for Git: " SETUP_EMAIL
    fi
    
    git config --global user.name "$SETUP_FULL_NAME"
    git config --global user.email "$SETUP_EMAIL"
    git config --global init.defaultBranch main
    git config --global pull.rebase false
    
    log "Git configured"
}

# Setup shell environment
setup_shell() {
    log "Setting up shell environment..."
    
    # Create ~/.bashrc if it doesn't exist
    touch "$HOME/.bashrc"
    
    # Add common aliases
    cat >> "$HOME/.bashrc" << 'EOF'

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

# Docker aliases
alias d='docker'
alias dc='docker-compose'
alias dps='docker ps'
alias di='docker images'
EOF

    # Also add to ~/.profile for login shells
    echo 'source ~/.bashrc' >> "$HOME/.profile"
    
    log "Shell environment configured"
}

# Main installation function
main() {
    log "Starting Linux environment installation..."
    
    detect_distro
    update_system
    install_homebrew
    install_core_tools_system
    install_homebrew_tools
    install_node
    install_package_managers
    install_docker
    install_vscode
    install_claude_code
    configure_git
    setup_shell
    
    log "Linux environment installation completed!"
    log "Please restart your terminal or run 'source ~/.profile' to apply all changes"
}

# Run main function
main "$@"