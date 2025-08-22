/**
 * Setup Validator
 * Validates system requirements and installed tools
 */
import { DeveloperProfile, SetupPlatform, InstalledTool, CredentialSetup } from '../types';
export declare class SetupValidator {
    private installedTools;
    private credentialSetups;
    /**
     * Validate platform compatibility
     */
    validatePlatform(platform: SetupPlatform): Promise<boolean>;
    /**
     * Check if sufficient disk space is available
     */
    checkDiskSpace(requiredBytes: number): Promise<boolean>;
    /**
     * Check network connectivity
     */
    checkNetworkConnectivity(): Promise<boolean>;
    /**
     * Check if running with admin privileges
     */
    checkAdminPrivileges(): Promise<boolean>;
    /**
     * Validate full setup against a profile
     */
    validateFullSetup(profile: DeveloperProfile): Promise<boolean>;
    /**
     * Validate Git installation and configuration
     */
    validateGit(expectedUser?: string): Promise<boolean>;
    /**
     * Validate Node.js installation
     */
    validateNode(expectedVersion?: string): Promise<boolean>;
    /**
     * Validate Python installation
     */
    validatePython(expectedVersion?: string): Promise<boolean>;
    /**
     * Validate Docker installation
     */
    validateDocker(): Promise<boolean>;
    /**
     * Validate package manager
     */
    validatePackageManager(manager: string): Promise<boolean>;
    /**
     * Check if a command exists
     */
    commandExists(command: string): Promise<boolean>;
    /**
     * Validate VS Code installation
     */
    validateVSCode(): Promise<boolean>;
    /**
     * Validate Claude Code installation
     */
    validateClaudeCode(): Promise<boolean>;
    /**
     * Validate SSH key setup
     */
    validateSSHKey(): Promise<boolean>;
    /**
     * Get all installed tools
     */
    getInstalledTools(): Promise<InstalledTool[]>;
    /**
     * Get credential setups
     */
    getCredentialSetups(): Promise<CredentialSetup[]>;
    /**
     * Record an installed tool
     */
    private recordInstalledTool;
    /**
     * Validate environment variables
     */
    validateEnvironmentVariables(required: string[]): Promise<boolean>;
    /**
     * Validate network ports
     */
    validateNetworkPorts(ports: number[]): Promise<boolean>;
}
//# sourceMappingURL=index.d.ts.map