import { SecretScanner } from '../../src/scanner/SecretScanner';
import * as fs from 'fs/promises';
import { jest } from '@jest/globals';

// Mock fs
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SecretScanner', () => {
  let secretScanner: SecretScanner;
  
  beforeEach(() => {
    secretScanner = new SecretScanner();
    jest.clearAllMocks();
  });

  describe('scanText', () => {
    it('should detect AWS access keys', () => {
      const text = 'const accessKey = "AKIAIOSFODNN7EXAMPLE";';
      const matches = secretScanner.scanText(text, 'test.js');
      
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern.name).toBe('AWS Access Key');
      expect(matches[0].match).toBe('AKIAIOSFODNN7EXAMPLE');
    });

    it('should detect hardcoded passwords', () => {
      const text = 'const password = "supersecretpassword123";';
      const matches = secretScanner.scanText(text, 'test.js');
      
      expect(matches.length).toBeGreaterThan(0);
      const passwordMatch = matches.find(m => m.pattern.name === 'Hardcoded Password');
      expect(passwordMatch).toBeDefined();
    });

    it('should detect JWT tokens', () => {
      const text = 'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";';
      const matches = secretScanner.scanText(text, 'test.js');
      
      expect(matches.length).toBeGreaterThan(0);
      const jwtMatch = matches.find(m => m.pattern.name === 'JWT Token');
      expect(jwtMatch).toBeDefined();
    });

    it('should not detect false positives in comments', () => {
      const text = '// Example: password = "not-a-real-password"';
      const matches = secretScanner.scanText(text, 'test.js');
      
      // Should have low confidence for comments
      const highConfidenceMatches = matches.filter(m => m.confidence > 0.5);
      expect(highConfidenceMatches).toHaveLength(0);
    });

    it('should detect private keys', () => {
      const text = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEjWT2btWqE
-----END RSA PRIVATE KEY-----
      `;
      const matches = secretScanner.scanText(text, 'key.pem');
      
      expect(matches.length).toBeGreaterThan(0);
      const keyMatch = matches.find(m => m.pattern.name === 'Private Key');
      expect(keyMatch).toBeDefined();
    });
  });

  describe('scanFile', () => {
    it('should scan file content', async () => {
      const fileContent = 'const apiKey = "sk-1234567890abcdef";';
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const matches = await secretScanner.scanFile('/test/file.js');
      
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.js', 'utf-8');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const matches = await secretScanner.scanFile('/nonexistent/file.js');
      
      expect(matches).toHaveLength(0);
    });

    it('should handle directories gracefully', async () => {
      const error = new Error('Is a directory');
      (error as any).code = 'EISDIR';
      mockFs.readFile.mockRejectedValue(error);

      const matches = await secretScanner.scanFile('/test/directory');
      
      expect(matches).toHaveLength(0);
    });
  });

  describe('addPattern and removePattern', () => {
    it('should add custom patterns', () => {
      const customPattern = {
        name: 'Custom Secret',
        pattern: /CUSTOM_[A-Z0-9]{16}/g,
        description: 'Custom secret pattern',
        severity: 'high' as const,
        category: 'custom'
      };

      secretScanner.addPattern(customPattern);
      
      const text = 'const secret = "CUSTOM_1234567890ABCDEF";';
      const matches = secretScanner.scanText(text, 'test.js');
      
      const customMatch = matches.find(m => m.pattern.name === 'Custom Secret');
      expect(customMatch).toBeDefined();
    });

    it('should remove patterns by name', () => {
      const initialPatterns = secretScanner.getPatterns();
      const patternToRemove = initialPatterns[0];
      
      secretScanner.removePattern(patternToRemove.name);
      
      const updatedPatterns = secretScanner.getPatterns();
      expect(updatedPatterns).toHaveLength(initialPatterns.length - 1);
      expect(updatedPatterns.find(p => p.name === patternToRemove.name)).toBeUndefined();
    });
  });

  describe('hasSecrets', () => {
    it('should return true when secrets are found', () => {
      const text = 'const apiKey = "AKIAIOSFODNN7EXAMPLE";';
      const hasSecrets = secretScanner.hasSecrets(text);
      
      expect(hasSecrets).toBe(true);
    });

    it('should return false when no secrets are found', () => {
      const text = 'const greeting = "Hello, World!";';
      const hasSecrets = secretScanner.hasSecrets(text);
      
      expect(hasSecrets).toBe(false);
    });
  });

  describe('createRemediationSuggestions', () => {
    it('should create remediation suggestions', () => {
      const matches = [
        {
          pattern: {
            name: 'AWS Access Key',
            pattern: /test/g,
            description: 'Test',
            severity: 'critical' as const,
            category: 'cloud'
          },
          match: 'AKIAIOSFODNN7EXAMPLE',
          file: '/test/config.js',
          line: 1,
          column: 1,
          context: 'test context',
          confidence: 0.9
        }
      ];

      const suggestions = secretScanner.createRemediationSuggestions(matches);
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].file).toBe('/test/config.js');
      expect(suggestions[0].suggestions).toContain('Use environment variables or secure credential storage for cloud credentials');
    });

    it('should group suggestions by file', () => {
      const matches = [
        {
          pattern: {
            name: 'AWS Access Key',
            pattern: /test/g,
            description: 'Test',
            severity: 'critical' as const,
            category: 'cloud'
          },
          match: 'AKIA123',
          file: '/test/config.js',
          line: 1,
          column: 1,
          context: 'test',
          confidence: 0.9
        },
        {
          pattern: {
            name: 'Database Connection String',
            pattern: /test/g,
            description: 'Test',
            severity: 'high' as const,
            category: 'database'
          },
          match: 'mongodb://user:pass@host',
          file: '/test/config.js',
          line: 2,
          column: 1,
          context: 'test',
          confidence: 0.8
        }
      ];

      const suggestions = secretScanner.createRemediationSuggestions(matches);
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].file).toBe('/test/config.js');
      expect(suggestions[0].suggestions.length).toBeGreaterThan(1);
    });
  });

  describe('event emission', () => {
    it('should emit scan events during directory scan', async () => {
      const eventSpy = jest.fn();
      secretScanner.on('scan:started', eventSpy);

      mockFs.readdir.mockResolvedValue([]);

      await secretScanner.scanDirectory('/test/directory');

      expect(eventSpy).toHaveBeenCalledWith({ 
        directory: '/test/directory',
        totalFiles: 0 
      });
    });
  });
});