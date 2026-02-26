/**
 * Configuration Loader Tests
 */

import {
  loadConfig,
  validateRequiredEnv,
  resetConfig,
  getConfig,
} from '../index';

describe('Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and config instance before each test
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateRequiredEnv', () => {
    it('should throw error when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => validateRequiredEnv()).toThrow(
        'Missing required environment variables'
      );
      expect(() => validateRequiredEnv()).toThrow('OPENAI_API_KEY');
    });

    it('should not throw when OPENAI_API_KEY is present', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      expect(() => validateRequiredEnv()).not.toThrow();
    });
  });

  describe('loadConfig', () => {
    it('should load minimal configuration with only required fields', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const config = loadConfig();

      expect(config.openai.apiKey).toBe('sk-test-key');
      expect(config.daemon.port).toBe(8787); // default
      expect(config.daemon.host).toBe('127.0.0.1'); // default
    });

    it('should throw error when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => loadConfig()).toThrow('Configuration validation failed');
      expect(() => loadConfig()).toThrow('OPENAI_API_KEY is required');
    });

    it('should load all daemon configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_NAME = 'test-daemon';
      process.env.DAEMON_PORT = '9999';
      process.env.DAEMON_HOST = '0.0.0.0';
      process.env.DAEMON_MAX_SESSIONS = '50';
      process.env.DAEMON_VERBOSE = 'true';

      const config = loadConfig();

      expect(config.daemon.name).toBe('test-daemon');
      expect(config.daemon.port).toBe(9999);
      expect(config.daemon.host).toBe('0.0.0.0');
      expect(config.daemon.maxSessions).toBe(50);
      expect(config.daemon.verbose).toBe(true);
    });

    it('should load health configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_HEARTBEAT_INTERVAL = '15000';
      process.env.DAEMON_HEALTH_CHECK_INTERVAL = '45000';
      process.env.DAEMON_SHUTDOWN_TIMEOUT = '5000';

      const config = loadConfig();

      expect(config.health.heartbeatInterval).toBe(15000);
      expect(config.health.healthCheckInterval).toBe(45000);
      expect(config.health.shutdownTimeout).toBe(5000);
    });

    it('should load optional Redis configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_DB = '2';

      const config = loadConfig();

      expect(config.redis).toBeDefined();
      expect(config.redis?.url).toBe('redis://localhost:6379');
      expect(config.redis?.password).toBe('secret');
      expect(config.redis?.db).toBe(2);
    });

    it('should not load Redis config when REDIS_URL is missing', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const config = loadConfig();

      expect(config.redis).toBeUndefined();
    });

    it('should load optional database configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DATABASE_POOL_SIZE = '20';

      const config = loadConfig();

      expect(config.database).toBeDefined();
      expect(config.database?.url).toBe('postgresql://localhost:5432/test');
      expect(config.database?.poolSize).toBe(20);
    });

    it('should load distributed configuration when cluster name is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.CLUSTER_NAME = 'my-cluster';
      process.env.LOAD_BALANCING_STRATEGY = 'weighted';

      const config = loadConfig();

      expect(config.distributed).toBeDefined();
      expect(config.distributed?.clusterName).toBe('my-cluster');
      expect(config.distributed?.loadBalancingStrategy).toBe('weighted');
    });

    it('should load security configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_JWT_SECRET =
        'this-is-a-very-secure-secret-that-is-at-least-32-characters';
      process.env.DAEMON_CORS_ENABLED = 'true';
      process.env.DAEMON_CORS_ORIGINS =
        'http://localhost:3000,https://example.com';

      const config = loadConfig();

      expect(config.security.jwtSecret).toBe(
        'this-is-a-very-secure-secret-that-is-at-least-32-characters'
      );
      expect(config.security.cors.enabled).toBe(true);
      expect(config.security.cors.origins).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('should throw error for weak JWT secret', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_JWT_SECRET = 'weak';

      expect(() => loadConfig()).toThrow(
        'JWT secret must be at least 32 characters'
      );
    });

    it('should load monitoring configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.METRICS_ENABLED = 'false';
      process.env.METRICS_PORT = '8080';
      process.env.HEALTH_CHECK_PATH = '/healthz';

      const config = loadConfig();

      expect(config.monitoring.metrics.enabled).toBe(false);
      expect(config.monitoring.metrics.port).toBe(8080);
      expect(config.monitoring.healthCheck.path).toBe('/healthz');
    });

    it('should load memory configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_MAX_HEAP_MB = '4096';
      process.env.DAEMON_MAX_CONTEXT_TOKENS = '200000';
      process.env.MEMORY_COMPACTION_THRESHOLD = '0.9';

      const config = loadConfig();

      expect(config.memory.maxHeapMB).toBe(4096);
      expect(config.memory.maxContextTokens).toBe(200000);
      expect(config.memory.compaction.threshold).toBe(0.9);
    });

    it('should load token budget configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.TOKEN_BUDGET_DAILY = '500000';
      process.env.TOKEN_BUDGET_WEEKLY = '2500000';
      process.env.TOKEN_BUDGET_MONTHLY = '10000000';
      process.env.TOKEN_BUDGET_ALERT_THRESHOLD = '0.75';

      const config = loadConfig();

      expect(config.tokenBudget.daily).toBe(500000);
      expect(config.tokenBudget.weekly).toBe(2500000);
      expect(config.tokenBudget.monthly).toBe(10000000);
      expect(config.tokenBudget.alerts.threshold).toBe(0.75);
    });

    it('should parse boolean values correctly', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      // Test 'true' string
      process.env.DAEMON_VERBOSE = 'true';
      let config = loadConfig();
      expect(config.daemon.verbose).toBe(true);
      resetConfig();

      // Test '1' string
      process.env.DAEMON_VERBOSE = '1';
      config = loadConfig();
      expect(config.daemon.verbose).toBe(true);
      resetConfig();

      // Test 'false' string
      process.env.DAEMON_VERBOSE = 'false';
      config = loadConfig();
      expect(config.daemon.verbose).toBe(false);
      resetConfig();

      // Test any other value
      process.env.DAEMON_VERBOSE = 'anything';
      config = loadConfig();
      expect(config.daemon.verbose).toBe(false);
    });

    it('should validate port numbers', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      // Port too low
      process.env.DAEMON_PORT = '1023';
      expect(() => loadConfig()).toThrow('greater than or equal to 1024');
      resetConfig();

      // Port too high
      process.env.DAEMON_PORT = '65536';
      expect(() => loadConfig()).toThrow('less than or equal to 65535');
      resetConfig();

      // Valid port
      process.env.DAEMON_PORT = '8787';
      expect(() => loadConfig()).not.toThrow();
    });

    it('should load Anthropic configuration when API key is provided', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_MODEL = 'claude-3-opus-20240229';

      const config = loadConfig();

      expect(config.anthropic).toBeDefined();
      expect(config.anthropic?.apiKey).toBe('sk-ant-test-key');
      expect(config.anthropic?.model).toBe('claude-3-opus-20240229');
    });

    it('should load Neolith configuration when API URL is provided', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.NEOLITH_API_URL = 'http://localhost:3000';
      process.env.NEOLITH_API_KEY = 'neolith-key';
      process.env.NEOLITH_API_SECRET = 'neolith-secret';

      const config = loadConfig();

      expect(config.neolith).toBeDefined();
      expect(config.neolith?.apiUrl).toBe('http://localhost:3000');
      expect(config.neolith?.apiKey).toBe('neolith-key');
      expect(config.neolith?.apiSecret).toBe('neolith-secret');
    });
  });

  describe('getConfig', () => {
    it('should return singleton instance', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    it('should load config on first access', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_PORT = '9999';

      const config = getConfig();

      expect(config.daemon.port).toBe(9999);
    });
  });

  describe('resetConfig', () => {
    it('should clear singleton instance', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.DAEMON_PORT = '9999';

      const config1 = getConfig();
      expect(config1.daemon.port).toBe(9999);

      resetConfig();
      process.env.DAEMON_PORT = '8888';

      const config2 = getConfig();
      expect(config2.daemon.port).toBe(8888);
      expect(config2).not.toBe(config1);
    });
  });
});
