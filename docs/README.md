# Wundr Documentation

> Comprehensive documentation for the @wundr.io package ecosystem

---

## 📚 Documentation Index

### 🎯 Start Here

**New to Wundr?**

1. Read [PACKAGE_CROSS_REFERENCE_SUMMARY.md](./PACKAGE_CROSS_REFERENCE_SUMMARY.md) - Quick overview
2. Explore [PACKAGE_INTEGRATION_GUIDE.md](./PACKAGE_INTEGRATION_GUIDE.md) - Code examples
3. Check [PACKAGE_CROSS_REFERENCE.md](./PACKAGE_CROSS_REFERENCE.md) - Complete reference

**Building something specific?**

- [PACKAGE_CROSS_REFERENCE.md](./PACKAGE_CROSS_REFERENCE.md) → Package Selection Guide
- [PACKAGE_INTEGRATION_GUIDE.md](./PACKAGE_INTEGRATION_GUIDE.md) → Integration Scenarios

**Understanding the architecture?**

- [PACKAGE_ARCHITECTURE_OVERVIEW.md](./PACKAGE_ARCHITECTURE_OVERVIEW.md) - Complete architecture
- [PACKAGE_DEPENDENCY_GRAPH.md](./PACKAGE_DEPENDENCY_GRAPH.md) - Visual dependencies

---

## 📖 Core Documentation

### 1. Package Architecture Overview

**File:** [PACKAGE_ARCHITECTURE_OVERVIEW.md](./PACKAGE_ARCHITECTURE_OVERVIEW.md) **Size:** 826 lines
| 18KB **Purpose:** Complete architectural documentation

**Contents:**

- Architecture principles
- Package ecosystem map
- Key architecture decisions
- Technology stack
- Integration strategies
- Performance characteristics
- Security considerations
- Scalability & growth

**Read this when:** You need to understand the overall system architecture

---

### 2. Package Cross-Reference

**File:** [PACKAGE_CROSS_REFERENCE.md](./PACKAGE_CROSS_REFERENCE.md) **Size:** 1,019 lines | 32KB
**Purpose:** Comprehensive package mapping and workflows

**Contents:**

- Package overview (all 15 packages)
- Package architecture tiers
- Dependency graph (Mermaid)
- Package relationship matrix
- 7 integration patterns
- 6 common workflows
- Package selection guide
- Architecture diagrams
- Quick reference
- Version compatibility matrix
- Migration guides

**Read this when:** You need detailed package information and workflows

---

### 3. Package Dependency Graph

**File:** [PACKAGE_DEPENDENCY_GRAPH.md](./PACKAGE_DEPENDENCY_GRAPH.md) **Size:** 610 lines | 21KB
**Purpose:** Visual dependency analysis

**Contents:**

- Complete dependency graph (ASCII)
- Simplified dependency tree
- Dependency depth analysis
- 5 package relationship clusters
- Dependency weight analysis
- Circular dependency check
- Peer dependency requirements
- Transitive dependency graph
- Build order (topological sort)
- Package size comparison
- Recommended installation patterns
- Dependency update strategy

**Read this when:** You need to understand package dependencies and build order

---

### 4. Package Integration Guide

**File:** [PACKAGE_INTEGRATION_GUIDE.md](./PACKAGE_INTEGRATION_GUIDE.md) **Size:** 1,129 lines |
22KB **Purpose:** Practical integration examples and patterns

**Contents:**

- Getting started
- 7 common integration scenarios
- 6 code examples by use case
- 3 integration patterns
- 4 troubleshooting solutions
- 4 best practices

**Scenarios covered:**

1. Adding Wundr to existing Node.js project
2. Building custom CLI tool
3. Integrating code analysis
4. Setting up developer machines
5. Building custom plugins
6. Lightweight scripts with simple packages
7. React applications with shared components

**Read this when:** You need code examples and integration patterns

---

### 5. Package Cross-Reference Summary

**File:** [PACKAGE_CROSS_REFERENCE_SUMMARY.md](./PACKAGE_CROSS_REFERENCE_SUMMARY.md) **Size:** 411
lines | 11KB **Purpose:** Quick overview and navigation

**Contents:**

- Documentation overview
- Quick navigation guide
- Package categories at a glance
- Quick start by use case
- Dependency quick reference
- Key architecture diagrams
- Common integration patterns
- Package selection decision tree
- Common workflows
- Troubleshooting quick reference
- Best practices
- Next steps
- Full documentation index

**Read this when:** You need a quick overview or navigation guide

---

## 🗂️ Package Documentation Structure

Each package includes its own documentation:

```
packages/@wundr/[package-name]/
├── README.md           # Package overview and usage
├── CHANGELOG.md        # Version history
├── API.md             # Detailed API documentation (if applicable)
└── examples/          # Code examples (if applicable)
```

---

## 📊 Documentation Statistics

```
Total Documentation Files: 5 core files
Total Lines: 4,198 lines
Total Size: ~104KB
Format: Markdown
```

**Breakdown:**

- PACKAGE_ARCHITECTURE_OVERVIEW.md: 826 lines (20%)
- PACKAGE_CROSS_REFERENCE.md: 1,019 lines (24%)
- PACKAGE_DEPENDENCY_GRAPH.md: 610 lines (15%)
- PACKAGE_INTEGRATION_GUIDE.md: 1,129 lines (27%)
- PACKAGE_CROSS_REFERENCE_SUMMARY.md: 411 lines (10%)

---

## 🎯 Quick Start Guides

### Use Case 1: I want to build a CLI tool

```bash
# Install packages
npm install @wundr.io/core @wundr.io/config commander

# Read documentation
1. PACKAGE_INTEGRATION_GUIDE.md → Scenario 2
2. PACKAGE_CROSS_REFERENCE.md → Pattern 3
```

---

### Use Case 2: I want to analyze code

```bash
# Install package
npm install @wundr.io/analysis-engine

# Read documentation
1. PACKAGE_INTEGRATION_GUIDE.md → Scenario 3
2. PACKAGE_CROSS_REFERENCE.md → Workflow 1
```

---

### Use Case 3: I want to understand the architecture

```
# Read documentation
1. PACKAGE_ARCHITECTURE_OVERVIEW.md → Full overview
2. PACKAGE_DEPENDENCY_GRAPH.md → Visual graphs
3. PACKAGE_CROSS_REFERENCE.md → Package tiers
```

---

### Use Case 4: I want to setup developer machines

```bash
# Install packages
npm install @wundr.io/computer-setup @wundr.io/core @wundr.io/config

# Read documentation
1. PACKAGE_INTEGRATION_GUIDE.md → Scenario 4
2. PACKAGE_CROSS_REFERENCE.md → Workflow 2
```

---

### Use Case 5: I need integration examples

```
# Read documentation
1. PACKAGE_INTEGRATION_GUIDE.md → All scenarios
2. PACKAGE_CROSS_REFERENCE.md → Integration patterns
3. Package-specific README.md
```

---

## 🔍 Finding What You Need

### By Topic

| Topic                   | Document                         | Section                     |
| ----------------------- | -------------------------------- | --------------------------- |
| Architecture principles | PACKAGE_ARCHITECTURE_OVERVIEW.md | Architecture Principles     |
| Package list            | PACKAGE_CROSS_REFERENCE.md       | Package Overview            |
| Dependencies            | PACKAGE_DEPENDENCY_GRAPH.md      | Complete Dependency Graph   |
| Code examples           | PACKAGE_INTEGRATION_GUIDE.md     | Code Examples by Use Case   |
| Integration patterns    | PACKAGE_CROSS_REFERENCE.md       | Integration Patterns        |
| Workflows               | PACKAGE_CROSS_REFERENCE.md       | Common Workflows            |
| Troubleshooting         | PACKAGE_INTEGRATION_GUIDE.md     | Troubleshooting             |
| Best practices          | PACKAGE_INTEGRATION_GUIDE.md     | Best Practices              |
| Selection guide         | PACKAGE_CROSS_REFERENCE.md       | Package Selection Guide     |
| Performance             | PACKAGE_ARCHITECTURE_OVERVIEW.md | Performance Characteristics |

---

### By Package

| Package                   | Primary Documentation                     | Additional Resources         |
| ------------------------- | ----------------------------------------- | ---------------------------- |
| @wundr.io/core            | packages/@wundr/core/README.md            | PACKAGE_INTEGRATION_GUIDE.md |
| @wundr.io/config          | packages/@wundr/config/README.md          | PACKAGE_INTEGRATION_GUIDE.md |
| @wundr.io/cli             | packages/@wundr/cli/README.md             | PACKAGE_CROSS_REFERENCE.md   |
| @wundr.io/analysis-engine | packages/@wundr/analysis-engine/README.md | PACKAGE_INTEGRATION_GUIDE.md |
| @wundr.io/computer-setup  | packages/@wundr/computer-setup/README.md  | PACKAGE_INTEGRATION_GUIDE.md |

---

## 📝 Documentation Standards

All documentation follows these standards:

1. **Markdown format** - Easy to read, version control friendly
2. **Clear structure** - Table of contents, sections, subsections
3. **Code examples** - Practical, runnable examples
4. **Visual aids** - Diagrams, graphs, tables
5. **Cross-references** - Links between documents
6. **Version info** - Last updated dates, version numbers
7. **Searchable** - Clear headings, keywords

---

## 🔄 Documentation Updates

### Update Frequency

- **Core docs:** Updated with major releases
- **Package docs:** Updated with each package release
- **Examples:** Added as needed
- **Troubleshooting:** Updated based on issues

### How to Contribute

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Make changes to documentation
3. Ensure examples are tested
4. Submit pull request
5. Address review feedback

---

## 🛠️ Documentation Tools

### Viewing Documentation

```bash
# View in terminal
cat docs/PACKAGE_CROSS_REFERENCE.md

# View in browser (with grip)
grip docs/PACKAGE_CROSS_REFERENCE.md

# View on GitHub
# Navigate to docs folder in repository
```

---

### Generating Documentation

```bash
# Generate API docs (if TypeDoc is configured)
npm run docs:generate

# Build all packages (includes type definitions)
npm run build
```

---

## 📞 Getting Help

### Documentation Issues

If documentation is unclear, incomplete, or incorrect:

1. **Check existing docs** - Search all files
2. **Open an issue** - https://github.com/adapticai/wundr/issues
3. **Submit a PR** - Fix it yourself!
4. **Ask in discussions** - Community help

### Code Issues

For code-related issues:

1. **Check package README** - Package-specific docs
2. **Review examples** - Working code samples
3. **Check issues** - Existing solutions
4. **Open new issue** - Detailed description

---

## 🎓 Learning Path

### Beginner

1. Read PACKAGE_CROSS_REFERENCE_SUMMARY.md
2. Follow PACKAGE_INTEGRATION_GUIDE.md → Scenario 1
3. Try examples in package READMEs
4. Explore PACKAGE_CROSS_REFERENCE.md

### Intermediate

1. Study PACKAGE_ARCHITECTURE_OVERVIEW.md
2. Understand PACKAGE_DEPENDENCY_GRAPH.md
3. Practice PACKAGE_INTEGRATION_GUIDE.md scenarios
4. Build a small project

### Advanced

1. Review all integration patterns
2. Study architecture decisions
3. Contribute to packages
4. Write plugins

---

## 📚 Additional Resources

### External Links

- **GitHub Repository:** https://github.com/adapticai/wundr
- **NPM Organization:** https://www.npmjs.com/org/wundr.io
- **Website:** https://wundr.io
- **Issues:** https://github.com/adapticai/wundr/issues
- **Discussions:** https://github.com/adapticai/wundr/discussions

### Related Documentation

- **CONTRIBUTING.md** - How to contribute
- **LICENSE** - MIT License
- **CHANGELOG.md** - Version history
- **SECURITY.md** - Security policy

---

## 🔖 Document Version History

| Version | Date       | Changes                                     |
| ------- | ---------- | ------------------------------------------- |
| 1.0.0   | 2025-11-21 | Initial comprehensive documentation release |

---

## 📄 License

All documentation is licensed under [MIT License](../LICENSE).

---

**Last Updated:** 2025-11-21 **Maintained By:** Wundr Team **Questions?**
https://github.com/adapticai/wundr/issues
