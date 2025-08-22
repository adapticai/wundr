import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class WindowsInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private checkPowerShellVersion;
    private setupDeveloperMode;
    private installWSL2;
    private installChocolatey;
    private installScoop;
    private installEssentialPackages;
    private installDevelopmentTools;
    private installFrontendTools;
    private installBackendTools;
    private installDevOpsTools;
    private installMobileTools;
    private installMLTools;
    private installCommonDevTools;
    private configureWindows;
    private configurePowerShell;
    private configureWSL;
    private validateDeveloperMode;
    private validateWSL2;
    private validateChocolatey;
    private validateScoop;
    private validateEssentialPackages;
    private validateDevelopmentTools;
    private validatePowerShellConfig;
    private validateWSLConfig;
}
//# sourceMappingURL=windows-installer.d.ts.map