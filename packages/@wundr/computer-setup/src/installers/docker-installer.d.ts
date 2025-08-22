import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class DockerInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private installDocker;
    private installOnMac;
    private isDockerDesktopInstalled;
    private startDockerDesktop;
    private waitForDockerDaemon;
    private installOnLinux;
    private installOnDebian;
    private installOnRedHat;
    private installOnWindows;
    private installDockerCompose;
    private configureDockerDaemon;
    private setupDockerContext;
    private configureResourceLimits;
    private detectLinuxDistro;
    private validateDockerCompose;
    /**
     * Install Docker Desktop directly from DMG for macOS
     * Handles both Intel and Apple Silicon architectures
     */
    private installDockerDesktopDMG;
    /**
     * Extract mount point from hdiutil output
     */
    private extractMountPoint;
    /**
     * Verify Docker installation is working properly
     */
    private verifyDockerInstallation;
    private installDockerTools;
    private setupDockerAliases;
    private createDockerTemplates;
}
//# sourceMappingURL=docker-installer.d.ts.map