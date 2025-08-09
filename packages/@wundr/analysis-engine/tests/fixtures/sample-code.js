"use strict";
/**
 * Sample code for testing analysis engines
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedUserService = exports.UserService = exports.ComplexUserService = void 0;
exports.formatUserName = formatUserName;
exports.displayUserName = displayUserName;
// Complex class for complexity testing
class ComplexUserService {
    constructor(config, logger, validator, emailService, database, metrics) {
        this.config = config;
        this.logger = logger;
        this.validator = validator;
        this.emailService = emailService;
        this.database = database;
        this.metrics = metrics;
        this.users = [];
        this.cache = new Map();
        this.lastUpdate = new Date();
    }
    async createUser(userData) {
        // Complex validation logic
        if (!userData) {
            throw new Error('User data is required');
        }
        if (!userData.name || userData.name.trim().length === 0) {
            throw new Error('Name is required');
        }
        if (!userData.email || !this.isValidEmail(userData.email)) {
            throw new Error('Valid email is required');
        }
        // Nested conditional logic
        if (userData.id) {
            const existingUser = await this.findUserById(userData.id);
            if (existingUser) {
                if (existingUser.email === userData.email) {
                    throw new Error('User with this email already exists');
                }
                else {
                    if (existingUser.name === userData.name) {
                        throw new Error('User with this name already exists');
                    }
                    else {
                        if (this.isDuplicateUser(userData, existingUser)) {
                            throw new Error('Duplicate user detected');
                        }
                    }
                }
            }
        }
        // Complex business logic
        try {
            const validatedData = await this.validateUserData(userData);
            const processedData = await this.processUserData(validatedData);
            const savedData = await this.saveUser(processedData);
            if (savedData) {
                this.cache.set(savedData.id, savedData);
                this.users.push(savedData);
                await this.sendWelcomeEmail(savedData);
                this.updateMetrics('user_created');
                this.lastUpdate = new Date();
                // More nested logic
                if (this.config.enableNotifications) {
                    if (this.config.notificationTypes.includes('email')) {
                        await this.sendNotification(savedData, 'email');
                    }
                    if (this.config.notificationTypes.includes('sms')) {
                        if (savedData.phoneNumber) {
                            await this.sendNotification(savedData, 'sms');
                        }
                    }
                }
                return savedData;
            }
            else {
                throw new Error('Failed to save user');
            }
        }
        catch (error) {
            this.logger.error('Error creating user', error);
            this.updateMetrics('user_creation_failed');
            throw error;
        }
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    async validateUserData(userData) {
        // Simulate complex validation
        if (this.validator) {
            return await this.validator.validate(userData);
        }
        return userData;
    }
    async processUserData(userData) {
        // Simulate data processing
        return {
            ...userData,
            createdAt: new Date(),
            id: userData.id || Math.floor(Math.random() * 10000)
        };
    }
    async saveUser(userData) {
        if (this.database) {
            return await this.database.save('users', userData);
        }
        return userData;
    }
    async findUserById(id) {
        if (this.cache.has(id)) {
            return this.cache.get(id) || null;
        }
        if (this.database) {
            const user = await this.database.findById('users', id);
            if (user) {
                this.cache.set(id, user);
            }
            return user;
        }
        return this.users.find(u => u.id === id) || null;
    }
    isDuplicateUser(user1, user2) {
        return user1.email === user2.email ||
            (user1.name === user2.name && user1.id === user2.id);
    }
    async sendWelcomeEmail(user) {
        if (this.emailService) {
            await this.emailService.send({
                to: user.email,
                subject: 'Welcome!',
                template: 'welcome',
                data: { name: user.name }
            });
        }
    }
    async sendNotification(user, type) {
        // Complex notification logic
        try {
            if (type === 'email' && this.emailService) {
                await this.emailService.send({
                    to: user.email,
                    subject: 'Notification',
                    template: 'notification',
                    data: user
                });
            }
            else if (type === 'sms' && this.config.smsService) {
                await this.config.smsService.send({
                    to: user.phoneNumber,
                    message: `Hello ${user.name}!`
                });
            }
        }
        catch (error) {
            this.logger.error(`Failed to send ${type} notification`, error);
        }
    }
    updateMetrics(event) {
        if (this.metrics) {
            this.metrics.increment(`user_service.${event}`);
        }
    }
}
exports.ComplexUserService = ComplexUserService;
// Duplicate service (for testing duplicate detection)
class UserService {
    constructor(config, logger, validator, emailService, database) {
        this.config = config;
        this.logger = logger;
        this.validator = validator;
        this.emailService = emailService;
        this.database = database;
        this.users = [];
        this.cache = new Map();
        this.lastUpdate = new Date();
    }
    async createUser(userInfo) {
        if (!userInfo) {
            throw new Error('User info is required');
        }
        if (!userInfo.name || userInfo.name.trim().length === 0) {
            throw new Error('Name is required');
        }
        const savedUser = await this.database.save('users', userInfo);
        this.cache.set(savedUser.id, savedUser);
        this.users.push(savedUser);
        return savedUser;
    }
}
exports.UserService = UserService;
// Simple utility function
function formatUserName(user) {
    return `${user.name} (${user.email})`;
}
// Another utility with similar logic (for duplicate detection)
function displayUserName(user) {
    return `${user.name} (${user.email})`;
}
// Wrapper pattern example
class EnhancedUserService extends UserService {
    constructor(config, logger, validator, emailService, database, analytics) {
        super(config, logger, validator, emailService, database);
        this.analytics = analytics;
    }
    async createUser(userInfo) {
        const result = await super.createUser(userInfo);
        // Enhanced functionality
        if (this.analytics) {
            this.analytics.track('user_created', result);
        }
        return result;
    }
}
exports.EnhancedUserService = EnhancedUserService;
//# sourceMappingURL=sample-code.js.map