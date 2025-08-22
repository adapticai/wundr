/**
 * Setup Orchestrator
 * Coordinates the entire computer setup process
 */
import { EventEmitter } from 'events';
import { SetupOptions, SetupResult, SetupProgress } from '../types';
import { ProfileManager } from '../profiles';
import { InstallerRegistry } from '../installers';
import { ConfiguratorService } from '../configurators';
import { SetupValidator } from '../validators';
export declare class SetupOrchestrator extends EventEmitter {
    private profileManager;
    private installerRegistry;
    private configuratorService;
    private validator;
    private progress;
    private activeSteps;
    private completedSteps;
    private failedSteps;
    constructor(profileManager: ProfileManager, installerRegistry: InstallerRegistry, configuratorService: ConfiguratorService, validator: SetupValidator);
    /**
     * Initialize progress tracking
     */
    private initializeProgress;
    /**
     * Orchestrate the complete setup process
     */
    orchestrate(options: SetupOptions): Promise<SetupResult>;
    /**
     * Phase 1: Validation
     */
    private validatePhase;
    /**
     * Phase 2: Preparation
     */
    private preparationPhase;
    /**
     * Phase 3: Installation
     */
    private installationPhase;
    /**
     * Phase 4: Configuration
     */
    private configurationPhase;
    /**
     * Phase 5: Verification
     */
    private verificationPhase;
    /**
     * Phase 6: Finalization
     */
    private finalizationPhase;
    /**
     * Generate installation plan
     */
    private generateInstallationPlan;
    /**
     * Execute steps in parallel
     */
    private executeParallel;
    /**
     * Execute steps sequentially
     */
    private executeSequential;
    /**
     * Execute a single step
     */
    private executeStep;
    /**
     * Sort steps by dependencies
     */
    private sortByDependencies;
    /**
     * Group steps by dependency levels
     */
    private groupByDependencies;
    /**
     * Apply team configuration
     */
    private applyTeamConfiguration;
    /**
     * Generate setup report
     */
    private generateSetupReport;
    /**
     * Update progress
     */
    private updateProgress;
    /**
     * Cleanup temporary files
     */
    private cleanup;
    /**
     * Get current progress
     */
    getProgress(): SetupProgress;
    /**
     * Cancel setup
     */
    cancel(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map