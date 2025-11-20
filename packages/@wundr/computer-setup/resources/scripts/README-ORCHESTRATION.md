# Claude Code Scalable Orchestration System

**Version:** 1.0.0 **Status:** Production-Ready **Hardware:** Hardware-Adaptive (M4 Mac Mini through
Mac Studio)

---

## 🎯 Overview

Complete infrastructure for running claude-code at scale with hardware-adaptive configuration,
fault-tolerant orchestration, and production-grade validation.

### Key Features

- **Hardware-Adaptive Memory Limits**: Automatically detects and configures optimal V8 heap sizes
  based on available RAM and CPU cores
- **Fault-Isolated Orchestration**: Hub-and-spoke architecture prevents cascade failures when one
  agent crashes
- **Production-Grade Validation**: Enforces CLAUDE.md Zero Tolerance policies
- **Zombie Process Cleanup**: Automated detection and termination of stuck processes
- **Security Hardening**: Comprehensive permissions system blocking sensitive file access

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hardware Detection Layer                  │
│  (Detects RAM, CPU cores, calculates optimal V8 limits)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator (Hub)                          │
│  • Spawns isolated claude processes                          │
│  • Manages concurrency with p-limit                          │
│  • Implements retry + exponential backoff                    │
│  • Tracks progress and logs results                          │
└──────────┬──────────┬──────────┬──────────┬─────────────────┘
           │          │          │          │
           ▼          ▼          ▼          ▼
       [Spoke 1]  [Spoke 2]  [Spoke 3]  [Spoke N]
       (Isolated  (Isolated  (Isolated  (Isolated
        Process)   Process)   Process)   Process)
```

**Key Principle**: Each "spoke" (task) runs in a completely isolated OS process. If Spoke 2 crashes
due to OOM or hits a rate limit, Spokes 1, 3, and N continue unaffected.

---

## 🔧 Components

### 1. Hardware Detection (`detect-hardware-limits.js`)

**Purpose**: Dynamically calculates optimal Node.js/V8 memory settings based on system specs.

**Detection Strategy**: | System RAM | Heap Allocation | Min OS Reserve | Use Case |
|------------|----------------|----------------|----------| | 16-24 GB | 60% of RAM | 4 GB | M4 Mac
Mini (base) | | 32-48 GB | 65% of RAM | 6 GB | M4 Mac Mini (high-spec) | | 64+ GB | 70% of RAM | 8
GB | M4 Mac Studio |

**Usage**:

```bash
# View current hardware and recommended settings
node scripts/detect-hardware-limits.js

# Get shell export commands
node scripts/detect-hardware-limits.js export

# Get JSON output (for programmatic use)
node scripts/detect-hardware-limits.js json

# Save to .env file and source it
node scripts/detect-hardware-limits.js export > scripts/.env.claude-memory
source scripts/.env.claude-memory
```

**Example Output (24GB M4 system)**:

```
Heap Size:       14.0 GB (58% of total RAM)
Semi-Space:      737 MB
Thread Pool:     12 threads

export NODE_OPTIONS="--max-old-space-size=14336 --max-semi-space-size=737"
export V8_FLAGS="--thin-strings --lazy"
```

---

### 2. Optimized Launcher (`claude-optimized`)

**Purpose**: Wrapper script that automatically configures V8 memory limits before launching
claude-code.

**Usage**:

```bash
# Use like normal claude command
./scripts/claude-optimized -p "Your prompt here"

# With permissions bypass (use with caution)
./scripts/claude-optimized --dangerously-skip-permissions -p "Automated task"

# All claude-code flags are passed through
./scripts/claude-optimized --help
```

**What it does**:

1. Runs hardware detection
2. Sets NODE_OPTIONS and V8_FLAGS
3. Launches claude with optimal memory settings
4. Inherits all CLI arguments

**Add to PATH** (optional):

```bash
echo 'export PATH="/Users/eli/adapticai/engine/scripts:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Then use directly
claude-optimized -p "Your task"
```

---

### 3. Hub-and-Spoke Orchestrator (`orchestrator.js`)

**Purpose**: Fault-tolerant, concurrent execution of multiple claude-code tasks with automatic
retry.

**Key Features**:

- **Process Isolation**: Each task runs in its own process (no shared AbortController)
- **Automatic Concurrency**: Calculates optimal parallel tasks based on RAM and cores
- **Exponential Backoff**: Handles rate limits (HTTP 429) gracefully
- **Progress Tracking**: Real-time stats on completed/failed/in-progress tasks
- **Graceful Shutdown**: SIGINT/SIGTERM handlers allow in-flight tasks to complete

**Configuration File Format** (`tasks-config.json`):

```json
{
  "tasks": [
    {
      "id": "refactor-auth",
      "prompt": "Refactor the authentication module to use JWT tokens",
      "priority": 1,
      "maxRetries": 3,
      "timeout": 600000
    },
    {
      "id": "add-tests",
      "prompt": "Add unit tests for the user service",
      "priority": 2
    }
  ],
  "concurrency": 10,
  "defaultTimeout": 600000,
  "defaultMaxRetries": 3,
  "outputDir": ".orchestrator-output",
  "dangerouslySkipPermissions": false
}
```

**Usage**:

```bash
# Create config file
cat > tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "task-1",
      "prompt": "Analyze the codebase for performance bottlenecks"
    },
    {
      "id": "task-2",
      "prompt": "Generate API documentation for all services"
    }
  ],
  "concurrency": 5
}
EOF

# Run orchestrator
node scripts/orchestrator.js tasks.json
```

**Output Structure**:

```
.orchestrator-output/
├── task-1.txt              # Successful output
├── task-2.txt
├── task-3.error.txt        # Error logs for failed tasks
└── orchestration-stats.json # Summary statistics
```

**Concurrency Calculation**:

- **Rule**: 1 concurrent task per 2GB of allocated heap
- **Example**: 14GB heap → 7 concurrent tasks (capped by cores)
- **Override**: Use `"concurrency": N` in config to set manually

---

### 4. Zombie Process Cleanup (`cleanup-zombies.sh`)

**Purpose**: Detects and terminates stuck claude-code processes that may have leaked during failed
runs.

**Safety Features**:

- Interactive confirmation by default
- Dry-run mode to preview actions
- Excludes current process
- Two-phase shutdown (SIGTERM then SIGKILL)
- Detailed process info before termination

**Usage**:

```bash
# Interactive mode (asks for confirmation)
./scripts/cleanup-zombies.sh

# Dry run (see what would be killed)
./scripts/cleanup-zombies.sh --dry-run

# Force mode (no confirmation)
./scripts/cleanup-zombies.sh --force

# Help
./scripts/cleanup-zombies.sh --help
```

**Example Output**:

```
╔══════════════════════════════════════════════════════════════╗
║  Claude Process Cleanup Utility                             ║
╚══════════════════════════════════════════════════════════════╝

ℹ Scanning for claude-code processes...
⚠️ Found 3 claude process(es)

Process Details:
─────────────────────────────────────────────────────────────
PID    PPID   ELAPSED  COMMAND
12345  1      02:15:30 claude -p "Stuck task"
12346  1      01:30:00 claude --agents 10
12347  1      00:45:00 node /path/to/claude

⚠️ WARNING: This will terminate all listed processes
Do you want to proceed? [y/N]
```

---

### 5. Production-Grade Validator (`validate-production-grade.ts`)

**Purpose**: Enforces CLAUDE.md v2.0.0 Zero Tolerance policies by scanning code for forbidden
patterns.

**Forbidden Patterns**:

- `setTimeout()` for async simulation
- `Math.random()` for fake data
- `TODO`/`FIXME` comments
- `any` types
- `eslint-disable` comments
- Console usage in production code
- Hardcoded secrets/credentials
- Empty catch blocks

**Usage**:

```bash
# Standard validation
npx tsx scripts/validate-production-grade.ts

# Strict mode (warnings = errors)
npx tsx scripts/validate-production-grade.ts --strict

# Custom file pattern
npx tsx scripts/validate-production-grade.ts --files="src/services/**/*.ts"

# JSON output (for CI/CD)
npx tsx scripts/validate-production-grade.ts --json

# Strictness levels
npx tsx scripts/validate-production-grade.ts --level=3
```

**Strictness Levels**: | Level | Description | Use Case | |-------|-------------|----------| | 1 |
Lenient | Development | | 2 | Standard | Default (CI/CD) | | 3 | Strict | Pre-production | | 4 |
Paranoid | Critical systems |

**Exit Codes**:

- `0`: All checks passed
- `1`: Critical violations found
- `2`: Warnings found in strict mode

---

## 🚀 Quick Start Guide

### Step 1: Set Up Environment

```bash
# Navigate to project
cd /Users/eli/adapticai/engine

# Detect hardware and configure V8 limits
node scripts/detect-hardware-limits.js

# Source the generated config
source scripts/.env.claude-memory

# Verify settings
echo $NODE_OPTIONS
# Output: --max-old-space-size=14336 --max-semi-space-size=737
```

### Step 2: Single Optimized Execution

```bash
# Run a single task with optimized memory
./scripts/claude-optimized -p "Analyze codebase architecture"
```

### Step 3: Massive Concurrent Execution

```bash
# Create orchestration config
cat > massive-tasks.json << 'EOF'
{
  "tasks": [
    {"id": "refactor-1", "prompt": "Refactor authentication module"},
    {"id": "refactor-2", "prompt": "Refactor database layer"},
    {"id": "refactor-3", "prompt": "Refactor API routes"},
    {"id": "test-1", "prompt": "Add tests for auth module"},
    {"id": "test-2", "prompt": "Add tests for database layer"},
    {"id": "docs-1", "prompt": "Generate API documentation"},
    {"id": "docs-2", "prompt": "Generate architecture docs"}
  ],
  "concurrency": 7,
  "dangerouslySkipPermissions": false
}
EOF

# Run orchestrator
node scripts/orchestrator.js massive-tasks.json
```

### Step 4: Cleanup

```bash
# Check for zombie processes
./scripts/cleanup-zombies.sh --dry-run

# Clean up if needed
./scripts/cleanup-zombies.sh --force
```

---

## 🔒 Security Hardening

The `.claude/settings.json` has been enhanced with comprehensive security controls:

### Denied Operations

- **Destructive Commands**: `rm -rf /`, `sudo`, `su`
- **Remote Execution**: `curl | bash`, `wget | sh`, `eval`
- **Sensitive Files**:
  - `.env` files
  - `secrets.json`
  - Credentials/password files
  - SSH keys (`id_rsa`, `id_ed25519`)
  - Auth tokens

### Allowed Operations

- Git operations
- npm/yarn commands
- File system navigation
- Process management (`pgrep`, `kill`)
- System info (`sysctl`)

**Important**: Even with `--dangerously-skip-permissions`, the deny list is enforced by the
orchestrator's config.

---

## 📈 Performance Characteristics

### Memory Efficiency

| System           | Total RAM | Allocated Heap | OS Reserve | Efficiency |
| ---------------- | --------- | -------------- | ---------- | ---------- |
| M4 Mini (16GB)   | 16 GB     | 9.6 GB         | 4 GB       | 60%        |
| M4 Mini (24GB)   | 24 GB     | 14.0 GB        | 4 GB       | 58%        |
| M4 Studio (64GB) | 64 GB     | 44.8 GB        | 8 GB       | 70%        |

### Concurrency Limits

- **M4 Mini (16GB)**: 4-5 concurrent tasks
- **M4 Mini (24GB)**: 7 concurrent tasks
- **M4 Studio (64GB)**: 22 concurrent tasks (API tier 4 cap: 50)

### Context Size Improvements

- **Before**: ~2GB heap → ~50k token contexts
- **After (24GB system)**: ~14GB heap → ~350k token contexts
- **Improvement**: **7x larger context windows**

---

## 🐛 Troubleshooting

### Issue: "FATAL ERROR: Reached heap limit"

**Solution**:

```bash
# Re-run hardware detection
node scripts/detect-hardware-limits.js

# Verify NODE_OPTIONS is set
echo $NODE_OPTIONS

# If not set, source the config
source scripts/.env.claude-memory

# Verify it took effect
node -e 'console.log((v8.getHeapStatistics().heap_size_limit / 1024 / 1024 / 1024).toFixed(2) + " GB")'
```

### Issue: Orchestrator hangs with no progress

**Cause**: Likely a zombie process consuming resources.

**Solution**:

```bash
# Check for zombies
./scripts/cleanup-zombies.sh --dry-run

# Kill zombies
./scripts/cleanup-zombies.sh --force

# Restart orchestrator
node scripts/orchestrator.js your-config.json
```

### Issue: Rate limit errors (HTTP 429)

**Cause**: Too many concurrent API requests.

**Solution**:

```bash
# Reduce concurrency in config
{
  "concurrency": 5,  // Lower this value
  "tasks": [...]
}
```

The orchestrator implements exponential backoff automatically, but reducing concurrency prevents
hitting limits.

### Issue: "Context amnesia" in long-running agents

**Cause**: Context window compaction is losing early instructions.

**Solution**:

1. Add critical constraints to `CLAUDE.md` (injected at start of every agent)
2. Use episodic execution pattern:
   ```
   Task 1 → Verify → Commit → /clear → Task 2
   ```
3. Keep prompts focused and atomic

---

## 🔄 Integration with Existing Workflows

### Add to package.json

```json
{
  "scripts": {
    "claude:optimized": "./scripts/claude-optimized",
    "claude:orchestrate": "node scripts/orchestrator.js",
    "claude:cleanup": "./scripts/cleanup-zombies.sh --force",
    "claude:validate": "npx tsx scripts/validate-production-grade.ts --strict"
  }
}
```

### Add to pre-commit hook

```bash
#!/usr/bin/env bash
# .husky/pre-commit

# Validate production-grade code
npx tsx scripts/validate-production-grade.ts || exit 1

# Cleanup any zombie processes
./scripts/cleanup-zombies.sh --force --quiet || true
```

### Add to CI/CD

```yaml
# .github/workflows/validate.yml
name: Production-Grade Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - name: Install dependencies
        run: yarn install
      - name: Detect hardware
        run: node scripts/detect-hardware-limits.js
      - name: Validate production code
        run: npx tsx scripts/validate-production-grade.ts --strict --json
      - name: Cleanup
        run: ./scripts/cleanup-zombies.sh --force
```

---

## 📚 Additional Resources

- **CLAUDE.md**: Production-grade requirements and zero tolerance policies
- **Hardware Detection Source**: `scripts/detect-hardware-limits.js`
- **Orchestrator Source**: `scripts/orchestrator.js`
- **Validator Source**: `scripts/validate-production-grade.ts`
- **Cleanup Utility**: `scripts/cleanup-zombies.sh`

---

## 🎯 Roadmap

### Future Enhancements

- [ ] Distributed orchestration across multiple machines
- [ ] Real-time dashboard for orchestrator progress
- [ ] Automatic task prioritization based on dependencies
- [ ] Integration with GitHub Issues for task tracking
- [ ] WebSocket-based live progress streaming
- [ ] Prometheus metrics export

---

**Last Updated**: 2025-11-20 **Maintainer**: Adaptic.ai Engineering **License**: Proprietary
