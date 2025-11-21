# Computer Setup Config File Injection Analysis

**Analysis Date:** November 21, 2025
**Repository:** wundr
**Scope:** All setup scripts and config file injection mechanisms

---

## Executive Summary

This analysis identifies how CLAUDE.md and other Claude Code config files are injected into developer machines via the computer-setup infrastructure, current mechanisms, missing components, and recommendations for integrating git-worktree guidelines.

**Key Findings:**
- Single source of truth: `CLAUDE.md.template` in `/packages/@wundr/computer-setup/resources/templates/`
- Config injection happens at 3 stages: Installation, Runtime, and Project-level
- Missing: Git-worktree guidelines, conventions files, advanced hooks
- Opportunity: Centralized config management with version control

---

## 1. Setup Scripts Overview

### 1.1 Primary Setup Entry Points

| Script | Location | Purpose | Trigger |
|--------|----------|---------|---------|
| **setup/install.sh** | `/Users/iroselli/wundr/setup/install.sh` | Main monorepo installation | `bash setup/install.sh` |
| **dev-computer-setup.sh** | `/Users/iroselli/wundr/scripts/dev-computer-setup.sh` | CLI runner for computer-setup package | `./scripts/dev-computer-setup.sh --profile <profile>` |
| **SetupCommands** | `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/setup.ts` | Main wundr CLI setup command | `wundr setup [options]` |
| **RealSetupOrchestrator** | `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/real-setup-orchestrator.ts` | Orchestration engine | Invoked by SetupCommands |

### 1.2 Setup Script Flow Diagram

```
User: bash setup/install.sh
  ↓
setup/install.sh
  ↓
npm ci + dependencies
  ↓
npm run build
  ↓
Optional: wundr setup [--profile]
  ↓
dev-computer-setup.sh (wrapper)
  ↓
SetupCommands (CLI)
  ↓
RealSetupOrchestrator
  ↓
ClaudeInstaller (+ 15 other installers)
  ↓
CLAUDE.md injection (Step 9)
```

---

## 2. Current File Injection Mechanism

### 2.1 CLAUDE.md Injection Flow

**Source File:**
- `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template` (382 lines)

**Injection Points:**

#### A. Global User-Level (during computer-setup)
**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/claude-installer.ts`
**Lines:** 1067-1203

```typescript
private async setupClaudeMdGenerator(): Promise<void> {
    // 1. Copy bundled template
    const bundledTemplate = path.join(
      this.bundledTemplatesDir,
      'CLAUDE.md.template'  // Line 1073
    );

    // 2. Install to ~/.claude/templates/
    const templatePath = path.join(this.templatesDir, 'CLAUDE.md.template');
    await fs.writeFile(templatePath, claudeMdContent);  // Line 1085

    // 3. Create generator script at ~/.claude/helpers/generate-claude-md.js
    // 4. Create global symlink /usr/local/bin/claude-init
}
```

**Flow:**
1. Bundled `CLAUDE.md.template` copied from npm package
2. Installed to `~/.claude/templates/CLAUDE.md.template`
3. Generator script created to auto-generate project-level CLAUDE.md
4. Global command `claude-init` created

#### B. Project-Level (on-demand)
**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/claude-installer.ts`
**Lines:** 1095-1190

Generator script creates dynamic `CLAUDE.md` based on:
```javascript
// Project detection (Lines 1125-1129)
const hasTypeScript = fs.existsSync('tsconfig.json');
const hasReact = includes('react');
const hasNext = fs.existsSync('next.config.js');
const isMonorepo = fs.existsSync('lerna.json') || fs.existsSync('pnpm-workspace.yaml');

// Content generation (Lines 1132-1175)
// - Project info from package.json
// - Available npm scripts
// - Agent recommendations
// - MCP tool declarations
// - Generated timestamp
```

**Output:** Creates `CLAUDE.md` in project root

#### C. Repository-Level (Wundr itself)
**File:** `/Users/iroselli/wundr/CLAUDE.md` (382 lines)
- Manually maintained
- Not auto-generated
- Contains all setup instructions

---

## 3. Claude Code Config Files Currently Included

### 3.1 Agent Definitions
**Location:** `/Users/iroselli/wundr/.claude/agents/` (63 files)

**Categories:**
- Core (5): coder, reviewer, tester, planner, researcher
- Swarm (3): hierarchical-coordinator, mesh-coordinator, adaptive-coordinator
- Consensus (8): byzantine-coordinator, raft-manager, crdt-synchronizer, etc.
- SPARC (4): specification, pseudocode, architecture, refinement
- GitHub (11): pr-manager, code-review-swarm, issue-tracker, release-manager, etc.
- Analysis (2): code-analyzer, code-quality
- Others: optimization, testing, mobile, documentation, backend, ML

**Files per agent:**
- Single `.md` file with prompt/instructions
- Located in thematic subdirectories
- No version control or inheritance

### 3.2 Slash Commands
**Location:** `/Users/iroselli/wundr/.claude/commands/` (44 files)

**Categories:**
- Coordination (3): agent-spawn, swarm-init, task-orchestrate
- GitHub (6): code-review, github-swarm, issue-triage, pr-enhance, repo-analyze, workflow
- Analysis (3): bottleneck-detect, performance-report, token-usage
- Memory (3): memory-persist, memory-search, memory-usage
- Monitoring (3): agent-metrics, real-time-view, swarm-monitor
- Optimization (3): cache-manage, parallel-execute, topology-optimize
- Training (4): model-update, neural-train, pattern-learn
- Workflows (3): workflow-create, workflow-execute, workflow-export
- Hooks (5): pre-task, post-task, pre-edit, post-edit, session-end

### 3.3 Helper Scripts
**Location:** `/Users/iroselli/wundr/.claude/helpers/` (6 files)

```
checkpoint-manager.sh           - Session checkpoint management
github-safe.js                  - GitHub safety wrapper
github-setup.sh                 - GitHub configuration
quick-start.sh                  - Quick start guide
setup-mcp.sh                    - MCP server setup
standard-checkpoint-hooks.sh    - Pre-commit hooks
```

### 3.4 Settings & Configuration
**Location:** `/Users/iroselli/wundr/.claude/settings.json` (115 lines)

**Contents:**
- Environment variables (8)
- Permissions (allow/deny lists)
- Hooks (PreToolUse, PostToolUse, PreCompact, Stop)
- MCP server configuration
- Co-author settings

---

## 4. Missing Components

### 4.1 Critical Missing: Git-Worktree Guidelines

**Current Status:** NO GIT-WORKTREE CONFIGURATION EXISTS
- No `.claude/conventions/` directory
- No worktree best practices file
- No branch isolation guidelines
- No worktree lifecycle documentation

**Should Include:**

```markdown
# Git-Worktree Guidelines for SPARC Development

## Worktree Management

### Creating Feature Worktrees
```bash
git worktree add ../wundr-feature-<name> --track origin/master
```

### Branch Isolation in SPARC Workflow
- Each SPARC phase: separate worktree
- Specification → worktree-spec
- Pseudocode → worktree-pseudocode
- Architecture → worktree-architecture
- Refinement → worktree-refine
- Completion → main branch merge

### Cleanup & Maintenance
- Remove stale worktrees: `git worktree prune`
- Check status: `git worktree list`

### Concurrent Development
- Teams can work on different worktrees
- No branch conflicts
- Isolated test environments
```

### 4.2 Missing: Conventions & Standards Files

**Should Create:**
```
~/.claude/conventions/
├── README.md                  (Overview of all conventions)
├── naming-conventions.md      (Variable, function, file naming)
├── code-style.md             (Formatting, structure standards)
├── git-conventions.md        (Commit messages, branch naming)
├── documentation.md          (Doc standards, templates)
├── testing.md               (Test patterns, coverage goals)
├── git-worktree.md          (Worktree usage, isolation)
├── security.md              (Secret handling, permissions)
└── performance.md           (Optimization guidelines)
```

### 4.3 Missing: Advanced Hooks

**Currently Have:**
- Basic pre-task, post-task hooks
- Pre/post-edit hooks
- Session management

**Should Add:**
- Pre-commit hooks (linting, testing)
- Post-merge hooks (dependency updates)
- Worktree-aware hooks (branch validation)
- SPARC-phase hooks (methodology enforcement)
- Token optimization hooks
- Memory management hooks

---

## 5. Files That Need Updates

### 5.1 Package.json Files (Include Configs in Distribution)

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/package.json`

**Current Lines 7-9:**
```json
"files": [
    "dist",
    "resources"
],
```

**Needed:** Already includes `resources` ✓

### 5.2 Claude Installer (Add Missing Installations)

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/claude-installer.ts`

**Required Updates:**

1. **Add Conventions Installation** (Line ~175, new method)
```typescript
private async setupConventions(): Promise<void> {
    // Copy convention files from bundled resources
    // Create ~/.claude/conventions/ directory
    // Install naming-conventions.md, git-worktree.md, etc.
}
```

2. **Add Worktree Hooks** (Line ~200, new section)
```typescript
private async setupWorktreeHooks(): Promise<void> {
    // Create git hooks for worktree lifecycle
    // post-checkout hook for worktree setup
    // pre-merge hook for branch validation
}
```

3. **Update Steps Array** (Lines 74-156)
- Add "claude-conventions" step
- Add "claude-worktree-setup" step
- Update dependencies

### 5.3 CLAUDE.md Template (Expand Config)

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template`

**Needed Additions:**

1. **Git-Worktree Section**
```markdown
## Git-Worktree Workflow

### Creating SPARC-Aware Worktrees
[Include worktree guidelines]

### Phase-Specific Branches
- spec/feature-name
- design/feature-name
- impl/feature-name
- refine/feature-name
```

2. **Conventions Reference**
```markdown
## Code Conventions

All team standards are documented in:
- ~/.claude/conventions/git-worktree.md
- ~/.claude/conventions/code-style.md
- ~/.claude/conventions/naming-conventions.md
```

3. **Hooks Documentation**
```markdown
## Installed Hooks

### Pre-commit Hooks
- Linting validation
- Type checking
- Test execution

### Worktree Hooks
- Branch naming validation
- SPARC phase tracking
- Cleanup on deletion
```

### 5.4 Generator Script (Update Dynamic Generation)

**File:** Lines 1132-1175 in claude-installer.ts

**Add to Generated CLAUDE.md:**
```javascript
// After line 1166, add conventions section:
\${hasTypeScript ? '- Review conventions in ~/.claude/conventions/' : ''}
\${isMonorepo ? '- Use git-worktree for isolated monorepo work' : ''}

// Add hooks section:
const hooksNote = \`
## Installed Hooks

This project has hooks for:
- Pre-commit validation
- Type checking
- Test execution

Configure in .git/hooks/ or use husky
\`;
```

### 5.5 Resources Directory Structure

**Current:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/`
```
resources/
├── agents/       (63 agent definitions)
├── commands/     (44 slash commands)
├── scripts/      (7 automation scripts)
└── templates/
    └── CLAUDE.md.template
```

**Should Be:**
```
resources/
├── agents/       (63 agent definitions)
├── commands/     (44 slash commands)
├── conventions/  (NEW: 8 convention files)
├── hooks/        (NEW: Advanced hook definitions)
├── scripts/      (7 automation scripts)
├── templates/    (CLAUDE.md.template + others)
└── README.md     (Resource inventory)
```

---

## 6. Configuration File Injection Points

### 6.1 Installation-Time Injection

**When:** `npm install` → `setup/install.sh` → `wundr setup`

**What's Injected:**
1. Global CLI wrapper → `/usr/local/bin/claude`
2. `.claude/` directory structure
3. Agent definitions → `~/.claude/agents/`
4. Slash commands → `~/.claude/commands/`
5. Helper scripts → `~/.claude/helpers/`
6. Settings → `~/.claude/settings.json`
7. CLAUDE.md template → `~/.claude/templates/CLAUDE.md.template`
8. Generator script → `~/.claude/helpers/generate-claude-md.js`

### 6.2 Runtime Injection

**When:** User runs `claude-init` in a git repo

**What's Injected:**
1. Project-specific `CLAUDE.md`
2. Auto-detected project configuration
3. Recommended agents for project type
4. MCP tool declarations

### 6.3 Repository-Level Injection

**When:** Developer clones wundr or similar repo with `.claude/` directory

**What's Injected:**
- Repo-specific agent extensions
- Custom slash commands
- Project-specific settings
- Git hooks (via .husky)

---

## 7. MCP Tools Currently Referenced

### In Settings.json
**Line 113:**
```json
"enabledMcpjsonServers": ["claude-flow", "ruv-swarm"]
```

### In claude-installer.ts (Lines 38-46)
```typescript
private readonly mcpServers = [
    'claude-flow',       // Orchestration & coordination
    'ruv-swarm',         // Swarm coordination
    'firecrawl',         // Web scraping
    'context7',          // Context management
    'playwright',        // Browser automation
    'browser',           // Browser MCP
    'sequentialthinking' // Reasoning mode
];
```

### In Generated CLAUDE.md (Lines 1168-1172)
```javascript
## MCP Tools
- claude-flow: Orchestration and coordination
- firecrawl: Web scraping if needed
- playwright: E2E testing
${hasReact ? '- browser: Real browser testing' : ''}
```

---

## 8. Hooks Currently Installed

### In settings.json (Lines 40-110)

#### Pre-Tool Use Hooks
- Bash commands: `pre-command` validation and resource prep
- File operations: `pre-edit` with agent assignment and context loading

#### Post-Tool Use Hooks
- Bash commands: `post-command` with metrics and result storage
- File operations: `post-edit` with formatting and memory update

#### Pre-Compact Hooks
- Manual mode: Guidance on CLAUDE.md, agents, SPARC methodology
- Auto mode: Full agent context and batchtools optimization

#### Stop Hooks
- Session end: Summary generation, state persistence, metrics export

### Missing Hook Types
- Pre-commit hooks (source control)
- Post-merge hooks (dependency management)
- Branch hooks (validation, SPARC phase enforcement)
- Worktree hooks (lifecycle management)

---

## 9. Integration Strategy for Git-Worktree Guidelines

### 9.1 Step 1: Create Conventions Directory (NEW FILES)

**Create:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/`

**Files to Add:**

1. **README.md**
   - Overview of all conventions
   - When to use which guideline
   - Links to all files

2. **git-worktree.md** (PRIORITY)
   - Worktree creation per SPARC phase
   - Branch naming: `spec/`, `design/`, `impl/`, `refine/`, `final/`
   - Isolation strategies
   - Cleanup procedures
   - Multi-team coordination

3. **naming-conventions.md**
   - Variables: camelCase (JS), snake_case (Python)
   - Files: kebab-case
   - Classes: PascalCase
   - Constants: UPPER_SNAKE_CASE

4. **code-style.md**
   - Formatting rules
   - Indentation (2 spaces)
   - Line length (100 chars)
   - Bracket placement

5. **git-conventions.md**
   - Commit message format
   - Branch naming
   - PR standards
   - Merge strategies

6. **documentation.md**
   - README standards
   - API documentation format
   - Code comment style
   - Changelog maintenance

7. **testing.md**
   - Test file location
   - Naming patterns
   - Coverage goals
   - Test categories

8. **security.md**
   - Secret handling (.env.example)
   - API key rotation
   - Audit logging
   - Dependency scanning

### 9.2 Step 2: Update Claude Installer

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/claude-installer.ts`

**Add Methods:**

```typescript
// After setupClaudeMdGenerator() at line 1203:

private async setupConventions(): Promise<void> {
    console.log('📋 Installing code conventions...');

    const conventionsDir = path.join(this.claudeDir, 'conventions');
    await fs.ensureDir(conventionsDir);

    const bundledConventionsDir = path.join(this.resourcesDir, 'conventions');

    // Copy all convention files
    const files = await fs.readdir(bundledConventionsDir);
    for (const file of files) {
        const src = path.join(bundledConventionsDir, file);
        const dst = path.join(conventionsDir, file);
        await fs.copy(src, dst, { overwrite: true });
    }

    console.log('✅ Conventions installed');
}

private async setupWorktreeHooks(): Promise<void> {
    console.log('🔧 Setting up git-worktree hooks...');

    const postCheckoutHook = `#!/bin/bash
# Post-checkout hook for worktree setup
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# SPARC phase detection
if [[ $BRANCH =~ ^spec/ ]]; then
    echo "🔍 Specification phase - use 'sparc run spec-pseudocode'"
elif [[ $BRANCH =~ ^design/ ]]; then
    echo "📐 Architecture phase - use 'sparc run architect'"
elif [[ $BRANCH =~ ^impl/ ]]; then
    echo "💻 Implementation phase - use 'sparc tdd'"
elif [[ $BRANCH =~ ^refine/ ]]; then
    echo "🔄 Refinement phase - use 'sparc run integration'"
fi
`;

    await this.createGitHook('post-checkout', postCheckoutHook);
    console.log('✅ Worktree hooks installed');
}

private async createGitHook(hookName: string, content: string): Promise<void> {
    // Implementation to create .git/hooks/{hookName}
}
```

**Update getSteps() method (Line 74):**

```typescript
steps.push({
    id: 'claude-conventions',
    name: 'Setup Code Conventions',
    description: 'Install code style, naming, and workflow conventions',
    category: 'configuration',
    required: true,
    dependencies: ['claude-config'],
    estimatedTime: 5,
    installer: async () => {
        await this.setupConventions();
    },
});

steps.push({
    id: 'claude-worktree',
    name: 'Setup Git-Worktree Hooks',
    description: 'Configure hooks for SPARC-aware worktree management',
    category: 'configuration',
    required: false,
    dependencies: ['claude-conventions'],
    estimatedTime: 5,
    installer: async () => {
        await this.setupWorktreeHooks();
    },
});
```

### 9.3 Step 3: Update CLAUDE.md Template

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template`

**Add Section (after Agent Configuration):**

```markdown
## Code Conventions

All development standards are documented in:
- **Git-Worktree:** ~/.claude/conventions/git-worktree.md
- **Naming:** ~/.claude/conventions/naming-conventions.md
- **Code Style:** ~/.claude/conventions/code-style.md
- **Git:** ~/.claude/conventions/git-conventions.md
- **Documentation:** ~/.claude/conventions/documentation.md
- **Testing:** ~/.claude/conventions/testing.md
- **Security:** ~/.claude/conventions/security.md

## SPARC + Worktree Workflow

For feature development using SPARC methodology:

1. Create specification worktree:
   \`\`\`bash
   git worktree add ../wundr-spec-<feature> --track origin/master
   cd ../wundr-spec-<feature>
   git checkout -b spec/<feature>
   \`\`\`

2. Run specification phase:
   \`\`\`bash
   npx claude-flow sparc run spec-pseudocode "<feature description>"
   \`\`\`

3. Merge when complete, move to architecture worktree
4. Follow same pattern for each SPARC phase

## Git Hooks

Automatic hooks are installed for:
- Branch naming validation (SPARC phases)
- Pre-commit linting and testing
- Worktree lifecycle management
- Post-checkout SPARC phase guidance
```

### 9.4 Step 4: Update Package.json

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/package.json`

**Lines 7-9 - already includes "resources", just verify:**

```json
"files": [
    "dist",
    "resources"
],
```

The resources directory will automatically include all subdirectories including the new `conventions/` folder.

---

## 10. Specific File Paths Requiring Updates

### Summary Table

| File | Lines | Type | Change | Priority |
|------|-------|------|--------|----------|
| claude-installer.ts | 74-156 | Feature | Add conventions + worktree steps | HIGH |
| claude-installer.ts | 1203+ | Feature | Add setupConventions() method | HIGH |
| claude-installer.ts | 1220+ | Feature | Add setupWorktreeHooks() method | HIGH |
| CLAUDE.md.template | +30 | Content | Add conventions + SPARC+worktree section | HIGH |
| claude-installer.ts (generator) | 1132-1175 | Feature | Include conventions in dynamic generation | MEDIUM |
| generator-claude-md.js | 1095-1184 | Feature | Add hooks documentation | MEDIUM |
| package.json (computer-setup) | 7-9 | Config | Verify resources inclusion | LOW |

### New Files to Create

| File | Location | Purpose |
|------|----------|---------|
| git-worktree.md | resources/conventions/ | Worktree workflow guide |
| naming-conventions.md | resources/conventions/ | Code naming standards |
| code-style.md | resources/conventions/ | Formatting standards |
| git-conventions.md | resources/conventions/ | Git workflow standards |
| documentation.md | resources/conventions/ | Doc standards |
| testing.md | resources/conventions/ | Test guidelines |
| security.md | resources/conventions/ | Security practices |
| README.md | resources/conventions/ | Conventions overview |

---

## 11. Recommendations

### 11.1 Immediate Actions (Next Sprint)

1. **Create Conventions Directory**
   - Add `/packages/@wundr/computer-setup/resources/conventions/`
   - Create 8 markdown files (see Section 9.1)

2. **Update Claude Installer**
   - Add `setupConventions()` method
   - Add `setupWorktreeHooks()` method
   - Update `getSteps()` to include both

3. **Update CLAUDE.md Template**
   - Add conventions reference section
   - Add SPARC + worktree workflow section
   - Update generator script to include conventions

### 11.2 Medium-term (2-3 Sprints)

1. **Enhance Hooks**
   - Add pre-commit linting hooks
   - Add SPARC phase validation hooks
   - Add worktree cleanup hooks

2. **Create Conventions Documentation**
   - Write comprehensive git-worktree.md
   - Create onboarding guide
   - Add examples for each convention

3. **Test Installation Flow**
   - Verify `wundr setup` installs all configs
   - Test `claude-init` in test projects
   - Validate hooks execution

### 11.3 Long-term (4+ Sprints)

1. **Automate Convention Enforcement**
   - Pre-commit hooks run linting
   - SPARC phase enforcement
   - Branch naming validation

2. **Create Convention Extensions**
   - Per-language conventions (Go, Rust, Python)
   - Framework-specific (Next.js, FastAPI)
   - Team-specific customizations

3. **Versioning & Updates**
   - Convention versioning
   - Breaking change notifications
   - Automated updates

---

## 12. Current State Summary

### What's Working
✓ Bundled agent definitions (63 files)
✓ Bundled slash commands (44 files)
✓ Bundled helper scripts (6 files)
✓ Settings.json with hooks
✓ CLAUDE.md template generation
✓ MCP server configuration
✓ Global CLI installation

### What's Missing
✗ Git-worktree guidelines
✗ Code conventions directory
✗ Advanced hooks (pre-commit, post-merge, branch validation)
✗ Convention versioning
✗ SPARC phase awareness in hooks
✗ Worktree lifecycle hooks
✗ Team collaboration guidelines

### What Needs Enhancement
~ CLAUDE.md template (add conventions section)
~ Claude installer (add conventions installation)
~ Hook system (add advanced hooks)
~ Generator script (include conventions in output)

---

## 13. Critical Files Map

### Config Injection Source Files
```
Source of Truth:
  └─ /packages/@wundr/computer-setup/resources/
      ├─ agents/          (63 agent definitions)
      ├─ commands/        (44 slash commands)
      ├─ scripts/         (automation)
      ├─ templates/       (CLAUDE.md.template)
      └─ conventions/     (MISSING - TO CREATE)

Installation Code:
  └─ /packages/@wundr/computer-setup/src/installers/
      ├─ claude-installer.ts           (Main installation)
      ├─ real-setup-orchestrator.ts    (Orchestration)
      ├─ mac-installer.ts              (Platform-specific)
      └─ [14 other installers]

CLI Integration:
  └─ /packages/@wundr/cli/src/commands/
      └─ setup.ts (SetupCommands class)

Wrapper Scripts:
  ├─ /scripts/dev-computer-setup.sh    (CLI wrapper)
  ├─ /setup/install.sh                 (Main setup script)
  └─ /packages/@wundr/computer-setup/scripts/verify-installation.sh
```

### Configuration Targets
```
Global User Level:
  ~/.claude/
  ├─ agents/              (copied from resources)
  ├─ commands/            (copied from resources)
  ├─ helpers/             (copied from resources)
  ├─ conventions/         (MISSING)
  ├─ hooks/              (MISSING - advanced)
  ├─ templates/          (CLAUDE.md.template)
  └─ settings.json

Project Level:
  {project}/
  └─ CLAUDE.md            (auto-generated by claude-init)

Repository Level:
  /wundr/
  ├─ CLAUDE.md            (manually maintained)
  └─ .claude/             (optional - overrides global)
```

---

## 14. Next Steps

### Phase 1: Analysis Complete ✓
- Identified all injection points
- Documented current config files
- Listed missing components
- Mapped file locations

### Phase 2: Planning (Next)
- Design conventions content structure
- Plan hook implementation
- Define integration sequence
- Create test plan

### Phase 3: Implementation (After Planning)
- Create conventions files
- Update claude-installer.ts
- Update CLAUDE.md template
- Create/update setup scripts

### Phase 4: Testing & Validation
- Test fresh computer-setup
- Verify all configs installed
- Test hooks execution
- Validate worktree flow

### Phase 5: Documentation
- Update onboarding guide
- Create conventions guide
- Document SPARC + worktree workflow
- Add troubleshooting guide

---

## Appendix: File Sizes & Statistics

| Component | Count | Total Size |
|-----------|-------|-----------|
| Agent definitions | 63 | ~1.5 MB |
| Slash commands | 44 | ~800 KB |
| Helper scripts | 6 | ~120 KB |
| Settings.json | 1 | ~4 KB |
| CLAUDE.md template | 1 | ~8 KB |
| Conventions (missing) | 8 | ~0 KB |

**Total Current:** ~2.4 MB
**With Conventions:** ~2.5 MB

---

**Report Generated:** 2025-11-21
**Analysis Complete:** YES
**Ready for Implementation:** YES
