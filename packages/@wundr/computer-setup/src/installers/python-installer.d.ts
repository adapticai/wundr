import { BaseInstaller } from './index';
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
export declare class PythonInstaller implements BaseInstaller {
    name: string;
    private readonly homeDir;
    isSupported(platform: SetupPlatform): boolean;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string | null>;
    install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    configure(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
    validate(): Promise<boolean>;
    getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
    private installPython;
    private installPythonMac;
    private installPythonLinux;
    private installPythonDebian;
    private installPythonRedHat;
    private setupPip;
    private installPyenv;
    private setupVirtualEnvironments;
    private installConda;
    private installCommonPackages;
    private setupPythonPaths;
    private configurePip;
    private setupShellIntegration;
    private getPythonUserBase;
    private updateShellWithPythonPaths;
    private setupPythonSymlinks;
    private detectLinuxDistro;
    private validatePip;
    private validatePyenv;
}
//# sourceMappingURL=python-installer.d.ts.map