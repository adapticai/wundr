## Project RAG Configuration

This section configures RAG (Retrieval-Augmented Generation) for project-specific codebase intelligence.

### RAG Index Settings

```yaml
# RAG Configuration
rag:
  enabled: true
  auto_index: true
  index_paths:
    - src/
    - lib/
    - packages/
  exclude_patterns:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/build/**"
    - "**/.git/**"
  similarity_threshold: 0.7
  max_context_tokens: 8000
```

### Quick RAG Commands

**Index Management:**
```
# Index the codebase
mcp__wundr__rag_store_manage { action: "index", paths: ["src/", "lib/"] }

# Check index status
mcp__wundr__rag_store_manage { action: "status" }

# Update index (incremental)
mcp__wundr__rag_store_manage { action: "update" }

# Clear and rebuild index
mcp__wundr__rag_store_manage { action: "clear" }
mcp__wundr__rag_store_manage { action: "index", paths: ["src/"], force_reindex: true }
```

**Semantic Search:**
```
# Find implementations by concept
mcp__wundr__rag_file_search { query: "your search query here" }

# Search specific file types
mcp__wundr__rag_file_search {
  query: "your query",
  file_types: ["ts", "tsx"]
}

# Broader search with lower threshold
mcp__wundr__rag_file_search {
  query: "your query",
  similarity_threshold: 0.5,
  max_results: 20
}
```

**Context Building:**
```
# Build context from entry point
mcp__wundr__rag_context_builder {
  entry_point: "src/index.ts",
  depth: 2
}

# Include tests in context
mcp__wundr__rag_context_builder {
  entry_point: "src/feature/index.ts",
  depth: 3,
  include_tests: true
}
```

### Pre-Indexed Patterns

<!--
Configure commonly searched patterns for this project.
These patterns are automatically indexed with higher priority.
-->

#### Core Modules
```
# PLACEHOLDER: Add your core module patterns
# Example:
# - "authentication and authorization flow"
# - "database connection and query handling"
# - "API route handlers and middleware"
```

#### Common Search Queries
```
# PLACEHOLDER: Add frequently used search queries
# Example:
# - "error handling patterns"
# - "validation logic"
# - "state management"
```

#### Architecture Patterns
```
# PLACEHOLDER: Add architecture-specific patterns
# Example:
# - "service layer implementations"
# - "repository pattern usage"
# - "dependency injection setup"
```

### Project-Specific RAG Workflows

#### Feature Development
```
# 1. Find related existing implementations
mcp__wundr__rag_file_search { query: "[feature description]" }

# 2. Build context around similar features
mcp__wundr__rag_context_builder { entry_point: "[related file]", depth: 2 }

# 3. Identify patterns to follow
mcp__wundr__rag_file_search { query: "pattern for [feature type]" }
```

#### Bug Investigation
```
# 1. Search for error context
mcp__wundr__rag_file_search { query: "[error message or symptom]" }

# 2. Find related error handling
mcp__wundr__rag_file_search { query: "error handling in [module]" }

# 3. Build full context
mcp__wundr__rag_context_builder { entry_point: "[suspect file]", include_tests: true }
```

#### Code Review Preparation
```
# 1. Find similar implementations for comparison
mcp__wundr__rag_file_search { query: "[implementation pattern]" }

# 2. Check for consistency with existing code
mcp__wundr__rag_file_search { query: "[coding pattern] in codebase" }
```

### RAG Maintenance

**Daily:**
- Run incremental index update after significant changes

**Weekly:**
- Review index status and coverage
- Update exclude patterns if needed

**After Major Refactors:**
- Clear and rebuild index
- Update pre-indexed patterns

### Troubleshooting

**Low-Quality Search Results:**
- Lower the similarity_threshold
- Make queries more specific
- Ensure relevant paths are indexed

**Missing Files in Results:**
- Check exclude_patterns configuration
- Verify index_paths include the target directories
- Run index update

**Slow Searches:**
- Reduce max_results for faster responses
- Narrow file_types to relevant extensions
- Increase similarity_threshold to filter noise
