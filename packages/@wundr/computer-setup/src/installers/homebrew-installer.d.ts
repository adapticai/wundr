import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class HomebrewInstaller implements BaseInstaller {
    name: string;
    private readonly homeDir;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private installHomebrew;
    private setupBrewPath;
    private updateHomebrew;
    private installCoreTools;
    private installDevTools;
    private configureHomebrew;
    private setupShellIntegration;
    private setupAliases;
    uninstall(): Promise<void>;
}
//# sourceMappingURL=homebrew-installer.d.ts.map