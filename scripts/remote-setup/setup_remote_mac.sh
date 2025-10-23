#!/usr/bin/env bash

################################################################################
# setup_remote_mac.sh
#
# Production-grade macOS remote access automation for headless/semi-headless
# Mac minis and Mac Studios running macOS 12-15 (Apple Silicon or Intel).
#
# Installs: Tailscale + (Parsec OR RustDesk) + LaunchDaemons + Power settings
#
# Usage:
#   sudo ./setup_remote_mac.sh [OPTIONS]
#
# Options:
#   --stack=[parsec|rustdesk]       Remote desktop stack (default: parsec)
#   --tailscale-auth-key=<KEY>      Tailscale auth key for unattended setup
#   --device-name=<NAME>            Device hostname (default: system hostname)
#   --ts-tags=<TAGS>                Tailscale tags (e.g., tag:remote,tag:studio)
#   --rustdesk-id-server=<HOST>     RustDesk ID server (optional)
#   --rustdesk-relay-server=<HOST>  RustDesk relay server (optional)
#   --prevent-sleep=[true|false]    Prevent system sleep (default: true)
#   --display-sleep-mins=<N>        Display sleep timeout (default: 10)
#   --verify-only                   Run verification checks only
#   --unattended                    Non-interactive mode
#
# Environment Variables (overridden by CLI flags):
#   TAILSCALE_AUTH_KEY
#   DEVICE_NAME
#   TS_TAGS
#   RUSTDESK_ID_SERVER
#   RUSTDESK_RELAY_SERVER
################################################################################

set -euo pipefail

################################################################################
# CONFIGURATION & DEFAULTS
################################################################################

SCRIPT_VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/remote-setup"
LOG_FILE="${LOG_DIR}/install.log"
LAUNCHD_DIR="${SCRIPT_DIR}/launchd"
PMSET_BACKUP="${LOG_DIR}/pmset_backup.txt"

# Defaults
STACK="${STACK:-parsec}"
TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
DEVICE_NAME="${DEVICE_NAME:-$(hostname -s)}"
TS_TAGS="${TS_TAGS:-}"
RUSTDESK_ID_SERVER="${RUSTDESK_ID_SERVER:-}"
RUSTDESK_RELAY_SERVER="${RUSTDESK_RELAY_SERVER:-}"
PREVENT_SLEEP="${PREVENT_SLEEP:-true}"
DISPLAY_SLEEP_MINS="${DISPLAY_SLEEP_MINS:-10}"
VERIFY_ONLY=false
UNATTENDED=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

################################################################################
# UTILITY FUNCTIONS
################################################################################

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    case "$level" in
        INFO)  echo -e "${CYAN}[INFO]${NC}  ${message}" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  ${message}" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${message}" | tee -a "$LOG_FILE" ;;
        SUCCESS) echo -e "${GREEN}[✓]${NC}    ${message}" | tee -a "$LOG_FILE" ;;
        STEP) echo -e "\n${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
              echo -e "${MAGENTA}║${NC} ${message}" | tee -a "$LOG_FILE"
              echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}\n" | tee -a "$LOG_FILE" ;;
        *)     echo -e "${message}" | tee -a "$LOG_FILE" ;;
    esac

    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
}

banner() {
    local message="$1"
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}  ${message}${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n" | tee -a "$LOG_FILE"
}

error_exit() {
    log ERROR "$1"
    exit 1
}

command_exists() {
    command -v "$1" &> /dev/null
}

wait_for_user() {
    if [[ "$UNATTENDED" == "true" ]]; then
        error_exit "User interaction required but running in unattended mode. $1"
    fi

    log WARN "$1"
    read -rp "Press Enter to continue after completing the above steps..."
}

retry_command() {
    local max_attempts="$1"
    local delay="$2"
    shift 2
    local command=("$@")
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if "${command[@]}"; then
            return 0
        fi

        log WARN "Attempt $attempt/$max_attempts failed. Retrying in ${delay}s..."
        sleep "$delay"
        ((attempt++))
    done

    return 1
}

################################################################################
# PRECONDITION CHECKS
################################################################################

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run with sudo or as root."
    fi
}

check_macos_version() {
    local version
    version="$(sw_vers -productVersion)"
    local major
    major="$(echo "$version" | cut -d. -f1)"

    if [[ $major -lt 12 ]]; then
        error_exit "macOS version $version is not supported. Requires macOS 12 or newer."
    fi

    log INFO "macOS version: $version"
}

detect_system() {
    log STEP "Detecting system configuration..."

    local arch
    arch="$(uname -m)"
    local model
    model="$(sysctl -n hw.model)"
    local chip

    if [[ "$arch" == "arm64" ]]; then
        chip="Apple Silicon"
    else
        chip="Intel"
    fi

    log INFO "Architecture: $arch ($chip)"
    log INFO "Model: $model"

    check_macos_version

    # Network check
    if ! ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
        log WARN "No internet connectivity detected. Some installation steps may fail."
    else
        log SUCCESS "Internet connectivity confirmed"
    fi
}

################################################################################
# LOGGING SETUP
################################################################################

setup_logging() {
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    log INFO "=========================================="
    log INFO "Remote Mac Setup v${SCRIPT_VERSION}"
    log INFO "Started at: $(date)"
    log INFO "=========================================="
}

################################################################################
# PARSE ARGUMENTS
################################################################################

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --stack=*)
                STACK="${1#*=}"
                shift
                ;;
            --tailscale-auth-key=*)
                TAILSCALE_AUTH_KEY="${1#*=}"
                shift
                ;;
            --device-name=*)
                DEVICE_NAME="${1#*=}"
                shift
                ;;
            --ts-tags=*)
                TS_TAGS="${1#*=}"
                shift
                ;;
            --rustdesk-id-server=*)
                RUSTDESK_ID_SERVER="${1#*=}"
                shift
                ;;
            --rustdesk-relay-server=*)
                RUSTDESK_RELAY_SERVER="${1#*=}"
                shift
                ;;
            --prevent-sleep=*)
                PREVENT_SLEEP="${1#*=}"
                shift
                ;;
            --display-sleep-mins=*)
                DISPLAY_SLEEP_MINS="${1#*=}"
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --unattended)
                UNATTENDED=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done

    # Validate stack choice
    if [[ "$STACK" != "parsec" && "$STACK" != "rustdesk" ]]; then
        error_exit "Invalid stack: $STACK. Must be 'parsec' or 'rustdesk'."
    fi
}

show_usage() {
    cat << 'EOF'
Usage: sudo ./setup_remote_mac.sh [OPTIONS]

Options:
  --stack=[parsec|rustdesk]       Remote desktop stack (default: parsec)
  --tailscale-auth-key=<KEY>      Tailscale auth key for unattended setup
  --device-name=<NAME>            Device hostname (default: system hostname)
  --ts-tags=<TAGS>                Tailscale tags (e.g., tag:remote,tag:studio)
  --rustdesk-id-server=<HOST>     RustDesk ID server (optional)
  --rustdesk-relay-server=<HOST>  RustDesk relay server (optional)
  --prevent-sleep=[true|false]    Prevent system sleep (default: true)
  --display-sleep-mins=<N>        Display sleep timeout (default: 10)
  --verify-only                   Run verification checks only
  --unattended                    Non-interactive mode
  --help                          Show this help message

Environment Variables:
  TAILSCALE_AUTH_KEY
  DEVICE_NAME
  TS_TAGS
  RUSTDESK_ID_SERVER
  RUSTDESK_RELAY_SERVER

Example:
  sudo ./setup_remote_mac.sh --stack=parsec \
    --tailscale-auth-key=tskey-XXX \
    --device-name=studio-01 \
    --ts-tags=tag:remote,tag:studio

EOF
}

################################################################################
# HOMEBREW INSTALLATION
################################################################################

install_homebrew() {
    if command_exists brew; then
        log SUCCESS "Homebrew already installed"
        return 0
    fi

    log STEP "Installing Homebrew..."

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would install Homebrew"
        return 0
    fi

    # Run as the console user, not root
    local console_user
    console_user="$(stat -f%Su /dev/console)"

    if [[ -z "$console_user" || "$console_user" == "root" ]]; then
        log WARN "Cannot determine console user. Homebrew installation may require manual intervention."
        wait_for_user "Please install Homebrew manually from https://brew.sh and then continue."
        return 0
    fi

    log INFO "Installing Homebrew as user: $console_user"

    # Download and install Homebrew
    sudo -u "$console_user" /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
        log WARN "Homebrew installation failed or was cancelled. Continuing with manual package installation..."
        return 1
    }

    # Add Homebrew to PATH for this session
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi

    log SUCCESS "Homebrew installed successfully"
    return 0
}

################################################################################
# TAILSCALE INSTALLATION
################################################################################

install_tailscale() {
    log STEP "Installing and configuring Tailscale..."

    if command_exists tailscale; then
        log SUCCESS "Tailscale already installed"
    else
        if [[ "$VERIFY_ONLY" == "true" ]]; then
            log WARN "Verify-only mode: Would install Tailscale"
            return 0
        fi

        if command_exists brew; then
            log INFO "Installing Tailscale via Homebrew..."
            brew install --cask tailscale || error_exit "Failed to install Tailscale via Homebrew"
        else
            log INFO "Installing Tailscale from official package..."
            local pkg_url="https://pkgs.tailscale.com/stable/Tailscale-latest.pkg"
            local tmp_pkg="/tmp/Tailscale.pkg"

            curl -fsSL "$pkg_url" -o "$tmp_pkg" || error_exit "Failed to download Tailscale package"
            installer -pkg "$tmp_pkg" -target / || error_exit "Failed to install Tailscale package"
            rm -f "$tmp_pkg"
        fi

        log SUCCESS "Tailscale installed"
    fi

    # Start Tailscale service
    log INFO "Starting Tailscale service..."
    /Applications/Tailscale.app/Contents/MacOS/Tailscale &>/dev/null &
    sleep 3

    # Bring up Tailscale
    local tailscale_cmd="tailscale up --hostname=\"${DEVICE_NAME}\" --accept-dns=true --accept-routes=true --ssh=true"

    if [[ -n "$TAILSCALE_AUTH_KEY" ]]; then
        tailscale_cmd+=" --authkey=\"${TAILSCALE_AUTH_KEY}\""
    fi

    if [[ -n "$TS_TAGS" ]]; then
        tailscale_cmd+=" --advertise-tags=\"${TS_TAGS}\""
    fi

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would run: $tailscale_cmd"
        return 0
    fi

    log INFO "Configuring Tailscale: $tailscale_cmd"

    if [[ -z "$TAILSCALE_AUTH_KEY" ]]; then
        log WARN "No auth key provided. Starting interactive Tailscale authentication..."
        wait_for_user "Please complete Tailscale authentication in your browser, then return here."
        eval "$tailscale_cmd" || error_exit "Failed to bring up Tailscale"
    else
        eval "$tailscale_cmd" || error_exit "Failed to bring up Tailscale with auth key"
    fi

    # Verify Tailscale is running
    local ts_status
    ts_status="$(tailscale status 2>&1)" || error_exit "Tailscale status check failed"

    local ts_ip
    ts_ip="$(tailscale ip -4 2>/dev/null | head -n1)" || ts_ip="unknown"

    log SUCCESS "Tailscale is running"
    log INFO "Tailscale IP: $ts_ip"
    log INFO "Device name: $DEVICE_NAME"
}

################################################################################
# TCC PERMISSIONS HANDLING
################################################################################

check_tcc_permissions() {
    local app_name="$1"
    local app_path="$2"

    log INFO "Checking TCC permissions for $app_name..."

    # Screen Recording check
    local has_screen_recording=false
    if /usr/bin/sqlite3 /Library/Application\ Support/com.apple.TCC/TCC.db \
        "SELECT allowed FROM access WHERE service='kTCCServiceScreenCapture' AND client='${app_path}' AND allowed=1;" 2>/dev/null | grep -q 1; then
        has_screen_recording=true
    fi

    # Accessibility check
    local has_accessibility=false
    if /usr/bin/sqlite3 /Library/Application\ Support/com.apple.TCC/TCC.db \
        "SELECT allowed FROM access WHERE service='kTCCServiceAccessibility' AND client='${app_path}' AND allowed=1;" 2>/dev/null | grep -q 1; then
        has_accessibility=true
    fi

    if [[ "$has_screen_recording" == "true" && "$has_accessibility" == "true" ]]; then
        log SUCCESS "$app_name has all required TCC permissions"
        return 0
    fi

    log WARN "$app_name missing TCC permissions:"
    [[ "$has_screen_recording" == "false" ]] && log WARN "  - Screen Recording: NOT GRANTED"
    [[ "$has_accessibility" == "false" ]] && log WARN "  - Accessibility: NOT GRANTED"

    return 1
}

prompt_tcc_permissions() {
    local app_name="$1"
    local app_path="$2"

    log WARN "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log WARN " TCC PERMISSIONS REQUIRED"
    log WARN "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log WARN ""
    log WARN "Please grant the following permissions to ${app_name}:"
    log WARN ""
    log WARN "1. Open System Settings → Privacy & Security"
    log WARN "2. Click 'Screen Recording' and enable ${app_name}"
    log WARN "3. Click 'Accessibility' and enable ${app_name}"
    log WARN ""
    log WARN "Note: You may need to restart ${app_name} after granting permissions."
    log WARN "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ "$UNATTENDED" == "true" ]]; then
        error_exit "TCC permissions required but running in unattended mode. Please grant permissions manually and re-run."
    fi

    # Open System Settings to the right pane
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    sleep 2
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

    # Wait for permissions with timeout
    local max_wait=300  # 5 minutes
    local waited=0
    local check_interval=5

    while [[ $waited -lt $max_wait ]]; do
        read -t "$check_interval" -rp "Press Enter after granting permissions (or wait for auto-check in ${check_interval}s)... " || true

        if check_tcc_permissions "$app_name" "$app_path"; then
            log SUCCESS "TCC permissions granted for $app_name"
            return 0
        fi

        ((waited+=check_interval))
    done

    error_exit "Timeout waiting for TCC permissions. Please grant permissions and re-run the script."
}

ensure_tcc_permissions() {
    local app_name="$1"
    local app_path="$2"

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        check_tcc_permissions "$app_name" "$app_path" || log WARN "Verify-only mode: TCC permissions would be requested"
        return 0
    fi

    if ! check_tcc_permissions "$app_name" "$app_path"; then
        prompt_tcc_permissions "$app_name" "$app_path"
    fi
}

################################################################################
# PARSEC INSTALLATION
################################################################################

install_parsec() {
    log STEP "Installing and configuring Parsec..."

    local app_path="/Applications/Parsec.app"

    if [[ -d "$app_path" ]]; then
        log SUCCESS "Parsec already installed"
    else
        if [[ "$VERIFY_ONLY" == "true" ]]; then
            log WARN "Verify-only mode: Would install Parsec"
            return 0
        fi

        if command_exists brew; then
            log INFO "Installing Parsec via Homebrew..."
            brew install --cask parsec || error_exit "Failed to install Parsec via Homebrew"
        else
            log INFO "Installing Parsec from official DMG..."
            local dmg_url="https://builds.parsec.app/package/parsec-macos.dmg"
            local tmp_dmg="/tmp/parsec.dmg"

            curl -fsSL "$dmg_url" -o "$tmp_dmg" || error_exit "Failed to download Parsec"

            # Mount DMG
            local mount_point
            mount_point="$(hdiutil attach "$tmp_dmg" -nobrowse | grep '/Volumes/' | sed 's/.*\/Volumes/\/Volumes/')"

            # Copy app
            cp -R "${mount_point}/Parsec.app" /Applications/

            # Unmount and cleanup
            hdiutil detach "$mount_point" -quiet
            rm -f "$tmp_dmg"
        fi

        log SUCCESS "Parsec installed"
    fi

    # Ensure TCC permissions
    ensure_tcc_permissions "Parsec" "$app_path"

    # Configure Parsec for unattended access
    log INFO "Configuring Parsec for unattended access..."

    local parsec_config_dir="$HOME/Library/Application Support/Parsec"
    mkdir -p "$parsec_config_dir"

    # Note: Parsec requires GUI sign-in for the first time
    if [[ ! -f "$parsec_config_dir/config.txt" ]]; then
        log WARN "Parsec not yet configured. First-time setup required."

        if [[ "$VERIFY_ONLY" == "true" ]]; then
            log WARN "Verify-only mode: Would prompt for Parsec sign-in"
            return 0
        fi

        # Launch Parsec for first-time setup
        open -a Parsec

        wait_for_user "Please sign in to Parsec and enable 'Host' in Settings → Host. Enable 'Unattended Access' if you want to connect without anyone at the computer."

        # Verify config exists
        if [[ ! -f "$parsec_config_dir/config.txt" ]]; then
            log WARN "Parsec config not found. This may require manual configuration."
        fi
    fi

    # Create LaunchDaemon
    create_launchd_parsec

    log SUCCESS "Parsec configured"
}

create_launchd_parsec() {
    local plist_path="/Library/LaunchDaemons/com.adaptic.parsec.plist"

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would create LaunchDaemon at $plist_path"
        return 0
    fi

    log INFO "Creating Parsec LaunchDaemon..."

    # Copy plist from launchd directory or create it
    if [[ -f "${LAUNCHD_DIR}/com.adaptic.parsec.plist" ]]; then
        cp "${LAUNCHD_DIR}/com.adaptic.parsec.plist" "$plist_path"
    else
        cat > "$plist_path" << 'PARSEC_PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  LaunchDaemon for Parsec host - auto-start at boot
  Managed by setup_remote_mac.sh
-->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.adaptic.parsec</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Parsec.app/Contents/MacOS/Parsec</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/remote-setup/parsec.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/remote-setup/parsec.error.log</string>
    <key>ThrottleInterval</key>
    <integer>30</integer>
</dict>
</plist>
PARSEC_PLIST
    fi

    chown root:wheel "$plist_path"
    chmod 644 "$plist_path"

    log SUCCESS "Parsec LaunchDaemon created"
}

################################################################################
# RUSTDESK INSTALLATION
################################################################################

install_rustdesk() {
    log STEP "Installing and configuring RustDesk..."

    local app_path="/Applications/RustDesk.app"

    if [[ -d "$app_path" ]]; then
        log SUCCESS "RustDesk already installed"
    else
        if [[ "$VERIFY_ONLY" == "true" ]]; then
            log WARN "Verify-only mode: Would install RustDesk"
            return 0
        fi

        if command_exists brew; then
            log INFO "Installing RustDesk via Homebrew..."
            brew install --cask rustdesk || error_exit "Failed to install RustDesk via Homebrew"
        else
            log INFO "Installing RustDesk from official DMG..."

            # Detect architecture for correct download
            local arch
            arch="$(uname -m)"
            local dmg_url

            if [[ "$arch" == "arm64" ]]; then
                dmg_url="https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-aarch64.dmg"
            else
                dmg_url="https://github.com/rustdesk/rustdesk/releases/latest/download/rustdesk-x86_64.dmg"
            fi

            local tmp_dmg="/tmp/rustdesk.dmg"
            curl -fsSL "$dmg_url" -o "$tmp_dmg" || error_exit "Failed to download RustDesk"

            # Mount DMG
            local mount_point
            mount_point="$(hdiutil attach "$tmp_dmg" -nobrowse | grep '/Volumes/' | sed 's/.*\/Volumes/\/Volumes/')"

            # Copy app
            cp -R "${mount_point}/RustDesk.app" /Applications/

            # Unmount and cleanup
            hdiutil detach "$mount_point" -quiet
            rm -f "$tmp_dmg"
        fi

        log SUCCESS "RustDesk installed"
    fi

    # Ensure TCC permissions
    ensure_tcc_permissions "RustDesk" "$app_path"

    # Configure custom ID/Relay servers if provided
    if [[ -n "$RUSTDESK_ID_SERVER" || -n "$RUSTDESK_RELAY_SERVER" ]]; then
        configure_rustdesk_servers
    fi

    # Create LaunchDaemon
    create_launchd_rustdesk

    log SUCCESS "RustDesk configured"
}

configure_rustdesk_servers() {
    log INFO "Configuring RustDesk custom servers..."

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would configure RustDesk servers"
        return 0
    fi

    local config_file="$HOME/Library/Preferences/com.carriez.rustdesk.plist"

    # Create config directory if needed
    mkdir -p "$(dirname "$config_file")"

    # Write configuration using defaults
    if [[ -n "$RUSTDESK_ID_SERVER" ]]; then
        defaults write com.carriez.rustdesk id-server "$RUSTDESK_ID_SERVER"
        log INFO "Set RustDesk ID server: $RUSTDESK_ID_SERVER"
    fi

    if [[ -n "$RUSTDESK_RELAY_SERVER" ]]; then
        defaults write com.carriez.rustdesk relay-server "$RUSTDESK_RELAY_SERVER"
        log INFO "Set RustDesk relay server: $RUSTDESK_RELAY_SERVER"
    fi

    log SUCCESS "RustDesk custom servers configured"
}

create_launchd_rustdesk() {
    local plist_path="/Library/LaunchDaemons/com.adaptic.rustdesk.plist"

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would create LaunchDaemon at $plist_path"
        return 0
    fi

    log INFO "Creating RustDesk LaunchDaemon..."

    # Copy plist from launchd directory or create it
    if [[ -f "${LAUNCHD_DIR}/com.adaptic.rustdesk.plist" ]]; then
        cp "${LAUNCHD_DIR}/com.adaptic.rustdesk.plist" "$plist_path"
    else
        cat > "$plist_path" << 'RUSTDESK_PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  LaunchDaemon for RustDesk host - auto-start at boot
  Managed by setup_remote_mac.sh
-->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.adaptic.rustdesk</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/RustDesk.app/Contents/MacOS/RustDesk</string>
        <string>--server</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/remote-setup/rustdesk.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/remote-setup/rustdesk.error.log</string>
    <key>ThrottleInterval</key>
    <integer>30</integer>
</dict>
</plist>
RUSTDESK_PLIST
    fi

    chown root:wheel "$plist_path"
    chmod 644 "$plist_path"

    log SUCCESS "RustDesk LaunchDaemon created"
}

################################################################################
# POWER MANAGEMENT
################################################################################

configure_power_management() {
    log STEP "Configuring power management for headless operation..."

    # Backup current pmset configuration
    if [[ ! -f "$PMSET_BACKUP" ]]; then
        pmset -g > "$PMSET_BACKUP"
        log INFO "Backed up current power settings to $PMSET_BACKUP"
    fi

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would configure power management"
        return 0
    fi

    # Enable Wake-on-LAN
    log INFO "Enabling Wake-on-LAN..."
    pmset -a womp 1

    # Enable auto-restart after power failure
    log INFO "Enabling auto-restart after power failure..."
    pmset -a autorestart 1

    # Configure sleep settings
    if [[ "$PREVENT_SLEEP" == "true" ]]; then
        log INFO "Disabling system sleep..."
        pmset -a sleep 0
        pmset -a displaysleep "$DISPLAY_SLEEP_MINS"
        pmset -a disksleep 0
    else
        log INFO "Keeping default sleep settings"
    fi

    # Disable hibernate to prevent deep sleep issues
    log INFO "Disabling hibernation..."
    pmset -a hibernatemode 0

    # Show current settings
    log INFO "Current power settings:"
    pmset -g | tee -a "$LOG_FILE"

    log SUCCESS "Power management configured"
}

################################################################################
# LAUNCHD MANAGEMENT
################################################################################

load_launchd_services() {
    log STEP "Loading LaunchDaemon services..."

    local plist_path

    if [[ "$STACK" == "parsec" ]]; then
        plist_path="/Library/LaunchDaemons/com.adaptic.parsec.plist"
    else
        plist_path="/Library/LaunchDaemons/com.adaptic.rustdesk.plist"
    fi

    if [[ ! -f "$plist_path" ]]; then
        error_exit "LaunchDaemon plist not found: $plist_path"
    fi

    if [[ "$VERIFY_ONLY" == "true" ]]; then
        log WARN "Verify-only mode: Would load $plist_path"
        return 0
    fi

    # Unload if already loaded (for idempotency)
    launchctl unload "$plist_path" 2>/dev/null || true

    # Load the service
    log INFO "Loading $plist_path..."
    launchctl load -w "$plist_path" || error_exit "Failed to load LaunchDaemon"

    # Wait a moment for service to start
    sleep 3

    # Verify service is loaded
    if launchctl list | grep -q "com.adaptic.${STACK}"; then
        log SUCCESS "LaunchDaemon loaded successfully"
    else
        error_exit "LaunchDaemon failed to load"
    fi

    # Check if process is running
    local process_name
    if [[ "$STACK" == "parsec" ]]; then
        process_name="Parsec"
    else
        process_name="RustDesk"
    fi

    if pgrep -x "$process_name" > /dev/null; then
        log SUCCESS "$process_name process is running"
    else
        log WARN "$process_name process not detected. Check logs at /var/log/remote-setup/${STACK}.log"
    fi
}

################################################################################
# VERIFICATION
################################################################################

verify_installation() {
    log STEP "Verifying installation..."

    local errors=0

    # Check Tailscale
    log INFO "Checking Tailscale..."
    if command_exists tailscale; then
        local ts_ip
        ts_ip="$(tailscale ip -4 2>/dev/null | head -n1)" || ts_ip="N/A"
        log SUCCESS "Tailscale installed - IP: $ts_ip"
    else
        log ERROR "Tailscale not found"
        ((errors++))
    fi

    # Check remote desktop stack
    log INFO "Checking ${STACK}..."
    local app_name
    local app_path

    if [[ "$STACK" == "parsec" ]]; then
        app_name="Parsec"
        app_path="/Applications/Parsec.app"
    else
        app_name="RustDesk"
        app_path="/Applications/RustDesk.app"
    fi

    if [[ -d "$app_path" ]]; then
        log SUCCESS "$app_name installed at $app_path"
    else
        log ERROR "$app_name not found at $app_path"
        ((errors++))
    fi

    # Check TCC permissions
    if check_tcc_permissions "$app_name" "$app_path"; then
        log SUCCESS "$app_name has required TCC permissions"
    else
        log WARN "$app_name missing TCC permissions (may require manual approval)"
    fi

    # Check LaunchDaemon
    log INFO "Checking LaunchDaemon..."
    local plist_path="/Library/LaunchDaemons/com.adaptic.${STACK}.plist"

    if [[ -f "$plist_path" ]]; then
        log SUCCESS "LaunchDaemon plist exists"

        if launchctl list | grep -q "com.adaptic.${STACK}"; then
            log SUCCESS "LaunchDaemon is loaded"
        else
            log WARN "LaunchDaemon not loaded"
        fi
    else
        log ERROR "LaunchDaemon plist not found"
        ((errors++))
    fi

    # Check process
    local process_name
    if [[ "$STACK" == "parsec" ]]; then
        process_name="Parsec"
    else
        process_name="RustDesk"
    fi

    if pgrep -x "$process_name" > /dev/null; then
        log SUCCESS "$process_name process is running"
    else
        log WARN "$process_name process not running"
    fi

    # Check power settings
    log INFO "Checking power settings..."
    local womp
    womp="$(pmset -g | grep womp | awk '{print $2}')"
    if [[ "$womp" == "1" ]]; then
        log SUCCESS "Wake-on-LAN enabled"
    else
        log WARN "Wake-on-LAN not enabled"
    fi

    # Check displays
    log INFO "Checking displays..."
    local display_count
    display_count="$(system_profiler SPDisplaysDataType 2>/dev/null | grep -c "Display Type" || echo "0")"

    if [[ "$display_count" -eq 0 ]]; then
        log WARN "No displays detected - consider using an HDMI dummy plug for headless operation"
    else
        log INFO "Detected $display_count display(s)"
    fi

    echo ""
    log INFO "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log INFO " VERIFICATION SUMMARY"
    log INFO "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ $errors -eq 0 ]]; then
        log SUCCESS "All checks passed!"
    else
        log WARN "Verification completed with $errors error(s)"
    fi

    echo ""
    return $errors
}

################################################################################
# CONNECTION INSTRUCTIONS
################################################################################

show_connection_instructions() {
    log STEP "Connection Instructions"

    local ts_ip
    ts_ip="$(tailscale ip -4 2>/dev/null | head -n1)" || ts_ip="<tailscale-ip>"

    cat << EOF | tee -a "$LOG_FILE"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 HOW TO CONNECT FROM YOUR CLIENT MAC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Device Name: ${DEVICE_NAME}
Tailscale IP: ${ts_ip}
Remote Stack: ${STACK}

STEPS:

1. Install Tailscale on your client Mac:
   brew install --cask tailscale

2. Sign in to the same Tailscale network

3. Install ${STACK} client:
EOF

    if [[ "$STACK" == "parsec" ]]; then
        cat << 'EOF' | tee -a "$LOG_FILE"
   brew install --cask parsec

4. Launch Parsec and sign in with the same account

5. Connect to this Mac:
   - You should see it listed as an available computer
   - Click to connect

EOF
    else
        cat << 'EOF' | tee -a "$LOG_FILE"
   brew install --cask rustdesk

4. Launch RustDesk

5. Connect to this Mac:
   - Enter the connection ID displayed on this Mac
   - Or use the Tailscale IP address

EOF
    fi

    cat << 'EOF' | tee -a "$LOG_FILE"
HEADLESS OPERATION TIPS:

- If running truly headless, consider an HDMI dummy plug to enable
  display resolution settings

- The remote desktop service will auto-start on boot via LaunchDaemon

- You can access this Mac via SSH through Tailscale:
  ssh user@<tailscale-ip>

TROUBLESHOOTING:

- Check logs: /var/log/remote-setup/
- Verify TCC permissions in System Settings
- Ensure firewall allows remote connections
- Test Tailscale connectivity: tailscale ping <device-name>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    # Parse command-line arguments first
    parse_arguments "$@"

    # Must run as root
    check_root

    # Setup logging
    setup_logging

    # Print configuration
    banner "Remote Mac Setup - Starting Installation"
    log INFO "Configuration:"
    log INFO "  Stack: $STACK"
    log INFO "  Device Name: $DEVICE_NAME"
    log INFO "  Prevent Sleep: $PREVENT_SLEEP"
    log INFO "  Display Sleep: ${DISPLAY_SLEEP_MINS} minutes"
    log INFO "  Verify Only: $VERIFY_ONLY"
    log INFO "  Unattended: $UNATTENDED"
    [[ -n "$TS_TAGS" ]] && log INFO "  Tailscale Tags: $TS_TAGS"
    [[ -n "$RUSTDESK_ID_SERVER" ]] && log INFO "  RustDesk ID Server: $RUSTDESK_ID_SERVER"
    [[ -n "$RUSTDESK_RELAY_SERVER" ]] && log INFO "  RustDesk Relay Server: $RUSTDESK_RELAY_SERVER"
    echo ""

    # Detect system
    detect_system

    # If verify-only mode, just run verification and exit
    if [[ "$VERIFY_ONLY" == "true" ]]; then
        verify_installation
        exit $?
    fi

    # Install Homebrew (optional, for package management)
    install_homebrew || log WARN "Continuing without Homebrew"

    # Install and configure Tailscale
    install_tailscale

    # Install and configure remote desktop stack
    if [[ "$STACK" == "parsec" ]]; then
        install_parsec
    else
        install_rustdesk
    fi

    # Configure power management
    configure_power_management

    # Load LaunchDaemon services
    load_launchd_services

    # Run verification
    verify_installation

    # Show connection instructions
    show_connection_instructions

    log SUCCESS "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log SUCCESS " Installation completed successfully!"
    log SUCCESS "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log INFO "Log file: $LOG_FILE"
}

# Execute main function
main "$@"
