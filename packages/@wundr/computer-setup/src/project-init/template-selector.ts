import chalk from 'chalk';
import inquirer from 'inquirer';

import { Logger } from '../utils/logger.js';

const logger = new Logger({ name: 'template-selector' });

export interface TemplateSelectionCriteria {
  projectType: string;
  framework?: string;
  features?: string[];
  scale?: 'small' | 'medium' | 'large' | 'enterprise';
  teamSize?: number;
  useTypeScript?: boolean;
  useTesting?: boolean;
  useCI?: boolean;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  projectTypes: string[];
  frameworks: string[];
  features: string[];
  agents: string[];
  workflows: string[];
  conventions: string[];
  complexity: 'basic' | 'intermediate' | 'advanced' | 'enterprise';
  requirements: {
    nodeVersion?: string;
    packageManager?: string[];
    tools?: string[];
  };
}

/**
 * Template selection logic based on project characteristics
 */
export class TemplateSelector {
  private templates: Map<string, TemplateMetadata>;

  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Select appropriate templates based on criteria
   */
  async selectTemplates(
    criteria: TemplateSelectionCriteria
  ): Promise<TemplateMetadata[]> {
    const matchedTemplates: TemplateMetadata[] = [];

    for (const template of this.templates.values()) {
      const score = this.calculateMatchScore(template, criteria);
      if (score > 0.5) {
        matchedTemplates.push(template);
      }
    }

    // Sort by relevance
    return matchedTemplates.sort((a, b) => {
      const scoreA = this.calculateMatchScore(a, criteria);
      const scoreB = this.calculateMatchScore(b, criteria);
      return scoreB - scoreA;
    });
  }

  /**
   * Interactive template selection
   */
  async interactiveSelection(): Promise<TemplateMetadata> {
    logger.info(chalk.blue.bold('\n Template Selection Wizard\n'));

    // Gather project information
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectType',
        message: 'What type of project are you building?',
        choices: [
          { name: 'Node.js Backend API', value: 'node' },
          { name: 'React Frontend', value: 'react' },
          { name: 'Next.js Full-stack', value: 'nextjs' },
          { name: 'Vue.js Frontend', value: 'vue' },
          { name: 'Python Application', value: 'python' },
          { name: 'Go Service', value: 'go' },
          { name: 'Rust Application', value: 'rust' },
          { name: 'Monorepo/Workspace', value: 'monorepo' },
        ],
      },
      {
        type: 'list',
        name: 'scale',
        message: 'What is the expected scale?',
        choices: [
          { name: 'Small (Prototype/POC)', value: 'small' },
          { name: 'Medium (Production-ready)', value: 'medium' },
          { name: 'Large (Scalable system)', value: 'large' },
          { name: 'Enterprise (Multi-team)', value: 'enterprise' },
        ],
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'TypeScript', value: 'typescript' },
          { name: 'Testing Framework', value: 'testing' },
          { name: 'CI/CD Pipeline', value: 'cicd' },
          { name: 'Docker Support', value: 'docker' },
          { name: 'API Documentation', value: 'api-docs' },
          { name: 'Monitoring & Logging', value: 'monitoring' },
          { name: 'Authentication', value: 'auth' },
          { name: 'Database Integration', value: 'database' },
        ],
      },
      {
        type: 'number',
        name: 'teamSize',
        message: 'Expected team size:',
        default: 1,
      },
    ]);

    const criteria: TemplateSelectionCriteria = {
      projectType: answers.projectType,
      scale: answers.scale,
      features: answers.features,
      teamSize: answers.teamSize,
      useTypeScript: answers.features.includes('typescript'),
      useTesting: answers.features.includes('testing'),
      useCI: answers.features.includes('cicd'),
    };

    // Select best matching template
    const templates = await this.selectTemplates(criteria);

    if (templates.length === 0) {
      logger.warn(chalk.yellow('No exact match found, using default template'));
      return this.getDefaultTemplate();
    }

    if (templates.length === 1) {
      logger.info(chalk.green(`\nSelected template: ${templates[0].name}`));
      return templates[0];
    }

    // Let user choose from matched templates
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Multiple templates match your criteria. Select one:',
        choices: templates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id,
        })),
      },
    ]);

    return this.templates.get(selectedTemplate)!;
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): TemplateMetadata | undefined {
    return this.templates.get(id);
  }

  /**
   * List all available templates
   */
  listTemplates(): TemplateMetadata[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates for specific project type
   */
  getTemplatesForType(projectType: string): TemplateMetadata[] {
    return Array.from(this.templates.values()).filter(t =>
      t.projectTypes.includes(projectType)
    );
  }

  /**
   * Calculate match score between template and criteria
   */
  private calculateMatchScore(
    template: TemplateMetadata,
    criteria: TemplateSelectionCriteria
  ): number {
    let score = 0;
    let maxScore = 0;

    // Project type match (40% weight)
    maxScore += 4;
    if (template.projectTypes.includes(criteria.projectType)) {
      score += 4;
    }

    // Scale/complexity match (20% weight)
    maxScore += 2;
    const complexityMap = {
      small: 'basic',
      medium: 'intermediate',
      large: 'advanced',
      enterprise: 'enterprise',
    };
    if (
      criteria.scale &&
      template.complexity === complexityMap[criteria.scale]
    ) {
      score += 2;
    }

    // Features match (30% weight)
    maxScore += 3;
    if (criteria.features) {
      const matchingFeatures = criteria.features.filter(f =>
        template.features.includes(f)
      );
      score += (matchingFeatures.length / criteria.features.length) * 3;
    }

    // Team size appropriateness (10% weight)
    maxScore += 1;
    if (criteria.teamSize) {
      if (criteria.teamSize === 1 && template.complexity === 'basic') {
        score += 1;
      } else if (
        criteria.teamSize <= 5 &&
        template.complexity === 'intermediate'
      ) {
        score += 1;
      } else if (
        criteria.teamSize <= 20 &&
        template.complexity === 'advanced'
      ) {
        score += 1;
      } else if (
        criteria.teamSize > 20 &&
        template.complexity === 'enterprise'
      ) {
        score += 1;
      }
    }

    return score / maxScore;
  }

  /**
   * Initialize available templates
   */
  private initializeTemplates(): void {
    // Basic Node.js template
    this.templates.set('node-basic', {
      id: 'node-basic',
      name: 'Basic Node.js',
      description: 'Simple Node.js project with essential setup',
      projectTypes: ['node'],
      frameworks: ['express'],
      features: ['typescript', 'testing'],
      agents: ['coder', 'reviewer', 'tester', 'backend-dev'],
      workflows: ['tdd', 'review'],
      conventions: ['code-style', 'git-workflow', 'testing-standards'],
      complexity: 'basic',
      requirements: {
        nodeVersion: '>=18.0.0',
        packageManager: ['npm', 'pnpm', 'yarn'],
      },
    });

    // React frontend template
    this.templates.set('react-frontend', {
      id: 'react-frontend',
      name: 'React Frontend',
      description: 'Modern React application with best practices',
      projectTypes: ['react'],
      frameworks: ['react', 'vite'],
      features: ['typescript', 'testing', 'cicd', 'docker'],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'mobile-dev',
        'frontend-architect',
      ],
      workflows: ['tdd', 'review', 'deployment'],
      conventions: [
        'code-style',
        'component-structure',
        'git-workflow',
        'testing-standards',
      ],
      complexity: 'intermediate',
      requirements: {
        nodeVersion: '>=18.0.0',
        packageManager: ['pnpm', 'yarn'],
      },
    });

    // Next.js full-stack template
    this.templates.set('nextjs-fullstack', {
      id: 'nextjs-fullstack',
      name: 'Next.js Full-stack',
      description: 'Complete Next.js application with backend and frontend',
      projectTypes: ['nextjs', 'react', 'node'],
      frameworks: ['nextjs', 'react'],
      features: [
        'typescript',
        'testing',
        'cicd',
        'docker',
        'api-docs',
        'auth',
        'database',
      ],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'backend-dev',
        'mobile-dev',
        'system-architect',
      ],
      workflows: ['sparc', 'tdd', 'review', 'deployment'],
      conventions: [
        'code-style',
        'api-design',
        'component-structure',
        'git-workflow',
        'testing-standards',
        'documentation',
      ],
      complexity: 'advanced',
      requirements: {
        nodeVersion: '>=18.0.0',
        packageManager: ['pnpm'],
      },
    });

    // Monorepo template
    this.templates.set('monorepo-workspace', {
      id: 'monorepo-workspace',
      name: 'Monorepo Workspace',
      description: 'Multi-package monorepo with shared tooling',
      projectTypes: ['monorepo'],
      frameworks: ['turborepo', 'nx'],
      features: [
        'typescript',
        'testing',
        'cicd',
        'docker',
        'monitoring',
        'api-docs',
      ],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'researcher',
        'repo-architect',
        'sync-coordinator',
        'multi-repo-swarm',
        'system-architect',
        'cicd-engineer',
      ],
      workflows: ['sparc', 'tdd', 'review', 'deployment', 'release'],
      conventions: [
        'code-style',
        'monorepo-structure',
        'package-naming',
        'git-workflow',
        'testing-standards',
        'versioning',
        'documentation',
      ],
      complexity: 'enterprise',
      requirements: {
        nodeVersion: '>=18.0.0',
        packageManager: ['pnpm'],
        tools: ['turborepo', 'changesets'],
      },
    });

    // Python application template
    this.templates.set('python-app', {
      id: 'python-app',
      name: 'Python Application',
      description: 'Python project with modern tooling',
      projectTypes: ['python'],
      frameworks: ['fastapi', 'flask'],
      features: ['testing', 'cicd', 'docker', 'api-docs'],
      agents: ['coder', 'reviewer', 'tester', 'backend-dev', 'ml-developer'],
      workflows: ['tdd', 'review'],
      conventions: ['code-style', 'git-workflow', 'testing-standards'],
      complexity: 'intermediate',
      requirements: {
        tools: ['poetry', 'pytest'],
      },
    });

    // Go microservice template
    this.templates.set('go-microservice', {
      id: 'go-microservice',
      name: 'Go Microservice',
      description: 'Go-based microservice with cloud-native patterns',
      projectTypes: ['go'],
      frameworks: ['gin', 'chi'],
      features: ['testing', 'cicd', 'docker', 'monitoring', 'api-docs'],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'backend-dev',
        'microservices-architect',
      ],
      workflows: ['tdd', 'review', 'deployment'],
      conventions: [
        'code-style',
        'package-structure',
        'git-workflow',
        'testing-standards',
        'api-design',
      ],
      complexity: 'advanced',
      requirements: {
        tools: ['go', 'docker', 'kubernetes'],
      },
    });

    // Rust application template
    this.templates.set('rust-app', {
      id: 'rust-app',
      name: 'Rust Application',
      description: 'High-performance Rust application',
      projectTypes: ['rust'],
      frameworks: ['actix-web', 'tokio'],
      features: ['testing', 'cicd', 'docker'],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'systems-architect',
        'performance-engineer',
      ],
      workflows: ['tdd', 'review'],
      conventions: [
        'code-style',
        'cargo-structure',
        'git-workflow',
        'testing-standards',
      ],
      complexity: 'advanced',
      requirements: {
        tools: ['cargo', 'rustc'],
      },
    });

    // Enterprise backend template
    this.templates.set('enterprise-backend', {
      id: 'enterprise-backend',
      name: 'Enterprise Backend',
      description: 'Enterprise-grade backend with full observability',
      projectTypes: ['node', 'java'],
      frameworks: ['nestjs', 'spring-boot'],
      features: [
        'typescript',
        'testing',
        'cicd',
        'docker',
        'monitoring',
        'api-docs',
        'auth',
        'database',
      ],
      agents: [
        'coder',
        'reviewer',
        'tester',
        'planner',
        'backend-dev',
        'api-docs',
        'system-architect',
        'cicd-engineer',
        'security-manager',
        'performance-benchmarker',
      ],
      workflows: ['sparc', 'tdd', 'review', 'deployment', 'release'],
      conventions: [
        'code-style',
        'api-design',
        'service-architecture',
        'git-workflow',
        'testing-standards',
        'security',
        'documentation',
        'deployment',
      ],
      complexity: 'enterprise',
      requirements: {
        nodeVersion: '>=18.0.0',
        packageManager: ['pnpm'],
        tools: ['docker', 'kubernetes', 'terraform'],
      },
    });
  }

  /**
   * Get default template for unknown project types
   */
  private getDefaultTemplate(): TemplateMetadata {
    return {
      id: 'default',
      name: 'Default Template',
      description: 'Basic project setup with core features',
      projectTypes: ['*'],
      frameworks: [],
      features: ['testing'],
      agents: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
      workflows: ['tdd', 'review'],
      conventions: ['code-style', 'git-workflow', 'testing-standards'],
      complexity: 'basic',
      requirements: {},
    };
  }

  /**
   * Validate template requirements against current environment
   */
  async validateTemplateRequirements(
    template: TemplateMetadata
  ): Promise<boolean> {
    const issues: string[] = [];

    // Check Node version if required
    if (template.requirements.nodeVersion) {
      const currentVersion = process.version;
      // Simple version check (could be enhanced)
      if (
        !this.satisfiesVersion(
          currentVersion,
          template.requirements.nodeVersion
        )
      ) {
        issues.push(
          `Node.js version ${template.requirements.nodeVersion} required, found ${currentVersion}`
        );
      }
    }

    // Check required tools
    if (template.requirements.tools) {
      for (const tool of template.requirements.tools) {
        if (!(await this.isToolAvailable(tool))) {
          issues.push(`Required tool not found: ${tool}`);
        }
      }
    }

    // Display issues
    if (issues.length > 0) {
      logger.warn(chalk.yellow('\n Template requirement issues:'));
      issues.forEach(issue => logger.warn(chalk.yellow(`  - ${issue}`)));

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continue anyway?',
          default: false,
        },
      ]);

      return proceed;
    }

    return true;
  }

  /**
   * Simple version satisfaction check
   */
  private satisfiesVersion(current: string, required: string): boolean {
    // Remove 'v' prefix and '>=' prefix
    const currentNum = parseInt(current.replace('v', '').split('.')[0]);
    const requiredNum = parseInt(required.replace('>=', '').split('.')[0]);
    return currentNum >= requiredNum;
  }

  /**
   * Check if a tool is available
   */
  private async isToolAvailable(tool: string): Promise<boolean> {
    try {
      const childProcess = await import('child_process');
      childProcess.execSync(`which ${tool}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export default TemplateSelector;
