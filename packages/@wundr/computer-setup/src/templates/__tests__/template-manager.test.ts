import * as path from 'path';

import * as fs from 'fs-extra';

import { TemplateManager } from '../template-manager.js';

import type { DeveloperProfile } from '../../types/index.js';
import type { TemplateContext } from '../template-manager.js';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let testContext: TemplateContext;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-test-'));
    templateManager = new TemplateManager();

    const mockProfile: DeveloperProfile = {
      name: 'Test Developer',
      email: 'test@example.com',
      role: 'Software Engineer',
      team: 'Engineering',
      preferences: {
        shell: 'zsh',
        editor: 'vscode',
        theme: 'dark',
        gitConfig: {
          userName: 'Test Developer',
          userEmail: 'test@example.com',
          signCommits: false,
          defaultBranch: 'main',
          aliases: {},
        },
        aiTools: {
          claudeCode: true,
          claudeFlow: true,
          mcpTools: [],
          swarmAgents: [],
          memoryAllocation: '4GB',
        },
      },
      tools: {
        packageManagers: { npm: true, pnpm: true },
        containers: { docker: true, dockerCompose: true },
        databases: { postgresql: true, redis: true },
      },
    };

    testContext = {
      profile: mockProfile,
      project: {
        name: 'test-project',
        description: 'A test project',
        version: '1.0.0',
        type: 'node',
        packageManager: 'pnpm',
        license: 'MIT',
        author: 'Test Developer',
      },
      platform: {
        os: 'darwin',
        arch: 'x64',
        nodeVersion: '20.0.0',
        shell: 'zsh',
      },
      customVariables: {
        TEST_VAR: 'test-value',
        ENABLE_FEATURE: true,
        ITEMS: ['item1', 'item2', 'item3'],
      },
    };
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('variable replacement', () => {
    test('should replace simple variables', () => {
      const content = 'Project: {{PROJECT_NAME}}, Author: {{AUTHOR}}';
      const result = templateManager['replaceVariables'](content, testContext);
      expect(result).toBe('Project: test-project, Author: Test Developer');
    });

    test('should handle missing variables gracefully', () => {
      const content = 'Project: {{PROJECT_NAME}}, Missing: {{MISSING_VAR}}';
      const result = templateManager['replaceVariables'](content, testContext);
      expect(result).toBe('Project: test-project, Missing: {{MISSING_VAR}}');
    });

    test('should process conditional blocks', () => {
      const content =
        '{{#ENABLE_FEATURE}}Feature is enabled{{/ENABLE_FEATURE}}{{#DISABLE_FEATURE}}Feature is disabled{{/DISABLE_FEATURE}}';
      const result = templateManager['replaceVariables'](content, testContext);
      expect(result).toBe('Feature is enabled');
    });

    test('should process array iterations', () => {
      const content = '{{#ITEMS}}Item: {{.}}, {{/ITEMS}}';
      const result = templateManager['replaceVariables'](content, testContext);
      expect(result).toBe('Item: item1, Item: item2, Item: item3, ');
    });
  });

  describe('template listing', () => {
    test('should list available templates', async () => {
      const templates = await templateManager.listTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      // Check for expected template categories
      const hasDockerTemplate = templates.some(t => t.includes('docker'));
      const hasGithubTemplate = templates.some(t => t.includes('github'));
      const hasConfigTemplate = templates.some(t => t.includes('config'));

      expect(hasDockerTemplate).toBe(true);
      expect(hasGithubTemplate).toBe(true);
      expect(hasConfigTemplate).toBe(true);
    });
  });

  describe('variable building', () => {
    test('should build comprehensive variable map', () => {
      const variables = templateManager['buildVariableMap'](testContext);

      // Check project variables
      expect(variables.PROJECT_NAME).toBe('test-project');
      expect(variables.PROJECT_DESCRIPTION).toBe('A test project');
      expect(variables.PACKAGE_MANAGER).toBe('pnpm');

      // Check profile variables
      expect(variables.DEVELOPER_NAME).toBe('Test Developer');
      expect(variables.DEVELOPER_EMAIL).toBe('test@example.com');
      expect(variables.ROLE).toBe('Software Engineer');

      // Check platform variables
      expect(variables.OS).toBe('darwin');
      expect(variables.NODE_VERSION).toBe('20.0.0');

      // Check custom variables
      expect(variables.TEST_VAR).toBe('test-value');
      expect(variables.ENABLE_FEATURE).toBe(true);

      // Check computed variables
      expect(variables.INCLUDE_POSTGRES).toBe(true);
      expect(variables.INCLUDE_REDIS).toBe(true);
    });
  });

  describe('truthiness evaluation', () => {
    test('should correctly evaluate truthy values', () => {
      expect(templateManager['isTruthy'](true)).toBe(true);
      expect(templateManager['isTruthy'](1)).toBe(true);
      expect(templateManager['isTruthy']('text')).toBe(true);
      expect(templateManager['isTruthy']([1, 2, 3])).toBe(true);
      expect(templateManager['isTruthy']({ key: 'value' })).toBe(true);
    });

    test('should correctly evaluate falsy values', () => {
      expect(templateManager['isTruthy'](false)).toBe(false);
      expect(templateManager['isTruthy'](0)).toBe(false);
      expect(templateManager['isTruthy']('')).toBe(false);
      expect(templateManager['isTruthy']([])).toBe(false);
      expect(templateManager['isTruthy']({})).toBe(false);
      expect(templateManager['isTruthy'](null)).toBe(false);
      expect(templateManager['isTruthy'](undefined)).toBe(false);
    });
  });
});

describe('Integration with project setup', () => {
  test('should integrate template manager with setup process', () => {
    // This test verifies that the template manager is properly exported
    // and can be imported from the main package
    expect(TemplateManager).toBeDefined();
    expect(typeof TemplateManager).toBe('function');
  });
});
