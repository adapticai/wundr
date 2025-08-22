"use strict";
/**
 * Setup Validator
 * Validates system requirements and installed tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupValidator = void 0;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const os = tslib_1.__importStar(require("os"));
// import { getLogger } from '@wundr/core'; // TODO: Fix core exports
const getLogger = (name) => console;
const logger = getLogger('computer-setup:validator');
class SetupValidator {
    installedTools = new Map();
    credentialSetups = [];
    /**
     * Validate platform compatibility
     */
    async validatePlatform(platform) {
        logger.info(`Validating platform: ${platform.os} ${platform.arch}`);
        // Check supported platforms
        const supportedPlatforms = ['darwin', 'linux', 'win32'];
        const supportedArchitectures = ['x64', 'arm64'];
        if (!supportedPlatforms.includes(platform.os)) {
            logger.error(`Unsupported platform: ${platform.os}`);
            return false;
        }
        if (!supportedArchitectures.includes(platform.arch)) {
            logger.error(`Unsupported architecture: ${platform.arch}`);
            return false;
        }
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 18) {
            logger.error(`Node.js version ${nodeVersion} is too old. Minimum required: v18.0.0`);
            return false;
        }
        return true;
    }
    /**
     * Check if sufficient disk space is available
     */
    async checkDiskSpace(requiredBytes) {
        try {
            const homeDir = os.homedir();
            if (process.platform === 'win32') {
                // Windows disk space check
                const output = (0, child_process_1.execSync)(`wmic logicaldisk where caption="${homeDir.charAt(0)}:" get size,freespace`).toString();
                const lines = output.trim().split('\n');
                if (lines.length >= 2) {
                    const values = lines[1].trim().split(/\s+/);
                    const freeSpace = parseInt(values[0]);
                    return freeSpace >= requiredBytes;
                }
            }
            else {
                // Unix-like disk space check
                const output = (0, child_process_1.execSync)(`df -k "${homeDir}"`).toString();
                const lines = output.trim().split('\n');
                if (lines.length >= 2) {
                    const values = lines[1].trim().split(/\s+/);
                    const availableKB = parseInt(values[3]);
                    const availableBytes = availableKB * 1024;
                    return availableBytes >= requiredBytes;
                }
            }
        }
        catch (error) {
            logger.warn('Could not check disk space', error);
        }
        return true; // Assume sufficient space if check fails
    }
    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        try {
            // Try to ping a reliable server
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)('ping -n 1 8.8.8.8', { stdio: 'ignore' });
            }
            else {
                (0, child_process_1.execSync)('ping -c 1 8.8.8.8', { stdio: 'ignore' });
            }
            return true;
        }
        catch (error) {
            logger.error('No network connectivity');
            return false;
        }
    }
    /**
     * Check if running with admin privileges
     */
    async checkAdminPrivileges() {
        try {
            if (process.platform === 'win32') {
                // Windows admin check
                try {
                    (0, child_process_1.execSync)('net session', { stdio: 'ignore' });
                    return true;
                }
                catch {
                    return false;
                }
            }
            else {
                // Unix-like admin check
                return process.getuid && process.getuid() === 0;
            }
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Validate full setup against a profile
     */
    async validateFullSetup(profile) {
        logger.info('Validating full setup');
        const validations = [];
        // Validate Git
        validations.push(() => this.validateGit(profile.preferences.gitConfig.userName));
        // Validate Node.js
        if (profile.tools.languages.node) {
            validations.push(() => this.validateNode(profile.tools.languages.node.defaultVersion));
        }
        // Validate Python
        if (profile.tools.languages.python) {
            validations.push(() => this.validatePython(profile.tools.languages.python.defaultVersion));
        }
        // Validate Docker
        if (profile.tools.containers.docker) {
            validations.push(() => this.validateDocker());
        }
        // Validate package managers
        if (profile.tools.packageManagers.pnpm) {
            validations.push(() => this.validatePackageManager('pnpm'));
        }
        // Run all validations
        const results = await Promise.all(validations.map(v => v()));
        return results.every(r => r);
    }
    /**
     * Validate Git installation and configuration
     */
    async validateGit(expectedUser) {
        try {
            // Check Git version
            const version = (0, child_process_1.execSync)('git --version').toString().trim();
            logger.info(`Git version: ${version}`);
            // Check user configuration
            if (expectedUser) {
                const userName = (0, child_process_1.execSync)('git config --global user.name').toString().trim();
                if (userName !== expectedUser) {
                    logger.warn(`Git user mismatch. Expected: ${expectedUser}, Found: ${userName}`);
                    return false;
                }
            }
            this.recordInstalledTool('git', version, 'git', 'version-control');
            return true;
        }
        catch (error) {
            logger.error('Git validation failed', error);
            return false;
        }
    }
    /**
     * Validate Node.js installation
     */
    async validateNode(expectedVersion) {
        try {
            const version = (0, child_process_1.execSync)('node --version').toString().trim();
            logger.info(`Node.js version: ${version}`);
            if (expectedVersion) {
                const major = version.slice(1).split('.')[0];
                if (!expectedVersion.includes(major)) {
                    logger.warn(`Node version mismatch. Expected: v${expectedVersion}, Found: ${version}`);
                    return false;
                }
            }
            // Check npm
            const npmVersion = (0, child_process_1.execSync)('npm --version').toString().trim();
            logger.info(`npm version: ${npmVersion}`);
            this.recordInstalledTool('node', version, 'node', 'language');
            this.recordInstalledTool('npm', npmVersion, 'npm', 'package-manager');
            return true;
        }
        catch (error) {
            logger.error('Node.js validation failed', error);
            return false;
        }
    }
    /**
     * Validate Python installation
     */
    async validatePython(expectedVersion) {
        try {
            const commands = ['python3', 'python'];
            let version = '';
            let command = '';
            for (const cmd of commands) {
                try {
                    version = (0, child_process_1.execSync)(`${cmd} --version`).toString().trim();
                    command = cmd;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!version) {
                logger.error('Python not found');
                return false;
            }
            logger.info(`Python version: ${version}`);
            if (expectedVersion) {
                const versionMatch = version.match(/(\d+\.\d+)/);
                if (versionMatch && !expectedVersion.includes(versionMatch[1])) {
                    logger.warn(`Python version mismatch. Expected: ${expectedVersion}, Found: ${versionMatch[1]}`);
                    return false;
                }
            }
            this.recordInstalledTool('python', version, command, 'language');
            return true;
        }
        catch (error) {
            logger.error('Python validation failed', error);
            return false;
        }
    }
    /**
     * Validate Docker installation
     */
    async validateDocker() {
        try {
            const version = (0, child_process_1.execSync)('docker --version').toString().trim();
            logger.info(`Docker version: ${version}`);
            // Check if Docker daemon is running
            (0, child_process_1.execSync)('docker ps', { stdio: 'ignore' });
            // Check Docker Compose
            try {
                const composeVersion = (0, child_process_1.execSync)('docker compose version').toString().trim();
                logger.info(`Docker Compose version: ${composeVersion}`);
                this.recordInstalledTool('docker-compose', composeVersion, 'docker', 'container');
            }
            catch {
                logger.warn('Docker Compose not found');
            }
            this.recordInstalledTool('docker', version, 'docker', 'container');
            return true;
        }
        catch (error) {
            logger.error('Docker validation failed', error);
            return false;
        }
    }
    /**
     * Validate package manager
     */
    async validatePackageManager(manager) {
        try {
            const version = (0, child_process_1.execSync)(`${manager} --version`).toString().trim();
            logger.info(`${manager} version: ${version}`);
            this.recordInstalledTool(manager, version, manager, 'package-manager');
            return true;
        }
        catch (error) {
            logger.error(`${manager} validation failed`, error);
            return false;
        }
    }
    /**
     * Check if a command exists
     */
    async commandExists(command) {
        try {
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)(`where ${command}`, { stdio: 'ignore' });
            }
            else {
                (0, child_process_1.execSync)(`which ${command}`, { stdio: 'ignore' });
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Validate VS Code installation
     */
    async validateVSCode() {
        try {
            const version = (0, child_process_1.execSync)('code --version').toString().split('\n')[0].trim();
            logger.info(`VS Code version: ${version}`);
            // Check installed extensions
            const extensions = (0, child_process_1.execSync)('code --list-extensions').toString().trim().split('\n');
            logger.info(`VS Code extensions: ${extensions.length} installed`);
            this.recordInstalledTool('vscode', version, 'code', 'editor');
            return true;
        }
        catch (error) {
            logger.error('VS Code validation failed', error);
            return false;
        }
    }
    /**
     * Validate Claude Code installation
     */
    async validateClaudeCode() {
        try {
            const version = (0, child_process_1.execSync)('claude --version').toString().trim();
            logger.info(`Claude Code version: ${version}`);
            this.recordInstalledTool('claude-code', version, 'claude', 'ai-tool');
            return true;
        }
        catch (error) {
            logger.error('Claude Code validation failed', error);
            return false;
        }
    }
    /**
     * Validate SSH key setup
     */
    async validateSSHKey() {
        try {
            const sshDir = path.join(os.homedir(), '.ssh');
            const keyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa'];
            for (const keyFile of keyFiles) {
                const keyPath = path.join(sshDir, keyFile);
                if (await fs.pathExists(keyPath)) {
                    logger.info(`SSH key found: ${keyFile}`);
                    this.credentialSetups.push({
                        service: 'ssh',
                        type: 'ssh',
                        stored: true,
                        location: keyPath
                    });
                    return true;
                }
            }
            logger.warn('No SSH key found');
            return false;
        }
        catch (error) {
            logger.error('SSH key validation failed', error);
            return false;
        }
    }
    /**
     * Get all installed tools
     */
    async getInstalledTools() {
        return Array.from(this.installedTools.values());
    }
    /**
     * Get credential setups
     */
    async getCredentialSetups() {
        return this.credentialSetups;
    }
    /**
     * Record an installed tool
     */
    recordInstalledTool(name, version, location, category) {
        this.installedTools.set(name, {
            name,
            version,
            location,
            category
        });
    }
    /**
     * Validate environment variables
     */
    async validateEnvironmentVariables(required) {
        const missing = [];
        for (const envVar of required) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }
        if (missing.length > 0) {
            logger.error(`Missing environment variables: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }
    /**
     * Validate network ports
     */
    async validateNetworkPorts(ports) {
        // This would check if required ports are available
        // For now, return true
        return true;
    }
}
exports.SetupValidator = SetupValidator;
//# sourceMappingURL=index.js.map