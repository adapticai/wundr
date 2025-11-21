#!/usr/bin/env bash
set -euo pipefail

# Agent Frontmatter Validator
# Validates agent file frontmatter against JSON schema

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SCHEMA_FILE="$SCRIPT_DIR/../schemas/agent-frontmatter.schema.json"
AGENTS_DIR="${AGENTS_DIR:-$PROJECT_ROOT/agents}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
AGENTS_CHECKED=0
AGENTS_VALID=0
AGENTS_INVALID=0

declare -a INVALID_AGENTS=()

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_failure() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check dependencies
check_dependencies() {
    local missing=()

    if ! command -v node &> /dev/null; then
        missing+=("node")
    fi

    if ! command -v yq &> /dev/null; then
        log_warning "yq not found, will use python for YAML parsing"
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_failure "Missing required dependencies: ${missing[*]}"
        exit 1
    fi
}

# Extract YAML frontmatter from agent file
extract_frontmatter() {
    local file="$1"
    local in_frontmatter=false
    local frontmatter=""

    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == false ]]; then
                in_frontmatter=true
                continue
            else
                # End of frontmatter
                break
            fi
        fi

        if [[ "$in_frontmatter" == true ]]; then
            frontmatter+="$line"$'\n'
        fi
    done < "$file"

    echo "$frontmatter"
}

# Convert YAML to JSON
yaml_to_json() {
    local yaml_content="$1"

    if command -v yq &> /dev/null; then
        echo "$yaml_content" | yq eval -o=json -
    else
        # Fallback to Python
        python3 -c "
import sys, yaml, json
try:
    data = yaml.safe_load(sys.stdin.read())
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
" <<< "$yaml_content"
    fi
}

# Validate JSON against schema using Node.js
validate_json_schema() {
    local json_file="$1"
    local schema_file="$2"

    node - "$json_file" "$schema_file" <<'EOF'
const fs = require('fs');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const jsonFile = process.argv[2];
const schemaFile = process.argv[3];

try {
    const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

    const ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
        console.error(JSON.stringify(validate.errors, null, 2));
        process.exit(1);
    }

    console.log('Valid');
    process.exit(0);
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
EOF
}

# Install ajv if not present
ensure_ajv() {
    if ! node -e "require('ajv')" 2>/dev/null; then
        log_info "Installing ajv for JSON schema validation..."
        npm install --no-save ajv ajv-formats 2>&1 | grep -v "npm WARN"
    fi
}

# Validate individual agent file
validate_agent_file() {
    local file="$1"
    local filename=$(basename "$file")

    ((AGENTS_CHECKED++))

    log_info "Validating: $filename"

    # Extract frontmatter
    local frontmatter=$(extract_frontmatter "$file")

    if [[ -z "$frontmatter" ]]; then
        log_failure "$filename: No frontmatter found"
        INVALID_AGENTS+=("$filename: No frontmatter")
        ((AGENTS_INVALID++))
        return 1
    fi

    # Convert to JSON
    local json_content=$(yaml_to_json "$frontmatter")

    if [[ $? -ne 0 ]] || [[ -z "$json_content" ]]; then
        log_failure "$filename: Invalid YAML frontmatter"
        INVALID_AGENTS+=("$filename: Invalid YAML")
        ((AGENTS_INVALID++))
        return 1
    fi

    # Save to temp file for validation
    local temp_json=$(mktemp)
    echo "$json_content" > "$temp_json"

    # Validate against schema
    local validation_result
    validation_result=$(validate_json_schema "$temp_json" "$SCHEMA_FILE" 2>&1)
    local validation_status=$?

    rm -f "$temp_json"

    if [[ $validation_status -eq 0 ]]; then
        log_success "$filename: Valid"
        ((AGENTS_VALID++))
        return 0
    else
        log_failure "$filename: Schema validation failed"
        echo "$validation_result" | head -20
        INVALID_AGENTS+=("$filename: Schema validation failed")
        ((AGENTS_INVALID++))
        return 1
    fi
}

# Find all agent files
find_agent_files() {
    if [[ ! -d "$AGENTS_DIR" ]]; then
        log_failure "Agents directory not found: $AGENTS_DIR"
        exit 1
    fi

    find "$AGENTS_DIR" -type f -name "*.md" | sort
}

# Additional manual checks
manual_checks() {
    local file="$1"
    local filename=$(basename "$file")
    local issues=()

    # Check file naming convention
    if [[ ! "$filename" =~ ^[a-z][a-z0-9-]*\.md$ ]]; then
        issues+=("Filename not in kebab-case: $filename")
    fi

    # Check for required sections in content
    if ! grep -q "## Capabilities" "$file"; then
        issues+=("Missing '## Capabilities' section")
    fi

    if ! grep -q "## Usage" "$file" && ! grep -q "## Examples" "$file"; then
        issues+=("Missing '## Usage' or '## Examples' section")
    fi

    # Check for description length
    local description=$(extract_frontmatter "$file" | grep "description:" | cut -d':' -f2- | xargs)
    if [[ ${#description} -lt 10 ]]; then
        issues+=("Description too short (< 10 chars)")
    fi

    if [[ ${#issues[@]} -gt 0 ]]; then
        log_warning "$filename: Additional issues found:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    fi
}

# Main execution
main() {
    echo "======================================================================"
    echo "  Agent Frontmatter Validation Test Suite"
    echo "======================================================================"
    echo ""

    log_info "Schema: $SCHEMA_FILE"
    log_info "Agents directory: $AGENTS_DIR"
    echo ""

    check_dependencies
    ensure_ajv

    # Find and validate all agent files
    local agent_files=($(find_agent_files))

    if [[ ${#agent_files[@]} -eq 0 ]]; then
        log_warning "No agent files found in $AGENTS_DIR"
        exit 0
    fi

    log_info "Found ${#agent_files[@]} agent files"
    echo ""

    for agent_file in "${agent_files[@]}"; do
        validate_agent_file "$agent_file"
        manual_checks "$agent_file"
        echo ""
    done

    # Summary
    echo "======================================================================"
    echo "  Validation Summary"
    echo "======================================================================"
    echo -e "Total Agents:  $AGENTS_CHECKED"
    echo -e "${GREEN}Valid:         $AGENTS_VALID${NC}"
    echo -e "${RED}Invalid:       $AGENTS_INVALID${NC}"
    echo ""

    if [[ $AGENTS_INVALID -gt 0 ]]; then
        echo -e "${RED}Invalid Agents:${NC}"
        for agent in "${INVALID_AGENTS[@]}"; do
            echo "  - $agent"
        done
        echo ""
        exit 1
    else
        echo -e "${GREEN}All agents valid!${NC}"
        exit 0
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
