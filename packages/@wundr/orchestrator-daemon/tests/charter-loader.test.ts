// Using Jest globals (no import needed)
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadCharter,
  loadCharterFromFile,
  getDefaultCharter,
  validateCharter,
  saveCharter,
  type Charter,
} from '../src/charter/loader';

describe('Charter Loader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'charter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getDefaultCharter', () => {
    it('should return a valid default charter', () => {
      const charter = getDefaultCharter();

      expect(charter.name).toBe('orchestrator-supervisor');
      expect(charter.tier).toBe(1);
      expect(charter.identity.name).toBe('Wundr Orchestrator');
      expect(charter.capabilities).toContain('task_analysis');
      expect(charter.resourceLimits.maxSessions).toBe(10);
    });

    it('should pass validation', () => {
      const charter = getDefaultCharter();
      expect(() => validateCharter(charter)).not.toThrow();
    });
  });

  describe('validateCharter', () => {
    it('should validate a correct charter', () => {
      const charter = getDefaultCharter();
      expect(() => validateCharter(charter)).not.toThrow();
    });

    it('should reject invalid tier', () => {
      const invalid = { ...getDefaultCharter(), tier: 0 };
      expect(() => validateCharter(invalid)).toThrow();
    });

    it('should reject negative maxSessions', () => {
      const invalid = {
        ...getDefaultCharter(),
        resourceLimits: {
          ...getDefaultCharter().resourceLimits,
          maxSessions: -1,
        },
      };
      expect(() => validateCharter(invalid)).toThrow();
    });

    it('should reject temperature out of range', () => {
      const invalid = {
        ...getDefaultCharter(),
        operationalSettings: {
          ...getDefaultCharter().operationalSettings,
          temperature: 3.0,
        },
      };
      expect(() => validateCharter(invalid)).toThrow();
    });
  });

  describe('saveCharter and loadCharterFromFile', () => {
    it('should save and load charter correctly', async () => {
      const charter = getDefaultCharter();
      const filePath = path.join(tempDir, 'test-charter.yaml');

      await saveCharter(charter, filePath);
      const loaded = await loadCharterFromFile(filePath);

      expect(loaded).toEqual(charter);
    });

    it('should handle nested directories', async () => {
      const charter = getDefaultCharter();
      const filePath = path.join(tempDir, 'nested', 'dir', 'charter.yaml');

      await saveCharter(charter, filePath);
      const loaded = await loadCharterFromFile(filePath);

      expect(loaded).toEqual(charter);
    });

    it('should throw on non-existent file', async () => {
      const filePath = path.join(tempDir, 'does-not-exist.yaml');
      await expect(loadCharterFromFile(filePath)).rejects.toThrow();
    });

    it('should throw on invalid YAML', async () => {
      const filePath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(filePath, 'invalid: yaml: content:', 'utf-8');

      await expect(loadCharterFromFile(filePath)).rejects.toThrow();
    });
  });

  describe('loadCharter with overrides', () => {
    it('should merge file overrides with defaults', async () => {
      const filePath = path.join(tempDir, 'override.yaml');
      const override = {
        name: 'custom-orchestrator',
        tier: 2,
        resourceLimits: {
          maxSessions: 20,
        },
      };

      // Save partial charter
      await fs.writeFile(
        filePath,
        `
name: custom-orchestrator
tier: 2
resourceLimits:
  maxSessions: 20
      `.trim(),
        'utf-8'
      );

      const charter = await loadCharter(filePath, { useEnvOverrides: false });

      expect(charter.name).toBe('custom-orchestrator');
      expect(charter.tier).toBe(2);
      expect(charter.resourceLimits.maxSessions).toBe(20);
      // Should still have defaults for other fields
      expect(charter.capabilities).toContain('task_analysis');
      expect(charter.identity.name).toBe('Wundr Orchestrator');
    });

    it('should apply environment variable overrides', async () => {
      const envOverrides = {
        ORCHESTRATOR_NAME: 'env-orchestrator',
        ORCHESTRATOR_TIER: '3',
        ORCHESTRATOR_MAX_SESSIONS: '15',
        ORCHESTRATOR_MODEL: 'gpt-4',
        ORCHESTRATOR_TEMPERATURE: '0.5',
      };

      // Save original env
      const originalEnv = { ...process.env };

      try {
        // Apply env overrides
        Object.assign(process.env, envOverrides);

        const charter = await loadCharter(undefined, { useEnvOverrides: true });

        expect(charter.name).toBe('env-orchestrator');
        expect(charter.tier).toBe(3);
        expect(charter.resourceLimits.maxSessions).toBe(15);
        expect(charter.operationalSettings.defaultModel).toBe('gpt-4');
        expect(charter.operationalSettings.temperature).toBe(0.5);
      } finally {
        // Restore original env
        process.env = originalEnv;
      }
    });

    it('should handle file + env overrides together', async () => {
      const filePath = path.join(tempDir, 'combined.yaml');
      await fs.writeFile(
        filePath,
        `
name: file-orchestrator
tier: 2
      `.trim(),
        'utf-8'
      );

      const originalEnv = { ...process.env };

      try {
        process.env.ORCHESTRATOR_MAX_SESSIONS = '25';

        const charter = await loadCharter(filePath, { useEnvOverrides: true });

        expect(charter.name).toBe('file-orchestrator'); // from file
        expect(charter.tier).toBe(2); // from file
        expect(charter.resourceLimits.maxSessions).toBe(25); // from env
      } finally {
        process.env = originalEnv;
      }
    });

    it('should use defaults when file load fails', async () => {
      const charter = await loadCharter('/non/existent/path.yaml');

      // Should still return valid charter from defaults
      expect(charter.name).toBe('orchestrator-supervisor');
      expect(charter.tier).toBe(1);
    });
  });
});
