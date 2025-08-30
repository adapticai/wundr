import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { ProjectDetector } from './project-detector.js';
import { QualityAnalyzer } from './quality-analyzer.js';
import { RepositoryAuditor } from './repository-auditor.js';
import { TemplateEngine } from './template-engine.js';
import type { 
  ClaudeConfig, 
  TemplateContext, 
  ProjectMetadata, 
  PackageJsonData,
  AgentConfiguration,
  MCPToolConfig
} from './types.js';

export class ClaudeConfigGenerator {
  private rootPath: string;
  private detector: ProjectDetector;
  private qualityAnalyzer: QualityAnalyzer;
  private auditor: RepositoryAuditor;
  private templateEngine: TemplateEngine;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
    this.detector = new ProjectDetector(this.rootPath);
    this.qualityAnalyzer = new QualityAnalyzer(this.rootPath);
    this.auditor = new RepositoryAuditor(this.rootPath);
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate complete Claude configuration for the project
   */
  async generateConfig(): Promise<ClaudeConfig> {
    // Analyze project
    const projectType = await this.detector.detectProjectType();
    const structure = await this.detector.analyzeStructure();
    
    // Get package.json data
    const packageData = await this.getPackageJsonData();
    const projectMetadata = this.extractProjectMetadata(packageData);

    // Analyze quality standards
    const qualityStandards = await this.qualityAnalyzer.analyzeQualityStandards(
      packageData, 
      structure
    );

    // Configure agents based on project type
    const agentConfiguration = this.configureAgents(projectType, structure);

    // Configure MCP tools
    const mcpTools = this.configureMCPTools(projectType, structure);

    const config: ClaudeConfig = {
      projectMetadata,
      projectType,
      projectStructure: structure,
      qualityStandards,
      agentConfiguration,
      mcpTools
    };

    return config;
  }

  /**
   * Generate CLAUDE.md content from configuration
   */
  async generateClaudeMarkdown(): Promise<string> {
    const config = await this.generateConfig();
    const packageData = await this.getPackageJsonData();
    
    // Create template context
    const context: TemplateContext = {
      project: config.projectMetadata,
      type: config.projectType,
      structure: config.projectStructure,
      quality: config.qualityStandards,
      agents: config.agentConfiguration,
      mcp: config.mcpTools,
      buildCommands: this.extractBuildCommands(packageData),
      testCommands: this.extractTestCommands(packageData),
      lintCommands: this.extractLintCommands(packageData),
      customCommands: this.extractCustomCommands(packageData)
    };

    return this.templateEngine.generateClaudeConfig(context);
  }

  /**
   * Audit repository and provide recommendations
   */
  async auditRepository() {
    const structure = await this.detector.analyzeStructure();
    const packageData = await this.getPackageJsonData();
    const qualityStandards = await this.qualityAnalyzer.analyzeQualityStandards(
      packageData, 
      structure
    );

    return this.auditor.auditRepository(structure, qualityStandards, packageData);
  }

  private async getPackageJsonData(): Promise<PackageJsonData | null> {
    const packagePath = join(this.rootPath, 'package.json');
    try {
      const content = readFileSync(packagePath, 'utf-8');
      return JSON.parse(content) as PackageJsonData;
    } catch {
      return null;
    }
  }

  private extractProjectMetadata(packageData: PackageJsonData | null): ProjectMetadata {
    if (!packageData) {
      return {
        name: 'Unknown Project',
        description: 'No package.json found',
        version: '0.0.0'
      };
    }

    return {
      name: packageData.name,
      description: packageData.description || 'No description provided',
      version: packageData.version,
      author: packageData.author,
      license: packageData.license,
      homepage: packageData.homepage,
      repository: packageData.repository,
      keywords: packageData.keywords,
      engines: packageData.engines,
      packageManager: packageData.packageManager
    };
  }

  private configureAgents(projectType: string, structure: any): AgentConfiguration {
    const baseAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];
    
    const specializedAgents: Record<string, string[]> = {
      'monorepo': [
        'package-coordinator',
        'build-orchestrator', 
        'version-manager',
        'dependency-analyzer'
      ],
      'react': [
        'ui-designer',
        'component-architect', 
        'accessibility-tester',
        'performance-optimizer'
      ],
      'nextjs': [
        'ui-designer',
        'ssr-specialist',
        'performance-optimizer',
        'seo-analyzer'
      ],
      'nodejs': [
        'api-designer',
        'security-auditor',
        'performance-optimizer',
        'database-architect'
      ],
      'cli': [
        'ux-designer',
        'help-writer',
        'integration-tester',
        'platform-tester'
      ],
      'library': [
        'api-designer',
        'documentation-writer',
        'compatibility-tester',
        'version-manager'
      ],
      'full-stack': [
        'api-designer',
        'ui-designer',
        'integration-tester',
        'security-auditor'
      ]
    };

    const projectSpecificAgents = specializedAgents[projectType] || [];
    
    // Determine optimal topology based on project complexity
    let topology: 'mesh' | 'hierarchical' | 'adaptive' = 'mesh';
    let maxAgents = 6;

    if (projectType === 'monorepo') {
      topology = 'hierarchical';
      maxAgents = 12;
    } else if (projectType === 'full-stack') {
      topology = 'adaptive';
      maxAgents = 10;
    }

    return {
      agents: [...baseAgents, ...projectSpecificAgents],
      swarmTopology: topology,
      maxAgents,
      specializedAgents: {
        [projectType]: projectSpecificAgents
      }
    };
  }

  private configureMCPTools(projectType: string, structure: any): MCPToolConfig {
    const commonTools = [
      {
        name: 'drift_detection',
        description: 'Monitor code quality drift and detect regressions',
        config: {
          enabled: true,
          checkInterval: '1d',
          thresholds: {
            complexity: 10,
            duplication: 5
          }
        }
      },
      {
        name: 'pattern_standardize',
        description: 'Automatically standardize code patterns across the codebase',
        config: {
          enabled: true,
          patterns: ['error-handling', 'import-ordering', 'naming-conventions']
        }
      },
      {
        name: 'dependency_analyze',
        description: 'Analyze and optimize project dependencies',
        config: {
          enabled: true,
          checkCircular: true,
          findUnused: true,
          securityScan: true
        }
      },
      {
        name: 'test_baseline',
        description: 'Manage test coverage baselines and quality metrics',
        config: {
          enabled: structure.hasTests,
          coverageThreshold: 80,
          trackRegression: true
        }
      }
    ];

    // Add project-specific tools
    const projectSpecificTools = [];

    if (projectType === 'monorepo') {
      projectSpecificTools.push({
        name: 'monorepo_manage',
        description: 'Specialized monorepo management and coordination',
        config: {
          enabled: true,
          packageAnalysis: true,
          buildOptimization: true
        }
      });
    }

    if (['react', 'nextjs', 'full-stack'].includes(projectType)) {
      projectSpecificTools.push({
        name: 'ui_analyzer',
        description: 'Analyze UI components for accessibility and performance',
        config: {
          enabled: true,
          accessibilityCheck: true,
          performanceMetrics: true
        }
      });
    }

    return {
      enabled: true,
      tools: [...commonTools, ...projectSpecificTools],
      autoConfiguration: true
    };
  }

  private extractBuildCommands(packageData: PackageJsonData | null): string[] {
    if (!packageData?.scripts) return [];
    
    const buildScripts = Object.keys(packageData.scripts).filter(script =>
      script.includes('build') || script.includes('compile')
    );

    return buildScripts.map(script => `npm run ${script}`);
  }

  private extractTestCommands(packageData: PackageJsonData | null): string[] {
    if (!packageData?.scripts) return [];
    
    const testScripts = Object.keys(packageData.scripts).filter(script =>
      script.includes('test') || script.includes('spec')
    );

    return testScripts.map(script => `npm run ${script}`);
  }

  private extractLintCommands(packageData: PackageJsonData | null): string[] {
    if (!packageData?.scripts) return [];
    
    const lintScripts = Object.keys(packageData.scripts).filter(script =>
      script.includes('lint') || script.includes('format') || script.includes('typecheck')
    );

    return lintScripts.map(script => `npm run ${script}`);
  }

  private extractCustomCommands(packageData: PackageJsonData | null): string[] {
    if (!packageData?.scripts) return [];
    
    const standardScripts = new Set([
      'start', 'build', 'test', 'lint', 'format', 'typecheck',
      'dev', 'serve', 'watch', 'clean', 'install', 'update'
    ]);

    const customScripts = Object.keys(packageData.scripts).filter(script => {
      return !standardScripts.has(script) && 
             !script.includes('build') &&
             !script.includes('test') &&
             !script.includes('lint') &&
             !script.includes('format');
    });

    return customScripts.map(script => `npm run ${script}`);
  }
}