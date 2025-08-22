"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WallpaperGenerator = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
let createCanvas, registerFont;
try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    registerFont = canvasModule.registerFont;
}
catch (e) {
    console.warn('Canvas not available - wallpaper generation disabled');
    createCanvas = () => ({ getContext: () => null, toBuffer: () => Buffer.alloc(0) });
    registerFont = () => { };
}
class WallpaperGenerator {
    config;
    defaultWallpaperConfig;
    constructor(config) {
        this.config = config;
        this.defaultWallpaperConfig = {
            width: 2880,
            height: 1800,
            primaryColor: '#1a1a1a',
            secondaryColor: '#2d2d2d',
            textColor: '#ffffff',
        };
    }
    /**
     * Create personalized wallpaper based on user profile
     */
    async createWallpaper(outputDir) {
        const wallpaperConfig = this.generatePersonalizedConfig();
        const canvas = createCanvas(wallpaperConfig.width, wallpaperConfig.height);
        const ctx = canvas.getContext('2d');
        // Create gradient background
        this.createGradientBackground(ctx, wallpaperConfig);
        // Add subtle pattern
        this.addSubtlePattern(ctx, wallpaperConfig);
        // Add personalized text
        await this.addPersonalizedText(ctx, wallpaperConfig);
        // Save wallpaper
        const wallpaperPath = (0, path_1.join)(outputDir, 'personalized_wallpaper.png');
        const buffer = canvas.toBuffer('image/png');
        await fs_1.promises.writeFile(wallpaperPath, buffer);
        return wallpaperPath;
    }
    /**
     * Generate personalized color scheme based on user name
     */
    generatePersonalizedConfig() {
        const nameHash = this.config.fullName
            .split('')
            .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = (nameHash % 360) / 360;
        // Convert HSV to RGB for gradient colors
        const primaryRgb = this.hsvToRgb(hue, 0.4, 0.3);
        const secondaryRgb = this.hsvToRgb(hue, 0.2, 0.6);
        return {
            ...this.defaultWallpaperConfig,
            primaryColor: `rgb(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b})`,
            secondaryColor: `rgb(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b})`,
        };
    }
    /**
     * Create gradient background
     */
    createGradientBackground(ctx, config) {
        const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
        gradient.addColorStop(0, config.primaryColor);
        gradient.addColorStop(1, config.secondaryColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, config.width, config.height);
    }
    /**
     * Add subtle circular pattern overlay
     */
    addSubtlePattern(ctx, config) {
        ctx.globalAlpha = 0.05;
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * config.width;
            const y = Math.random() * config.height;
            const radius = Math.random() * 150 + 50;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = config.textColor;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    /**
     * Add personalized welcome text
     */
    async addPersonalizedText(ctx, config) {
        ctx.fillStyle = config.textColor;
        ctx.textAlign = 'center';
        // Main welcome message
        const firstName = this.config.fullName.split(' ')[0];
        const welcomeText = `Welcome, ${firstName}!`;
        ctx.font = 'bold 120px Arial, sans-serif';
        const welcomeWidth = ctx.measureText(welcomeText).width;
        ctx.fillText(welcomeText, config.width / 2, config.height / 2 - 50);
        // Role subtitle
        ctx.globalAlpha = 0.8;
        ctx.font = '40px Arial, sans-serif';
        const roleText = this.config.role;
        ctx.fillText(roleText, config.width / 2, config.height / 2 + 50);
        // Location info
        if (this.config.location) {
            ctx.globalAlpha = 0.6;
            ctx.font = '30px Arial, sans-serif';
            const locationText = `📍 ${this.config.location}`;
            ctx.fillText(locationText, config.width / 2, config.height / 2 + 120);
        }
        ctx.globalAlpha = 1;
    }
    /**
     * Convert HSV to RGB color space
     */
    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
            case 1:
                r = q;
                g = v;
                b = p;
                break;
            case 2:
                r = p;
                g = v;
                b = t;
                break;
            case 3:
                r = p;
                g = q;
                b = v;
                break;
            case 4:
                r = t;
                g = p;
                b = v;
                break;
            case 5:
                r = v;
                g = p;
                b = q;
                break;
            default: r = g = b = 0;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    }
    /**
     * Create a minimalist coding-themed wallpaper
     */
    async createCodingWallpaper(outputDir) {
        const config = this.generatePersonalizedConfig();
        const canvas = createCanvas(config.width, config.height);
        const ctx = canvas.getContext('2d');
        // Dark background
        ctx.fillStyle = '#0f1419';
        ctx.fillRect(0, 0, config.width, config.height);
        // Add code-like pattern
        this.addCodePattern(ctx, config);
        // Add terminal-style welcome
        await this.addTerminalText(ctx, config);
        const wallpaperPath = (0, path_1.join)(outputDir, 'coding_wallpaper.png');
        const buffer = canvas.toBuffer('image/png');
        await fs_1.promises.writeFile(wallpaperPath, buffer);
        return wallpaperPath;
    }
    /**
     * Add code-like visual pattern
     */
    addCodePattern(ctx, config) {
        const codeSnippets = [
            'const welcome = () => {',
            '  return `Hello, ${name}!`;',
            '};',
            '',
            'export class Developer {',
            '  constructor(name) {',
            '    this.name = name;',
            '    this.awesome = true;',
            '  }',
            '}',
        ];
        ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
        ctx.font = '16px Monaco, monospace';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * (config.width - 400);
            const y = Math.random() * (config.height - 200);
            codeSnippets.forEach((line, index) => {
                ctx.fillText(line, x, y + (index * 20));
            });
        }
    }
    /**
     * Add terminal-style welcome text
     */
    async addTerminalText(ctx, config) {
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 48px Monaco, monospace';
        ctx.textAlign = 'center';
        const terminalText = `$ whoami`;
        ctx.fillText(terminalText, config.width / 2, config.height / 2 - 100);
        ctx.fillStyle = '#ffffff';
        ctx.font = '36px Monaco, monospace';
        const nameText = this.config.fullName.toLowerCase().replace(' ', '_');
        ctx.fillText(nameText, config.width / 2, config.height / 2 - 40);
        ctx.fillStyle = '#00ff00';
        ctx.font = '24px Monaco, monospace';
        const roleText = `# ${this.config.role}`;
        ctx.fillText(roleText, config.width / 2, config.height / 2 + 20);
        ctx.fillStyle = '#ffff00';
        const promptText = '$ █';
        ctx.fillText(promptText, config.width / 2, config.height / 2 + 80);
    }
}
exports.WallpaperGenerator = WallpaperGenerator;
//# sourceMappingURL=wallpaper-generator.js.map