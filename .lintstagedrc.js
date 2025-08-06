module.exports = {
  // TypeScript files
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit'
  ],
  
  // JavaScript files
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write'
  ],
  
  // JSON, YAML, Markdown files
  '*.{json,yml,yaml,md}': [
    'prettier --write'
  ],
  
  // Package.json files - sort dependencies
  'package.json': [
    'prettier --write',
    'npx sort-package-json'
  ]
};