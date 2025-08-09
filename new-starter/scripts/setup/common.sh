#!/bin/bash

# Common setup script utilities

# Set default SCRIPT_DIR if not set
if [[ -z "${SCRIPT_DIR:-}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# Source environment if it exists
if [[ -f "${SCRIPT_DIR}/.env.setup" ]]; then
    source "${SCRIPT_DIR}/.env.setup"
fi

# Set default OS if not set
if [[ -z "${OS:-}" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        OS="unknown"
    fi
fi

# Set default LOG_FILE if not set
if [[ -z "${LOG_FILE:-}" ]]; then
    LOG_FILE="/tmp/setup_$(date +%Y%m%d_%H%M%S).log"
fi

# Export for child scripts
export OS
export SCRIPT_DIR
export LOG_FILE