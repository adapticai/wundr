/**
 * Platform Detection Utility
 * Detects Railway and Netlify deployment platforms from config files and environment
 *
 * @module platform-detection
 */

import * as fs from 'fs';
import * as path from 'path';

import { Logger } from '../utils/logger';

const logger = new Logger({ name: 'platform-detection' });

export type DetectedPlatform = 'railway' | 'netlify';

export interface PlatformDetectionResult {
  platform: DetectedPlatform;
  source: 'config_file' | 'environment';
  confidence: 'high' | 'medium' | 'low';
  configPath?: string;
  envVars?: string[];
}

export interface DetectionSummary {
  platforms: PlatformDetectionResult[];
  primary: DetectedPlatform | null;
  hasRailway: boolean;
  hasNetlify: boolean;
}

/**
 * Detect Railway platform from config file
 */
function detectRailwayFromConfig(
  projectPath: string
): PlatformDetectionResult | null {
  const railwayJsonPath = path.join(projectPath, 'railway.json');
  const railwayTomlPath = path.join(projectPath, 'railway.toml');

  if (fs.existsSync(railwayJsonPath)) {
    return {
      platform: 'railway',
      source: 'config_file',
      confidence: 'high',
      configPath: railwayJsonPath,
    };
  }

  if (fs.existsSync(railwayTomlPath)) {
    return {
      platform: 'railway',
      source: 'config_file',
      confidence: 'high',
      configPath: railwayTomlPath,
    };
  }

  return null;
}

/**
 * Detect Railway platform from environment variables
 */
function detectRailwayFromEnv(): PlatformDetectionResult | null {
  const envVars: string[] = [];

  if (process.env.RAILWAY_PROJECT_ID) {
    envVars.push('RAILWAY_PROJECT_ID');
  }
  if (process.env.RAILWAY_API_TOKEN) {
    envVars.push('RAILWAY_API_TOKEN');
  }
  if (process.env.RAILWAY_ENVIRONMENT_ID) {
    envVars.push('RAILWAY_ENVIRONMENT_ID');
  }

  if (envVars.length > 0) {
    return {
      platform: 'railway',
      source: 'environment',
      confidence: envVars.length >= 2 ? 'high' : 'medium',
      envVars,
    };
  }

  return null;
}

/**
 * Detect Netlify platform from config file
 */
function detectNetlifyFromConfig(
  projectPath: string
): PlatformDetectionResult | null {
  const netlifyTomlPath = path.join(projectPath, 'netlify.toml');
  const netlifyJsonPath = path.join(projectPath, '.netlify/state.json');

  if (fs.existsSync(netlifyTomlPath)) {
    return {
      platform: 'netlify',
      source: 'config_file',
      confidence: 'high',
      configPath: netlifyTomlPath,
    };
  }

  if (fs.existsSync(netlifyJsonPath)) {
    return {
      platform: 'netlify',
      source: 'config_file',
      confidence: 'high',
      configPath: netlifyJsonPath,
    };
  }

  return null;
}

/**
 * Detect Netlify platform from environment variables
 */
function detectNetlifyFromEnv(): PlatformDetectionResult | null {
  const envVars: string[] = [];

  if (process.env.NETLIFY_SITE_ID) {
    envVars.push('NETLIFY_SITE_ID');
  }
  if (process.env.NETLIFY_ACCESS_TOKEN || process.env.NETLIFY_AUTH_TOKEN) {
    envVars.push(
      process.env.NETLIFY_ACCESS_TOKEN
        ? 'NETLIFY_ACCESS_TOKEN'
        : 'NETLIFY_AUTH_TOKEN'
    );
  }
  if (process.env.NETLIFY) {
    envVars.push('NETLIFY');
  }

  if (envVars.length > 0) {
    return {
      platform: 'netlify',
      source: 'environment',
      confidence: envVars.length >= 2 ? 'high' : 'medium',
      envVars,
    };
  }

  return null;
}

/**
 * Main detection function - detects all deployment platforms
 */
export function detectPlatforms(
  projectPath: string = process.cwd()
): DetectionSummary {
  const platforms: PlatformDetectionResult[] = [];

  // Check Railway
  const railwayConfig = detectRailwayFromConfig(projectPath);
  const railwayEnv = detectRailwayFromEnv();

  if (railwayConfig) {
    platforms.push(railwayConfig);
  } else if (railwayEnv) {
    platforms.push(railwayEnv);
  }

  // Check Netlify
  const netlifyConfig = detectNetlifyFromConfig(projectPath);
  const netlifyEnv = detectNetlifyFromEnv();

  if (netlifyConfig) {
    platforms.push(netlifyConfig);
  } else if (netlifyEnv) {
    platforms.push(netlifyEnv);
  }

  // Determine primary platform (prefer config file over env)
  const configPlatform = platforms.find(p => p.source === 'config_file');
  const primary = configPlatform?.platform || platforms[0]?.platform || null;

  return {
    platforms,
    primary,
    hasRailway: platforms.some(p => p.platform === 'railway'),
    hasNetlify: platforms.some(p => p.platform === 'netlify'),
  };
}

/**
 * Quick check if any deployment platform is detected
 */
export function hasDeploymentPlatform(
  projectPath: string = process.cwd()
): boolean {
  const { platforms } = detectPlatforms(projectPath);
  return platforms.length > 0;
}

/**
 * Get the primary deployment platform
 */
export function getPrimaryPlatform(
  projectPath: string = process.cwd()
): DetectedPlatform | null {
  const { primary } = detectPlatforms(projectPath);
  return primary;
}

/**
 * Get platform-specific configuration
 */
export function getPlatformConfig(platform: DetectedPlatform): {
  projectId?: string;
  siteId?: string;
  apiToken?: string;
} {
  if (platform === 'railway') {
    return {
      projectId: process.env.RAILWAY_PROJECT_ID,
      apiToken: process.env.RAILWAY_API_TOKEN,
    };
  }

  if (platform === 'netlify') {
    return {
      siteId: process.env.NETLIFY_SITE_ID,
      apiToken:
        process.env.NETLIFY_ACCESS_TOKEN || process.env.NETLIFY_AUTH_TOKEN,
    };
  }

  return {};
}

/**
 * Validate platform configuration
 */
export function validatePlatformConfig(platform: DetectedPlatform): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (platform === 'railway') {
    if (!process.env.RAILWAY_PROJECT_ID) {
      missing.push('RAILWAY_PROJECT_ID');
    }
    if (!process.env.RAILWAY_API_TOKEN) {
      warnings.push('RAILWAY_API_TOKEN not set - some features may be limited');
    }
  }

  if (platform === 'netlify') {
    if (!process.env.NETLIFY_SITE_ID) {
      missing.push('NETLIFY_SITE_ID');
    }
    if (!process.env.NETLIFY_ACCESS_TOKEN && !process.env.NETLIFY_AUTH_TOKEN) {
      warnings.push(
        'NETLIFY_ACCESS_TOKEN not set - some features may be limited'
      );
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Print detection summary to logger
 */
export function printDetectionSummary(
  projectPath: string = process.cwd()
): void {
  const summary = detectPlatforms(projectPath);

  logger.info('[Platform Detection] Deployment Platform Detection');
  logger.info('================================');

  if (summary.platforms.length === 0) {
    logger.info('[X] No deployment platforms detected');
    logger.info('To enable deployment monitoring, configure one of:');
    logger.info('  - Railway: Add railway.json or set RAILWAY_PROJECT_ID');
    logger.info('  - Netlify: Add netlify.toml or set NETLIFY_SITE_ID');
    return;
  }

  for (const platform of summary.platforms) {
    const label = platform.platform === 'railway' ? '[Railway]' : '[Netlify]';
    logger.info(`${label} ${platform.platform.toUpperCase()}`);
    logger.info(`   Source: ${platform.source}`);
    logger.info(`   Confidence: ${platform.confidence}`);
    if (platform.configPath) {
      logger.info(`   Config: ${platform.configPath}`);
    }
    if (platform.envVars) {
      logger.info(`   Env vars: ${platform.envVars.join(', ')}`);
    }
  }

  if (summary.primary) {
    logger.info(`Primary platform: ${summary.primary}`);
  }
}
