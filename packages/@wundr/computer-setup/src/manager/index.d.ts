/**
 * Computer Setup Manager
 * Orchestrates the complete setup process for new developer machines
 */
import { EventEmitter } from 'events';
import { DeveloperProfile, SetupOptions, SetupResult, SetupProgress } from '../types';
export declare class ComputerSetupManager extends EventEmitter {
    private profileManager;
    private installerRegistry;
    private configuratorService;
    private validator;
    private configManager;
    private steps;
    private progress;
    constructor(configPath?: string);
    /**
     * Initialize the setup manager
     */
    initialize(): Promise<void>;
    /**
     * Run the complete setup process
     */
    setup(options: SetupOptions): Promise<SetupResult>;
    /**
     * Validate platform compatibility
     */
    private validatePlatform;
    /**
     * Generate setup steps based on profile
     */
    private generateSetupSteps;
    /**
     * Sort steps based on their dependencies
     */
    private sortStepsByDependencies;
    /**
     * Run pre-flight checks
     */
    private runPreflightChecks;
    /**
     * Execute a single setup step
     */
    private executeStep;
    /**
     * Run post-setup tasks
     */
    private runPostSetup;
    /**
     * Generate setup report
     */
    private generateReport;
    /**
     * Generate next steps for the user
     */
    private generateNextSteps;
    /**
     * Get available profiles
     */
    getAvailableProfiles(): Promise<DeveloperProfile[]>;
    /**
     * Create a new profile interactively
     */
    createProfile(): Promise<DeveloperProfile>;
    /**
     * Validate current setup
     */
    validateSetup(profile: DeveloperProfile): Promise<boolean>;
    /**
     * Get setup progress
     */
    getProgress(): SetupProgress;
}
//# sourceMappingURL=index.d.ts.map