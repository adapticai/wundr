#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[GITHUB] $1" | tee -a "$LOG_FILE"
}

configure_git() {
    log "Configuring Git..."
    
    git config --global user.name "$SETUP_FULL_NAME"
    git config --global user.email "$SETUP_GITHUB_EMAIL"
    
    git config --global init.defaultBranch main
    git config --global pull.rebase false
    git config --global push.autoSetupRemote true
    git config --global fetch.prune true
    git config --global diff.colorMoved zebra
    git config --global rerere.enabled true
    git config --global column.ui auto
    git config --global branch.sort -committerdate
    git config --global core.editor "code --wait"
    git config --global merge.tool vscode
    git config --global mergetool.vscode.cmd 'code --wait $MERGED'
    git config --global diff.tool vscode
    git config --global difftool.vscode.cmd 'code --wait --diff $LOCAL $REMOTE'
    
    git config --global alias.st status
    git config --global alias.co checkout
    git config --global alias.br branch
    git config --global alias.ci commit
    git config --global alias.cm "commit -m"
    git config --global alias.ca "commit --amend"
    git config --global alias.unstage "reset HEAD --"
    git config --global alias.last "log -1 HEAD"
    git config --global alias.visual "!gitk"
    git config --global alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
    git config --global alias.sync "!git fetch --all && git pull"
    git config --global alias.undo "reset --soft HEAD~1"
    git config --global alias.prune "fetch --prune"
    git config --global alias.stash-all "stash save --include-untracked"
    
    log "Git configured"
}

setup_github_cli() {
    log "Setting up GitHub CLI..."
    
    if ! command -v gh &> /dev/null; then
        brew install gh
    fi
    
    # Check if already authenticated
    if ! gh auth status &>/dev/null; then
        log "GitHub CLI requires authentication"
        log "Starting GitHub authentication..."
        
        # Interactive authentication with gh
        if [[ "$SKIP_PROMPTS" != "true" ]]; then
            gh auth login --web --git-protocol ssh
        else
            log "Skipping interactive auth. Run 'gh auth login' manually to authenticate."
        fi
    else
        log "GitHub CLI already authenticated"
    fi
    
    # Configure gh settings
    gh config set git_protocol ssh
    gh config set prompt enabled
    gh config set editor "code --wait"
    
    # Export the token for use by other scripts if authenticated
    if gh auth status &>/dev/null; then
        export GITHUB_TOKEN=$(gh auth token)
        log "GitHub token exported for session use"
    fi
    
    log "GitHub CLI configured"
}

generate_ssh_key() {
    log "Setting up SSH key for GitHub..."
    
    local ssh_key="$HOME/.ssh/id_ed25519"
    
    if [[ -f "$ssh_key" ]]; then
        log "SSH key already exists"
    else
        ssh-keygen -t ed25519 -C "$SETUP_GITHUB_EMAIL" -f "$ssh_key" -N ""
        log "SSH key generated"
    fi
    
    # Add SSH key to GitHub using gh CLI if authenticated
    if gh auth status &>/dev/null; then
        if ! gh ssh-key list | grep -q "$(cat "${ssh_key}.pub" | awk '{print $2}')"; then
            log "Adding SSH key to GitHub account..."
            gh ssh-key add "${ssh_key}.pub" --title "$(hostname)-$(date +%Y%m%d)"
            log "SSH key added to GitHub"
        else
            log "SSH key already added to GitHub"
        fi
    fi
    
    if [[ "$OS" == "macos" ]]; then
        cat >> "$HOME/.ssh/config" << EOF

Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
EOF
        
        ssh-add --apple-use-keychain "$ssh_key"
    else
        ssh-add "$ssh_key"
    fi
    
    log "SSH key configured"
}

setup_commit_signing() {
    log "Setting up commit signing..."
    
    if command -v gpg &> /dev/null; then
        if ! gpg --list-secret-keys --keyid-format LONG | grep -q "$SETUP_GITHUB_EMAIL"; then
            log "Generating GPG key..."
            
            cat > /tmp/gpg-gen-key.txt << EOF
%echo Generating GPG key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $SETUP_FULL_NAME
Name-Email: $SETUP_GITHUB_EMAIL
Expire-Date: 2y
%no-protection
%commit
%echo done
EOF
            
            gpg --batch --generate-key /tmp/gpg-gen-key.txt
            rm /tmp/gpg-gen-key.txt
            
            local key_id=$(gpg --list-secret-keys --keyid-format LONG | grep -A 1 "$SETUP_GITHUB_EMAIL" | head -1 | awk '{print $2}' | cut -d'/' -f2)
            
            if [[ -n "$key_id" ]]; then
                git config --global user.signingkey "$key_id"
                git config --global commit.gpgsign true
                git config --global tag.gpgsign true
                
                # Add GPG key to GitHub using gh CLI if authenticated
                if gh auth status &>/dev/null; then
                    log "Adding GPG key to GitHub account..."
                    local gpg_public_key=$(gpg --armor --export "$key_id")
                    echo "$gpg_public_key" | gh gpg-key add -
                    log "GPG key added to GitHub"
                else
                    log "GPG key generated. Add the following to your GitHub account:"
                    gpg --armor --export "$key_id"
                fi
            fi
        else
            log "GPG key already exists"
        fi
    else
        log "GPG not installed, skipping commit signing setup"
    fi
}

create_gitignore_global() {
    log "Creating global .gitignore..."
    
    cat > "$HOME/.gitignore_global" << 'EOF'
# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
Desktop.ini

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~
.project
.classpath
.settings/
*.sublime-project
*.sublime-workspace

# Dependencies
node_modules/
bower_components/
vendor/
.pnpm-debug.log*

# Build outputs
dist/
build/
out/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment files
.env
.env.local
.env.*.local
.env.development
.env.test
.env.production

# Test coverage
coverage/
*.lcov
.nyc_output/

# Cache directories
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist/
.serverless/
.fusebox/
.dynamodb/
.tern-port
.yarn/cache/
.yarn/unplugged/
.yarn/build-state.yml
.yarn/install-state.gz

# Misc
*.pid
*.seed
*.pid.lock
.eslintcache
.stylelintcache
*.tsbuildinfo
EOF
    
    git config --global core.excludesfile "$HOME/.gitignore_global"
    
    log "Global .gitignore created"
}

setup_github_templates() {
    log "Creating GitHub templates..."
    
    mkdir -p "${SCRIPT_DIR}/templates/github"
    
    cat > "${SCRIPT_DIR}/templates/github/pull_request_template.md" << 'EOF'
## Description
Brief description of the changes in this PR

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
EOF
    
    mkdir -p "${SCRIPT_DIR}/templates/github/ISSUE_TEMPLATE"
    
    cat > "${SCRIPT_DIR}/templates/github/ISSUE_TEMPLATE/bug_report.md" << 'EOF'
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS]
 - Node version: [e.g. 20.0.0]
 - Package version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
EOF
    
    cat > "${SCRIPT_DIR}/templates/github/ISSUE_TEMPLATE/feature_request.md" << 'EOF'
---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
EOF
}

main() {
    log "Starting GitHub setup..."
    
    configure_git
    setup_github_cli
    generate_ssh_key
    setup_commit_signing
    create_gitignore_global
    setup_github_templates
    
    log "GitHub setup completed"
}

main