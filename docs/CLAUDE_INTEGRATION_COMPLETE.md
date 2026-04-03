# Claude and Ruflo Complete Integration Guide

## ✅ Integration Complete!

All Claude and Ruflo components have been successfully integrated into the Wundr computer-setup
scripts and CLI flow.

## 📦 What's Been Integrated

### 1. **Computer Setup Integration**

- **Location**: `/packages/@wundr/computer-setup/src/installers/claude-installer.ts`
- **Features**:
  - Automatic Claude CLI installation
  - Chrome browser installation for Browser MCP
  - All 54 specialized agents configuration
  - 5 MCP tools setup (Firecrawl, Context7, Playwright, Browser, Sequential Thinking)
  - Quality enforcement hooks
  - Global CLAUDE.md generator

### 2. **CLI Commands**

#### **`wundr setup`** - Main Setup Flow

- Includes Claude installer in all profiles (frontend, backend, fullstack, devops)
- Automatically installs Claude ecosystem as part of computer provisioning
- Example: `wundr setup --profile fullstack`

#### **`wundr claude-setup`** - Dedicated Claude Setup

- Complete Claude ecosystem installation
- MCP tools management
- Agent configuration
- Validation and troubleshooting
- Examples:
  ```bash
  wundr claude-setup           # Complete installation
  wundr claude-setup mcp       # Install all MCP tools
  wundr claude-setup agents    # Configure agents
  wundr claude-setup validate  # Validate installation
  ```

#### **`wundr claude-init`** - Project Initialization

- Initialize Claude in any git repository
- Dynamic CLAUDE.md generation
- Project analysis and audit
- Automatic agent selection
- Example: `wundr claude-init --interactive`

### 3. **MCP Tools Installation Script**

- **Location**: `/scripts/install-mcp-tools.sh`
- **Features**:
  - Automated installation of all 5 MCP tools
  - Chrome installation and configuration
  - Browser MCP Chrome extension setup
  - Validation script included

### 4. **Profile Integration**

All developer profiles now include Claude and Ruflo:

- **Frontend**: Claude + mobile-dev agent
- **Backend**: Claude + backend-dev, system-architect agents
- **Fullstack**: Claude + all core agents
- **DevOps**: Claude + cicd-engineer, perf-analyzer agents

## 🚀 Usage Workflows

### Complete Computer Setup (New Machine)

```bash
# Option 1: Interactive setup
wundr setup

# Option 2: Direct profile setup
wundr setup --profile fullstack

# Option 3: Computer setup command
wundr computer-setup --profile backend
```

### Standalone Claude Setup

```bash
# Complete Claude installation
wundr claude-setup

# Install specific MCP tool
wundr claude-setup mcp --tool firecrawl

# Configure agents for profile
wundr claude-setup agents --profile frontend
```

### Initialize Project with Claude

```bash
cd your-project
wundr claude-init --interactive
```

### Direct MCP Tools Installation

```bash
./scripts/install-mcp-tools.sh
```

## 🔧 Configuration Files Created

### System-Wide

- `~/.claude/settings.json` - Main Claude configuration
- `~/.claude/agents/*.json` - 54 agent configurations
- `~/.claude/browser-extension/` - Chrome extension files
- `~/.claude/.ruflo/config.json` - Ruflo settings
- `~/.claude/.env.*` - MCP tool API configurations

### Project-Specific

- `CLAUDE.md` - Project-specific Claude configuration
- `.ruflo/config.json` - Project Ruflo settings
- `.claude/agents/` - Project-specific agents
- `.claude/hooks/` - Quality enforcement hooks

## 📊 Quality Enforcement

### Automatic Hooks

- **Pre-tool use**: Validation and resource preparation
- **Post-edit**: Auto-formatting with Prettier
- **Pre-commit**: Type checking, linting, test execution
- **Session management**: Metrics export and state persistence

### Standards Enforced

- TypeScript type checking (`npm run typecheck`)
- ESLint code quality (`npm run lint`)
- Test execution (`npm test`)
- Build verification (`npm run build`)
- Code formatting (Prettier)

## 🤖 54 Specialized Agents

### Categories

1. **Core Development** (5): coder, reviewer, tester, planner, researcher
2. **Swarm Coordination** (5): hierarchical, mesh, adaptive coordinators
3. **Consensus & Distributed** (7): Byzantine, Raft, gossip protocols
4. **Performance** (5): analyzers, benchmarkers, orchestrators
5. **GitHub Integration** (13): PR, issue, release management
6. **SPARC Methodology** (6): specification through completion
7. **Specialized Development** (10): backend, mobile, ML developers
8. **Testing & Validation** (3): TDD, production validation

## 🔌 MCP Tools Integration

### Installed Tools

1. **Firecrawl**: Web scraping and crawling
2. **Context7**: Context management with vector search
3. **Playwright**: Browser automation and E2E testing
4. **Browser MCP**: Real Chrome browser control
5. **Sequential Thinking**: MIT's structured reasoning

### Chrome Extension

- Auto-generated during setup
- Located at `~/.claude/browser-extension/`
- Manual installation required in Chrome

## ✨ Advanced Features

### Ruflo Orchestration

- SPARC methodology integration
- Swarm coordination with multiple topologies
- Neural training and pattern learning
- Cross-session memory persistence
- Performance metrics tracking

### Project Detection

- Automatic project type identification
- Framework-specific agent selection
- Build tool detection
- Quality standard discovery

### Team Configuration

- Shared team profiles
- Standardized tool sets
- Consistent environment setup
- Onboarding automation

## 📋 Validation & Troubleshooting

### Validate Installation

```bash
wundr claude-setup validate
```

### Auto-Fix Issues

```bash
wundr claude-setup validate --fix
```

### Check Specific Components

```bash
# Check Claude CLI
claude --version

# Check Ruflo
npx ruflo@latest --version

# Check MCP servers
~/.claude/validate-mcp.sh
```

## 🎯 Next Steps After Installation

1. **Configure API Keys** (if needed):

   ```bash
   vim ~/.claude/.env.firecrawl
   vim ~/.claude/.env.context7
   ```

2. **Install Chrome Extension**:
   - Open Chrome → chrome://extensions
   - Enable Developer Mode
   - Load unpacked → `~/.claude/browser-extension/`

3. **Initialize Your First Project**:

   ```bash
   cd your-project
   wundr claude-init
   ```

4. **Start Using Ruflo**:
   ```bash
   npx ruflo@latest sparc tdd "your feature"
   ```

## 📚 Documentation References

- Ruflo: https://github.com/ruvnet/ruflo
- MCP Protocol: https://modelcontextprotocol.io
- Wundr CLI: `/packages/@wundr/cli/README.md`
- Computer Setup: `/packages/@wundr/computer-setup/README.md`

## 🔄 Updates & Maintenance

### Update Ruflo

```bash
npm update -g ruflo@latest
```

### Update MCP Tools

```bash
wundr claude-setup mcp
```

### Regenerate Agents

```bash
wundr claude-setup agents --profile fullstack
```

## ✅ Complete Integration Checklist

- [x] Claude installer in computer-setup package
- [x] Integration with RealSetupOrchestrator
- [x] All profiles include Claude
- [x] CLI command: `wundr setup`
- [x] CLI command: `wundr claude-setup`
- [x] CLI command: `wundr claude-init`
- [x] MCP tools installation script
- [x] Chrome browser installation
- [x] Browser MCP extension generation
- [x] 54 agents configuration
- [x] Quality enforcement hooks
- [x] Dynamic CLAUDE.md generator
- [x] Project type detection
- [x] Validation commands
- [x] TypeScript types and build

---

**Integration Status**: ✅ **COMPLETE**

All scripts and commands are fully integrated into the main computer-setup flow and CLI commands.
Claude and Ruflo will be automatically installed and configured when running any of the setup
commands.
