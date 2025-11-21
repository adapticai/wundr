# Claude Code Configuration - SPARC Development Environment with MCP Tools

## 🚨 CRITICAL: VERIFICATION PROTOCOL & REALITY CHECKS

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output  
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**NEVER claim completion without:**
- Actual terminal output proving it works
- Build command succeeding (`npm run build`, etc.)
- Tests passing (if applicable)
- The feature demonstrably working

**When something fails:**
1. Report immediately: "❌ FAILURE: [specific error]"
2. Show the actual error message
3. Do NOT continue pretending it worked
4. Do NOT claim partial success without verification

### VERIFICATION CHECKPOINTS

Before claiming ANY task complete:
- [ ] Does the build succeed? (show `npm run build` output)
- [ ] Do tests pass? (show test output)
- [ ] Can you run it? (show execution)
- [ ] Did you verify, not assume? (show proof)

### HONESTY REQUIREMENTS

You MUST:
- Test every claim with actual commands
- Show real terminal output (not fictional)
- Say "I cannot verify this" if you can't test it
- Report failures immediately and clearly
- Track all failures in a list

You MUST NOT:
- Assume code works without testing
- Create fictional success messages
- Claim completion without verification
- Hide, minimize, or gloss over failures
- Generate imaginary terminal output

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **ALWAYS VERIFY before claiming success**

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL:
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY:
- Coordination and planning
- Memory management
- Neural features
- Performance tracking
- Swarm orchestration
- GitHub integration

**KEY**: MCP coordinates, Claude Code executes.

## 🚀 Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

## 📋 Agent Coordination Protocol

### Every Agent MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT (Single Message):
```javascript
[BatchTool]:
  // Initialize swarm
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }
  
  // Spawn agents with Task tool
  Task("Research agent: Analyze requirements...")
  Task("Coder agent: Implement features...")
  Task("Tester agent: Create test suite...")
  
  // Batch todos
  TodoWrite { todos: [
    {id: "1", content: "Research", status: "in_progress", priority: "high"},
    {id: "2", content: "Design", status: "pending", priority: "high"},
    {id: "3", content: "Implement", status: "pending", priority: "high"},
    {id: "4", content: "Test", status: "pending", priority: "medium"},
    {id: "5", content: "Document", status: "pending", priority: "low"}
  ]}
  
  // File operations
  Bash "mkdir -p app/{src,tests,docs}"
  Write "app/src/index.js"
  Write "app/tests/index.test.js"
  Write "app/docs/README.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## 🔧 Wundr MCP Tools Integration

### Available MCP Tools for Claude Code

The Wundr toolkit provides powerful MCP tools for governance and code quality:

1. **drift_detection** - Monitor code quality drift
   - "Check for code drift"
   - "Create drift baseline"
   - "Show drift trends"

2. **pattern_standardize** - Auto-fix code patterns
   - "Standardize error handling"
   - "Fix import ordering"
   - "Review patterns needing attention"

3. **monorepo_manage** - Monorepo management
   - "Initialize monorepo"
   - "Add new package"
   - "Check circular dependencies"

4. **governance_report** - Generate reports
   - "Create weekly report"
   - "Show compliance status"
   - "Generate quality metrics"

5. **dependency_analyze** - Analyze dependencies
   - "Find circular dependencies"
   - "Show unused packages"
   - "Create dependency graph"

6. **test_baseline** - Manage test coverage
   - "Create coverage baseline"
   - "Compare against baseline"
   - "Update test metrics"

7. **claude_config** - Configure Claude Code
   - "Generate CLAUDE.md"
   - "Set up hooks"
   - "Create conventions"

### Quick MCP Setup

```bash
# Install MCP tools
cd mcp-tools && ./install.sh

# Verify installation
claude mcp list
```

### Example Workflows

**Daily Quality Check:**
"Run my daily quality check: detect drift, check dependencies, and show coverage"

**Pre-Commit Validation:**
"Make sure my code meets all standards before I commit"

**Weekly Maintenance:**
"Run weekly maintenance: create baseline, generate report, clean dependencies"

## 🔍 RAG File Search Tools

Semantic search tools for intelligent codebase exploration using vector embeddings.

### Available RAG Tools

1. **rag_file_search** - Semantic search across codebases
   - "Find authentication implementations"
   - "Search for error handling patterns"
   - "Locate API endpoint definitions"

2. **rag_store_manage** - Manage vector stores
   - "Create vector store for project"
   - "Update store with new files"
   - "List available stores"
   - "Delete outdated store"

3. **rag_context_builder** - Build optimized context
   - "Build context for feature implementation"
   - "Gather related code for refactoring"
   - "Assemble context for bug investigation"

### Example Usage Patterns

```bash
# Semantic search for authentication code
rag_file_search { query: "user authentication flow", limit: 10 }

# Create/update vector store for a project
rag_store_manage { action: "create", path: "./src" }
rag_store_manage { action: "update", store_id: "project-store" }

# Build optimized context for a task
rag_context_builder {
  query: "implement rate limiting",
  max_tokens: 8000,
  include_tests: true
}
```

### When to Use RAG vs Regular Search

| Use RAG When | Use Regular Search (Grep/Glob) When |
|--------------|-------------------------------------|
| Searching by concept or intent | Searching for exact text matches |
| Finding similar implementations | Finding specific function names |
| Exploring unfamiliar codebases | Navigating known file structures |
| Building context for complex tasks | Quick file lookups |
| Semantic code understanding | Pattern matching with regex |

**KEY**: RAG finds conceptually related code; Grep/Glob finds exact matches.

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
- Wundr MCP Guide: docs/CLAUDE_CODE_MCP_INTEGRATION.md

---

Remember: **Claude Flow coordinates, Claude Code creates, Wundr ensures quality!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
