#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[VSCODE] $1" | tee -a "$LOG_FILE"
}

install_vscode() {
    log "Installing Visual Studio Code..."
    
    if [[ "$OS" == "macos" ]]; then
        if [[ -d "/Applications/Visual Studio Code.app" ]]; then
            log "VS Code already installed"
        else
            brew install --cask visual-studio-code
        fi
        
        if ! command -v code &> /dev/null; then
            log "Installing VS Code command line tools..."
            cat << 'EOF' >> "$HOME/.zshrc"
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
EOF
            export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
        fi
    elif [[ "$OS" == "linux" ]]; then
        if ! command -v code &> /dev/null; then
            wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
            sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
            sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
            sudo apt update
            sudo apt install code
        else
            log "VS Code already installed"
        fi
    fi
    
    log "VS Code installed"
}

install_extensions() {
    log "Installing VS Code extensions..."
    
    local extensions=(
        # Core Development
        "dbaeumer.vscode-eslint"
        "esbenp.prettier-vscode"
        "ms-vscode.vscode-typescript-next"
        "biomejs.biome"
        
        # TypeScript/JavaScript
        "mgmcdermott.vscode-language-babel"
        "VisualStudioExptTeam.vscodeintellicode"
        "VisualStudioExptTeam.intellicode-api-usage-examples"
        "christian-kohler.path-intellisense"
        "christian-kohler.npm-intellisense"
        "eg2.vscode-npm-script"
        "wix.vscode-import-cost"
        "sburg.vscode-javascript-booster"
        "usernamehw.errorlens"
        "streetsidesoftware.code-spell-checker"
        
        # React/Next.js
        "dsznajder.es7-react-js-snippets"
        "burkeholland.simple-react-snippets"
        "jpoissonnier.vscode-styled-components"
        "bradlc.vscode-tailwindcss"
        "formulahendry.auto-rename-tag"
        "naumovs.color-highlight"
        
        # Testing
        "Orta.vscode-jest"
        "firsttris.vscode-jest-runner"
        "hbenl.vscode-test-explorer"
        
        # Git
        "eamodio.gitlens"
        "donjayamanne.githistory"
        "mhutchie.git-graph"
        "GitHub.vscode-pull-request-github"
        
        # Docker
        "ms-azuretools.vscode-docker"
        "ms-vscode-remote.remote-containers"
        
        # Database
        "mtxr.sqltools"
        "mtxr.sqltools-driver-pg"
        "mtxr.sqltools-driver-mysql"
        "mongodb.mongodb-vscode"
        "prisma.prisma"
        
        # API Development
        "rangav.vscode-thunder-client"
        "42Crunch.vscode-openapi"
        "arjun.swagger-viewer"
        
        # Markdown
        "yzhang.markdown-all-in-one"
        "DavidAnson.vscode-markdownlint"
        "bierner.markdown-mermaid"
        
        # Productivity
        "alefragnani.project-manager"
        "alefragnani.Bookmarks"
        "gruntfuggly.todo-tree"
        "wayou.vscode-todo-highlight"
        "mikestead.dotenv"
        "EditorConfig.EditorConfig"
        "redhat.vscode-yaml"
        "ms-vscode.live-server"
        "ritwickdey.LiveServer"
        
        # Themes and Icons
        "PKief.material-icon-theme"
        "zhuangtongfa.material-theme"
        "GitHub.github-vscode-theme"
        "dracula-theme.theme-dracula"
        
        # AI/Copilot
        "GitHub.copilot"
        "GitHub.copilot-chat"
        "Continue.continue"
        
        # Remote Development
        "ms-vscode-remote.remote-ssh"
        "ms-vscode-remote.remote-ssh-edit"
        "ms-vscode.remote-explorer"
        
        # Other Languages Support
        "golang.go"
        "rust-lang.rust-analyzer"
        "ms-python.python"
        "ms-python.vscode-pylance"
        
        # Utilities
        "shd101wyy.markdown-preview-enhanced"
        "mechatroner.rainbow-csv"
        "janisdd.vscode-edit-csv"
        "qcz.text-power-tools"
        "sleistner.vscode-fileutils"
        "vscode-icons-team.vscode-icons"
    )
    
    for extension in "${extensions[@]}"; do
        log "Installing $extension..."
        code --install-extension "$extension" --force || log "Failed to install $extension"
    done
    
    log "VS Code extensions installed"
}

configure_vscode() {
    log "Configuring VS Code settings..."
    
    mkdir -p "$HOME/Library/Application Support/Code/User" 2>/dev/null || mkdir -p "$HOME/.config/Code/User"
    
    local settings_path
    if [[ "$OS" == "macos" ]]; then
        settings_path="$HOME/Library/Application Support/Code/User/settings.json"
    else
        settings_path="$HOME/.config/Code/User/settings.json"
    fi
    
    cat > "$settings_path" << 'EOF'
{
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
  "editor.fontLigatures": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": true,
  "editor.renderWhitespace": "trailing",
  "editor.rulers": [80, 120],
  "editor.wordWrap": "on",
  "editor.minimap.enabled": true,
  "editor.minimap.renderCharacters": false,
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.quickSuggestions": {
    "strings": true
  },
  "editor.suggestSelection": "first",
  "editor.snippetSuggestions": "top",
  "editor.cursorBlinking": "smooth",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "editor.linkedEditing": true,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": true,
  "editor.stickyScroll.enabled": true,
  "editor.inlineSuggest.enabled": true,
  
  "files.autoSave": "onFocusChange",
  "files.trimTrailingWhitespace": true,
  "files.trimFinalNewlines": true,
  "files.insertFinalNewline": true,
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true,
    "**/.turbo": true
  },
  "files.watcherExclude": {
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/.next/**": true
  },
  
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.fontFamily": "'JetBrains Mono', 'Fira Code', monospace",
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.defaultProfile.linux": "bash",
  "terminal.integrated.env.osx": {
    "PATH": "${env:PATH}:${env:HOME}/.local/bin:${env:HOME}/.npm-global/bin"
  },
  
  "workbench.colorTheme": "GitHub Dark Default",
  "workbench.iconTheme": "material-icon-theme",
  "workbench.startupEditor": "none",
  "workbench.editor.enablePreview": false,
  "workbench.editor.highlightModifiedTabs": true,
  "workbench.tree.indent": 20,
  
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.preferences.quoteStyle": "single",
  "typescript.format.semicolons": "insert",
  "typescript.suggest.autoImports": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  
  "javascript.updateImportsOnFileMove.enabled": "always",
  "javascript.preferences.quoteStyle": "single",
  "javascript.format.semicolons": "insert",
  "javascript.suggest.autoImports": true,
  
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[scss]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[yaml]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.run": "onType",
  "eslint.probe": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  
  "prettier.requireConfig": true,
  "prettier.useEditorConfig": true,
  
  "git.autofetch": true,
  "git.confirmSync": false,
  "git.enableSmartCommit": true,
  "git.decorations.enabled": true,
  "git.suggestSmartCommit": true,
  
  "gitlens.hovers.currentLine.over": "line",
  "gitlens.codeLens.enabled": false,
  
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  },
  "emmet.triggerExpansionOnTab": true,
  
  "npm.packageManager": "auto",
  "npm.scriptExplorerAction": "run",
  
  "tailwindCSS.emmetCompletions": true,
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "plaintext": true,
    "markdown": true
  },
  
  "todo-tree.highlights.enabled": true,
  "todo-tree.general.tags": [
    "TODO",
    "FIXME",
    "BUG",
    "HACK",
    "NOTE",
    "WARNING"
  ],
  
  "extensions.autoUpdate": true,
  "extensions.autoCheckUpdates": true,
  
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true,
    "**/coverage": true,
    "**/.turbo": true
  },
  
  "explorer.confirmDelete": false,
  "explorer.confirmDragAndDrop": false,
  
  "errorLens.enabled": true,
  "errorLens.fontStyle": "italic",
  
  "security.workspace.trust.untrustedFiles": "open",
  
  "redhat.telemetry.enabled": false,
  "telemetry.telemetryLevel": "off"
}
EOF
    
    log "VS Code settings configured"
}

setup_keybindings() {
    log "Setting up VS Code keybindings..."
    
    local keybindings_path
    if [[ "$OS" == "macos" ]]; then
        keybindings_path="$HOME/Library/Application Support/Code/User/keybindings.json"
    else
        keybindings_path="$HOME/.config/Code/User/keybindings.json"
    fi
    
    cat > "$keybindings_path" << 'EOF'
[
  {
    "key": "cmd+shift+d",
    "command": "editor.action.duplicateSelection"
  },
  {
    "key": "cmd+d",
    "command": "editor.action.deleteLines",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "alt+up",
    "command": "editor.action.moveLinesUpAction",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "alt+down",
    "command": "editor.action.moveLinesDownAction",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "cmd+shift+/",
    "command": "editor.action.blockComment",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "cmd+k cmd+u",
    "command": "editor.action.transformToUppercase"
  },
  {
    "key": "cmd+k cmd+l",
    "command": "editor.action.transformToLowercase"
  },
  {
    "key": "cmd+shift+v",
    "command": "markdown.showPreview",
    "when": "!notebookEditorFocused && editorLangId == 'markdown'"
  },
  {
    "key": "cmd+shift+t",
    "command": "workbench.action.terminal.new"
  },
  {
    "key": "cmd+shift+g",
    "command": "workbench.view.scm"
  }
]
EOF
    
    log "VS Code keybindings configured"
}

main() {
    log "Starting VS Code setup..."
    
    install_vscode
    
    if command -v code &> /dev/null; then
        install_extensions
        configure_vscode
        setup_keybindings
        
        log "VS Code setup completed"
    else
        log "Warning: VS Code command line tools not available. Please install manually from VS Code."
    fi
}

main