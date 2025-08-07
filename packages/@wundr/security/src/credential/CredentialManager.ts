import * as keytar from 'node-keytar';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CredentialOptions {
  service: string;
  account: string;
  password: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  rotationInterval?: number; // in milliseconds
}

export interface EncryptedCredential {
  id: string;
  service: string;
  account: string;
  encryptedPassword: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationInterval?: number;
  lastRotated?: Date;
}

export class CredentialManager extends EventEmitter {
  private readonly serviceName: string = '@wundr/security';
  private readonly encryptionKey: string;
  private readonly credentialStore: Map<string, EncryptedCredential> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(masterKey?: string) {
    super();
    this.encryptionKey = masterKey || this.generateMasterKey();
    this.setupEventHandlers();
  }

  private generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private setupEventHandlers(): void {
    this.on('credential:stored', (credentialId) => {
      logger.info(`Credential stored: ${credentialId}`);
    });

    this.on('credential:retrieved', (credentialId) => {
      logger.info(`Credential retrieved: ${credentialId}`);
    });

    this.on('credential:rotated', (credentialId) => {
      logger.info(`Credential rotated: ${credentialId}`);
    });

    this.on('credential:expired', (credentialId) => {
      logger.warn(`Credential expired: ${credentialId}`);
    });
  }

  /**
   * Store encrypted credential in OS keychain
   */
  async storeCredential(options: CredentialOptions): Promise<string> {
    try {
      const credentialId = this.generateCredentialId(options.service, options.account);
      
      // Encrypt the password
      const encryptedPassword = this.encryptPassword(options.password);
      
      // Create credential object
      const credential: EncryptedCredential = {
        id: credentialId,
        service: options.service,
        account: options.account,
        encryptedPassword,
        metadata: options.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: options.expiresAt,
        rotationInterval: options.rotationInterval,
      };

      // Store in OS keychain
      await keytar.setPassword(
        this.serviceName,
        credentialId,
        JSON.stringify(credential)
      );

      // Store in memory cache
      this.credentialStore.set(credentialId, credential);

      // Setup rotation if specified
      if (options.rotationInterval) {
        this.setupRotation(credentialId, options.rotationInterval);
      }

      this.emit('credential:stored', credentialId);
      return credentialId;

    } catch (error) {
      logger.error('Failed to store credential:', error);
      throw new Error(`Failed to store credential: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt credential from OS keychain
   */
  async retrieveCredential(credentialId: string): Promise<CredentialOptions | null> {
    try {
      // Try memory cache first
      let credential = this.credentialStore.get(credentialId);
      
      if (!credential) {
        // Retrieve from OS keychain
        const storedCredential = await keytar.getPassword(this.serviceName, credentialId);
        if (!storedCredential) {
          return null;
        }
        
        credential = JSON.parse(storedCredential);
        this.credentialStore.set(credentialId, credential);
      }

      // Check expiration
      if (credential.expiresAt && new Date() > credential.expiresAt) {
        this.emit('credential:expired', credentialId);
        await this.deleteCredential(credentialId);
        return null;
      }

      // Decrypt password
      const decryptedPassword = this.decryptPassword(credential.encryptedPassword);

      this.emit('credential:retrieved', credentialId);
      
      return {
        service: credential.service,
        account: credential.account,
        password: decryptedPassword,
        metadata: credential.metadata,
        expiresAt: credential.expiresAt,
        rotationInterval: credential.rotationInterval,
      };

    } catch (error) {
      logger.error('Failed to retrieve credential:', error);
      return null;
    }
  }

  /**
   * Update existing credential
   */
  async updateCredential(credentialId: string, updates: Partial<CredentialOptions>): Promise<void> {
    try {
      const existingCredential = this.credentialStore.get(credentialId);
      if (!existingCredential) {
        throw new Error('Credential not found');
      }

      const updatedCredential: EncryptedCredential = {
        ...existingCredential,
        updatedAt: new Date(),
        ...(updates.password && { encryptedPassword: this.encryptPassword(updates.password) }),
        ...(updates.metadata && { metadata: { ...existingCredential.metadata, ...updates.metadata } }),
        ...(updates.expiresAt && { expiresAt: updates.expiresAt }),
        ...(updates.rotationInterval && { rotationInterval: updates.rotationInterval }),
      };

      // Update in keychain
      await keytar.setPassword(
        this.serviceName,
        credentialId,
        JSON.stringify(updatedCredential)
      );

      // Update memory cache
      this.credentialStore.set(credentialId, updatedCredential);

      // Update rotation if needed
      if (updates.rotationInterval) {
        this.clearRotation(credentialId);
        this.setupRotation(credentialId, updates.rotationInterval);
      }

    } catch (error) {
      logger.error('Failed to update credential:', error);
      throw new Error(`Failed to update credential: ${error.message}`);
    }
  }

  /**
   * Delete credential from keychain and cache
   */
  async deleteCredential(credentialId: string): Promise<void> {
    try {
      // Remove from keychain
      await keytar.deletePassword(this.serviceName, credentialId);
      
      // Remove from memory cache
      this.credentialStore.delete(credentialId);
      
      // Clear rotation timer
      this.clearRotation(credentialId);

    } catch (error) {
      logger.error('Failed to delete credential:', error);
      throw new Error(`Failed to delete credential: ${error.message}`);
    }
  }

  /**
   * List all stored credentials (metadata only)
   */
  async listCredentials(): Promise<Array<{ id: string; service: string; account: string; createdAt: Date }>> {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      
      return credentials.map(cred => {
        const parsed: EncryptedCredential = JSON.parse(cred.password);
        return {
          id: parsed.id,
          service: parsed.service,
          account: parsed.account,
          createdAt: parsed.createdAt,
        };
      });

    } catch (error) {
      logger.error('Failed to list credentials:', error);
      return [];
    }
  }

  /**
   * Rotate credential password
   */
  async rotateCredential(credentialId: string, newPassword: string): Promise<void> {
    try {
      await this.updateCredential(credentialId, { password: newPassword });
      
      const credential = this.credentialStore.get(credentialId);
      if (credential) {
        credential.lastRotated = new Date();
        this.credentialStore.set(credentialId, credential);
        
        // Update in keychain
        await keytar.setPassword(
          this.serviceName,
          credentialId,
          JSON.stringify(credential)
        );
      }

      this.emit('credential:rotated', credentialId);

    } catch (error) {
      logger.error('Failed to rotate credential:', error);
      throw new Error(`Failed to rotate credential: ${error.message}`);
    }
  }

  /**
   * Bulk operations
   */
  async bulkStore(credentials: CredentialOptions[]): Promise<string[]> {
    const results = await Promise.allSettled(
      credentials.map(cred => this.storeCredential(cred))
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map(result => result.value);

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      logger.warn(`Failed to store ${failed.length} credentials`);
    }

    return successful;
  }

  async bulkRetrieve(credentialIds: string[]): Promise<Array<CredentialOptions | null>> {
    const results = await Promise.allSettled(
      credentialIds.map(id => this.retrieveCredential(id))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
  }

  /**
   * Security utilities
   */
  private encryptPassword(password: string): string {
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptPassword(encryptedPassword: string): string {
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private generateCredentialId(service: string, account: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${service}:${account}:${Date.now()}`);
    return hash.digest('hex').substring(0, 16);
  }

  private setupRotation(credentialId: string, interval: number): void {
    const timer = setTimeout(async () => {
      try {
        // Here you would typically generate a new password or trigger external rotation
        this.emit('credential:rotation-due', credentialId);
      } catch (error) {
        logger.error(`Failed to rotate credential ${credentialId}:`, error);
      }
    }, interval);

    this.rotationTimers.set(credentialId, timer);
  }

  private clearRotation(credentialId: string): void {
    const timer = this.rotationTimers.get(credentialId);
    if (timer) {
      clearTimeout(timer);
      this.rotationTimers.delete(credentialId);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear all rotation timers
    for (const [credentialId] of this.rotationTimers) {
      this.clearRotation(credentialId);
    }
    
    // Clear memory cache
    this.credentialStore.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
  }
}