import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execa } from 'execa';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { WallpaperGenerator } from './wallpaper-generator';
import { SlackIntegration } from './slack-integration';
import { GmailIntegrationService } from './gmail-integration';
import { MacPersonalizer } from './mac-personalizer';

export interface ProfileConfig {
  fullName: string;
  role: string;
  jobTitle?: string;
  company?: string;
  githubUsername: string;
  githubEmail: string;
  location?: string;
  age?: number;
  openaiApiKey?: string;
  slackUserToken?: string;
}

export interface ProfilePhoto {
  originalPath: string;
  slackPath: string;
  gmailPath: string;
  avatarPath: string;
}

export class ProfilePersonalizer {
  private config: ProfileConfig;
  private spinner: Ora;
  private profilePhotosDir: string;
  private wallpaperDir: string;

  constructor(config: ProfileConfig) {
    this.config = config;
    this.spinner = ora();
    this.profilePhotosDir = join(homedir(), '.profile_photos');
    this.wallpaperDir = join(homedir(), '.wallpapers');
  }

  /**
   * Main orchestration method to personalize the entire profile
   */
  async personalize(): Promise<void> {
    this.spinner.start(chalk.blue('🎨 Starting profile personalization...'));
    
    try {
      // Generate random profile data if not provided
      this.generateRandomProfileData();
      
      // Create necessary directories
      await this.createDirectories();
      
      // Generate profile photo if OpenAI API key is available
      let profilePhotos: ProfilePhoto | undefined;
      if (this.config.openaiApiKey) {
        profilePhotos = await this.generateProfilePhoto();
      } else {
        this.spinner.warn(chalk.yellow('⚠️  OpenAI API key not provided, skipping profile photo generation'));
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
      
      this.spinner.succeed(chalk.green('✅ Profile personalization completed successfully!'));
      
    } catch (error) {
      this.spinner.fail(chalk.red(`❌ Profile personalization failed: ${error}`));
      throw error;
    }
  }

  /**
   * Generate random profile data for missing fields
   */
  private generateRandomProfileData(): void {
    if (!this.config.age) {
      this.config.age = 22 + Math.floor(Math.random() * 34);
    }
    
    if (!this.config.location) {
      const locations = ['San Francisco', 'New York', 'London', 'Sydney', 'Singapore'];
      this.config.location = locations[Math.floor(Math.random() * locations.length)];
    }
    
    this.spinner.info(chalk.cyan(`📊 Generated profile: Age ${this.config.age}, Location: ${this.config.location}`));
  }

  /**
   * Create necessary directories for profile assets
   */
  private async createDirectories(): Promise<void> {
    await fs.mkdir(this.profilePhotosDir, { recursive: true });
    await fs.mkdir(this.wallpaperDir, { recursive: true });
  }

  /**
   * Generate profile photo using OpenAI DALL-E
   */
  private async generateProfilePhoto(): Promise<ProfilePhoto> {
    this.spinner.start(chalk.blue('🎨 Generating AI profile photo...'));
    
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
      let fetch: any;
      let sharp: any;
      
      try {
        fetch = (await import('node-fetch')).default;
      } catch {
        throw new Error('node-fetch not available - required for profile photo generation');
      }
      
      try {
        sharp = (await import('sharp')).default;
      } catch {
        throw new Error('sharp not available - required for image processing');
      }
      
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      
      // Save in multiple sizes
      const originalPath = join(this.profilePhotosDir, 'profile_original.png');
      const slackPath = join(this.profilePhotosDir, 'profile_slack.png');
      const gmailPath = join(this.profilePhotosDir, 'profile_gmail.png');
      const avatarPath = join(this.profilePhotosDir, 'profile_avatar.png');
      
      // Original size
      await fs.writeFile(originalPath, imageBuffer);
      
      // Resize for different platforms
      await sharp(imageBuffer).resize(512, 512).png().toFile(slackPath);
      await sharp(imageBuffer).resize(250, 250).png().toFile(gmailPath);
      await sharp(imageBuffer).resize(128, 128).png().toFile(avatarPath);
      
      this.spinner.succeed(chalk.green('📸 Profile photos generated successfully'));
      
      return {
        originalPath,
        slackPath,
        gmailPath,
        avatarPath,
      };
      
    } catch (error) {
      this.spinner.fail(chalk.red(`❌ Failed to generate profile photo: ${error}`));
      throw error;
    }
  }

  /**
   * Update Slack profile with photo and details
   */
  private async updateSlackProfile(profilePhotos?: ProfilePhoto): Promise<void> {
    if (!this.config.slackUserToken) {
      this.spinner.warn(chalk.yellow('⚠️  Slack user token not provided, skipping Slack profile update'));
      return;
    }

    try {
      this.spinner.start(chalk.blue('💬 Updating Slack profile...'));
      
      const slackIntegration = new SlackIntegration(this.config.slackUserToken);
      await slackIntegration.updateProfile({
        realName: this.config.fullName,
        title: this.config.role,
        statusText: this.config.jobTitle || 'Building amazing software',
        statusEmoji: ':computer:',
        company: this.config.company,
        photoPath: profilePhotos?.slackPath,
      });
      
      this.spinner.succeed(chalk.green('💬 Slack profile updated successfully'));
      
    } catch (error) {
      this.spinner.warn(chalk.yellow(`⚠️  Failed to update Slack profile: ${error}`));
    }
  }

  /**
   * Update Gmail profile and signature
   */
  private async updateGmailProfile(): Promise<void> {
    try {
      this.spinner.start(chalk.blue('📧 Updating Gmail profile...'));
      
      const { GmailIntegrationService } = await import('./gmail-integration');
      const gmailIntegration = new GmailIntegrationService();
      await gmailIntegration.updateProfile({
        name: this.config.fullName,
        role: this.config.role,
        jobTitle: this.config.jobTitle || '',
        email: this.config.githubEmail,
      });
      
      this.spinner.succeed(chalk.green('📧 Gmail profile updated successfully'));
      
    } catch (error) {
      this.spinner.warn(chalk.yellow(`⚠️  Gmail profile update failed: ${error}`));
    }
  }

  /**
   * Personalize Mac settings if on macOS
   */
  private async personalizeMac(profilePhotos?: ProfilePhoto): Promise<void> {
    if (process.platform !== 'darwin') {
      this.spinner.info(chalk.cyan('ℹ️  Skipping Mac personalization (not on macOS)'));
      return;
    }

    try {
      this.spinner.start(chalk.blue('🍎 Personalizing Mac settings...'));
      
      const macPersonalizer = new MacPersonalizer(this.config);
      
      // Set computer name
      await macPersonalizer.setComputerName();
      
      // Set user profile picture
      if (profilePhotos?.avatarPath) {
        await macPersonalizer.setUserPicture(profilePhotos.avatarPath);
      }
      
      // Create personalized wallpaper
      const wallpaperGenerator = new WallpaperGenerator(this.config);
      const wallpaperPath = await wallpaperGenerator.createWallpaper(this.wallpaperDir);
      await macPersonalizer.setDesktopWallpaper(wallpaperPath);
      
      // Configure Dock
      await macPersonalizer.configureDock();
      
      // Set up hot corners
      await macPersonalizer.setupHotCorners();
      
      // Setup terminal profile
      await macPersonalizer.setupTerminalProfile();
      
      this.spinner.succeed(chalk.green('🍎 Mac personalization completed'));
      
    } catch (error) {
      this.spinner.warn(chalk.yellow(`⚠️  Mac personalization failed: ${error}`));
    }
  }

  /**
   * Create welcome script for the user
   */
  private async createWelcomeScript(): Promise<void> {
    try {
      this.spinner.start(chalk.blue('👋 Creating welcome script...'));
      
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
      
      const welcomePath = join(homedir(), '.welcome');
      await fs.writeFile(welcomePath, welcomeScript, { mode: 0o755 });
      
      // Add to shell profiles
      const profiles = [
        join(homedir(), '.zshrc'),
        join(homedir(), '.bash_profile'),
      ];
      
      for (const profile of profiles) {
        try {
          await fs.access(profile);
          const content = await fs.readFile(profile, 'utf-8');
          if (!content.includes('~/.welcome')) {
            await fs.appendFile(profile, `\n# Welcome script\n~/.welcome\n`);
          }
        } catch (error) {
          // Profile doesn't exist, skip
        }
      }
      
      this.spinner.succeed(chalk.green('👋 Welcome script created'));
      
    } catch (error) {
      this.spinner.warn(chalk.yellow(`⚠️  Failed to create welcome script: ${error}`));
    }
  }

  /**
   * Get profile configuration summary
   */
  getProfileSummary(): object {
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