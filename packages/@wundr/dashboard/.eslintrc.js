module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  globals: {
    WebSocket: 'readonly',
    CloseEvent: 'readonly',
    MessageEvent: 'readonly',
    NodeJS: 'readonly',
    requestAnimationFrame: 'readonly',
    window: 'readonly',
    document: 'readonly',
  },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  extends: ['next/core-web-vitals'],
};