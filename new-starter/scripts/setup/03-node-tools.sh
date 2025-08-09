#!/bin/bash

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"

log() {
    echo -e "[NODE] $1" | tee -a "$LOG_FILE"
}

install_nvm() {
    log "Installing NVM (Node Version Manager)..."
    
    if [[ -d "$HOME/.nvm" ]]; then
        log "NVM already installed"
    else
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
        
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        cat >> "$HOME/.zshrc" << 'EOF'

# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto use .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="$(nvm version)"
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use
    fi
  elif [ "$node_version" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
EOF
        
        cp "$HOME/.zshrc" "$HOME/.bashrc"
        log "NVM installed successfully"
    fi
}

install_node_versions() {
    log "Installing Node.js versions..."
    
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Install LTS and current versions
    local node_versions=("lts/*" "node")
    
    for version in "${node_versions[@]}"; do
        log "Installing Node.js v$version..."
        nvm install "$version" || log "Failed to install Node.js v$version"
    done
    
    nvm alias default lts/*
    nvm use default
    
    log "Node.js versions installed"
}

configure_npm() {
    log "Configuring npm..."
    
    # Create npm-global directory structure first
    mkdir -p "$HOME/.npm-global"
    mkdir -p "$HOME/.npm-global/lib"
    mkdir -p "$HOME/.npm-global/bin"
    
    # Set npm prefix before any global installs
    npm config set prefix "$HOME/.npm-global"
    
    npm config set init-author-name "$SETUP_FULL_NAME"
    npm config set init-author-email "$SETUP_EMAIL"
    # Only set init-author-url if it's a valid URL
    if [[ -n "$SETUP_COMPANY" ]]; then
        if [[ "$SETUP_COMPANY" =~ ^https?:// ]]; then
            npm config set init-author-url "$SETUP_COMPANY"
        else
            npm config set init-author-url "https://$SETUP_COMPANY"
        fi
    fi
    npm config set init-license "MIT"
    
    # Update npm after setting prefix
    npm install -g npm@latest
    
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.zshrc"
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
    
    export PATH="$HOME/.npm-global/bin:$PATH"
    
    log "npm configured"
}

install_pnpm() {
    log "Installing pnpm..."
    
    if command -v pnpm &> /dev/null; then
        log "pnpm already installed"
        # pnpm self-update is deprecated, use npm to update instead
        npm update -g pnpm
    else
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
        
        cat >> "$HOME/.zshrc" << 'EOF'

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
EOF
        
        cp "$HOME/.zshrc" "$HOME/.bashrc"
    fi
    
    pnpm config set store-dir "$HOME/.pnpm-store"
    pnpm config set auto-install-peers true
    pnpm config set strict-peer-dependencies false
    
    log "pnpm installed and configured"
}

install_yarn() {
    log "Installing Yarn..."
    
    if command -v yarn &> /dev/null; then
        log "Yarn already installed"
    else
        npm install -g yarn
    fi
    
    yarn config set init-author-name "$SETUP_FULL_NAME"
    yarn config set init-author-email "$SETUP_EMAIL"
    yarn config set init-license "MIT"
    
    log "Yarn installed and configured"
}

install_global_packages() {
    log "Installing essential global npm packages..."
    
    local packages=(
        "typescript"
        "tsx"
        "ts-node"
        "@types/node"
        "nodemon"
        "pm2"
        "concurrently"
        "cross-env"
        "dotenv-cli"
        "npm-check-updates"
        "npx"
        "serve"
        "http-server"
        "json-server"
        "prettier"
        "eslint"
        "@biomejs/biome"
        "turbo"
        "lerna"
        "nx"
        "changesets"
        "@commitlint/cli"
        "@commitlint/config-conventional"
        "husky"
        "lint-staged"
        "standard-version"
        "release-it"
    )
    
    for package in "${packages[@]}"; do
        log "Installing $package globally..."
        npm install -g "$package" || log "Failed to install $package"
    done
    
    log "Global packages installed"
}

setup_node_aliases() {
    log "Setting up Node.js aliases..."
    
    cat >> "$HOME/.zshrc" << 'EOF'

# Node.js aliases
alias ni='npm install'
alias nid='npm install --save-dev'
alias nig='npm install -g'
alias nr='npm run'
alias ns='npm start'
alias nt='npm test'
alias nb='npm run build'
alias nw='npm run watch'
alias nd='npm run dev'

# pnpm aliases
alias pi='pnpm install'
alias pid='pnpm add -D'
alias pig='pnpm add -g'
alias pr='pnpm run'
alias ps='pnpm start'
alias pt='pnpm test'
alias pb='pnpm build'
alias pw='pnpm watch'
alias pd='pnpm dev'

# Yarn aliases
alias yi='yarn install'
alias yid='yarn add --dev'
alias yig='yarn global add'
alias yr='yarn run'
alias ys='yarn start'
alias yt='yarn test'
alias yb='yarn build'
alias yw='yarn watch'
alias yd='yarn dev'

# Package manager helpers
alias npm-latest='npm install -g npm@latest'
alias pnpm-latest='pnpm self-update'
alias yarn-latest='yarn set version stable'
alias check-updates='npx npm-check-updates'
alias clean-modules='find . -name "node_modules" -type d -prune -exec rm -rf {} +'
EOF
    
    cp "$HOME/.zshrc" "$HOME/.bashrc"
}

main() {
    log "Starting Node.js tools setup..."
    
    install_nvm
    install_node_versions
    configure_npm
    install_pnpm
    install_yarn
    install_global_packages
    setup_node_aliases
    
    log "Node.js tools setup completed"
}

main