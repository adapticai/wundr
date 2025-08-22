/**
 * Real Setup Orchestrator - Production-ready computer setup management
 *
 * Features:
 * - Installation order and dependency management
 * - Profile-based installations (frontend, backend, fullstack, devops)
 * - Real-time progress tracking with user feedback
 * - Comprehensive error handling and graceful recovery
 * - Resume from failure capability with state persistence
 * - Validation and verification for each installation step
 * - Coordinated installer management with rollback support
 */
import { EventEmitter } from 'events';
import { SetupPlatform, SetupOptions, SetupResult, SetupProgress } from '../types';
interface ProfileConfig {
    name: string;
    description: string;
    priority: number;
    categories: string[];
    requiredTools: string[];
    optionalTools: string[];
    estimatedTimeMinutes: number;
}
interface ProgressCallback {
    (progress: SetupProgress): void;
}
export declare class RealSetupOrchestrator extends EventEmitter {
    private platform;
    private state;
    private stateFile;
    private installers;
    private profiles;
    private progressCallbacks;
    constructor(platform: SetupPlatform);
    /**
     * Initialize all available installers
     */
    private initializeInstallers;
    /**
     * Initialize predefined development profiles
     */
    private initializeProfiles;
    /**
     * Create a generic core tool installer
     */
    private createCoreToolInstaller;
    /**
     * Main orchestration method - manages the complete installation flow
     */
    orchestrate(profileName: string, options?: Partial<SetupOptions>, progressCallback?: ProgressCallback): Promise<SetupResult>;
    /**
     * Resume a failed installation from saved state
     */
    resume(progressCallback?: ProgressCallback): Promise<SetupResult>;
    /**
     * Get list of available profiles
     */
    getAvailableProfiles(): ProfileConfig[];
    /**
     * Check if there's a resumable setup
     */
    canResume(): Promise<boolean>;
    /**
     * Initialize installation state
     */
    private initializeState;
    /**
     * Create installation plan based on profile
     */
    private createInstallationPlan;
    /**
     * Execute a phase of the installation
     */
    private executePhase;
    /**
     * Validate system requirements
     */
    private validateSystemRequirements;
    /**
     * Setup system permissions
     */
    private setupSystemPermissions;
    /**
     * Install core system tools
     */
    private installCoreSystemTools;
    /**
     * Install development tools
     */
    private installDevelopmentTools;
    /**
     * Configure installed tools
     */
    private configureInstalledTools;
    /**
     * Validate installation
     */
    private validateInstallation;
    /**
     * Finalize setup
     */
    private finalizeSetup;
    /**
     * Execute a single installer
     */
    private executeInstaller;
    /**
     * Execute a list of steps
     */
    private executeSteps;
    /**
     * Execute a single step
     */
    private executeStep;
    /**
     * Emit progress updates
     */
    private emitProgress;
    /**
     * Utility methods
     */
    private generateSessionId;
    private createDeveloperProfile;
    private getLanguagesForProfile;
    private getFrameworksForProfile;
    private getDatabasesForProfile;
    private topologicalSort;
    private findCriticalPath;
    private getCurrentProgress;
    private getTotalSteps;
    private getAvailableDiskSpace;
    private verifyNetworkConnectivity;
    private createShellAliases;
    private createDevelopmentStructure;
    private showNextSteps;
    private saveState;
    private loadState;
    private cleanupState;
    private generateResult;
}
export default RealSetupOrchestrator;
//# sourceMappingURL=real-setup-orchestrator.d.ts.map