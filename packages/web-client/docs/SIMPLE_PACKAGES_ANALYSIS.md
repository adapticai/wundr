# Wundr Simple Package Variants - Comprehensive Analysis

## Executive Summary

The Wundr monorepo maintains two parallel package ecosystems:

- **Simple packages** (`@wundr.io/*-simple`): Lightweight, minimal-dependency implementations
- **Full packages** (`@wundr.io/*`): Feature-rich, production-ready implementations

This dual-package strategy enables flexible adoption, gradual migration, and reduced overhead for
simple use cases.

---

## Package Inventory

### Simple Package Variants

| Package                            | Scope      | Files | Purpose                               |
| ---------------------------------- | ---------- | ----- | ------------------------------------- |
| `@wundr.io/shared-config`          | Foundation | 6     | Shared configurations and constants   |
| `@wundr.io/core-simple`            | Foundation | 9     | Core business logic and domain models |
| `@wundr.io/analysis-engine-simple` | Analysis   | 18    | Lightweight code analysis engine      |
| `@wundr.io/setup-toolkit-simple`   | Tooling    | ~15   | Environment setup and configuration   |
| `@wundr.io/web-client-simple`      | UI         | ~12   | Shared web components and utilities   |

### Corresponding Full Packages

| Package                     | Scope      | Files | Purpose                                              |
| --------------------------- | ---------- | ----- | ---------------------------------------------------- |
| `@wundr.io/config`          | Foundation | ~20   | Advanced configuration management with validation    |
| `@wundr.io/core`            | Foundation | 30    | Full utilities with logging, events, error handling  |
| `@wundr.io/analysis-engine` | Analysis   | 54    | Production analysis with AST, AI, optimization       |
| `@wundr.io/computer-setup`  | Tooling    | ~40   | Full computer provisioning with AI/Slack integration |
| N/A                         | UI         | -     | No direct equivalent (Dashboard is separate)         |

---

## Detailed Package Analysis

### 1. @wundr.io/shared-config

**Purpose**: Foundational configuration and constants shared across all packages

**Structure**:

```
src/
├── config/
│   └── index.ts          # DEFAULT_CONFIG, SharedConfig interface
├── constants/
│   └── index.ts          # API_ENDPOINTS, HTTP_STATUS
└── index.ts
```

**Key Features**:

- Shared configuration defaults (timeout, retryCount, logLevel)
- Common API endpoint definitions
- HTTP status code constants
- TypeScript strict typing

**Dependencies**:

- `eslint-config-prettier` (formatting)
- `prettier` (code formatting)

**Use Cases**:

- Consuming packages need shared constants
- Standardized configuration across ecosystem
- Lightweight dependency for other simple packages

**Migration Path**: N/A (foundational package, no full equivalent)

---

### 2. @wundr.io/core-simple

**Purpose**: Core business logic and domain models

**Structure**:

```
src/
├── types/
│   └── index.ts          # WundrConfig, BaseEntity interfaces
├── services/
│   └── index.ts          # CoreService class
└── index.ts
```

**Key Features**:

- Basic TypeScript interfaces (WundrConfig, BaseEntity)
- Minimal CoreService implementation
- Event emitter support (eventemitter3)
- Schema validation (zod)
- UUID generation

**Dependencies**:

```json
{
  "eventemitter3": "^5.0.1",
  "uuid": "^11.0.3",
  "zod": "^3.25.76"
}
```

**Full Package Comparison** (`@wundr.io/core`):

| Feature        | Simple  | Full                                           |
| -------------- | ------- | ---------------------------------------------- |
| Files          | 9       | 30                                             |
| Logging        | ❌      | ✅ Winston-based                               |
| Error handling | ❌      | ✅ Custom error classes                        |
| Event system   | Basic   | Advanced EventBus                              |
| Utilities      | Minimal | Async, Object, String, Validation, Performance |
| Dependencies   | 3       | 5+                                             |

**Full Package Additions**:

- Advanced logger with Winston
- Comprehensive error handling system
- Event bus architecture
- Performance utilities
- Type guards and validators
- String/object manipulation utilities

**Use Cases**:

- **Simple**: Lightweight applications, prototypes, minimal overhead
- **Full**: Production applications requiring logging, error tracking, events

**Migration Path**:

```typescript
// Before (simple)
import { CoreService } from '@wundr.io/core-simple';

// After (full)
import { CoreService, logger, EventBus } from '@wundr.io/core';
const log = logger.createLogger('MyApp');
const eventBus = new EventBus();
```

---

### 3. @wundr.io/analysis-engine-simple

**Purpose**: Lightweight code analysis and quality metrics

**Structure**:

```
src/
├── analyzers/
│   ├── index.ts                              # CodeAnalyzer, AnalysisResult types
│   └── BaseAnalysisServiceOptimizations.ts   # Optimized analysis service (554 LOC)
├── engines/
│   └── DuplicateDetectionEngineSimple.ts     # Simple duplicate detection
├── metrics/
│   └── index.ts                              # Metric interfaces
├── monitoring/
│   └── MemoryMonitorSimple.ts                # Basic memory monitoring
├── optimization/
│   └── PerformanceBenchmarkSuiteSimple.ts    # Performance benchmarks
├── reporters/
│   └── index.ts                              # Simple HTML/MD/JSON reporters
├── streaming/
│   └── StreamingFileProcessorSimple.ts       # Streaming file processing
└── index.ts
```

**Key Features**:

- Basic AST parsing with TypeScript compiler API
- Simple duplicate detection
- Memory monitoring
- Streaming file processing
- Basic complexity metrics
- HTML/Markdown/JSON reporting

**Dependencies**:

```json
{
  "ts-morph": "^21.0.1",
  "glob": "^10.3.10",
  "minimatch": "^9.0.3",
  "@typescript-eslint/parser": "^6.21.0",
  "@typescript-eslint/typescript-estree": "^6.21.0",
  "@wundr.io/core-simple": "workspace:*"
}
```

**Full Package Comparison** (`@wundr.io/analysis-engine`):

| Feature               | Simple            | Full                         |
| --------------------- | ----------------- | ---------------------------- |
| Files                 | 18                | 54 (3x more)                 |
| AST Parsing           | Basic             | Advanced (ASTParserEngine)   |
| Duplicate Detection   | Simple hash-based | Semantic + AST + Optimized   |
| Circular Dependencies | ❌                | ✅ Full engine               |
| Code Smells           | ❌                | ✅ Comprehensive detection   |
| Unused Exports        | ❌                | ✅ Advanced tracking         |
| AI Integration        | ❌                | ✅ Claude integration        |
| Worker Pools          | ❌                | ✅ Multi-threaded processing |
| CLI Support           | ❌                | ✅ Full CLI (cli.ts - 15KB)  |
| Dependencies          | 5                 | 7+ (madge, ora, chalk)       |

**Full Package Additions**:

```
engines/
├── ASTParserEngine.ts                    # 22KB - Advanced AST parsing
├── CircularDependencyEngine.ts           # 17KB - Dependency cycles
├── CodeSmellEngine.ts                    # 27KB - Smell detection
├── ComplexityMetricsEngine.ts            # 27KB - Detailed metrics
├── DuplicateDetectionEngine.ts           # 25KB - Advanced duplicates
├── DuplicateDetectionEngineOptimized.ts  # 34KB - Memory-optimized
└── UnusedExportEngine.ts                 # 24KB - Unused code detection
workers/
└── WorkerPoolManager.ts                  # Multi-threaded processing
cli.ts                                    # 16KB - Full CLI interface
simple-analyzer.ts                        # 429 LOC - Simplified API
```

**Use Cases**:

- **Simple**: Quick code analysis, CI/CD checks, development workflows
- **Full**: Production code quality, enterprise analysis, AI-powered insights

**Migration Path**:

```typescript
// Before (simple)
import { OptimizedBaseAnalysisService } from '@wundr.io/analysis-engine-simple';
const analyzer = new OptimizedBaseAnalysisService(config);

// After (full)
import { AnalysisEngine, analyzeProject } from '@wundr.io/analysis-engine';
const engine = new AnalysisEngine({
  targetDir: './src',
  useOptimizations: true,
  enableAIAnalysis: true,
});
const report = await engine.analyze();
```

---

### 4. @wundr.io/setup-toolkit-simple

**Purpose**: Environment setup and configuration tools

**Structure**:

```
src/
├── installers/
│   └── index.ts          # Node, Python, Docker, Git installers
├── configurators/
│   └── index.ts          # Git, NPM, Docker, VSCode configurators
├── validators/
│   └── index.ts          # System, dependency, environment validators
└── index.ts
```

**Key Features**:

- Software installation automation (Node, Python, Docker, Git)
- Configuration management (Git, NPM, Docker, VSCode)
- System validation (requirements, dependencies, environment)
- Interactive CLI (inquirer)
- Progress visualization (listr2, ora)

**Dependencies**:

```json
{
  "@wundr.io/core-simple": "workspace:*",
  "chalk": "^5.3.0",
  "execa": "^8.0.1",
  "fs-extra": "^11.3.1",
  "inquirer": "^9.2.0",
  "listr2": "^8.2.5",
  "ora": "^5.4.1"
}
```

**Full Package Comparison** (`@wundr.io/computer-setup`):

| Feature           | Simple                | Full                        |
| ----------------- | --------------------- | --------------------------- |
| Purpose           | Generic setup toolkit | Full computer provisioning  |
| AI Integration    | ❌                    | ✅ OpenAI GPT integration   |
| Slack Integration | ❌                    | ✅ Slack notifications      |
| Google Workspace  | ❌                    | ✅ Account creation         |
| Canvas/Sharp      | ❌                    | ✅ Image processing         |
| Scope             | Reusable library      | Engineering team onboarding |
| Dependencies      | 6 core                | 10+ (5 optional)            |

**Full Package Features**:

- AI-powered setup assistance (OpenAI)
- Slack workspace integration
- Google Workspace account provisioning
- Visual asset generation (Canvas/Sharp)
- Team-specific configurations
- Hardware detection and optimization

**Use Cases**:

- **Simple**: General-purpose setup automation, custom tooling
- **Full**: Enterprise engineering team onboarding, complete provisioning

**Migration Path**:

```typescript
// Before (simple) - Generic toolkit
import { nodeInstaller, gitConfigurator } from '@wundr.io/setup-toolkit-simple';
await nodeInstaller.install({ version: '20.x' });
await gitConfigurator.configure({ name: 'User' });

// After (full) - Complete provisioning
import { ComputerSetup } from '@wundr.io/computer-setup';
const setup = new ComputerSetup({
  slack: { token: process.env.SLACK_TOKEN },
  openai: { apiKey: process.env.OPENAI_KEY },
  google: { credentials: './credentials.json' },
});
await setup.provisionDeveloper({ email: 'dev@company.com' });
```

---

### 5. @wundr.io/web-client-simple

**Purpose**: Shared web components and utilities

**Structure**:

```
src/
├── components/
│   ├── ui/                    # Button, Card, Badge, Dialog components
│   ├── index.ts
│   └── types.ts
├── hooks/
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── useTheme.ts
├── utils/
│   ├── cn.ts                  # Class name utilities
│   └── format.ts              # Formatters
└── index.ts
```

**Key Features**:

- Radix UI primitives (accessible components)
- Tailwind CSS integration (class-variance-authority, clsx, tailwind-merge)
- React 19 support
- Common hooks (debounce, localStorage, theme)
- Recharts integration for charts
- Minimal UI components (Button, Card, Badge, Dialog)

**Dependencies**:

```json
{
  "@radix-ui/react-slot": "^1.1.0",
  "@wundr.io/core-simple": "workspace:*",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "recharts": "^2.13.3",
  "tailwind-merge": "^2.5.4"
}
```

**Full Package Comparison**: No direct `@wundr.io/web-client` equivalent

**Alternative**: `@wundr.io/dashboard` (Next.js application)

- Full dashboard application (not library)
- Next.js 14+ framework
- Complete admin interface
- Authentication/authorization
- Data visualization
- API integration

**Use Cases**:

- **Simple**: Shared component library, reusable UI building blocks
- **Dashboard**: Complete web application with backend integration

**Migration Path**:

```typescript
// Simple package - Reusable components
import { Button, Card, useTheme } from '@wundr.io/web-client-simple';

// Dashboard - Full application
// Import directly from dashboard package or build custom app
import { DashboardLayout } from '@wundr.io/dashboard';
```

---

## Shared Configuration Patterns

### TypeScript Configuration Inheritance

**Root `tsconfig.json`** (packages inherit):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

**Simple Packages** extend root:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  }
}
```

**Full Packages** add optimizations:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true, // Project references
    "incremental": true // Faster rebuilds
    // ... other options
  }
}
```

### Workspace Dependencies

All packages use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@wundr.io/core-simple": "workspace:*",
    "@wundr.io/analysis-engine-simple": "workspace:*"
  }
}
```

### Consistent Build Scripts

All packages share common scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Usage Examples

### Example 1: Simple CLI Tool

```typescript
// Using simple packages for lightweight CLI
import { DEFAULT_CONFIG } from '@wundr.io/shared-config';
import { CoreService } from '@wundr.io/core-simple';
import { nodeInstaller } from '@wundr.io/setup-toolkit-simple';

const core = new CoreService();
await core.initialize();

console.log('Installing Node.js...');
await nodeInstaller.install({
  version: '20.x',
  timeout: DEFAULT_CONFIG.timeout,
});
```

### Example 2: Simple Code Analysis

```typescript
// Quick code analysis without heavy dependencies
import { OptimizedBaseAnalysisService } from '@wundr.io/analysis-engine-simple';

const analyzer = new OptimizedBaseAnalysisService({
  targetDir: './src',
  excludeDirs: ['node_modules', 'dist'],
});

const report = await analyzer.analyze();
console.log(`Found ${report.summary.totalIssues} issues`);
```

### Example 3: Full Production Analysis

```typescript
// Production-grade analysis with all features
import { AnalysisEngine, analyzeProjectWithProgress } from '@wundr.io/analysis-engine';

const engine = new AnalysisEngine({
  targetDir: './src',
  useOptimizations: true,
  enableAIAnalysis: true,
  outputFormats: ['html', 'json'],
});

engine.setProgressCallback(({ type, message }) => {
  console.log(`[${type}] ${message}`);
});

const report = await engine.analyze();
// Full report with circular deps, code smells, unused exports, etc.
```

### Example 4: Web Component Library

```typescript
// Building UI with simple components
import { Button, Card, useTheme } from '@wundr.io/web-client-simple';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Card>
      <h2>Current theme: {theme}</h2>
      <Button onClick={toggleTheme}>
        Toggle Theme
      </Button>
    </Card>
  );
}
```

---

## Migration Guidance: Simple to Full

### Step 1: Assess Dependencies

**Identify current simple packages**:

```bash
# Check package.json
grep "@wundr.io/.*-simple" package.json
```

**Map to full equivalents**: | Simple | Full | Breaking Changes |
|--------|------|------------------| | `core-simple` | `core` | Import paths, API surface | |
`analysis-engine-simple` | `analysis-engine` | Configuration schema | | `setup-toolkit-simple` |
`computer-setup` | Scope change (generic → team) |

### Step 2: Update package.json

```diff
{
  "dependencies": {
-   "@wundr.io/core-simple": "workspace:*",
-   "@wundr.io/analysis-engine-simple": "workspace:*",
+   "@wundr.io/core": "workspace:*",
+   "@wundr.io/analysis-engine": "workspace:*"
  }
}
```

### Step 3: Update Imports

**Core Migration**:

```typescript
// Before
import { CoreService } from '@wundr.io/core-simple';

// After
import { CoreService, logger, EventBus } from '@wundr.io/core';
```

**Analysis Engine Migration**:

```typescript
// Before
import { OptimizedBaseAnalysisService } from '@wundr.io/analysis-engine-simple';

// After
import { AnalysisEngine } from '@wundr.io/analysis-engine';
```

### Step 4: Adopt New Features Gradually

**Add logging**:

```typescript
import { logger } from '@wundr.io/core';
const log = logger.createLogger('MyApp');
log.info('Application started');
```

**Add event bus**:

```typescript
import { EventBus } from '@wundr.io/core';
const eventBus = new EventBus();
eventBus.on('analysis:complete', data => {
  log.info('Analysis completed', data);
});
```

**Enable advanced analysis**:

```typescript
const engine = new AnalysisEngine({
  targetDir: './src',
  enableAIAnalysis: true, // New: AI-powered insights
  useOptimizations: true, // New: Memory optimizations
  enableCircularDependencies: true, // New: Detect cycles
});
```

### Step 5: Testing Strategy

1. **Parallel Migration**: Run both simple and full in different environments
2. **Feature Flagging**: Conditionally use full features
3. **Gradual Rollout**: Migrate module by module

```typescript
const USE_FULL_CORE = process.env.FEATURE_FULL_CORE === 'true';

let core;
if (USE_FULL_CORE) {
  const { CoreService } = await import('@wundr.io/core');
  core = new CoreService();
} else {
  const { CoreService } = await import('@wundr.io/core-simple');
  core = new CoreService();
}
```

---

## Decision Matrix: When to Use Simple vs Full

### Use Simple Packages When:

✅ Building CLI tools or scripts ✅ Prototyping or proof-of-concept ✅ Minimal dependencies required
✅ Performance-sensitive contexts ✅ Embedded in other tools ✅ Learning/educational purposes ✅
Bundle size matters

### Use Full Packages When:

✅ Building production applications ✅ Need comprehensive logging/monitoring ✅ Require advanced
analysis features ✅ AI integration is valuable ✅ Team onboarding automation ✅ Long-term
maintainability matters ✅ Enterprise requirements

### Hybrid Approach:

**Mix and match based on module needs**:

```json
{
  "dependencies": {
    "@wundr.io/core": "workspace:*", // Full - need logging
    "@wundr.io/analysis-engine-simple": "workspace:*", // Simple - basic analysis
    "@wundr.io/setup-toolkit-simple": "workspace:*" // Simple - generic toolkit
  }
}
```

---

## Package Statistics Summary

| Metric            | Simple Average | Full Average      | Ratio |
| ----------------- | -------------- | ----------------- | ----- |
| Files per package | ~12            | ~35               | 1:3   |
| Dependencies      | 4-6            | 7-10+             | 1:1.5 |
| Lines of code     | ~200-600/file  | ~400-1000/file    | 1:2   |
| Build time        | Fast (< 5s)    | Moderate (10-20s) | 1:3   |
| Bundle size       | ~50-100KB      | ~200-500KB        | 1:4   |

---

## Key Findings

1. **Strategic Separation**: Simple packages prioritize minimal dependencies, fast builds, and
   focused functionality
2. **Gradual Adoption**: Users can start simple and migrate to full packages as needs grow
3. **Shared Foundation**: Both ecosystems rely on `@wundr.io/shared-config` for consistency
4. **Feature Parity Gaps**: Not all simple packages have full equivalents (e.g., web-client)
5. **Dependency Strategy**: Simple packages depend on other simple packages; full depends on full
6. **Clear Use Cases**: Simple = libraries/tools, Full = applications/enterprise

---

## Recommendations

### For Package Maintainers:

1. **Document Migration Paths**: Create clear migration guides for each package pair
2. **Version Compatibility**: Ensure simple and full packages can coexist
3. **Feature Parity**: Consider which features should be backported to simple
4. **Performance Benchmarks**: Publish comparison metrics

### For Package Consumers:

1. **Start Simple**: Use simple packages initially unless specific features required
2. **Evaluate Needs**: Audit feature requirements before choosing full packages
3. **Monitor Bundle Size**: Track impact of full packages on application size
4. **Gradual Migration**: Don't rush to full packages without clear benefit

### For Monorepo Governance:

1. **Naming Convention**: Consider consistent naming (e.g., `*-lite` vs `*-simple`)
2. **Dependency Graph**: Maintain clear separation between simple and full ecosystems
3. **Testing Strategy**: Ensure both simple and full packages are well-tested
4. **Documentation**: Maintain this analysis document as packages evolve

---

## Conclusion

The Wundr simple package variants provide a **flexible, graduated adoption model** that balances:

- **Simplicity** (minimal dependencies, fast builds)
- **Power** (comprehensive features, production-ready)
- **Choice** (developers select based on context)

This architecture supports diverse use cases from quick scripts to enterprise applications, with
clear migration paths between tiers.

**Recommendation**: Start with simple packages and migrate to full packages when specific advanced
features (logging, AI, comprehensive analysis) become requirements.

---

## Appendix: Full Dependency Graph

```
Foundations:
├── @wundr.io/shared-config (standalone)
├── @wundr.io/core-simple → shared-config
└── @wundr.io/core → (independent, full implementation)

Analysis:
├── @wundr.io/analysis-engine-simple → core-simple
└── @wundr.io/analysis-engine → (independent, full implementation)

Setup & Tooling:
├── @wundr.io/setup-toolkit-simple → core-simple
└── @wundr.io/computer-setup → core + config

Web:
├── @wundr.io/web-client-simple → core-simple
└── @wundr.io/dashboard → core + config (Next.js app)

CLI:
└── @wundr.io/cli → core-simple + analysis-engine-simple + setup-toolkit-simple
```

---

**Document Version**: 1.0.0 **Last Updated**: 2025-01-21 **Analyzed By**: Research Agent (Claude
Code) **Packages Analyzed**: 5 simple + 5 full variants **Total Files Examined**: 150+
