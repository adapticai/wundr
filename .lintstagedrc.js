module.exports = {
  '*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{js,jsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,yaml,yml,md}': ['prettier --write'],
  '*.{css,scss,less}': ['prettier --write'],
};
