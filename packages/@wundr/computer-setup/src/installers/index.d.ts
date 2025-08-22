/**
 * Installer Registry - Central hub for managing all platform installers
 */
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export interface BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure?(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    uninstall?(): Promise<void>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
}
export declare class InstallerRegistry {
    private installers;
    private platform;
    constructor(platform: SetupPlatform);
    /**
     * Register core cross-platform installers
     */
    private registerCoreInstallers;
    /**
     * Register platform-specific installers
     */
    private registerPlatformInstallers;
    /**
     * Register a new installer
     */
    register(name: string, installer: BaseInstaller): void;
    /**
     * Get installer by name
     */
    get(name: string): BaseInstaller | undefined;
    /**
     * Get all registered installers
     */
    getAll(): Map<string, BaseInstaller>;
    /**
     * Get installers by category
     */
    getByCategory(_category: string): BaseInstaller[];
    /**
     * Check if installer is available
     */
    has(name: string): boolean;
    /**
     * Get installation steps for a profile
     */
    getInstallationSteps(profile: DeveloperProfile): Promise<SetupStep[]>;
    /**
     * Sort steps by dependencies to ensure proper installation order
     */
    private sortStepsByDependencies;
    /**
     * Get system setup steps
     */
    getSystemSteps(platform: SetupPlatform): Promise<SetupStep[]>;
    /**
     * Get Node.js setup steps
     */
    getNodeSteps(nodeConfig: any): Promise<SetupStep[]>;
    /**
     * Get Python setup steps
     */
    getPythonSteps(pythonConfig: any): Promise<SetupStep[]>;
    /**
     * Get Homebrew setup steps
     */
    getBrewSteps(): Promise<SetupStep[]>;
    /**
     * Get Docker setup steps
     */
    getDockerSteps(): Promise<SetupStep[]>;
    /**
     * Get Claude Code setup steps
     */
    getClaudeCodeSteps(): Promise<SetupStep[]>;
    /**
     * Get Claude Flow setup steps
     */
    getClaudeFlowSteps(swarmAgents?: string[]): Promise<SetupStep[]>;
    /**
     * Get Slack setup steps
     */
    getSlackSteps(): Promise<SetupStep[]>;
    /**
     * Validate all installers on current platform
     */
    validateAll(): Promise<Record<string, boolean>>;
    /**
     * Get system information and requirements
     */
    getSystemInfo(): Promise<{
        platform: SetupPlatform;
        installedTools: Record<string, string>;
        missingTools: string[];
    }>;
    /**
     * Install all required tools for a profile
     */
    installProfile(profile: DeveloperProfile): Promise<{
        success: boolean;
        installed: string[];
        failed: string[];
        errors: Error[];
    }>;
}
export * from './homebrew-installer';
export * from './permissions-installer';
export * from './python-installer';
export * from './node-installer';
export * from './docker-installer';
export * from './git-installer';
export * from './mac-installer';
export * from './linux-installer';
export * from './windows-installer';
export { default as RealSetupOrchestrator } from './real-setup-orchestrator';
//# sourceMappingURL=index.d.ts.map