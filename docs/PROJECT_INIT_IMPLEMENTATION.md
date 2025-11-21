# Project Initialization Implementation

## Overview

Complete implementation of project initialization system for creating and configuring projects with Claude Code integration, including .claude directory structure, templates, agents, workflows, and git-worktree configuration.

## Architecture

### Core Components

#### 1. ProjectInitializer
**Location:** `/packages/@wundr/computer-setup/src/project-init/project-initializer.ts`

**Responsibilities:**
- Orchestrates complete project initialization
- Creates .claude directory structure
- Copies and customizes templates
- Sets up git-worktree configuration
- Initializes agent workflows
- Creates project documentation
- Runs validation checks

**Key Methods:**
```typescript
async initialize(options: ProjectInitOptions): Promise<void>
async createClaudeDirectory(options: ProjectInitOptions): Promise<void>
async copyTemplates(options: ProjectInitOptions): Promise<void>
async setupGitWorktree(options: ProjectInitOptions): Promise<void>
async initializeAgentWorkflows(options: ProjectInitOptions): Promise<void>
async validateSetup(options: ProjectInitOptions): Promise<void>
```

**Directory Structure Created:**
```
.claude/
  ├── agents/
  │   ├── core/
  │   ├── specialized/
  │   ├── github/
  │   ├── testing/
  │   ├── swarm/
  │   ├── consensus/
  │   └── templates/
  ├── commands/
  │   ├── coordination/
  │   ├── monitoring/
  │   ├── hooks/
  │   ├── memory/
  │   ├── github/
  │   └── optimization/
  ├── hooks/
  │   ├── pre-task.sh
  │   ├── post-task.sh
  │   ├── pre-edit.sh
  │   ├── post-edit.sh
  │   ├── session-start.sh
  │   ├── session-end.sh
  │   └── hooks.config.json
  ├── conventions/
  │   ├── code-style.md
  │   ├── git-workflow.md
  │   ├── testing-standards.md
  │   └── documentation.md
  ├── workflows/
  │   ├── sparc-workflow.md
  │   ├── tdd-workflow.md
  │   └── review-workflow.md
  ├── templates/
  └── memory/
```

#### 2. TemplateSelector
**Location:** `/packages/@wundr/computer-setup/src/project-init/template-selector.ts`

**Responsibilities:**
- Intelligent template selection based on project characteristics
- Interactive template selection wizard
- Template matching algorithm
- Template validation

**Template Metadata Structure:**
```typescript
interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  projectTypes: string[];
  frameworks: string[];
  features: string[];
  agents: string[];
  workflows: string[];
  conventions: string[];
  complexity: 'basic' | 'intermediate' | 'advanced' | 'enterprise';
  requirements: {
    nodeVersion?: string;
    packageManager?: string[];
    tools?: string[];
  };
}
```

**Available Templates:**
1. **node-basic** - Simple Node.js project
2. **react-frontend** - Modern React application
3. **nextjs-fullstack** - Complete Next.js application
4. **monorepo-workspace** - Multi-package monorepo
5. **python-app** - Python project
6. **go-microservice** - Go-based microservice
7. **rust-app** - High-performance Rust application
8. **enterprise-backend** - Enterprise-grade backend

**Selection Algorithm:**
- Project type match (40% weight)
- Scale/complexity match (20% weight)
- Features match (30% weight)
- Team size appropriateness (10% weight)

#### 3. CustomizationEngine
**Location:** `/packages/@wundr/computer-setup/src/project-init/customization-engine.ts`

**Responsibilities:**
- Project-specific template customization
- Variable replacement in templates
- File-type specific customization
- Rule-based transformation

**Customization Rules:**
```typescript
interface CustomizationRule {
  id: string;
  name: string;
  description: string;
  condition: (context: TemplateContext) => boolean;
  apply: (content: string, context: TemplateContext) => string;
  priority: number;
}
```

**Built-in Rules:**
- **Global Rules:**
  - Update project metadata
  - Update dates

- **React Rules:**
  - Add React imports

- **Node.js Rules:**
  - Add Node.js shebang

- **TypeScript Rules:**
  - Enable strict mode

**File-Specific Customizations:**
- TypeScript/JavaScript files
- package.json
- Markdown files
- Configuration files (YAML/JSON)

#### 4. ValidationChecker
**Location:** `/packages/@wundr/computer-setup/src/project-init/validation-checker.ts`

**Responsibilities:**
- Comprehensive setup validation
- Directory structure verification
- File existence and content validation
- Configuration validation
- Auto-fix capabilities

**Validation Categories:**
1. **Directory Structure**
   - .claude directory and subdirectories
   - src, tests, docs, scripts

2. **Required Files**
   - CLAUDE.md
   - package.json
   - .gitignore
   - README.md

3. **File Contents**
   - CLAUDE.md sections
   - package.json structure
   - Essential scripts

4. **Configuration**
   - Hooks configuration
   - Worktree configuration

5. **Agent Setup**
   - Agent categories
   - Agent templates
   - Documentation

6. **Hooks**
   - Hook files
   - Execute permissions

7. **Git Setup**
   - Repository initialization
   - .gitignore

8. **Dependencies**
   - node_modules
   - Lock files

**Validation Report:**
```typescript
interface ValidationReport {
  timestamp: Date;
  projectPath: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  score: number;
}
```

## Usage Examples

### 1. Initialize New Project (Interactive)

```typescript
import { ProjectInitOrchestrator } from '@wundr/computer-setup/project-init';

const orchestrator = new ProjectInitOrchestrator();

await orchestrator.initializeProject({
  projectPath: '/path/to/new-project',
  projectName: 'my-awesome-app',
  interactive: true,
  autoFix: true
});
```

### 2. Setup Existing Project

```typescript
await orchestrator.setupExistingProject('/path/to/existing-project');
```

### 3. Validate Project

```typescript
await orchestrator.validateProject('/path/to/project', true);
```

### 4. Custom Template Selection

```typescript
import { TemplateSelector } from '@wundr/computer-setup/project-init';

const selector = new TemplateSelector();

const templates = await selector.selectTemplates({
  projectType: 'react',
  scale: 'medium',
  features: ['typescript', 'testing', 'cicd'],
  teamSize: 5
});

const template = templates[0];
```

### 5. Manual Customization

```typescript
import { CustomizationEngine } from '@wundr/computer-setup/project-init';

const engine = new CustomizationEngine();

await engine.customizeProject('/path/to/project', context);
```

### 6. Validation and Auto-fix

```typescript
import { ValidationChecker } from '@wundr/computer-setup/project-init';

const checker = new ValidationChecker();

const report = await checker.validate('/path/to/project');
await checker.autoFix('/path/to/project');
```

## Template Customization Procedures

### React Project
```typescript
{
  projectType: 'react',
  rules: [
    'update-metadata',
    'add-react-imports',
    'enable-ts-strict'
  ],
  filePatterns: ['**/*.tsx', '**/*.ts', '**/*.json', '**/*.md'],
  excludePatterns: ['**/node_modules/**', '**/dist/**']
}
```

### Node.js Project
```typescript
{
  projectType: 'node',
  rules: [
    'update-metadata',
    'add-node-shebang',
    'enable-ts-strict'
  ],
  filePatterns: ['**/*.ts', '**/*.js', '**/*.json', '**/*.md'],
  excludePatterns: ['**/node_modules/**', '**/dist/**']
}
```

### Monorepo
```typescript
{
  projectType: 'monorepo',
  rules: [
    'update-metadata',
    'update-dates'
  ],
  filePatterns: ['**/*.json', '**/*.md', '**/*.yaml'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**']
}
```

## Git-Worktree Configuration

### Configuration Structure
```json
{
  "version": "1.0.0",
  "worktrees": {
    "development": {
      "branch": "develop",
      "path": ".git-worktrees/develop",
      "autoSync": true
    },
    "staging": {
      "branch": "staging",
      "path": ".git-worktrees/staging",
      "autoSync": true
    },
    "production": {
      "branch": "main",
      "path": ".git-worktrees/main",
      "autoSync": false
    }
  },
  "hooks": {
    "post-checkout": true,
    "post-merge": true
  }
}
```

### Management Script
Located at: `scripts/manage-worktrees.sh`

**Features:**
- Create worktrees
- Switch between worktrees
- Sync worktrees
- Remove worktrees

## Agent Workflows

### SPARC Workflow
```json
{
  "name": "SPARC Workflow",
  "agents": ["specification", "pseudocode", "architecture", "refinement"],
  "steps": ["spec", "design", "implement", "test", "integrate"]
}
```

### TDD Workflow
```json
{
  "name": "TDD Workflow",
  "agents": ["tester", "coder", "reviewer"],
  "steps": ["test-first", "implement", "refactor"]
}
```

### Workflow Runner
Located at: `scripts/run-workflow.sh`

## Hooks System

### Pre-task Hook
- Prepares environment
- Validates prerequisites
- Sets up session

### Post-task Hook
- Runs quality checks
- Updates documentation
- Cleans up resources

### Pre-edit Hook
- Backs up files
- Validates permissions
- Prepares git state

### Post-edit Hook
- Runs formatters
- Validates syntax
- Updates indexes

### Session Hooks
- Session start: Initialize environment
- Session end: Cleanup and export metrics

## Validation Checks

### Critical Checks (Errors)
- .claude directory exists
- CLAUDE.md exists
- Required agent categories exist
- Package.json is valid (if exists)

### Important Checks (Warnings)
- Agent templates exist
- Hooks are executable
- Git repository initialized
- Documentation files exist

### Informational Checks (Info)
- Dependencies installed
- Lock file exists
- Configuration files valid

## Auto-fix Capabilities

The validation checker can automatically fix:
- Create missing directories
- Set executable permissions on hooks
- Initialize git repository
- Create missing configuration files

## Integration with Existing Commands

### claude-init Command
```bash
wundr claude-init --interactive
```

Uses ProjectInitOrchestrator to:
1. Select template interactively
2. Create .claude structure
3. Copy and customize templates
4. Validate setup
5. Auto-fix issues

### init project Command
```bash
wundr init project my-app --template react-frontend
```

Uses ProjectInitializer directly to:
1. Create project structure
2. Setup .claude directory
3. Initialize agents and workflows
4. Create documentation

## Best Practices

### 1. Always Use Interactive Mode for New Projects
```typescript
await orchestrator.initializeProject({
  projectPath: './new-project',
  projectName: 'new-project',
  interactive: true,  // Let user choose template
  autoFix: true       // Auto-fix validation issues
});
```

### 2. Validate After Manual Changes
```bash
wundr validate-project /path/to/project --auto-fix
```

### 3. Update Templates Periodically
```bash
wundr update-templates /path/to/project
```

### 4. Customize for Team Standards
Create custom customization rules for your team's standards.

### 5. Version Control .claude Directory
Always commit the .claude directory to version control.

## Troubleshooting

### Issue: Templates Not Customizing
**Solution:** Check that template context is properly configured with project metadata.

### Issue: Validation Failing
**Solution:** Run with `autoFix: true` or manually check reported issues.

### Issue: Hooks Not Executing
**Solution:** Ensure hooks have execute permissions (`chmod +x .claude/hooks/*.sh`).

### Issue: Agent Templates Missing
**Solution:** Re-run initialization with `force: true` option.

## Performance Considerations

- Template copying is I/O intensive - use SSD for best performance
- Validation runs ~50-100 checks - takes 1-2 seconds on average
- Customization engine uses parallel processing where possible
- Large monorepos may take 5-10 seconds for full initialization

## Future Enhancements

1. **Remote Template Repository**
   - Fetch templates from remote registry
   - Community-contributed templates

2. **Template Versioning**
   - Track template versions
   - Update templates independently

3. **Custom Template Creation**
   - CLI for creating custom templates
   - Template generator wizard

4. **AI-Powered Customization**
   - Use LLM for intelligent customization
   - Context-aware rule generation

5. **Cloud Sync**
   - Sync configurations across projects
   - Team template sharing

## Related Files

- `/packages/@wundr/computer-setup/src/project-init/` - Implementation
- `/packages/@wundr/computer-setup/resources/` - Template resources
- `/packages/@wundr/cli/src/commands/claude-init.ts` - CLI integration
- `/packages/@wundr/cli/src/commands/init.ts` - Init commands

## Testing

Run tests:
```bash
cd /Users/iroselli/wundr/packages/@wundr/computer-setup
npm test src/project-init/
```

## License

MIT License - See LICENSE file for details
