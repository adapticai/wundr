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

**Actions:**
- `index`: Create or update the vector index for specified paths
- `update`: Incrementally update changed files only
- `clear`: Remove all indexed data
- `status`: Show current index statistics

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

### Example Workflows

#### Finding Authentication Implementation
```
// Step 1: Find auth-related code
mcp__wundr__rag_file_search { query: "user authentication and session management" }

// Step 2: Build context around auth module
mcp__wundr__rag_context_builder { entry_point: "src/auth/index.ts", depth: 3 }
```

#### Understanding a Feature
```
// Find all code related to a feature
mcp__wundr__rag_file_search {
  query: "shopping cart add item and update quantity",
  include_context: true
}
```

#### Debugging an Error
```
// Search for similar error handling
mcp__wundr__rag_file_search {
  query: "TypeError: Cannot read property of undefined handling",
  file_types: ["ts", "tsx"]
}
```

#### Code Migration Preparation
```
// Find all usages of deprecated pattern
mcp__wundr__rag_file_search {
  query: "legacy API client usage patterns",
  max_results: 20
}
```

### Best Practices

1. **Index Before Searching**: Ensure your codebase is indexed before using RAG search
2. **Specific Queries**: More specific queries yield better results
3. **Adjust Thresholds**: Lower similarity_threshold for broader searches
4. **Combine with Traditional Tools**: Use RAG for discovery, Grep for verification
5. **Regular Index Updates**: Run `update` action after significant code changes
