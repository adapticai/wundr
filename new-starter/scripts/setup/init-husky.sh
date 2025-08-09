#!/bin/bash

# Initialize Husky
npx husky-init && npm install

# Pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"

# Commit message hook
npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"

# Pre-push hook
npx husky add .husky/pre-push "npm run type-check && npm test"

# Create lint-staged config
cat > .lintstagedrc.json << 'EEOF'
{
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.css": [
    "prettier --write"
  ]
}
EEOF

# Create commitlint config
cat > commitlint.config.js << 'EEOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'revert',
        'build',
        'ci'
      ]
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100]
  }
};
EEOF
