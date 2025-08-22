#!/usr/bin/env node
// scripts/monorepo-setup.ts

import * as fs from 'fs';
import * as path from 'path';
// execSync removed - unused import

interface PackageConfig {
  name: string;
  path: string;
  description: string;
  dependencies: string[];
  devDependencies?: string[];
  type: 'app' | 'package';
  private?: boolean;
  scripts?: Record<string, string>;
}

interface MonorepoConfig {
  rootName: string;
  organization: string;
  packageManager: 'pnpm' | 'yarn' | 'npm';
  packages: PackageConfig[];
  sharedDependencies: string[];
  sharedDevDependencies: string[];
}

/**
 * MonorepoSetup - A utility class for creating and managing monorepo structures
 * 
 * This class provides comprehensive functionality for setting up modern monorepo
 * architectures with TypeScript, package management, build tooling, and development
 * workflows. It supports automated package creation, dependency management,
 * and migration planning from existing codebases.
 * 
 * @example
 * const setup = new MonorepoSetup();
 * await setup.initializeMonorepo();
 */
export class MonorepoSetup {
  private config: MonorepoConfig = {
    rootName: 'my-monorepo',
    organization: '@company',
    packageManager: 'pnpm',
    packages: [
      {
        name: '@company/core-types',
        path: 'packages/core-types',
        description: 'Shared TypeScript types and interfaces',
        dependencies: [],
        type: 'package',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist'
        }
      },
      {
        name: '@company/errors',
        path: 'packages/errors',
        description: 'Error classes and error handling utilities',
        dependencies: ['@company/core-types'],
        type: 'package',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist'
        }
      },
      {
        name: '@company/utils',
        path: 'packages/utils',
        description: 'Shared utility functions',
        dependencies: ['@company/core-types', '@company/errors'],
        type: 'package',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist',
          test: 'jest'
        }
      },
      {
        name: '@company/models',
        path: 'packages/models',
        description: 'Data models and schemas',
        dependencies: ['@company/core-types', '@company/utils'],
        type: 'package',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist'
        }
      },
      {
        name: '@company/services',
        path: 'packages/services',
        description: 'Business logic services',
        dependencies: [
          '@company/core-types',
          '@company/errors',
          '@company/utils',
          '@company/models'
        ],
        type: 'package',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist',
          test: 'jest'
        }
      },
      {
        name: '@company/api',
        path: 'apps/api',
        description: 'Main API application',
        dependencies: [
          '@company/core-types',
          '@company/errors',
          '@company/utils',
          '@company/models',
          '@company/services',
          'express',
          'cors',
          'helmet'
        ],
        type: 'app',
        private: true,
        scripts: {
          dev: 'nodemon --exec ts-node src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
          test: 'jest'
        }
      },
      {
        name: '@company/worker',
        path: 'apps/worker',
        description: 'Background job worker',
        dependencies: [
          '@company/core-types',
          '@company/errors',
          '@company/utils',
          '@company/models',
          '@company/services'
        ],
        type: 'app',
        private: true,
        scripts: {
          dev: 'nodemon --exec ts-node src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js'
        }
      }
    ],
    sharedDependencies: [
      'typescript@^5.0.0'
    ],
    sharedDevDependencies: [
      '@types/node@^20.0.0',
      '@types/jest@^29.0.0',
      'jest@^29.0.0',
      'ts-jest@^29.0.0',
      'eslint@^8.0.0',
      '@typescript-eslint/parser@^6.0.0',
      '@typescript-eslint/eslint-plugin@^6.0.0',
      'prettier@^3.0.0',
      'nodemon@^3.0.0',
      'ts-node@^10.0.0'
    ]
  };

  /**
   * Initialize the complete monorepo structure with all necessary configurations
   * 
   * Creates a comprehensive monorepo setup including:
   * - Directory structure (packages/, apps/, tools/, docs/)
   * - Package manager configuration (pnpm, yarn, or npm workspaces)
   * - Root configuration files (tsconfig.json, turbo.json, .gitignore)
   * - Individual package configurations with proper dependencies
   * - Build tooling setup (Jest, ESLint, Prettier)
   * - Helper scripts for package management
   * 
   * @throws {Error} If directory creation fails or configuration files cannot be written
   * 
   * @example
   * const setup = new MonorepoSetup();
   * try {
   *   await setup.initializeMonorepo();
   *   console.log('Monorepo initialized successfully!');
   * } catch (error) {
   *   console.error('Failed to initialize monorepo:', error);
   * }
   */
  async initializeMonorepo() {
    console.log('🚀 Initializing monorepo structure...\n');

    // Step 1: Create directory structure
    this.createDirectoryStructure();

    // Step 2: Initialize package manager
    await this.initializePackageManager();

    // Step 3: Create root configuration files
    this.createRootConfigs();

    // Step 4: Create package configurations
    for (const pkg of this.config.packages) {
      await this.createPackage(pkg);
    }

    // Step 5: Setup build tooling
    this.setupBuildTooling();

    // Step 6: Create helper scripts
    this.createHelperScripts();

    console.log('\n✅ Monorepo structure created successfully!');
    this.printNextSteps();
  }

  /**
   * Create the basic directory structure for the monorepo
   * 
   * Creates the following directories if they don't exist:
   * - packages/ (for shared packages)
   * - apps/ (for applications)
   * - tools/ (for development tools)
   * - docs/ (for documentation)
   * - scripts/ (for utility scripts)
   * - .github/workflows/ (for GitHub Actions)
   * 
   * @private
   * @throws {Error} If directory creation fails due to permissions or filesystem issues
   */
  private createDirectoryStructure() {
    console.log('📁 Creating directory structure...');

    // Create main directories
    const dirs = [
      'packages',
      'apps',
      'tools',
      'docs',
      'scripts',
      '.github/workflows'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✓ Created ${dir}/`);
      }
    });
  }

  /**
   * Initialize the configured package manager with workspace settings
   * 
   * Sets up workspace configuration based on the selected package manager:
   * - PNPM: Creates pnpm-workspace.yaml and .npmrc with performance optimizations
   * - Yarn: Configures yarn workspaces in package.json
   * - NPM: Sets up npm workspaces configuration
   * 
   * @private
   * @throws {Error} If workspace configuration files cannot be created
   * 
   * @example
   * For PNPM, creates:
   * - pnpm-workspace.yaml with workspace patterns
   * - .npmrc with strict peer dependencies and hoisting settings
   */
  private async initializePackageManager() {
    console.log(`\n📦 Initializing ${this.config.packageManager}...`);

    switch (this.config.packageManager) {
      case 'pnpm':
        // Create pnpm-workspace.yaml
        const pnpmWorkspace = `packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
`;
        fs.writeFileSync('pnpm-workspace.yaml', pnpmWorkspace);
        console.log('  ✓ Created pnpm-workspace.yaml');

        // Create .npmrc
        const npmrc = `# Strict package management
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true

# Performance
package-import-method=clone
`;
        fs.writeFileSync('.npmrc', npmrc);
        console.log('  ✓ Created .npmrc');
        break;

      case 'yarn':
        // Create yarn workspaces config in package.json
        break;

      case 'npm':
        // NPM workspaces config in package.json
        break;
    }
  }

  /**
   * Create all root-level configuration files for the monorepo
   * 
   * Generates comprehensive configuration files including:
   * - package.json with workspace scripts and shared dependencies
   * - tsconfig.json with project references and path mapping
   * - turbo.json with build pipeline configuration
   * - .gitignore with appropriate ignore patterns
   * - ESLint configuration for consistent code style
   * - Prettier configuration for code formatting
   * 
   * @private
   * @throws {Error} If any configuration file cannot be written
   * 
   * @example
   * Creates scripts like:
   * - "build": "turbo run build"
   * - "test": "turbo run test"
   * - "lint": "turbo run lint"
   */
  private createRootConfigs() {
    console.log('\n⚙️ Creating root configuration files...');

    // Root package.json
    const rootPackageJson = {
      name: this.config.rootName,
      version: '1.0.0',
      private: true,
      description: 'Monorepo for all company packages and applications',
      scripts: {
        // Build scripts
        'build': 'turbo run build',
        'build:packages': 'turbo run build --filter=./packages/*',
        'build:apps': 'turbo run build --filter=./apps/*',

        // Development scripts
        'dev': 'turbo run dev --parallel',
        'dev:api': 'turbo run dev --filter=@company/api',
        'dev:worker': 'turbo run dev --filter=@company/worker',

        // Testing scripts
        'test': 'turbo run test',
        'test:watch': 'turbo run test:watch',
        'test:coverage': 'turbo run test:coverage',

        // Linting and formatting
        'lint': 'turbo run lint',
        'lint:fix': 'turbo run lint:fix',
        'format': 'prettier --write "**/*.{ts,tsx,js,jsx,json,md}"',
        'format:check': 'prettier --check "**/*.{ts,tsx,js,jsx,json,md}"',

        // Utility scripts
        'clean': 'turbo run clean && rm -rf node_modules',
        'fresh': 'pnpm run clean && pnpm install',
        'prepare': 'husky install',

        // Release scripts
        'changeset': 'changeset',
        'version': 'changeset version',
        'release': 'turbo run build && changeset publish'
      },
      engines: {
        node: '>=18.0.0',
        pnpm: '>=8.0.0'
      },
      packageManager: 'pnpm@8.6.0',
      devDependencies: Object.fromEntries(
        this.config.sharedDevDependencies.map(dep => {
          const parts = dep.split('@');
          const name = parts[0] || '';
          const version = parts[1] || 'latest';
          return [name, version];
        })
      )
    };

    fs.writeFileSync('package.json', JSON.stringify(rootPackageJson, null, 2));
    console.log('  ✓ Created package.json');

    // Root tsconfig.json
    const rootTsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'commonjs',
        lib: ['ES2022'],
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './src',
        composite: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        baseUrl: '.',
        paths: {
          '@company/*': ['packages/*/src']
        }
      },
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts']
    };

    fs.writeFileSync('tsconfig.json', JSON.stringify(rootTsConfig, null, 2));
    console.log('  ✓ Created tsconfig.json');

    // Turbo configuration
    const turboConfig = {
      '$schema': 'https://turbo.build/schema.json',
      globalDependencies: ['**/.env.*local'],
      pipeline: {
        build: {
          dependsOn: ['^build'],
          outputs: ['dist/**', '.next/**', '!.next/cache/**']
        },
        lint: {
          outputs: []
        },
        'lint:fix': {
          outputs: []
        },
        dev: {
          cache: false,
          persistent: true
        },
        test: {
          dependsOn: ['build'],
          outputs: ['coverage/**'],
          inputs: ['src/**', 'tests/**', 'package.json']
        },
        'test:watch': {
          cache: false,
          persistent: true
        },
        'test:coverage': {
          dependsOn: ['build'],
          outputs: ['coverage/**']
        },
        clean: {
          cache: false
        }
      }
    };

    fs.writeFileSync('turbo.json', JSON.stringify(turboConfig, null, 2));
    console.log('  ✓ Created turbo.json');

    // .gitignore
    const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
out/
.next/
*.tsbuildinfo

# Testing
coverage/
.nyc_output/

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Turborepo
.turbo/

# Changesets
.changeset/
`;

    fs.writeFileSync('.gitignore', gitignore);
    console.log('  ✓ Created .gitignore');
  }

  /**
   * Create an individual package with its complete configuration
   * 
   * Sets up a complete package structure including:
   * - Directory structure (src/, dist/)
   * - package.json with proper dependencies and scripts
   * - tsconfig.json with project references
   * - index.ts entry point
   * - README.md with usage documentation
   * - Jest configuration (if tests are enabled)
   * 
   * @private
   * @param {PackageConfig} pkg - Configuration object for the package to create
   * @param {string} pkg.name - The package name (e.g., '@company/utils')
   * @param {string} pkg.path - Relative path where package should be created
   * @param {string} pkg.description - Human-readable description of the package
   * @param {string[]} pkg.dependencies - List of package dependencies
   * @param {'app' | 'package'} pkg.type - Whether this is an application or library package
   * @param {boolean} [pkg.private] - Whether the package should be marked as private
   * @param {Record<string, string>} [pkg.scripts] - Custom npm scripts for the package
   * 
   * @throws {Error} If package directory cannot be created or files cannot be written
   * 
   * @example
   * const packageConfig = {
   *   name: '@company/utils',
   *   path: 'packages/utils',
   *   description: 'Shared utility functions',
   *   dependencies: ['@company/core-types'],
   *   type: 'package' as const,
   *   scripts: { build: 'tsc', test: 'jest' }
   * };
   * await this.createPackage(packageConfig);
   */
  private async createPackage(pkg: PackageConfig) {
    console.log(`\n📦 Creating package: ${pkg.name}`);

    // Create package directory
    const packageDir = pkg.path;
    const srcDir = path.join(packageDir, 'src');

    [packageDir, srcDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create package.json
    const packageJson = {
      name: pkg.name,
      version: '0.0.0',
      description: pkg.description,
      main: './dist/index.js',
      module: './dist/index.mjs',
      types: './dist/index.d.ts',
      private: pkg.private,
      files: ['dist', 'src'],
      scripts: {
        ...pkg.scripts,
        'type-check': 'tsc --noEmit'
      },
      dependencies: pkg.dependencies.reduce((deps, dep) => {
        if (dep.startsWith('@company/')) {
          deps[dep] = 'workspace:*';
        } else {
          const parts = dep.split('@');
          const name = parts[0] || '';
          const version = parts[1] || 'latest';
          deps[name] = version;
        }
        return deps;
      }, {} as Record<string, string>),
      devDependencies: pkg.devDependencies?.reduce((deps, dep) => {
        const parts = dep.split('@');
        const name = parts[0] || '';
        const version = parts[1] || 'latest';
        deps[name] = version;
        return deps;
      }, {} as Record<string, string>)
    };

    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    console.log('  ✓ Created package.json');

    // Create tsconfig.json
    const tsConfig = {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src'
      },
      include: ['src/**/*'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      references: pkg.dependencies
        .filter(dep => dep.startsWith('@company/'))
        .map(dep => {
          const parts = dep.split('/');
          const packageName = parts[1] || '';
          return {
            path: `../${packageName}`
          };
        })
    };

    fs.writeFileSync(
      path.join(packageDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
    console.log('  ✓ Created tsconfig.json');

    // Create index.ts
    const indexContent = `// ${pkg.name}
export const packageName = '${pkg.name}';

// Export all public APIs here
`;

    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexContent);
    console.log('  ✓ Created src/index.ts');

    // Create README.md
    const readme = `# ${pkg.name}

${pkg.description}

## Installation

\\\`\\\`\\\`bash
pnpm add ${pkg.name}
\\\`\\\`\\\`

## Usage

\\\`\\\`\\\`typescript
import { } from '${pkg.name}';
\\\`\\\`\\\`

## API

Documentation for the main MonorepoSetup class and its public methods can be found in the source code JSDoc comments.

### Key Methods

- \`initializeMonorepo()\` - Sets up the complete monorepo structure
- \`generateMigrationPlan(analysisReport: string)\` - Creates migration plan from existing codebase

### CLI Usage

Initialize a new monorepo:
\\\`\\\`\\\`bash
npx ts-node scripts/monorepo-setup.ts init
\\\`\\\`\\\`

Generate migration plan:
\\\`\\\`\\\`bash
npx ts-node scripts/monorepo-setup.ts plan <analysis-report.json>
\\\`\\\`\\\`

## License

Private
`;

    fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
    console.log('  ✓ Created README.md');

    // Create test configuration if package has tests
    if (pkg.scripts?.test) {
      const jestConfig = {
        preset: '../../jest.preset.js',
        displayName: pkg.name,
        testEnvironment: 'node',
        transform: {
          '^.+\\.ts$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.json'
          }]
        }
      };

      fs.writeFileSync(
        path.join(packageDir, 'jest.config.js'),
        `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
      );
      console.log('  ✓ Created jest.config.js');
    }
  }

  /**
   * Setup comprehensive build tooling and development tools
   * 
   * Configures essential development tools including:
   * - Jest preset with coverage thresholds and module mapping
   * - Prettier configuration for consistent code formatting
   * - ESLint configuration with TypeScript and import rules
   * - Coverage thresholds (80% for branches, functions, lines, statements)
   * 
   * @private
   * @throws {Error} If tooling configuration files cannot be created
   * 
   * @example
   * Sets up Jest with:
   * - Module name mapping for @company/asterisk packages  
   * - Coverage collection from src/glob/asterisk.ts files
   * - Exclusion of test and declaration files from coverage
   */
  private setupBuildTooling() {
    console.log('\n🔧 Setting up build tooling...');

    // Create jest preset
    const jestPreset = `module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@company/(.*)$': '<rootDir>/../$1/src'
  }
};`;

    fs.writeFileSync('jest.preset.js', jestPreset);
    console.log('  ✓ Created jest.preset.js');

    // Create prettier config
    const prettierConfig = {
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      arrowParens: 'avoid',
      endOfLine: 'lf'
    };

    fs.writeFileSync('.prettierrc', JSON.stringify(prettierConfig, null, 2));
    console.log('  ✓ Created .prettierrc');

    // Create ESLint config
    const eslintConfig = {
      root: true,
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json']
      },
      plugins: ['@typescript-eslint', 'import'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier'
      ],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'import/order': ['error', {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' }
        }]
      }
    };

    fs.writeFileSync('.eslintrc.json', JSON.stringify(eslintConfig, null, 2));
    console.log('  ✓ Created .eslintrc.json');
  }

  /**
   * Create utility scripts for monorepo management
   * 
   * Generates helpful scripts for ongoing monorepo maintenance:
   * - add-package.sh: Script to add new packages to the monorepo
   * - check-dependencies.ts: Script to detect circular dependencies
   * 
   * @private
   * @throws {Error} If script files cannot be created or permissions cannot be set
   * 
   * @example
   * Usage of generated scripts:
   * - Add a new package: ./scripts/add-package.sh my-new-package package
   * - Check for circular dependencies: npx ts-node scripts/check-dependencies.ts
   */
  private createHelperScripts() {
    console.log('\n📝 Creating helper scripts...');

    // Create add-package.sh
    const addPackageScript = `#!/bin/bash
# scripts/add-package.sh

PACKAGE_NAME=$1
PACKAGE_TYPE=\${2:-package} # package or app

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: ./scripts/add-package.sh <package-name> [package|app]"
  exit 1
fi

# Determine directory
if [ "$PACKAGE_TYPE" = "app" ]; then
  PACKAGE_DIR="apps/$PACKAGE_NAME"
else
  PACKAGE_DIR="packages/$PACKAGE_NAME"
fi

echo "Creating new package: @company/$PACKAGE_NAME in $PACKAGE_DIR"

# Create directory structure
mkdir -p "$PACKAGE_DIR/src"

# Run the setup script
npx ts-node scripts/monorepo-setup.ts add-package "$PACKAGE_NAME" "$PACKAGE_TYPE"

echo "✅ Package created successfully!"
echo "Next steps:"
echo "1. cd $PACKAGE_DIR"
echo "2. Start adding your code in src/"
echo "3. Run 'pnpm install' from the root"
`;

    fs.writeFileSync('scripts/add-package.sh', addPackageScript);
    fs.chmodSync('scripts/add-package.sh', '755');
    console.log('  ✓ Created scripts/add-package.sh');

    // Create check-dependencies.ts
    const checkDepsScript = `#!/usr/bin / env node
// scripts/check-dependencies.ts

import * as fs from 'fs';
import * as path from 'path';

interface PackageInfo {
  name: string;
  path: string;
  dependencies: string[];
  devDependencies: string[];
}

function checkCircularDependencies() {
  const packages = new Map<string, PackageInfo>();

  // Load all packages
  ['packages', 'apps'].forEach(dir => {
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(pkg => {
      const pkgPath = path.join(dir, pkg);
      const pkgJsonPath = path.join(pkgPath, 'package.json');

      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        packages.set(pkgJson.name, {
          name: pkgJson.name,
          path: pkgPath,
          dependencies: Object.keys(pkgJson.dependencies || {}),
          devDependencies: Object.keys(pkgJson.devDependencies || {})
        });
      }
    });
  });

  // Check for circular dependencies
  const visited = new Set<string>();
  const stack = new Set<string>();
  let hasCircular = false;

  function dfs(pkg: string, path: string[] = []): boolean {
    if (stack.has(pkg)) {
      console.error(\`❌ Circular dependency detected: \${path.join(' -> ')} -> \${pkg}\`);
      return true;
    }

    if (visited.has(pkg)) return false;

    visited.add(pkg);
    stack.add(pkg);

    const info = packages.get(pkg);
    if (info) {
      for (const dep of info.dependencies) {
        if (packages.has(dep)) {
          if (dfs(dep, [...path, pkg])) {
            hasCircular = true;
          }
        }
      }
    }

    stack.delete(pkg);
    return false;
  }

  packages.forEach((_, pkg) => dfs(pkg));

  if (!hasCircular) {
    console.log('✅ No circular dependencies found!');
  }

  return !hasCircular;
}

if (require.main === module) {
  process.exit(checkCircularDependencies() ? 0 : 1);
}
`;

      fs.writeFileSync('scripts/check-dependencies.ts', checkDepsScript);
      console.log('  ✓ Created scripts/check-dependencies.ts');
    }

  /**
   * Print comprehensive next steps and usage instructions
   * 
   * Displays a formatted guide with:
   * - Installation commands for the configured package manager
   * - Migration steps for existing codebases
   * - Import update instructions
   * - Build and development commands
   * - Testing and validation steps
   * 
   * @private
   * 
   * @example
   * Outputs guidance like:
   * - "pnpm install" to install dependencies
   * - Migration steps for moving existing code
   * - "pnpm run build" to build all packages
   * - "pnpm run dev" to start development
   */
  private printNextSteps() {
      console.log(`
${'-'.repeat(60)}

🎉 Monorepo structure created successfully!

Next steps:

1. Install dependencies:
   ${this.config.packageManager} install

2. Migrate existing code:
   - Move types to packages/core-types
   - Move error classes to packages/errors
   - Move utilities to packages/utils
   - Move services to packages/services
   - Move API code to apps/api

3. Update imports:
   - Change relative imports to package imports
   - Example: '../types/user' → '@company/core-types'

4. Build all packages:
   ${this.config.packageManager} run build

5. Start development:
   ${this.config.packageManager} run dev

6. Run tests:
   ${this.config.packageManager} run test

For more information, see the generated README files in each package.
`);
    }

  /**
   * Generate a comprehensive migration plan from an existing codebase analysis
   * 
   * Analyzes a codebase report and creates a phased migration plan with:
   * - Phase-by-phase migration strategy
   * - File movement recommendations
   * - Import update strategies
   * - Effort estimation for each phase
   * 
   * The migration plan includes phases for:
   * 1. Core types (interfaces, types, enums) → @company/core-types
   * 2. Error classes → @company/errors
   * 3. Utility functions → @company/utils
   * 4. Additional phases based on codebase analysis
   * 
   * @param {string} analysisReport - Path to the JSON analysis report file
   * @returns {Promise<Object>} Migration plan object with phases and file movements
   * 
   * @throws {Error} If analysis report cannot be read or is malformed
   * @throws {Error} If migration plan file cannot be written
   * 
   * @example
   * 
   * const setup = new MonorepoSetup();
   * try {
   *   const plan = await setup.generateMigrationPlan('./analysis-report.json');
   *   console.log(`Generated ${plan.phases.length} migration phases`);
   * } catch (error) {
   *   console.error('Failed to generate migration plan:', error);
   * }
   * 
   * 
   * @example
   * Expected analysis report format:
   * 
   * {
   *   "entities": [
   *     {
   *       "name": "User",
   *       "type": "interface",
   *       "file": "src/types/user.ts"
   *     },
   *     {
   *       "name": "ValidationError",
   *       "type": "class",
   *       "file": "src/errors/validation.ts"
   *     }
   *   ]
   * }
   * 
   */
  async generateMigrationPlan(analysisReport: string) {
      console.log('📋 Generating migration plan...\n');

      const report = JSON.parse(fs.readFileSync(analysisReport, 'utf-8'));
      const migrationPlan: any = {
        phases: [],
        fileMovements: {},
        importUpdates: []
      };

      // Phase 1: Move core types
      const typeFiles = report.entities
        .filter((e: any) => e.type === 'interface' || e.type === 'type' || e.type === 'enum')
        .map((e: any) => e.file)
        .filter((f: string, i: number, a: string[]) => a.indexOf(f) === i); // unique

      migrationPlan.phases.push({
        phase: 1,
        name: 'Migrate Core Types',
        description: 'Move all interfaces, types, and enums to @company/core-types',
        files: typeFiles,
        targetPackage: '@company/core-types',
        estimatedEffort: 'Low'
      });

      // Phase 2: Move error classes
      const errorFiles = report.entities
        .filter((e: any) => e.name.includes('Error') && e.type === 'class')
        .map((e: any) => e.file)
        .filter((f: string, i: number, a: string[]) => a.indexOf(f) === i);

      migrationPlan.phases.push({
        phase: 2,
        name: 'Migrate Error Classes',
        description: 'Move all error classes to @company/errors',
        files: errorFiles,
        targetPackage: '@company/errors',
        estimatedEffort: 'Low'
      });

      // Phase 3: Move utilities
      const utilFiles = report.entities
        .filter((e: any) =>
          e.file.includes('util') ||
          e.file.includes('helper') ||
          (e.type === 'function' && !e.file.includes('service'))
        )
        .map((e: any) => e.file)
        .filter((f: string, i: number, a: string[]) => a.indexOf(f) === i);

      migrationPlan.phases.push({
        phase: 3,
        name: 'Migrate Utilities',
        description: 'Move utility functions to @company/utils',
        files: utilFiles,
        targetPackage: '@company/utils',
        estimatedEffort: 'Medium'
      });

      // Save migration plan
      const planContent = `# Monorepo Migration Plan

Generated: ${new Date().toISOString()}

## Overview

This plan outlines the migration of your codebase to a monorepo structure.

## Phases

${migrationPlan.phases.map((phase: any) => `
### Phase ${phase.phase}: ${phase.name}

**Target Package**: ${phase.targetPackage}
**Files to Move**: ${phase.files.length}
**Estimated Effort**: ${phase.estimatedEffort}

${phase.description}

Sample files:
${phase.files.slice(0, 5).map((f: string) => `- ${f}`).join('\n')}
${phase.files.length > 5 ? `- ... and ${phase.files.length - 5} more` : ''}
`).join('\n')}

## Import Update Strategy

After moving files, update imports using:
\`\`\`bash
npx ts-node scripts/update-imports.ts --from "../types/*" --to "@company/core-types"
\`\`\`

## Verification Steps

1. Run type checking: \`pnpm run type-check\`
2. Run tests: \`pnpm run test\`
3. Check circular dependencies: \`pnpm run check:deps\`
4. Build all packages: \`pnpm run build\`
`;

      fs.writeFileSync('MIGRATION_PLAN.md', planContent);
      console.log('✅ Migration plan saved to MIGRATION_PLAN.md');

      return migrationPlan;
    }
  }

  // CLI interface
  if (require.main === module) {
    const setup = new MonorepoSetup();
    const command = process.argv[2];
    const arg = process.argv[3];

    switch (command) {
      case 'init':
        setup.initializeMonorepo()
          .catch(error => {
            console.error('❌ Setup failed:', error);
            process.exit(1);
          });
        break;

      case 'plan':
        if (!arg) {
          console.error('Usage: monorepo-setup.ts plan <analysis-report.json>');
          process.exit(1);
        }
        setup.generateMigrationPlan(arg)
          .catch(error => {
            console.error('❌ Failed to generate plan:', error);
            process.exit(1);
          });
        break;

      default:
        console.log(`
Usage: monorepo-setup.ts <command> [args]

Commands:
  init                    - Initialize monorepo structure
  plan <analysis-report>  - Generate migration plan from analysis
      `);
    }
  }
