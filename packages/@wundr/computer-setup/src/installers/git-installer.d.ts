import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class GitInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private installGit;
    private installOnMac;
    private installOnLinux;
    private installOnWindows;
    private configureGit;
    private configureBasicGit;
    private configureAdvancedGit;
    private setupCommitSigning;
    private generateGPGKey;
    private importGPGKey;
    private getGPGKeyId;
    private installGPG;
    private setupGitIncludes;
    private detectLinuxDistro;
    private validateBasicConfig;
    private validateAdvancedConfig;
    private setupSSHKeys;
    private validateSSHKeys;
    private validateGPGSigning;
    private setupGlobalGitignore;
}
//# sourceMappingURL=git-installer.d.ts.map