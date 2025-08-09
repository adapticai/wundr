#!/bin/bash

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"

log() {
    echo -e "[PERMISSIONS] $1" | tee -a "$LOG_FILE"
}

setup_sudo_touchid() {
    if [[ "$OS" != "macos" ]]; then
        return 0
    fi
    
    log "Configuring sudo with Touch ID..."
    
    local sudo_config="/etc/pam.d/sudo"
    local touchid_line="auth       sufficient     pam_tid.so"
    
    if ! grep -q "pam_tid.so" "$sudo_config" 2>/dev/null; then
        log "Adding Touch ID support to sudo..."
        echo "$touchid_line" | sudo tee -a "$sudo_config" > /dev/null
    else
        log "Touch ID already configured for sudo"
    fi
}

fix_permissions() {
    log "Fixing common permission issues..."
    
    local dirs=(
        "$HOME/.npm"
        "$HOME/.npm/_npx"
        "$HOME/.npm/_cacache"
        "$HOME/.npm/_logs"
        "$HOME/.pnpm"
        "$HOME/.yarn"
        "$HOME/.nvm"
        "$HOME/.docker"
        "$HOME/.config"
        "$HOME/.cache"
        "$HOME/.claude"
        "$HOME/.claude-flow"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            log "Setting ownership for $dir"
            sudo chown -R "$(whoami)":"$(id -gn)" "$dir" 2>/dev/null || true
            # Also set proper permissions
            chmod -R u+rwX "$dir" 2>/dev/null || true
        fi
    done
    
    # Clean corrupted npm/npx cache if needed
    if [[ -d "$HOME/.npm/_npx" ]]; then
        log "Cleaning npx cache to prevent version conflicts..."
        rm -rf "$HOME/.npm/_npx" 2>/dev/null || sudo rm -rf "$HOME/.npm/_npx" 2>/dev/null || true
    fi
    
    # Reset npm cache permissions
    if [[ -d "$HOME/.npm" ]]; then
        log "Resetting npm cache permissions..."
        npm cache verify 2>/dev/null || true
    fi
    
    if [[ "$OS" == "macos" ]]; then
        if [[ -d "/usr/local" ]]; then
            log "Fixing /usr/local permissions..."
            sudo chown -R "$(whoami)":"admin" /usr/local/bin /usr/local/lib /usr/local/share 2>/dev/null || true
        fi
        
        # Fix Homebrew permissions if installed
        if [[ -d "/opt/homebrew" ]]; then
            log "Fixing Homebrew permissions..."
            sudo chown -R "$(whoami)":"admin" /opt/homebrew 2>/dev/null || true
        fi
    fi
}

setup_dev_directories() {
    log "Creating development directories..."
    
    local dev_dirs=(
        "${SETUP_ROOT_DIR}"
        "${SETUP_ROOT_DIR}/projects"
        "${SETUP_ROOT_DIR}/tools"
        "${SETUP_ROOT_DIR}/sandbox"
        "${SETUP_ROOT_DIR}/.config"
        "${SETUP_ROOT_DIR}/.claude-flow"
        "$HOME/.local/bin"
    )
    
    for dir in "${dev_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log "Created directory: $dir"
        fi
    done
    
    if [[ ! "$PATH" =~ $HOME/.local/bin ]]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    fi
}

configure_file_limits() {
    if [[ "$OS" == "macos" ]]; then
        log "Configuring file descriptor limits..."
        
        local plist_file="/Library/LaunchDaemons/limit.maxfiles.plist"
        
        if [[ ! -f "$plist_file" ]]; then
            cat << EOF | sudo tee "$plist_file" > /dev/null
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
        <string>launchctl</string>
        <string>limit</string>
        <string>maxfiles</string>
        <string>524288</string>
        <string>524288</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
            sudo launchctl load -w "$plist_file" 2>/dev/null || true
            log "File descriptor limits configured"
        fi
    fi
}

fix_npm_permissions() {
    log "Fixing npm and npx specific permissions..."
    
    # Ensure npm directories exist with correct ownership
    local npm_dirs=(
        "$HOME/.npm"
        "$HOME/.npm-global"
        "$HOME/.npm-packages"
    )
    
    for dir in "${npm_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            chown "$(whoami)":"$(id -gn)" "$dir"
        elif [[ -d "$dir" ]]; then
            # Fix ownership without sudo if possible
            chown -R "$(whoami)":"$(id -gn)" "$dir" 2>/dev/null || \
                sudo chown -R "$(whoami)":"$(id -gn)" "$dir" 2>/dev/null || true
        fi
    done
    
    # Configure npm to use a directory we own for global packages
    if command -v npm &> /dev/null; then
        log "Configuring npm global directory..."
        npm config set prefix "$HOME/.npm-global" 2>/dev/null || true
        
        # Add npm global bin to PATH if not already there
        local npm_global_bin="$HOME/.npm-global/bin"
        if [[ ! "$PATH" =~ $npm_global_bin ]]; then
            echo "export PATH=\"$npm_global_bin:\$PATH\"" >> "$HOME/.zshrc" 2>/dev/null || true
            echo "export PATH=\"$npm_global_bin:\$PATH\"" >> "$HOME/.bashrc" 2>/dev/null || true
            export PATH="$npm_global_bin:$PATH"
        fi
        
        # Clear any corrupted cache
        log "Clearing npm cache..."
        npm cache clean --force 2>/dev/null || true
    fi
    
    log "npm permissions fixed"
}

setup_ssh_permissions() {
    log "Setting up SSH directory permissions..."
    
    if [[ ! -d "$HOME/.ssh" ]]; then
        mkdir -p "$HOME/.ssh"
    fi
    
    chmod 700 "$HOME/.ssh"
    
    if [[ -f "$HOME/.ssh/config" ]]; then
        chmod 600 "$HOME/.ssh/config"
    fi
    
    for key in "$HOME/.ssh/"id_*; do
        if [[ -f "$key" && ! "$key" =~ \.pub$ ]]; then
            chmod 600 "$key"
        fi
    done
    
    for pubkey in "$HOME/.ssh/"*.pub; do
        if [[ -f "$pubkey" ]]; then
            chmod 644 "$pubkey"
        fi
    done
    
    log "SSH permissions configured"
}

main() {
    log "Starting permissions and security setup..."
    
    setup_sudo_touchid
    fix_permissions
    fix_npm_permissions
    setup_dev_directories
    configure_file_limits
    setup_ssh_permissions
    
    log "Permissions setup completed"
}

main