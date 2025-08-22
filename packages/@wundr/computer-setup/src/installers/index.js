"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealSetupOrchestrator = exports.InstallerRegistry = void 0;
const tslib_1 = require("tslib");
const node_installer_1 = require("./node-installer");
const docker_installer_1 = require("./docker-installer");
const git_installer_1 = require("./git-installer");
const homebrew_installer_1 = require("./homebrew-installer");
const python_installer_1 = require("./python-installer");
const mac_installer_1 = require("./mac-installer");
const linux_installer_1 = require("./linux-installer");
const windows_installer_1 = require("./windows-installer");
class InstallerRegistry {
    installers = new Map();
    platform;
    constructor(platform) {
        this.platform = platform;
        this.registerCoreInstallers();
        this.registerPlatformInstallers();
    }
    /**
     * Register core cross-platform installers
     */
    registerCoreInstallers() {
        // System package managers
        if (['darwin', 'linux'].includes(this.platform.os)) {
            this.register('homebrew', new homebrew_installer_1.HomebrewInstaller());
        }
        // Development tools
        this.register('git', new git_installer_1.GitInstaller());
        this.register('node', new node_installer_1.NodeInstaller());
        this.register('python', new python_installer_1.PythonInstaller());
        this.register('docker', new docker_installer_1.DockerInstaller());
    }
    /**
     * Register platform-specific installers
     */
    registerPlatformInstallers() {
        switch (this.platform.os) {
            case 'darwin':
                this.register('platform', new mac_installer_1.MacInstaller());
                break;
            case 'linux':
                this.register('platform', new linux_installer_1.LinuxInstaller());
                break;
            case 'win32':
                this.register('platform', new windows_installer_1.WindowsInstaller());
                break;
        }
    }
    /**
     * Register a new installer
     */
    register(name, installer) {
        if (!installer.isSupported(this.platform)) {
            throw new Error(`Installer ${name} is not supported on ${this.platform.os}`);
        }
        this.installers.set(name, installer);
    }
    /**
     * Get installer by name
     */
    get(name) {
        return this.installers.get(name);
    }
    /**
     * Get all registered installers
     */
    getAll() {
        return new Map(this.installers);
    }
    /**
     * Get installers by category
     */
    getByCategory(_category) {
        return Array.from(this.installers.values()).filter(_installer => {
            // This would require extending BaseInstaller with category info
            return true; // Placeholder
        });
    }
    /**
     * Check if installer is available
     */
    has(name) {
        return this.installers.has(name);
    }
    /**
     * Get installation steps for a profile
     */
    async getInstallationSteps(profile) {
        const steps = [];
        Array.from(this.installers.entries()).forEach(([_name, installer]) => {
            const installerSteps = installer.getSteps(profile, this.platform);
            steps.push(...installerSteps);
        });
        return this.sortStepsByDependencies(steps);
    }
    /**
     * Sort steps by dependencies to ensure proper installation order
     */
    sortStepsByDependencies(steps) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        const visit = (step) => {
            if (visiting.has(step.id)) {
                throw new Error(`Circular dependency detected for step: ${step.id}`);
            }
            if (visited.has(step.id)) {
                return;
            }
            visiting.add(step.id);
            // Process dependencies first
            for (const depId of step.dependencies) {
                const depStep = steps.find(s => s.id === depId);
                if (depStep) {
                    visit(depStep);
                }
            }
            visiting.delete(step.id);
            visited.add(step.id);
            sorted.push(step);
        };
        for (const step of steps) {
            if (!visited.has(step.id)) {
                visit(step);
            }
        }
        return sorted;
    }
    /**
     * Get system setup steps
     */
    async getSystemSteps(platform) {
        const installer = this.installers.get('platform');
        if (!installer)
            return [];
        return installer.getSteps({}, platform);
    }
    /**
     * Get Node.js setup steps
     */
    async getNodeSteps(nodeConfig) {
        const installer = this.installers.get('node');
        if (!installer)
            return [];
        const profile = { tools: { languages: { node: nodeConfig } } };
        return installer.getSteps(profile, this.platform);
    }
    /**
     * Get Python setup steps
     */
    async getPythonSteps(pythonConfig) {
        // Python installer not yet implemented
        return [];
    }
    /**
     * Get Homebrew setup steps
     */
    async getBrewSteps() {
        // Brew installer handled by MacInstaller
        return [];
    }
    /**
     * Get Docker setup steps
     */
    async getDockerSteps() {
        const installer = this.installers.get('docker');
        if (!installer)
            return [];
        return installer.getSteps({}, this.platform);
    }
    /**
     * Get Claude Code setup steps
     */
    async getClaudeCodeSteps() {
        // Claude Code installer to be implemented
        return [];
    }
    /**
     * Get Claude Flow setup steps
     */
    async getClaudeFlowSteps(swarmAgents) {
        // Claude Flow installer to be implemented
        return [];
    }
    /**
     * Get Slack setup steps
     */
    async getSlackSteps() {
        // Slack installer to be implemented
        return [];
    }
    /**
     * Validate all installers on current platform
     */
    async validateAll() {
        const results = {};
        const promises = Array.from(this.installers.entries()).map(async ([name, installer]) => {
            try {
                results[name] = await installer.validate();
            }
            catch (error) {
                results[name] = false;
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Get system information and requirements
     */
    async getSystemInfo() {
        const installedTools = {};
        const missingTools = [];
        const promises = Array.from(this.installers.entries()).map(async ([name, installer]) => {
            const isInstalled = await installer.isInstalled();
            if (isInstalled) {
                const version = await installer.getVersion();
                installedTools[name] = version || 'unknown';
            }
            else {
                missingTools.push(name);
            }
        });
        await Promise.all(promises);
        return {
            platform: this.platform,
            installedTools,
            missingTools
        };
    }
    /**
     * Install all required tools for a profile
     */
    async installProfile(profile) {
        const installed = [];
        const failed = [];
        const errors = [];
        // Process installers sequentially to handle dependencies
        for (const [name, installer] of Array.from(this.installers.entries())) {
            try {
                const isInstalled = await installer.isInstalled();
                if (!isInstalled) {
                    await installer.install(profile, this.platform);
                    if (installer.configure) {
                        await installer.configure(profile, this.platform);
                    }
                    installed.push(name);
                }
            }
            catch (error) {
                failed.push(name);
                errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
        return {
            success: failed.length === 0,
            installed,
            failed,
            errors
        };
    }
}
exports.InstallerRegistry = InstallerRegistry;
// Export all installers
tslib_1.__exportStar(require("./homebrew-installer"), exports);
tslib_1.__exportStar(require("./permissions-installer"), exports);
tslib_1.__exportStar(require("./python-installer"), exports);
tslib_1.__exportStar(require("./node-installer"), exports);
tslib_1.__exportStar(require("./docker-installer"), exports);
tslib_1.__exportStar(require("./git-installer"), exports);
tslib_1.__exportStar(require("./mac-installer"), exports);
tslib_1.__exportStar(require("./linux-installer"), exports);
tslib_1.__exportStar(require("./windows-installer"), exports);
var real_setup_orchestrator_1 = require("./real-setup-orchestrator");
Object.defineProperty(exports, "RealSetupOrchestrator", { enumerable: true, get: function () { return tslib_1.__importDefault(real_setup_orchestrator_1).default; } });
//# sourceMappingURL=index.js.map