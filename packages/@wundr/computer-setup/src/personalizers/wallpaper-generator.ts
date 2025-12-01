import { promises as fs } from 'fs';
import { join } from 'path';

import type { ProfileConfig } from './profile-personalizer';

// Canvas types - using node-canvas interface
interface CanvasContext {
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): CanvasGradient;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetrics;
  fillStyle: string | CanvasGradient;
  globalAlpha: number;
  textAlign: CanvasTextAlign;
  font: string;
}

interface Canvas {
  getContext(contextId: '2d'): CanvasContext | null;
  toBuffer(mimeType: string): Buffer;
}

type CreateCanvasFn = (width: number, height: number) => Canvas;
type RegisterFontFn = (path: string, options: { family: string }) => void;

let createCanvas: CreateCanvasFn;
let _registerFont: RegisterFontFn;

const initCanvas = async (): Promise<void> => {
  try {
    const canvasModule = await import('canvas');
    // Cast to unknown first then to CreateCanvasFn to handle canvas module type differences
    createCanvas = canvasModule.createCanvas as unknown as CreateCanvasFn;
    _registerFont = canvasModule.registerFont as RegisterFontFn;
  } catch (_e) {
    console.warn('Canvas not available - wallpaper generation disabled');
    createCanvas = (): Canvas => ({
      getContext: (): CanvasContext | null => null,
      toBuffer: (): Buffer => Buffer.alloc(0),
    });
    _registerFont = (): void => {};
  }
};

// Initialize canvas on module load
const canvasReady = initCanvas();

export interface WallpaperConfig {
  width: number;
  height: number;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
}

export class WallpaperGenerator {
  private config: ProfileConfig;
  private defaultWallpaperConfig: WallpaperConfig;

  constructor(config: ProfileConfig) {
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
  async createWallpaper(outputDir: string): Promise<string> {
    await canvasReady;
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
    const wallpaperPath = join(outputDir, 'personalized_wallpaper.png');
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(wallpaperPath, buffer);

    return wallpaperPath;
  }

  /**
   * Generate personalized color scheme based on user name
   */
  private generatePersonalizedConfig(): WallpaperConfig {
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
  private createGradientBackground(
    ctx: CanvasContext | null,
    config: WallpaperConfig
  ): void {
    if (!ctx) {
      return;
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
    gradient.addColorStop(0, config.primaryColor);
    gradient.addColorStop(1, config.secondaryColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.width, config.height);
  }

  /**
   * Add subtle circular pattern overlay
   */
  private addSubtlePattern(
    ctx: CanvasContext | null,
    config: WallpaperConfig
  ): void {
    if (!ctx) {
      return;
    }
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
  private async addPersonalizedText(
    ctx: CanvasContext | null,
    config: WallpaperConfig
  ): Promise<void> {
    if (!ctx) {
      return;
    }
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';

    // Main welcome message
    const firstName = this.config.fullName.split(' ')[0];
    const welcomeText = `Welcome, ${firstName}!`;

    ctx.font = 'bold 120px Arial, sans-serif';
    const _welcomeWidth = ctx.measureText(welcomeText).width;
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
  private hsvToRgb(
    h: number,
    s: number,
    v: number
  ): { r: number; g: number; b: number } {
    let r: number, g: number, b: number;

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
      default:
        r = g = b = 0;
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
  async createCodingWallpaper(outputDir: string): Promise<string> {
    await canvasReady;
    const config = this.generatePersonalizedConfig();
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Dark background
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, config.width, config.height);

    // Add code-like pattern
    this.addCodePattern(ctx, config);

    // Add terminal-style welcome
    await this.addTerminalText(ctx, config);

    const wallpaperPath = join(outputDir, 'coding_wallpaper.png');
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(wallpaperPath, buffer);

    return wallpaperPath;
  }

  /**
   * Add code-like visual pattern
   */
  private addCodePattern(ctx: CanvasContext, config: WallpaperConfig): void {
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
        ctx.fillText(line, x, y + index * 20);
      });
    }
  }

  /**
   * Add terminal-style welcome text
   */
  private async addTerminalText(
    ctx: CanvasContext,
    config: WallpaperConfig
  ): Promise<void> {
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 48px Monaco, monospace';
    ctx.textAlign = 'center';

    const terminalText = '$ whoami';
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
