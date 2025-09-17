module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'unused-imports',
    'jest'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:jest/recommended'
  ],
  rules: {
    'no-console': 'off',
    'no-debugger': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-async-promise-executor': 'off',
    'no-case-declarations': 'off',
    'no-useless-escape': 'off',
    'no-prototype-builtins': 'off',
    'import/order': 'off',
    'import/no-duplicates': 'error',
    'import/no-default-export': 'off',
    'import/no-named-as-default-member': 'off',
    'import/prefer-default-export': 'off',
    'unused-imports/no-unused-imports': 'off'
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-default-export': 'off'
      }
    },
    {
      files: ['scripts/**/*.ts'],
      rules: {
        'no-console': 'off',
        'import/no-default-export': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  }
};