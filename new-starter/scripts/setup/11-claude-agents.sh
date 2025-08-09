#!/bin/bash

# Claude Agent Setup Script
# This script copies and configures Claude agents for a complete product squad

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"

# Source color and logging utilities
UTILS_DIR="${SCRIPT_DIR}/scripts/utils"
if [[ -f "${UTILS_DIR}/colors.sh" ]]; then
    source "${UTILS_DIR}/colors.sh"
fi
if [[ -f "${UTILS_DIR}/logging.sh" ]]; then
    source "${UTILS_DIR}/logging.sh"
fi

# Fallback logging functions if utilities are not available
if ! command -v log_info &> /dev/null; then
    log_info() { echo "INFO: $1"; }
    log_success() { echo "SUCCESS: $1"; }
    log_error() { echo "ERROR: $1" >&2; }
    log_warning() { echo "WARNING: $1"; }
    log_section() { echo; echo "=== $1 ==="; echo; }
    log_prompt() { echo "? $1"; }
fi

# Configuration
CLAUDE_AGENTS_DIR="$HOME/.claude/agents"
SOURCE_AGENTS_DIR="${SCRIPT_DIR}/.claude/agents"

# Setup configuration from environment variables
COMPANY_NAME="${SETUP_COMPANY:-${COMPANY_NAME:-Your Company}}"
PLATFORM_DESCRIPTION="${PLATFORM_DESCRIPTION:-Enterprise SaaS Platform}"
FULL_NAME="${SETUP_FULL_NAME:-Developer}"
EMAIL="${SETUP_EMAIL:-${SETUP_GITHUB_EMAIL:-developer@company.com}}"
GITHUB_USERNAME="${SETUP_GITHUB_USERNAME:-developer}"
ROLE="${SETUP_ROLE:-Software Engineer}"

log_section "Claude Agent Configuration"

# Function to process template variables in file content
process_template() {
    local template_file="$1"
    local output_file="$2"
    
    # Create output directory if it doesn't exist
    mkdir -p "$(dirname "$output_file")"
    
    # Replace template variables with proper escaping for special characters
    local escaped_company=$(printf '%s\n' "$COMPANY_NAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local escaped_platform=$(printf '%s\n' "$PLATFORM_DESCRIPTION" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local escaped_name=$(printf '%s\n' "$FULL_NAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local escaped_email=$(printf '%s\n' "$EMAIL" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local escaped_github=$(printf '%s\n' "$GITHUB_USERNAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local escaped_role=$(printf '%s\n' "$ROLE" | sed 's/[[\.*^$()+?{|]/\\&/g')
    
    # Replace template variables
    sed -e "s/{{COMPANY_NAME}}/$escaped_company/g" \
        -e "s/{{PLATFORM_DESCRIPTION}}/$escaped_platform/g" \
        -e "s/{{SETUP_FULL_NAME}}/$escaped_name/g" \
        -e "s/{{SETUP_EMAIL}}/$escaped_email/g" \
        -e "s/{{SETUP_GITHUB_USERNAME}}/$escaped_github/g" \
        -e "s/{{SETUP_GITHUB_EMAIL}}/$escaped_email/g" \
        -e "s/{{SETUP_ROLE}}/$escaped_role/g" \
        -e "s/{{SETUP_COMPANY}}/$escaped_company/g" \
        -e "s/\${COMPANY_NAME}/$escaped_company/g" \
        -e "s/\${PLATFORM_DESCRIPTION}/$escaped_platform/g" \
        -e "s/\${SETUP_FULL_NAME}/$escaped_name/g" \
        -e "s/\${SETUP_EMAIL}/$escaped_email/g" \
        -e "s/\${SETUP_GITHUB_USERNAME}/$escaped_github/g" \
        -e "s/\${SETUP_GITHUB_EMAIL}/$escaped_email/g" \
        -e "s/\${SETUP_ROLE}/$escaped_role/g" \
        -e "s/\${SETUP_COMPANY}/$escaped_company/g" \
        "$template_file" > "$output_file"
}

# Function to recursively copy and process agent files
copy_agents_recursive() {
    local source_dir="$1"
    local target_dir="$2"
    local relative_path="${3:-}"
    
    # Check if source directory exists
    if [[ ! -d "$source_dir" ]]; then
        log_warning "Source directory $source_dir does not exist"
        return 1
    fi
    
    # Create target directory
    mkdir -p "$target_dir"
    
    # Process all files and subdirectories
    while IFS= read -r -d '' item; do
        local item_name=$(basename "$item")
        local source_path="$item"
        local target_path="$target_dir/$item_name"
        local display_path="${relative_path:+$relative_path/}$item_name"
        
        if [[ -d "$source_path" ]]; then
            # Recursively process subdirectory
            log_info "  Processing directory: $display_path/"
            copy_agents_recursive "$source_path" "$target_path" "$display_path"
        elif [[ -f "$source_path" && "$item_name" == *.md ]]; then
            # Process markdown file
            log_info "  Processing file: $display_path"
            process_template "$source_path" "$target_path"
        elif [[ -f "$source_path" ]]; then
            # Copy non-markdown file as-is
            log_info "  Copying file: $display_path"
            cp "$source_path" "$target_path"
        fi
    done < <(find "$source_dir" -maxdepth 1 -mindepth 1 -print0 | sort -z)
}

# Interactive setup
if [ "$1" != "--non-interactive" ]; then
    echo
    log_prompt "Claude Agent Setup Configuration"
    echo
    
    read -p "$(echo -e "${YELLOW}Enter your company name${NC} [$COMPANY_NAME]: ")" input_company
    COMPANY_NAME="${input_company:-$COMPANY_NAME}"
    
    read -p "$(echo -e "${YELLOW}Enter platform description${NC} [$PLATFORM_DESCRIPTION]: ")" input_platform
    PLATFORM_DESCRIPTION="${input_platform:-$PLATFORM_DESCRIPTION}"
    
    echo
    log_info "Configuration:"
    log_info "  Company: $COMPANY_NAME"
    log_info "  Platform: $PLATFORM_DESCRIPTION"
    log_info "  Full Name: $FULL_NAME"
    log_info "  Email: $EMAIL"
    log_info "  GitHub Username: $GITHUB_USERNAME"
    log_info "  Role: $ROLE"
    echo
    
    read -p "$(echo -e "${YELLOW}Setup global agents in ~/.claude/agents?${NC} (y/n): ")" setup_global
else
    setup_global="y"
fi

# Setup global agents
if [[ "$setup_global" == "y" ]]; then
    log_section "Setting up global Claude agents"
    
    if [[ ! -d "$SOURCE_AGENTS_DIR" ]]; then
        log_error "Source agents directory not found: $SOURCE_AGENTS_DIR"
        exit 1
    fi
    
    log_info "Copying all agent files from repository to global directory..."
    log_info "Source: $SOURCE_AGENTS_DIR"
    log_info "Target: $CLAUDE_AGENTS_DIR"
    
    # Remove existing agents directory to start fresh
    if [[ -d "$CLAUDE_AGENTS_DIR" ]]; then
        log_info "Removing existing agents directory..."
        rm -rf "$CLAUDE_AGENTS_DIR"
    fi
    
    # Copy all agents recursively with template processing
    copy_agents_recursive "$SOURCE_AGENTS_DIR" "$CLAUDE_AGENTS_DIR"
    
    log_success "Global agents configured in $CLAUDE_AGENTS_DIR"
    
    # Count the number of files copied
    total_files=$(find "$CLAUDE_AGENTS_DIR" -type f -name "*.md" | wc -l | tr -d ' ')
    log_info "Successfully processed $total_files agent files"
fi

# Create enhanced agent index file
create_agent_index() {
    local agents_dir="$1"
    local index_file="$agents_dir/SETUP_INDEX.md"
    
    log_info "Creating comprehensive agent index..."
    
    cat > "$index_file" << EOF
# Claude Agent Setup Index

## Configuration
- **Company**: $COMPANY_NAME
- **Platform**: $PLATFORM_DESCRIPTION  
- **Setup User**: $FULL_NAME ($EMAIL)
- **GitHub**: $GITHUB_USERNAME
- **Role**: $ROLE
- **Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Agent Directory Structure

This directory contains a comprehensive set of Claude AI agents organized by functional areas:

### Core Development Team
- **[Core Agents](core/)** - Essential development roles
  - [Researcher](core/researcher.md) - Research and analysis
  - [Planner](core/planner.md) - Project planning and task breakdown
  - [Coder](core/coder.md) - Code implementation
  - [Reviewer](core/reviewer.md) - Code review and quality assurance
  - [Tester](core/tester.md) - Testing and validation

### Engineering Specialists  
- **[Engineering](engineering/)** - Software development specialists
  - [Software Engineer](engineering/software-engineer.md) - Full-stack development
  - [Frontend Engineer](engineering/frontend-engineer.md) - Web UI development
  - [Backend Engineer](engineering/backend-engineer.md) - Server and API development
  - [API Engineer](engineering/api-engineer.md) - API design and management
  - [React Native Engineer](engineering/react-native-engineer.md) - Mobile development

### Product & Design
- **[Product](product/)** - Product management and strategy
  - [Product Owner](product/product-owner.md) - Product vision and strategy
  - [Business Analyst](product/business-analyst.md) - Requirements analysis
- **[Design](design/)** - User experience and interface design
  - [Product Designer](design/product-designer.md) - UI/UX design systems
  - [UX Researcher](design/ux-researcher.md) - User research and insights

### Data & AI
- **[Data](data/)** - Data science and machine learning
  - [Data Scientist](data/data-scientist.md) - Data analysis and modeling
  - [ML Engineer](data/ml-engineer.md) - ML systems and deployment
  - [LLM Engineer](data/llm-engineer.md) - Large language model applications

### Quality Assurance
- **[QA](qa/)** - Quality assurance and testing
  - [QA Engineer](qa/qa-engineer.md) - Manual and automated testing
  - [Test Automation Engineer](qa/test-automation-engineer.md) - Test automation

### Operations
- **[DevOps](devops/)** - Infrastructure and deployment
  - [DevOps Engineer](devops/devops-engineer.md) - Infrastructure and CI/CD
  - [Deployment Manager](devops/deployment-manager.md) - Release management

### Specialized Agents
- **[GitHub Integration](github/)** - GitHub workflow automation
- **[Swarm Coordination](swarm/)** - Multi-agent coordination
- **[Consensus Systems](consensus/)** - Distributed consensus protocols  
- **[Architecture](architecture/)** - System design and architecture
- **[Analysis](analysis/)** - Code and system analysis
- **[Optimization](optimization/)** - Performance optimization
- **[Templates](templates/)** - Reusable agent templates
- **[SPARC Methodology](sparc/)** - Structured analysis and development

## Usage Instructions

### Getting Started
1. **Browse Categories**: Explore different functional areas above
2. **Select Agents**: Choose agents that match your current needs
3. **Customize**: Edit agent configurations for your specific requirements
4. **Use with Claude**: Reference agents when interacting with Claude AI

### Best Practices
- Start with core agents (researcher, planner, coder, reviewer, tester)
- Customize company and platform information in agent files
- Use specialized agents for specific technical domains
- Combine multiple agents for complex workflows

### Customization
To adapt these agents for your organization:
1. **Edit Templates**: Modify .md files directly to match your workflows
2. **Update Variables**: Change company, platform, and role information
3. **Add Roles**: Create new agent files based on existing templates
4. **Configure Tools**: Update tool references for your technology stack

## File Structure
\`\`\`
~/.claude/agents/
├── INDEX.md                    # This index file
├── GOLD_STANDARD.md           # Development standards reference  
├── README.md                  # General documentation
├── core/                      # Essential development agents
├── engineering/               # Software development specialists
├── product/                   # Product management
├── design/                    # UX/UI design
├── data/                      # Data science and ML
├── qa/                        # Quality assurance
├── devops/                    # DevOps and infrastructure
├── github/                    # GitHub integration
├── swarm/                     # Multi-agent coordination
├── consensus/                 # Distributed systems
├── architecture/              # System design
├── analysis/                  # Code analysis
├── optimization/              # Performance optimization
├── templates/                 # Reusable templates
└── sparc/                     # SPARC methodology
\`\`\`

## Support
For questions or customization help:
- Review the GOLD_STANDARD.md for development guidelines
- Check individual agent files for specific capabilities
- Refer to README.md files in each directory
- Modify templates to match your organization's needs
EOF
}

# Create index file for global agents
if [[ "$setup_global" == "y" ]]; then
    create_agent_index "$CLAUDE_AGENTS_DIR"
fi

# Save configuration
CONFIG_FILE="$HOME/.claude/agent-config.json"
mkdir -p "$(dirname "$CONFIG_FILE")"

cat > "$CONFIG_FILE" << EOF
{
  "company_name": "$COMPANY_NAME",
  "platform_description": "$PLATFORM_DESCRIPTION",
  "full_name": "$FULL_NAME",
  "email": "$EMAIL",
  "github_username": "$GITHUB_USERNAME",
  "role": "$ROLE",
  "global_agents_dir": "$CLAUDE_AGENTS_DIR",
  "source_agents_dir": "$SOURCE_AGENTS_DIR",
  "setup_version": "2.0",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "last_updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

log_success "Agent configuration saved to $CONFIG_FILE"

# Summary
echo
log_section "Claude Agent Setup Complete!"
echo

if [[ "$setup_global" == "y" ]]; then
    total_files=$(find "$CLAUDE_AGENTS_DIR" -type f -name "*.md" | wc -l | tr -d ' ')
    total_dirs=$(find "$CLAUDE_AGENTS_DIR" -type d | wc -l | tr -d ' ')
    
    log_success "✅ ${GREEN}Successfully configured Claude agents for $COMPANY_NAME${NC}"
    log_info "📁 Global agents directory: $CLAUDE_AGENTS_DIR"
    log_info "📊 Processed $total_files markdown files across $total_dirs directories"
    log_info "📄 Configuration saved: $CONFIG_FILE"
    log_info "📋 Setup index created: $CLAUDE_AGENTS_DIR/SETUP_INDEX.md"
    echo
    
    log_info "Agent categories installed:"
    categories=(core engineering product design data qa devops github swarm consensus architecture analysis optimization templates sparc)
    for category in "${categories[@]}"; do
        if [[ -d "$CLAUDE_AGENTS_DIR/$category" ]]; then
            count=$(find "$CLAUDE_AGENTS_DIR/$category" -name "*.md" | wc -l | tr -d ' ')
            log_info "  • $category: $count agents"
        fi
    done
    echo
    
    log_info "🎯 Next steps:"
    log_info "  1. Review the setup index: $CLAUDE_AGENTS_DIR/SETUP_INDEX.md"
    log_info "  2. Explore agent categories and customize as needed"
    log_info "  3. Reference specific agents when working with Claude AI"
    log_info "  4. Update agent templates to match your organization's workflows"
    echo
    
    log_info "💡 Quick start:"
    log_info "  • Core development workflow: researcher → planner → coder → reviewer → tester"
    log_info "  • Browse specialized agents in github/, swarm/, and optimization/ directories"
    log_info "  • Customize company information in agent templates"
else
    log_info "Agent setup skipped"
fi
echo