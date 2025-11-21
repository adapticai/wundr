# Comprehensive Project Initialization & Boilerplate Analysis Report

**Analysis Date**: 2025-11-21
**Repository**: /Users/iroselli/wundr
**Scope**: Project initialization, boilerplate setup, and Claude Code configuration

---

## Executive Summary

The Wundr repository contains a **comprehensive but fragmented** project initialization system with multiple entry points, template engines, and configuration generators. There are **two parallel setup implementations** (one in `/src/cli` and one in `/packages/@wundr/cli`) that need consolidation.

### Key Findings:
- **4 distinct setup command implementations** (duplication)
- **2 template systems** (TemplateManager vs dynamic generation)
- **Missing integration points** between systems
- **CLAUDE.md generation is dynamic** but not fully leveraged
- **Agent and MCP tool configuration** exists but needs template integration

---

## 1. Project Initialization Mechanisms

### 1.1 Current Setup Command Entry Points

#### Location 1: `/Users/iroselli/wundr/src/cli/commands/claude-setup.ts`
**Status**: Standalone CLI command
**Lines**: 374
**Functionality**:
- Standalone `claude-setup` command
- Steps through: Claude Flow setup → MCP Tools → CLAUDE.md generation → Project templates
- Uses dynamic CLAUDE.md generator
- Creates project structure templates (TypeScript, React, Node.js, Monorepo)

**Key Function**:
```typescript
export function createClaudeSetupCommand(): Command {
  // Lines 16-91: Main command handler
  // - Claude Flow installation
  // - MCP Tools setup
  // - Dynamic CLAUDE.md generation
  // - Project template selection
  // - Swarm initialization
  // - Setup validation
}
```

**Template Creation Functions**:
- `setupTypeScriptTemplate()` (lines 206-236)
- `setupReactTemplate()` (lines 238-256)
- `setupNodeTemplate()` (lines 258-271)
- `setupMonorepoTemplate()` (lines 273-301)

#### Location 2: `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/claude-setup.ts`
**Status**: Monorepo package CLI
**Lines**: 697
**Functionality**:
- Class-based setup: `ClaudeSetupCommands`
- Comprehensive agent configuration
- Hardware-adaptive optimization setup
- Shell configuration management
- Multiple sub-commands:
  - `claude-setup install` - Complete ecosystem setup
  - `claude-setup mcp` - MCP tools installation
  - `claude-setup agents` - Agent configuration
  - `claude-setup optimize` - Hardware optimization
  - `claude-setup validate` - Installation validation
  - `claude-setup extension` - Chrome extension setup

**Key Agent Management**:
```typescript
listAgents(): void
- Core Development: coder, reviewer, tester, planner, researcher
- Swarm Coordination: hierarchical-coordinator, mesh-coordinator, adaptive-coordinator
- GitHub Integration: github-modes, pr-manager, issue-tracker, release-manager
- Specialized: backend-dev, mobile-dev, ml-developer, system-architect
```

**Profile-Based Agent Selection**:
```typescript
getProfileAgents(profile: string): string[]
- frontend: [coder, reviewer, tester, mobile-dev]
- backend: [coder, reviewer, tester, backend-dev, system-architect]
- fullstack: [coder, reviewer, tester, planner, researcher, system-architect]
- devops: [planner, cicd-engineer, perf-analyzer, github-modes]
```

#### Location 3: `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/setup.ts`
**Status**: Machine/environment setup
**Lines**: 509
**Functionality**:
- `wundr setup` - Developer environment setup
- Profile-based orchestration:
  - frontend, backend, fullstack, devops
- Resumable setup with save state
- Tool validation (Node.js, Git, Homebrew, Docker)
- Personalization workflow
- Integration with `RealSetupOrchestrator`

**Sub-commands**:
- `setup` - Main environment setup
- `setup:profile {frontend|backend|fullstack|devops}`
- `setup:validate` - Environment validation
- `setup:resume` - Resume interrupted setup
- `setup:personalize` - User configuration

#### Location 4: `/Users/iroselli/wundr/setup/install.sh`
**Status**: Bash installation script
**Lines**: 268
**Functionality**:
- Cross-platform OS detection (macOS, Linux, Windows)
- Dependency checks:
  - Node.js 18.x or higher
  - npm/yarn verification
  - Git installation
  - Python (optional)
- Directory structure creation
- TypeScript compilation
- Git hooks setup
- Verification

---

## 2. CLAUDE.md Generation System

### 2.1 Dynamic Generation Pipeline

**Location**: `/Users/iroselli/wundr/src/claude-generator/`

#### Component Architecture:
```
ClaudeConfigGenerator
  ├── ProjectDetector (analyzes project type and structure)
  ├── QualityAnalyzer (examines code quality standards)
  ├── RepositoryAuditor (audits repository state)
  └── TemplateEngine (generates markdown content)
```

**File Breakdown**:

1. **`claude-config-generator.ts`** (335 lines)
   - Main entry point: `async generateConfig(): Promise<ClaudeConfig>`
   - Main output: `async generateClaudeMarkdown(): Promise<string>`
   - Detects project type from package.json and structure
   - Configures agents based on project type
   - Configures MCP tools
   - Extracts build, test, lint, custom commands

2. **`template-engine.ts`** (488 lines)
   - `generateClaudeConfig(context): string`
   - Generates 11 major sections:
     - Header with project metadata
     - Verification protocol
     - Concurrent execution rules
     - Project overview
     - Build commands
     - Workflow phases
     - Code style
     - Agent configuration
     - MCP tools
     - Build system
     - Quality standards
     - Integration tips
     - Footer

3. **`project-detector.ts`** (352 lines)
   - `detectProjectType()` - Identifies: react, nextjs, nodejs, typescript, monorepo, cli, library, full-stack
   - `analyzeStructure()` - Examines directories, frameworks, build tools, test frameworks

4. **`quality-analyzer.ts`** (248 lines)
   - Analyzes linting, type checking, testing frameworks
   - Evaluates formatting standards
   - Checks pre-commit hooks

5. **`repository-auditor.ts`** (418 lines)
   - Comprehensive audit of repository state
   - Quality scoring
   - Issue identification and recommendations

6. **`types.ts`** (143 lines)
   - Type definitions for entire system

### 2.2 Template File

**Location**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template`

**Content**: 383 lines of comprehensive template covering:
- Verification protocol
- Concurrent execution rules
- SPARC commands
- Agent configurations
- MCP tools integration
- Wundr MCP tools
- Integration tips

**Current Status**: Used as static reference, not dynamically populated

---

## 3. Project Template System

### 3.1 Template Manager (`packages/@wundr/computer-setup/src/templates/`)

#### `template-manager.ts` (100+ lines, partial read)
- `TemplateContext` interface defining:
  - Profile (developer preferences)
  - Project info (name, type, package manager)
  - Platform info (OS, arch, shell)
- `copyTemplates()` - Processes template directory
- `copyTemplate()` - Copies individual template files
- Customization/variable interpolation

#### `project-templates.ts` (100+ lines, partial read)
- `createProjectTemplates()` - Main factory function
- Project type support:
  - node, react, vue, python, go, rust, java
- Template options:
  - Docker integration
  - GitHub workflows
  - Slack integration
  - Claude Flow
- `getConfigsForProjectType()` - Returns config templates:
  - node: eslint, jest, tsconfig-node
  - react: eslint, jest, tsconfig-react
  - vue: (presumed similar)

### 3.2 Computer Setup Templates

**Location**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/`

Contains templates for:
- CLAUDE.md (static template)
- Project-specific configurations
- CI/CD pipelines
- Docker files

---

## 4. What Gets Copied to New Projects

### 4.1 From `claude-setup.ts` (Direct File Creation)

**Template Structure Created**:
```
project/
├── CLAUDE.md (dynamically generated)
├── mcp-tools/
│   ├── install.sh (template)
│   └── package.json
└── [project-type-specific]
    ├── src/
    │   └── index.{ts|js}
    ├── components/ (React)
    ├── hooks/ (React)
    ├── routes/ (Node.js)
    ├── packages/ (Monorepo)
    ├── apps/ (Monorepo)
    └── tsconfig.json (TypeScript)
```

**Generated Files**:
1. **CLAUDE.md** - Dynamic, context-aware configuration
2. **mcp-tools/install.sh** - Stub script for MCP tool installation
3. **mcp-tools/package.json** - MCP tools metadata
4. **Type-specific files** - Based on selected template

### 4.2 From Template Manager (Not Yet Fully Integrated)

**Potential Templates** (from `project-templates.ts`):
- Prettier configs
- ESLint configs
- Jest configs
- TypeScript configs
- Docker files
- GitHub workflows
- Slack integration
- Slack manifest

---

## 5. Current Claude Code Configuration

### 5.1 CLAUDE.md Generation Flow

**Step-by-Step Process**:
1. Detect project type from package.json + directory structure
2. Analyze project quality standards (linting, testing, types)
3. Audit repository for issues and best practices
4. Configure agents based on project type
5. Configure MCP tools (common + project-specific)
6. Extract build/test/lint/custom commands from package.json
7. Generate comprehensive CLAUDE.md from template engine

**Detected Project Types** and Agent Assignment:
```
monorepo → hierarchical topology, 12 max agents
            + package-coordinator, build-orchestrator, version-manager, dependency-analyzer

react → mesh topology, 6 max agents
        + ui-designer, component-architect, accessibility-tester, performance-optimizer

nextjs → mesh topology, 6 max agents
         + ui-designer, ssr-specialist, performance-optimizer, seo-analyzer

nodejs → mesh topology, 6 max agents
         + api-designer, security-auditor, performance-optimizer, database-architect

cli → mesh topology, 6 max agents
      + ux-designer, help-writer, integration-tester, platform-tester

library → mesh topology, 6 max agents
          + api-designer, documentation-writer, compatibility-tester, version-manager

full-stack → adaptive topology, 10 max agents
             + api-designer, ui-designer, integration-tester, security-auditor
```

### 5.2 Agent Profiles Configuration

**Stored At**: `~/.claude/agents/` (per packages/@wundr/cli/src/commands/claude-setup.ts)

**Generated Configuration**:
```json
{
  "name": "agent-name",
  "enabled": true,
  "description": "agent description",
  "configuration": {
    "maxTokens": 8000,
    "temperature": 0.7,
    "topP": 0.9,
    "enableMemory": true,
    "enableLearning": true
  }
}
```

**Configuration Profiles**:
- frontenddevfrontendev (4 agents)
- backenddev (5 agents)
- fullstackdev (6 agents)
- devopsengineering (4 agents)

---

## 6. What's Missing from Templates

### 6.1 Critical Gaps

#### 1. **Agent Template Integration**
- ❌ Agent configurations NOT copied to new projects
- ❌ No swarm topology configuration in templates
- ❌ Agent profiles not included in CLAUDE.md generation

**Impact**: New projects must manually configure agents or run `wundr claude-setup agents`

**Fix Needed**:
```typescript
// Missing from setupProjectTemplate()
- Copy agent configuration templates from ~/.claude/agents/templates/
- Generate project-specific agent configurations
- Include agent setup instructions in generated CLAUDE.md
```

#### 2. **MCP Tools Configuration**
- ❌ Only stub install.sh created, no actual MCP tools
- ❌ No MCP configuration for new projects
- ❌ Missing MCP server setup in CLAUDE.md
- ❌ No enabled MCP tools list in generated config

**Impact**: New projects can't immediately use MCP tools

**Fix Needed**:
```typescript
// Missing from setupMCPTools()
- Copy MCP tool configurations
- Generate .claude/settings.json with enabled MCP tools
- Include MCP server setup commands
- Copy MCP tool installation scripts
```

#### 3. **Git Hooks & Pre-commit Workflow**
- ❌ Not included in template setup
- ❌ No husky configuration
- ❌ Missing pre-commit hooks from CLAUDE.md
- ❌ No lint-staged configuration

**Impact**: Quality standards not enforced automatically

#### 4. **Directory Structure Templates**
- ❌ Only basic directories created
- ❌ No `.claude/` directory structure
- ❌ Missing config/ scripts/ examples/ test/ directories
- ❌ No placeholder files for guidance

**Expected Structure Missing**:
```
project/
├── .claude/                    ❌ Missing
│   ├── agents/                 ❌
│   ├── commands/               ❌
│   ├── helpers/                ❌
│   └── settings.json           ❌
├── config/                     ❌ Not created
│   ├── eslint.config.js        ❌
│   ├── prettier.config.js      ❌
│   └── jest.config.js          ❌
├── scripts/                    ❌ Not created
│   ├── setup.sh                ❌
│   └── validate.sh             ❌
├── docs/                       ✓ Partial
├── tests/                      ✓ Basic
└── src/                        ✓ Basic
```

#### 5. **Quality Standards Documentation**
- ❌ No ESLint configuration template
- ❌ No Jest/test framework setup
- ❌ No TypeScript strict mode configuration
- ❌ No code formatting rules

#### 6. **Build System Integration**
- ❌ No build configuration templates
- ❌ Missing webpack/vite/next.js configs
- ❌ No CI/CD pipeline templates
- ❌ Docker support only partially integrated

#### 7. **CLAUDE.md Dynamic Sections Missing**
Even though dynamic generation exists, some critical sections are NOT populated:

**Partially Implemented**:
- ✓ Project metadata
- ✓ Agent configuration (list only)
- ✓ MCP tools (generic list, not project-specific)
- ✓ Build commands

**Missing/Incomplete**:
- ❌ Custom SPARC workflow for project type
- ❌ Project-specific architecture guidelines
- ❌ Team-specific conventions
- ❌ Integration points for custom agents
- ❌ Performance optimization recommendations

---

## 7. Setup Command Integration Points

### 7.1 Current Flow

```mermaid
Input: wundr claude-setup [path]
  ↓
1. Verify Git Repository
  ├─ If missing: Prompt for git init
  ↓
2. Setup Claude Flow
  ├─ Check if installed
  ├─ Install if needed (global or local)
  ├─ Add MCP server config
  ↓
3. Setup MCP Tools
  ├─ Create mcp-tools/ directory
  ├─ Create stub install.sh
  ├─ Create package.json
  ↓
4. Generate CLAUDE.md
  ├─ ProjectDetector → Project type
  ├─ QualityAnalyzer → Quality standards
  ├─ RepositoryAuditor → Recommendations
  ├─ TemplateEngine → Markdown output
  ↓
5. Setup Project Template
  ├─ Prompt: Select template (typescript|react|nodejs|monorepo)
  ├─ Create basic structure
  ├─ Create index file
  ↓
6. Initialize Swarm
  ├─ Run: npx claude-flow@alpha init
  ↓
7. Validate Setup
  ├─ Check CLAUDE.md exists
  ├─ Check mcp-tools/ exists
  ├─ Check .git exists
  ↓
Output: Setup complete, next steps printed
```

### 7.2 Missing Integration Points

1. **Agent Template Copying**
   ```
   setupProjectTemplate() → copyAgentTemplates()
   Expected: ~/.claude/agents/templates/ → project/.claude/agents/
   Current: Skipped entirely
   ```

2. **MCP Configuration**
   ```
   setupMCPTools() → generateMCPConfig()
   Expected: Generate .claude/settings.json with enabled tools
   Current: Only creates stub install.sh
   ```

3. **Config Template Copying**
   ```
   setupProjectTemplate() → copyConfigTemplates()
   Expected: eslint, prettier, jest, tsconfig from templates/
   Current: Not called
   ```

4. **Hook Setup Integration**
   ```
   setupProjectTemplate() → setupGitHooks()
   Expected: Configure pre-commit, husky, lint-staged
   Current: Not configured
   ```

---

## 8. File Structure Analysis

### 8.1 Key Files by Responsibility

#### Setup Command Files:
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `/src/cli/commands/claude-setup.ts` | 374 | Standalone CLI setup | Active |
| `/packages/@wundr/cli/src/commands/claude-setup.ts` | 697 | Monorepo package setup | Active |
| `/packages/@wundr/cli/src/commands/setup.ts` | 509 | Environment setup | Active |
| `/setup/install.sh` | 268 | Bash installer | Active |

#### Generator Files:
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `/src/claude-generator/claude-config-generator.ts` | 335 | CLAUDE.md generation | Active |
| `/src/claude-generator/template-engine.ts` | 488 | Template rendering | Active |
| `/src/claude-generator/project-detector.ts` | 352 | Project type detection | Active |
| `/src/claude-generator/quality-analyzer.ts` | 248 | Quality analysis | Active |
| `/src/claude-generator/repository-auditor.ts` | 418 | Repository audit | Active |
| `/src/claude-generator/types.ts` | 143 | Type definitions | Active |

#### Template Files:
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `/packages/@wundr/computer-setup/src/templates/template-manager.ts` | 100+ | Template copying | Active (partial) |
| `/packages/@wundr/computer-setup/src/templates/project-templates.ts` | 100+ | Project templates | Active (partial) |
| `/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template` | 383 | Static reference | Unused |

#### Agent Template Files:
| Location | Files | Purpose | Status |
|----------|-------|---------|--------|
| `/.claude/agents/templates/` | 9 .md files | Agent configurations | Reference only |

### 8.2 Template Directories

```
Templates Found:
├── /.claude/agents/templates/ (9 markdown files - agent configs)
├── /.claude/commands/ (directories)
├── /.claude/helpers/
├── /packages/@wundr/cli/templates/ (empty?)
├── /packages/@wundr/environment/templates/ (exists)
├── /packages/@wundr/computer-setup/dist/templates/ (compiled)
├── /packages/@wundr/computer-setup/resources/templates/
│   └── CLAUDE.md.template (383 lines)
└── /tools/web-client/app/api/templates/
    └── (Web UI templates - not relevant)
```

---

## 9. Integration Recommendations

### 9.1 Consolidation Strategy

**PROBLEM**: Two parallel setup implementations

**SOLUTION**:
1. **Keep `/packages/@wundr/cli/src/commands/claude-setup.ts`** as primary (more complete)
   - Has agent configuration
   - Has hardware optimization
   - Has validation with fix options
   - Has multiple sub-commands

2. **Migrate `/src/cli/commands/claude-setup.ts`** functionality into above:
   - Dynamic CLAUDE.md generation
   - Project template creation

3. **Result**: Single, unified `ClaudeSetupCommands` class

### 9.2 Template Integration Improvements

#### Implement Agent Template Copying:
```typescript
// New function: setupProjectTemplate()
async function setupAgentTemplates(
  spinner: ora.Ora,
  repoPath: string,
  projectType: string
): Promise<void> {
  spinner.text = 'Setting up Claude agent templates...';

  // Copy from /.claude/agents/templates/
  // based on projectType
  // Create .claude/agents/ directory
  // Generate agent configurations
}
```

#### Implement MCP Tool Configuration:
```typescript
// New function: setupMCPTools()
async function configureMCPTools(
  spinner: ora.Ora,
  repoPath: string,
  mcpConfig: MCPToolConfig
): Promise<void> {
  spinner.text = 'Configuring MCP tools...';

  // Generate .claude/settings.json
  // with enabled MCP tools from mcpConfig
  // Create mcp-tools installation scripts
  // Include MCP server setup commands
}
```

#### Create Full Directory Structure:
```typescript
// New function: createProjectStructure()
async function createProjectStructure(
  repoPath: string,
  projectType: string
): Promise<void> {
  // Create all standard directories:
  // - .claude/{agents,commands,helpers}
  // - config/
  // - scripts/
  // - tests/
  // - docs/
  // - src/
  // - examples/

  // Add placeholder/template files:
  // - .claude/settings.json (with defaults)
  // - config/{eslint,prettier,jest,tsconfig}.js
  // - scripts/{setup,validate}.sh
  // - docs/ARCHITECTURE.md
  // - docs/DEVELOPMENT.md
  // - tests/example.test.ts
}
```

### 9.3 CLAUDE.md Generation Enhancements

#### Extend Template Engine:
```typescript
// Add missing sections to TemplateEngine

generateCustomSPARCWorkflow(projectType): string
  // Generate SPARC workflow optimized for project type

generateArchitectureGuidelines(structure): string
  // Create architecture recommendations based on structure

generateConventionGuide(quality): string
  // Document project-specific conventions

generateIntegrationPoints(agents, mcp): string
  // Show how agents and MCP tools work together

generateTroubleshootingGuide(): string
  // Common setup issues and solutions
```

#### Improve Dynamic Content:
```typescript
// In ClaudeConfigGenerator

// Currently missing: Custom SPARC mode recommendations
// Add: customSPARCModes based on projectType

// Currently missing: Team/org specific guidance
// Add: teamConfiguration analysis

// Currently missing: Performance optimization tips
// Add: performanceRecommendations based on structure

// Currently missing: Security best practices
// Add: securityChecklist based on projectType
```

### 9.4 Boilerplate Files to Add

#### Essential Missing Files:

1. **`.claude/settings.json`**
   ```json
   {
     "project": "project-name",
     "agents": {...},
     "mcp": {...},
     "hooks": {...},
     "claudeFlow": {...}
   }
   ```

2. **`config/eslint.config.js`**
   - Project-specific linting rules
   - Based on detected frameworks

3. **`config/jest.config.js`**
   - Testing configuration
   - Coverage thresholds
   - Test path patterns

4. **`config/tsconfig.json`** (if TypeScript)
   - Strict mode enabled
   - Path aliases
   - Proper outDir/rootDir

5. **`scripts/setup.sh`**
   - Developer environment setup
   - Dependency installation
   - Git hooks configuration

6. **`scripts/validate.sh`**
   - Project health checks
   - Build verification
   - Test execution

7. **`docs/DEVELOPMENT.md`**
   - How to work on the project
   - Local setup instructions
   - Running tests and build

8. **`docs/ARCHITECTURE.md`**
   - Project structure overview
   - Module organization
   - Key design decisions

9. **`.github/workflows/ci.yml`** (if includeGitHub)
   - Automated testing
   - Build verification
   - Linting checks

10. **`Dockerfile`** (if includeDocker)
    - Container configuration
    - Build layers
    - Runtime setup

---

## 10. Implementation Roadmap

### Phase 1: Consolidation (Immediate)
- [ ] Merge two `claude-setup.ts` implementations
- [ ] Create unified `ClaudeSetupCommands` class
- [ ] Remove duplication in setup logic
- [ ] Ensure backward compatibility

### Phase 2: Template Integration (Short-term)
- [ ] Implement `setupAgentTemplates()` function
- [ ] Implement `configureMCPTools()` function
- [ ] Create full directory structure factory
- [ ] Copy config template files
- [ ] Generate placeholder files

### Phase 3: CLAUDE.md Enhancement (Short-term)
- [ ] Add custom SPARC workflow section
- [ ] Add architecture guidelines
- [ ] Add convention guide
- [ ] Add troubleshooting guide
- [ ] Improve MCP tool section specificity

### Phase 4: Documentation (Medium-term)
- [ ] Document setup process
- [ ] Create troubleshooting guide
- [ ] Add template customization guide
- [ ] Document agent configuration
- [ ] Create examples for each project type

### Phase 5: Testing & Validation (Medium-term)
- [ ] Create test suite for setup commands
- [ ] Test each project type template
- [ ] Verify CLAUDE.md generation
- [ ] Validate agent configuration
- [ ] End-to-end setup testing

---

## 11. Code Quality Issues

### 11.1 Identified Problems

| Issue | Severity | Files | Notes |
|-------|----------|-------|-------|
| Code duplication | High | 2 x claude-setup.ts | Two parallel implementations |
| Missing error handling | Medium | setup.ts | Some commands lack try-catch |
| Template files unused | Medium | CLAUDE.md.template | Static file, not leveraged |
| Incomplete template system | Medium | project-templates.ts | Partial implementation |
| Hard-coded values | Low | Various | Max agents, timeout values |
| Missing validation | Medium | template-engine.ts | No context validation |
| Inconsistent error messages | Low | All setup files | Different error formats |

### 11.2 Recommendations

1. **Remove Code Duplication**
   - Consolidate to single setup command
   - Create shared utility functions
   - Use composition over duplication

2. **Improve Error Handling**
   - Add comprehensive try-catch blocks
   - Provide recovery suggestions
   - Log errors for debugging

3. **Leverage Existing Templates**
   - Use CLAUDE.md.template as base
   - Replace static with dynamic
   - Validate generated content

4. **Complete Template System**
   - Finish project-templates.ts implementation
   - Add all configuration templates
   - Create complete boilerplate

5. **Add Input Validation**
   - Validate template context
   - Check template variables
   - Verify generated output

---

## 12. File-by-File Integration Points

### Integration Needed:

#### `/src/cli/commands/claude-setup.ts` → `/packages/@wundr/cli/src/commands/claude-setup.ts`
```typescript
// Move to unified class:
- generateClaudeConfig() [line 171]
- setupProjectTemplate() [line 186]
- setupTypeScriptTemplate() [line 206]
- setupReactTemplate() [line 238]
- setupNodeTemplate() [line 258]
- setupMonorepoTemplate() [line 273]
- initializeSwarm() [line 303]

// Keep in monorepo version:
- runCompleteSetup() [line 95]
- installMcpTools() [line 140]
- configureAgents() [line 208]
- validateInstallation() [line 244]
- setupOptimizations() [line 297]
```

#### `/src/claude-generator/` → Project Template Integration
```typescript
// In setupProjectTemplate():
- Generate CLAUDE.md with dynamic engine
- Create config files from templates
- Setup git hooks
- Initialize agent configurations
- Configure MCP tools
- Create directory structure

// New integration needed:
- TemplateManager.copyTemplates()
- ProjectDetector output
- QualityAnalyzer output
- RepositoryAuditor output
```

#### `/packages/@wundr/computer-setup/` → New Project Setup
```typescript
// Add to setupProjectTemplate():
- Use project-templates.ts factory
- Implement createProjectTemplates()
- Copy all configuration templates
- Generate Docker/GitHub/Slack configs
- Setup Claude Flow integration
```

---

## 13. Conclusion

The Wundr project initialization system is **comprehensive but fragmented**. Key improvements needed:

1. **Consolidate** two parallel setup implementations
2. **Integrate** agent and MCP tool templates with setup process
3. **Complete** directory structure and boilerplate files
4. **Enhance** CLAUDE.md generation with custom sections
5. **Test** complete setup workflow end-to-end

**Estimated Effort**: 40-60 hours for full integration and testing

**Priority**: High - affects all new project initialization

---

## Appendix A: File Paths Summary

### Setup Commands:
- `/Users/iroselli/wundr/src/cli/commands/claude-setup.ts` (374 lines)
- `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/claude-setup.ts` (697 lines)
- `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/setup.ts` (509 lines)
- `/Users/iroselli/wundr/setup/install.sh` (268 lines)

### Generator System:
- `/Users/iroselli/wundr/src/claude-generator/claude-config-generator.ts` (335 lines)
- `/Users/iroselli/wundr/src/claude-generator/template-engine.ts` (488 lines)
- `/Users/iroselli/wundr/src/claude-generator/project-detector.ts` (352 lines)
- `/Users/iroselli/wundr/src/claude-generator/quality-analyzer.ts` (248 lines)
- `/Users/iroselli/wundr/src/claude-generator/repository-auditor.ts` (418 lines)
- `/Users/iroselli/wundr/src/claude-generator/types.ts` (143 lines)

### Template System:
- `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/templates/template-manager.ts` (100+)
- `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/templates/project-templates.ts` (100+)
- `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template` (383 lines)

### Agent Templates:
- `/.claude/agents/templates/` (9 markdown files)

### Helper Scripts:
- `/.claude/helpers/github-setup.sh`
- `/.claude/helpers/setup-mcp.sh`

---

**Report Generated**: 2025-11-21
**Analyzer**: Code Quality Analyzer
**Status**: Complete
