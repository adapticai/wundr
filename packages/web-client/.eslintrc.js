module.exports = {
  extends: ['../../config/eslint-config/nextjs.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};