module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // React specific rules
    'react/react-in-jsx-scope': 'off', // Next.js handles this
    'react/prop-types': 'off', // Using TypeScript
    'react/jsx-uses-react': 'off', // Next.js handles this
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // TypeScript rules (minimal set to avoid conflicts)
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',

    // Accessibility adjustments for Next.js
    'jsx-a11y/anchor-is-valid': ['error', {
      components: ['Link'],
      specialLink: ['hrefLeft', 'hrefRight'],
      aspects: ['invalidHref', 'preferButton']
    }],

    // Allow console in development scripts
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }]
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['pages/**/*', 'app/**/*', 'src/pages/**/*', 'src/app/**/*'],
      rules: {
        'import/no-default-export': 'off', // Next.js requires default exports
        '@typescript-eslint/explicit-module-boundary-types': 'off'
      }
    },
    {
      files: ['app/api/**/*', 'pages/api/**/*'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off', // Allow require in API routes
        'no-console': 'off' // Allow console in API routes
      }
    },
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'jsx-a11y/anchor-is-valid': 'off'
      }
    }
  ]
};