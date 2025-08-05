/**
 * Package Template Tests
 * 
 * Comprehensive test suite for the package template demonstrating
 * testing best practices, test organization, and coverage patterns.
 */

import {
  PackageCore,
  PackageConfig,
  PackageUtils,
  PackageError,
  PackageValidationError,
  PackageConfigurationError,
  PACKAGE_CONSTANTS,
  initializePackage,
  healthCheck,
  isPackageConfig,
  isPackageError,
  Logger,
  VERSION,
  BUILD_INFO,
  defaultPackage,
} from '../src/index';

// Mock environment variables for testing
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('PackageCore', () => {
  const mockConfig: PackageConfig = {
    name: 'test-package',
    version: '1.0.0',
    description: 'A test package',
    author: 'Test Author',
    license: 'MIT',
  };

  describe('Constructor and Basic Methods', () => {
    it('should create a package instance with provided config', () => {
      const pkg = new PackageCore(mockConfig);

      expect(pkg.getName()).toBe('test-package');
      expect(pkg.getVersion()).toBe('1.0.0');
    });

    it('should create metadata with build time and environment', () => {
      const pkg = new PackageCore(mockConfig);
      const info = pkg.getInfo();

      expect(info.metadata).toHaveProperty('buildTime');
      expect(info.metadata).toHaveProperty('environment');
      expect(info.metadata.buildTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include git commit if available', () => {
      process.env.GIT_COMMIT = 'abc123';
      
      const pkg = new PackageCore(mockConfig);
      const info = pkg.getInfo();

      expect(info.metadata.gitCommit).toBe('abc123');
    });

    it('should default to development environment', () => {
      delete process.env.NODE_ENV;
      
      const pkg = new PackageCore(mockConfig);

      expect(pkg.isDevelopment()).toBe(true);
      expect(pkg.isProduction()).toBe(false);
    });

    it('should recognize production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const pkg = new PackageCore(mockConfig);

      expect(pkg.isProduction()).toBe(true);
      expect(pkg.isDevelopment()).toBe(false);
    });

    it('should return complete package info', () => {
      const pkg = new PackageCore(mockConfig);
      const info = pkg.getInfo();

      expect(info).toMatchObject(mockConfig);
      expect(info).toHaveProperty('metadata');
      expect(info.metadata).toHaveProperty('buildTime');
      expect(info.metadata).toHaveProperty('environment');
    });
  });

  describe('Environment Detection', () => {
    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const pkg = new PackageCore(mockConfig);
      const info = pkg.getInfo();

      expect(info.metadata.environment).toBe('test');
      expect(pkg.isDevelopment()).toBe(false);
      expect(pkg.isProduction()).toBe(false);
    });

    it('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      
      const pkg = new PackageCore(mockConfig);
      const info = pkg.getInfo();

      expect(info.metadata.environment).toBe('development');
    });
  });
});

describe('PackageUtils', () => {
  describe('createPackage', () => {
    it('should create package with default configuration', () => {
      const pkg = PackageUtils.createPackage();

      expect(pkg.getName()).toBe('monorepo-package');
      expect(pkg.getVersion()).toBe('1.0.0');
    });

    it('should override default configuration', () => {
      const overrides = {
        name: 'custom-package',
        version: '2.0.0',
      };

      const pkg = PackageUtils.createPackage(overrides);

      expect(pkg.getName()).toBe('custom-package');
      expect(pkg.getVersion()).toBe('2.0.0');
    });

    it('should merge with default configuration', () => {
      const overrides = { name: 'custom-package' };
      const pkg = PackageUtils.createPackage(overrides);
      const info = pkg.getInfo();

      expect(info.name).toBe('custom-package');
      expect(info.version).toBe('1.0.0'); // Default version
      expect(info.author).toBe('Monorepo Team'); // Default author
    });
  });

  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      const config = {
        name: 'valid-package',
        version: '1.0.0',
        description: 'A valid package',
      };

      expect(PackageUtils.validateConfig(config)).toBe(true);
    });

    it('should validate minimal configuration', () => {
      const config = {
        name: 'minimal-package',
        version: '1.0.0',
      };

      expect(PackageUtils.validateConfig(config)).toBe(true);
    });

    it('should reject configuration without name', () => {
      const config = {
        version: '1.0.0',
      };

      expect(PackageUtils.validateConfig(config)).toBe(false);
    });

    it('should reject configuration without version', () => {
      const config = {
        name: 'no-version-package',
      };

      expect(PackageUtils.validateConfig(config)).toBe(false);
    });

    it('should reject empty configuration', () => {
      expect(PackageUtils.validateConfig({})).toBe(false);
    });
  });

  describe('getPackageVersion', () => {
    it('should return version from npm environment variable', () => {
      process.env.npm_package_version = '3.0.0';

      const version = PackageUtils.getPackageVersion();

      expect(version).toBe('3.0.0');
    });

    it('should return default version when npm variable not set', () => {
      delete process.env.npm_package_version;

      const version = PackageUtils.getPackageVersion();

      expect(version).toBe('1.0.0');
    });
  });

  describe('formatPackageName', () => {
    it('should format kebab-case to title case', () => {
      const formatted = PackageUtils.formatPackageName('my-awesome-package');

      expect(formatted).toBe('My Awesome Package');
    });

    it('should handle single word', () => {
      const formatted = PackageUtils.formatPackageName('package');

      expect(formatted).toBe('Package');
    });

    it('should handle already formatted names', () => {
      const formatted = PackageUtils.formatPackageName('Package');

      expect(formatted).toBe('Package');
    });

    it('should handle empty string', () => {
      const formatted = PackageUtils.formatPackageName('');

      expect(formatted).toBe('');
    });
  });
});

describe('Error Classes', () => {
  describe('PackageError', () => {
    it('should create basic package error', () => {
      const error = new PackageError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PackageError');
      expect(error.code).toBe('PACKAGE_ERROR');
      expect(error.packageName).toBeUndefined();
    });

    it('should create package error with custom code', () => {
      const error = new PackageError('Test error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create package error with package name', () => {
      const error = new PackageError('Test error', 'ERROR_CODE', 'test-package');

      expect(error.packageName).toBe('test-package');
    });
  });

  describe('PackageValidationError', () => {
    it('should create validation error', () => {
      const error = new PackageValidationError('Validation failed');

      expect(error.name).toBe('PackageValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
    });

    it('should create validation error with package name', () => {
      const error = new PackageValidationError('Validation failed', 'test-package');

      expect(error.packageName).toBe('test-package');
    });
  });

  describe('PackageConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new PackageConfigurationError('Configuration invalid');

      expect(error.name).toBe('PackageConfigurationError');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.message).toBe('Configuration invalid');
    });
  });
});

describe('Constants', () => {
  it('should export package constants', () => {
    expect(PACKAGE_CONSTANTS).toHaveProperty('DEFAULT_TIMEOUT', 5000);
    expect(PACKAGE_CONSTANTS).toHaveProperty('MAX_RETRY_ATTEMPTS', 3);
    expect(PACKAGE_CONSTANTS).toHaveProperty('SUPPORTED_VERSIONS');
    expect(PACKAGE_CONSTANTS).toHaveProperty('DEFAULT_ENVIRONMENT', 'development');
  });

  it('should have immutable constants', () => {
    // TypeScript should prevent this, but test runtime behavior
    expect(() => {
      (PACKAGE_CONSTANTS as any).DEFAULT_TIMEOUT = 1000;
    }).not.toThrow(); // Assignment succeeds but doesn't change the object

    expect(PACKAGE_CONSTANTS.DEFAULT_TIMEOUT).toBe(5000);
  });
});

describe('Global Functions', () => {
  describe('initializePackage', () => {
    it('should initialize package with valid config', () => {
      const config = { name: 'init-test', version: '1.0.0' };
      const pkg = initializePackage(config);

      expect(pkg.getName()).toBe('init-test');
      expect(pkg.getVersion()).toBe('1.0.0');
    });

    it('should initialize package with partial config', () => {
      const config = { name: 'partial-test' };
      const pkg = initializePackage(config);

      expect(pkg.getName()).toBe('partial-test');
      expect(pkg.getVersion()).toBe('1.0.0'); // Default version
    });

    it('should throw validation error for invalid config', () => {
      const config = {}; // Missing required fields

      expect(() => initializePackage(config)).toThrow(PackageValidationError);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const health = healthCheck();

      expect(health).toHaveProperty('status', 'healthy');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('environment');
      expect(typeof health.uptime).toBe('number');
    });

    it('should respect NODE_ENV in health check', () => {
      process.env.NODE_ENV = 'production';

      const health = healthCheck();

      expect(health.environment).toBe('production');
    });
  });
});

describe('Type Guards', () => {
  describe('isPackageConfig', () => {
    it('should return true for valid package config', () => {
      const config = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
      };

      expect(isPackageConfig(config)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { name: 'test' }, // Missing version
        { version: '1.0.0' }, // Missing name
        { name: 123, version: '1.0.0' }, // Invalid name type
        { name: 'test', version: 123 }, // Invalid version type
      ];

      invalidConfigs.forEach(config => {
        expect(isPackageConfig(config)).toBe(false);
      });
    });
  });

  describe('isPackageError', () => {
    it('should return true for PackageError instances', () => {
      const error = new PackageError('test');
      const validationError = new PackageValidationError('test');
      const configError = new PackageConfigurationError('test');

      expect(isPackageError(error)).toBe(true);
      expect(isPackageError(validationError)).toBe(true);
      expect(isPackageError(configError)).toBe(true);
    });

    it('should return false for non-PackageError instances', () => {
      const regularError = new Error('regular error');
      const typeError = new TypeError('type error');
      const string = 'error string';
      const object = { message: 'error' };

      expect(isPackageError(regularError)).toBe(false);
      expect(isPackageError(typeError)).toBe(false);
      expect(isPackageError(string)).toBe(false);
      expect(isPackageError(object)).toBe(false);
    });
  });
});

describe('Logger', () => {
  // Mock console.log to test logging
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];

  beforeEach(() => {
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('log', () => {
    it('should log with timestamp and level', () => {
      Logger.log('info', 'Test message');

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*\] \[INFO\] Test message/);
    });

    it('should log with additional arguments', () => {
      Logger.log('error', 'Error occurred', { code: 500 }, 'extra info');

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('Error occurred');
      expect(consoleOutput[0]).toContain('{"code":500}');
      expect(consoleOutput[0]).toContain('extra info');
    });
  });

  describe('convenience methods', () => {
    it('should log info messages', () => {
      Logger.info('Info message');

      expect(consoleOutput[0]).toContain('[INFO]');
      expect(consoleOutput[0]).toContain('Info message');
    });

    it('should log warning messages', () => {
      Logger.warn('Warning message');

      expect(consoleOutput[0]).toContain('[WARN]');
      expect(consoleOutput[0]).toContain('Warning message');
    });

    it('should log error messages', () => {
      Logger.error('Error message');

      expect(consoleOutput[0]).toContain('[ERROR]');
      expect(consoleOutput[0]).toContain('Error message');
    });
  });
});

describe('Exports and Metadata', () => {
  it('should export VERSION constant', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should export BUILD_INFO with correct structure', () => {
    expect(BUILD_INFO).toHaveProperty('version');
    expect(BUILD_INFO).toHaveProperty('buildTime');
    expect(BUILD_INFO).toHaveProperty('nodeVersion');
    expect(BUILD_INFO).toHaveProperty('platform');

    expect(BUILD_INFO.buildTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(BUILD_INFO.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it('should export default package instance', () => {
    expect(defaultPackage).toBeInstanceOf(PackageCore);
    expect(defaultPackage.getName()).toBe('monorepo-package');
    expect(defaultPackage.getVersion()).toBe('1.0.0');
  });
});

describe('Integration Tests', () => {
  it('should create, configure, and use package end-to-end', () => {
    // Create package
    const config: PackageConfig = {
      name: 'integration-test',
      version: '2.1.0',
      description: 'Integration test package',
      author: 'Test Runner',
      license: 'Apache-2.0',
    };

    const pkg = new PackageCore(config);

    // Test basic functionality
    expect(pkg.getName()).toBe('integration-test');
    expect(pkg.getVersion()).toBe('2.1.0');

    // Test metadata
    const info = pkg.getInfo();
    expect(info.description).toBe('Integration test package');
    expect(info.author).toBe('Test Runner');
    expect(info.license).toBe('Apache-2.0');
    expect(info.metadata).toHaveProperty('buildTime');

    // Test environment detection
    expect(typeof pkg.isDevelopment()).toBe('boolean');
    expect(typeof pkg.isProduction()).toBe('boolean');
  });

  it('should handle error scenarios gracefully', () => {
    expect(() => {
      throw new PackageValidationError('Test validation error', 'test-package');
    }).toThrow(PackageValidationError);

    const error = new PackageConfigurationError('Config error');
    expect(isPackageError(error)).toBe(true);
  });

  it('should validate and format package names correctly', () => {
    const testCases = [
      { input: 'my-awesome-package', expected: 'My Awesome Package' },
      { input: 'single', expected: 'Single' },
      { input: 'already-formatted', expected: 'Already Formatted' },
    ];

    testCases.forEach(({ input, expected }) => {
      const formatted = PackageUtils.formatPackageName(input);
      expect(formatted).toBe(expected);
    });
  });
});

describe('Performance and Edge Cases', () => {
  it('should handle rapid package creation', () => {
    const packages = [];
    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      packages.push(PackageUtils.createPackage({
        name: `perf-test-${i}`,
        version: '1.0.0',
      }));
    }

    const endTime = Date.now();

    expect(packages).toHaveLength(1000);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
  });

  it('should handle unusual package names', () => {
    const unusualNames = [
      'package-with-many-hyphens-and-words',
      'p',
      'UPPERCASE-PACKAGE',
      'package123',
    ];

    unusualNames.forEach(name => {
      const pkg = PackageUtils.createPackage({ name, version: '1.0.0' });
      expect(pkg.getName()).toBe(name);
    });
  });

  it('should maintain immutability of config', () => {
    const originalConfig = {
      name: 'immutable-test',
      version: '1.0.0',
      description: 'Original description',
    };

    const pkg = new PackageCore(originalConfig);

    // Modify original config
    originalConfig.description = 'Modified description';

    // Package should maintain original values
    const info = pkg.getInfo();
    expect(info.description).toBe('Original description');
  });
});