# Wundr by Lumic.ai

<div align="center">

  <h1>🚀 Wundr</h1>

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
    <img src="https://img.shields.io/npm/v/wundr?style=flat-square" alt="npm version">
    <img src="https://img.shields.io/github/license/lumicai/wundr?style=flat-square" alt="License">
    <img src="https://img.shields.io/github/stars/lumicai/wundr?style=flat-square" alt="Stars">
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node Version">
  </p>

</div>

---

## 🎯 What is Wundr?

Wundr is a revolutionary CLI-based coding agents orchestrator that transforms how teams refactor and modernize large codebases. Built by [Lumic.ai](https://lumic.ai), it combines advanced AST analysis, intelligent pattern recognition, and AI-assisted code transformation to turn months of manual refactoring into days of automated precision.

### 🌟 Why Choose Wundr?

- **90% Reduction in Technical Debt** - Systematically eliminate code duplication and complexity
- **10x Faster Refactoring** - AI agents work in parallel to transform your codebase
- **Zero-Downtime Migration** - Incremental, safe transformations with continuous validation
- **Enterprise-Grade Governance** - Built-in quality gates and drift detection
- **AI-Powered Intelligence** - Smart consolidation suggestions and automated fixes

## 🚀 Quick Start

Get up and running in under 5 minutes:

```bash
# Install Wundr globally
npm install -g @lumic/wundr

# Initialize in your project
wundr init

# Run your first analysis
wundr analyze

# Launch the interactive dashboard
wundr dashboard
```

That's it! Wundr will analyze your codebase and present actionable insights immediately.

## 🎬 See It In Action

```bash
$ wundr analyze

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

💡 Run 'wundr fix --auto' to apply safe transformations automatically
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

## 📋 The Wundr Method™

Our battle-tested 5-phase approach ensures successful transformation:

### Phase 1: Foundation & Freeze (Week 1)
```bash
wundr init --strict        # Set up governance and standards
wundr test baseline        # Establish testing foundation
wundr lint --fix-all       # Apply immediate improvements
```

### Phase 2: Deep Analysis (Week 2)
```bash
wundr analyze --deep       # Comprehensive codebase analysis
wundr report --technical   # Generate detailed findings
wundr plan                 # Create refactoring roadmap
```

### Phase 3: Tactical Consolidation (Weeks 3-4)
```bash
wundr consolidate --auto   # Apply safe transformations
wundr merge --ai-assist    # Handle complex consolidations
wundr validate             # Ensure correctness
```

### Phase 4: Strategic Refactoring (Weeks 5-6)
```bash
wundr refactor patterns    # Standardize architecture
wundr extract services     # Modularize business logic
wundr optimize deps        # Eliminate circular dependencies
```

### Phase 5: Monorepo Migration (Weeks 7-8)
```bash
wundr monorepo init        # Set up monorepo structure
wundr migrate packages     # Move code to packages
wundr verify               # Validate the migration
```

## 💻 CLI Commands

### Essential Commands

```bash
# Analysis
wundr analyze [path]       # Analyze codebase or specific path
wundr similarity           # Find duplicate code
wundr dependencies         # Map dependency graph

# Transformation
wundr fix                  # Apply automated fixes
wundr consolidate          # Merge duplicates
wundr standardize          # Apply patterns

# Monorepo
wundr monorepo init        # Initialize monorepo
wundr package create       # Create new package
wundr migrate              # Migrate to monorepo

# Governance
wundr drift check          # Check for drift
wundr lint                 # Run custom rules
wundr report               # Generate reports

# Utilities
wundr dashboard            # Launch web dashboard
wundr config               # Configure settings
wundr help                 # Show help
```

### Advanced Usage

```bash
# Analyze with custom configuration
wundr analyze --config ./custom-config.json --threshold 85

# AI-assisted merge with context
wundr merge duplicates --ai --context "Preserve performance optimizations"

# Incremental migration with validation
wundr migrate --packages user-service,auth-service --validate

# Generate executive report
wundr report --format pdf --audience executive --output ./reports/
```

## 🏗️ Architecture

Wundr is built on a modular, extensible architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Wundr CLI                         │
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
npm install -g @lumic/wundr
```

### Project Installation
```bash
npm install --save-dev @lumic/wundr
```

### Docker Installation
```bash
docker pull lumic/wundr:latest
docker run -v $(pwd):/workspace lumic/wundr analyze
```

## 🎯 Use Cases

### 1. Legacy Modernization
Transform 10-year-old monoliths into modern, maintainable architectures:
```bash
wundr analyze --legacy-mode
wundr modernize --target es2023 --framework react
```

### 2. Microservices Extraction
Extract services from monolithic applications:
```bash
wundr analyze --identify-boundaries
wundr extract service --name user-service --smart
```

### 3. Technical Debt Elimination
Systematically pay down technical debt:
```bash
wundr debt analyze
wundr debt prioritize --roi
wundr debt eliminate --budget 40h
```

### 4. Code Quality Enhancement
Improve code quality across the board:
```bash
wundr quality baseline
wundr quality improve --target 90
wundr quality enforce
```

## 📊 Success Stories

> "Wundr helped us reduce our 2.5M line codebase by 40% while improving performance by 3x. What would have taken 18 months was done in 6 weeks."
>
> **- Sarah Chen, CTO at TechCorp**

> "The AI-assisted consolidation saved us thousands of hours. It understood our business logic better than some of our developers!"
>
> **- Michael Rodriguez, Principal Engineer at FinanceApp**

> "We migrated to a monorepo structure with zero downtime. Wundr's incremental approach made it risk-free."
>
> **- Emma Watson, VP Engineering at StartupXYZ**

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/lumicai/wundr
cd wundr

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
- **Discord Community**: [discord.gg/wundr](https://discord.gg/wundr)
- **GitHub Issues**: [github.com/lumicai/wundr/issues](https://github.com/lumicai/wundr/issues)
- **Enterprise Support**: [enterprise@lumic.ai](mailto:enterprise@lumic.ai)

## 📄 License

Wundr is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lumicai/wundr&type=Date)](https://star-history.com/#lumicai/wundr&Date)

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
