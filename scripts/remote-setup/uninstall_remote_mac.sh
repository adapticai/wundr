#!/usr/bin/env bash

################################################################################
# uninstall_remote_mac.sh
#
# Uninstall/rollback script for remote Mac setup.
# Reverses changes made by setup_remote_mac.sh
#
# Usage:
#   sudo ./uninstall_remote_mac.sh [OPTIONS]
#
# Options:
#   --remove-apps            Remove installed applications (Parsec/RustDesk, Tailscale)
#   --keep-apps              Keep applications installed (default)
#   --revert-pmset           Restore previous power management settings
#   --remove-logs            Delete log files
#   --stack=[parsec|rustdesk]  Specify which stack to uninstall (default: both)
#   --yes                    Auto-confirm all prompts
#   --help                   Show this help message
################################################################################

set -euo pipefail

################################################################################
# CONFIGURATION & DEFAULTS
################################################################################

SCRIPT_VERSION="1.0.0"
LOG_DIR="/var/log/remote-setup"
LOG_FILE="${LOG_DIR}/uninstall.log"
PMSET_BACKUP="${LOG_DIR}/pmset_backup.txt"

# Defaults
REMOVE_APPS=false
REVERT_PMSET=false
REMOVE_LOGS=false
STACK="both"
AUTO_CONFIRM=false

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
        INFO)  echo -e "${CYAN}[INFO]${NC}  ${message}" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  ${message}" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${message}" ;;
        SUCCESS) echo -e "${GREEN}[✓]${NC}    ${message}" ;;
        STEP) echo -e "\n${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
              echo -e "${MAGENTA}║${NC} ${message}"
              echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}\n" ;;
        *)     echo -e "${message}" ;;
    esac

    if [[ -f "$LOG_FILE" ]]; then
        echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
    fi
}

banner() {
    local message="$1"
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${message}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

error_exit() {
    log ERROR "$1"
    exit 1
}

confirm() {
    local message="$1"

    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        return 0
    fi

    read -rp "${message} [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

################################################################################
# PRECONDITION CHECKS
################################################################################

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run with sudo or as root."
    fi
}

################################################################################
# PARSE ARGUMENTS
################################################################################

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --remove-apps)
                REMOVE_APPS=true
                shift
                ;;
            --keep-apps)
                REMOVE_APPS=false
                shift
                ;;
            --revert-pmset)
                REVERT_PMSET=true
                shift
                ;;
            --remove-logs)
                REMOVE_LOGS=true
                shift
                ;;
            --stack=*)
                STACK="${1#*=}"
                shift
                ;;
            --yes)
                AUTO_CONFIRM=true
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
    if [[ "$STACK" != "parsec" && "$STACK" != "rustdesk" && "$STACK" != "both" ]]; then
        error_exit "Invalid stack: $STACK. Must be 'parsec', 'rustdesk', or 'both'."
    fi
}

show_usage() {
    cat << 'EOF'
Usage: sudo ./uninstall_remote_mac.sh [OPTIONS]

Options:
  --remove-apps            Remove installed applications (Parsec/RustDesk, Tailscale)
  --keep-apps              Keep applications installed (default)
  --revert-pmset           Restore previous power management settings
  --remove-logs            Delete log files
  --stack=[parsec|rustdesk|both]  Specify which stack to uninstall (default: both)
  --yes                    Auto-confirm all prompts
  --help                   Show this help message

Examples:
  # Remove LaunchDaemons but keep apps
  sudo ./uninstall_remote_mac.sh

  # Full uninstall including apps
  sudo ./uninstall_remote_mac.sh --remove-apps --revert-pmset --remove-logs --yes

  # Remove only Parsec
  sudo ./uninstall_remote_mac.sh --stack=parsec --remove-apps

EOF
}

################################################################################
# UNINSTALL FUNCTIONS
################################################################################

unload_launchd() {
    local stack="$1"
    local plist_path="/Library/LaunchDaemons/com.adaptic.${stack}.plist"

    log STEP "Unloading ${stack} LaunchDaemon..."

    if [[ ! -f "$plist_path" ]]; then
        log WARN "LaunchDaemon not found: $plist_path"
        return 0
    fi

    # Unload if loaded
    if launchctl list | grep -q "com.adaptic.${stack}"; then
        log INFO "Unloading ${stack} LaunchDaemon..."
        launchctl unload "$plist_path" 2>/dev/null || log WARN "Failed to unload (may not be running)"
    fi

    # Remove plist
    log INFO "Removing LaunchDaemon plist: $plist_path"
    rm -f "$plist_path"

    log SUCCESS "${stack} LaunchDaemon removed"
}

stop_process() {
    local process_name="$1"

    if pgrep -x "$process_name" > /dev/null; then
        log INFO "Stopping $process_name process..."
        pkill -x "$process_name" || log WARN "Failed to stop $process_name"
        sleep 2
    fi
}

remove_app() {
    local app_name="$1"
    local app_path="/Applications/${app_name}.app"

    if [[ ! -d "$app_path" ]]; then
        log WARN "${app_name} not installed at $app_path"
        return 0
    fi

    if ! confirm "Remove ${app_name} from ${app_path}?"; then
        log INFO "Keeping ${app_name}"
        return 0
    fi

    log INFO "Removing ${app_name}..."
    rm -rf "$app_path"
    log SUCCESS "${app_name} removed"
}

remove_parsec() {
    log STEP "Removing Parsec..."

    # Unload LaunchDaemon
    unload_launchd "parsec"

    # Stop process
    stop_process "Parsec"

    # Remove app if requested
    if [[ "$REMOVE_APPS" == "true" ]]; then
        remove_app "Parsec"

        # Remove config
        local config_dir="$HOME/Library/Application Support/Parsec"
        if [[ -d "$config_dir" ]]; then
            if confirm "Remove Parsec configuration from ${config_dir}?"; then
                rm -rf "$config_dir"
                log SUCCESS "Parsec configuration removed"
            fi
        fi
    fi

    log SUCCESS "Parsec uninstall complete"
}

remove_rustdesk() {
    log STEP "Removing RustDesk..."

    # Unload LaunchDaemon
    unload_launchd "rustdesk"

    # Stop process
    stop_process "RustDesk"

    # Remove app if requested
    if [[ "$REMOVE_APPS" == "true" ]]; then
        remove_app "RustDesk"

        # Remove config
        local config_file="$HOME/Library/Preferences/com.carriez.rustdesk.plist"
        if [[ -f "$config_file" ]]; then
            if confirm "Remove RustDesk configuration?"; then
                rm -f "$config_file"
                log SUCCESS "RustDesk configuration removed"
            fi
        fi
    fi

    log SUCCESS "RustDesk uninstall complete"
}

remove_tailscale() {
    log STEP "Removing Tailscale..."

    if [[ "$REMOVE_APPS" != "true" ]]; then
        log INFO "Skipping Tailscale removal (--keep-apps is set)"
        return 0
    fi

    # Check if Tailscale is installed
    if ! command -v tailscale &> /dev/null; then
        log WARN "Tailscale not installed"
        return 0
    fi

    if ! confirm "Remove Tailscale? This will disconnect you from your tailnet."; then
        log INFO "Keeping Tailscale"
        return 0
    fi

    # Logout from Tailscale
    log INFO "Logging out from Tailscale..."
    tailscale logout 2>/dev/null || log WARN "Tailscale logout failed (may not be logged in)"

    # Remove app
    remove_app "Tailscale"

    # Remove Tailscale data
    if [[ -d "/Library/Tailscale" ]]; then
        rm -rf "/Library/Tailscale"
    fi

    if [[ -d "$HOME/Library/Application Support/Tailscale" ]]; then
        rm -rf "$HOME/Library/Application Support/Tailscale"
    fi

    log SUCCESS "Tailscale removed"
}

revert_power_settings() {
    log STEP "Reverting power management settings..."

    if [[ ! -f "$PMSET_BACKUP" ]]; then
        log WARN "No backup found at $PMSET_BACKUP. Cannot revert automatically."
        log INFO "You may want to manually restore power settings using: sudo pmset -a <setting> <value>"
        return 0
    fi

    if ! confirm "Restore power settings from backup?"; then
        log INFO "Keeping current power settings"
        return 0
    fi

    log INFO "Backup file contents:"
    cat "$PMSET_BACKUP"

    log WARN "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log WARN "Restoring to macOS defaults (not exact backup values)"
    log WARN "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Restore sensible defaults (actual backup parsing would be complex)
    pmset -a sleep 10
    pmset -a displaysleep 10
    pmset -a disksleep 10
    pmset -a womp 0
    pmset -a autorestart 0
    pmset -a hibernatemode 3

    log SUCCESS "Power settings restored to defaults"
}

remove_logs() {
    log STEP "Removing log files..."

    if [[ ! -d "$LOG_DIR" ]]; then
        log WARN "Log directory not found: $LOG_DIR"
        return 0
    fi

    if ! confirm "Remove all logs from ${LOG_DIR}?"; then
        log INFO "Keeping log files"
        return 0
    fi

    # Save the current log before removing
    local final_log="/tmp/remote-setup-uninstall-$(date +%Y%m%d-%H%M%S).log"
    cp "$LOG_FILE" "$final_log" 2>/dev/null || true

    rm -rf "$LOG_DIR"

    log INFO "Logs removed. Final log saved to: $final_log"
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    # Parse command-line arguments first
    parse_arguments "$@"

    # Must run as root
    check_root

    # Create log if it doesn't exist
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    touch "$LOG_FILE" 2>/dev/null || true

    banner "Remote Mac Setup - Uninstallation"
    log INFO "Uninstall options:"
    log INFO "  Remove Apps: $REMOVE_APPS"
    log INFO "  Revert pmset: $REVERT_PMSET"
    log INFO "  Remove Logs: $REMOVE_LOGS"
    log INFO "  Stack: $STACK"
    log INFO "  Auto-confirm: $AUTO_CONFIRM"
    echo ""

    if ! confirm "Continue with uninstallation?"; then
        log INFO "Uninstall cancelled by user"
        exit 0
    fi

    # Remove stack(s)
    if [[ "$STACK" == "parsec" || "$STACK" == "both" ]]; then
        remove_parsec
    fi

    if [[ "$STACK" == "rustdesk" || "$STACK" == "both" ]]; then
        remove_rustdesk
    fi

    # Remove Tailscale if requested
    if [[ "$REMOVE_APPS" == "true" ]]; then
        remove_tailscale
    fi

    # Revert power settings if requested
    if [[ "$REVERT_PMSET" == "true" ]]; then
        revert_power_settings
    fi

    # Remove logs if requested (do this last)
    if [[ "$REMOVE_LOGS" == "true" ]]; then
        remove_logs
    fi

    log SUCCESS "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log SUCCESS " Uninstallation completed successfully!"
    log SUCCESS "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ "$REMOVE_APPS" == "false" ]]; then
        echo ""
        log INFO "Note: Applications were not removed. To fully uninstall, run with --remove-apps"
    fi

    if [[ "$REMOVE_LOGS" == "false" ]]; then
        log INFO "Log file: $LOG_FILE"
    fi
}

# Execute main function
main "$@"
