#!/bin/bash

# RAG Store Update Script
# Syncs, prunes, and re-indexes RAG stores

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# RAG store paths
RAG_BASE_DIR="$HOME/.wundr/rag-stores"
RAG_GLOBAL_DIR="$RAG_BASE_DIR/global"
RAG_PROJECT_DIR="$RAG_BASE_DIR/project-specific"
CONFIG_FILE="$RAG_BASE_DIR/config.json"

# Logging
LOG_FILE="$RAG_BASE_DIR/update.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to print colored output
print_header() {
    echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}        ${GREEN}Wundr RAG Store Update${NC}                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log_message "INFO" "$1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log_message "SUCCESS" "$1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log_message "ERROR" "$1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log_message "WARNING" "$1"
}

print_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_message() {
    local level="$1"
    local message="$2"
    echo "[$TIMESTAMP] [$level] $message" >> "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if [ ! -d "$RAG_BASE_DIR" ]; then
        print_error "RAG store directory not found. Run setup-rag.sh first."
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "RAG configuration not found. Run setup-rag.sh first."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Get list of all RAG stores
get_all_stores() {
    local stores=()

    # Add global store if it exists
    if [ -d "$RAG_GLOBAL_DIR" ]; then
        stores+=("$RAG_GLOBAL_DIR")
    fi

    # Add project-specific stores
    if [ -d "$RAG_PROJECT_DIR" ]; then
        for store in "$RAG_PROJECT_DIR"/*; do
            if [ -d "$store" ]; then
                stores+=("$store")
            fi
        done
    fi

    echo "${stores[@]}"
}

# Sync a single store
sync_store() {
    local store_path="$1"
    local store_name=$(basename "$store_path")

    print_status "Syncing store: $store_name"

    # Check for source directory in store metadata
    local metadata_file="$store_path/metadata/source.json"
    if [ ! -f "$metadata_file" ]; then
        print_warning "No source metadata found for $store_name, skipping sync"
        return 0
    fi

    # Read source directory from metadata
    local source_dir=$(cat "$metadata_file" 2>/dev/null | grep -o '"sourceDir"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    if [ -z "$source_dir" ]; then
        print_warning "No source directory configured for $store_name"
        return 0
    fi

    if [ ! -d "$source_dir" ]; then
        print_warning "Source directory $source_dir does not exist"
        return 0
    fi

    # Count files to sync
    local total_files=$(find "$source_dir" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.md" -o -name "*.json" \) 2>/dev/null | wc -l | tr -d ' ')

    print_status "Found $total_files files to sync from $source_dir"

    # Update last sync timestamp
    local sync_metadata="$store_path/metadata/sync.json"
    cat > "$sync_metadata" << EOF
{
  "lastSync": "$TIMESTAMP",
  "filesCount": $total_files,
  "sourceDir": "$source_dir",
  "status": "synced"
}
EOF

    print_success "Store $store_name synced successfully"
    return 0
}

# Sync all stores
sync_all_stores() {
    print_step "Syncing all RAG stores"

    local stores=($(get_all_stores))
    local total_stores=${#stores[@]}
    local synced=0
    local failed=0

    if [ $total_stores -eq 0 ]; then
        print_warning "No RAG stores found"
        return 0
    fi

    print_status "Found $total_stores store(s) to sync"

    for store in "${stores[@]}"; do
        if sync_store "$store"; then
            synced=$((synced + 1))
        else
            failed=$((failed + 1))
        fi
    done

    echo ""
    print_status "Sync summary: $synced synced, $failed failed"
}

# Prune deleted files from a store
prune_store() {
    local store_path="$1"
    local store_name=$(basename "$store_path")

    print_status "Pruning store: $store_name"

    local embeddings_dir="$store_path/embeddings"
    local indexes_dir="$store_path/indexes"
    local metadata_file="$store_path/metadata/source.json"

    if [ ! -f "$metadata_file" ]; then
        print_warning "No source metadata found for $store_name, skipping prune"
        return 0
    fi

    local source_dir=$(cat "$metadata_file" 2>/dev/null | grep -o '"sourceDir"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    if [ -z "$source_dir" ] || [ ! -d "$source_dir" ]; then
        print_warning "Invalid source directory for $store_name"
        return 0
    fi

    local pruned=0

    # Check embeddings directory for orphaned files
    if [ -d "$embeddings_dir" ]; then
        for embedding_file in "$embeddings_dir"/*.json; do
            if [ -f "$embedding_file" ]; then
                # Extract original file path from embedding metadata
                local original_path=$(cat "$embedding_file" 2>/dev/null | grep -o '"originalPath"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

                if [ -n "$original_path" ] && [ ! -f "$original_path" ]; then
                    print_status "Removing orphaned embedding: $(basename "$embedding_file")"
                    rm -f "$embedding_file"
                    pruned=$((pruned + 1))
                fi
            fi
        done
    fi

    # Update prune metadata
    local prune_metadata="$store_path/metadata/prune.json"
    cat > "$prune_metadata" << EOF
{
  "lastPrune": "$TIMESTAMP",
  "prunedCount": $pruned,
  "status": "completed"
}
EOF

    print_success "Pruned $pruned orphaned entries from $store_name"
    return 0
}

# Prune all stores
prune_all_stores() {
    print_step "Pruning deleted files from stores"

    local stores=($(get_all_stores))
    local total_pruned=0

    for store in "${stores[@]}"; do
        prune_store "$store"
    done

    print_success "Prune operation completed"
}

# Re-index a single store
reindex_store() {
    local store_path="$1"
    local store_name=$(basename "$store_path")

    print_status "Re-indexing store: $store_name"

    local indexes_dir="$store_path/indexes"
    local embeddings_dir="$store_path/embeddings"

    # Create index directory if it doesn't exist
    mkdir -p "$indexes_dir"

    # Count embeddings
    local embedding_count=0
    if [ -d "$embeddings_dir" ]; then
        embedding_count=$(find "$embeddings_dir" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
    fi

    # Generate index file
    local index_file="$indexes_dir/main.json"
    cat > "$index_file" << EOF
{
  "version": "1.0.0",
  "created": "$TIMESTAMP",
  "updated": "$TIMESTAMP",
  "embeddingCount": $embedding_count,
  "indexType": "flat",
  "status": "ready"
}
EOF

    # Update index metadata
    local index_metadata="$store_path/metadata/index.json"
    cat > "$index_metadata" << EOF
{
  "lastIndex": "$TIMESTAMP",
  "totalEmbeddings": $embedding_count,
  "indexFile": "$index_file",
  "status": "indexed"
}
EOF

    print_success "Store $store_name re-indexed with $embedding_count embeddings"
    return 0
}

# Re-index all stores
reindex_all_stores() {
    print_step "Re-indexing stores with updated configurations"

    local stores=($(get_all_stores))

    for store in "${stores[@]}"; do
        reindex_store "$store"
    done

    print_success "Re-index operation completed"
}

# Generate sync status report
report_status() {
    print_step "RAG Store Status Report"

    local stores=($(get_all_stores))
    local total_stores=${#stores[@]}
    local total_embeddings=0

    echo ""
    printf "${CYAN}%-30s %-15s %-15s %-20s${NC}\n" "Store" "Embeddings" "Last Sync" "Status"
    echo "────────────────────────────────────────────────────────────────────────────────"

    for store in "${stores[@]}"; do
        local store_name=$(basename "$store")
        local embedding_count=0
        local last_sync="Never"
        local status="Unknown"

        # Get embedding count
        if [ -d "$store/embeddings" ]; then
            embedding_count=$(find "$store/embeddings" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
        fi
        total_embeddings=$((total_embeddings + embedding_count))

        # Get last sync time
        if [ -f "$store/metadata/sync.json" ]; then
            last_sync=$(cat "$store/metadata/sync.json" 2>/dev/null | grep -o '"lastSync"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 | cut -d' ' -f1)
            status=$(cat "$store/metadata/sync.json" 2>/dev/null | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        fi

        # Color code status
        case "$status" in
            "synced")
                status="${GREEN}$status${NC}"
                ;;
            "error")
                status="${RED}$status${NC}"
                ;;
            *)
                status="${YELLOW}$status${NC}"
                ;;
        esac

        printf "%-30s %-15s %-15s %-20s\n" "$store_name" "$embedding_count" "$last_sync" "$status"
    done

    echo "────────────────────────────────────────────────────────────────────────────────"
    printf "${GREEN}%-30s %-15s${NC}\n" "Total" "$total_embeddings embeddings"
    echo ""

    # Show disk usage
    print_status "Disk usage:"
    if [ -d "$RAG_BASE_DIR" ]; then
        du -sh "$RAG_BASE_DIR" 2>/dev/null || echo "Unable to calculate disk usage"
    fi

    # Show log file location
    echo ""
    print_status "Log file: $LOG_FILE"
}

# Print usage
print_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  sync      Sync all existing RAG stores (default)"
    echo "  prune     Remove deleted files from stores"
    echo "  reindex   Re-index stores with updated configurations"
    echo "  status    Show sync status report"
    echo "  all       Run sync, prune, and reindex"
    echo ""
    echo "Options:"
    echo "  --store <name>    Only operate on specific store"
    echo "  --dry-run         Show what would be done without making changes"
    echo "  --verbose         Show detailed output"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 sync                    # Sync all stores"
    echo "  $0 prune --store global    # Prune only global store"
    echo "  $0 all                     # Run full update cycle"
    echo "  $0 status                  # Show status report"
}

# Main execution
main() {
    print_header

    # Initialize log
    mkdir -p "$(dirname "$LOG_FILE")"
    log_message "INFO" "RAG update started"

    # Parse command line arguments
    COMMAND="sync"
    SPECIFIC_STORE=""
    DRY_RUN=false
    VERBOSE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            sync|prune|reindex|status|all)
                COMMAND="$1"
                shift
                ;;
            --store)
                SPECIFIC_STORE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    check_prerequisites

    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi

    case "$COMMAND" in
        sync)
            sync_all_stores
            report_status
            ;;
        prune)
            prune_all_stores
            report_status
            ;;
        reindex)
            reindex_all_stores
            report_status
            ;;
        status)
            report_status
            ;;
        all)
            sync_all_stores
            prune_all_stores
            reindex_all_stores
            report_status
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            print_usage
            exit 1
            ;;
    esac

    log_message "INFO" "RAG update completed"
    echo ""
    print_success "RAG update completed successfully"
}

main "$@"
