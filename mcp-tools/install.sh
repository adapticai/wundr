#!/bin/bash
# MCP Tools Installation Script for Claude Code

echo "🚀 Installing Wundr MCP Tools for Claude Code..."
echo "============================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Install dependencies
echo "📦 Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Build the project
echo "🔨 Building MCP tools..."
npm run build

# Create global link
echo "🔗 Creating global npm link..."
npm link

# Create the MCP server wrapper script
echo "📝 Creating MCP server wrapper..."
cat > "$SCRIPT_DIR/wundr-mcp" << 'EOF'
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'dist', 'server.js');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});
EOF

chmod +x "$SCRIPT_DIR/wundr-mcp"

# Create Claude Code configuration helper
echo "⚙️ Creating Claude Code configuration..."
cat > "$SCRIPT_DIR/claude-config.json" << EOF
{
  "mcpServers": {
    "wundr": {
      "command": "wundr-mcp",
      "args": [],
      "env": {
        "WUNDR_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
EOF

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Add to Claude Code settings:"
echo "   - Open Claude Code settings (claude config)"
echo "   - Add the following to your MCP servers configuration:"
echo ""
cat "$SCRIPT_DIR/claude-config.json"
echo ""
echo "2. Restart Claude Code to load the MCP tools"
echo ""
echo "3. Verify installation:"
echo "   claude mcp list"
echo "   # Should show: wundr-mcp-tools"
echo ""
echo "4. Try using the tools:"
echo "   - 'Check for code drift'"
echo "   - 'Standardize code patterns'"
echo "   - 'Generate governance report'"
echo ""
echo "📚 For more information, see: $SCRIPT_DIR/README.md"
echo ""