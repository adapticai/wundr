# Wundr Dynamic CLAUDE.md Generator System

## Overview

The Wundr Dynamic CLAUDE.md Generator System is a comprehensive solution for automatically configuring Claude Code integration in any git repository. It intelligently detects project types, analyzes code quality, and generates tailored CLAUDE.md configurations with optimized agent swarms and MCP tool integration.

## ✨ Key Features

### 🔍 Intelligent Project Detection
- **Automatic Type Detection**: React, Next.js, Node.js, TypeScript, Python, Monorepo, CLI, Full-Stack
- **Structure Analysis**: Identifies directories, file types, frameworks, and build tools
- **Dependency Analysis**: Extracts metadata from package.json and other configuration files

### 📊 Comprehensive Quality Auditing
- **Security Scanning**: Identifies vulnerable dependencies and exposed secrets
- **Quality Standards**: Analyzes linting, type checking, testing, and formatting setup
- **Performance Analysis**: Detects heavy dependencies and optimization opportunities
- **Scoring System**: 100-point quality score with detailed breakdown

### 🤖 Smart Agent Configuration
- **Project-Specific Agents**: Specialized agents based on project type
- **Topology Optimization**: Mesh, hierarchical, or adaptive swarm structures
- **Scaling Logic**: Optimal agent count based on project complexity

### 🔧 MCP Tools Auto-Configuration
- **Intelligent Tool Selection**: Relevant MCP tools for each project type
- **Configuration Templates**: Pre-configured tool settings
- **Integration Automation**: Seamless setup with Claude Desktop

### 📄 Dynamic Template Generation
- **Context-Aware Templates**: CLAUDE.md templates adapted to project specifics
- **Build System Integration**: Automatic command detection and configuration
- **Quality Standards Documentation**: Real-time quality status reporting

## 🚀 Installation & Setup

### Global Installation

```bash
# Clone the repository
git clone https://github.com/adapticai/wundr.git
cd wundr

# Install globally
./scripts/install-claude-generator.sh

# Or for development
./scripts/install-claude-generator.sh --dev
```

### Verify Installation

```bash
wundr --version
wundr help-claude
```

## 📋 CLI Commands

### Core Commands

#### `wundr init`
Quick CLAUDE.md generation for current directory.

```bash
wundr init                    # Quick setup
wundr init --audit           # Run audit first
wundr init --interactive     # Interactive mode
```

#### `wundr claude-init`
Full initialization with comprehensive options.

```bash
wundr claude-init [path]                 # Basic initialization
wundr claude-init --force               # Overwrite existing CLAUDE.md
wundr claude-init --audit               # Include audit
wundr claude-init --interactive         # Interactive customization
wundr claude-init --output-dir ./docs   # Custom output directory
```

#### `wundr claude-audit`
Comprehensive repository quality audit.

```bash
wundr claude-audit [path]               # Basic audit
wundr claude-audit --detailed           # Detailed analysis
wundr claude-audit --json               # JSON output
wundr claude-audit --output report.txt  # Save to file
wundr claude-audit --fix                # Show fix recommendations
```

#### `wundr claude-setup`
Complete setup with all tools and configuration.

```bash
wundr claude-setup [path]               # Full setup
wundr claude-setup --global             # Install tools globally
wundr claude-setup --skip-mcp           # Skip MCP tools
wundr claude-setup --skip-flow          # Skip Claude Flow
wundr claude-setup --template react     # Apply template
```

### Quick Aliases

After installation, these aliases are available:

```bash
wci  # wundr claude-init
wca  # wundr claude-audit
wcs  # wundr claude-setup
```

## 🎯 Project Type Detection

### Supported Project Types

| Type | Detection Criteria | Specialized Agents |
|------|-------------------|-------------------|
| **React** | `react` dependency, components directory | `ui-designer`, `accessibility-tester`, `performance-optimizer` |
| **Next.js** | `next` dependency, pages directory | `ui-designer`, `ssr-specialist`, `seo-analyzer` |
| **Node.js** | `package.json` present, server patterns | `api-designer`, `security-auditor`, `database-architect` |
| **TypeScript** | `tsconfig.json`, TypeScript dependencies | `type-specialist`, `compiler-expert` |
| **Monorepo** | `workspaces`, packages directory, Turbo/Lerna | `package-coordinator`, `build-orchestrator`, `version-manager` |
| **CLI** | `bin` field, CLI patterns | `ux-designer`, `help-writer`, `platform-tester` |
| **Full-Stack** | Client + server directories, mixed dependencies | `api-designer`, `ui-designer`, `integration-tester` |
| **Library** | `main` field, publishable package | `api-designer`, `compatibility-tester`, `documentation-writer` |

### Detection Logic

```typescript
// Example: React project detection
function isReact(packageData: PackageJsonData | null): boolean {
  if (!packageData) return false;
  const deps = { ...packageData.dependencies, ...packageData.devDependencies };
  return !!deps.react || !!deps['@types/react'];
}
```

## 📊 Quality Auditing System

### Quality Categories

#### 🛡️ Security (Weight: 25%)
- **Vulnerable Dependencies**: Known security issues
- **Secret Detection**: Exposed API keys, tokens, passwords
- **Configuration Security**: Missing .gitignore, .env.example

#### 🔍 Quality Standards (Weight: 30%)
- **Linting**: ESLint configuration and rules
- **Type Checking**: TypeScript strict mode and coverage
- **Testing**: Framework setup, coverage thresholds
- **Formatting**: Prettier, code consistency

#### 🏗️ Structure (Weight: 20%)
- **Project Organization**: Source directories, build outputs
- **Configuration Files**: Proper setup and maintenance
- **Documentation**: README, CHANGELOG, API docs

#### 📚 Documentation (Weight: 15%)
- **README Quality**: Comprehensive project description
- **Code Documentation**: Comments, JSDoc, type annotations
- **Change Tracking**: CHANGELOG.md, version history

#### ⚡ Performance (Weight: 10%)
- **Bundle Analysis**: Heavy dependencies identification
- **Build Optimization**: Proper build tool configuration
- **Runtime Optimization**: Performance best practices

### Scoring System

```
Score Ranges:
• 90-100: Excellent - Production ready
• 70-89:  Good - Minor improvements needed  
• 50-69:  Fair - Several issues to address
• 0-49:   Poor - Major improvements required
```

### Sample Audit Output

```bash
📊 Repository Audit Results
============================
Repository: /Users/dev/my-project
Project Type: React Application
Overall Score: 87/100

⚠️ Issues Found (3):
🚨 Critical (0):
⚠️ Warnings (2):
  • TypeScript strict mode not enabled
  • Code coverage below recommended threshold (65% < 80%)
ℹ️ Info (1):
  • Consider adding bundle analyzer for optimization

💡 Recommendations:
1. Enable TypeScript strict mode for better type safety
2. Increase test coverage to meet 80% threshold
3. Set up pre-commit hooks with Husky for automated quality checks
```

## 🤖 Agent Configuration System

### Base Agents (Always Included)
- **coder**: Implementation and development
- **reviewer**: Code review and quality assurance  
- **tester**: Test creation and validation
- **planner**: Project planning and architecture
- **researcher**: Requirements analysis and research

### Specialized Agent Selection

#### Project-Specific Logic
```typescript
const agentMap = {
  'react': ['ui-designer', 'accessibility-tester', 'performance-optimizer'],
  'monorepo': ['package-coordinator', 'build-orchestrator', 'version-manager'],
  'nodejs': ['api-designer', 'security-auditor', 'database-architect'],
  'cli': ['ux-designer', 'help-writer', 'platform-tester']
};
```

#### Topology Selection
- **Mesh**: Best for small to medium projects (< 8 agents)
- **Hierarchical**: Optimal for monorepos and complex projects  
- **Adaptive**: Dynamic topology based on task complexity

### Agent Scaling
```
Project Complexity → Agent Count
• Simple (1-5 files): 4-6 agents
• Medium (5-50 files): 6-10 agents
• Large (50+ files): 10-15 agents
• Monorepo: 12-20 agents
```

## 🔧 MCP Tools Integration

### Common Tools (All Projects)

#### drift_detection
```json
{
  "name": "drift_detection",
  "description": "Monitor code quality drift and detect regressions",
  "config": {
    "enabled": true,
    "checkInterval": "1d",
    "thresholds": {
      "complexity": 10,
      "duplication": 5
    }
  }
}
```

#### pattern_standardize
```json
{
  "name": "pattern_standardize", 
  "description": "Automatically standardize code patterns",
  "config": {
    "enabled": true,
    "patterns": ["error-handling", "import-ordering", "naming-conventions"]
  }
}
```

#### dependency_analyze
```json
{
  "name": "dependency_analyze",
  "description": "Analyze and optimize project dependencies",
  "config": {
    "enabled": true,
    "checkCircular": true,
    "findUnused": true,
    "securityScan": true
  }
}
```

#### test_baseline
```json
{
  "name": "test_baseline",
  "description": "Manage test coverage baselines",
  "config": {
    "enabled": true,
    "coverageThreshold": 80,
    "trackRegression": true
  }
}
```

### Project-Specific Tools

#### Monorepo Projects
- **monorepo_manage**: Package coordination and build optimization

#### React/Frontend Projects  
- **ui_analyzer**: Component accessibility and performance analysis

#### CLI Projects
- **cli_tester**: Cross-platform command testing

## 📄 Generated CLAUDE.md Structure

### Template Sections

1. **Project Header**: Name, type, description, metadata
2. **Verification Protocol**: Testing and validation requirements
3. **Concurrent Execution**: Parallel operation guidelines
4. **Project Overview**: Context-specific project description
5. **Available Commands**: Auto-detected build, test, lint commands
6. **Development Workflow**: SPARC methodology with project adaptations
7. **Code Style**: Quality standards and tooling configuration
8. **Agent Configuration**: Optimized agent swarm setup
9. **MCP Tools**: Relevant tools with configuration
10. **Build System**: Detected build tools and commands
11. **Quality Standards**: Current quality status and requirements
12. **Integration Tips**: Project-specific best practices

### Dynamic Content Examples

#### React Project CLAUDE.md
```markdown
## Project Overview
This is a React Application built with React, using Vite for build processes.

**Frontend Application**:
- Component-based architecture
- Modern React patterns and hooks
- Responsive design principles

## 🤖 Agent Configuration
### Specialized Agents for React Application
`ui-designer`, `accessibility-tester`, `performance-optimizer`

### Frontend-Specific Agents
- `ui-designer`: Component design and styling
- `accessibility-tester`: A11y compliance
- `performance-optimizer`: Bundle analysis and optimization
```

#### Monorepo Project CLAUDE.md
```markdown
## Project Overview  
This is a Monorepo built with TypeScript, using Turbo for build processes.

**Monorepo Structure**:
- Multiple packages managed together
- Workspace-based dependency management
- Shared tooling and configurations

## 🤖 Agent Configuration
### Specialized Agents for Monorepo
`package-coordinator`, `build-orchestrator`, `version-manager`

### Monorepo-Specific Agents
- `package-coordinator`: Cross-package dependency management
- `build-orchestrator`: Optimized build ordering  
- `version-manager`: Semantic versioning coordination
```

## 🔄 Workflow Examples

### New Project Setup
```bash
# Navigate to new project
cd my-new-project

# Initialize git if needed
git init

# Quick setup
wundr init

# Or comprehensive setup
wundr claude-setup --interactive
```

### Existing Project Integration
```bash
# Audit first
wundr claude-audit --detailed --output audit-report.txt

# Review recommendations
cat audit-report.txt

# Generate configuration
wundr claude-init --interactive --audit
```

### Monorepo Setup
```bash
# Full monorepo setup with template
wundr claude-setup --template=monorepo

# Specialized audit
wundr claude-audit --json > monorepo-audit.json
```

### CI/CD Integration
```bash
# Add to CI pipeline
name: Claude Code Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @adapticai/wundr
      - run: wundr claude-audit --json > audit-results.json
      - run: wundr claude-init --force
```

## 🧪 Testing & Validation

### Unit Tests
```bash
# Run generator tests
npm test src/tests/claude-generator.test.ts

# Run CLI tests  
npm test src/tests/cli-commands.test.ts

# Full test suite
npm test
```

### Integration Testing
```bash
# Test on sample projects
mkdir test-projects && cd test-projects

# React project
npx create-react-app test-react
cd test-react && wundr claude-audit

# Node.js project
mkdir test-node && cd test-node
npm init -y && wundr claude-init
```

## 🔧 Configuration & Customization

### Global Configuration
Location: `~/.wundr/config.json`

```json
{
  "preferences": {
    "defaultTemplate": "typescript",
    "enableAuditByDefault": true,
    "verboseOutput": false,
    "autoUpdateClaudeConfig": true
  },
  "integrations": {
    "claudeFlow": {
      "enabled": true,
      "autoInstall": true
    },
    "mcpTools": {
      "enabled": true,
      "autoSetup": true
    }
  }
}
```

### Project Templates
Location: `~/.wundr/templates/`

Custom templates can be added for specific project types or organization standards.

### Quality Thresholds
```typescript
// Customize in quality-analyzer.ts
const QUALITY_THRESHOLDS = {
  coverage: 80,
  complexity: 10,
  duplication: 5,
  security: 'strict'
};
```

## 📈 Performance & Metrics

### Benchmarks
- **Project Detection**: < 100ms for typical projects
- **Quality Analysis**: < 500ms for most codebases  
- **CLAUDE.md Generation**: < 200ms
- **Full Setup**: < 2 minutes including Claude Flow

### Memory Usage
- **Base System**: ~50MB RAM
- **Large Monorepo**: ~200MB RAM during analysis
- **Concurrent Operations**: Optimized for parallel execution

## 🤝 Contributing

### Development Setup
```bash
git clone https://github.com/adapticai/wundr.git
cd wundr
npm install
npm run build

# Install in dev mode
./scripts/install-claude-generator.sh --dev

# Run tests
npm test
```

### Adding New Project Types
1. Update `ProjectDetector.ts` with detection logic
2. Add specialized agents in `claude-config-generator.ts`
3. Create MCP tool configurations
4. Add template sections in `TemplateEngine.ts`
5. Write tests in `claude-generator.test.ts`

### Adding New Quality Checks
1. Extend `QualityAnalyzer.ts` with new analysis
2. Update `RepositoryAuditor.ts` for scoring
3. Add recommendations in audit logic
4. Update documentation

## 📞 Support & Resources

- **Documentation**: This file and inline code comments
- **Issues**: GitHub Issues for bug reports and feature requests
- **Examples**: `./examples/` directory with sample configurations
- **Templates**: `./templates/` for project-specific setups

## 🗺️ Roadmap

### Planned Features
- [ ] Python project type support with Poetry/pip detection
- [ ] Rust project integration with Cargo
- [ ] Docker/Kubernetes configuration detection
- [ ] Custom quality rule definitions
- [ ] Team-specific agent configurations
- [ ] Integration with more MCP tools
- [ ] Web UI for configuration management
- [ ] VS Code extension for inline configuration

### Version History
- **v1.0.0**: Initial release with core functionality
- **v1.1.0**: Enhanced project detection and quality analysis
- **v1.2.0**: MCP tools auto-configuration
- **v2.0.0**: Planned - Advanced customization and web UI

---

**The Wundr Dynamic CLAUDE.md Generator System transforms any repository into a Claude Code optimized workspace with intelligent analysis and configuration.**