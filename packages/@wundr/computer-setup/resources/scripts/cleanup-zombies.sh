#!/usr/bin/env bash
###############################################################################
# cleanup-zombies.sh: Claude Process Cleanup Utility
#
# Identifies and terminates stuck/zombie claude-code processes that may have
# leaked during failed orchestration runs or OOM crashes.
#
# Safety features:
# - Interactive mode by default (requires confirmation)
# - Force mode with --force flag
# - Excludes current process
# - Detailed logging
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
FORCE_MODE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force|-f)
      FORCE_MODE=true
      shift
      ;;
    --dry-run|-d)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --force, -f     Kill processes without confirmation"
      echo "  --dry-run, -d   Show what would be killed without actually killing"
      echo "  --help, -h      Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0              # Interactive mode (default)"
      echo "  $0 --dry-run    # See what would be killed"
      echo "  $0 --force      # Kill all zombie processes immediately"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✅${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}❌${NC} $*"
}

# Get current process PID to exclude it
CURRENT_PID=$$

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Claude Process Cleanup Utility                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Find all claude processes
log_info "Scanning for claude-code processes..."

# Get all claude processes (excluding this script)
CLAUDE_PIDS=$(pgrep -f "claude" | grep -v "^${CURRENT_PID}$" || true)

if [ -z "$CLAUDE_PIDS" ]; then
  log_success "No zombie claude processes found. System is clean!"
  exit 0
fi

# Count processes
PROCESS_COUNT=$(echo "$CLAUDE_PIDS" | wc -l | tr -d ' ')

log_warn "Found $PROCESS_COUNT claude process(es)"
echo ""

# Display process details
log_info "Process Details:"
echo "─────────────────────────────────────────────────────────────"

for pid in $CLAUDE_PIDS; do
  # Get process info
  if ps -p "$pid" -o pid,ppid,etime,command 2>/dev/null | tail -n 1; then
    :
  else
    log_warn "Process $pid terminated during scan"
  fi
done

echo "─────────────────────────────────────────────────────────────"
echo ""

# Dry run mode
if [ "$DRY_RUN" = true ]; then
  log_info "DRY RUN MODE: Would kill the following PIDs:"
  echo "$CLAUDE_PIDS" | tr '\n' ' '
  echo ""
  log_info "Run without --dry-run to actually terminate these processes"
  exit 0
fi

# Interactive confirmation (unless force mode)
if [ "$FORCE_MODE" = false ]; then
  echo -e "${YELLOW}⚠  WARNING: This will terminate all listed processes${NC}"
  echo -n "Do you want to proceed? [y/N] "
  read -r response

  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    log_info "Cleanup cancelled by user"
    exit 0
  fi
fi

# Kill processes
log_info "Terminating processes..."

KILLED_COUNT=0
FAILED_COUNT=0

for pid in $CLAUDE_PIDS; do
  if kill -TERM "$pid" 2>/dev/null; then
    log_success "Terminated process $pid (SIGTERM)"
    ((KILLED_COUNT++))
  else
    log_warn "Failed to terminate process $pid (may already be dead)"
    ((FAILED_COUNT++))
  fi
done

# Wait a moment, then force kill any remaining
sleep 2

REMAINING_PIDS=$(pgrep -f "claude" | grep -v "^${CURRENT_PID}$" || true)

if [ -n "$REMAINING_PIDS" ]; then
  log_warn "Some processes survived SIGTERM, sending SIGKILL..."

  for pid in $REMAINING_PIDS; do
    if kill -KILL "$pid" 2>/dev/null; then
      log_success "Force killed process $pid (SIGKILL)"
      ((KILLED_COUNT++))
    fi
  done
fi

# Final report
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Cleanup Complete                                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
log_success "Terminated: $KILLED_COUNT process(es)"

if [ "$FAILED_COUNT" -gt 0 ]; then
  log_warn "Failed/Already dead: $FAILED_COUNT process(es)"
fi

# Verify cleanup
FINAL_CHECK=$(pgrep -f "claude" | grep -v "^${CURRENT_PID}$" || true)

if [ -z "$FINAL_CHECK" ]; then
  log_success "System is now clean!"
  exit 0
else
  log_error "Some processes may still be running:"
  echo "$FINAL_CHECK"
  exit 1
fi
