# @wundr.io/rag-utils

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Agentic RAG (Retrieval-Augmented Generation) utilities for the Wundr platform

@wundr.io/rag-utils provides intelligent document chunking, embedding generation, vector storage, and agentic retrieval capabilities for AI-powered code analysis. Built with TypeScript and optimized for code-aware operations with self-improving retrieval loops.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Components](#core-components)
  - [DocumentChunker](#documentchunker)
  - [EmbeddingService](#embeddingservice)
  - [VectorStore](#vectorstore)
  - [RetrievalService](#retrievalservice)
- [Agentic RAG System](#agentic-rag-system)
  - [AgenticRAGSystem](#agenticragsystem)
  - [Query Reformulation](#query-reformulation)
  - [Retrieval Critique](#retrieval-critique)
  - [Context Compaction](#context-compaction)
- [Chunking Strategies](#chunking-strategies)
- [Integration with JIT Tools and Context Engineering](#integration-with-jit-tools-and-context-engineering)
- [Configuration Reference](#configuration-reference)
- [Events](#events)
- [Types](#types)
- [License](#license)

## Features

- **Code-Aware Chunking**: Intelligent document chunking that respects function and class boundaries
- **Vector Embeddings**: Google GenAI integration for high-quality text embeddings
- **Semantic Search**: In-memory vector store with cosine, Euclidean, and dot product similarity
- **Agentic Retrieval**: Self-improving retrieval with iterative refinement
- **Query Reformulation**: Automatic query expansion and synonym replacement
- **Self-Critique**: Quality assessment with recommendations for improvement
- **Context Compaction**: Token-aware context management to prevent context rot
- **Event-Driven Architecture**: Monitor all operations with comprehensive events

## Installation

```bash
# npm
npm install @wundr.io/rag-utils

# yarn
yarn add @wundr.io/rag-utils

# pnpm
pnpm add @wundr.io/rag-utils
```

## Quick Start

### Basic RAG Pipeline

```typescript
import {
  DocumentChunker,
  EmbeddingService,
  VectorStore,
  RetrievalService,
  createRetrievalService,
} from '@wundr.io/rag-utils';

// Option 1: Use the high-level RetrievalService
const retrieval = createRetrievalService(process.env.GEMINI_API_KEY);

// Index files
await retrieval.indexFiles([
  { path: 'src/utils.ts', content: fileContent, language: 'typescript' },
]);

// Search for relevant code
const results = await retrieval.search('error handling function', { topK: 5 });

// Option 2: Use individual components
const chunker = new DocumentChunker({ maxTokens: 512 });
const chunks = await chunker.chunkDocument(code, 'src/index.ts', 'typescript');

const embeddings = new EmbeddingService();
embeddings.initialize(process.env.GEMINI_API_KEY);
const embeddedChunks = await embeddings.embedChunks(chunks);

const store = new VectorStore({ dimensions: 768 });
store.add(embeddedChunks);
```

### Agentic RAG with Self-Improvement

```typescript
import { AgenticRAGSystem, createAgenticRAGSystem } from '@wundr.io/rag-utils';

// Create agentic RAG system
const agenticRAG = createAgenticRAGSystem(process.env.GEMINI_API_KEY, {
  maxIterations: 3,
  targetQualityScore: 0.8,
  enableReformulation: true,
  enableCritique: true,
  enableCompaction: true,
});

// Index your codebase
await agenticRAG.indexFiles([
  { path: 'src/auth/login.ts', content: loginCode, language: 'typescript' },
  { path: 'src/auth/session.ts', content: sessionCode, language: 'typescript' },
]);

// Perform agentic retrieval with automatic refinement
const result = await agenticRAG.agenticRetrieve('user authentication flow');

console.log(`Quality Score: ${(result.qualityScore * 100).toFixed(1)}%`);
console.log(`Iterations: ${result.iterations.length}`);
console.log(`Target Achieved: ${result.targetAchieved}`);
console.log(`Summary: ${result.summary}`);

// Access compacted context for LLM prompts
if (result.compactedContext) {
  console.log(`Token Count: ${result.compactedContext.tokenCount}`);
  console.log(`Compression Ratio: ${result.compactedContext.compressionRatio}`);
}
```

## Core Components

### DocumentChunker

Code-aware document chunker that respects function and class boundaries for optimal retrieval.

```typescript
import { DocumentChunker, createChunker } from '@wundr.io/rag-utils';

const chunker = new DocumentChunker({
  maxTokens: 512,               // Maximum tokens per chunk
  minTokens: 50,                // Minimum tokens per chunk
  overlap: 50,                  // Token overlap between chunks
  preserveCodeBlocks: true,     // Keep code blocks intact
  respectFunctionBoundaries: true,  // Chunk at function boundaries
  respectClassBoundaries: true,     // Chunk at class boundaries
});

// Chunk a document
const chunks = await chunker.chunkDocument(
  content,        // File content
  'src/app.ts',   // Source file path
  'typescript',   // Language (optional)
);

// Each chunk contains:
// - id: Unique UUID identifier
// - content: The chunk text
// - metadata: { sourceFile, startLine, endLine, language, type, functionName, className, importStatements, exportStatements }
```

**Supported Languages:**
- TypeScript/JavaScript: Functions, arrow functions, classes
- Python: Functions (def), classes
- Generic: Basic function/class detection for other languages

### EmbeddingService

Generates vector embeddings using Google GenAI with retry logic and batch processing.

```typescript
import { EmbeddingService, createEmbeddingService } from '@wundr.io/rag-utils';

const service = createEmbeddingService(process.env.GEMINI_API_KEY, {
  model: 'text-embedding-004',  // Embedding model
  dimensions: 768,              // Vector dimensions
  batchSize: 100,               // Batch size for API calls
  maxRetries: 3,                // Retry attempts on failure
  timeout: 30000,               // Request timeout (ms)
});

// Generate embeddings
const embedding = await service.embedText('function to handle errors');
const embeddings = await service.embedTexts(['text1', 'text2', 'text3']);

// Embed document chunks
const embeddedChunks = await service.embedChunks(chunks);

// Listen to events
service.on('embedding:progress', (completed, total) => {
  console.log(`Progress: ${completed}/${total}`);
});
```

**Utility Functions:**

```typescript
import { cosineSimilarity, euclideanDistance, normalizeVector } from '@wundr.io/rag-utils';

const similarity = cosineSimilarity(vectorA, vectorB);  // Returns 0-1
const distance = euclideanDistance(vectorA, vectorB);
const normalized = normalizeVector(vector);
```

### VectorStore

In-memory vector storage with multiple similarity metrics and filtering capabilities.

```typescript
import { VectorStore, createVectorStore } from '@wundr.io/rag-utils';

const store = createVectorStore({
  dimensions: 768,              // Vector dimensions
  metric: 'cosine',             // 'cosine' | 'euclidean' | 'dotProduct'
  maxElements: 100000,          // Maximum stored vectors
});

// Add chunks (must have embeddings)
store.add(embeddedChunks);
store.addOne(singleChunk);

// Search by vector similarity
const results = store.search(queryEmbedding, 10, {
  sourceFiles: ['src/utils.ts'],
  languages: ['typescript'],
  types: ['code'],
  functionNames: ['handleError'],
});

// Search by content (keyword matching)
const matches = store.searchByContent('error handling', 10);

// Filter chunks by metadata
const filtered = store.filter({ languages: ['typescript'] });

// Manage store
const chunk = store.get(chunkId);
const all = store.getAll();
store.remove([id1, id2]);
store.clear();
console.log(`Store size: ${store.size()}`);

// Persistence
const data = store.export();
store.import(data);
```

### RetrievalService

High-level service combining chunking, embeddings, and search with reranking support.

```typescript
import { RetrievalService, createRetrievalService, formatSearchResults } from '@wundr.io/rag-utils';

const service = createRetrievalService(
  process.env.GEMINI_API_KEY,   // API key (optional, can call initialize() later)
  { maxTokens: 512 },           // Chunking options
  768,                          // Embedding dimensions
);

// Index files
const chunkCount = await service.indexFiles([
  { path: 'src/auth.ts', content: authCode, language: 'typescript' },
  { path: 'src/db.py', content: dbCode, language: 'python' },
]);

// Search with options
const results = await service.search('authentication middleware', {
  topK: 10,
  minScore: 0.7,
  includeMetadata: true,
  rerank: true,                 // Apply term-frequency reranking
  filter: { languages: ['typescript'] },
});

// Query by structure
const funcChunks = service.getChunksByFunction('authenticate');
const classChunks = service.getChunksByClass('UserService');
const fileChunks = service.getChunksByFile('src/auth.ts');

// Get statistics
const stats = service.getStats();
// { totalChunks, fileCount, languages, avgChunkSize }

// Manage index
service.removeFile('src/old.ts');
service.clear();

// Persistence
const indexData = service.exportIndex();
service.importIndex(indexData);

// Format results for display
const formatted = formatSearchResults(results);
console.log(formatted);  // Markdown-formatted results

// Access underlying components
const vectorStore = service.getVectorStore();
const embeddings = service.getEmbeddingService();
const chunker = service.getChunker();
```

## Agentic RAG System

The Agentic RAG system provides intelligent, self-directed retrieval that combines iterative retrieval, query reformulation, self-critique, and context compaction to achieve high-quality retrieval results.

### AgenticRAGSystem

The core agentic retrieval system that orchestrates all components.

```typescript
import { AgenticRAGSystem, createAgenticRAGSystem } from '@wundr.io/rag-utils';

const agenticRAG = new AgenticRAGSystem({
  maxIterations: 3,             // Maximum retrieval iterations
  targetQualityScore: 0.8,      // Target quality score to achieve (0-1)
  enableReformulation: true,    // Enable query reformulation
  enableCritique: true,         // Enable self-critique
  enableCompaction: true,       // Enable context compaction
  retrievalOptions: {
    topK: 10,
    minScore: 0.7,
  },
  reformulationConfig: {
    maxReformulations: 3,
    confidenceThreshold: 0.75,
  },
  critiqueConfig: {
    minRelevanceScore: 0.7,
    minCoverageScore: 0.6,
  },
  compactionConfig: {
    maxTokens: 8000,
    targetTokens: 4000,
  },
});

// Initialize with API key
agenticRAG.initialize(process.env.GEMINI_API_KEY);

// Index files
await agenticRAG.indexFiles(files);

// Perform agentic retrieval
const result = await agenticRAG.agenticRetrieve('authentication flow');

// Result structure:
// {
//   originalQuery: string,
//   finalQuery: string,
//   iterations: RetrievalIteration[],
//   results: SearchResult[],
//   compactedContext?: CompactedContext,
//   qualityScore: number,
//   targetAchieved: boolean,
//   totalDuration: number,
//   summary: string,
// }

// Listen to events
agenticRAG.on('agentic:iteration', (iteration) => {
  console.log(`Iteration ${iteration.iteration}: ${iteration.results.length} results`);
});

agenticRAG.on('agentic:critique', (critique) => {
  console.log(`Quality: ${critique.overallScore}, Acceptable: ${critique.isAcceptable}`);
});

agenticRAG.on('agentic:reformulation', (reformulation) => {
  console.log(`New query: ${reformulation.reformulatedQuery}`);
});
```

### Query Reformulation

Intelligent query reformulation based on context gaps and retrieval feedback.

```typescript
import { QueryReformulator, createQueryReformulator } from '@wundr.io/rag-utils';

const reformulator = new QueryReformulator({
  maxReformulations: 3,
  confidenceThreshold: 0.75,
  useSemanticExpansion: true,
  useTermExtraction: true,
  strategies: ['expand', 'narrow', 'rephrase', 'decompose', 'synonym'],
});

// Reformulate based on previous results
const result = await reformulator.reformulate(
  'auth flow',
  previousResults,
  { iteration: 1 }
);

console.log(result.reformulatedQuery);
// "user authentication flow login session management"

// Identify context gaps
const gaps = reformulator.identifyContextGaps('auth flow', previousResults);
// [
//   { type: 'low_coverage', description: '...', suggestedTerms: [...] },
//   { type: 'missing_concept', description: '...', suggestedTerms: [...] }
// ]

// Decompose complex queries
const subQueries = reformulator.decomposeQuery('authentication and database access');
// ["authentication", "database access"]

// Generate query variations for multi-query retrieval
const variations = reformulator.generateQueryVariations('auth flow', 3);
// ["auth flow", "auth flow login session", "authentication login", "flow auth implementation"]

// Extract related terms from results
const relatedTerms = reformulator.extractRelatedTerms(results);
```

**Reformulation Strategies:**

| Strategy | Description |
|----------|-------------|
| `expand` | Add related terms and synonyms |
| `narrow` | Add specific terms from results |
| `rephrase` | Reorder terms and add context hints |
| `decompose` | Split into sub-queries |
| `synonym` | Replace terms with synonyms |

**Context Gap Types:**

| Gap Type | Description |
|----------|-------------|
| `missing_concept` | Query terms not found in results |
| `low_coverage` | Insufficient results for comprehensive context |
| `ambiguity` | Results have low relevance scores |
| `specificity` | Query may be too broad |

### Retrieval Critique

Self-assessment of retrieval quality with recommendations for improvement.

```typescript
import { RetrievalCritic, createRetrievalCritic } from '@wundr.io/rag-utils';

const critic = new RetrievalCritic({
  minRelevanceScore: 0.7,
  minCoverageScore: 0.6,
  minDiversityScore: 0.5,
  maxRedundancyRatio: 0.3,
  deepAnalysis: true,
});

// Perform comprehensive critique
const critique = await critic.critique('auth flow', results);

console.log(`Overall Score: ${critique.overallScore}`);
console.log(`Acceptable: ${critique.isAcceptable}`);
console.log(`Needs Iteration: ${critique.needsIteration}`);
console.log(`Summary: ${critique.summary}`);
console.log(`Recommendations:`, critique.recommendations);
console.log(`Query Suggestions:`, critique.querySuggestions);

// Access individual dimensions
for (const dimension of critique.dimensions) {
  console.log(`${dimension.name}: ${dimension.score} (weight: ${dimension.weight})`);
  console.log(`  Issues:`, dimension.issues);
  console.log(`  Recommendations:`, dimension.recommendations);
}

// Analyze specific aspects
const relevance = critic.analyzeRelevance(query, results);
// { averageScore, distribution: { high, medium, low }, highlyRelevantIds, lowRelevanceIds }

const coverage = critic.analyzeCoverage(query, results);
// { conceptCoverage, coveredConcepts, missingConcepts, fileCoverage }

const redundancy = critic.analyzeRedundancy(results);
// { redundancyRatio, redundantGroups, uniqueRatio }

// Score individual results
const relevanceScore = critic.scoreRelevance(query, result);
```

**Quality Dimensions:**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Relevance | 0.4 | Average relevance score of results |
| Coverage | 0.3 | Coverage of query concepts in results |
| Diversity | 0.15 | Diversity of source files and content types |
| Redundancy | 0.15 | Uniqueness of information (inverse of redundancy) |

### Context Compaction

Token-aware context management to prevent context rot and maintain relevance.

```typescript
import { ContextCompactor, createContextCompactor } from '@wundr.io/rag-utils';

const compactor = new ContextCompactor({
  maxTokens: 8000,
  targetTokens: 4000,
  minRelevanceThreshold: 0.5,
  strategy: 'hybrid',           // 'truncate' | 'summarize' | 'prioritize' | 'deduplicate' | 'hybrid'
  preserveCodeBlocks: true,
  mergeRelatedChunks: true,
});

// Compact search results
const compacted = await compactor.compact(searchResults, {
  maxTokens: 8000,
  targetTokens: 4000,
  strategy: 'hybrid',
});

console.log(`Original Tokens: ${compacted.metadata.originalTokenCount}`);
console.log(`Final Tokens: ${compacted.tokenCount}`);
console.log(`Compression Ratio: ${(compacted.compressionRatio * 100).toFixed(1)}%`);
console.log(`Chunks Removed: ${compacted.chunksRemoved}`);
console.log(`Chunks Merged: ${compacted.chunksMerged}`);
console.log(`Techniques Applied:`, compacted.metadata.techniquesApplied);

// Access compacted chunks
for (const chunk of compacted.chunks) {
  console.log(`  ${chunk.chunk.metadata.sourceFile}: ${chunk.compactedTokens} tokens`);
  console.log(`  Relevance: ${chunk.relevanceScore}, Modified: ${chunk.wasModified}`);
}

// Manage context windows for conversations
const window = await compactor.updateContextWindow('session-123', newChunks, 8000);
console.log(`Window tokens: ${window.tokenCount}/${window.maxTokens}`);
console.log(`Window age: ${window.age} interactions`);

const existingWindow = compactor.getContextWindow('session-123');
compactor.clearContextWindow('session-123');

// Extract key information from chunks
const keyInfo = compactor.extractKeyInformation(compacted.chunks);
// { functions: [...], classes: [...], imports: [...], keyTerms: [...] }

// Generate summary of compacted context
const summary = compactor.generateContextSummary(compacted);
```

**Compaction Strategies:**

| Strategy | Description |
|----------|-------------|
| `truncate` | Remove chunks by relevance until within budget |
| `summarize` | Extract important lines from chunks |
| `prioritize` | Keep highest relevance chunks within budget |
| `deduplicate` | Remove duplicate and near-duplicate chunks |
| `hybrid` | Apply all strategies in stages |

## Chunking Strategies

The chunker supports multiple strategies for breaking down code into retrievable pieces:

### Structure-Aware Chunking (Default)

When `respectFunctionBoundaries` or `respectClassBoundaries` is enabled, the chunker:

1. Detects function and class declarations using language-specific patterns
2. Identifies block boundaries (braces for JS/TS, indentation for Python)
3. Creates chunks that preserve complete logical units
4. Extracts metadata like function names, class names, imports, and exports

```typescript
const chunks = await chunker.chunkDocument(code, 'src/auth.ts', 'typescript');
// Results in chunks aligned to function/class boundaries

// Chunk metadata includes:
// - functionName: "authenticate"
// - className: "AuthService"
// - importStatements: ["import { User } from './models'"]
// - exportStatements: ["export function authenticate"]
```

### Token-Based Chunking

When structure-aware chunking is disabled, uses token-based splitting:

```typescript
const chunker = new DocumentChunker({
  maxTokens: 512,
  minTokens: 50,
  overlap: 50,                        // Token overlap between chunks
  respectFunctionBoundaries: false,
  respectClassBoundaries: false,
});
```

### Content Type Detection

Chunks are automatically classified by content type:

| Type | Description |
|------|-------------|
| `code` | Less than 20% comments |
| `mixed` | 20-50% comments |
| `documentation` | 50-80% comments |
| `comment` | More than 80% comments |

## Integration with JIT Tools and Context Engineering

@wundr.io/rag-utils is designed to integrate with Just-In-Time (JIT) context engineering pipelines for AI agents.

### Building Dynamic Context

```typescript
import { AgenticRAGSystem, ContextCompactor } from '@wundr.io/rag-utils';

// Create a JIT context builder
async function buildContextForTask(
  agenticRAG: AgenticRAGSystem,
  taskDescription: string,
  maxContextTokens: number = 8000
): Promise<string> {
  // Perform agentic retrieval
  const result = await agenticRAG.agenticRetrieve(taskDescription);

  // Get compacted context
  const context = result.compactedContext;
  if (!context) {
    return '';
  }

  // Generate context summary for LLM
  const summary = agenticRAG.getContextSummary(context);

  // Build context string
  const contextParts: string[] = [
    `## Context Summary\n${summary}\n`,
  ];

  for (const chunk of context.chunks) {
    contextParts.push(
      `### ${chunk.chunk.metadata.sourceFile}:${chunk.chunk.metadata.startLine}-${chunk.chunk.metadata.endLine}`,
      '```' + (chunk.chunk.metadata.language || ''),
      chunk.compactedContent,
      '```',
      ''
    );
  }

  return contextParts.join('\n');
}
```

### Multi-Turn Conversation Context Management

```typescript
import { ContextCompactor, AgenticRAGSystem } from '@wundr.io/rag-utils';

class ConversationContextManager {
  private compactor: ContextCompactor;
  private agenticRAG: AgenticRAGSystem;

  constructor(agenticRAG: AgenticRAGSystem) {
    this.agenticRAG = agenticRAG;
    this.compactor = agenticRAG.getComponents().compactor;
  }

  async updateContext(
    conversationId: string,
    userQuery: string,
    maxTokens: number = 8000
  ): Promise<string> {
    // Retrieve relevant context for the query
    const result = await this.agenticRAG.agenticRetrieve(userQuery);

    // Convert to compacted chunks
    const newChunks = result.compactedContext?.chunks || [];

    // Update the context window (auto-compacts on overflow)
    const window = await this.compactor.updateContextWindow(
      conversationId,
      newChunks,
      maxTokens
    );

    // Build context for LLM
    return this.buildContextString(window);
  }

  private buildContextString(window: ContextWindow): string {
    return window.chunks
      .map(c => `// ${c.chunk.metadata.sourceFile}\n${c.compactedContent}`)
      .join('\n\n');
  }
}
```

### Integration with Tool Calling

```typescript
// Define RAG as a tool for AI agents
const ragSearchTool = {
  name: 'search_codebase',
  description: 'Search the codebase for relevant code snippets',
  parameters: {
    query: { type: 'string', description: 'Semantic search query' },
    topK: { type: 'number', description: 'Number of results', default: 5 },
  },
  execute: async (params: { query: string; topK?: number }) => {
    const result = await agenticRAG.agenticRetrieve(params.query, {
      topK: params.topK || 5,
    });

    return {
      qualityScore: result.qualityScore,
      iterations: result.iterations.length,
      results: result.results.map(r => ({
        file: r.chunk.metadata.sourceFile,
        lines: `${r.chunk.metadata.startLine}-${r.chunk.metadata.endLine}`,
        score: r.score,
        content: r.chunk.content.slice(0, 500),
      })),
    };
  },
};
```

## Configuration Reference

### ChunkingOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTokens` | `number` | `512` | Maximum tokens per chunk |
| `minTokens` | `number` | `50` | Minimum tokens per chunk |
| `overlap` | `number` | `50` | Token overlap between chunks |
| `preserveCodeBlocks` | `boolean` | `true` | Keep code blocks intact |
| `respectFunctionBoundaries` | `boolean` | `true` | Chunk at function boundaries |
| `respectClassBoundaries` | `boolean` | `true` | Chunk at class boundaries |

### EmbeddingConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | `'text-embedding-004'` | Google GenAI model |
| `dimensions` | `number` | `768` | Embedding vector dimensions |
| `batchSize` | `number` | `100` | Texts per API batch |
| `maxRetries` | `number` | `3` | Retry attempts on failure |
| `timeout` | `number` | `30000` | Request timeout (ms) |

### VectorStoreConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dimensions` | `number` | `768` | Vector dimensions |
| `metric` | `string` | `'cosine'` | Distance metric |
| `maxElements` | `number` | `100000` | Max stored vectors |

### RetrievalOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `topK` | `number` | `10` | Number of results |
| `minScore` | `number` | `0.7` | Minimum similarity score |
| `includeMetadata` | `boolean` | `true` | Include full metadata |
| `rerank` | `boolean` | `false` | Apply reranking |
| `filter` | `ChunkFilter` | - | Filter criteria |

### AgenticRAGConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxIterations` | `number` | `3` | Maximum retrieval iterations |
| `targetQualityScore` | `number` | `0.8` | Target quality to achieve |
| `enableReformulation` | `boolean` | `true` | Enable query reformulation |
| `enableCritique` | `boolean` | `true` | Enable self-critique |
| `enableCompaction` | `boolean` | `true` | Enable context compaction |
| `retrievalOptions` | `object` | `{}` | Retrieval options |
| `reformulationConfig` | `object` | `{}` | Reformulation config |
| `critiqueConfig` | `object` | `{}` | Critique config |
| `compactionConfig` | `object` | `{}` | Compaction config |

### QueryReformulationConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxReformulations` | `number` | `3` | Max reformulation attempts |
| `confidenceThreshold` | `number` | `0.75` | Min confidence for results |
| `useSemanticExpansion` | `boolean` | `true` | Use semantic expansion |
| `useTermExtraction` | `boolean` | `true` | Use term extraction |
| `strategies` | `string[]` | `['expand', 'narrow', 'rephrase', 'decompose']` | Reformulation strategies |

### RetrievalCritiqueConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minRelevanceScore` | `number` | `0.7` | Min acceptable relevance |
| `minCoverageScore` | `number` | `0.6` | Min acceptable coverage |
| `minDiversityScore` | `number` | `0.5` | Min acceptable diversity |
| `maxRedundancyRatio` | `number` | `0.3` | Max allowed redundancy |
| `deepAnalysis` | `boolean` | `true` | Perform deep analysis |

### ContextCompactionConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTokens` | `number` | `8000` | Max tokens in context |
| `targetTokens` | `number` | `4000` | Target token count |
| `minRelevanceThreshold` | `number` | `0.5` | Min relevance to keep |
| `strategy` | `string` | `'hybrid'` | Compaction strategy |
| `preserveCodeBlocks` | `boolean` | `true` | Preserve code blocks |
| `mergeRelatedChunks` | `boolean` | `true` | Merge related chunks |

## Events

All services emit events for monitoring and integration:

### EmbeddingService Events

```typescript
embeddings.on('embedding:start', (batchSize) => {});
embeddings.on('embedding:progress', (completed, total) => {});
embeddings.on('embedding:complete', (totalEmbeddings) => {});
embeddings.on('embedding:error', (error) => {});
```

### VectorStore Events

```typescript
store.on('store:add', (count) => {});
store.on('store:remove', (count) => {});
store.on('store:search', (query, results) => {});
store.on('store:clear', () => {});
```

### RetrievalService Events

```typescript
retrieval.on('retrieval:index:start', (fileCount) => {});
retrieval.on('retrieval:index:progress', (processed, total) => {});
retrieval.on('retrieval:index:complete', (chunkCount) => {});
retrieval.on('retrieval:search:start', (query) => {});
retrieval.on('retrieval:search:complete', (resultCount) => {});
retrieval.on('retrieval:error', (error) => {});
```

### AgenticRAGSystem Events

```typescript
agenticRAG.on('agentic:start', (query) => {});
agenticRAG.on('agentic:iteration', (iteration) => {});
agenticRAG.on('agentic:reformulation', (result) => {});
agenticRAG.on('agentic:critique', (result) => {});
agenticRAG.on('agentic:compaction', (result) => {});
agenticRAG.on('agentic:complete', (result) => {});
agenticRAG.on('agentic:error', (error) => {});
```

### QueryReformulator Events

```typescript
reformulator.on('reformulation:start', (query) => {});
reformulator.on('reformulation:gap-detected', (gap) => {});
reformulator.on('reformulation:complete', (result) => {});
reformulator.on('reformulation:error', (error) => {});
```

### RetrievalCritic Events

```typescript
critic.on('critique:start', (resultCount) => {});
critic.on('critique:dimension', (dimension) => {});
critic.on('critique:complete', (result) => {});
critic.on('critique:error', (error) => {});
```

### ContextCompactor Events

```typescript
compactor.on('compaction:start', (chunkCount, tokenCount) => {});
compactor.on('compaction:progress', (phase, progress) => {});
compactor.on('compaction:complete', (result) => {});
compactor.on('compaction:error', (error) => {});
compactor.on('window:update', (window) => {});
compactor.on('window:overflow', (window) => {});
```

## Types

All types are exported and available for TypeScript:

```typescript
import type {
  // Core types
  DocumentChunk,
  ChunkMetadata,
  ChunkingOptions,
  EmbeddingConfig,
  SearchResult,
  VectorStoreConfig,
  RetrievalOptions,
  ChunkFilter,

  // Agentic RAG types
  AgenticRAGConfig,
  AgenticRetrievalResult,
  RetrievalIteration,

  // Query reformulation types
  QueryReformulationConfig,
  ReformulationResult,
  ReformulationStrategy,
  ContextGap,

  // Critique types
  RetrievalCritiqueConfig,
  CritiqueResult,
  QualityDimension,
  RelevanceAnalysis,
  CoverageAnalysis,
  RedundancyAnalysis,

  // Compaction types
  ContextCompactionConfig,
  CompactionStrategy,
  CompactedContext,
  CompactedChunk,
  CompactionMetadata,
  ContextWindow,
} from '@wundr.io/rag-utils';
```

Zod schemas are also available for validation:

```typescript
import {
  DocumentChunkSchema,
  ChunkMetadataSchema,
  ChunkingOptionsSchema,
  EmbeddingConfigSchema,
  SearchResultSchema,
  RetrievalOptionsSchema,
  AgenticRAGConfigSchema,
  QueryReformulationConfigSchema,
  RetrievalCritiqueConfigSchema,
  ContextCompactionConfigSchema,
} from '@wundr.io/rag-utils';
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google GenAI API key for embeddings |

```bash
# .env
GEMINI_API_KEY=your-api-key-here
```

## License

MIT
