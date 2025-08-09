import { CredentialManager } from '../../src/credential/CredentialManager';
import * as keytar from 'node-keytar';
import { jest } from '@jest/globals';

// Mock keytar
const mockKeytar = keytar as jest.Mocked<typeof keytar>;

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  
  beforeEach(() => {
    credentialManager = new CredentialManager('test-master-key');
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await credentialManager.cleanup();
  });

  describe('storeCredential', () => {
    it('should store credential successfully', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password',
        metadata: { environment: 'test' }
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);

      const credentialId = await credentialManager.storeCredential(credentialOptions);

      expect(credentialId).toBeDefined();
      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(1);
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        '@wundr/security',
        credentialId,
        expect.any(String)
      );
    });

    it('should emit credential:stored event', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);

      const eventSpy = jest.fn();
      credentialManager.on('credential:stored', eventSpy);

      const credentialId = await credentialManager.storeCredential(credentialOptions);

      expect(eventSpy).toHaveBeenCalledWith(credentialId);
    });

    it('should handle storage errors', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockRejectedValue(new Error('Keychain error'));

      await expect(credentialManager.storeCredential(credentialOptions)).rejects.toThrow('Failed to store credential');
    });
  });

  describe('retrieveCredential', () => {
    it('should retrieve credential successfully', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);
      const credentialId = await credentialManager.storeCredential(credentialOptions);

      // Mock retrieval
      mockKeytar.getPassword.mockResolvedValue(JSON.stringify({
        id: credentialId,
        service: 'test-service',
        account: 'test-account',
        encryptedPassword: 'encrypted-password',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const retrieved = await credentialManager.retrieveCredential(credentialId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.service).toBe('test-service');
      expect(retrieved?.account).toBe('test-account');
    });

    it('should return null for non-existent credential', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await credentialManager.retrieveCredential('non-existent');

      expect(result).toBeNull();
    });

    it('should handle expired credentials', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      
      mockKeytar.getPassword.mockResolvedValue(JSON.stringify({
        id: 'test-id',
        service: 'test-service',
        account: 'test-account',
        encryptedPassword: 'encrypted-password',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: expiredDate
      }));

      mockKeytar.deletePassword.mockResolvedValue(undefined);

      const result = await credentialManager.retrieveCredential('test-id');

      expect(result).toBeNull();
      expect(mockKeytar.deletePassword).toHaveBeenCalled();
    });
  });

  describe('updateCredential', () => {
    it('should update existing credential', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);
      const credentialId = await credentialManager.storeCredential(credentialOptions);

      const updates = {
        password: 'new-password',
        metadata: { updated: true }
      };

      await credentialManager.updateCredential(credentialId, updates);

      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(2); // Once for create, once for update
    });

    it('should throw error for non-existent credential', async () => {
      const updates = { password: 'new-password' };

      await expect(credentialManager.updateCredential('non-existent', updates)).rejects.toThrow('Credential not found');
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential successfully', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);
      mockKeytar.deletePassword.mockResolvedValue(undefined);

      const credentialId = await credentialManager.storeCredential(credentialOptions);
      await credentialManager.deleteCredential(credentialId);

      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('@wundr/security', credentialId);
    });
  });

  describe('rotateCredential', () => {
    it('should rotate credential password', async () => {
      const credentialOptions = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password'
      };

      mockKeytar.setPassword.mockResolvedValue(undefined);
      const credentialId = await credentialManager.storeCredential(credentialOptions);

      const eventSpy = jest.fn();
      credentialManager.on('credential:rotated', eventSpy);

      await credentialManager.rotateCredential(credentialId, 'new-password');

      expect(eventSpy).toHaveBeenCalledWith(credentialId);
      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(2); // Create + rotate
    });
  });

  describe('bulkOperations', () => {
    it('should perform bulk store operations', async () => {
      const credentials = [
        { service: 'service1', account: 'account1', password: 'password1' },
        { service: 'service2', account: 'account2', password: 'password2' }
      ];

      mockKeytar.setPassword.mockResolvedValue(undefined);

      const results = await credentialManager.bulkStore(credentials);

      expect(results).toHaveLength(2);
      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in bulk operations', async () => {
      const credentials = [
        { service: 'service1', account: 'account1', password: 'password1' },
        { service: 'service2', account: 'account2', password: 'password2' }
      ];

      mockKeytar.setPassword
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Storage failed'));

      const results = await credentialManager.bulkStore(credentials);

      expect(results).toHaveLength(1); // Only one successful
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt passwords correctly with AES-256-GCM', async () => {
      const password = 'test-password-123';
      const credentialId = await credentialManager.storeCredential({
        service: 'test-service',
        account: 'test-user',
        password,
      });

      mockKeytar.setPassword.mockResolvedValue(undefined);
      const retrieved = await credentialManager.retrieveCredential(credentialId);
      expect(retrieved?.password).toBe(password);
    });

    it('should generate unique IVs for each encryption', async () => {
      const password = 'same-password';
      
      mockKeytar.setPassword.mockResolvedValue(undefined);
      
      const credentialId1 = await credentialManager.storeCredential({
        service: 'test-service-1',
        account: 'test-user',
        password,
      });
      
      const credentialId2 = await credentialManager.storeCredential({
        service: 'test-service-2',
        account: 'test-user',
        password,
      });

      // Get the encrypted credentials from the internal store
      const cred1 = credentialManager['credentialStore'].get(credentialId1);
      const cred2 = credentialManager['credentialStore'].get(credentialId2);
      
      // IVs should be different even for the same password
      expect(cred1?.iv).not.toBe(cred2?.iv);
      // Encrypted data should be different due to different IVs
      expect(cred1?.encryptedPassword).not.toBe(cred2?.encryptedPassword);
      // Both should use encryption version 2
      expect(cred1?.encryptionVersion).toBe(2);
      expect(cred2?.encryptionVersion).toBe(2);
    });

    it('should handle authentication tag verification', async () => {
      const password = 'test-password-auth-tag';
      
      mockKeytar.setPassword.mockResolvedValue(undefined);
      
      const credentialId = await credentialManager.storeCredential({
        service: 'auth-test-service',
        account: 'auth-test-user',
        password,
      });

      const credential = credentialManager['credentialStore'].get(credentialId);
      expect(credential?.authTag).toBeDefined();
      expect(credential?.authTag).toHaveLength(32); // 16 bytes = 32 hex chars
      
      const retrieved = await credentialManager.retrieveCredential(credentialId);
      expect(retrieved?.password).toBe(password);
    });
  });
});