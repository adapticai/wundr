module.exports = {
  extends: ['next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    // React specific rules
    'react/react-in-jsx-scope': 'off', // Next.js handles this
    'react/prop-types': 'off', // Using TypeScript
    'react/jsx-uses-react': 'off', // Next.js handles this
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Allow console in development scripts
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['pages/**/*', 'app/**/*', 'src/pages/**/*', 'src/app/**/*'],
      rules: {
        'import/no-default-export': 'off', // Next.js requires default exports
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'jsx-a11y/anchor-is-valid': 'off',
      },
    },
  ],
};
