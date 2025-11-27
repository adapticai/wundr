/**
 * @fileoverview Marketing Discipline Template
 * @module @wundr/org-genesis/templates/disciplines/marketing
 *
 * Defines standard marketing roles, capabilities, and organizational structure
 * for marketing operations. This discipline pack provides content creation,
 * analytics, campaign management, and brand communications capabilities.
 *
 * @example
 * ```typescript
 * import { MARKETING_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/marketing.js';
 *
 * // Use in organization configuration
 * const org = await engine.createOrganization({
 *   name: 'Acme Corp',
 *   disciplines: [MARKETING_DISCIPLINE],
 * });
 * ```
 */

import type { DisciplinePack, MCPServerConfig, HookConfig, ClaudeMdConfig } from '../../types/index.js';

/**
 * Unique identifier for the marketing discipline.
 */
export const MARKETING_DISCIPLINE_ID = 'disc_marketing_001';

/**
 * URL-safe slug for the marketing discipline.
 */
export const MARKETING_DISCIPLINE_SLUG = 'marketing';

/**
 * CLAUDE.md configuration for marketing discipline agents.
 *
 * @description
 * Defines the role, context, rules, objectives, and constraints
 * for Claude when operating in a marketing capacity.
 * The configuration emphasizes brand consistency, data-driven decisions,
 * and creative excellence.
 */
export const MARKETING_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Marketing Operations Specialist',
  context: `You operate within a marketing department supporting content creation,
campaign management, analytics, and brand communications. You assist marketing
professionals with strategy execution, creative development, and performance optimization.

Your expertise spans:
- Content marketing and copywriting
- Digital marketing and advertising
- Social media strategy and management
- Marketing analytics and attribution
- Brand management and voice guidelines
- SEO and content optimization
- Email marketing and automation
- Campaign planning and execution

You work across multiple channels and platforms, ensuring consistent brand voice
while optimizing for engagement and conversion metrics.`,

  rules: [
    'Maintain consistent brand voice and visual identity across all content',
    'Base recommendations on data and analytics, not assumptions',
    'Ensure all content is original or properly licensed/attributed',
    'Comply with advertising regulations and platform policies',
    'A/B test messaging and creative before full deployment',
    'Track UTM parameters and attribution for all campaigns',
    'Review content for accuracy and potential legal issues',
    'Coordinate with stakeholders before major announcements',
    'Document campaign strategies and learnings for future reference',
    'Respect competitor information boundaries and ethical marketing practices',
  ],

  objectives: [
    'Create engaging content across blog, social, and email channels',
    'Analyze campaign performance and provide actionable insights',
    'Manage social media presence and community engagement',
    'Optimize content for search engines and discoverability',
    'Plan and execute marketing campaigns and promotions',
    'Generate marketing reports and performance dashboards',
    'Develop and maintain brand guidelines and assets',
    'Support product launches and go-to-market activities',
  ],

  constraints: [
    'Never publish content without proper review and approval',
    'Do not make claims that cannot be substantiated',
    'Avoid using competitor trademarks inappropriately',
    'Do not access customer data without proper authorization',
    'Refrain from making pricing or promotional commitments without approval',
    'Never share confidential campaign strategies externally',
    'Do not engage with negative content without guidance',
    'Avoid disparaging competitors or making comparative claims without evidence',
  ],
};

/**
 * MCP server configurations for the marketing discipline.
 *
 * @description
 * Provides analytics platform integration and social media management
 * capabilities for marketing operations.
 */
export const MARKETING_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'analytics-google',
    command: 'npx',
    args: ['@wundr/mcp-analytics', '--provider=google-analytics'],
    env: {
      GA_MEASUREMENT_ID: '${GA_MEASUREMENT_ID}',
      GA_CREDENTIALS_JSON: '${GA_CREDENTIALS_JSON}',
    },
    description: 'Google Analytics integration for traffic and conversion tracking',
  },
  {
    name: 'social-media-manager',
    command: 'npx',
    args: ['@wundr/mcp-social-media'],
    env: {
      TWITTER_API_KEY: '${TWITTER_API_KEY}',
      TWITTER_API_SECRET: '${TWITTER_API_SECRET}',
      FACEBOOK_ACCESS_TOKEN: '${FACEBOOK_ACCESS_TOKEN}',
      LINKEDIN_ACCESS_TOKEN: '${LINKEDIN_ACCESS_TOKEN}',
      INSTAGRAM_ACCESS_TOKEN: '${INSTAGRAM_ACCESS_TOKEN}',
    },
    description: 'Multi-platform social media management and scheduling',
  },
  {
    name: 'email-marketing',
    command: 'npx',
    args: ['@wundr/mcp-email-marketing'],
    env: {
      EMAIL_PROVIDER: '${EMAIL_MARKETING_PROVIDER}',
      EMAIL_API_KEY: '${EMAIL_MARKETING_API_KEY}',
    },
    description: 'Email marketing platform integration for campaigns and automation',
  },
  {
    name: 'seo-tools',
    command: 'npx',
    args: ['@wundr/mcp-seo'],
    env: {
      SEMRUSH_API_KEY: '${SEMRUSH_API_KEY}',
      AHREFS_API_KEY: '${AHREFS_API_KEY}',
    },
    description: 'SEO analysis, keyword research, and content optimization tools',
  },
  {
    name: 'design-assets',
    command: 'npx',
    args: ['@wundr/mcp-design-assets', '--read-only'],
    env: {
      BRAND_ASSETS_PATH: '${BRAND_ASSETS_PATH}',
      FIGMA_ACCESS_TOKEN: '${FIGMA_ACCESS_TOKEN}',
    },
    description: 'Brand assets, design templates, and style guide access',
  },
];

/**
 * Hook configurations for the marketing discipline.
 *
 * @description
 * Implements content review workflows, brand compliance checks,
 * and performance tracking.
 */
export const MARKETING_HOOKS: HookConfig[] = [
  {
    event: 'PreToolUse',
    command: 'node scripts/marketing/validate-brand-guidelines.js --content="${CONTENT_ID}"',
    description: 'Validate content against brand guidelines before publishing',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/marketing/track-content-creation.js --type="${CONTENT_TYPE}" --channel="${CHANNEL}"',
    description: 'Track content creation metrics and productivity',
    blocking: false,
  },
  {
    event: 'PreCommit',
    command: 'node scripts/marketing/check-asset-licensing.js',
    description: 'Verify all assets have proper licensing before commit',
    blocking: true,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/marketing/update-content-calendar.js --action="${ACTION}" --date="${SCHEDULED_DATE}"',
    description: 'Update content calendar after scheduling changes',
    blocking: false,
  },
  {
    event: 'PostToolUse',
    command: 'node scripts/marketing/log-campaign-activity.js --campaign="${CAMPAIGN_ID}" --action="${ACTION}"',
    description: 'Log campaign activities for attribution and reporting',
    blocking: false,
  },
];

/**
 * Agent IDs associated with the marketing discipline.
 *
 * @description
 * Specialized agents for content creation, analytics, social media,
 * SEO, and campaign management.
 */
export const MARKETING_AGENT_IDS: string[] = [
  'agent-content-writer-001',
  'agent-social-media-manager-001',
  'agent-marketing-analyst-001',
  'agent-seo-specialist-001',
  'agent-email-marketer-001',
  'agent-campaign-manager-001',
  'agent-brand-guardian-001',
];

/**
 * Complete Marketing Discipline Pack.
 *
 * @description
 * A comprehensive configuration bundle for marketing operations.
 * Includes content creation, analytics, social media management,
 * and campaign execution capabilities with appropriate MCP servers and hooks.
 *
 * @example
 * ```typescript
 * import { MARKETING_DISCIPLINE } from '@wundr/org-genesis/templates/disciplines/marketing.js';
 *
 * // Register with discipline registry
 * registry.register(MARKETING_DISCIPLINE);
 *
 * // Assign to Orchestrator
 * await engine.assignDisciplineToVp({
 *   disciplineId: MARKETING_DISCIPLINE.id,
 *   vpId: 'orchestrator-marketing-001',
 * });
 * ```
 */
export const MARKETING_DISCIPLINE: DisciplinePack = {
  id: MARKETING_DISCIPLINE_ID,
  name: 'Marketing',
  slug: MARKETING_DISCIPLINE_SLUG,
  category: 'marketing',
  description: 'Content creation, analytics, campaign management, and brand communications with emphasis on data-driven decisions and creative excellence.',
  claudeMd: MARKETING_CLAUDE_MD,
  mcpServers: MARKETING_MCP_SERVERS,
  hooks: MARKETING_HOOKS,
  agentIds: MARKETING_AGENT_IDS,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Factory function to create a customized marketing discipline pack.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns A new DisciplinePack with merged configurations
 *
 * @example
 * ```typescript
 * const customMarketingDiscipline = createMarketingDiscipline({
 *   description: 'B2B content marketing discipline',
 *   agentIds: ['agent-b2b-writer-001', 'agent-linkedin-specialist-001'],
 * });
 * ```
 */
export function createMarketingDiscipline(
  overrides: Partial<Omit<DisciplinePack, 'id' | 'slug' | 'category' | 'createdAt'>> = {},
): DisciplinePack {
  return {
    ...MARKETING_DISCIPLINE,
    ...overrides,
    claudeMd: {
      ...MARKETING_CLAUDE_MD,
      ...(overrides.claudeMd ?? {}),
    },
    mcpServers: overrides.mcpServers ?? MARKETING_MCP_SERVERS,
    hooks: overrides.hooks ?? MARKETING_HOOKS,
    agentIds: overrides.agentIds ?? MARKETING_AGENT_IDS,
    updatedAt: new Date(),
  };
}
