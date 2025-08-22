/**
 * Simple Profile Personalizer - Basic implementation without optional dependencies
 */
export interface ProfileConfig {
    fullName: string;
    role: string;
    jobTitle?: string;
    company?: string;
    email?: string;
    location?: string;
    platforms?: {
        slack?: boolean;
        gmail?: boolean;
    };
}
export declare class ProfilePersonalizerSimple {
    private config;
    constructor(config: ProfileConfig);
    personalize(): Promise<void>;
    private setupGitConfig;
    private createDirectories;
}
//# sourceMappingURL=profile-personalizer-simple.d.ts.map