#!/bin/bash

# Comprehensive MCP Tools Installation Script
# Installs: Firecrawl, Context7, Playwright, Browser MCP, Sequential Thinking

set -e

echo "🚀 Installing MCP Tools Suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please modify for your OS."
    exit 1
fi

# Step 1: Install Google Chrome if not present
install_chrome() {
    if [ ! -d "/Applications/Google Chrome.app" ]; then
        print_status "Installing Google Chrome..."
        
        # Download Chrome
        curl -L -o ~/Downloads/googlechrome.dmg "https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg"
        
        # Mount DMG
        hdiutil attach ~/Downloads/googlechrome.dmg -quiet
        
        # Copy to Applications
        cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/
        
        # Unmount DMG
        hdiutil detach "/Volumes/Google Chrome" -quiet
        
        # Clean up
        rm ~/Downloads/googlechrome.dmg
        
        # Set as default browser
        open -a "Google Chrome" --args --make-default-browser
        
        print_success "Chrome installed successfully"
    else
        print_status "Chrome already installed"
    fi
}

# Step 2: Install Claude CLI if not present
install_claude_cli() {
    if ! command -v claude &> /dev/null; then
        print_status "Installing Claude CLI..."
        npm install -g @anthropic/claude-cli
        print_success "Claude CLI installed"
    else
        print_status "Claude CLI already installed"
    fi
}

# Step 3: Install Claude Flow MCP
install_claude_flow() {
    print_status "Installing Claude Flow MCP server..."
    
    # Add Claude Flow MCP server
    npx claude mcp add claude-flow npx claude-flow@alpha mcp start
    
    # Configure Claude Flow
    cat > ~/.claude/.claude-flow/config.json << 'EOF'
{
  "memory": {
    "backend": "sqlite",
    "path": "~/.claude/.claude-flow/memory.db"
  },
  "neural": {
    "enabled": true,
    "modelPath": "~/.claude/.claude-flow/models"
  },
  "metrics": {
    "enabled": true,
    "exportPath": "~/.claude/.claude-flow/metrics"
  },
  "agents": {
    "maxConcurrent": 10,
    "defaultTopology": "mesh"
  }
}
EOF
    
    print_success "Claude Flow configured"
}

# Step 4: Install Firecrawl MCP
install_firecrawl() {
    print_status "Installing Firecrawl MCP server..."
    
    # Install Firecrawl MCP
    npm install -g @firecrawl/mcp-server
    
    # Add to Claude
    npx claude mcp add firecrawl npx @firecrawl/mcp-server
    
    # Create config template
    cat > ~/.claude/.env.firecrawl << 'EOF'
# Firecrawl API Configuration
FIRECRAWL_API_KEY=your_api_key_here
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_MAX_DEPTH=3
FIRECRAWL_TIMEOUT=30000
EOF
    
    print_success "Firecrawl MCP installed (configure API key in ~/.claude/.env.firecrawl)"
}

# Step 5: Install Context7 MCP
install_context7() {
    print_status "Installing Context7 MCP server..."
    
    # Install Context7 MCP
    npm install -g @context7/mcp-server
    
    # Add to Claude
    npx claude mcp add context7 npx @context7/mcp-server
    
    # Create config template
    cat > ~/.claude/.env.context7 << 'EOF'
# Context7 API Configuration
CONTEXT7_API_KEY=your_api_key_here
CONTEXT7_API_URL=https://api.context7.ai
CONTEXT7_VECTOR_DB=pinecone
CONTEXT7_EMBEDDING_MODEL=text-embedding-ada-002
EOF
    
    print_success "Context7 MCP installed (configure API key in ~/.claude/.env.context7)"
}

# Step 6: Install Playwright MCP
install_playwright() {
    print_status "Installing Playwright MCP server..."
    
    # Install Playwright and browsers
    npm install -g playwright
    npx playwright install chromium firefox webkit
    
    # Install Playwright MCP
    npm install -g @playwright/mcp-server
    
    # Add to Claude
    npx claude mcp add playwright npx @playwright/mcp-server
    
    # Create config
    cat > ~/.claude/.playwright-config.json << 'EOF'
{
  "browsers": ["chromium", "firefox", "webkit"],
  "headless": false,
  "timeout": 30000,
  "viewport": {
    "width": 1280,
    "height": 720
  }
}
EOF
    
    print_success "Playwright MCP installed with all browsers"
}

# Step 7: Install Browser MCP
install_browser_mcp() {
    print_status "Installing Browser MCP server..."
    
    # Install Browser MCP
    npm install -g @browser/mcp-server
    
    # Add to Claude
    npx claude mcp add browser npx @browser/mcp-server
    
    # Create Chrome extension directory
    EXTENSION_DIR=~/.claude/browser-extension
    mkdir -p $EXTENSION_DIR
    
    # Create manifest.json
    cat > $EXTENSION_DIR/manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Browser MCP Bridge",
  "version": "1.0.0",
  "description": "Bridge for Browser MCP server communication",
  "permissions": ["activeTab", "storage", "debugger", "webNavigation"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "host_permissions": ["http://localhost:3000/*"]
}
EOF
    
    # Create background.js
    cat > $EXTENSION_DIR/background.js << 'EOF'
// Browser MCP Bridge - Background Service Worker
const MCP_SERVER_URL = 'http://localhost:3000/mcp/browser';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'MCP_COMMAND') {
    fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: request.command,
        params: request.params,
        tabId: sender.tab?.id
      })
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Listen for MCP server commands
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'mcp-bridge') {
    port.onMessage.addListener((msg) => {
      // Handle commands from MCP server
      if (msg.type === 'EXECUTE') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
            port.postMessage(response);
          });
        });
      }
    });
  }
});
EOF
    
    # Create content.js
    cat > $EXTENSION_DIR/content.js << 'EOF'
// Browser MCP Bridge - Content Script
const port = chrome.runtime.connect({ name: 'mcp-bridge' });

// Listen for commands from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXECUTE') {
    try {
      const result = eval(request.code);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

// Inject MCP helper functions
window.__MCP__ = {
  click: (selector) => document.querySelector(selector)?.click(),
  type: (selector, text) => {
    const element = document.querySelector(selector);
    if (element) {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  getText: (selector) => document.querySelector(selector)?.textContent,
  getHtml: (selector) => document.querySelector(selector)?.innerHTML,
  waitForElement: (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(interval);
          resolve(element);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  }
};
EOF
    
    # Create popup.html
    cat > $EXTENSION_DIR/popup.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Browser MCP Bridge</title>
  <style>
    body {
      width: 250px;
      padding: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    h3 { margin-top: 0; }
    .status {
      padding: 8px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .connected { background: #d4edda; color: #155724; }
    .disconnected { background: #f8d7da; color: #721c24; }
    .info { font-size: 12px; color: #666; margin-top: 10px; }
  </style>
</head>
<body>
  <h3>Browser MCP Bridge</h3>
  <div class="status connected" id="status">Connected to MCP Server</div>
  <div class="info">
    The Browser MCP extension bridges communication between Claude and your browser.
  </div>
  <script src="popup.js"></script>
</body>
</html>
EOF
    
    # Create popup.js
    cat > $EXTENSION_DIR/popup.js << 'EOF'
// Check connection status
fetch('http://localhost:3000/mcp/browser/status')
  .then(response => response.json())
  .then(data => {
    document.getElementById('status').textContent = 'Connected to MCP Server';
    document.getElementById('status').className = 'status connected';
  })
  .catch(error => {
    document.getElementById('status').textContent = 'Disconnected from MCP Server';
    document.getElementById('status').className = 'status disconnected';
  });
EOF
    
    # Create simple icons (base64 encoded 1x1 pixel)
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > $EXTENSION_DIR/icon16.png
    cp $EXTENSION_DIR/icon16.png $EXTENSION_DIR/icon48.png
    cp $EXTENSION_DIR/icon16.png $EXTENSION_DIR/icon128.png
    
    print_success "Browser MCP installed with Chrome extension"
    print_warning "To install the extension:"
    print_warning "1. Open Chrome and go to chrome://extensions"
    print_warning "2. Enable 'Developer mode'"
    print_warning "3. Click 'Load unpacked' and select: $EXTENSION_DIR"
}

# Step 8: Install Sequential Thinking MCP
install_sequential_thinking() {
    print_status "Installing MIT Sequential Thinking MCP server..."
    
    # Clone and install Sequential Thinking
    SEQUENTIAL_DIR=~/.claude/mcp-servers/sequentialthinking
    mkdir -p ~/.claude/mcp-servers
    
    if [ ! -d "$SEQUENTIAL_DIR" ]; then
        git clone https://github.com/modelcontextprotocol/servers.git ~/.claude/mcp-servers-repo
        cp -r ~/.claude/mcp-servers-repo/src/sequentialthinking $SEQUENTIAL_DIR
        cd $SEQUENTIAL_DIR
        npm install
        npm run build
    fi
    
    # Add to Claude
    npx claude mcp add sequentialthinking node $SEQUENTIAL_DIR/dist/index.js
    
    # Create config
    cat > ~/.claude/.sequentialthinking-config.json << 'EOF'
{
  "reasoning": {
    "maxSteps": 10,
    "verbosity": "normal",
    "saveHistory": true,
    "historyPath": "~/.claude/.sequentialthinking/history"
  },
  "models": {
    "default": "claude-3-opus",
    "validation": "claude-3-sonnet"
  }
}
EOF
    
    print_success "Sequential Thinking MCP installed"
}

# Step 9: Configure Claude settings
configure_claude_settings() {
    print_status "Configuring Claude settings..."
    
    # Backup existing settings if present
    if [ -f ~/.claude/settings.json ]; then
        cp ~/.claude/settings.json ~/.claude/settings.json.backup
        print_status "Backed up existing settings to settings.json.backup"
    fi
    
    # Create comprehensive settings
    cat > ~/.claude/settings.json << 'EOF'
{
  "claudeCodeOptions": {
    "enabledMcpjsonServers": [
      "claude-flow",
      "firecrawl",
      "context7",
      "playwright",
      "browser",
      "sequentialthinking"
    ],
    "gitAutoCompact": true,
    "contextCompactionThreshold": 100000,
    "enableHooks": true
  },
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "env": {
        "CLAUDE_FLOW_MEMORY_BACKEND": "sqlite",
        "CLAUDE_FLOW_ENABLE_NEURAL": "true"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["@firecrawl/mcp-server"],
      "env": {
        "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["@context7/mcp-server"],
      "env": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp-server"]
    },
    "browser": {
      "command": "npx",
      "args": ["@browser/mcp-server"],
      "env": {
        "BROWSER_CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      }
    },
    "sequentialthinking": {
      "command": "node",
      "args": ["~/.claude/mcp-servers/sequentialthinking/dist/index.js"]
    }
  }
}
EOF
    
    print_success "Claude settings configured"
}

# Step 10: Create validation script
create_validation_script() {
    print_status "Creating validation script..."
    
    cat > ~/.claude/validate-mcp.sh << 'EOF'
#!/bin/bash

echo "🔍 Validating MCP Tools Installation..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Check function
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2 installed"
        return 0
    else
        echo -e "${RED}✗${NC} $2 not found"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $2 not found"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $2 not found"
        return 1
    fi
}

# Run checks
echo "Core Components:"
check_command claude "Claude CLI"
check_command npx "NPX"
check_dir "/Applications/Google Chrome.app" "Google Chrome"

echo -e "\nMCP Servers:"
check_file ~/.claude/settings.json "Claude settings"
check_dir ~/.claude/.claude-flow "Claude Flow directory"
check_dir ~/.claude/browser-extension "Browser extension"
check_dir ~/.claude/mcp-servers/sequentialthinking "Sequential Thinking"

echo -e "\nConfiguration Files:"
check_file ~/.claude/.env.firecrawl "Firecrawl config"
check_file ~/.claude/.env.context7 "Context7 config"
check_file ~/.claude/.playwright-config.json "Playwright config"
check_file ~/.claude/.sequentialthinking-config.json "Sequential Thinking config"

echo -e "\n📊 Validation complete!"
EOF
    
    chmod +x ~/.claude/validate-mcp.sh
    print_success "Validation script created at ~/.claude/validate-mcp.sh"
}

# Main installation flow
main() {
    echo "================================================"
    echo "    MCP Tools Comprehensive Installation"
    echo "================================================"
    echo ""
    
    # Create Claude directory if it doesn't exist
    mkdir -p ~/.claude
    
    # Run installations
    install_chrome
    install_claude_cli
    install_claude_flow
    install_firecrawl
    install_context7
    install_playwright
    install_browser_mcp
    install_sequential_thinking
    configure_claude_settings
    create_validation_script
    
    echo ""
    echo "================================================"
    print_success "MCP Tools installation complete!"
    echo "================================================"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure API keys in ~/.claude/.env.* files"
    echo "2. Install Browser MCP Chrome extension (see instructions above)"
    echo "3. Run validation: ~/.claude/validate-mcp.sh"
    echo "4. Restart Claude Desktop to load new MCP servers"
    echo ""
    echo "📚 Documentation:"
    echo "- Claude Flow: https://github.com/ruvnet/claude-flow"
    echo "- Firecrawl: https://docs.firecrawl.dev"
    echo "- Context7: https://context7.ai/docs"
    echo "- Playwright: https://playwright.dev"
    echo "- Sequential Thinking: https://github.com/modelcontextprotocol/servers"
    echo ""
}

# Run main installation
main