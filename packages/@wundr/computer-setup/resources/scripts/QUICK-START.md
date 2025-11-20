# Claude Code Optimization - Quick Start

**Goal**: Make `claude` automatically use hardware-optimized settings.

---

## 🚀 **One-Time Setup (60 seconds)**

Run this once:

```bash
./scripts/setup-claude-optimization.sh
```

**What it does**:

1. Detects your shell (zsh/bash)
2. Adds configuration to `~/.zshrc` or `~/.bashrc`
3. Creates convenient aliases
4. Applies settings immediately

**After setup**, the `claude` command automatically uses:

- ✅ 14 GB heap (vs 4 GB default)
- ✅ Optimized V8 flags for LLM workloads
- ✅ Hardware-adaptive thread pool

---

## 💡 **Usage Patterns**

### **1. Interactive Mode (Recommended)**

```bash
# Launch with optimized settings
claude

# Launch with autonomous mode
claude --dangerously-skip-permissions
```

Then type your prompt naturally in the Claude Code interface.

### **2. Direct Prompt Mode**

```bash
# One-shot execution
claude -p "Refactor the authentication module"

# Autonomous one-shot
claude --dangerously-skip-permissions -p "Run all tests and fix failures"
```

### **3. Batch Orchestration**

```bash
# Create config
cat > tasks.json << 'EOF'
{
  "tasks": [
    {"id": "task-1", "prompt": "Add tests for auth service"},
    {"id": "task-2", "prompt": "Add tests for user service"}
  ],
  "concurrency": 7,
  "dangerouslySkipPermissions": true
}
EOF

# Run orchestrator
node scripts/orchestrator.js tasks.json
```

---

## 📋 **New Aliases Available**

After setup, you have these commands:

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `claude`          | Launch optimized Claude Code   |
| `claude-stats`    | View current hardware settings |
| `claude-cleanup`  | Clean up zombie processes      |
| `claude-validate` | Validate production-grade code |

---

## ✅ **Verification**

Check if setup worked:

```bash
# Should show 14 GB (not 4 GB)
node -e 'console.log((v8.getHeapStatistics().heap_size_limit / 1024 / 1024 / 1024).toFixed(2) + " GB")'

# Should show alias pointing to wrapper
which claude
# Output: claude: aliased to /Users/eli/adapticai/engine/scripts/claude-optimized
```

---

## 🎯 **Recommended Workflow**

### **For Exploration**

```bash
# Start interactive mode
claude

# In the Claude interface:
# > "Analyze the codebase architecture and identify technical debt"
```

### **For Automation**

```bash
# Launch autonomous mode
claude --dangerously-skip-permissions

# In the Claude interface:
# > "Run the test suite, fix all failures, and commit the changes"
```

### **For Massive Concurrency**

```bash
# Use orchestrator for 10+ parallel tasks
node scripts/orchestrator.js my-tasks.json
```

---

## 🔄 **What Changed?**

### **Before Setup**

```bash
claude -p "Task"
# ❌ Uses 4 GB heap (default)
# ❌ OOM crashes on large codebases
# ❌ Context limited to ~50k tokens
```

### **After Setup**

```bash
claude -p "Task"
# ✅ Uses 14 GB heap (adaptive)
# ✅ No OOM crashes
# ✅ Context supports ~350k tokens
```

---

## 🆘 **Troubleshooting**

### **Issue**: `claude` still shows old behavior

**Solution**:

```bash
# Reload shell config
source ~/.zshrc

# Or open a new terminal
```

### **Issue**: Alias not found

**Solution**:

```bash
# Check if setup ran
cat ~/.zshrc | grep claude-optimized

# If missing, run setup again
./scripts/setup-claude-optimization.sh
```

### **Issue**: Want to use original claude temporarily

**Solution**:

```bash
# Use full path
/Users/eli/.nvm/versions/node/v22.12.0/bin/claude

# Or disable alias temporarily
\claude
```

---

## 📊 **Performance Comparison**

| Metric        | Default `claude` | Optimized `claude` |
| ------------- | ---------------- | ------------------ |
| Heap Size     | 4 GB             | 14 GB              |
| Max Context   | ~50k tokens      | ~350k tokens       |
| OOM Frequency | High             | Rare               |
| Concurrency   | 2-3 tasks        | 7 tasks            |

---

**Next**: Read `scripts/README-ORCHESTRATION.md` for advanced usage patterns.
