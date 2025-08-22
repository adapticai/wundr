import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class PermissionsInstaller implements BaseInstaller {
    name: string;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private setupSudoTouchId;
    private fixPermissions;
    private fixNpmPermissions;
    private setupDevDirectories;
    private configureFileLimits;
    private setupSshPermissions;
    private configureFinderSettings;
}
//# sourceMappingURL=permissions-installer.d.ts.map