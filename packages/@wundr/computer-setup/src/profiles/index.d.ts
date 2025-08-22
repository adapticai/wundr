/**
 * Profile Management for Developer Setup
 * Handles different developer profiles and their configurations
 */
import { ConfigManager } from '@wundr.io/config';
import { DeveloperProfile } from '../types';
export declare class ProfileManager {
    private profilesDir;
    private profiles;
    constructor(configManager?: ConfigManager);
    private ensureProfilesDirectory;
    /**
     * Load all profiles from disk
     */
    loadProfiles(): Promise<void>;
    /**
     * Get a specific profile by name
     */
    getProfile(name: string): Promise<DeveloperProfile | null>;
    /**
     * Save a profile to disk
     */
    saveProfile(profile: DeveloperProfile): Promise<void>;
    /**
     * Load a profile from configuration
     */
    loadProfile(profile: DeveloperProfile): Promise<DeveloperProfile>;
    /**
     * List all available profiles
     */
    listProfiles(): Promise<DeveloperProfile[]>;
    /**
     * Create an interactive profile
     */
    createInteractiveProfile(): Promise<DeveloperProfile>;
    /**
     * Get default profile
     */
    getDefaultProfile(): DeveloperProfile;
    /**
     * Get predefined profile by role
     */
    private getPredefinedProfile;
    private getDefaultPreferences;
    private getDefaultTools;
    private getFrontendPreferences;
    private getFrontendTools;
    private getBackendPreferences;
    private getBackendTools;
    private getFullstackPreferences;
    private getFullstackTools;
    private getDevOpsPreferences;
    private getDevOpsTools;
    private getMLPreferences;
    private getMLTools;
    private getMobilePreferences;
    private getMobileTools;
    private mergeProfiles;
    /**
     * Export profiles to a file
     */
    exportProfiles(exportPath: string): Promise<void>;
    /**
     * Import profiles from a file
     */
    importProfiles(importPath: string): Promise<void>;
    /**
     * Delete a profile
     */
    deleteProfile(name: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map