# @wundr/analysis-engine

Advanced code analysis engine with AST parsing, duplicate detection, complexity metrics, and AI
integration. Built for high performance analysis of large codebases (10,000+ files).

## Features

🔍 **Advanced AST Analysis**

- TypeScript & JavaScript support
- Semantic analysis with type checking
- Cross-file dependency tracking

🔄 **Duplicate Detection**

- Hash-based clustering
- Semantic similarity matching
- Fuzzy duplicate detection
- Consolidation suggestions

📊 **Complexity Metrics**

- Cyclomatic complexity
- Cognitive complexity
- Maintainability index
- Technical debt estimation

🎯 **Code Smell Detection**

- Long methods/classes
- God objects
- Wrapper patterns
- Deep nesting

🌐 **Circular Dependencies**

- Graph-based detection
- Madge integration
- Break point suggestions

⚡ **High Performance**

- 10,000+ files/second analysis
- Concurrent processing
- Memory optimization
- Smart caching

🤖 **AI Integration**

- Claude Flow hooks
- Pattern recognition
- Smart recommendations

## Installation

```bash
npm install @wundr/analysis-engine
```

## Quick Start

### Command Line Usage

```bash
# Analyze current directory
npx wundr-analyze

# Analyze specific directory
npx wundr-analyze /path/to/project

# With custom options
npx wundr-analyze ./src --format html,json --max-complexity 15 --verbose

# Initialize configuration file
npx wundr-analyze init

# Run performance benchmark
npx wundr-analyze benchmark --size large
```

### Programmatic Usage

```typescript
import { AnalysisEngine, analyzeProject } from '@wundr/analysis-engine';

// Simple analysis
const report = await analyzeProject('./src');
console.log(`Found ${report.summary.duplicateClusters} duplicate clusters`);

// Advanced configuration
const engine = new AnalysisEngine({
  targetDir: './src',
  includeTests: false,
  enableAIAnalysis: true,
  outputFormats: ['json', 'html', 'markdown'],
  thresholds: {
    complexity: { cyclomatic: 10, cognitive: 15 },
    duplicates: { minSimilarity: 0.8 },
    fileSize: { maxLines: 500 },
  },
  performance: {
    maxConcurrency: 15,
    chunkSize: 50,
    enableCaching: true,
  },
});

// With progress tracking
engine.setProgressCallback(event => {
  if (event.type === 'progress') {
    console.log(`Progress: ${event.progress}/${event.total}`);
  }
});

const detailedReport = await engine.analyze();
```

## Configuration

### Configuration File

Create `wundr-analysis.config.json`:

```json
{
  "targetDir": "./src",
  "excludeDirs": ["node_modules", "dist", "coverage"],
  "includePatterns": ["**/*.{ts,tsx,js,jsx}"],
  "excludePatterns": ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
  "includeTests": false,
  "enableAIAnalysis": false,
  "outputFormats": ["json", "html"],
  "performance": {
    "maxConcurrency": 10,
    "chunkSize": 100,
    "enableCaching": true
  },
  "thresholds": {
    "complexity": {
      "cyclomatic": 10,
      "cognitive": 15
    },
    "duplicates": {
      "minSimilarity": 0.8
    },
    "fileSize": {
      "maxLines": 500
    }
  }
}
```

### CLI Options

| Option             | Description                             | Default             |
| ------------------ | --------------------------------------- | ------------------- |
| `--output, -o`     | Output directory                        | `./analysis-output` |
| `--format, -f`     | Output formats (json,html,markdown,csv) | `json,html`         |
| `--include-tests`  | Include test files                      | `false`             |
| `--exclude`        | Additional exclude patterns             | `""`                |
| `--max-complexity` | Cyclomatic complexity threshold         | `10`                |
| `--min-similarity` | Duplicate similarity threshold          | `0.8`               |
| `--concurrency`    | Max concurrent processing               | `10`                |
| `--enable-ai`      | Enable AI analysis                      | `false`             |
| `--verbose`        | Verbose output                          | `false`             |

## Analysis Report

The analysis generates comprehensive reports with:

### Summary Metrics

- Total files and entities analyzed
- Duplicate clusters found
- Circular dependencies detected
- Code smells identified
- Quality score and technical debt estimation

### Detailed Analysis

- **Entities**: All classes, interfaces, functions with metadata
- **Duplicates**: Clustered duplicates with similarity scores
- **Dependencies**: Circular dependency cycles with suggestions
- **Code Smells**: Identified anti-patterns and issues
- **Recommendations**: Prioritized improvement suggestions

### Visualizations

- Dependency graphs
- Complexity heatmaps
- Duplicate networks
- Quality trends

## Engine Components

### DuplicateDetectionEngine

Advanced duplicate detection using multiple algorithms:

```typescript
import { DuplicateDetectionEngine } from '@wundr/analysis-engine';

const engine = new DuplicateDetectionEngine({
  minSimilarity: 0.8,
  enableSemanticAnalysis: true,
  enableFuzzyMatching: true,
  clusteringAlgorithm: 'hierarchical',
});

const duplicates = await engine.analyze(entities, config);
```

### ComplexityMetricsEngine

Comprehensive complexity analysis:

```typescript
import { ComplexityMetricsEngine } from '@wundr/analysis-engine';

const engine = new ComplexityMetricsEngine({
  cyclomatic: { critical: 20, high: 15, medium: 10, low: 5 },
  cognitive: { critical: 30, high: 20, medium: 15, low: 7 },
  maintainability: { excellent: 85, good: 70, moderate: 50, poor: 25 },
});

const complexity = await engine.analyze(entities, config);
```

### CircularDependencyEngine

Graph-based circular dependency detection:

```typescript
import { CircularDependencyEngine } from '@wundr/analysis-engine';

const engine = new CircularDependencyEngine({
  enableMadge: true,
  maxCycleLength: 10,
  includeTransitive: true,
});

const cycles = await engine.analyze(entities, config);
```

## Performance Optimization

### Large Codebases (10k+ files)

```typescript
const engine = new AnalysisEngine({
  performance: {
    maxConcurrency: 20, // Increase for more cores
    chunkSize: 50, // Smaller chunks for memory efficiency
    enableCaching: true, // Essential for large projects
  },
  // Exclude unnecessary files
  excludePatterns: [
    '**/*.{test,spec}.{ts,js}',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.d.ts',
  ],
});
```

### Memory Management

The engine includes sophisticated memory management:

- Streaming file processing
- Garbage collection hints
- Memory usage monitoring
- Cache size limits

### Benchmarking

```bash
# Small project (~10 files)
npx wundr-analyze benchmark --size small

# Medium project (~50 files)
npx wundr-analyze benchmark --size medium

# Large project (~200 files)
npx wundr-analyze benchmark --size large
```

## Integration

### CI/CD Integration

```yaml
name: Code Analysis
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install @wundr/analysis-engine
      - name: Run analysis
        run: npx wundr-analyze --format json,html --verbose
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: analysis-reports
          path: analysis-output/
```

### Claude Flow Integration

```typescript
import { AnalysisEngine } from '@wundr/analysis-engine';

const engine = new AnalysisEngine({
  enableAIAnalysis: true,
  // Claude Flow will automatically enhance analysis
});

// AI-powered pattern recognition
const report = await engine.analyze();
// Enhanced recommendations with AI insights
```

### Custom Analyzers

Create custom analysis engines:

```typescript
import { BaseAnalyzer, EntityInfo, AnalysisConfig } from '@wundr/analysis-engine';

class CustomSecurityAnalyzer implements BaseAnalyzer<SecurityIssue[]> {
  name = 'SecurityAnalyzer';
  version = '1.0.0';

  async analyze(entities: EntityInfo[], config: AnalysisConfig): Promise<SecurityIssue[]> {
    // Custom security analysis logic
    return securityIssues;
  }
}
```

## Output Formats

### JSON Report

Machine-readable format for tooling integration.

### HTML Report

Rich interactive dashboard with charts and visualizations.

### Markdown Report

Human-readable format for documentation.

### CSV Export

Tabular data for spreadsheet analysis.

## API Reference

### Core Classes

- `AnalysisEngine`: Main orchestrator
- `EnhancedASTAnalyzer`: AST-based analysis
- `DuplicateDetectionEngine`: Duplicate detection
- `ComplexityMetricsEngine`: Complexity analysis
- `CircularDependencyEngine`: Dependency analysis

### Types

- `AnalysisConfig`: Configuration interface
- `AnalysisReport`: Report structure
- `EntityInfo`: Entity metadata
- `DuplicateCluster`: Duplicate grouping
- `ComplexityMetrics`: Complexity measurements

### Utilities

- `generateNormalizedHash()`: Content hashing
- `calculateSimilarity()`: Similarity scoring
- `processConcurrently()`: Concurrent processing
- `formatDuration()`: Time formatting

## Examples

### Basic Duplicate Detection

```typescript
import { DuplicateDetectionEngine } from '@wundr/analysis-engine';

const duplicates = await new DuplicateDetectionEngine().analyze(entities, config);
duplicates.forEach(cluster => {
  console.log(`Found ${cluster.entities.length} duplicates of ${cluster.type}`);
  console.log(`Similarity: ${cluster.similarity}`);
  console.log(`Suggestion: ${cluster.consolidationSuggestion?.strategy}`);
});
```

### Complexity Analysis

```typescript
import { ComplexityMetricsEngine } from '@wundr/analysis-engine';

const complexity = await new ComplexityMetricsEngine().analyze(entities, config);
console.log(`Average complexity: ${complexity.overallMetrics.averageCyclomaticComplexity}`);
console.log(`Technical debt: ${complexity.overallMetrics.totalTechnicalDebt} hours`);
```

### Progress Tracking

```typescript
import { AnalysisEngine } from '@wundr/analysis-engine';

const engine = new AnalysisEngine({ targetDir: './src' });

engine.setProgressCallback(event => {
  switch (event.type) {
    case 'phase':
      console.log(`Phase: ${event.message}`);
      break;
    case 'progress':
      console.log(`Progress: ${event.progress}/${event.total}`);
      break;
    case 'complete':
      console.log('Analysis completed!');
      break;
  }
});

const report = await engine.analyze();
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/analysis-engine
npm install
npm run build
npm test
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- DuplicateDetectionEngine.test.ts

# Watch mode
npm run test:watch
```

## License

MIT © [Wundr, by Adaptic.ai](https://adaptic.ai)

## Support

- Documentation: [wundr.io/docs](https://wundr.io/docs)
- Issues: [GitHub Issues](https://github.com/adapticai/wundr/issues)
- Discord: [Join our community](https://discord.gg/wundr)
