"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectTemplates = createProjectTemplates;
const tslib_1 = require("tslib");
const template_manager_js_1 = require("./template-manager.js");
const path = tslib_1.__importStar(require("path"));
const chalk_1 = tslib_1.__importDefault(require("chalk"));
/**
 * Create templates for a new project based on developer profile and project type
 */
async function createProjectTemplates(options) {
    const templateManager = new template_manager_js_1.TemplateManager();
    console.log(chalk_1.default.blue(`\n🏗️  Setting up templates for ${options.projectType} project`));
    const context = createTemplateContext(options);
    // Generate configuration files based on project type
    const configs = getConfigsForProjectType(options.projectType, options);
    try {
        await templateManager.generateConfigs(options.projectPath, context, configs);
        if (options.includeDocker) {
            await generateDockerTemplates(templateManager, options.projectPath, context);
        }
        if (options.includeGitHub) {
            await generateGitHubTemplates(templateManager, options.projectPath, context);
        }
        if (options.includeSlack) {
            await generateSlackTemplates(templateManager, options.projectPath, context);
        }
        if (options.includeClaudeFlow) {
            await generateClaudeFlowTemplates(templateManager, options.projectPath, context);
        }
        console.log(chalk_1.default.green('✅ Project templates created successfully!'));
        printNextSteps(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to create project templates:'), error);
        throw error;
    }
}
/**
 * Create template context from options
 */
function createTemplateContext(options) {
    const projectName = path.basename(options.projectPath);
    return {
        profile: options.profile,
        project: {
            name: projectName,
            description: `A new ${options.projectType} project`,
            version: '1.0.0',
            type: options.projectType,
            packageManager: getPreferredPackageManager(options.profile),
            license: 'MIT',
            author: options.profile.name,
            organization: options.profile.team
        },
        platform: {
            os: process.platform,
            arch: process.arch,
            nodeVersion: process.version.replace('v', ''),
            shell: options.profile.preferences?.shell || 'zsh'
        },
        customVariables: getCustomVariables(options)
    };
}
/**
 * Get configuration files for project type
 */
function getConfigsForProjectType(projectType, options) {
    const configs = ['prettier'];
    switch (projectType) {
        case 'node':
            configs.push('eslint', 'jest', 'tsconfig-node');
            break;
        case 'react':
            configs.push('eslint', 'jest', 'tsconfig-react');
            break;
        case 'vue':
            configs.push('eslint', 'jest', 'tsconfig-base');
            break;
        case 'python':
            // Python-specific configs would go here
            break;
        case 'go':
        case 'rust':
        case 'java':
            // Language-specific configs would go here
            break;
        default:
            configs.push('eslint', 'jest', 'tsconfig-base');
    }
    return configs;
}
/**
 * Generate Docker templates
 */
async function generateDockerTemplates(templateManager, projectPath, context) {
    console.log(chalk_1.default.blue('🐳 Generating Docker templates...'));
    await templateManager.copyTemplate('docker/Dockerfile.node', path.join(projectPath, 'Dockerfile'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('docker/docker-compose.yml', path.join(projectPath, 'docker-compose.yml'), context, { overwrite: true, verbose: true });
}
/**
 * Generate GitHub templates
 */
async function generateGitHubTemplates(templateManager, projectPath, context) {
    console.log(chalk_1.default.blue('📁 Generating GitHub templates...'));
    const githubDir = path.join(projectPath, '.github');
    const issueTemplateDir = path.join(githubDir, 'ISSUE_TEMPLATE');
    // Ensure directories exist
    await templateManager.copyTemplate('github/ISSUE_TEMPLATE/bug_report.md', path.join(issueTemplateDir, 'bug_report.md'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('github/ISSUE_TEMPLATE/feature_request.md', path.join(issueTemplateDir, 'feature_request.md'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('github/ISSUE_TEMPLATE/config.yml', path.join(issueTemplateDir, 'config.yml'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('github/pull_request_template.md', path.join(githubDir, 'pull_request_template.md'), context, { overwrite: true, verbose: true });
}
/**
 * Generate Slack templates
 */
async function generateSlackTemplates(templateManager, projectPath, context) {
    console.log(chalk_1.default.blue('💬 Generating Slack integration templates...'));
    const slackDir = path.join(projectPath, 'slack');
    await templateManager.copyTemplate('slack/manifest.json', path.join(slackDir, 'manifest.json'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('slack/github-integration.js', path.join(slackDir, 'github-integration.js'), context, { overwrite: true, verbose: true });
    await templateManager.copyTemplate('slack/webhook-handler.js', path.join(slackDir, 'webhook-handler.js'), context, { overwrite: true, verbose: true });
}
/**
 * Generate Claude Flow templates
 */
async function generateClaudeFlowTemplates(templateManager, projectPath, context) {
    console.log(chalk_1.default.blue('🤖 Generating Claude Flow configuration...'));
    await templateManager.copyTemplate('claude-flow/swarm.config.js', path.join(projectPath, 'claude-flow.config.js'), context, { overwrite: true, verbose: true });
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
 * Get custom variables for template context
 */
function getCustomVariables(options) {
    return {
        // ESLint configuration
        ECMA_VERSION: 2022,
        BROWSER_ENVIRONMENT: options.projectType === 'react' || options.projectType === 'vue',
        NODE_ENVIRONMENT: true,
        JEST_ENVIRONMENT: true,
        REACT_PROJECT: options.projectType === 'react',
        STRICT_TYPE_CHECKING: true,
        SECURITY_RULES: true,
        // TypeScript configuration
        TARGET: 'ES2022',
        LIBS: options.projectType === 'react' ? ['ES2022', 'DOM', 'DOM.Iterable'] : ['ES2022'],
        MODULE: 'NodeNext',
        MODULE_RESOLUTION: 'NodeNext',
        JSX_SUPPORT: options.projectType === 'react' || options.projectType === 'vue',
        JSX: 'react-jsx',
        STRICT: true,
        NO_IMPLICIT_ANY: true,
        // Jest configuration
        JEST_PRESET: 'ts-jest',
        TEST_ENVIRONMENT: options.projectType === 'react' ? 'jsdom' : 'node',
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
        // Prettier configuration
        PRINT_WIDTH: 100,
        TAB_WIDTH: 2,
        USE_TABS: false,
        SEMICOLONS: true,
        SINGLE_QUOTES: true,
        QUOTE_PROPS: 'as-needed',
        TRAILING_COMMA: 'es5',
        BRACKET_SPACING: true,
        ARROW_PARENS: 'avoid',
        END_OF_LINE: 'lf',
        // Docker configuration
        NODE_VERSION: 'lts',
        BUILD_OUTPUT_DIR: 'dist',
        ENTRY_POINT: 'index.js',
        PORT: 3000,
        // GitHub configuration
        ASSIGNEES: options.profile.team ? `@${options.profile.team}` : '',
        ORGANIZATION: options.profile.team || 'Your Organization',
        SUPPORT_URL: 'https://github.com/your-org/discussions',
        DOCS_URL: 'https://docs.your-org.com',
        // Slack configuration
        BOT_NAME: `${path.basename(options.projectPath)} Bot`,
        BOT_DESCRIPTION: `Bot for ${path.basename(options.projectPath)} development team`,
        BOT_COLOR: '#4A154B',
        BOT_DISPLAY_NAME: 'DevBot',
        // Claude Flow configuration
        CLAUDE_MODEL: 'claude-sonnet-4-20250514',
        TEMPERATURE: 0.7,
        MAX_CONCURRENT_AGENTS: 54,
        ENFORCE_MODEL: true,
        PREVENT_DOWNGRADE: true,
        COMMUNICATION_PROTOCOL: 'event-driven',
        CONSENSUS_ALGORITHM: 'weighted-voting',
        CONFLICT_RESOLUTION: 'queen-arbitration',
        MODEL_ENFORCEMENT: 'strict'
    };
}
/**
 * Print next steps after template creation
 */
function printNextSteps(options) {
    console.log(chalk_1.default.cyan('\n📋 Next steps:'));
    console.log(chalk_1.default.white('1. Install dependencies:'));
    const packageManager = getPreferredPackageManager(options.profile);
    console.log(chalk_1.default.gray(`   cd ${path.basename(options.projectPath)}`));
    console.log(chalk_1.default.gray(`   ${packageManager} install`));
    if (options.includeDocker) {
        console.log(chalk_1.default.white('2. Build and run with Docker:'));
        console.log(chalk_1.default.gray('   docker-compose up --build'));
    }
    if (options.includeGitHub) {
        console.log(chalk_1.default.white('3. Initialize Git repository:'));
        console.log(chalk_1.default.gray('   git init && git add . && git commit -m "Initial commit"'));
    }
    if (options.includeSlack) {
        console.log(chalk_1.default.white('4. Configure Slack integration:'));
        console.log(chalk_1.default.gray('   - Update slack/manifest.json with your app details'));
        console.log(chalk_1.default.gray('   - Set up environment variables for Slack bot'));
    }
    if (options.includeClaudeFlow) {
        console.log(chalk_1.default.white('5. Initialize Claude Flow:'));
        console.log(chalk_1.default.gray('   npx claude-flow@alpha mcp start'));
    }
    console.log(chalk_1.default.white('6. Start development:'));
    console.log(chalk_1.default.gray(`   ${packageManager} run dev`));
    console.log();
}
//# sourceMappingURL=project-templates.js.map