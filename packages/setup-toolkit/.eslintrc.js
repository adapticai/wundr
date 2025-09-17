module.exports = {
  extends: ['../../config/eslint-config/type-aware'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
  },
};