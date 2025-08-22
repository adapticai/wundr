import { ProfileConfig } from './profile-personalizer';
export interface WallpaperConfig {
    width: number;
    height: number;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
}
export declare class WallpaperGenerator {
    private config;
    private defaultWallpaperConfig;
    constructor(config: ProfileConfig);
    /**
     * Create personalized wallpaper based on user profile
     */
    createWallpaper(outputDir: string): Promise<string>;
    /**
     * Generate personalized color scheme based on user name
     */
    private generatePersonalizedConfig;
    /**
     * Create gradient background
     */
    private createGradientBackground;
    /**
     * Add subtle circular pattern overlay
     */
    private addSubtlePattern;
    /**
     * Add personalized welcome text
     */
    private addPersonalizedText;
    /**
     * Convert HSV to RGB color space
     */
    private hsvToRgb;
    /**
     * Create a minimalist coding-themed wallpaper
     */
    createCodingWallpaper(outputDir: string): Promise<string>;
    /**
     * Add code-like visual pattern
     */
    private addCodePattern;
    /**
     * Add terminal-style welcome text
     */
    private addTerminalText;
}
//# sourceMappingURL=wallpaper-generator.d.ts.map