#!/bin/bash

# Logging utilities for consistent output

# Source colors if not already sourced
if [ -z "$GREEN" ]; then
    source "$(dirname "$0")/colors.sh" 2>/dev/null || true
fi

# Logging functions
log_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_section() {
    echo
    echo -e "${BOLD}${BLUE}═══ $1 ═══${NC}"
    echo
}

log_subsection() {
    echo -e "${BOLD}${CYAN}→ $1${NC}"
}

log_prompt() {
    echo -e "${YELLOW}? $1${NC}"
}

log_debug() {
    if [ "${DEBUG:-0}" = "1" ]; then
        echo -e "${DIM}[DEBUG] $1${NC}" >&2
    fi
}

# Progress indicators
show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Check mark or X based on exit code
check_status() {
    if [ $? -eq 0 ]; then
        log_success "$1"
    else
        log_error "$1"
        return 1
    fi
}