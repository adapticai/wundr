module.exports = {
  root: true,
  extends: ['../../config/eslint-config/nextjs-standalone.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
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