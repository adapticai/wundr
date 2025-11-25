/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base.js'],
  plugins: ['jsdoc'],
  rules: {
    // Stricter rules for library packages
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-import-type-side-effects': 'error',

    // Documentation requirements
    'jsdoc/require-jsdoc': [
      'error',
      {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
        contexts: [
          'ExportNamedDeclaration > FunctionDeclaration',
          'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
          'ExportDefaultDeclaration > FunctionDeclaration',
        ],
        checkConstructors: false,
      },
    ],
    'jsdoc/require-description': [
      'warn',
      {
        contexts: [
          'FunctionDeclaration',
          'MethodDefinition',
          'ClassDeclaration',
        ],
      },
    ],
    'jsdoc/require-param': 'warn',
    'jsdoc/require-param-type': 'off', // TypeScript handles this
    'jsdoc/require-returns': 'warn',
    'jsdoc/require-returns-type': 'off', // TypeScript handles this
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/valid-types': 'off', // TypeScript handles this

    // No console in library code
    'no-console': 'error',

    // Ensure imports are properly organized
    'sort-imports': [
      'error',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],
  },
  overrides: [
    {
      // Test files have relaxed rules
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        'jsdoc/require-jsdoc': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-console': 'off',
      },
    },
    {
      // Index files can have simpler exports
      files: ['**/index.ts', '**/index.tsx'],
      rules: {
        'jsdoc/require-jsdoc': 'off',
      },
    },
  ],
};
