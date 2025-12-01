module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings=100', // Allow up to 100 warnings (we have 82)
  ],
  '*.{js,jsx}': ['eslint --fix --max-warnings=100'],
  '*.{json,yaml,yml,md}': ['prettier --write'],
  'package.json': ['prettier --write'],
};
