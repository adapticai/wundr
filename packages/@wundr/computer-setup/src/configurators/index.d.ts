/**
 * Configuration Service for Developer Setup
 * Handles configuration of various tools and environments
 */
import { DeveloperProfile, GitConfiguration, AIToolsConfiguration, SetupStep, ConfigurationChange } from '../types';
export declare class ConfiguratorService {
    private configChanges;
    private backupDir;
    constructor();
    private ensureBackupDirectory;
    initialize(): Promise<void>;
    /**
     * Get Git configuration steps
     */
    getGitConfigSteps(config: GitConfiguration): Promise<SetupStep[]>;
    /**
     * Get editor configuration steps
     */
    getEditorSteps(editor: string): Promise<SetupStep[]>;
    /**
     * Configure Git user
     */
    private configureGitUser;
    /**
     * Configure GPG signing
     */
    private configureGPGSigning;
    /**
     * Configure SSH key
     */
    private configureSSHKey;
    /**
     * Configure Git aliases
     */
    private configureGitAliases;
    /**
     * Configure VS Code
     */
    configureVSCode(): Promise<void>;
    /**
     * Install VS Code extensions
     */
    installVSCodeExtensions(): Promise<void>;
    /**
     * Configure Vim/Neovim
     */
    private configureVim;
    /**
     * Configure Sublime Text
     */
    private configureSublime;
    /**
     * Generate shell configuration
     */
    generateShellConfig(profile: DeveloperProfile): Promise<void>;
    /**
     * Clone team repositories
     */
    cloneTeamRepos(team: string): Promise<void>;
    /**
     * Configure Claude Flow
     */
    configureClaudeFlow(aiTools: AIToolsConfiguration): Promise<void>;
    /**
     * Get configuration changes
     */
    getConfigurationChanges(): ConfigurationChange[];
    /**
     * Record a configuration change
     */
    private recordConfigChange;
    /**
     * Get VS Code settings path
     */
    private getVSCodeSettingsPath;
    /**
     * Get Sublime Text settings path
     */
    private getSublimeSettingsPath;
    /**
     * Get shell RC file
     */
    private getShellRcFile;
}
//# sourceMappingURL=index.d.ts.map