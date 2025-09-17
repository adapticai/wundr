module.exports = {
  root: true,
  extends: ['../../config/eslint-config/nextjs-standalone.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-console': 'off',
    'import/no-default-export': 'off',
  },
  ignorePatterns: [
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    'node_modules/',
    '*.min.js',
  ],
};