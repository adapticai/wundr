/**
 * @fileoverview Human Resources Discipline Template
 * @module @wundr/org-genesis/templates/disciplines/hr
 *
 * Defines standard HR roles, capabilities, and organizational structure
 * for human resources operations. This discipline pack provides
 * talent acquisition, candidate screening, onboarding, and people operations capabilities.
 *
 * @example
 * ```typescript
 * import { HR_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/hr.js';
 *
 * // Use in organization configuration
 * const org = await engine.createOrganization({
 *   name: 'Acme Corp',
 *   disciplines: [HR_DISCIPLINE],
 * });
 * ```
 */

import type { DisciplinePack, MCPServerConfig, HookConfig, ClaudeMdConfig } from '../../types/index.js';

/**
 * Unique identifier for the HR discipline.
 */
export const HR_DISCIPLINE_ID = 'disc_hr_001';

/**
 * URL-safe slug for the HR discipline.
 */
export const HR_DISCIPLINE_SLUG = 'hr';

/**
 * CLAUDE.md configuration for HR discipline agents.
 *
 * @description
 * Defines the role, context, rules, objectives, and constraints
 * for Claude when operating in a human resources capacity.
 * The configuration emphasizes fair hiring practices, candidate experience,
 * and confidential handling of personal information.
 */
export const HR_CLAUDE_MD: ClaudeMdConfig = {
  role: 'HR Operations Specialist',
  context: `You operate within a human resources department supporting talent acquisition,
candidate management, and employee lifecycle operations. You assist HR professionals
with recruiting, screening, onboarding, and workforce planning.

Your expertise spans:
- Talent acquisition and recruitment strategy
- Resume screening and candidate evaluation
- Interview coordination and scheduling
- Onboarding program design and execution
- Employee relations and engagement
- HR compliance and employment law basics
- Diversity, equity, and inclusion initiatives
- Performance management support

You handle sensitive personal information and must maintain strict confidentiality
while ensuring fair and equitable treatment of all candidates and employees.`,

  rules: [
    'Treat all candidates and employees with respect and professionalism',
    'Apply consistent evaluation criteria across all candidates',
    'Maintain strict confidentiality of personal and compensation data',
    'Document all candidate interactions and evaluation rationale',
    'Avoid bias in screening and recommendation processes',
    'Comply with equal opportunity employment regulations',
    'Respond to candidates promptly and professionally',
    'Verify candidate information through appropriate channels',
    'Escalate sensitive employee relations issues to HR leadership',
    'Track all hiring metrics and maintain accurate records',
  ],

  objectives: [
    'Source and attract qualified candidates for open positions',
    'Screen resumes and applications against job requirements',
    'Coordinate interview scheduling and logistics',
    'Support structured interview processes and feedback collection',
    'Prepare offer letters and onboarding documentation',
    'Execute new hire onboarding programs',
    'Maintain candidate and employee database accuracy',
    'Generate recruiting pipeline and hiring metrics reports',
  ],

  constraints: [
    'Never make final hiring decisions without human HR approval',
    'Do not access employee compensation data without authorization',
    'Avoid making promises about job offers or start dates',
    'Do not conduct background checks without proper consent',
    'Refrain from sharing candidate information with unauthorized parties',
    'Never ask candidates prohibited interview questions',
    'Do not terminate or modify employment without authorization',
    'Avoid accessing medical or disability information unnecessarily',
  ],
};

/**
 * MCP server configurations for the HR discipline.
 *
 * @description
 * Provides LinkedIn integration for sourcing and networking,
 * and resume parsing capabilities for candidate evaluation.
 */
export const HR_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'linkedin-recruiter',
    command: 'npx',
    args: ['@wundr/mcp-linkedin', '--mode=recruiter'],
    env: {
      LINKEDIN_CLIENT_ID: '${LINKEDIN_CLIENT_ID}',
      LINKEDIN_CLIENT_SECRET: '${LINKEDIN_CLIENT_SECRET}',
      LINKEDIN_ACCESS_TOKEN: '${LINKEDIN_ACCESS_TOKEN}',
    },
    description: 'LinkedIn integration for candidate sourcing and professional networking',
  },
  {
    name: 'resume-parser',
    command: 'npx',
    args: ['@wundr/mcp-resume-parser'],
    env: {
      PARSER_API_KEY: '${RESUME_PARSER_API_KEY}',
    },
    description: 'Resume parsing and structured data extraction from candidate documents',
  },
  {
    name: 'ats-integration',
    command: 'npx',
    args: ['@wundr/mcp-ats-connector'],
    env: {
      ATS_API_URL: '${ATS_API_URL}',
      ATS_API_KEY: '${ATS_API_KEY}',
    },
    description: 'Applicant tracking system integration for candidate management',
  },
  {
    name: 'calendar-scheduling',
    command: 'npx',
    args: ['@wundr/mcp-calendar', '--provider=google'],
    env: {
      GOOGLE_CALENDAR_CREDENTIALS: '${GOOGLE_CALENDAR_CREDENTIALS}',
    },
    description: 'Calendar integration for interview scheduling and coordination',
  },
  {
    name: 'email-templates',
    command: 'npx',
    args: ['@wundr/mcp-email-templates', '--domain=hr'],
    env: {
      TEMPLATE_STORAGE_PATH: '${HR_TEMPLATES_PATH}',
    },
    description: 'Email template management for candidate communications',
  },
];

/**
 * Hook configurations for the HR discipline.
 *
 * @description
 * Implements candidate scoring, tracks hiring metrics,
 * and ensures compliance with HR policies.
 */
export const HR_HOOKS: HookConfig[] = [
  {
    event: 'PostToolUse',
    command: 'node scripts/hr/calculate-candidate-score.js --candidate="${CANDIDATE_ID}" --criteria="${SCORING_CRITERIA}"',
    description: 'Calculate candidate score based on evaluation criteria',
    blocking: false,
  },
  {
    event: 'PreToolUse',
    command: 'node scripts/hr/validate-pii-access.js --data-type="${DATA_TYPE}" --purpose="${ACCESS_PURPOSE}"',
    description: 'Validate PII access authorization before retrieving candidate data',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/hr/update-pipeline-metrics.js --action="${ACTION}" --stage="${PIPELINE_STAGE}"',
    description: 'Update recruiting pipeline metrics after candidate stage changes',
    blocking: false,
  },
  {
    event: 'PreCommit',
    command: 'node scripts/hr/redact-pii.js --check-only',
    description: 'Verify no PII is inadvertently committed to repository',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/hr/log-candidate-interaction.js --candidate="${CANDIDATE_ID}" --interaction="${INTERACTION_TYPE}"',
    description: 'Log all candidate interactions for compliance and audit',
    blocking: false,
  },
];

/**
 * Agent IDs associated with the HR discipline.
 *
 * @description
 * Specialized agents for recruiting, screening, interviewing,
 * onboarding, and HR analytics.
 */
export const HR_AGENT_IDS: string[] = [
  'agent-talent-sourcer-001',
  'agent-resume-screener-001',
  'agent-interview-coordinator-001',
  'agent-onboarding-specialist-001',
  'agent-hr-analyst-001',
  'agent-candidate-communicator-001',
  'agent-dei-advisor-001',
];

/**
 * Complete HR Discipline Pack.
 *
 * @description
 * A comprehensive configuration bundle for human resources operations.
 * Includes talent acquisition, candidate screening, interview coordination,
 * and onboarding capabilities with appropriate MCP servers and hooks.
 *
 * @example
 * ```typescript
 * import { HR_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/hr.js';
 *
 * // Register with discipline registry
 * registry.register(HR_DISCIPLINE);
 *
 * // Assign to Orchestrator
 * await engine.assignDisciplineToVp({
 *   disciplineId: HR_DISCIPLINE.id,
 *   vpId: 'orchestrator-people-001',
 * });
 * ```
 */
export const HR_DISCIPLINE: DisciplinePack = {
  id: HR_DISCIPLINE_ID,
  name: 'Human Resources',
  slug: HR_DISCIPLINE_SLUG,
  category: 'hr',
  description: 'Talent acquisition, candidate screening, interview coordination, and onboarding operations with emphasis on fair hiring practices and candidate experience.',
  claudeMd: HR_CLAUDE_MD,
  mcpServers: HR_MCP_SERVERS,
  hooks: HR_HOOKS,
  agentIds: HR_AGENT_IDS,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Factory function to create a customized HR discipline pack.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns A new DisciplinePack with merged configurations
 *
 * @example
 * ```typescript
 * const customHrDiscipline = createHrDiscipline({
 *   description: 'Technical recruiting discipline',
 *   agentIds: ['agent-tech-sourcer-001', 'agent-coding-assessor-001'],
 * });
 * ```
 */
export function createHrDiscipline(
  overrides: Partial<Omit<DisciplinePack, 'id' | 'slug' | 'category' | 'createdAt'>> = {},
): DisciplinePack {
  return {
    ...HR_DISCIPLINE,
    ...overrides,
    claudeMd: {
      ...HR_CLAUDE_MD,
      ...(overrides.claudeMd ?? {}),
    },
    mcpServers: overrides.mcpServers ?? HR_MCP_SERVERS,
    hooks: overrides.hooks ?? HR_HOOKS,
    agentIds: overrides.agentIds ?? HR_AGENT_IDS,
    updatedAt: new Date(),
  };
}
