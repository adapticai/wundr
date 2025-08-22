import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class NodeInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private isNVMInstalled;
    private installNVM;
    private installNodeVersion;
    private installAllNodeVersions;
    private setDefaultNodeVersion;
    private installGlobalPackages;
    private installPackageManagers;
    private installPnpm;
    private installYarn;
    private configureNPM;
    private setupNVMRC;
    private configurePackageManagers;
    private validateNodeVersions;
    private validateDefaultVersion;
    private validateGlobalPackages;
    private setupNVMShellIntegration;
    private updateShellWithNpmGlobal;
    private updateShellWithPnpm;
}
//# sourceMappingURL=node-installer.d.ts.map