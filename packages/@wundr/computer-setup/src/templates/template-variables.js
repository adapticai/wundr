"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTemplateVariables = getDefaultTemplateVariables;
exports.createDefaultTemplateContext = createDefaultTemplateContext;
exports.getConfigTemplateVariables = getConfigTemplateVariables;
/**
 * Get default template variables for common configurations
 */
function getDefaultTemplateVariables(profile, projectType = 'node') {
    return {
        // Common project defaults
        PROJECT_VERSION: '1.0.0',
        LICENSE: 'MIT',
        NODE_VERSION: 'lts',
        PORT: 3000,
        BUILD_OUTPUT_DIR: 'dist',
        ENTRY_POINT: 'index.js',
        // TypeScript defaults
        TARGET: 'ES2022',
        MODULE: 'NodeNext',
        MODULE_RESOLUTION: 'NodeNext',
        STRICT: true,
        NO_IMPLICIT_ANY: true,
        STRICT_NULL_CHECKS: true,
        STRICT_FUNCTION_TYPES: true,
        STRICT_BIND_CALL_APPLY: true,
        STRICT_PROPERTY_INITIALIZATION: true,
        NO_IMPLICIT_THIS: true,
        ALWAYS_STRICT: true,
        NO_UNUSED_LOCALS: true,
        NO_UNUSED_PARAMETERS: true,
        NO_IMPLICIT_RETURNS: true,
        NO_FALLTHROUGH_CASES: true,
        NO_UNCHECKED_INDEXED_ACCESS: true,
        NO_IMPLICIT_OVERRIDE: true,
        NO_PROPERTY_ACCESS_FROM_INDEX_SIGNATURE: true,
        EXACT_OPTIONAL_PROPERTY_TYPES: true,
        ES_MODULE_INTEROP: true,
        SKIP_LIB_CHECK: true,
        FORCE_CONSISTENT_CASING: true,
        ALLOW_SYNTHETIC_DEFAULT_IMPORTS: true,
        RESOLVE_JSON_MODULE: true,
        ISOLATED_MODULES: true,
        DECLARATION: true,
        DECLARATION_MAP: true,
        SOURCE_MAP: true,
        INLINE_SOURCES: true,
        INCREMENTAL: true,
        TS_BUILD_INFO_FILE: '.tsbuildinfo',
        PRETTY: true,
        REMOVE_COMMENTS: false,
        PRESERVE_CONST_ENUMS: true,
        BASE_URL: '.',
        // ESLint defaults
        ECMA_VERSION: 2022,
        BROWSER_ENVIRONMENT: projectType === 'react' || projectType === 'vue',
        NODE_ENVIRONMENT: true,
        JEST_ENVIRONMENT: true,
        REACT_PROJECT: projectType === 'react',
        STRICT_TYPE_CHECKING: true,
        SECURITY_RULES: true,
        EXPLICIT_RETURN_TYPES: 'error',
        EXPLICIT_BOUNDARY_TYPES: 'error',
        NO_EXPLICIT_ANY: 'error',
        NO_NON_NULL_ASSERTION: 'error',
        CONSISTENT_TYPE_IMPORTS: 'error',
        NAMING_CONVENTION_LEVEL: 'error',
        INTERFACE_PREFIX: true,
        IMPORT_CYCLE_DETECTION: 'error',
        CONSOLE_RULE_LEVEL: 'error',
        DEBUGGER_RULE_LEVEL: 'error',
        ALERT_RULE_LEVEL: 'error',
        PREFER_TEMPLATE: 'error',
        PREFER_ARROW_CALLBACK: 'error',
        ARROW_BODY_STYLE: 'error',
        CAMEL_CASE_FILES: true,
        PASCAL_CASE_FILES: true,
        KEBAB_CASE_FILES: true,
        PREVENT_ABBREVIATIONS: 'off',
        NO_NULL_RULE: 'off',
        NO_ARRAY_REDUCE: 'off',
        // Jest defaults
        JEST_PRESET: 'ts-jest',
        TEST_ENVIRONMENT: projectType === 'react' ? 'jsdom' : 'node',
        SOURCE_DIR: 'src',
        FILE_EXTENSIONS: 'ts,tsx',
        COVERAGE_EXTENSIONS: 'ts,tsx',
        COVERAGE_DIRECTORY: 'coverage',
        COVERAGE_REPORTERS: ['text', 'lcov', 'html'],
        COVERAGE_THRESHOLDS: true,
        BRANCHES_THRESHOLD: 80,
        FUNCTIONS_THRESHOLD: 80,
        LINES_THRESHOLD: 80,
        STATEMENTS_THRESHOLD: 80,
        TSCONFIG_PATH: 'tsconfig.json',
        CLEAR_MOCKS: true,
        RESTORE_MOCKS: true,
        VERBOSE: true,
        // Prettier defaults
        PRINT_WIDTH: 100,
        TAB_WIDTH: 2,
        USE_TABS: false,
        SEMICOLONS: true,
        SINGLE_QUOTES: true,
        QUOTE_PROPS: 'as-needed',
        TRAILING_COMMA: 'es5',
        BRACKET_SPACING: true,
        ARROW_PARENS: 'avoid',
        JSX_SUPPORT: projectType === 'react' || projectType === 'vue',
        JSX_SINGLE_QUOTES: true,
        JSX_BRACKET_SAME_LINE: false,
        END_OF_LINE: 'lf',
        EMBEDDED_LANGUAGE_FORMATTING: 'auto',
        MARKDOWN_FORMATTING: true,
        MARKDOWN_PRINT_WIDTH: 80,
        MARKDOWN_PROSE_WRAP: 'preserve',
        JSON_FORMATTING: true,
        JSON_PRINT_WIDTH: 80,
        JSON_TAB_WIDTH: 2,
        YAML_FORMATTING: true,
        YAML_TAB_WIDTH: 2,
        YAML_SINGLE_QUOTES: false,
        // Docker defaults
        HOST_PORT: 3000,
        CONTAINER_PORT: 3000,
        NODE_ENV: 'development',
        INCLUDE_POSTGRES: profile.tools?.databases?.postgresql || false,
        INCLUDE_REDIS: profile.tools?.databases?.redis || false,
        POSTGRES_VERSION: '16',
        REDIS_VERSION: '7',
        POSTGRES_USER: 'dev',
        POSTGRES_PASSWORD: 'devpass',
        POSTGRES_DB: 'devdb',
        POSTGRES_HOST_PORT: '5432',
        REDIS_HOST_PORT: '6379',
        // GitHub defaults
        ASSIGNEES: profile.team ? `@${profile.team}` : '',
        ORGANIZATION: profile.team || 'Your Organization',
        SUPPORT_URL: 'https://github.com/your-org/discussions',
        DOCS_URL: 'https://docs.your-org.com',
        TECHNICAL_DETAILS: true,
        ISSUE_NUMBERS: '',
        E2E_TESTS: false,
        PERFORMANCE_TESTS: false,
        FRONTEND_CHANGES: projectType === 'react' || projectType === 'vue',
        SECURITY_SENSITIVE: false,
        DATABASE_CHANGES: profile.tools?.databases ? true : false,
        DEPLOYMENT_NOTES: '',
        BREAKING_CHANGES: '',
        // Slack defaults
        BOT_NAME: 'Development Bot',
        BOT_DESCRIPTION: 'Bot for development team notifications',
        BOT_COLOR: '#4A154B',
        BOT_DISPLAY_NAME: 'DevBot',
        DEPLOY_COMMAND: true,
        PR_COMMAND: true,
        STATUS_COMMAND: true,
        DEFAULT_CHANNEL_ID: process.env.SLACK_CHANNEL_ID || '',
        GITHUB_ORGANIZATION: profile.team || '',
        REPOSITORIES: [],
        NOTIFY_EVENTS: ['opened', 'closed', 'merged'],
        ENABLE_DEPLOY_COMMAND: true,
        ENABLE_PR_COMMAND: true,
        ENABLE_STATUS_COMMAND: true,
        ALLOWED_USERS: [],
        VALID_ENVIRONMENTS: 'staging,production',
        AVAILABLE_SERVICES: 'api,web,worker',
        // Claude Flow defaults
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        TEMPERATURE: 0.7,
        MAX_CONCURRENT_AGENTS: 54,
        ENFORCE_MODEL: true,
        PREVENT_DOWNGRADE: true,
        COMMUNICATION_PROTOCOL: 'event-driven',
        CONSENSUS_ALGORITHM: 'weighted-voting',
        CONFLICT_RESOLUTION: 'queen-arbitration',
        MODEL_ENFORCEMENT: 'strict',
        LOAD_BALANCING: true,
        DYNAMIC_SCALING: true,
        RESOURCE_POOLING: true,
        MODEL_OPTIMIZATION: 'quality-over-speed',
        // Path mappings (common patterns)
        PATH_MAPPINGS: [
            { ALIAS: '@', PATH: 'src' },
            { ALIAS: '@components', PATH: 'src/components' },
            { ALIAS: '@utils', PATH: 'src/utils' },
            { ALIAS: '@hooks', PATH: 'src/hooks' },
            { ALIAS: '@services', PATH: 'src/services' },
            { ALIAS: '@types', PATH: 'src/types' },
            { ALIAS: '@config', PATH: 'src/config' }
        ],
        // Include patterns
        INCLUDE_PATTERNS: ['src/**/*'],
        EXCLUDE_PATTERNS: [
            'node_modules',
            'dist',
            'build',
            'coverage',
            '*.config.js',
            '*.config.ts'
        ],
        // Node-specific TypeScript config
        NODE_MODULE: 'NodeNext',
        NODE_MODULE_RESOLUTION: 'NodeNext',
        NODE_TARGET: 'ES2022',
        NODE_LIBS: ['ES2022'],
        NODE_TYPES: ['node', 'jest'],
        NODE_INCLUDE: ['src/**/*'],
        NODE_EXCLUDE: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        // React-specific TypeScript config
        REACT_TARGET: 'ES2020',
        REACT_LIBS: ['ES2020', 'DOM', 'DOM.Iterable'],
        REACT_MODULE: 'ESNext',
        REACT_JSX: 'react-jsx',
        REACT_TYPES: ['react', 'react-dom', 'node', 'jest'],
        REACT_INCLUDE: ['src/**/*', 'next-env.d.ts'],
        REACT_EXCLUDE: ['node_modules', 'dist', 'build']
    };
}
/**
 * Create a complete template context with sensible defaults
 */
function createDefaultTemplateContext(profile, projectName, projectType = 'node') {
    const defaultVars = getDefaultTemplateVariables(profile, projectType);
    const projectInfo = {
        name: projectName,
        description: `A new ${projectType} project`,
        version: defaultVars.PROJECT_VERSION,
        type: projectType,
        packageManager: getPreferredPackageManager(profile),
        license: defaultVars.LICENSE,
        author: profile.name,
        organization: profile.team
    };
    const platformInfo = {
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version.replace('v', ''),
        shell: profile.preferences?.shell || 'zsh'
    };
    return {
        profile,
        project: projectInfo,
        platform: platformInfo,
        customVariables: defaultVars
    };
}
/**
 * Get preferred package manager from profile
 */
function getPreferredPackageManager(profile) {
    if (profile.tools.packageManagers?.pnpm)
        return 'pnpm';
    if (profile.tools.packageManagers?.yarn)
        return 'yarn';
    return 'npm';
}
/**
 * Get template variables for specific configurations
 */
function getConfigTemplateVariables(configType, profile, projectType = 'node') {
    const baseVars = getDefaultTemplateVariables(profile, projectType);
    switch (configType) {
        case 'strict-typescript':
            return {
                ...baseVars,
                EXPLICIT_RETURN_TYPES: 'error',
                EXPLICIT_BOUNDARY_TYPES: 'error',
                NO_EXPLICIT_ANY: 'error',
                NO_NON_NULL_ASSERTION: 'error',
                STRICT_TYPE_CHECKING: true
            };
        case 'relaxed-typescript':
            return {
                ...baseVars,
                EXPLICIT_RETURN_TYPES: 'off',
                EXPLICIT_BOUNDARY_TYPES: 'off',
                NO_EXPLICIT_ANY: 'warn',
                NO_NON_NULL_ASSERTION: 'warn',
                STRICT_TYPE_CHECKING: false
            };
        case 'production-ready':
            return {
                ...baseVars,
                CONSOLE_RULE_LEVEL: 'error',
                DEBUGGER_RULE_LEVEL: 'error',
                SECURITY_RULES: true,
                BRANCHES_THRESHOLD: 90,
                FUNCTIONS_THRESHOLD: 90,
                LINES_THRESHOLD: 90,
                STATEMENTS_THRESHOLD: 90
            };
        case 'development':
            return {
                ...baseVars,
                CONSOLE_RULE_LEVEL: 'warn',
                DEBUGGER_RULE_LEVEL: 'warn',
                BRANCHES_THRESHOLD: 70,
                FUNCTIONS_THRESHOLD: 70,
                LINES_THRESHOLD: 70,
                STATEMENTS_THRESHOLD: 70
            };
        default:
            return baseVars;
    }
}
//# sourceMappingURL=template-variables.js.map