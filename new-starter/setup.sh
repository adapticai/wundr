#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/setup_$(date +%Y%m%d_%H%M%S).log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EMAIL=""
GITHUB_USERNAME=""
GITHUB_EMAIL=""
FULL_NAME=""
COMPANY=""
ROOT_DIR="$HOME/Development"
SKIP_PROMPTS=false
VERBOSE=false

mkdir -p "$LOG_DIR"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
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

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Setup development environment for Node.js engineers

OPTIONS:
    -e, --email EMAIL                Email address for configuration
    -u, --github-username USERNAME   GitHub username
    -g, --github-email EMAIL        GitHub email (defaults to --email if not specified)
    -n, --name NAME                  Full name for Git configuration
    -c, --company COMPANY           Company name (optional)
    -r, --root-dir DIR              Root directory for development (default: ~/Development)
    -s, --skip-prompts              Skip all confirmation prompts
    -v, --verbose                   Enable verbose output
    -h, --help                      Show this help message

EXAMPLES:
    $0 --email john@example.com --github-username johndoe --name "John Doe"
    $0 -e john@example.com -u johndoe -n "John Doe" -s

EOF
    exit 0
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--email)
                EMAIL="$2"
                shift 2
                ;;
            -u|--github-username)
                GITHUB_USERNAME="$2"
                shift 2
                ;;
            -g|--github-email)
                GITHUB_EMAIL="$2"
                shift 2
                ;;
            -n|--name)
                FULL_NAME="$2"
                shift 2
                ;;
            -c|--company)
                COMPANY="$2"
                shift 2
                ;;
            -r|--root-dir)
                ROOT_DIR="$2"
                shift 2
                ;;
            -s|--skip-prompts)
                SKIP_PROMPTS=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done

    if [[ -z "$GITHUB_EMAIL" && -n "$EMAIL" ]]; then
        GITHUB_EMAIL="$EMAIL"
    fi
}

validate_inputs() {
    local missing_args=()
    
    [[ -z "$EMAIL" ]] && missing_args+=("email")
    [[ -z "$GITHUB_USERNAME" ]] && missing_args+=("github-username")
    [[ -z "$FULL_NAME" ]] && missing_args+=("name")
    
    if [[ ${#missing_args[@]} -gt 0 ]]; then
        error "Missing required arguments: ${missing_args[*]}"
    fi
    
    if [[ ! "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        error "Invalid email format: $EMAIL"
    fi
}

check_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log "Detected macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log "Detected Linux"
    else
        error "Unsupported operating system: $OSTYPE"
    fi
}

confirm_setup() {
    if [[ "$SKIP_PROMPTS" == true ]]; then
        return 0
    fi
    
    echo ""
    info "Setup Configuration:"
    echo "  Email: $EMAIL"
    echo "  GitHub Username: $GITHUB_USERNAME"
    echo "  GitHub Email: $GITHUB_EMAIL"
    echo "  Full Name: $FULL_NAME"
    [[ -n "$COMPANY" ]] && echo "  Company: $COMPANY"
    echo "  Root Directory: $ROOT_DIR"
    echo ""
    
    read -p "Proceed with setup? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Setup cancelled by user"
        exit 0
    fi
}

export_config() {
    cat > "${SCRIPT_DIR}/.env.setup" << EOF
export SETUP_EMAIL="${EMAIL}"
export SETUP_GITHUB_USERNAME="${GITHUB_USERNAME}"
export SETUP_GITHUB_EMAIL="${GITHUB_EMAIL}"
export SETUP_FULL_NAME="${FULL_NAME}"
export SETUP_COMPANY="${COMPANY}"
export SETUP_ROOT_DIR="${ROOT_DIR}"
export SETUP_OS="${OS}"
export SETUP_SKIP_PROMPTS="${SKIP_PROMPTS}"
export SETUP_VERBOSE="${VERBOSE}"
export SCRIPT_DIR="${SCRIPT_DIR}"
export LOG_FILE="${LOG_FILE}"
EOF
    
    chmod 600 "${SCRIPT_DIR}/.env.setup"
}

run_setup_scripts() {
    local scripts=(
        "scripts/setup/01-permissions.sh"
        "scripts/setup/02-brew.sh"
        "scripts/setup/03-node-tools.sh"
        "scripts/setup/04-docker.sh"
        "scripts/setup/05-github.sh"
        "scripts/setup/06-vscode.sh"
        "scripts/setup/07-slack.sh"
        "scripts/setup/08-claude.sh"
        "scripts/setup/09-dev-config.sh"
        "scripts/setup/10-finalize.sh"
    )
    
    for script in "${scripts[@]}"; do
        local script_path="${SCRIPT_DIR}/${script}"
        if [[ -f "$script_path" ]]; then
            log "Running $(basename "$script")..."
            source "${SCRIPT_DIR}/.env.setup"
            bash "$script_path" || warning "Script $(basename "$script") encountered issues"
        else
            warning "Script not found: $script"
        fi
    done
}

cleanup() {
    rm -f "${SCRIPT_DIR}/.env.setup"
    log "Cleanup completed"
}

main() {
    log "Starting development environment setup"
    
    parse_args "$@"
    validate_inputs
    check_os
    confirm_setup
    export_config
    
    trap cleanup EXIT
    
    run_setup_scripts
    
    log "Setup completed successfully!"
    info "Please restart your terminal to apply all changes"
    info "Detailed logs available at: $LOG_FILE"
}

main "$@"