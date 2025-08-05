# TypeScript Configuration

This directory contains comprehensive TypeScript configurations for the monorepo refactoring toolkit, designed to provide maximum type safety and excellent developer experience.

## Configuration Files

### `tsconfig.base.json`
The base configuration that all other TypeScript configs extend from. Features:
- **Strict Type Checking**: All strict flags enabled for maximum safety
- **Modern Target**: ES2022 with full feature support
- **Monorepo Support**: Path mapping and project references setup
- **Build Optimization**: Incremental compilation and composite projects
- **Development Experience**: Source maps, declaration maps, and proper module resolution

### `tsconfig.monorepo.json`
Monorepo-specific configuration that extends the base config. Features:
- **Project References**: Configured for typical monorepo package structure
- **Path Mapping**: Aliases for `@monorepo/*`, `@packages/*`, `@apps/*`, etc.
- **Workspace Integration**: Optimized for package manager workspaces
- **Build Coordination**: Composite builds with proper dependency ordering

### `tsconfig.scripts.json`
Configuration optimized for Node.js scripts and tooling. Features:
- **Node.js Compatibility**: CommonJS modules and Node.js types
- **Script Flexibility**: Slightly relaxed rules for CLI and build scripts
- **Fast Compilation**: No project references for quicker iteration
- **Tool Integration**: Compatible with ts-node and other script runners

## Type Definitions

### `types/global.d.ts`
Global type definitions available throughout the project:
- **Environment Variables**: Typed `process.env` for all expected variables
- **Console Extensions**: Additional logging methods
- **Utility Types**: Common patterns like `NonEmptyArray`, `DeepPartial`, etc.
- **Monorepo Types**: Package.json, workspace info, and analysis types
- **JSON Types**: Strict JSON value typing

### `types/modules.d.ts`
Module declarations for untyped packages:
- **Build Tools**: shelljs, glob, ts-morph
- **CLI Tools**: commander, chalk, ora, inquirer
- **Utilities**: semver and other common packages
- **Custom Modules**: Internal module path declarations

### `types/node.d.ts`
Enhanced Node.js type definitions:
- **Child Process**: Extended exec and spawn options
- **File System**: Complete fs/promises API coverage
- **Path Utilities**: Enhanced path manipulation types
- **OS Information**: System information and utilities
- **Util Functions**: Type guards and inspection utilities

### `types/utils.d.ts`
Toolkit-specific type definitions:
- **AST Analysis**: TypeScript AST node types and analysis results
- **Dependency Management**: Dependency graphs and circular detection
- **Code Quality**: Metrics, issues, and quality gates
- **Refactoring Operations**: Refactoring plans and operations
- **Migration Planning**: Migration steps and validation
- **Reporting**: Report generation and recommendation types

### `types/index.d.ts`
Central export file that:
- References all type definition files
- Exports commonly used types
- Provides type guards and assertion helpers
- Defines toolkit-specific error classes

## Usage

### In Package Projects
```json
{
  "extends": "../../config/typescript/tsconfig.monorepo.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core-types" },
    { "path": "../utils" }
  ]
}
```

### In Scripts
```json
{
  "extends": "../../config/typescript/tsconfig.scripts.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["**/*.ts"]
}
```

### In Applications
```json
{
  "extends": "../../config/typescript/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/core-types" },
    { "path": "../../packages/services" }
  ]
}
```

## Path Mapping

The configurations include comprehensive path mapping:

```typescript
// Import from packages
import { UserType } from '@monorepo/core-types';
import { ApiService } from '@monorepo/services';

// Import from apps
import { ApiController } from '@apps/api';

// Import scripts and tools
import { AnalysisTool } from '@scripts/analysis';
import { ConfigHelper } from '@config/helpers';
```

## Type Safety Features

### Strict Configuration
- `strict: true` - All strict checks enabled
- `noImplicitAny: true` - No implicit any types
- `strictNullChecks: true` - Null safety
- `noImplicitReturns: true` - All code paths return
- `exactOptionalPropertyTypes: true` - Exact optional properties
- `noUncheckedIndexedAccess: true` - Safe array/object access

### Additional Safety
- `noUnusedLocals: true` - Catch unused variables
- `noUnusedParameters: true` - Catch unused parameters
- `noImplicitOverride: true` - Explicit override keyword
- `forceConsistentCasingInFileNames: true` - Consistent naming

### Modern Features
- `target: "ES2022"` - Latest JavaScript features
- `lib: ["ES2022", "DOM"]` - Full API coverage
- `moduleResolution: "node"` - Node.js module resolution
- `allowSyntheticDefaultImports: true` - Better import experience

## Integration with Tools

### ESLint
The TypeScript configurations work seamlessly with ESLint:
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": ["./tsconfig.json", "./packages/*/tsconfig.json"]
  }
}
```

### Jest
For testing with proper type checking:
```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleNameMapping": {
    "^@monorepo/(.*)$": "<rootDir>/../$1/src"
  }
}
```

### Build Tools
Compatible with:
- **Turbo**: Project references for incremental builds
- **tsc**: Direct TypeScript compiler usage
- **ts-node**: Script execution with type checking
- **Webpack/Vite**: Module bundling with proper resolution

## Best Practices

### Project Structure
```
├── packages/
│   ├── core-types/
│   │   ├── src/
│   │   └── tsconfig.json (extends monorepo config)
│   └── services/
│       ├── src/
│       └── tsconfig.json (extends monorepo config)
├── apps/
│   └── api/
│       ├── src/
│       └── tsconfig.json (extends base config)
├── scripts/
│   └── tsconfig.json (extends scripts config)
└── config/
    └── typescript/
        ├── tsconfig.base.json
        ├── tsconfig.monorepo.json
        └── tsconfig.scripts.json
```

### Import Organization
```typescript
// 1. Node.js built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External packages
import chalk from 'chalk';
import { Command } from 'commander';

// 3. Internal packages
import { UserType } from '@monorepo/core-types';
import { ApiService } from '@monorepo/services';

// 4. Relative imports
import { helper } from './utils';
import config from '../config';
```

### Type Definitions
```typescript
// Use toolkit types
import type { RefactoringToolkit } from '@config/typescript/types';

// Define with proper constraints
interface AnalysisResult extends RefactoringToolkit.Quality.MetricResult {
  customMetric: number;
}

// Use utility types
type OptionalConfig = Optional<RefactoringToolkit.Config.ToolkitConfig, 'reporting'>;
```

## Troubleshooting

### Common Issues

1. **Module Resolution**: Ensure `baseUrl` and `paths` are configured correctly
2. **Project References**: Check that reference paths exist and are correct
3. **Type Imports**: Use `import type` for type-only imports
4. **Path Mapping**: Verify path mappings match your directory structure

### Performance Tips

1. Use `skipLibCheck: true` to speed up compilation
2. Enable `incremental: true` for faster rebuilds
3. Use project references for large codebases
4. Configure `exclude` patterns to avoid unnecessary files

### IDE Integration

For VS Code, add to workspace settings:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "typescript.suggest.paths": true
}
```

## Maintenance

### Updating Configurations
1. Update base configuration for project-wide changes
2. Test with `tsc --noEmit` before committing
3. Validate project references with `tsc --build`
4. Check IDE integration after updates

### Adding New Packages
1. Create package-specific tsconfig.json
2. Add to monorepo project references
3. Update path mappings if needed
4. Test compilation and imports

This configuration provides a solid foundation for TypeScript development in a monorepo environment with maximum type safety and excellent developer experience.