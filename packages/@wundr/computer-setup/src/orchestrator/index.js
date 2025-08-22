"use strict";
/**
 * Setup Orchestrator
 * Coordinates the entire computer setup process
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupOrchestrator = void 0;
const events_1 = require("events");
// Real logger implementation - production ready
class Logger {
    name;
    logLevel;
    constructor(name) {
        this.name = name;
        this.logLevel = process.env.LOG_LEVEL || 'info';
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevel = levels.indexOf(this.logLevel);
        const targetLevel = levels.indexOf(level);
        return targetLevel >= currentLevel;
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
        return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}${formattedArgs}`;
    }
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, ...args));
        }
    }
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, ...args));
        }
    }
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, ...args));
        }
    }
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message, ...args));
        }
    }
}
// Real event bus implementation - production ready
class EventBus extends events_1.EventEmitter {
    static instance;
    constructor() {
        super();
        this.setMaxListeners(100);
    }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    emit(event, data) {
        const timestamp = new Date().toISOString();
        if (process.env.LOG_LEVEL === 'debug') {
            console.debug(`[${timestamp}] [EVENT] ${event}`, data ? JSON.stringify(data) : '');
        }
        return super.emit(event, data);
    }
    on(event, handler) {
        return super.on(event, handler);
    }
    once(event, handler) {
        return super.once(event, handler);
    }
    off(event, handler) {
        return super.off(event, handler);
    }
}
// Factory functions for compatibility
const getLogger = (name) => new Logger(name);
const getEventBus = () => EventBus.getInstance();
const logger = getLogger('computer-setup:orchestrator');
const eventBus = getEventBus();
class SetupOrchestrator extends events_1.EventEmitter {
    profileManager;
    installerRegistry;
    configuratorService;
    validator;
    progress;
    activeSteps = new Map();
    completedSteps = new Set();
    failedSteps = new Set();
    constructor(profileManager, installerRegistry, configuratorService, validator) {
        super();
        this.profileManager = profileManager;
        this.installerRegistry = installerRegistry;
        this.configuratorService = configuratorService;
        this.validator = validator;
        this.progress = this.initializeProgress();
    }
    /**
     * Initialize progress tracking
     */
    initializeProgress() {
        return {
            totalSteps: 0,
            completedSteps: 0,
            currentStep: '',
            percentage: 0,
            estimatedTimeRemaining: 0,
            logs: []
        };
    }
    /**
     * Orchestrate the complete setup process
     */
    async orchestrate(options) {
        const startTime = Date.now();
        logger.info('Starting setup orchestration', {
            profile: options.profile.name,
            platform: options.platform.os,
            mode: options.mode
        });
        // Emit setup started event
        eventBus.emit('setup:started', { options });
        const result = {
            success: false,
            completedSteps: [],
            failedSteps: [],
            skippedSteps: [],
            warnings: [],
            errors: [],
            duration: 0
        };
        try {
            // Phase 1: Validation
            await this.validatePhase(options, result);
            // Phase 2: Preparation
            await this.preparationPhase(options, result);
            // Phase 3: Installation
            await this.installationPhase(options, result);
            // Phase 4: Configuration
            await this.configurationPhase(options, result);
            // Phase 5: Verification
            await this.verificationPhase(options, result);
            // Phase 6: Finalization
            await this.finalizationPhase(options, result);
            result.success = result.failedSteps.length === 0;
        }
        catch (error) {
            logger.error('Setup orchestration failed', error);
            result.errors.push(error);
        }
        finally {
            result.duration = Date.now() - startTime;
            // Emit setup completed event
            eventBus.emit('setup:completed', { result });
        }
        return result;
    }
    /**
     * Phase 1: Validation
     */
    async validatePhase(options, result) {
        logger.info('Phase 1: Validation');
        this.updateProgress('Validating system requirements', 0);
        // Validate platform
        const platformValid = await this.validator.validatePlatform(options.platform);
        if (!platformValid) {
            throw new Error('Platform validation failed');
        }
        // Check disk space
        const hasSpace = await this.validator.checkDiskSpace(10 * 1024 * 1024 * 1024);
        if (!hasSpace) {
            result.warnings.push('Low disk space detected');
        }
        // Check network
        const hasNetwork = await this.validator.checkNetworkConnectivity();
        if (!hasNetwork && !options.dryRun) {
            throw new Error('No network connectivity');
        }
        this.updateProgress('Validation complete', 10);
    }
    /**
     * Phase 2: Preparation
     */
    async preparationPhase(options, result) {
        logger.info('Phase 2: Preparation');
        this.updateProgress('Preparing installation', 15);
        // Load profile
        const profile = await this.profileManager.loadProfile(options.profile);
        // Generate installation steps
        const steps = await this.generateInstallationPlan(profile, options);
        this.activeSteps = new Map(steps.map(s => [s.id, s]));
        this.progress.totalSteps = steps.length;
        // Apply team configuration if specified
        if (profile.team) {
            await this.applyTeamConfiguration(profile.team);
        }
        this.updateProgress('Preparation complete', 20);
    }
    /**
     * Phase 3: Installation
     */
    async installationPhase(options, result) {
        logger.info('Phase 3: Installation');
        this.updateProgress('Installing tools', 25);
        const steps = Array.from(this.activeSteps.values());
        const installSteps = steps.filter(s => s.category === 'system' || s.category === 'development');
        if (options.parallel) {
            await this.executeParallel(installSteps, options, result);
        }
        else {
            await this.executeSequential(installSteps, options, result);
        }
        this.updateProgress('Installation complete', 60);
    }
    /**
     * Phase 4: Configuration
     */
    async configurationPhase(options, result) {
        logger.info('Phase 4: Configuration');
        this.updateProgress('Configuring tools', 65);
        const steps = Array.from(this.activeSteps.values());
        const configSteps = steps.filter(s => s.category === 'configuration');
        await this.executeSequential(configSteps, options, result);
        // Generate shell configuration
        await this.configuratorService.generateShellConfig(options.profile);
        this.updateProgress('Configuration complete', 80);
    }
    /**
     * Phase 5: Verification
     */
    async verificationPhase(options, result) {
        logger.info('Phase 5: Verification');
        this.updateProgress('Verifying setup', 85);
        if (!options.dryRun) {
            const isValid = await this.validator.validateFullSetup(options.profile);
            if (!isValid) {
                result.warnings.push('Some tools failed validation');
            }
        }
        this.updateProgress('Verification complete', 95);
    }
    /**
     * Phase 6: Finalization
     */
    async finalizationPhase(options, result) {
        logger.info('Phase 6: Finalization');
        this.updateProgress('Finalizing setup', 98);
        // Save profile
        await this.profileManager.saveProfile(options.profile);
        // Generate report
        if (options.generateReport) {
            result.report = await this.generateSetupReport(options, result);
        }
        // Cleanup temporary files
        await this.cleanup();
        this.updateProgress('Setup complete', 100);
    }
    /**
     * Generate installation plan
     */
    async generateInstallationPlan(profile, options) {
        const steps = [];
        // Get platform-specific steps
        steps.push(...await this.installerRegistry.getSystemSteps(options.platform));
        // Get tool installation steps
        if (profile.tools.languages.node) {
            steps.push(...await this.installerRegistry.getNodeSteps(profile.tools.languages.node));
        }
        if (profile.tools.languages.python) {
            steps.push(...await this.installerRegistry.getPythonSteps(profile.tools.languages.python));
        }
        if (profile.tools.containers.docker) {
            steps.push(...await this.installerRegistry.getDockerSteps());
        }
        // Get configuration steps
        steps.push(...await this.configuratorService.getGitConfigSteps(profile.preferences.gitConfig));
        steps.push(...await this.configuratorService.getEditorSteps(profile.preferences.editor));
        // Sort by dependencies
        return this.sortByDependencies(steps);
    }
    /**
     * Execute steps in parallel
     */
    async executeParallel(steps, options, result) {
        // Group steps by dependencies
        const groups = this.groupByDependencies(steps);
        for (const group of groups) {
            const promises = group.map(step => this.executeStep(step, options, result));
            await Promise.allSettled(promises);
        }
    }
    /**
     * Execute steps sequentially
     */
    async executeSequential(steps, options, result) {
        for (const step of steps) {
            await this.executeStep(step, options, result);
        }
    }
    /**
     * Execute a single step
     */
    async executeStep(step, options, result) {
        try {
            this.updateProgress(`Executing: ${step.name}`, null);
            logger.info(`Executing step: ${step.name}`);
            if (options.dryRun) {
                logger.info(`[DRY RUN] Would execute: ${step.name}`);
                result.completedSteps.push(step.id);
                return;
            }
            // Check if already completed
            if (this.completedSteps.has(step.id)) {
                logger.info(`Step already completed: ${step.name}`);
                return;
            }
            // Validate prerequisites
            if (step.validator) {
                const isValid = await step.validator();
                if (isValid && options.skipExisting) {
                    logger.info(`Skipping existing: ${step.name}`);
                    result.skippedSteps.push(step.id);
                    return;
                }
            }
            // Execute installation
            await step.installer();
            this.completedSteps.add(step.id);
            result.completedSteps.push(step.id);
            logger.info(`Step completed: ${step.name}`);
            eventBus.emit('step:completed', { step });
        }
        catch (error) {
            logger.error(`Step failed: ${step.name}`, error);
            this.failedSteps.add(step.id);
            result.failedSteps.push(step.id);
            result.errors.push(error);
            eventBus.emit('step:failed', { step, error });
            // Attempt rollback
            if (step.rollback) {
                try {
                    await step.rollback();
                    logger.info(`Rollback successful: ${step.name}`);
                }
                catch (rollbackError) {
                    logger.error(`Rollback failed: ${step.name}`, rollbackError);
                }
            }
            if (step.required) {
                throw error;
            }
        }
    }
    /**
     * Sort steps by dependencies
     */
    sortByDependencies(steps) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        const visit = (step) => {
            if (visited.has(step.id))
                return;
            if (visiting.has(step.id)) {
                logger.warn(`Circular dependency detected: ${step.id}`);
                return;
            }
            visiting.add(step.id);
            for (const depId of step.dependencies) {
                const dep = steps.find(s => s.id === depId);
                if (dep)
                    visit(dep);
            }
            visiting.delete(step.id);
            visited.add(step.id);
            sorted.push(step);
        };
        for (const step of steps) {
            visit(step);
        }
        return sorted;
    }
    /**
     * Group steps by dependency levels
     */
    groupByDependencies(steps) {
        const groups = [];
        const remaining = new Set(steps);
        const completed = new Set();
        while (remaining.size > 0) {
            const group = [];
            for (const step of remaining) {
                const depsResolved = step.dependencies.every(dep => completed.has(dep));
                if (depsResolved) {
                    group.push(step);
                }
            }
            if (group.length === 0) {
                // Circular dependency or unresolved dependencies
                logger.warn('Could not resolve dependencies for remaining steps');
                groups.push(Array.from(remaining));
                break;
            }
            for (const step of group) {
                remaining.delete(step);
                completed.add(step.id);
            }
            groups.push(group);
        }
        return groups;
    }
    /**
     * Apply team configuration
     */
    async applyTeamConfiguration(team) {
        logger.info(`Applying team configuration: ${team}`);
        // This would fetch and apply team-specific settings
        // For now, we'll just log it
        eventBus.emit('team:config:applied', { team });
    }
    /**
     * Generate setup report
     */
    async generateSetupReport(options, result) {
        const report = {
            timestamp: new Date(),
            profile: options.profile,
            platform: options.platform,
            result: {
                success: result.success,
                completed: result.completedSteps.length,
                failed: result.failedSteps.length,
                skipped: result.skippedSteps.length,
                duration: result.duration
            },
            installedTools: await this.validator.getInstalledTools(),
            configurations: this.configuratorService.getConfigurationChanges(),
            credentials: await this.validator.getCredentialSetups(),
            warnings: result.warnings,
            errors: result.errors.map(e => e.message)
        };
        eventBus.emit('report:generated', { report });
        return report;
    }
    /**
     * Update progress
     */
    updateProgress(step, percentage) {
        this.progress.currentStep = step;
        if (percentage !== null) {
            this.progress.percentage = percentage;
        }
        this.progress.logs.push(`[${new Date().toISOString()}] ${step}`);
        this.emit('progress', this.progress);
        eventBus.emit('progress:updated', this.progress);
    }
    /**
     * Cleanup temporary files
     */
    async cleanup() {
        logger.info('Cleaning up temporary files');
        // Cleanup implementation
    }
    /**
     * Get current progress
     */
    getProgress() {
        return this.progress;
    }
    /**
     * Cancel setup
     */
    async cancel() {
        logger.info('Cancelling setup');
        eventBus.emit('setup:cancelled');
        // Rollback any in-progress steps
        for (const [id, step] of this.activeSteps) {
            if (!this.completedSteps.has(id) && !this.failedSteps.has(id)) {
                if (step.rollback) {
                    try {
                        await step.rollback();
                    }
                    catch (error) {
                        logger.error(`Rollback failed for ${step.name}`, error);
                    }
                }
            }
        }
    }
}
exports.SetupOrchestrator = SetupOrchestrator;
//# sourceMappingURL=index.js.map