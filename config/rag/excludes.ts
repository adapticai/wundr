/**
 * RAG File Exclusion and Inclusion Patterns
 *
 * This module defines patterns for filtering files during RAG indexing,
 * including global excludes, include patterns, and file type mappings.
 */

/**
 * Global patterns to exclude from RAG indexing
 * These patterns match files and directories that should never be indexed.
 */
export const GLOBAL_EXCLUDES: readonly string[] = [
  // Version Control
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/.bzr/**',

  // Package Management
  '**/node_modules/**',
  '**/vendor/**',
  '**/bower_components/**',
  '**/.pnpm/**',
  '**/pnpm-lock.yaml',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/composer.lock',
  '**/Cargo.lock',
  '**/Gemfile.lock',
  '**/poetry.lock',
  '**/Pipfile.lock',

  // Build Output
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/output/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/target/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.pyo',
  '**/.cache/**',
  '**/coverage/**',
  '**/.nyc_output/**',

  // IDE and Editor
  '**/.idea/**',
  '**/.vscode/**',
  '**/.vs/**',
  '**/*.swp',
  '**/*.swo',
  '**/*~',
  '**/.project',
  '**/.classpath',
  '**/.settings/**',

  // OS Files
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/desktop.ini',

  // Logs and Temporary Files
  '**/logs/**',
  '**/*.log',
  '**/tmp/**',
  '**/temp/**',
  '**/.temp/**',
  '**/.tmp/**',

  // Binary and Media Files
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.bin',
  '**/*.obj',
  '**/*.o',
  '**/*.a',
  '**/*.lib',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.bmp',
  '**/*.ico',
  '**/*.svg',
  '**/*.webp',
  '**/*.mp3',
  '**/*.mp4',
  '**/*.wav',
  '**/*.avi',
  '**/*.mov',
  '**/*.pdf',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  '**/*.rar',
  '**/*.7z',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
  '**/*.otf',

  // Database and Data Files
  '**/*.sqlite',
  '**/*.db',
  '**/*.sqlite3',
  '**/*.mdb',

  // Environment and Secrets
  '**/.env',
  '**/.env.*',
  '**/secrets/**',
  '**/credentials/**',
  '**/*.pem',
  '**/*.key',
  '**/*.cert',
  '**/*.crt',

  // Documentation Build Output
  '**/docs/_build/**',
  '**/.docusaurus/**',
  '**/site/**',

  // Test Fixtures and Snapshots (optionally exclude)
  '**/__snapshots__/**',
  '**/fixtures/**',

  // Minified Files
  '**/*.min.js',
  '**/*.min.css',
  '**/*.bundle.js',
  '**/*.chunk.js',

  // Source Maps
  '**/*.map',

  // Type Declaration Files (can be optional)
  '**/*.d.ts',

  // Generated Files
  '**/generated/**',
  '**/.generated/**',
  '**/auto-generated/**',
] as const;

/**
 * Default include patterns for common file types
 * These patterns define which files should be included for RAG indexing by default.
 */
export const DEFAULT_INCLUDE_PATTERNS: readonly string[] = [
  // TypeScript and JavaScript
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',

  // Python
  '**/*.py',
  '**/*.pyi',

  // Web
  '**/*.html',
  '**/*.htm',
  '**/*.css',
  '**/*.scss',
  '**/*.sass',
  '**/*.less',
  '**/*.vue',
  '**/*.svelte',

  // Documentation
  '**/*.md',
  '**/*.mdx',
  '**/*.rst',
  '**/*.txt',

  // Configuration
  '**/*.json',
  '**/*.yaml',
  '**/*.yml',
  '**/*.toml',
  '**/*.xml',
  '**/*.ini',
  '**/*.conf',

  // Shell Scripts
  '**/*.sh',
  '**/*.bash',
  '**/*.zsh',
  '**/*.fish',
  '**/*.ps1',
  '**/*.bat',
  '**/*.cmd',

  // Other Languages
  '**/*.go',
  '**/*.rs',
  '**/*.java',
  '**/*.kt',
  '**/*.scala',
  '**/*.rb',
  '**/*.php',
  '**/*.c',
  '**/*.cpp',
  '**/*.h',
  '**/*.hpp',
  '**/*.cs',
  '**/*.swift',
  '**/*.m',
  '**/*.mm',
  '**/*.r',
  '**/*.R',
  '**/*.sql',
  '**/*.graphql',
  '**/*.gql',
  '**/*.proto',

  // Build Files
  '**/Dockerfile',
  '**/docker-compose*.yml',
  '**/Makefile',
  '**/CMakeLists.txt',
  '**/*.gradle',
  '**/pom.xml',
  '**/Cargo.toml',
  '**/Gemfile',
  '**/requirements.txt',
  '**/pyproject.toml',
  '**/setup.py',
] as const;

/**
 * File type category
 */
export type FileTypeCategory =
  | 'code'
  | 'config'
  | 'docs'
  | 'tests'
  | 'scripts'
  | 'data';

/**
 * File type mapping configuration
 */
export interface FileTypeMapping {
  /** Category name */
  category: FileTypeCategory;
  /** Human-readable description */
  description: string;
  /** File extensions (without dot) */
  extensions: readonly string[];
  /** Glob patterns for matching */
  patterns: readonly string[];
}

/**
 * Mappings for different file type categories
 * Used to classify and filter files during RAG operations.
 */
export const FILE_TYPE_MAPPINGS: Record<FileTypeCategory, FileTypeMapping> = {
  code: {
    category: 'code',
    description: 'Source code files',
    extensions: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'mjs',
      'cjs',
      'py',
      'pyi',
      'go',
      'rs',
      'java',
      'kt',
      'scala',
      'rb',
      'php',
      'c',
      'cpp',
      'h',
      'hpp',
      'cc',
      'cxx',
      'cs',
      'swift',
      'm',
      'mm',
      'vue',
      'svelte',
    ],
    patterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.py',
      '**/*.pyi',
      '**/*.go',
      '**/*.rs',
      '**/*.java',
      '**/*.kt',
      '**/*.scala',
      '**/*.rb',
      '**/*.php',
      '**/*.c',
      '**/*.cpp',
      '**/*.h',
      '**/*.hpp',
      '**/*.cc',
      '**/*.cxx',
      '**/*.cs',
      '**/*.swift',
      '**/*.m',
      '**/*.mm',
      '**/*.vue',
      '**/*.svelte',
    ],
  },
  config: {
    category: 'config',
    description: 'Configuration files',
    extensions: ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'env'],
    patterns: [
      '**/*.json',
      '**/*.yaml',
      '**/*.yml',
      '**/*.toml',
      '**/*.xml',
      '**/*.ini',
      '**/*.conf',
      '**/.*rc',
      '**/.*rc.js',
      '**/.*rc.json',
      '**/.*rc.yaml',
      '**/.*rc.yml',
      '**/.editorconfig',
      '**/.gitignore',
      '**/.gitattributes',
      '**/.npmignore',
      '**/.dockerignore',
      '**/tsconfig*.json',
      '**/package.json',
      '**/pyproject.toml',
      '**/Cargo.toml',
    ],
  },
  docs: {
    category: 'docs',
    description: 'Documentation files',
    extensions: ['md', 'mdx', 'rst', 'txt', 'adoc', 'asciidoc'],
    patterns: [
      '**/*.md',
      '**/*.mdx',
      '**/*.rst',
      '**/*.txt',
      '**/*.adoc',
      '**/*.asciidoc',
      '**/README*',
      '**/CHANGELOG*',
      '**/CONTRIBUTING*',
      '**/LICENSE*',
      '**/AUTHORS*',
      '**/HISTORY*',
      '**/docs/**/*',
      '**/documentation/**/*',
    ],
  },
  tests: {
    category: 'tests',
    description: 'Test files',
    extensions: [],
    patterns: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
      '**/*_test.py',
      '**/test_*.py',
      '**/*_test.go',
      '**/*Test.java',
      '**/*Spec.java',
      '**/*_spec.rb',
      '**/spec/**/*.rb',
      '**/__tests__/**/*',
      '**/tests/**/*',
      '**/test/**/*',
      '**/spec/**/*',
    ],
  },
  scripts: {
    category: 'scripts',
    description: 'Shell scripts and automation',
    extensions: ['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'],
    patterns: [
      '**/*.sh',
      '**/*.bash',
      '**/*.zsh',
      '**/*.fish',
      '**/*.ps1',
      '**/*.bat',
      '**/*.cmd',
      '**/scripts/**/*',
      '**/bin/**/*',
      '**/Makefile',
      '**/Rakefile',
      '**/Taskfile*',
    ],
  },
  data: {
    category: 'data',
    description: 'Data files (JSON, CSV, etc.)',
    extensions: ['json', 'csv', 'tsv', 'xml', 'graphql', 'gql', 'sql', 'proto'],
    patterns: [
      '**/*.csv',
      '**/*.tsv',
      '**/*.graphql',
      '**/*.gql',
      '**/*.sql',
      '**/*.proto',
      '**/data/**/*.json',
      '**/fixtures/**/*.json',
      '**/seeds/**/*',
      '**/migrations/**/*',
    ],
  },
} as const;

/**
 * Gets patterns for a specific file type category
 *
 * @param category - The file type category
 * @returns Array of glob patterns for the category
 */
export const getPatternsForCategory = (
  category: FileTypeCategory
): readonly string[] => {
  return FILE_TYPE_MAPPINGS[category].patterns;
};

/**
 * Gets all extensions for a specific file type category
 *
 * @param category - The file type category
 * @returns Array of file extensions (without dots)
 */
export const getExtensionsForCategory = (
  category: FileTypeCategory
): readonly string[] => {
  return FILE_TYPE_MAPPINGS[category].extensions;
};

/**
 * Determines the file type category for a given file path
 *
 * @param filePath - Path to the file
 * @returns The file type category or undefined if not matched
 */
export const categorizeFile = (
  filePath: string
): FileTypeCategory | undefined => {
  const extension = filePath.split('.').pop()?.toLowerCase();

  if (!extension) {
    return undefined;
  }

  for (const [category, mapping] of Object.entries(FILE_TYPE_MAPPINGS)) {
    if (mapping.extensions.includes(extension)) {
      return category as FileTypeCategory;
    }
  }

  // Check for test files specifically
  if (
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('_test.') ||
    filePath.includes('test_') ||
    filePath.includes('/__tests__/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/test/') ||
    filePath.includes('/spec/')
  ) {
    return 'tests';
  }

  return undefined;
};

/**
 * Creates a combined include pattern list from selected categories
 *
 * @param categories - Array of file type categories to include
 * @returns Combined array of glob patterns
 */
export const createIncludePatternsFromCategories = (
  categories: FileTypeCategory[]
): string[] => {
  const patterns: string[] = [];

  for (const category of categories) {
    patterns.push(...FILE_TYPE_MAPPINGS[category].patterns);
  }

  // Remove duplicates
  return Array.from(new Set(patterns));
};

/**
 * Checks if a file path should be excluded based on global excludes
 *
 * @param filePath - Path to check
 * @param additionalExcludes - Additional exclude patterns
 * @returns true if the file should be excluded
 */
export const shouldExclude = (
  filePath: string,
  additionalExcludes: readonly string[] = []
): boolean => {
  const allExcludes = [...GLOBAL_EXCLUDES, ...additionalExcludes];
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of allExcludes) {
    // Simple pattern matching for common cases
    const normalizedPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    const regex = new RegExp(
      `^${normalizedPattern}$|/${normalizedPattern}$|${normalizedPattern}/`
    );

    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
};
