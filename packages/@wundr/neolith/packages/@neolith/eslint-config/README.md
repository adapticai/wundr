# @genesis/eslint-config

Shared ESLint configurations for the Genesis monorepo.

## Installation

```bash
pnpm add -D @genesis/eslint-config eslint typescript
```

## Available Configurations

### Base Configuration

The base configuration provides TypeScript support with strict type checking rules.

```js
// .eslintrc.js
module.exports = {
  extends: ['@genesis/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### Next.js Configuration

Extended configuration for Next.js applications with React support.

```js
// .eslintrc.js
module.exports = {
  extends: ['@genesis/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### Library Configuration

Stricter configuration for shared packages with documentation requirements.

```js
// .eslintrc.js
module.exports = {
  extends: ['@genesis/eslint-config/library'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

## Configuration Features

### Base (`@genesis/eslint-config/base`)

- TypeScript strict type checking
- Explicit function return types
- No explicit `any` types
- Strict boolean expressions
- Promise handling rules
- Prettier compatibility

### Next.js (`@genesis/eslint-config/next`)

- All base rules (with some relaxed for app code)
- Next.js core web vitals
- React and React Hooks rules
- Automatic detection of React version
- Special handling for Next.js file conventions (pages, layouts, etc.)

### Library (`@genesis/eslint-config/library`)

- All base rules (stricter)
- JSDoc documentation requirements for exported functions
- Consistent type imports
- No console statements
- Import organization

## Customization

You can override any rules in your project's ESLint configuration:

```js
// .eslintrc.js
module.exports = {
  extends: ['@genesis/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    // Override specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
  },
};
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes the files you want to lint:

```json
{
  "compilerOptions": {
    "strict": true
  },
  "include": ["src/**/*", ".eslintrc.js"]
}
```

## Integration with Prettier

All configurations include `eslint-config-prettier` to disable formatting rules that conflict with
Prettier. Make sure to run Prettier separately for formatting.
