"use strict";
/**
 * Project Templates Manager
 * Handles creation of wundr-compliant projects
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectTemplates = exports.ProjectTemplateManager = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const core_1 = require("@wundr.io/core");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs-extra"));
const handlebars_1 = __importDefault(require("handlebars"));
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const validate_npm_package_name_1 = __importDefault(require("validate-npm-package-name"));
const backend_fastify_1 = require("./templates/backend-fastify");
const frontend_next_1 = require("./templates/frontend-next");
const monorepo_turborepo_1 = require("./templates/monorepo-turborepo");
const wundr_files_1 = require("./templates/wundr-files");
const logger = (0, core_1.getLogger)();
class ProjectTemplateManager {
    constructor() {
        this.templates = new Map();
        this.registerTemplates();
    }
    /**
     * Register all available templates
     */
    registerTemplates() {
        this.templates.set('frontend-next', frontend_next_1.frontendNextTemplate);
        this.templates.set('backend-fastify', backend_fastify_1.backendFastifyTemplate);
        this.templates.set('monorepo-turborepo', monorepo_turborepo_1.monorepoTurborepoTemplate);
    }
    /**
     * Create a new project from template
     */
    async createProject(options) {
        const spinner = (0, ora_1.default)();
        try {
            // Validate project name
            const validation = this.validateProjectName(options.name);
            if (!validation.valid) {
                throw new Error(`Invalid project name: ${validation.errors.join(', ')}`);
            }
            // Determine project path
            const projectPath = path.resolve(options.path || process.cwd(), options.name);
            // Check if directory exists
            if (await fs.pathExists(projectPath)) {
                throw new Error(`Directory ${projectPath} already exists`);
            }
            // Get template
            const templateKey = this.getTemplateKey(options.type, options.framework);
            const template = this.templates.get(templateKey);
            if (!template) {
                throw new Error(`Template not found: ${templateKey}`);
            }
            spinner.start('Creating project structure...');
            // Create project directory
            await fs.ensureDir(projectPath);
            // Create template context
            const context = this.createTemplateContext(options);
            // Generate package.json
            await this.createPackageJson(projectPath, template, context);
            // Copy template files
            await this.copyTemplateFiles(projectPath, template, context);
            // Add wundr-specific files
            await this.addWundrFiles(projectPath, context);
            spinner.succeed('Project structure created');
            // Initialize git
            if (options.git !== false) {
                spinner.start('Initializing git repository...');
                await this.initializeGit(projectPath);
                spinner.succeed('Git repository initialized');
            }
            // Install dependencies
            if (options.install !== false) {
                spinner.start('Installing dependencies...');
                await this.installDependencies(projectPath);
                spinner.succeed('Dependencies installed');
            }
            // Run post-install commands
            if (template.postInstall && template.postInstall.length > 0) {
                spinner.start('Running post-install setup...');
                await this.runPostInstall(projectPath, template.postInstall);
                spinner.succeed('Post-install setup complete');
            }
            // Generate initial governance baseline
            spinner.start('Creating wundr governance baseline...');
            await this.createGovernanceBaseline(projectPath);
            spinner.succeed('Governance baseline created');
            /* eslint-disable no-console */
            // Success message
            console.log(chalk_1.default.green('\\n✨ Project created successfully!'));
            console.log(chalk_1.default.cyan(`\\n📁 Project location: ${projectPath}`));
            console.log(chalk_1.default.yellow('\\n🚀 Get started:'));
            console.log(chalk_1.default.gray(`   cd ${options.name}`));
            console.log(chalk_1.default.gray('   npm run dev'));
            console.log(chalk_1.default.gray('\\n📊 Check governance:'));
            console.log(chalk_1.default.gray('   wundr analyze'));
            console.log(chalk_1.default.gray('   wundr govern check'));
            /* eslint-enable no-console */
        }
        catch (error) {
            spinner.fail('Project creation failed');
            throw error;
        }
    }
    /**
     * Interactive project creation
     */
    async createInteractive() {
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Project name:',
                validate: (input) => {
                    const validation = this.validateProjectName(input);
                    return validation.valid || validation.errors.join(', ');
                },
            },
            {
                type: 'list',
                name: 'type',
                message: 'Project type:',
                choices: [
                    { name: 'Frontend Application', value: 'frontend' },
                    { name: 'Backend API', value: 'backend' },
                    { name: 'Full Stack Application', value: 'fullstack' },
                    { name: 'Monorepo Platform', value: 'monorepo' },
                    { name: 'NPM Library', value: 'library' },
                    { name: 'CLI Tool', value: 'cli' },
                ],
            },
            {
                type: 'list',
                name: 'framework',
                message: 'Framework:',
                choices: (answers) => this.getFrameworkChoices(answers.type),
                when: (answers) => ['frontend', 'backend', 'fullstack'].includes(answers.type),
            },
            {
                type: 'input',
                name: 'description',
                message: 'Project description:',
                default: 'A wundr-compliant project',
            },
            {
                type: 'input',
                name: 'author',
                message: 'Author:',
                default: () => {
                    try {
                        return (0, child_process_1.execSync)('git config user.name').toString().trim();
                    }
                    catch {
                        return '';
                    }
                },
            },
            {
                type: 'confirm',
                name: 'typescript',
                message: 'Use TypeScript?',
                default: true,
            },
            {
                type: 'confirm',
                name: 'testing',
                message: 'Include testing setup?',
                default: true,
            },
            {
                type: 'confirm',
                name: 'ci',
                message: 'Include CI/CD workflows?',
                default: true,
            },
            {
                type: 'confirm',
                name: 'docker',
                message: 'Include Docker configuration?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'install',
                message: 'Install dependencies?',
                default: true,
            },
        ]);
        await this.createProject(answers);
    }
    /**
     * Validate project name
     */
    validateProjectName(name) {
        const result = (0, validate_npm_package_name_1.default)(name);
        if (!result.validForNewPackages) {
            return {
                valid: false,
                errors: result.errors || ['Invalid package name'],
                warnings: result.warnings || [],
            };
        }
        return {
            valid: true,
            errors: [],
            warnings: result.warnings || [],
        };
    }
    /**
     * Get template key based on type and framework
     */
    getTemplateKey(type, framework) {
        if (type === 'monorepo') {
            return 'monorepo-turborepo';
        }
        if (type === 'frontend' || framework === 'next') {
            return 'frontend-next';
        }
        if (type === 'backend' || framework === 'fastify') {
            return 'backend-fastify';
        }
        // Default templates for other types
        if (type === 'fullstack') {
            return 'monorepo-turborepo';
        }
        return 'frontend-next'; // Default
    }
    /**
     * Get framework choices based on project type
     */
    getFrameworkChoices(type) {
        switch (type) {
            case 'frontend':
                return [
                    { name: 'Next.js', value: 'next' },
                    { name: 'React (Vite)', value: 'react' },
                    { name: 'Vue', value: 'vue' },
                ];
            case 'backend':
                return [
                    { name: 'Fastify', value: 'fastify' },
                    { name: 'Express', value: 'express' },
                    { name: 'NestJS', value: 'nestjs' },
                ];
            case 'fullstack':
                return [
                    { name: 'Next.js + Fastify', value: 'next-fastify' },
                    { name: 'T3 Stack', value: 't3' },
                ];
            default:
                return [];
        }
    }
    /**
     * Create template context for handlebars
     */
    createTemplateContext(options) {
        return {
            projectName: options.name,
            projectNameKebab: options.name.toLowerCase().replace(/\\s+/g, '-'),
            projectNamePascal: options.name
                .split(/[\\s\\-_]+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(''),
            description: options.description || 'A wundr-compliant project',
            author: options.author || '',
            license: options.license || 'MIT',
            year: new Date().getFullYear(),
            typescript: options.typescript !== false,
            testing: options.testing !== false,
            ci: options.ci !== false,
            docker: options.docker === true,
            wundrVersion: '1.0.0',
        };
    }
    /**
     * Create package.json
     */
    async createPackageJson(projectPath, template, context) {
        const packageJson = {
            name: context.projectNameKebab,
            version: '1.0.0',
            description: context.description,
            author: context.author,
            license: context.license,
            private: true,
            scripts: template.scripts,
            dependencies: template.dependencies,
            devDependencies: template.devDependencies,
        };
        await fs.writeJSON(path.join(projectPath, 'package.json'), packageJson, {
            spaces: 2,
        });
    }
    /**
     * Copy template files
     */
    async copyTemplateFiles(projectPath, template, context) {
        for (const file of template.files) {
            const filePath = path.join(projectPath, file.path);
            await fs.ensureDir(path.dirname(filePath));
            let content = typeof file.content === 'function' ? file.content() : file.content;
            // Process template if needed
            if (file.template) {
                const compiledTemplate = handlebars_1.default.compile(content);
                content = compiledTemplate(context);
            }
            await fs.writeFile(filePath, content);
        }
    }
    /**
     * Add wundr-specific files
     */
    async addWundrFiles(projectPath, context) {
        for (const file of wundr_files_1.wundrFiles) {
            const filePath = path.join(projectPath, file.path);
            await fs.ensureDir(path.dirname(filePath));
            let content = typeof file.content === 'function' ? file.content() : file.content;
            // Process template if needed
            if (file.template) {
                const compiledTemplate = handlebars_1.default.compile(content);
                content = compiledTemplate(context);
            }
            await fs.writeFile(filePath, content);
        }
    }
    /**
     * Initialize git repository
     */
    async initializeGit(projectPath) {
        (0, child_process_1.execSync)('git init', { cwd: projectPath, stdio: 'ignore' });
        (0, child_process_1.execSync)('git add .', { cwd: projectPath, stdio: 'ignore' });
        (0, child_process_1.execSync)('git commit -m "feat: initial commit (wundr-compliant project)"', {
            cwd: projectPath,
            stdio: 'ignore',
        });
    }
    /**
     * Install dependencies
     */
    async installDependencies(projectPath) {
        // Detect package manager
        const packageManager = await this.detectPackageManager();
        (0, child_process_1.execSync)(`${packageManager} install`, {
            cwd: projectPath,
            stdio: 'ignore',
        });
    }
    /**
     * Run post-install commands
     */
    async runPostInstall(projectPath, commands) {
        for (const command of commands) {
            try {
                (0, child_process_1.execSync)(command, {
                    cwd: projectPath,
                    stdio: 'ignore',
                });
            }
            catch (_error) {
                logger.warn(`Post-install command failed: ${command}`);
            }
        }
    }
    /**
     * Create initial governance baseline
     */
    async createGovernanceBaseline(projectPath) {
        try {
            (0, child_process_1.execSync)('wundr govern baseline', {
                cwd: projectPath,
                stdio: 'ignore',
            });
        }
        catch {
            // Wundr CLI might not be installed globally
            logger.warn('Could not create governance baseline - wundr CLI not found');
        }
    }
    /**
     * Detect package manager
     */
    async detectPackageManager() {
        // Check for pnpm
        try {
            (0, child_process_1.execSync)('pnpm --version', { stdio: 'ignore' });
            return 'pnpm';
        }
        catch {
            // Package manager not available
        }
        // Check for yarn
        try {
            (0, child_process_1.execSync)('yarn --version', { stdio: 'ignore' });
            return 'yarn';
        }
        catch {
            // Package manager not available
        }
        // Default to npm
        return 'npm';
    }
    /**
     * List available templates
     */
    listTemplates() {
        /* eslint-disable no-console */
        console.log(chalk_1.default.cyan('\\n📦 Available Templates:\\n'));
        for (const [key, template] of this.templates) {
            console.log(chalk_1.default.yellow(`  ${template.displayName}`));
            console.log(chalk_1.default.gray(`    Key: ${key}`));
            console.log(chalk_1.default.gray(`    ${template.description}\\n`));
        }
        /* eslint-enable no-console */
    }
}
exports.ProjectTemplateManager = ProjectTemplateManager;
// Export singleton instance
exports.projectTemplates = new ProjectTemplateManager();
//# sourceMappingURL=index.js.map