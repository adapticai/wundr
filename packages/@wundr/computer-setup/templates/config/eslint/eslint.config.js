module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: {{ECMA_VERSION}},
    sourceType: 'module',
    {{#REACT_PROJECT}}ecmaFeatures: {
      jsx: true
    },{{/REACT_PROJECT}}
    project: './tsconfig.json'
  },
  env: {
    browser: {{BROWSER_ENVIRONMENT}},
    node: {{NODE_ENVIRONMENT}},
    es2022: true,
    jest: {{JEST_ENVIRONMENT}}
  },
  plugins: [
    '@typescript-eslint',
    {{#REACT_PROJECT}}'react',
    'react-hooks',
    'jsx-a11y',{{/REACT_PROJECT}}
    'import',
    'prettier',
    {{#JEST_ENVIRONMENT}}'jest',
    'testing-library',{{/JEST_ENVIRONMENT}}
    'promise',
    'unicorn',
    {{#SECURITY_RULES}}'security'{{/SECURITY_RULES}}
  ],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    {{#STRICT_TYPE_CHECKING}}'@typescript-eslint/recommended-requiring-type-checking',{{/STRICT_TYPE_CHECKING}}
    {{#REACT_PROJECT}}'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',{{/REACT_PROJECT}}
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    {{#JEST_ENVIRONMENT}}'plugin:jest/recommended',
    'plugin:testing-library/react',{{/JEST_ENVIRONMENT}}
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
    {{#SECURITY_RULES}}'plugin:security/recommended',{{/SECURITY_RULES}}
    'prettier'
  ],
  settings: {
    {{#REACT_PROJECT}}react: {
      version: 'detect'
    },{{/REACT_PROJECT}}
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': '{{EXPLICIT_RETURN_TYPES}}',
    '@typescript-eslint/explicit-module-boundary-types': '{{EXPLICIT_BOUNDARY_TYPES}}',
    '@typescript-eslint/no-explicit-any': '{{NO_EXPLICIT_ANY}}',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': '{{NO_NON_NULL_ASSERTION}}',
    '@typescript-eslint/consistent-type-imports': '{{CONSISTENT_TYPE_IMPORTS}}',
    '@typescript-eslint/naming-convention': [
      '{{NAMING_CONVENTION_LEVEL}}',
      {
        selector: 'interface',
        format: ['PascalCase'],
        {{#INTERFACE_PREFIX}}prefix: ['I']{{/INTERFACE_PREFIX}}
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      }
    ],
    
    {{#REACT_PROJECT}}// React
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',{{/REACT_PROJECT}}
    
    // Import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': '{{IMPORT_CYCLE_DETECTION}}',
    'import/no-self-import': 'error',
    
    // General
    'no-console': ['{{CONSOLE_RULE_LEVEL}}', { allow: ['warn', 'error'] }],
    'no-debugger': '{{DEBUGGER_RULE_LEVEL}}',
    'no-alert': '{{ALERT_RULE_LEVEL}}',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': '{{PREFER_TEMPLATE}}',
    'prefer-arrow-callback': '{{PREFER_ARROW_CALLBACK}}',
    'arrow-body-style': ['{{ARROW_BODY_STYLE}}', 'as-needed'],
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Unicorn
    'unicorn/filename-case': [
      'error',
      {
        cases: {
          camelCase: {{CAMEL_CASE_FILES}},
          pascalCase: {{PASCAL_CASE_FILES}},
          kebabCase: {{KEBAB_CASE_FILES}}
        }
      }
    ],
    'unicorn/prevent-abbreviations': '{{PREVENT_ABBREVIATIONS}}',
    'unicorn/no-null': '{{NO_NULL_RULE}}',
    'unicorn/no-array-reduce': '{{NO_ARRAY_REDUCE}}'
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'{{#ADDITIONAL_TEST_OVERRIDES}},
        {{ADDITIONAL_TEST_OVERRIDES}}{{/ADDITIONAL_TEST_OVERRIDES}}
      }
    }{{#ADDITIONAL_OVERRIDES}},
    {{ADDITIONAL_OVERRIDES}}{{/ADDITIONAL_OVERRIDES}}
  ]
};