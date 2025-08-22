import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class MacInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private installXcodeCommandLineTools;
    private installHomebrew;
    private installEssentialPackages;
    private installApplications;
    private getApplicationsForProfile;
    private configureMacOS;
    private configureShell;
    private configureZsh;
    private configureFish;
    private configureBash;
    private setupDotfiles;
    private validateXcodeCommandLineTools;
    private validateHomebrew;
    private validateEssentialPackages;
    private validateApplications;
    private validateMacOSConfig;
    private validateShellConfig;
}
//# sourceMappingURL=mac-installer.d.ts.map