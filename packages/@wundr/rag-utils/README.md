# @wundr/rag-utils

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> RAG (Retrieval-Augmented Generation) utilities for the Wundr platform

@wundr/rag-utils provides intelligent document chunking, embedding generation, vector storage, and retrieval capabilities for AI-powered code analysis. Built with TypeScript and optimized for code-aware operations.

## Installation

```bash
# npm
npm install @wundr/rag-utils

# yarn
yarn add @wundr/rag-utils

# pnpm
pnpm add @wundr/rag-utils
```

## Quick Start

```typescript
import {
  DocumentChunker,
  EmbeddingService,
  VectorStore,
  RetrievalService,
  createRetrievalService,
} from '@wundr/rag-utils';

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

## API Documentation

### DocumentChunker

Code-aware document chunker that respects function and class boundaries.

```typescript
import { DocumentChunker, createChunker } from '@wundr/rag-utils';

const chunker = new DocumentChunker({
  maxTokens: 512,      // Maximum tokens per chunk
  minTokens: 50,       // Minimum tokens per chunk
  overlap: 50,         // Token overlap between chunks
  preserveCodeBlocks: true,
  respectFunctionBoundaries: true,
  respectClassBoundaries: true,
});

// Chunk a document
const chunks = await chunker.chunkDocument(
  content,       // File content
  'src/app.ts',  // Source file path
  'typescript',  // Language (optional)
);

// Each chunk contains:
// - id: Unique identifier
// - content: The chunk text
// - metadata: { sourceFile, startLine, endLine, language, type, functionName, className }
```

### EmbeddingService

Generates vector embeddings using Google GenAI.

```typescript
import { EmbeddingService, createEmbeddingService } from '@wundr/rag-utils';

const service = createEmbeddingService(process.env.GEMINI_API_KEY, {
  model: 'text-embedding-004',  // Embedding model
  dimensions: 768,               // Vector dimensions
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
import { cosineSimilarity, euclideanDistance, normalizeVector } from '@wundr/rag-utils';

const similarity = cosineSimilarity(vectorA, vectorB);  // Returns 0-1
const distance = euclideanDistance(vectorA, vectorB);
const normalized = normalizeVector(vector);
```

### VectorStore

In-memory vector storage with similarity search.

```typescript
import { VectorStore, createVectorStore } from '@wundr/rag-utils';

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

// Search by content
const matches = store.searchByContent('error handling', 10);

// Filter chunks
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

High-level service combining chunking, embeddings, and search.

```typescript
import { RetrievalService, createRetrievalService } from '@wundr/rag-utils';

const service = createRetrievalService(
  process.env.GEMINI_API_KEY,  // API key (optional, can call initialize() later)
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
  rerank: true,
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

// Access underlying components
const vectorStore = service.getVectorStore();
const embeddings = service.getEmbeddingService();
const chunker = service.getChunker();
```

**Format Results:**

```typescript
import { formatSearchResults } from '@wundr/rag-utils';

const formatted = formatSearchResults(results);
console.log(formatted);  // Markdown-formatted results
```

## Configuration Options

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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google GenAI API key for embeddings |

```bash
# .env
GEMINI_API_KEY=your-api-key-here
```

## Events

All services emit events for monitoring:

```typescript
// EmbeddingService events
embeddings.on('embedding:start', (batchSize) => {});
embeddings.on('embedding:progress', (completed, total) => {});
embeddings.on('embedding:complete', (totalEmbeddings) => {});
embeddings.on('embedding:error', (error) => {});

// VectorStore events
store.on('store:add', (count) => {});
store.on('store:remove', (count) => {});
store.on('store:search', (query, results) => {});
store.on('store:clear', () => {});

// RetrievalService events
retrieval.on('retrieval:index:start', (fileCount) => {});
retrieval.on('retrieval:index:progress', (processed, total) => {});
retrieval.on('retrieval:index:complete', (chunkCount) => {});
retrieval.on('retrieval:search:start', (query) => {});
retrieval.on('retrieval:search:complete', (resultCount) => {});
retrieval.on('retrieval:error', (error) => {});
```

## Types

All types are exported and available for TypeScript:

```typescript
import type {
  DocumentChunk,
  ChunkMetadata,
  ChunkingOptions,
  EmbeddingConfig,
  SearchResult,
  VectorStoreConfig,
  RetrievalOptions,
  ChunkFilter,
} from '@wundr/rag-utils';
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
} from '@wundr/rag-utils';
```

## License

MIT
