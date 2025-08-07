# Test Strategy for Environment Setup Hive

## Overview
This document outlines the comprehensive testing strategy for the Wundr Environment Setup Hive, focusing on ensuring reliability across all supported platforms and use cases.

## Test Pyramid Structure

```
         /\
        /E2E\      <- Cross-platform workflows, Docker orchestration
       /------\
      /Integr. \   <- Installation scripts, profile validation
     /----------\
    /   Unit     \ <- Core managers, utils, validators
   /--------------\
```

## Test Categories

### 1. Unit Tests (Target: 80% coverage)

#### Core Managers
```typescript
// environment-manager.test.ts
describe('EnvironmentManager', () => {
  describe('initialize', () => {
    it('should create valid config for human profile', async () => {
      const manager = new EnvironmentManager();
      const config = await manager.initialize('human', {
        email: 'test@example.com',
        fullName: 'Test User'
      });
      
      expect(config.profile).toBe('human');
      expect(config.preferences.email).toBe('test@example.com');
      expect(config.tools).toHaveLength(12); // Based on human profile
    });

    it('should handle invalid profile types', async () => {
      const manager = new EnvironmentManager();
      await expect(
        manager.initialize('invalid' as ProfileType, {})
      ).rejects.toThrow('Invalid profile type');
    });
  });

  describe('validateEnvironment', () => {
    it('should validate all tools successfully', async () => {
      // Mock successful tool validation
      jest.spyOn(toolManager, 'validateTool')
        .mockResolvedValue({ valid: true, tool: 'node' });
      
      const result = await manager.validateEnvironment();
      expect(result.healthy).toBe(true);
    });
  });
});
```

#### System Utilities
```typescript
// system.test.ts
describe('System Detection', () => {
  describe('detectPlatform', () => {
    it('should detect macOS correctly', async () => {
      jest.spyOn(os, 'platform').mockReturnValue('darwin');
      const platform = await detectPlatform();
      expect(platform).toBe('macos');
    });

    it('should detect Linux correctly', async () => {
      jest.spyOn(os, 'platform').mockReturnValue('linux');
      const platform = await detectPlatform();
      expect(platform).toBe('linux');
    });

    it('should throw for unsupported platform', async () => {
      jest.spyOn(os, 'platform').mockReturnValue('freebsd');
      await expect(detectPlatform()).rejects.toThrow('Unsupported platform');
    });
  });

  describe('getSystemInfo', () => {
    it('should return comprehensive system information', async () => {
      const info = await getSystemInfo();
      
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('architecture');
      expect(info).toHaveProperty('nodeVersion');
      expect(info).toHaveProperty('shell');
    });
  });
});
```

#### Validators
```typescript
// environment-validator.test.ts
describe('EnvironmentValidator', () => {
  describe('validateDependencies', () => {
    it('should detect missing dependencies', () => {
      const tools = [
        { name: 'tool-a', dependencies: ['missing-tool'] },
        { name: 'tool-b', dependencies: [] }
      ];
      
      const result = validator.validateDependencies({ tools } as any);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('depends on missing-tool');
    });

    it('should detect circular dependencies', () => {
      const tools = [
        { name: 'tool-a', dependencies: ['tool-b'] },
        { name: 'tool-b', dependencies: ['tool-a'] }
      ];
      
      const result = validator.validateDependencies({ tools } as any);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Circular dependencies detected');
    });
  });
});
```

### 2. Integration Tests

#### Installation Scripts
```typescript
// macos-install.test.ts
describe('macOS Installation', () => {
  let container: TestContainer;

  beforeEach(async () => {
    container = await TestContainer.start('macos-test-image');
  });

  afterEach(async () => {
    await container.stop();
  });

  it('should install all required tools successfully', async () => {
    const result = await container.exec('bash ./scripts/install/macos.sh');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('installation completed');
    
    // Verify tools are installed
    const nodeVersion = await container.exec('node --version');
    expect(nodeVersion.stdout).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('should handle missing Homebrew gracefully', async () => {
    // Remove brew from PATH
    await container.exec('export PATH=${PATH//brew/}');
    
    const result = await container.exec('bash ./scripts/install/macos.sh');
    expect(result.stdout).toContain('Installing Homebrew');
  });
});
```

#### Profile Validation
```typescript
// profile-validation.test.ts
describe('Profile Validation', () => {
  test.each(['human', 'ai-agent', 'ci-runner'])('should validate %s profile', async (profile) => {
    const manager = new ProfileManager();
    const template = await manager.getProfileTemplate(profile as ProfileType);
    
    expect(template).toBeDefined();
    expect(template.tools.length).toBeGreaterThan(0);
    expect(template.preferences).toBeDefined();
    
    // Validate dependencies
    const validator = new EnvironmentValidator();
    const result = validator.validateDependencies({ tools: template.tools } as any);
    expect(result.valid).toBe(true);
  });
});
```

### 3. End-to-End Tests

#### Complete Workflow
```typescript
// full-setup.test.ts
describe('Full Environment Setup', () => {
  it('should complete human developer setup', async () => {
    const manager = new EnvironmentManager();
    
    // Initialize environment
    const config = await manager.initialize('human', {
      email: 'test@example.com',
      fullName: 'Test Developer',
      skipPrompts: true
    });
    
    // Install environment
    await manager.installEnvironment();
    
    // Validate installation
    const health = await manager.validateEnvironment();
    expect(health.healthy).toBe(true);
    
    // Verify specific tools
    expect(health.tools.find(t => t.tool === 'node')?.valid).toBe(true);
    expect(health.tools.find(t => t.tool === 'vscode')?.valid).toBe(true);
  });

  it('should setup AI agent environment with swarm capabilities', async () => {
    const manager = new EnvironmentManager();
    
    const config = await manager.initialize('ai-agent', {
      skipPrompts: true
    });
    
    expect(config.tools.find(t => t.name === 'claude-flow')).toBeDefined();
    expect(config.tools.find(t => t.name === 'claude-code')).toBeDefined();
    
    await manager.installEnvironment();
    
    // Verify AI-specific configuration
    const health = await manager.validateEnvironment();
    const claudeFlow = health.tools.find(t => t.tool === 'claude-flow');
    expect(claudeFlow?.valid).toBe(true);
  });
});
```

#### Docker Orchestration
```typescript
// docker-setup.test.ts
describe('Docker Environment Setup', () => {
  it('should start all services successfully', async () => {
    const compose = new DockerCompose('./templates/docker');
    
    await compose.up(['human-dev', 'ai-agent', 'postgres', 'redis']);
    
    // Wait for services to be ready
    await waitForPort(8080); // VS Code Server
    await waitForPort(3100); // Claude Flow
    await waitForPort(5432); // PostgreSQL
    
    // Verify service health
    const humanDev = await compose.getService('human-dev');
    expect(humanDev.status).toBe('running');
    
    const aiAgent = await compose.getService('ai-agent');
    expect(aiAgent.status).toBe('running');
  });
});
```

## Platform-Specific Testing

### macOS Testing
```bash
# .github/workflows/macos-test.yml
name: macOS Tests
on: [push, pull_request]

jobs:
  test-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test macOS Installation
        run: |
          export SETUP_FULL_NAME="Test User"
          export SETUP_EMAIL="test@example.com"
          bash ./scripts/install/macos.sh
          
      - name: Verify Installation
        run: |
          node --version
          npm --version
          git --version
          code --version
```

### Linux Testing
```bash
# Test matrix for different distributions
strategy:
  matrix:
    os: [ubuntu-20.04, ubuntu-22.04, fedora:latest, centos:8]
    
steps:
  - name: Test Linux Installation
    run: |
      docker run --rm -v $(pwd):/workspace ${{ matrix.os }} \
        bash /workspace/scripts/install/linux.sh
```

### Windows Testing
```powershell
# windows-test.yml
- name: Test Windows Installation
  shell: powershell
  run: |
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    $env:SETUP_FULL_NAME = "Test User"
    $env:SETUP_EMAIL = "test@example.com"
    .\scripts\install\windows.ps1 -SkipPrompts
```

## Performance Testing

### Installation Benchmarks
```typescript
// performance.test.ts
describe('Performance Benchmarks', () => {
  it('should complete macOS installation under 10 minutes', async () => {
    const startTime = Date.now();
    
    await runInstallation('macos');
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10 * 60 * 1000); // 10 minutes
  });
  
  it('should validate environment under 30 seconds', async () => {
    const manager = new EnvironmentManager();
    await manager.loadConfig();
    
    const startTime = Date.now();
    await manager.validateEnvironment();
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(30 * 1000); // 30 seconds
  });
});
```

## Error Scenario Testing

### Network Failures
```typescript
// error-scenarios.test.ts
describe('Error Recovery', () => {
  it('should retry failed downloads', async () => {
    // Mock network failure then success
    jest.spyOn(https, 'get')
      .mockImplementationOnce(() => { throw new Error('Network error'); })
      .mockImplementationOnce(() => ({ statusCode: 200 }));
    
    const installer = new BrewInstaller();
    await expect(installer.install('git')).resolves.not.toThrow();
  });
  
  it('should rollback partial installation on failure', async () => {
    const manager = new EnvironmentManager();
    
    // Mock tool installation failure
    jest.spyOn(manager['toolManager'], 'installTool')
      .mockRejectedValueOnce(new Error('Installation failed'));
    
    await expect(manager.installEnvironment()).rejects.toThrow();
    
    // Verify rollback occurred
    const health = await manager.validateEnvironment();
    expect(health.tools.every(t => !t.valid)).toBe(true);
  });
});
```

## Test Data Management

### Mock Profiles
```typescript
// test-fixtures.ts
export const mockProfiles = {
  minimal: {
    name: 'Minimal Test',
    profile: 'human',
    tools: [
      { name: 'node', required: true, installer: 'brew' },
      { name: 'git', required: true, installer: 'brew' }
    ],
    preferences: { editor: 'vim', shell: 'bash' }
  },
  
  complex: {
    name: 'Complex Test',
    profile: 'ai-agent',
    tools: [
      // ... full tool list
    ]
  }
};
```

### Test Containers
```dockerfile
# test-images/Dockerfile.macos-test
FROM sickcodes/docker-osx:monterey
RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
WORKDIR /workspace
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/comprehensive-test.yml
name: Comprehensive Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:coverage
      
  integration-tests:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      - run: npm run test:integration:${{ matrix.platform }}
      
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/checkout@v3
      - run: npm run test:e2e
```

## Quality Gates

### Coverage Requirements
- **Unit Tests**: 80% minimum coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Happy path + error scenarios

### Performance Requirements
- **Installation Time**: < 10 minutes per platform
- **Validation Time**: < 30 seconds
- **Memory Usage**: < 512MB during installation

### Reliability Requirements
- **Success Rate**: > 95% in CI environment
- **Retry Success**: > 85% after first retry
- **Error Recovery**: 100% rollback success

## Test Execution Strategy

### Local Development
```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run platform-specific tests
npm run test:macos
npm run test:linux
npm run test:windows
npm run test:docker
```

### CI Environment
```bash
# Parallel execution
npm run test:parallel

# Platform matrix
npm run test:matrix

# Performance benchmarks
npm run test:performance
```

This comprehensive test strategy ensures the Environment Setup Hive maintains high quality and reliability across all supported platforms and use cases.