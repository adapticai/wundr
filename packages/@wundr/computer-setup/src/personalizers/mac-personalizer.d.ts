import { ProfileConfig } from './profile-personalizer';
export interface DockApp {
    name: string;
    path: string;
    required?: boolean;
}
export interface HotCorner {
    corner: 'tl' | 'tr' | 'bl' | 'br';
    action: number;
    modifier: number;
}
export declare class MacPersonalizer {
    private config;
    constructor(config: ProfileConfig);
    /**
     * Set computer name based on user's full name
     */
    setComputerName(): Promise<void>;
    /**
     * Set user account picture
     */
    setUserPicture(picturePath: string): Promise<void>;
    /**
     * Set desktop wallpaper
     */
    setDesktopWallpaper(wallpaperPath: string): Promise<void>;
    /**
     * Configure Dock with developer-friendly settings and apps
     */
    configureDock(): Promise<void>;
    /**
     * Add application to Dock
     */
    private addAppToDock;
    /**
     * Setup hot corners for productivity
     */
    setupHotCorners(): Promise<void>;
    /**
     * Setup custom Terminal profile with aliases and functions
     */
    setupTerminalProfile(): Promise<void>;
    /**
     * Create terminal profile content with custom PS1, aliases, and functions
     */
    private createTerminalProfile;
    /**
     * Configure macOS system preferences for development
     */
    configureSystemPreferences(): Promise<void>;
    /**
     * Setup Development directory structure
     */
    setupDevelopmentDirectories(): Promise<void>;
    /**
     * Get current system information
     */
    getSystemInfo(): Promise<any>;
}
//# sourceMappingURL=mac-personalizer.d.ts.map