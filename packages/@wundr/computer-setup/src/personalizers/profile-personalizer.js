"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilePersonalizer = void 0;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const ora_1 = tslib_1.__importDefault(require("ora"));
const wallpaper_generator_1 = require("./wallpaper-generator");
const slack_integration_1 = require("./slack-integration");
const mac_personalizer_1 = require("./mac-personalizer");
class ProfilePersonalizer {
    config;
    spinner;
    profilePhotosDir;
    wallpaperDir;
    constructor(config) {
        this.config = config;
        this.spinner = (0, ora_1.default)();
        this.profilePhotosDir = (0, path_1.join)((0, os_1.homedir)(), '.profile_photos');
        this.wallpaperDir = (0, path_1.join)((0, os_1.homedir)(), '.wallpapers');
    }
    /**
     * Main orchestration method to personalize the entire profile
     */
    async personalize() {
        this.spinner.start(chalk_1.default.blue('🎨 Starting profile personalization...'));
        try {
            // Generate random profile data if not provided
            this.generateRandomProfileData();
            // Create necessary directories
            await this.createDirectories();
            // Generate profile photo if OpenAI API key is available
            let profilePhotos;
            if (this.config.openaiApiKey) {
                profilePhotos = await this.generateProfilePhoto();
            }
            else {
                this.spinner.warn(chalk_1.default.yellow('⚠️  OpenAI API key not provided, skipping profile photo generation'));
            }
            // Update external services
            await Promise.allSettled([
                this.updateSlackProfile(profilePhotos),
                this.updateGmailProfile(),
            ]);
            // Personalize Mac if on macOS
            if (process.platform === 'darwin') {
                await this.personalizeMac(profilePhotos);
            }
            // Create welcome script
            await this.createWelcomeScript();
            this.spinner.succeed(chalk_1.default.green('✅ Profile personalization completed successfully!'));
        }
        catch (error) {
            this.spinner.fail(chalk_1.default.red(`❌ Profile personalization failed: ${error}`));
            throw error;
        }
    }
    /**
     * Generate random profile data for missing fields
     */
    generateRandomProfileData() {
        if (!this.config.age) {
            this.config.age = 22 + Math.floor(Math.random() * 34);
        }
        if (!this.config.location) {
            const locations = ['San Francisco', 'New York', 'London', 'Sydney', 'Singapore'];
            this.config.location = locations[Math.floor(Math.random() * locations.length)];
        }
        this.spinner.info(chalk_1.default.cyan(`📊 Generated profile: Age ${this.config.age}, Location: ${this.config.location}`));
    }
    /**
     * Create necessary directories for profile assets
     */
    async createDirectories() {
        await fs_1.promises.mkdir(this.profilePhotosDir, { recursive: true });
        await fs_1.promises.mkdir(this.wallpaperDir, { recursive: true });
    }
    /**
     * Generate profile photo using OpenAI DALL-E
     */
    async generateProfilePhoto() {
        this.spinner.start(chalk_1.default.blue('🎨 Generating AI profile photo...'));
        try {
            const OpenAI = require('openai');
            const client = new OpenAI({
                apiKey: this.config.openaiApiKey,
            });
            // Generate professional headshot prompt
            const prompt = `Professional headshot portrait of a ${this.config.age} year old ${this.config.role} named ${this.config.fullName} based in ${this.config.location}. Professional business attire, friendly smile, modern office background, high quality photography, corporate style, LinkedIn profile photo style. Clean background, well-lit, professional appearance.`;
            // Generate image using DALL-E 3
            const response = await client.images.generate({
                model: 'dall-e-3',
                prompt,
                size: '1024x1024',
                quality: 'standard',
                n: 1,
            });
            const imageUrl = response.data[0].url;
            // Download and process image
            let fetch;
            let sharp;
            try {
                fetch = (await Promise.resolve().then(() => tslib_1.__importStar(require('node-fetch')))).default;
            }
            catch {
                throw new Error('node-fetch not available - required for profile photo generation');
            }
            try {
                sharp = (await Promise.resolve().then(() => tslib_1.__importStar(require('sharp')))).default;
            }
            catch {
                throw new Error('sharp not available - required for image processing');
            }
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.buffer();
            // Save in multiple sizes
            const originalPath = (0, path_1.join)(this.profilePhotosDir, 'profile_original.png');
            const slackPath = (0, path_1.join)(this.profilePhotosDir, 'profile_slack.png');
            const gmailPath = (0, path_1.join)(this.profilePhotosDir, 'profile_gmail.png');
            const avatarPath = (0, path_1.join)(this.profilePhotosDir, 'profile_avatar.png');
            // Original size
            await fs_1.promises.writeFile(originalPath, imageBuffer);
            // Resize for different platforms
            await sharp(imageBuffer).resize(512, 512).png().toFile(slackPath);
            await sharp(imageBuffer).resize(250, 250).png().toFile(gmailPath);
            await sharp(imageBuffer).resize(128, 128).png().toFile(avatarPath);
            this.spinner.succeed(chalk_1.default.green('📸 Profile photos generated successfully'));
            return {
                originalPath,
                slackPath,
                gmailPath,
                avatarPath,
            };
        }
        catch (error) {
            this.spinner.fail(chalk_1.default.red(`❌ Failed to generate profile photo: ${error}`));
            throw error;
        }
    }
    /**
     * Update Slack profile with photo and details
     */
    async updateSlackProfile(profilePhotos) {
        if (!this.config.slackUserToken) {
            this.spinner.warn(chalk_1.default.yellow('⚠️  Slack user token not provided, skipping Slack profile update'));
            return;
        }
        try {
            this.spinner.start(chalk_1.default.blue('💬 Updating Slack profile...'));
            const slackIntegration = new slack_integration_1.SlackIntegration(this.config.slackUserToken);
            await slackIntegration.updateProfile({
                realName: this.config.fullName,
                title: this.config.role,
                statusText: this.config.jobTitle || 'Building amazing software',
                statusEmoji: ':computer:',
                company: this.config.company,
                photoPath: profilePhotos?.slackPath,
            });
            this.spinner.succeed(chalk_1.default.green('💬 Slack profile updated successfully'));
        }
        catch (error) {
            this.spinner.warn(chalk_1.default.yellow(`⚠️  Failed to update Slack profile: ${error}`));
        }
    }
    /**
     * Update Gmail profile and signature
     */
    async updateGmailProfile() {
        try {
            this.spinner.start(chalk_1.default.blue('📧 Updating Gmail profile...'));
            const { GmailIntegrationService } = await Promise.resolve().then(() => tslib_1.__importStar(require('./gmail-integration')));
            const gmailIntegration = new GmailIntegrationService();
            await gmailIntegration.updateProfile({
                name: this.config.fullName,
                role: this.config.role,
                jobTitle: this.config.jobTitle || '',
                email: this.config.githubEmail,
            });
            this.spinner.succeed(chalk_1.default.green('📧 Gmail profile updated successfully'));
        }
        catch (error) {
            this.spinner.warn(chalk_1.default.yellow(`⚠️  Gmail profile update failed: ${error}`));
        }
    }
    /**
     * Personalize Mac settings if on macOS
     */
    async personalizeMac(profilePhotos) {
        if (process.platform !== 'darwin') {
            this.spinner.info(chalk_1.default.cyan('ℹ️  Skipping Mac personalization (not on macOS)'));
            return;
        }
        try {
            this.spinner.start(chalk_1.default.blue('🍎 Personalizing Mac settings...'));
            const macPersonalizer = new mac_personalizer_1.MacPersonalizer(this.config);
            // Set computer name
            await macPersonalizer.setComputerName();
            // Set user profile picture
            if (profilePhotos?.avatarPath) {
                await macPersonalizer.setUserPicture(profilePhotos.avatarPath);
            }
            // Create personalized wallpaper
            const wallpaperGenerator = new wallpaper_generator_1.WallpaperGenerator(this.config);
            const wallpaperPath = await wallpaperGenerator.createWallpaper(this.wallpaperDir);
            await macPersonalizer.setDesktopWallpaper(wallpaperPath);
            // Configure Dock
            await macPersonalizer.configureDock();
            // Set up hot corners
            await macPersonalizer.setupHotCorners();
            // Setup terminal profile
            await macPersonalizer.setupTerminalProfile();
            this.spinner.succeed(chalk_1.default.green('🍎 Mac personalization completed'));
        }
        catch (error) {
            this.spinner.warn(chalk_1.default.yellow(`⚠️  Mac personalization failed: ${error}`));
        }
    }
    /**
     * Create welcome script for the user
     */
    async createWelcomeScript() {
        try {
            this.spinner.start(chalk_1.default.blue('👋 Creating welcome script...'));
            const welcomeScript = `#!/bin/bash
echo ""
echo "👋 Welcome back, ${this.config.fullName}!"
echo "📍 Location: ${this.config.location}"
echo "💼 Role: ${this.config.role}"
echo ""
echo "Quick Commands:"
echo "  📂 cd ~/Development    - Go to your development directory"
echo "  🔧 wundr validate     - Check your setup"
echo "  💻 code .              - Open VS Code in current directory"
echo "  🐳 docker ps           - Check running containers"
echo ""
`;
            const welcomePath = (0, path_1.join)((0, os_1.homedir)(), '.welcome');
            await fs_1.promises.writeFile(welcomePath, welcomeScript, { mode: 0o755 });
            // Add to shell profiles
            const profiles = [
                (0, path_1.join)((0, os_1.homedir)(), '.zshrc'),
                (0, path_1.join)((0, os_1.homedir)(), '.bash_profile'),
            ];
            for (const profile of profiles) {
                try {
                    await fs_1.promises.access(profile);
                    const content = await fs_1.promises.readFile(profile, 'utf-8');
                    if (!content.includes('~/.welcome')) {
                        await fs_1.promises.appendFile(profile, `\n# Welcome script\n~/.welcome\n`);
                    }
                }
                catch (error) {
                    // Profile doesn't exist, skip
                }
            }
            this.spinner.succeed(chalk_1.default.green('👋 Welcome script created'));
        }
        catch (error) {
            this.spinner.warn(chalk_1.default.yellow(`⚠️  Failed to create welcome script: ${error}`));
        }
    }
    /**
     * Get profile configuration summary
     */
    getProfileSummary() {
        return {
            name: this.config.fullName,
            role: this.config.role,
            location: this.config.location,
            age: this.config.age,
            company: this.config.company,
            hasOpenAI: !!this.config.openaiApiKey,
            hasSlack: !!this.config.slackUserToken,
            platform: process.platform,
        };
    }
}
exports.ProfilePersonalizer = ProfilePersonalizer;
//# sourceMappingURL=profile-personalizer.js.map