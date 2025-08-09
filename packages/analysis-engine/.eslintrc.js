module.exports = {
  extends: ['../../config/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
  },
  env: {
    node: true,
  },
};