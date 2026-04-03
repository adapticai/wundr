#!/bin/bash
# Setup MCP server for Ruflo

echo "🚀 Setting up Ruflo MCP server..."

# Check if claude command exists
if ! command -v claude &> /dev/null; then
    echo "❌ Error: Claude Code CLI not found"
    echo "Please install Claude Code first"
    exit 1
fi

# Add MCP server
echo "📦 Adding Ruflo MCP server..."
claude mcp add ruflo npx ruflo@latest mcp start

echo "✅ MCP server setup complete!"
echo "🎯 You can now use mcp__ruflo__ tools in Claude Code"
