/**
 * Type definitions for computer setup and provisioning
 */
export interface DeveloperProfile {
    name: string;
    email?: string;
    role: string;
    team?: string;
    company?: string;
    preferences?: ProfilePreferences;
    languages?: {
        javascript?: boolean;
        typescript?: boolean;
        python?: boolean;
        go?: boolean;
        rust?: boolean;
        java?: boolean;
    };
    frameworks?: {
        react?: boolean;
        vue?: boolean;
        angular?: boolean;
        nextjs?: boolean;
        express?: boolean;
        nestjs?: boolean;
        fastapi?: boolean;
        tensorflow?: boolean;
        pytorch?: boolean;
        scikitLearn?: boolean;
    };
    tools: {
        packageManagers?: PackageManagers;
        containers?: ContainerTools;
        editors?: {
            vscode?: boolean;
            vim?: boolean;
            neovim?: boolean;
            sublime?: boolean;
            intellij?: boolean;
            claude?: boolean;
            jupyter?: boolean;
        };
        databases?: DatabaseTools;
        cloud?: CloudCLIs;
        ci?: {
            jenkins?: boolean;
            githubActions?: boolean;
            gitlab?: boolean;
        };
        languages?: ProgrammingLanguages;
        cloudCLIs?: CloudCLIs;
        monitoring?: MonitoringTools;
        communication?: CommunicationTools;
    };
}
export interface ProfilePreferences {
    shell: 'bash' | 'zsh' | 'fish';
    editor: 'vscode' | 'vim' | 'neovim' | 'sublime' | 'intellij';
    theme: 'dark' | 'light' | 'auto';
    gitConfig: GitConfiguration;
    aiTools: AIToolsConfiguration;
}
export interface GitConfiguration {
    userName: string;
    userEmail: string;
    signCommits: boolean;
    gpgKey?: string;
    sshKey?: string;
    defaultBranch: string;
    aliases: Record<string, string>;
}
export interface AIToolsConfiguration {
    claudeCode: boolean;
    claudeFlow: boolean;
    mcpTools: string[];
    swarmAgents: string[];
    memoryAllocation: string;
}
export interface RequiredTools {
    languages?: ProgrammingLanguages;
    packageManagers?: PackageManagers;
    containers?: ContainerTools;
    editors?: {
        vscode?: boolean;
        vim?: boolean;
        neovim?: boolean;
        sublime?: boolean;
        intellij?: boolean;
        claude?: boolean;
        jupyter?: boolean;
    };
    databases?: DatabaseTools;
    cloud?: CloudCLIs;
    ci?: {
        jenkins?: boolean;
        githubActions?: boolean;
        gitlab?: boolean;
    };
    cloudCLIs?: CloudCLIs;
    monitoring?: MonitoringTools;
    communication?: CommunicationTools;
}
export interface ProgrammingLanguages {
    node?: {
        versions: string[];
        defaultVersion: string;
        globalPackages: string[];
    };
    python?: {
        versions: string[];
        defaultVersion: string;
        virtualEnv: 'venv' | 'pyenv' | 'conda';
    };
    go?: {
        version: string;
        goPath: string;
    };
    rust?: {
        version: string;
        components: string[];
    };
    java?: {
        version: string;
        jdk: 'openjdk' | 'oracle' | 'adoptium';
    };
}
export interface PackageManagers {
    npm?: boolean;
    pnpm?: boolean;
    yarn?: boolean;
    brew?: boolean;
    apt?: boolean;
    yum?: boolean;
    chocolatey?: boolean;
    pip?: boolean;
    conda?: boolean;
}
export interface ContainerTools {
    docker: boolean;
    dockerCompose: boolean;
    kubernetes?: boolean;
    podman?: boolean;
}
export interface CloudCLIs {
    aws?: boolean;
    gcloud?: boolean;
    azure?: boolean;
    vercel?: boolean;
    netlify?: boolean;
    railway?: boolean;
}
export interface DatabaseTools {
    postgresql?: boolean;
    mysql?: boolean;
    mongodb?: boolean;
    redis?: boolean;
    sqlite?: boolean;
}
export interface MonitoringTools {
    datadog?: boolean;
    newRelic?: boolean;
    sentry?: boolean;
    grafana?: boolean;
}
export interface CommunicationTools {
    slack: {
        workspaces: string[];
        profile: SlackProfile;
    };
    teams?: boolean;
    discord?: boolean;
    zoom?: boolean;
}
export interface SlackProfile {
    displayName: string;
    statusText: string;
    statusEmoji: string;
    profilePhoto?: string;
}
export interface SetupPlatform {
    os: 'darwin' | 'linux' | 'win32';
    arch: 'x64' | 'arm64';
    distro?: string;
    version?: string;
    node?: string;
    shell?: string;
}
export interface SetupOptions {
    profile: DeveloperProfile;
    platform: SetupPlatform;
    mode: 'interactive' | 'automated' | 'minimal';
    skipExisting: boolean;
    dryRun: boolean;
    verbose: boolean;
    parallel: boolean;
    generateReport: boolean;
}
export interface SetupStep {
    id: string;
    name: string;
    description: string;
    category: 'system' | 'development' | 'communication' | 'ai' | 'configuration';
    required: boolean;
    dependencies: string[];
    estimatedTime: number;
    validator?: () => Promise<boolean>;
    installer: () => Promise<void>;
    rollback?: () => Promise<void>;
}
export interface SetupResult {
    success: boolean;
    completedSteps: string[];
    failedSteps: string[];
    skippedSteps: string[];
    warnings: string[];
    errors: Error[];
    duration: number;
    report?: SetupReport;
}
export interface SetupReport {
    timestamp: Date;
    profile: DeveloperProfile;
    platform: SetupPlatform;
    installedTools: InstalledTool[];
    configurations: ConfigurationChange[];
    credentials: CredentialSetup[];
    nextSteps: string[];
}
export interface InstalledTool {
    name: string;
    version: string;
    location: string;
    category: string;
    globalPackages?: string[];
}
export interface ConfigurationChange {
    file: string;
    changes: string[];
    backup?: string;
}
export interface CredentialSetup {
    service: string;
    type: 'api_key' | 'oauth' | 'ssh' | 'gpg';
    stored: boolean;
    location: string;
}
export interface TeamConfiguration {
    organization: string;
    teamName: string;
    standardTools: RequiredTools;
    customScripts: string[];
    repositories: string[];
    accessTokens: Record<string, string>;
    onboardingDocs: string[];
}
export interface SetupProgress {
    totalSteps: number;
    completedSteps: number;
    currentStep: string;
    percentage: number;
    estimatedTimeRemaining: number;
    logs: string[];
}
//# sourceMappingURL=index.d.ts.map