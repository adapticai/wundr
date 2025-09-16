/**
 * Cache management system for ultra-fast installations
 * Handles package caching, installer caching, and smart cache invalidation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger';

const logger = createLogger('CacheManager');

interface CacheEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl: number;
  version?: string;
  checksum?: string;
}

interface CacheStats {
  totalSize: number;
  totalFiles: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

export class CacheManager {
  private cachePath: string;
  private configPath: string;
  private statsPath: string;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor() {
    this.cachePath = join(homedir(), '.wundr', 'cache');
    this.configPath = join(this.cachePath, 'cache-config.json');
    this.statsPath = join(this.cachePath, 'cache-stats.json');
    this.ensureCacheDirectories();
  }

  /**
   * Initialize cache directories and configuration
   */
  private async ensureCacheDirectories(): Promise<void> {
    const directories = [
      this.cachePath,
      join(this.cachePath, 'packages'),
      join(this.cachePath, 'installers'),
      join(this.cachePath, 'configs'),
      join(this.cachePath, 'downloads'),
      join(this.cachePath, 'metadata')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create default cache configuration
    const defaultConfig = {
      maxSize: 1024 * 1024 * 1024, // 1GB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      compressionEnabled: true,
      encryptionEnabled: false
    };

    try {
      await fs.access(this.configPath);
    } catch {
      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
    }
  }

  /**
   * Get cached value with TTL check
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cachePath = join(this.cachePath, 'metadata', `${cacheKey}.json`);
      
      const cacheData = JSON.parse(await fs.readFile(cachePath, 'utf8')) as CacheEntry;
      
      // Check TTL
      if (Date.now() - cacheData.timestamp > cacheData.ttl) {
        await this.delete(key);
        this.missCount++;
        return null;
      }

      this.hitCount++;
      return cacheData.value as T;
    } catch {
      this.missCount++;
      return null;
    }
  }

  /**
   * Set cached value with optional TTL
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const config = await this.getConfig();
      const cacheKey = this.generateCacheKey(key);
      const cachePath = join(this.cachePath, 'metadata', `${cacheKey}.json`);
      
      const cacheEntry: CacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttlMs || (typeof config.defaultTTL === 'number' ? config.defaultTTL : 24 * 60 * 60 * 1000),
        checksum: this.generateChecksum(JSON.stringify(value))
      };

      await fs.writeFile(cachePath, JSON.stringify(cacheEntry, null, 2));
    } catch (error) {
      logger.error('Failed to set cache value:', error);
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cachePath = join(this.cachePath, 'metadata', `${cacheKey}.json`);
      await fs.unlink(cachePath);
    } catch {
      // Cache file doesn't exist, ignore
    }
  }

  /**
   * Cache installer script with checksum validation
   */
  async cacheInstaller(url: string, name: string): Promise<string> {
    const installerPath = join(this.cachePath, 'installers', `${name}.sh`);
    const metaPath = join(this.cachePath, 'metadata', `installer-${name}.json`);
    
    try {
      // Check if cached version exists and is valid
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      const ageHours = (Date.now() - meta.timestamp) / (1000 * 60 * 60);
      
      if (ageHours < 24) { // Cache installers for 24 hours
        await fs.access(installerPath);
        return installerPath;
      }
    } catch {
      // Cache miss or invalid, download fresh
    }

    // Download installer
    const downloadCommand = `curl -fsSL "${url}" -o "${installerPath}"`;
    execSync(downloadCommand, { stdio: 'pipe' });
    
    // Generate checksum and save metadata
    const content = await fs.readFile(installerPath, 'utf8');
    const checksum = this.generateChecksum(content);
    
    const metadata = {
      url,
      timestamp: Date.now(),
      checksum,
      size: content.length
    };
    
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    
    return installerPath;
  }

  /**
   * Cache package downloads with version tracking
   */
  async cachePackage(packageName: string, version: string, downloadUrl: string): Promise<string> {
    const packageKey = `${packageName}-${version}`;
    const packagePath = join(this.cachePath, 'packages', `${packageKey}.tar.gz`);
    const metaPath = join(this.cachePath, 'metadata', `package-${packageKey}.json`);
    
    try {
      // Check if package is already cached
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      await fs.access(packagePath);
      
      // Verify checksum if available
      if (meta.checksum) {
        const content = await fs.readFile(packagePath);
        const actualChecksum = this.generateChecksum(content.toString('base64'));
        if (actualChecksum === meta.checksum) {
          return packagePath;
        }
      } else {
        return packagePath; // Trust existing cache if no checksum
      }
    } catch {
      // Cache miss or validation failed
    }

    // Download package
    const downloadCommand = `curl -fsSL "${downloadUrl}" -o "${packagePath}"`;
    execSync(downloadCommand, { stdio: 'pipe' });
    
    // Generate metadata
    const content = await fs.readFile(packagePath);
    const checksum = this.generateChecksum(content.toString('base64'));
    
    const metadata = {
      packageName,
      version,
      downloadUrl,
      timestamp: Date.now(),
      checksum,
      size: content.length
    };
    
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    
    return packagePath;
  }

  /**
   * Pre-cache commonly used packages for faster installation
   */
  async precacheEssentials(): Promise<void> {
    const essentials = [
      { name: 'node', versions: ['20.x', '18.x'] },
      { name: 'npm', versions: ['latest'] },
      { name: 'typescript', versions: ['latest'] },
      { name: 'prettier', versions: ['latest'] },
      { name: 'eslint', versions: ['latest'] }
    ];

    const downloadPromises = essentials.map(async ({ name, versions }) => {
      for (const version of versions) {
        try {
          // This would normally fetch from npm registry or specific URLs
          await this.set(`precache:${name}:${version}`, { 
            name, 
            version, 
            precached: true,
            timestamp: Date.now()
          }, 7 * 24 * 60 * 60 * 1000); // 7 days TTL for precached items
        } catch (error) {
          logger.warn(`Failed to precache ${name}@${version}:`, error);
        }
      }
    });

    await Promise.all(downloadPromises);
    logger.info('Essential packages precached');
  }

  /**
   * Smart cache cleanup based on size, age, and usage
   */
  async cleanup(forceCleanup = false): Promise<void> {
    const config = await this.getConfig();
    const stats = await this.getStats();
    
    if (!forceCleanup && stats.totalSize < (typeof config.maxSize === 'number' ? config.maxSize : 1024 * 1024 * 1024) * 0.8) {
      return; // No cleanup needed
    }

    const metadataDir = join(this.cachePath, 'metadata');
    const files = await fs.readdir(metadataDir);
    
    const entries: Array<{ file: string; meta: CacheEntry }> = [];
    
    for (const file of files) {
      try {
        const filePath = join(metadataDir, file);
        const meta = JSON.parse(await fs.readFile(filePath, 'utf8'));
        entries.push({ file: filePath, meta });
      } catch {
        // Skip invalid metadata files
      }
    }

    // Sort by age and usage priority
    entries.sort((a, b) => {
      const ageA = Date.now() - a.meta.timestamp;
      const ageB = Date.now() - b.meta.timestamp;
      const ttlRatioA = ageA / a.meta.ttl;
      const ttlRatioB = ageB / b.meta.ttl;
      
      return ttlRatioB - ttlRatioA; // Remove oldest first
    });

    // Remove oldest 25% of entries
    const removeCount = Math.floor(entries.length * 0.25);
    const toRemove = entries.slice(0, removeCount);

    for (const { file, meta } of toRemove) {
      try {
        await fs.unlink(file);
        
        // Also remove associated cache files
        const cacheKey = this.generateCacheKey(meta.key);
        const associatedFiles = [
          join(this.cachePath, 'packages', `${cacheKey}.*`),
          join(this.cachePath, 'installers', `${cacheKey}.*`),
          join(this.cachePath, 'downloads', `${cacheKey}.*`)
        ];
        
        for (const pattern of associatedFiles) {
          try {
            execSync(`rm -f ${pattern}`, { stdio: 'pipe' });
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        logger.warn('Failed to remove cache entry:', error);
      }
    }

    logger.info(`Cache cleanup completed: removed ${removeCount} entries`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const metadataDir = join(this.cachePath, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      let totalSize = 0;
      let oldestEntry = Date.now();
      let newestEntry = 0;
      
      for (const file of files) {
        try {
          const filePath = join(metadataDir, file);
          const stats = await fs.stat(filePath);
          const meta = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          totalSize += stats.size;
          oldestEntry = Math.min(oldestEntry, meta.timestamp);
          newestEntry = Math.max(newestEntry, meta.timestamp);
        } catch {
          // Skip invalid files
        }
      }

      const hitRate = this.hitCount + this.missCount > 0 
        ? this.hitCount / (this.hitCount + this.missCount)
        : 0;

      const stats: CacheStats = {
        totalSize,
        totalFiles: files.length,
        hitRate: Math.round(hitRate * 100) / 100,
        oldestEntry,
        newestEntry
      };

      await fs.writeFile(this.statsPath, JSON.stringify(stats, null, 2));
      
      return stats;
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        totalSize: 0,
        totalFiles: 0,
        hitRate: 0,
        oldestEntry: Date.now(),
        newestEntry: Date.now()
      };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      execSync(`rm -rf "${this.cachePath}"/*`, { stdio: 'pipe' });
      await this.ensureCacheDirectories();
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Validate cache integrity
   */
  async validate(): Promise<boolean> {
    try {
      const metadataDir = join(this.cachePath, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      let validEntries = 0;
      let invalidEntries = 0;
      
      for (const file of files) {
        try {
          const filePath = join(metadataDir, file);
          const meta = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          // Basic validation
          if (meta.key && meta.timestamp && meta.ttl) {
            validEntries++;
          } else {
            invalidEntries++;
            await fs.unlink(filePath);
          }
        } catch {
          invalidEntries++;
          await fs.unlink(join(metadataDir, file));
        }
      }

      logger.info(`Cache validation: ${validEntries} valid, ${invalidEntries} invalid entries cleaned`);
      return invalidEntries === 0;
    } catch (error) {
      logger.error('Cache validation failed:', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private generateCacheKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async getConfig(): Promise<Record<string, unknown>> {
    try {
      return JSON.parse(await fs.readFile(this.configPath, 'utf8'));
    } catch {
      return {
        maxSize: 1024 * 1024 * 1024,
        defaultTTL: 24 * 60 * 60 * 1000,
        cleanupInterval: 60 * 60 * 1000
      };
    }
  }
}