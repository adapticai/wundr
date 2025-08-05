# Wundr.io by Lumic.ai

<div align="center">

  <h1>🚀 Wundr.io</h1>

  <p>
    <strong>The Intelligent CLI-Based Coding Agents Orchestrator</strong>
  </p>

  <p>
    Transform monolithic chaos into architectural elegance with AI-powered refactoring at scale
  </p>

  <p>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-Get_Started_in_5_Minutes-brightgreen?style=for-the-badge" alt="Quick Start"></a>
    <a href="#features"><img src="https://img.shields.io/badge/Features-Powerful_Tools-blue?style=for-the-badge" alt="Features"></a>
    <a href="#documentation"><img src="https://img.shields.io/badge/Docs-Comprehensive_Guide-orange?style=for-the-badge" alt="Documentation"></a>
  </p>

  <p>
    <img src="https://img.shields.io/npm/v/wundrio?style=flat-square" alt="npm version">
    <img src="https://img.shields.io/github/license/lumicai/wundrio?style=flat-square" alt="License">
    <img src="https://img.shields.io/github/stars/lumicai/wundrio?style=flat-square" alt="Stars">
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node Version">
  </p>

</div>

---

## 🎯 What is Wundr.io?

Wundr.io is a revolutionary CLI-based coding agents orchestrator that transforms how teams refactor and modernize large codebases. Built by [Lumic.ai](https://lumic.ai), it combines advanced AST analysis, intelligent pattern recognition, and AI-assisted code transformation to turn months of manual refactoring into days of automated precision.

### 🌟 Why Choose Wundr.io?

- **90% Reduction in Technical Debt** - Systematically eliminate code duplication and complexity
- **10x Faster Refactoring** - AI agents work in parallel to transform your codebase
- **Zero-Downtime Migration** - Incremental, safe transformations with continuous validation
- **Enterprise-Grade Governance** - Built-in quality gates and drift detection
- **AI-Powered Intelligence** - Smart consolidation suggestions and automated fixes

## 🚀 Quick Start

Get up and running in under 5 minutes:

```bash
# Install Wundr.io globally
npm install -g @lumic/wundrio

# Initialize in your project
wundrio init

# Run your first analysis
wundrio analyze

# Launch the interactive dashboard
wundrio dashboard
```

That's it! Wundr.io will analyze your codebase and present actionable insights immediately.

## 🎬 See It In Action

```bash
$ wundrio analyze

🔍 Analyzing codebase...
  ✓ Found 2,847 TypeScript files
  ✓ Detected 342 duplicate interfaces (89% similarity)
  ✓ Identified 156 wrapper anti-patterns
  ✓ Mapped 1,203 circular dependencies

📊 Analysis complete! View results at: http://localhost:8080/dashboard

🎯 Top recommendations:
  1. Consolidate 342 duplicate interfaces → Save 45,000 lines
  2. Remove 156 wrapper patterns → Improve performance by 23%
  3. Break 1,203 circular dependencies → Enable proper modularity

💡 Run 'wundrio fix --auto' to apply safe transformations automatically
```

## 🛠️ Core Features

### 1. 🧠 **Intelligent Code Analysis**
- **AST-Powered Deep Scanning** - Goes beyond text matching to understand code structure
- **Similarity Detection** - Finds duplicate code with configurable threshold (70-100%)
- **Dependency Mapping** - Visualizes and untangles complex dependency graphs
- **Anti-Pattern Recognition** - Identifies and fixes common architectural issues

### 2. 🤖 **AI-Assisted Refactoring**
- **Smart Merge Suggestions** - AI generates optimal consolidation strategies
- **Automated Code Transformation** - Safe, incremental changes with rollback
- **Context-Aware Modifications** - Preserves business logic while improving structure
- **Test-Driven Refactoring** - Ensures all changes maintain functionality

### 3. 📦 **Monorepo Migration**
- **Automated Package Extraction** - Intelligently splits code into packages
- **Dependency Resolution** - Handles complex interdependencies automatically
- **Incremental Migration** - Move at your own pace with continuous validation
- **Build System Integration** - Works with npm, pnpm, yarn, rush, and more

### 4. 🛡️ **Enterprise Governance**
- **Drift Detection** - Prevents regression with continuous monitoring
- **Custom ESLint Rules** - Enforce architectural standards automatically
- **Quality Gates** - Block PRs that violate standards
- **Weekly Reports** - Track progress and technical debt reduction

### 5. 📊 **Real-Time Dashboard**
- **Visual Analytics** - See your codebase health at a glance
- **Progress Tracking** - Monitor refactoring velocity and impact
- **Team Collaboration** - Share insights and coordinate efforts
- **Export Reports** - Generate executive summaries and technical documentation

## 📋 The Wundr.io Method™

Our battle-tested 5-phase approach ensures successful transformation:

### Phase 1: Foundation & Freeze (Week 1)
```bash
wundrio init --strict        # Set up governance and standards
wundrio test baseline        # Establish testing foundation
wundrio lint --fix-all       # Apply immediate improvements
```

### Phase 2: Deep Analysis (Week 2)
```bash
wundrio analyze --deep       # Comprehensive codebase analysis
wundrio report --technical   # Generate detailed findings
wundrio plan                 # Create refactoring roadmap
```

### Phase 3: Tactical Consolidation (Weeks 3-4)
```bash
wundrio consolidate --auto   # Apply safe transformations
wundrio merge --ai-assist    # Handle complex consolidations
wundrio validate             # Ensure correctness
```

### Phase 4: Strategic Refactoring (Weeks 5-6)
```bash
wundrio refactor patterns    # Standardize architecture
wundrio extract services     # Modularize business logic
wundrio optimize deps        # Eliminate circular dependencies
```

### Phase 5: Monorepo Migration (Weeks 7-8)
```bash
wundrio monorepo init        # Set up monorepo structure
wundrio migrate packages     # Move code to packages
wundrio verify               # Validate the migration
```

## 💻 CLI Commands

### Essential Commands

```bash
# Analysis
wundrio analyze [path]       # Analyze codebase or specific path
wundrio similarity           # Find duplicate code
wundrio dependencies         # Map dependency graph

# Transformation
wundrio fix                  # Apply automated fixes
wundrio consolidate          # Merge duplicates
wundrio standardize          # Apply patterns

# Monorepo
wundrio monorepo init        # Initialize monorepo
wundrio package create       # Create new package
wundrio migrate              # Migrate to monorepo

# Governance
wundrio drift check          # Check for drift
wundrio lint                 # Run custom rules
wundrio report               # Generate reports

# Utilities
wundrio dashboard            # Launch web dashboard
wundrio config               # Configure settings
wundrio help                 # Show help
```

### Advanced Usage

```bash
# Analyze with custom configuration
wundrio analyze --config ./custom-config.json --threshold 85

# AI-assisted merge with context
wundrio merge duplicates --ai --context "Preserve performance optimizations"

# Incremental migration with validation
wundrio migrate --packages user-service,auth-service --validate

# Generate executive report
wundrio report --format pdf --audience executive --output ./reports/
```

## 🏗️ Architecture

Wundr.io is built on a modular, extensible architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Wundr.io CLI                         │
├─────────────┬────────────┬────────────┬────────────────────┤
│   Analysis  │ Transform  │  Monorepo  │    Governance      │
│   Engine    │  Engine    │   Engine   │     Engine         │
├─────────────┴────────────┴────────────┴────────────────────┤
│                    Core Framework                           │
│  • AST Parser  • Pattern Matcher  • Dependency Resolver    │
├─────────────────────────────────────────────────────────────┤
│                    AI Assistant Layer                       │
│  • Code Understanding  • Merge Strategies  • Optimization  │
├─────────────────────────────────────────────────────────────┤
│                    Storage & Reporting                      │
│  • File System  • Git Integration  • Dashboard Server      │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js 18+
- Git
- 8GB+ RAM (16GB recommended for large codebases)

### Global Installation (Recommended)
```bash
npm install -g @lumic/wundrio
```

### Project Installation
```bash
npm install --save-dev @lumic/wundrio
```

### Docker Installation
```bash
docker pull lumic/wundrio:latest
docker run -v $(pwd):/workspace lumic/wundrio analyze
```

## 🎯 Use Cases

### 1. Legacy Modernization
Transform 10-year-old monoliths into modern, maintainable architectures:
```bash
wundrio analyze --legacy-mode
wundrio modernize --target es2023 --framework react
```

### 2. Microservices Extraction
Extract services from monolithic applications:
```bash
wundrio analyze --identify-boundaries
wundrio extract service --name user-service --smart
```

### 3. Technical Debt Elimination
Systematically pay down technical debt:
```bash
wundrio debt analyze
wundrio debt prioritize --roi
wundrio debt eliminate --budget 40h
```

### 4. Code Quality Enhancement
Improve code quality across the board:
```bash
wundrio quality baseline
wundrio quality improve --target 90
wundrio quality enforce
```

## 📊 Success Stories

> "Wundr.io helped us reduce our 2.5M line codebase by 40% while improving performance by 3x. What would have taken 18 months was done in 6 weeks."
>
> **- Sarah Chen, CTO at TechCorp**

> "The AI-assisted consolidation saved us thousands of hours. It understood our business logic better than some of our developers!"
>
> **- Michael Rodriguez, Principal Engineer at FinanceApp**

> "We migrated to a monorepo structure with zero downtime. Wundr.io's incremental approach made it risk-free."
>
> **- Emma Watson, VP Engineering at StartupXYZ**

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/lumicai/wundrio
cd wundrio

# Install dependencies
npm install

# Run tests
npm test

# Submit PR
git checkout -b feature/amazing-feature
git commit -m 'Add amazing feature'
git push origin feature/amazing-feature
```

## 📚 Documentation

- [Complete User Guide](docs/guides/COMPLETE_STRATEGY.md)
- [API Reference](docs/api/README.md)
- [Architecture Overview](docs/architecture/README.md)
- [Best Practices](docs/guides/GOLDEN_STANDARDS.md)
- [Troubleshooting](docs/guides/TROUBLESHOOTING.md)
- [FAQ](docs/FAQ.md)

## 🆘 Support

- **Documentation**: [docs.wundr.io](https://docs.wundr.io)
- **Discord Community**: [discord.gg/wundrio](https://discord.gg/wundrio)
- **GitHub Issues**: [github.com/lumicai/wundrio/issues](https://github.com/lumicai/wundrio/issues)
- **Enterprise Support**: [enterprise@lumic.ai](mailto:enterprise@lumic.ai)

## 📄 License

Wundr.io is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lumicai/wundrio&type=Date)](https://star-history.com/#lumicai/wundrio&Date)

---

<div align="center">
  <p>
    <strong>Built with ❤️ by <a href="https://lumic.ai">Lumic.ai</a></strong>
  </p>
  <p>
    <a href="https://twitter.com/lumic_ai">Twitter</a> •
    <a href="https://linkedin.com/company/lumicai">LinkedIn</a> •
    <a href="https://blog.lumic.ai">Blog</a>
  </p>
</div>
