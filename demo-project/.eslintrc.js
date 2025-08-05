module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    '../config/eslint/custom-rules', // Include custom governance rules
  ],
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Error handling
    'no-throw-literal': 'error',
    
    // Custom governance rules
    '../config/eslint/custom-rules/no-wrapper-pattern': 'error',
    '../config/eslint/custom-rules/use-app-error': 'error',
    '../config/eslint/custom-rules/no-duplicate-enum-values': 'error',
    '../config/eslint/custom-rules/service-must-extend-base': 'error',
    '../config/eslint/custom-rules/async-method-naming': 'warn',
    '../config/eslint/custom-rules/no-direct-db-access': 'error',
    '../config/eslint/custom-rules/max-file-lines': ['warn', { max: 300 }],
  }
};