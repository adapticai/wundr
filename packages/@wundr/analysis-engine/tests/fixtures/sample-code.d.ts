/**
 * Sample code for testing analysis engines
 */
export interface UserData {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}
export interface UserInfo {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}
export declare class ComplexUserService {
    private config;
    private logger;
    private validator;
    private emailService;
    private database;
    private metrics;
    private users;
    private cache;
    private lastUpdate;
    constructor(config: any, logger: any, validator: any, emailService: any, database: any, metrics: any);
    createUser(userData: UserData): Promise<UserData>;
    private isValidEmail;
    private validateUserData;
    private processUserData;
    private saveUser;
    private findUserById;
    private isDuplicateUser;
    private sendWelcomeEmail;
    private sendNotification;
    private updateMetrics;
}
export declare class UserService {
    private config;
    private logger;
    private validator;
    private emailService;
    private database;
    private users;
    private cache;
    private lastUpdate;
    constructor(config: any, logger: any, validator: any, emailService: any, database: any);
    createUser(userInfo: UserInfo): Promise<UserInfo>;
}
export declare function formatUserName(user: UserData): string;
export declare function displayUserName(user: UserInfo): string;
export declare class EnhancedUserService extends UserService {
    private analytics;
    constructor(config: any, logger: any, validator: any, emailService: any, database: any, analytics: any);
    createUser(userInfo: UserInfo): Promise<UserInfo>;
}
//# sourceMappingURL=sample-code.d.ts.map