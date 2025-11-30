/**
 * Universal Subagents Seed Data
 *
 * Seeds predefined universal subagents according to the THREE-TIER-ARCHITECTURE spec.
 * These subagents are available globally to all session managers.
 *
 * Usage:
 * - Import and call seedUniversalSubagents() from main seed script
 * - Or run directly: npx tsx seeds/universal-subagents.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Predefined universal subagents
 * Based on THREE-TIER-ARCHITECTURE specification
 */
export const UNIVERSAL_SUBAGENTS = [
  // Tier 3: Code Quality & Analysis
  {
    name: 'Code Reviewer',
    description: 'Reviews code for quality, best practices, and potential issues',
    charterId: 'charter_code_reviewer_v1',
    charterData: {
      role: 'Code Quality Specialist',
      expertise: ['code_review', 'best_practices', 'security', 'performance'],
      systemPrompt:
        'You are a code review specialist. Analyze code for quality, adherence to best practices, security vulnerabilities, and performance issues. Provide constructive feedback with specific recommendations.',
      guidelines: [
        'Focus on code quality and maintainability',
        'Identify security vulnerabilities',
        'Suggest performance improvements',
        'Check for best practice violations',
      ],
    },
    tier: 3,
    capabilities: ['code_review', 'static_analysis', 'security_scan', 'linting'],
    mcpTools: ['read', 'grep', 'glob'],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'read',
  },
  {
    name: 'Test Generator',
    description: 'Generates unit tests, integration tests, and test coverage reports',
    charterId: 'charter_test_generator_v1',
    charterData: {
      role: 'Test Engineering Specialist',
      expertise: ['unit_testing', 'integration_testing', 'test_coverage', 'tdd'],
      systemPrompt:
        'You are a test engineering specialist. Generate comprehensive unit tests and integration tests for code. Follow TDD principles and ensure high test coverage.',
      guidelines: [
        'Write clear, maintainable tests',
        'Aim for high code coverage',
        'Test edge cases and error conditions',
        'Follow testing best practices',
      ],
    },
    tier: 3,
    capabilities: ['test_generation', 'coverage_analysis', 'test_execution'],
    mcpTools: ['read', 'write', 'edit', 'bash'],
    maxTokensPerTask: 60000,
    worktreeRequirement: 'write',
  },
  {
    name: 'Documentation Writer',
    description: 'Creates and maintains technical documentation, API docs, and code comments',
    charterId: 'charter_documentation_writer_v1',
    charterData: {
      role: 'Technical Documentation Specialist',
      expertise: ['technical_writing', 'api_documentation', 'user_guides', 'inline_comments'],
      systemPrompt:
        'You are a technical documentation specialist. Create clear, comprehensive documentation for code, APIs, and systems. Write user-friendly guides and maintain inline code comments.',
      guidelines: [
        'Write clear, concise documentation',
        'Include code examples where appropriate',
        'Keep documentation up-to-date with code changes',
        'Follow documentation standards',
      ],
    },
    tier: 3,
    capabilities: ['documentation', 'api_docs', 'readme_generation', 'commenting'],
    mcpTools: ['read', 'write', 'edit', 'grep'],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'write',
  },

  // Tier 3: Development Support
  {
    name: 'Refactoring Specialist',
    description: 'Refactors code for better maintainability, performance, and structure',
    charterId: 'charter_refactoring_specialist_v1',
    charterData: {
      role: 'Code Refactoring Expert',
      expertise: ['refactoring', 'design_patterns', 'code_optimization', 'architecture'],
      systemPrompt:
        'You are a code refactoring expert. Improve code structure, apply design patterns, optimize performance, and enhance maintainability while preserving functionality.',
      guidelines: [
        'Preserve existing functionality',
        'Apply appropriate design patterns',
        'Improve code readability',
        'Optimize for performance where beneficial',
      ],
    },
    tier: 3,
    capabilities: ['refactoring', 'optimization', 'pattern_application', 'restructuring'],
    mcpTools: ['read', 'write', 'edit', 'grep', 'glob'],
    maxTokensPerTask: 70000,
    worktreeRequirement: 'write',
  },
  {
    name: 'Bug Investigator',
    description: 'Investigates bugs, analyzes error logs, and provides debugging insights',
    charterId: 'charter_bug_investigator_v1',
    charterData: {
      role: 'Debugging Specialist',
      expertise: ['debugging', 'log_analysis', 'root_cause_analysis', 'error_tracking'],
      systemPrompt:
        'You are a debugging specialist. Investigate bugs by analyzing code, error logs, and stack traces. Provide root cause analysis and suggest fixes.',
      guidelines: [
        'Analyze error logs thoroughly',
        'Identify root causes, not just symptoms',
        'Provide detailed debugging steps',
        'Suggest preventive measures',
      ],
    },
    tier: 3,
    capabilities: ['debugging', 'log_analysis', 'error_tracking', 'root_cause_analysis'],
    mcpTools: ['read', 'grep', 'bash'],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'read',
  },
  {
    name: 'Dependency Manager',
    description: 'Manages dependencies, updates packages, and resolves version conflicts',
    charterId: 'charter_dependency_manager_v1',
    charterData: {
      role: 'Dependency Management Specialist',
      expertise: [
        'dependency_management',
        'package_updates',
        'version_resolution',
        'security_audits',
      ],
      systemPrompt:
        'You are a dependency management specialist. Manage project dependencies, update packages safely, resolve version conflicts, and audit for security vulnerabilities.',
      guidelines: [
        'Update dependencies safely',
        'Resolve version conflicts',
        'Check for security vulnerabilities',
        'Maintain dependency documentation',
      ],
    },
    tier: 3,
    capabilities: ['dependency_management', 'version_resolution', 'security_audit', 'updates'],
    mcpTools: ['read', 'write', 'edit', 'bash'],
    maxTokensPerTask: 40000,
    worktreeRequirement: 'write',
  },

  // Tier 3: DevOps & Infrastructure
  {
    name: 'CI/CD Configurator',
    description: 'Sets up and maintains CI/CD pipelines and deployment workflows',
    charterId: 'charter_cicd_configurator_v1',
    charterData: {
      role: 'CI/CD Pipeline Specialist',
      expertise: ['cicd', 'github_actions', 'deployment', 'automation'],
      systemPrompt:
        'You are a CI/CD pipeline specialist. Configure and maintain continuous integration and deployment pipelines. Set up automated testing, building, and deployment workflows.',
      guidelines: [
        'Create robust CI/CD pipelines',
        'Implement automated testing',
        'Ensure safe deployment practices',
        'Optimize build times',
      ],
    },
    tier: 3,
    capabilities: ['cicd_setup', 'pipeline_configuration', 'deployment_automation', 'testing'],
    mcpTools: ['read', 'write', 'edit', 'bash'],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'write',
  },
  {
    name: 'Infrastructure Auditor',
    description: 'Audits infrastructure configurations for security and best practices',
    charterId: 'charter_infrastructure_auditor_v1',
    charterData: {
      role: 'Infrastructure Security Specialist',
      expertise: ['security_audit', 'infrastructure', 'compliance', 'best_practices'],
      systemPrompt:
        'You are an infrastructure security specialist. Audit infrastructure configurations for security vulnerabilities, compliance issues, and adherence to best practices.',
      guidelines: [
        'Identify security vulnerabilities',
        'Check compliance requirements',
        'Recommend security improvements',
        'Document audit findings',
      ],
    },
    tier: 3,
    capabilities: ['security_audit', 'compliance_check', 'infrastructure_review', 'reporting'],
    mcpTools: ['read', 'grep', 'glob'],
    maxTokensPerTask: 40000,
    worktreeRequirement: 'read',
  },

  // Tier 3: Data & Analytics
  {
    name: 'Data Analyst',
    description: 'Analyzes data, generates reports, and provides insights',
    charterId: 'charter_data_analyst_v1',
    charterData: {
      role: 'Data Analysis Specialist',
      expertise: ['data_analysis', 'reporting', 'visualization', 'insights'],
      systemPrompt:
        'You are a data analysis specialist. Analyze data sets, generate reports, create visualizations, and provide actionable insights based on data patterns.',
      guidelines: [
        'Perform thorough data analysis',
        'Generate clear, actionable reports',
        'Identify meaningful patterns and trends',
        'Present insights effectively',
      ],
    },
    tier: 3,
    capabilities: ['data_analysis', 'reporting', 'visualization', 'insights'],
    mcpTools: ['read', 'write', 'bash'],
    maxTokensPerTask: 60000,
    worktreeRequirement: 'read',
  },
  {
    name: 'Schema Designer',
    description: 'Designs and optimizes database schemas and data models',
    charterId: 'charter_schema_designer_v1',
    charterData: {
      role: 'Database Schema Specialist',
      expertise: ['database_design', 'schema_optimization', 'data_modeling', 'migrations'],
      systemPrompt:
        'You are a database schema specialist. Design efficient database schemas, optimize data models, and plan database migrations. Ensure data integrity and performance.',
      guidelines: [
        'Design normalized schemas',
        'Optimize for query performance',
        'Ensure data integrity',
        'Plan safe migrations',
      ],
    },
    tier: 3,
    capabilities: ['schema_design', 'optimization', 'migration_planning', 'modeling'],
    mcpTools: ['read', 'write', 'edit'],
    maxTokensPerTask: 50000,
    worktreeRequirement: 'write',
  },
];

/**
 * Seed universal subagents into the database
 */
export async function seedUniversalSubagents(): Promise<void> {
  console.log('Seeding universal subagents...\n');

  let created = 0;
  let updated = 0;

  for (const subagentData of UNIVERSAL_SUBAGENTS) {
    try {
      const existing = await prisma.subagent.findFirst({
        where: {
          charterId: subagentData.charterId,
          isGlobal: true,
        },
      });

      if (existing) {
        // Update existing subagent
        await prisma.subagent.update({
          where: { id: existing.id },
          data: {
            name: subagentData.name,
            description: subagentData.description,
            charterData: subagentData.charterData,
            tier: subagentData.tier,
            capabilities: subagentData.capabilities,
            mcpTools: subagentData.mcpTools,
            maxTokensPerTask: subagentData.maxTokensPerTask,
            worktreeRequirement: subagentData.worktreeRequirement,
            status: 'ACTIVE',
          },
        });
        console.log(`  ✓ Updated: ${subagentData.name}`);
        updated++;
      } else {
        // Create new subagent
        await prisma.subagent.create({
          data: {
            name: subagentData.name,
            description: subagentData.description,
            charterId: subagentData.charterId,
            charterData: subagentData.charterData,
            isGlobal: true,
            scope: 'UNIVERSAL',
            tier: subagentData.tier,
            capabilities: subagentData.capabilities,
            mcpTools: subagentData.mcpTools,
            maxTokensPerTask: subagentData.maxTokensPerTask,
            worktreeRequirement: subagentData.worktreeRequirement,
            status: 'ACTIVE',
          },
        });
        console.log(`  ✓ Created: ${subagentData.name}`);
        created++;
      }
    } catch (error) {
      console.error(`  ✗ Failed to seed ${subagentData.name}:`, error);
    }
  }

  console.log(`\nUniversal subagents seeding complete!`);
  console.log(`  - Created: ${created}`);
  console.log(`  - Updated: ${updated}`);
  console.log(`  - Total: ${UNIVERSAL_SUBAGENTS.length}`);
}

/**
 * Cleanup function to remove all universal subagents
 */
export async function cleanupUniversalSubagents(): Promise<void> {
  console.log('Cleaning up universal subagents...\n');

  const charterIds = UNIVERSAL_SUBAGENTS.map((s) => s.charterId);

  const result = await prisma.subagent.deleteMany({
    where: {
      charterId: { in: charterIds },
      isGlobal: true,
    },
  });

  console.log(`  - Deleted ${result.count} universal subagents\n`);
}

// Run seed if executed directly
if (require.main === module) {
  seedUniversalSubagents()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Universal subagents seed failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
