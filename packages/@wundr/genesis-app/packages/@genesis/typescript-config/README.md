# @genesis/typescript-config

Shared TypeScript configurations for the Genesis monorepo.

## Available Configurations

### base.json

The foundational TypeScript configuration with strict mode enabled. All other configs extend from
this.

**Features:**

- Strict type checking (`strict: true`)
- No implicit any (`noImplicitAny: true`)
- Strict null checks (`strictNullChecks: true`)
- No unused locals/parameters
- ES2022 target
- Bundler module resolution

**Usage:**

```json
{
  "extends": "@genesis/typescript-config/base.json"
}
```

### nextjs.json

Configuration optimized for Next.js applications.

**Features:**

- Extends base.json
- JSX preserve mode for Next.js compilation
- DOM and ESNext libraries
- Next.js TypeScript plugin
- Isolated modules for faster builds

**Usage:**

```json
{
  "extends": "@genesis/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### react-library.json

Configuration for building React component libraries.

**Features:**

- Extends base.json
- React JSX transform (`jsx: react-jsx`)
- Declaration file generation
- Declaration maps for debugging
- Source maps
- Composite projects support

**Usage:**

```json
{
  "extends": "@genesis/typescript-config/react-library.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### node.json

Configuration for Node.js packages and services.

**Features:**

- Extends base.json
- NodeNext module system
- NodeNext module resolution
- Declaration file generation
- Source maps

**Usage:**

```json
{
  "extends": "@genesis/typescript-config/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Installation

This package is internal to the Genesis monorepo and is automatically available through workspace
configuration.

## Customization

Each configuration can be extended and customized by adding additional compiler options in your
project's `tsconfig.json`:

```json
{
  "extends": "@genesis/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```
