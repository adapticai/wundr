#!/usr/bin/env bash
# =============================================================================
# install-service.sh
#
# Install the Wundr Orchestrator Daemon as a system service.
#
# macOS : Creates a launchd plist at ~/Library/LaunchAgents/ (user-scope)
#         or /Library/LaunchDaemons/ (system-scope, requires sudo).
# Linux : Creates a systemd unit file at /etc/systemd/system/.
#
# Usage:
#   ./install-service.sh [--system] [--port PORT] [--log-dir DIR]
#
# Options:
#   --system      Install as system-level service (requires root on Linux)
#   --port PORT   WebSocket/HTTP port (default: 8787)
#   --log-dir DIR Log directory (default: /var/log/wundr or /tmp/wundr-daemon-logs)
#   --env-file F  Path to .env file to source (default: <package>/.env)
#   --uninstall   Remove the previously installed service
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants / defaults
# ---------------------------------------------------------------------------
SERVICE_NAME="wundr-orchestrator-daemon"
SERVICE_LABEL="io.adaptic.wundr.orchestrator-daemon"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NODE_BIN="$(command -v node)"
CLI_BIN="${PACKAGE_DIR}/dist/cli/daemon-cli.js"

DEFAULT_PORT=8787
DEFAULT_USER="$(id -un)"
SYSTEM_SCOPE=false
UNINSTALL=false
PORT="${DEFAULT_PORT}"
LOG_DIR=""
ENV_FILE="${PACKAGE_DIR}/.env"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --system)    SYSTEM_SCOPE=true; shift ;;
    --port)      PORT="$2"; shift 2 ;;
    --log-dir)   LOG_DIR="$2"; shift 2 ;;
    --env-file)  ENV_FILE="$2"; shift 2 ;;
    --uninstall) UNINSTALL=true; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Derived paths
# ---------------------------------------------------------------------------
OS="$(uname -s)"

if [[ -z "${LOG_DIR}" ]]; then
  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    LOG_DIR="/var/log/${SERVICE_NAME}"
  else
    LOG_DIR="${HOME}/.local/share/${SERVICE_NAME}/logs"
  fi
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if [[ ! -x "${NODE_BIN}" ]]; then
  echo "ERROR: node not found in PATH. Install Node.js >= 18 first." >&2
  exit 1
fi

NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [[ "${NODE_MAJOR}" -lt 18 ]]; then
  echo "ERROR: Node.js 18+ required, found $(node -v)" >&2
  exit 1
fi

if [[ ! -f "${CLI_BIN}" ]]; then
  echo "ERROR: Compiled CLI not found at ${CLI_BIN}" >&2
  echo "       Run 'npm run build' in the package directory first." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper: load environment variables from .env
# ---------------------------------------------------------------------------
load_env_vars() {
  if [[ -f "${ENV_FILE}" ]]; then
    # Read non-comment, non-empty KEY=VALUE lines
    while IFS= read -r line; do
      # Skip comments and empty lines
      [[ "${line}" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// /}" ]] && continue
      # Export the variable
      export "${line?}"
    done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" || true)
    echo "Loaded environment from ${ENV_FILE}"
  else
    echo "Note: No .env file found at ${ENV_FILE} - using existing environment variables."
  fi
}

# ---------------------------------------------------------------------------
# macOS - launchd
# ---------------------------------------------------------------------------
install_macos() {
  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    PLIST_DIR="/Library/LaunchDaemons"
    PLIST_PATH="${PLIST_DIR}/${SERVICE_LABEL}.plist"
    if [[ "${EUID}" -ne 0 ]]; then
      echo "ERROR: System-scope install requires sudo on macOS." >&2
      exit 1
    fi
  else
    PLIST_DIR="${HOME}/Library/LaunchAgents"
    PLIST_PATH="${PLIST_DIR}/${SERVICE_LABEL}.plist"
  fi

  mkdir -p "${LOG_DIR}"
  mkdir -p "${PLIST_DIR}"

  # Build environment variables section from .env
  local env_section=""
  if [[ -f "${ENV_FILE}" ]]; then
    env_section="  <key>EnvironmentVariables</key>\n  <dict>\n"
    while IFS='=' read -r key value; do
      [[ "${key}" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${key// /}" ]] && continue
      # Strip surrounding quotes from value
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      env_section+="    <key>${key}</key>\n    <string>${value}</string>\n"
    done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" || true)
    env_section+="    <key>DAEMON_PORT</key>\n    <string>${PORT}</string>\n"
    env_section+="  </dict>"
  else
    env_section="  <key>EnvironmentVariables</key>\n  <dict>\n    <key>DAEMON_PORT</key>\n    <string>${PORT}</string>\n  </dict>"
  fi

  cat > "${PLIST_PATH}" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${CLI_BIN}</string>
    <string>start</string>
    <string>--port</string>
    <string>${PORT}</string>
  </array>

$(printf "%b" "${env_section}")

  <key>WorkingDirectory</key>
  <string>${PACKAGE_DIR}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>Crashed</key>
    <true/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/daemon.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/daemon-error.log</string>

  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
PLIST_EOF

  echo "Wrote plist: ${PLIST_PATH}"

  # Unload existing service if present
  launchctl unload "${PLIST_PATH}" 2>/dev/null || true

  # Load the service
  launchctl load "${PLIST_PATH}"
  echo "Service loaded. To check status: launchctl list ${SERVICE_LABEL}"
  echo "Logs: ${LOG_DIR}/daemon.log"
}

uninstall_macos() {
  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    PLIST_PATH="/Library/LaunchDaemons/${SERVICE_LABEL}.plist"
  else
    PLIST_PATH="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
  fi

  if [[ -f "${PLIST_PATH}" ]]; then
    launchctl unload "${PLIST_PATH}" 2>/dev/null || true
    rm -f "${PLIST_PATH}"
    echo "Service uninstalled (plist removed)."
  else
    echo "Service plist not found: ${PLIST_PATH}"
  fi
}

# ---------------------------------------------------------------------------
# Linux - systemd
# ---------------------------------------------------------------------------
install_linux() {
  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    UNIT_DIR="/etc/systemd/system"
  else
    UNIT_DIR="${HOME}/.config/systemd/user"
  fi

  UNIT_PATH="${UNIT_DIR}/${SERVICE_NAME}.service"
  mkdir -p "${UNIT_DIR}"
  mkdir -p "${LOG_DIR}"

  # Build Environment= lines from .env
  local env_lines=""
  if [[ -f "${ENV_FILE}" ]]; then
    while IFS='=' read -r key value; do
      [[ "${key}" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${key// /}" ]] && continue
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      env_lines+="Environment=\"${key}=${value}\"\n"
    done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" || true)
  fi
  env_lines+="Environment=\"DAEMON_PORT=${PORT}\"\n"

  cat > "${UNIT_PATH}" << UNIT_EOF
[Unit]
Description=Wundr Orchestrator Daemon
Documentation=https://wundr.io
After=network.target
Wants=network.target

[Service]
Type=simple
User=${DEFAULT_USER}
WorkingDirectory=${PACKAGE_DIR}
ExecStart=${NODE_BIN} ${CLI_BIN} start --port ${PORT}
ExecStop=/bin/kill -s TERM \$MAINPID
$(printf "%b" "${env_lines}")
Restart=on-failure
RestartSec=5s
RestartPreventExitStatus=0

# Logging
StandardOutput=append:${LOG_DIR}/daemon.log
StandardError=append:${LOG_DIR}/daemon-error.log

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
UNIT_EOF

  echo "Wrote unit file: ${UNIT_PATH}"

  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl start "${SERVICE_NAME}"
    echo "Service enabled and started."
    echo "Status: systemctl status ${SERVICE_NAME}"
    echo "Logs:   journalctl -u ${SERVICE_NAME} -f"
  else
    systemctl --user daemon-reload
    systemctl --user enable "${SERVICE_NAME}"
    systemctl --user start "${SERVICE_NAME}"
    echo "User service enabled and started."
    echo "Status: systemctl --user status ${SERVICE_NAME}"
    echo "Logs:   ${LOG_DIR}/daemon.log"
  fi

  # Set up log rotation
  install_logrotate
}

uninstall_linux() {
  if [[ "${SYSTEM_SCOPE}" == "true" ]]; then
    UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    systemctl daemon-reload
  else
    UNIT_PATH="${HOME}/.config/systemd/user/${SERVICE_NAME}.service"
    systemctl --user stop "${SERVICE_NAME}" 2>/dev/null || true
    systemctl --user disable "${SERVICE_NAME}" 2>/dev/null || true
    systemctl --user daemon-reload
  fi

  rm -f "${UNIT_PATH}"
  echo "Service uninstalled."
}

# ---------------------------------------------------------------------------
# Log rotation
# ---------------------------------------------------------------------------
install_logrotate() {
  # Only attempt on Linux systems with logrotate
  if ! command -v logrotate &>/dev/null; then
    echo "Note: logrotate not found, skipping log rotation setup."
    return
  fi

  LOGROTATE_CONF="/etc/logrotate.d/${SERVICE_NAME}"

  if [[ "${EUID}" -ne 0 ]]; then
    echo "Note: Skipping logrotate config (requires root). Log files: ${LOG_DIR}/"
    return
  fi

  cat > "${LOGROTATE_CONF}" << LOGROTATE_EOF
${LOG_DIR}/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
    dateformat -%Y%m%d
}
LOGROTATE_EOF

  echo "Log rotation configured: ${LOGROTATE_CONF}"
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
echo "=== Wundr Orchestrator Daemon Service Installer ==="
echo "Package:  ${PACKAGE_DIR}"
echo "Port:     ${PORT}"
echo "Log dir:  ${LOG_DIR}"
echo "Platform: ${OS}"
echo "Scope:    $([[ "${SYSTEM_SCOPE}" == "true" ]] && echo 'system' || echo 'user')"
echo ""

if [[ "${OS}" == "Darwin" ]]; then
  if [[ "${UNINSTALL}" == "true" ]]; then
    uninstall_macos
  else
    install_macos
  fi
elif [[ "${OS}" == "Linux" ]]; then
  if [[ "${UNINSTALL}" == "true" ]]; then
    uninstall_linux
  else
    install_linux
  fi
else
  echo "ERROR: Unsupported platform: ${OS}" >&2
  echo "       This script supports macOS and Linux only." >&2
  exit 1
fi

echo ""
echo "Done."
