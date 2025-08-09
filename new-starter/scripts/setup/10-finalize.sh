#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[FINALIZE] $1" | tee -a "$LOG_FILE"
}

verify_installations() {
    log "Verifying installations..."
    
    local tools=(
        "brew:Homebrew"
        "git:Git"
        "gh:GitHub CLI"
        "node:Node.js"
        "npm:npm"
        "pnpm:pnpm"
        "yarn:Yarn"
        "docker:Docker"
        "code:VS Code"
        "claude:Claude Code"
        "claude-flow:Claude Flow"
    )
    
    echo ""
    echo "Installation Status:"
    echo "===================="
    
    for tool_spec in "${tools[@]}"; do
        IFS=':' read -r cmd name <<< "$tool_spec"
        if command -v "$cmd" &> /dev/null; then
            version=$($cmd --version 2>/dev/null | head -n1 || echo "installed")
            echo "✅ $name: $version"
        else
            echo "❌ $name: Not installed"
        fi
    done
    
    echo ""
}

create_workspace() {
    log "Creating development workspace..."
    
    if [[ ! -d "${SETUP_ROOT_DIR}" ]]; then
        mkdir -p "${SETUP_ROOT_DIR}"
        log "Created ${SETUP_ROOT_DIR} directory"
    fi
    
    cat > "${SETUP_ROOT_DIR}/.workspace" << EOF
# Development Workspace Configuration
# Generated on $(date)

DEVELOPER_NAME="$SETUP_FULL_NAME"
DEVELOPER_EMAIL="$SETUP_EMAIL"
GITHUB_USERNAME="$SETUP_GITHUB_USERNAME"
COMPANY="$SETUP_COMPANY"

# Tool Versions
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
DOCKER_VERSION=$(docker --version 2>/dev/null || echo "not installed")

# Setup completed on $(date)
EOF
    
    log "Workspace configuration saved"
}

generate_summary() {
    log "Generating setup summary..."
    
    local summary_file="${SCRIPT_DIR}/setup-summary.md"
    
    cat > "$summary_file" << EOF
# Development Environment Setup Summary

**Date:** $(date)
**Developer:** $SETUP_FULL_NAME
**Email:** $SETUP_EMAIL
**GitHub:** $SETUP_GITHUB_USERNAME

## Installed Tools

### Package Managers
- Homebrew
- npm, pnpm, yarn
- nvm (Node Version Manager)

### Development Tools
- Git & GitHub CLI
- Docker Desktop
- Visual Studio Code
- Claude Code & Claude Flow

### Node.js Versions
- Node.js 18, 20, 22 (via nvm)
- Default: Node.js 20

### VS Code Extensions
- TypeScript/JavaScript support
- ESLint & Prettier
- Git tools (GitLens, GitHub)
- Docker support
- React/Next.js development
- Testing tools
- AI assistants (Copilot, Continue)

### Configuration Files
- ESLint rules
- Prettier formatting
- TypeScript strict mode
- Git hooks (Husky)
- Docker templates
- GitHub templates

## Next Steps

1. **Authenticate Services:**
   - GitHub: Run \`gh auth login\`
   - Slack: Open Slack and sign in
   - Claude: Run \`claude\` to authenticate

2. **Configure SSH:**
   - Add SSH key to GitHub: \`gh ssh-key add ~/.ssh/id_ed25519.pub\`
   - Test connection: \`ssh -T git@github.com\`

3. **Initialize a Project:**
   - Create new project: \`mkdir my-project && cd my-project\`
   - Initialize Git: \`git init\`
   - Initialize Claude Flow: \`claude-flow init\`
   - Install dependencies: \`npm init -y && npm install\`

4. **Customize Settings:**
   - VS Code: Preferences → Settings
   - Git: Edit ~/.gitconfig
   - Shell: Edit ~/.zshrc or ~/.bashrc

## Helpful Commands

### Git
\`\`\`bash
git lg          # Pretty git log
git sync        # Fetch and pull all branches
git undo        # Undo last commit (soft)
\`\`\`

### Node.js
\`\`\`bash
nvm use         # Switch Node version
ni              # npm install
nr dev          # npm run dev
\`\`\`

### Docker
\`\`\`bash
dcup            # docker-compose up
dps             # docker ps
dclean          # Clean all Docker resources
\`\`\`

### Claude
\`\`\`bash
claude          # Start Claude Code
clf init        # Initialize Claude Flow
swarm-start     # Start Claude Flow swarm
\`\`\`

## Troubleshooting

If any tools are not working:

1. **Restart Terminal:** Close and reopen your terminal
2. **Source Profile:** Run \`source ~/.zshrc\` or \`source ~/.bashrc\`
3. **Check PATH:** Run \`echo \$PATH\` to verify tool locations
4. **Reinstall:** Use the individual setup scripts in \`scripts/setup/\`

## Documentation

- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Flow GitHub](https://github.com/ruvnet/claude-flow)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Support

For issues or questions:
- Check logs: \`cat logs/setup_*.log\`
- Review CLAUDE.md for development standards
- Create an issue in the repository

---

*Setup completed successfully! Happy coding! 🚀*
EOF
    
    log "Setup summary saved to: $summary_file"
    
    echo ""
    cat "$summary_file"
}

show_quick_start() {
    log "Quick start guide..."
    
    # Ensure PATH includes Homebrew and npm-global
    if [[ "$OS" == "macos" ]]; then
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    elif [[ "$OS" == "linux" ]]; then
        if [[ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]]; then
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        fi
    fi
    
    export PATH="$HOME/.npm-global/bin:$PATH"
    
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "                    🎉 SETUP COMPLETE! 🎉"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "Quick Start Commands:"
    echo "────────────────────"
    echo ""
    echo "1. IMPORTANT: Restart your terminal or run:"
    echo "   source ~/.zshrc"
    echo ""
    echo "2. Authenticate GitHub (after restarting terminal):"
    echo "   gh auth login"
    echo ""
    echo "3. Start coding with Claude:"
    echo "   claude"
    echo ""
    echo "4. Create your first project:"
    echo "   mkdir ${SETUP_ROOT_DIR}/my-project"
    echo "   cd ${SETUP_ROOT_DIR}/my-project"
    echo "   npm init -y"
    echo "   claude-flow init"
    echo ""
    echo "5. Open in VS Code:"
    echo "   code ."
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "NOTE: If 'gh' command is not found, restart your terminal first!"
    echo ""
}

cleanup_temp_files() {
    log "Cleaning up temporary files..."
    
    rm -f /tmp/gpg-gen-key.txt 2>/dev/null || true
    rm -f "${SCRIPT_DIR}/.env.setup" 2>/dev/null || true
    
    log "Cleanup completed"
}

main() {
    log "Finalizing setup..."
    
    verify_installations
    create_workspace
    generate_summary
    show_quick_start
    cleanup_temp_files
    
    log "Setup finalization completed!"
    log "Please restart your terminal to apply all changes."
}

main