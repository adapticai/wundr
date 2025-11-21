# Claude Code Configuration - Global Template

This template provides a comprehensive CLAUDE.md structure for projects using Wundr MCP tools.

---

## Verification Protocol

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: If something fails, report immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

### Verification Checkpoints

Before claiming ANY task complete:
- [ ] Does the build succeed?
- [ ] Do tests pass?
- [ ] Can you run it?
- [ ] Did you verify, not assume?

---

## File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

---

## Wundr MCP Tools Integration

### Core Governance Tools

1. **drift_detection** - Monitor code quality drift
2. **pattern_standardize** - Auto-fix code patterns
3. **monorepo_manage** - Monorepo management
4. **governance_report** - Generate reports
5. **dependency_analyze** - Analyze dependencies
6. **test_baseline** - Manage test coverage
7. **claude_config** - Configure Claude Code

### Quick MCP Setup

```bash
# Install MCP tools
cd mcp-tools && ./install.sh

# Verify installation
claude mcp list
```

---

## RAG File Search Integration

RAG (Retrieval-Augmented Generation) enables intelligent codebase search using semantic understanding. Instead of simple text matching, RAG understands code context, patterns, and relationships.

### Available RAG Tools

The Wundr MCP toolkit provides three RAG tools for enhanced codebase intelligence:

#### 1. `mcp__wundr__rag_file_search` - Semantic Code Search

Search your codebase using natural language queries with semantic understanding.

**Parameters:**
- `query` (required): Natural language search query
- `file_types`: Array of file extensions to search (e.g., `["ts", "tsx", "js"]`)
- `max_results`: Maximum number of results (default: 10)
- `include_context`: Include surrounding code context (default: true)
- `similarity_threshold`: Minimum relevance score 0-1 (default: 0.7)

**Example Usage:**
```
mcp__wundr__rag_file_search {
  query: "authentication middleware that validates JWT tokens",
  file_types: ["ts", "js"],
  max_results: 5,
  include_context: true
}
```

#### 2. `mcp__wundr__rag_store_manage` - Index Management

Manage the RAG vector store for your codebase.

**Parameters:**
- `action`: One of `index`, `update`, `clear`, `status`
- `paths`: Array of paths to index (for `index` action)
- `exclude_patterns`: Glob patterns to exclude
- `force_reindex`: Force complete reindexing (default: false)

**Example Usage:**
```
mcp__wundr__rag_store_manage {
  action: "index",
  paths: ["src/", "lib/"],
  exclude_patterns: ["*.test.ts", "*.spec.ts", "node_modules/**"]
}
```

#### 3. `mcp__wundr__rag_context_builder` - Context Assembly

Build comprehensive context from multiple related code sections.

**Parameters:**
- `entry_point`: Starting file or function name
- `depth`: How many levels of dependencies to include (default: 2)
- `include_tests`: Include related test files (default: false)
- `include_types`: Include type definitions (default: true)
- `max_tokens`: Maximum context size in tokens (default: 8000)

**Example Usage:**
```
mcp__wundr__rag_context_builder {
  entry_point: "src/auth/middleware.ts",
  depth: 2,
  include_tests: true,
  include_types: true
}
```

### When to Use RAG

**Use RAG Search When:**
- Finding code by functionality rather than exact text
- Locating implementations of specific patterns or concepts
- Understanding how a feature is implemented across multiple files
- Searching for error handling patterns
- Finding similar code implementations
- Debugging unfamiliar codebases

**Use Traditional Search (Grep/Glob) When:**
- Looking for exact string matches
- Finding specific variable or function names
- Searching for TODO comments or markers
- Simple file name lookups

### RAG-Powered Error Debugging

When encountering errors, use RAG to find relevant context:

**Step 1: Search for Error Context**
```
mcp__wundr__rag_file_search {
  query: "error handling for database connection failures",
  max_results: 5
}
```

**Step 2: Build Related Context**
```
mcp__wundr__rag_context_builder {
  entry_point: "[file from search results]",
  depth: 2,
  include_types: true
}
```

**Step 3: Find Similar Patterns**
```
mcp__wundr__rag_file_search {
  query: "how other modules handle [error type]",
  similarity_threshold: 0.6
}
```

---

## Example Workflows

**Daily Quality Check:**
"Run my daily quality check: detect drift, check dependencies, and show coverage"

**Pre-Commit Validation:**
"Make sure my code meets all standards before I commit"

**Weekly Maintenance:**
"Run weekly maintenance: create baseline, generate report, clean dependencies"

**RAG-Powered Code Discovery:**
"Find all implementations related to user authentication"

---

## Build Commands

- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

---

## Important Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation unless requested
- Never save working files to the root folder
