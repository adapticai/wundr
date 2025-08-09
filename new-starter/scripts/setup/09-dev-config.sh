#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[CONFIG] $1" | tee -a "$LOG_FILE"
}

setup_eslint() {
    log "Setting up ESLint configuration..."
    
    cat > "${SCRIPT_DIR}/config/eslint/eslint.config.js" << 'EOF'
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json'
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'import',
    'prettier',
    'jest',
    'testing-library',
    'promise',
    'unicorn',
    'security'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:jest/recommended',
    'plugin:testing-library/react',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
    'plugin:security/recommended',
    'prettier'
  ],
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I']
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      }
    ],
    
    // React
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // Import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    
    // General
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Unicorn
    'unicorn/filename-case': [
      'error',
      {
        cases: {
          camelCase: true,
          pascalCase: true,
          kebabCase: true
        }
      }
    ],
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-array-reduce': 'off'
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};
EOF
    
    log "ESLint configuration created"
}

setup_prettier() {
    log "Setting up Prettier configuration..."
    
    cat > "${SCRIPT_DIR}/config/prettier/.prettierrc.json" << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "proseWrap": "preserve",
  "htmlWhitespaceSensitivity": "css",
  "embeddedLanguageFormatting": "auto",
  "quoteProps": "as-needed",
  "vueIndentScriptAndStyle": false,
  "singleAttributePerLine": false,
  "importOrder": [
    "^react",
    "^next",
    "^@?\\w",
    "^[./]"
  ],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"]
}
EOF
    
    cat > "${SCRIPT_DIR}/config/prettier/.prettierignore" << 'EOF'
# Dependencies
node_modules/
.pnpm-store/
.yarn/

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.turbo/

# Cache
.cache/
.parcel-cache/

# Logs
*.log
logs/

# Coverage
coverage/
.nyc_output/

# Environment
.env*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Generated files
*.min.js
*.min.css
package-lock.json
yarn.lock
pnpm-lock.yaml
EOF
    
    log "Prettier configuration created"
}

setup_typescript() {
    log "Setting up TypeScript configuration..."
    
    cat > "${SCRIPT_DIR}/config/typescript/tsconfig.base.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "inlineSources": true,
    
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    
    "pretty": true,
    "removeComments": false,
    "preserveConstEnums": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@types/*": ["src/types/*"],
      "@config/*": ["src/config/*"]
    }
  },
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "*.config.js",
    "*.config.ts"
  ]
}
EOF
    
    cat > "${SCRIPT_DIR}/config/typescript/tsconfig.node.json" << 'EOF'
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node", "jest"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
EOF
    
    cat > "${SCRIPT_DIR}/config/typescript/tsconfig.react.json" << 'EOF'
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "types": ["react", "react-dom", "node", "jest"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "next-env.d.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
EOF
    
    log "TypeScript configurations created"
}

setup_husky_hooks() {
    log "Setting up Git hooks with Husky..."
    
    cat > "${SCRIPT_DIR}/scripts/setup/init-husky.sh" << 'EOF'
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
EOF
    
    chmod +x "${SCRIPT_DIR}/scripts/setup/init-husky.sh"
    log "Husky hooks setup script created"
}

setup_jest_config() {
    log "Setting up Jest configuration..."
    
    cat > "${SCRIPT_DIR}/config/jest.config.js" << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true
};
EOF
    
    log "Jest configuration created"
}

create_editorconfig() {
    log "Creating .editorconfig..."
    
    cat > "${SCRIPT_DIR}/.editorconfig" << 'EOF'
# EditorConfig is awesome: https://EditorConfig.org

root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{ts,tsx,js,jsx,json}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 100

[*.yml]
indent_size = 2

[Makefile]
indent_style = tab

[*.{sh,bash}]
indent_size = 4
EOF
    
    log ".editorconfig created"
}

create_nvmrc() {
    log "Creating .nvmrc..."
    
    echo "20" > "${SCRIPT_DIR}/.nvmrc"
    
    log ".nvmrc created"
}

create_package_json() {
    log "Creating package.json template..."
    
    cat > "${SCRIPT_DIR}/package.json" << 'EOF'
{
  "name": "new-starter",
  "version": "1.0.0",
  "description": "Development environment setup for Node.js engineers",
  "private": true,
  "scripts": {
    "setup": "./setup.sh",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prepare": "husky install",
    "lint-staged": "lint-staged"
  },
  "devDependencies": {
    "@commitlint/cli": "^18.0.0",
    "@commitlint/config-conventional": "^18.0.0",
    "@trivago/prettier-plugin-sort-imports": "^4.3.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-import-resolver-typescript": "^3.6.0",
    "eslint-plugin-import": "^2.28.0",
    "eslint-plugin-jest": "^27.4.0",
    "eslint-plugin-jsx-a11y": "^6.7.0",
    "eslint-plugin-prettier": "^5.0.0",
    "eslint-plugin-promise": "^6.1.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-security": "^1.7.0",
    "eslint-plugin-testing-library": "^6.0.0",
    "eslint-plugin-unicorn": "^49.0.0",
    "husky": "^8.0.0",
    "jest": "^29.7.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "tsx": "^4.0.0",
    "typescript": "^5.2.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
EOF
    
    log "package.json template created"
}

main() {
    log "Starting development configuration setup..."
    
    setup_eslint
    setup_prettier
    setup_typescript
    setup_husky_hooks
    setup_jest_config
    create_editorconfig
    create_nvmrc
    create_package_json
    
    log "Development configuration completed"
}

main