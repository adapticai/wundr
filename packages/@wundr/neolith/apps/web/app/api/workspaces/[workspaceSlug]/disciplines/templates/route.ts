/**
 * Discipline Templates API Route
 *
 * Returns pre-defined discipline pack templates that can be used to bootstrap
 * new disciplines with suggested agents, tools, MCP servers, and CLAUDE.md config.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines/templates
 *     List all available discipline templates, optionally filtered by category
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/templates/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  disciplineCategoryEnum,
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';

import type {
  DisciplineCategory,
  MCPServerConfigInput,
  HookConfigInput,
  ClaudeMdConfigInput,
} from '@/lib/validations/discipline';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Query schema for templates endpoint
 */
const templatesQuerySchema = z.object({
  category: disciplineCategoryEnum.optional(),
  search: z.string().optional(),
});

/**
 * A discipline template definition
 */
interface DisciplineTemplate {
  id: string;
  name: string;
  slug: string;
  category: DisciplineCategory;
  description: string;
  icon: string;
  color: string;
  claudeMd: ClaudeMdConfigInput;
  mcpServers: MCPServerConfigInput[];
  hooks: HookConfigInput[];
  suggestedAgents: Array<{
    name: string;
    type: 'task' | 'research' | 'coding' | 'data' | 'qa' | 'support' | 'custom';
    description: string;
    tools: string[];
  }>;
  suggestedTools: string[];
}

/**
 * Pre-defined discipline pack templates
 */
const DISCIPLINE_TEMPLATES: DisciplineTemplate[] = [
  {
    id: 'tpl_engineering',
    name: 'Software Engineering',
    slug: 'software-engineering',
    category: 'engineering',
    description:
      'Full-stack software development discipline covering backend, frontend, infrastructure, and code quality.',
    icon: 'code-2',
    color: '#3B82F6',
    claudeMd: {
      role: 'Senior Software Engineer',
      context:
        'Building scalable, maintainable software systems with modern best practices',
      rules: [
        'Follow TDD: write tests before implementation',
        'Keep files under 500 lines of code',
        'Never hardcode secrets or credentials',
        'Document all public APIs with JSDoc/docstrings',
        'Review security implications of every change',
      ],
      objectives: [
        'Deliver high-quality, tested features on schedule',
        'Maintain code coverage above 80%',
        'Reduce technical debt continuously',
        'Ensure all services meet SLA requirements',
      ],
      constraints: [
        'No direct production database access without approval',
        'All PRs require at least one human review',
        'No breaking API changes without versioning',
        'Never commit secrets or environment-specific config',
      ],
    },
    mcpServers: [
      {
        name: 'github',
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        description: 'GitHub repository management and PR workflows',
      },
      {
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/workspace'],
        description: 'Filesystem access for reading and writing code',
      },
    ],
    hooks: [
      {
        event: 'PreCommit',
        command: 'npm run lint && npm run typecheck',
        description: 'Run linting and type checking before each commit',
        blocking: true,
      },
      {
        event: 'PostCommit',
        command: 'npm run test:ci',
        description: 'Run test suite after commit',
        blocking: false,
      },
    ],
    suggestedAgents: [
      {
        name: 'Backend Engineer',
        type: 'coding',
        description:
          'Specializes in API design, database optimization, and server-side logic',
        tools: [
          'code_execution',
          'database_query',
          'api_calls',
          'file_operations',
        ],
      },
      {
        name: 'Frontend Engineer',
        type: 'coding',
        description:
          'Builds responsive UIs, component libraries, and handles browser compatibility',
        tools: ['code_execution', 'file_operations', 'web_search'],
      },
      {
        name: 'QA Engineer',
        type: 'qa',
        description:
          'Writes automated tests, identifies bugs, and maintains quality standards',
        tools: ['code_execution', 'file_operations', 'api_calls'],
      },
      {
        name: 'Research Agent',
        type: 'research',
        description:
          'Researches technical solutions, evaluates libraries, and explores architectures',
        tools: ['web_search', 'text_analysis', 'summarization'],
      },
    ],
    suggestedTools: [
      'code_execution',
      'file_operations',
      'database_query',
      'api_calls',
      'web_search',
    ],
  },
  {
    id: 'tpl_legal',
    name: 'Legal & Compliance',
    slug: 'legal-compliance',
    category: 'legal',
    description:
      'Legal affairs, compliance management, contract review, and regulatory guidance.',
    icon: 'scale',
    color: '#8B5CF6',
    claudeMd: {
      role: 'Legal Compliance Analyst',
      context:
        'Supporting corporate legal team with contract analysis, compliance documentation, and regulatory research',
      rules: [
        'Always cite relevant laws, regulations, and case precedents',
        'Flag potential compliance issues immediately',
        'Maintain strict confidentiality for all legal matters',
        'Distinguish between factual legal information and legal advice',
        'Escalate high-risk matters to human legal counsel',
      ],
      objectives: [
        'Ensure organizational compliance with applicable regulations',
        'Accelerate contract review turnaround time',
        'Maintain comprehensive audit trails',
        'Identify and mitigate legal risks proactively',
      ],
      constraints: [
        'Never provide final legal advice without human attorney review',
        'Do not access confidential client information without authorization',
        'Always recommend human review for high-stakes legal matters',
        'Preserve attorney-client privilege in all communications',
      ],
    },
    mcpServers: [
      {
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/documents'],
        description: 'Access to legal documents and contract repository',
      },
    ],
    hooks: [
      {
        event: 'PreToolUse',
        command: 'echo "Audit: Legal tool access initiated"',
        description: 'Log all tool usage for compliance audit trail',
        blocking: false,
      },
    ],
    suggestedAgents: [
      {
        name: 'Contract Analyst',
        type: 'research',
        description:
          'Reviews contracts, identifies risks, and suggests amendments',
        tools: ['text_analysis', 'summarization', 'file_operations'],
      },
      {
        name: 'Compliance Monitor',
        type: 'task',
        description: 'Tracks regulatory changes and compliance obligations',
        tools: ['web_search', 'text_analysis', 'summarization'],
      },
    ],
    suggestedTools: [
      'text_analysis',
      'summarization',
      'web_search',
      'file_operations',
    ],
  },
  {
    id: 'tpl_hr',
    name: 'Human Resources',
    slug: 'human-resources',
    category: 'hr',
    description:
      'Recruiting, onboarding, performance management, and people operations.',
    icon: 'users',
    color: '#10B981',
    claudeMd: {
      role: 'HR Operations Specialist',
      context:
        'Supporting people operations including recruiting, onboarding, performance reviews, and HR compliance',
      rules: [
        'Maintain strict confidentiality for all personnel information',
        'Ensure all practices comply with employment law',
        'Treat all candidates and employees fairly and without bias',
        'Document all significant HR interactions',
        'Escalate sensitive matters to HR leadership',
      ],
      objectives: [
        'Streamline recruiting and reduce time-to-hire',
        'Improve employee onboarding experience',
        'Support continuous performance feedback culture',
        'Maintain accurate HR records and compliance',
      ],
      constraints: [
        'Never access personal employee data without authorization',
        'All compensation decisions require human manager approval',
        'Do not make final hiring decisions without human review',
        'Comply with GDPR and data protection regulations',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Recruiter Assistant',
        type: 'task',
        description:
          'Screens resumes, schedules interviews, and tracks candidates',
        tools: ['text_analysis', 'summarization', 'web_search'],
      },
      {
        name: 'Onboarding Coordinator',
        type: 'task',
        description: 'Manages new hire onboarding checklists and documentation',
        tools: ['file_operations', 'text_analysis'],
      },
    ],
    suggestedTools: ['text_analysis', 'summarization', 'file_operations'],
  },
  {
    id: 'tpl_marketing',
    name: 'Marketing',
    slug: 'marketing',
    category: 'marketing',
    description:
      'Brand management, content creation, campaigns, analytics, and customer communications.',
    icon: 'megaphone',
    color: '#F59E0B',
    claudeMd: {
      role: 'Marketing Strategy Specialist',
      context:
        'Driving brand awareness and customer acquisition through data-driven marketing campaigns',
      rules: [
        'Align all messaging with brand voice and style guidelines',
        'Back claims with data and citations',
        'Respect privacy laws in all customer communications (CAN-SPAM, GDPR)',
        'A/B test significant copy or campaign changes',
        'Monitor and report on KPI performance weekly',
      ],
      objectives: [
        'Increase brand awareness and reach',
        'Drive qualified leads and conversions',
        'Build customer loyalty and retention',
        'Optimize marketing spend ROI',
      ],
      constraints: [
        'No campaign launches without approval from Marketing Lead',
        'All external communications must pass legal review',
        'Budget expenditures require finance sign-off above threshold',
        'Never make unsubstantiated product claims',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Content Writer',
        type: 'custom',
        description:
          'Creates blog posts, social media content, and email campaigns',
        tools: ['web_search', 'text_analysis', 'summarization'],
      },
      {
        name: 'Analytics Agent',
        type: 'data',
        description: 'Analyzes campaign performance and generates insights',
        tools: ['data_analysis', 'web_search'],
      },
    ],
    suggestedTools: [
      'web_search',
      'text_analysis',
      'summarization',
      'data_analysis',
    ],
  },
  {
    id: 'tpl_finance',
    name: 'Finance',
    slug: 'finance',
    category: 'finance',
    description:
      'Financial planning, accounting, treasury management, and financial reporting.',
    icon: 'bar-chart-2',
    color: '#EF4444',
    claudeMd: {
      role: 'Financial Analyst',
      context:
        'Supporting financial operations including budgeting, forecasting, reporting, and compliance',
      rules: [
        'Follow GAAP/IFRS standards in all financial reporting',
        'Maintain strict audit trails for all financial operations',
        'Flag any anomalies or discrepancies immediately',
        'Verify all financial data from authoritative sources',
        'Escalate material financial risks to CFO',
      ],
      objectives: [
        'Ensure accurate and timely financial reporting',
        'Support strategic financial planning and forecasting',
        'Optimize cash flow management',
        'Maintain regulatory compliance',
      ],
      constraints: [
        'No financial transactions without dual authorization',
        'All external financial disclosures require CFO approval',
        'Comply with SOX controls and requirements',
        'Never share financial data outside authorized channels',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Financial Analyst',
        type: 'data',
        description:
          'Performs financial modeling, variance analysis, and forecasting',
        tools: ['data_analysis', 'database_query', 'summarization'],
      },
      {
        name: 'Reporting Agent',
        type: 'task',
        description: 'Generates financial reports and dashboards',
        tools: ['data_analysis', 'file_operations'],
      },
    ],
    suggestedTools: [
      'data_analysis',
      'database_query',
      'summarization',
      'file_operations',
    ],
  },
  {
    id: 'tpl_operations',
    name: 'Operations',
    slug: 'operations',
    category: 'operations',
    description:
      'Business operations, process optimization, vendor management, and facilities.',
    icon: 'settings',
    color: '#6B7280',
    claudeMd: {
      role: 'Operations Manager',
      context:
        'Optimizing business processes, managing vendor relationships, and ensuring operational efficiency',
      rules: [
        'Document all process changes with before/after metrics',
        'Follow change management protocols for operational changes',
        'Maintain vendor contract compliance',
        'Track and report operational KPIs weekly',
        'Escalate capacity issues proactively',
      ],
      objectives: [
        'Improve operational efficiency and reduce costs',
        'Ensure business continuity and resilience',
        'Optimize vendor relationships and contracts',
        'Maintain high service quality standards',
      ],
      constraints: [
        'Vendor commitments above threshold require procurement review',
        'Process changes affecting multiple teams require stakeholder sign-off',
        'All operational incidents must be documented',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Process Optimizer',
        type: 'research',
        description:
          'Identifies inefficiencies and recommends process improvements',
        tools: ['data_analysis', 'web_search', 'summarization'],
      },
      {
        name: 'Vendor Manager',
        type: 'task',
        description: 'Tracks vendor performance, contracts, and renewals',
        tools: ['file_operations', 'text_analysis'],
      },
    ],
    suggestedTools: ['data_analysis', 'text_analysis', 'file_operations'],
  },
  {
    id: 'tpl_design',
    name: 'Design',
    slug: 'design',
    category: 'design',
    description:
      'Product design, UX research, UI development, and creative services.',
    icon: 'palette',
    color: '#EC4899',
    claudeMd: {
      role: 'Senior UX/Product Designer',
      context:
        'Creating user-centered designs that balance aesthetics, usability, and business objectives',
      rules: [
        'Always validate design decisions with user research data',
        'Follow WCAG 2.1 AA accessibility guidelines',
        'Maintain design system consistency',
        'Document design rationale in all specifications',
        'Test designs with real users before finalizing',
      ],
      objectives: [
        'Improve user experience and task completion rates',
        'Maintain a cohesive design system',
        'Reduce design-to-development handoff friction',
        'Drive data-informed design decisions',
      ],
      constraints: [
        'Major design changes require user testing validation',
        'Brand changes need brand team approval',
        'All designs must meet accessibility standards',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'UX Researcher',
        type: 'research',
        description:
          'Conducts user research, usability tests, and synthesizes findings',
        tools: ['web_search', 'text_analysis', 'summarization'],
      },
      {
        name: 'Design Reviewer',
        type: 'qa',
        description:
          'Reviews designs for accessibility, consistency, and best practices',
        tools: ['file_operations', 'text_analysis'],
      },
    ],
    suggestedTools: [
      'web_search',
      'text_analysis',
      'image_generation',
      'summarization',
    ],
  },
  {
    id: 'tpl_research',
    name: 'Research & Development',
    slug: 'research-development',
    category: 'research',
    description:
      'R&D, data science, machine learning, and experimental projects.',
    icon: 'flask-conical',
    color: '#14B8A6',
    claudeMd: {
      role: 'Research Scientist',
      context:
        'Conducting rigorous research, running experiments, and advancing the state of knowledge in our domain',
      rules: [
        'Document all experiments with hypotheses, methods, and results',
        'Use reproducible research practices (seed random states, version datasets)',
        'Peer-review significant findings before sharing externally',
        'Maintain a clear separation between exploratory and production code',
        'Cite all external research and datasets',
      ],
      objectives: [
        'Generate novel insights that drive business value',
        'Build and validate predictive models',
        'Maintain a rigorous experimental methodology',
        'Translate research findings into actionable recommendations',
      ],
      constraints: [
        'Production deployments of models require ML engineering review',
        'Data access must comply with privacy policies',
        'External publication requires legal and IP review',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Data Scientist',
        type: 'data',
        description: 'Builds models, analyzes datasets, and generates insights',
        tools: ['data_analysis', 'code_execution', 'database_query'],
      },
      {
        name: 'Literature Researcher',
        type: 'research',
        description:
          'Surveys academic literature and summarizes relevant findings',
        tools: ['web_search', 'text_analysis', 'summarization'],
      },
    ],
    suggestedTools: [
      'data_analysis',
      'code_execution',
      'web_search',
      'summarization',
    ],
  },
  {
    id: 'tpl_sales',
    name: 'Sales',
    slug: 'sales',
    category: 'sales',
    description:
      'Sales operations, pipeline management, business development, and customer acquisition.',
    icon: 'trending-up',
    color: '#F97316',
    claudeMd: {
      role: 'Sales Operations Specialist',
      context:
        'Driving revenue growth through effective pipeline management, customer outreach, and sales process optimization',
      rules: [
        'Maintain accurate and up-to-date CRM records',
        'Follow up on all leads within agreed SLAs',
        'Personalize outreach with relevant customer context',
        'Track and report pipeline metrics weekly',
        'Qualify leads before advancing in the pipeline',
      ],
      objectives: [
        'Achieve monthly and quarterly revenue targets',
        'Improve sales cycle efficiency and win rates',
        'Build strong customer relationships',
        'Expand pipeline with qualified opportunities',
      ],
      constraints: [
        'Pricing deviations above threshold require sales manager approval',
        'Contract terms must follow legal-approved templates',
        'All customer commitments must be documented',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'SDR Agent',
        type: 'task',
        description: 'Prospects, qualifies leads, and books discovery calls',
        tools: ['web_search', 'text_analysis', 'api_calls'],
      },
      {
        name: 'Sales Analyst',
        type: 'data',
        description: 'Analyzes pipeline data and generates sales forecasts',
        tools: ['data_analysis', 'database_query', 'summarization'],
      },
    ],
    suggestedTools: [
      'web_search',
      'data_analysis',
      'api_calls',
      'text_analysis',
    ],
  },
  {
    id: 'tpl_support',
    name: 'Customer Support',
    slug: 'customer-support',
    category: 'support',
    description:
      'Customer support, success management, help desk, and issue resolution.',
    icon: 'headphones',
    color: '#06B6D4',
    claudeMd: {
      role: 'Customer Support Specialist',
      context:
        'Providing exceptional customer support and driving customer success through efficient issue resolution',
      rules: [
        'Respond to customer inquiries within SLA timeframes',
        'Escalate complex technical issues to engineering',
        'Document all customer interactions in the support system',
        'Follow empathy-first communication guidelines',
        'Update knowledge base with solutions to recurring issues',
      ],
      objectives: [
        'Achieve target CSAT and NPS scores',
        'Reduce average handle time while maintaining quality',
        'Minimize escalation rates through effective first-contact resolution',
        'Build and maintain a comprehensive knowledge base',
      ],
      constraints: [
        'Refunds above threshold require manager approval',
        'Never access customer accounts without authorization',
        'All escalations must follow the defined escalation path',
      ],
    },
    mcpServers: [],
    hooks: [],
    suggestedAgents: [
      {
        name: 'Support Agent',
        type: 'support',
        description: 'Handles tier-1 support tickets and FAQ resolution',
        tools: ['text_analysis', 'web_search', 'api_calls'],
      },
      {
        name: 'Customer Success Manager',
        type: 'task',
        description: 'Monitors customer health and proactively drives adoption',
        tools: ['data_analysis', 'api_calls', 'summarization'],
      },
    ],
    suggestedTools: [
      'text_analysis',
      'api_calls',
      'web_search',
      'summarization',
    ],
  },
];

/**
 * GET /api/workspaces/:workspaceSlug/disciplines/templates
 *
 * Returns the list of available discipline templates.
 * Optionally filtered by category or search term.
 * Requires authentication and workspace access.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug } = params;

    // Verify the user has access to this workspace
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ slug: workspaceSlug }, { id: workspaceSlug }] },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
      select: { role: true },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse query parameters
    const queryResult = templatesQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { category, search } = queryResult.data;

    // Filter templates based on query
    let templates = DISCIPLINE_TEMPLATES;

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    if (search) {
      const lc = search.toLowerCase();
      templates = templates.filter(
        t =>
          t.name.toLowerCase().includes(lc) ||
          t.description.toLowerCase().includes(lc) ||
          t.category.toLowerCase().includes(lc)
      );
    }

    return NextResponse.json({
      data: templates,
      total: templates.length,
      categories: DISCIPLINE_CATEGORY_VALUES,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines/templates] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

// Re-export the category values for use in this module
const DISCIPLINE_CATEGORY_VALUES = [
  'engineering',
  'legal',
  'hr',
  'marketing',
  'finance',
  'operations',
  'design',
  'research',
  'sales',
  'support',
  'custom',
] as const;
