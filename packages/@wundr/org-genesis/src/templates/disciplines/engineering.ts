/**
 * @fileoverview Engineering Discipline Templates
 * @module @wundr/org-genesis/templates/disciplines/engineering
 *
 * Provides comprehensive engineering discipline templates for software development teams.
 * Includes the base engineering discipline and specialized subdisciplines for frontend,
 * backend, DevOps, and QA engineering.
 *
 * @example
 * ```typescript
 * import {
 *   ENGINEERING_DISCIPLINE,
 *   FRONTEND_ENGINEERING_DISCIPLINE,
 *   BACKEND_ENGINEERING_DISCIPLINE,
 *   DEVOPS_ENGINEERING_DISCIPLINE,
 *   QA_ENGINEERING_DISCIPLINE,
 * } from '@wundr/org-genesis';
 *
 * // Use the base engineering discipline
 * const engineeringConfig = ENGINEERING_DISCIPLINE;
 *
 * // Or use a specialized subdiscipline
 * const frontendConfig = FRONTEND_ENGINEERING_DISCIPLINE;
 * ```
 */

import type {
  DisciplinePack,
  MCPServerConfig,
  HookConfig,
  ClaudeMdConfig,
} from '../../types/index.js';

/**
 * Unique identifier for the engineering discipline.
 */
export const ENGINEERING_DISCIPLINE_ID = 'discipline-engineering';

/**
 * Unique identifier for the frontend engineering subdiscipline.
 */
export const FRONTEND_ENGINEERING_DISCIPLINE_ID =
  'discipline-engineering-frontend';

/**
 * Unique identifier for the backend engineering subdiscipline.
 */
export const BACKEND_ENGINEERING_DISCIPLINE_ID =
  'discipline-engineering-backend';

/**
 * Unique identifier for the DevOps engineering subdiscipline.
 */
export const DEVOPS_ENGINEERING_DISCIPLINE_ID = 'discipline-engineering-devops';

/**
 * Unique identifier for the QA engineering subdiscipline.
 */
export const QA_ENGINEERING_DISCIPLINE_ID = 'discipline-engineering-qa';

// =============================================================================
// Common MCP Server Configurations
// =============================================================================

/**
 * Git MCP server configuration for version control operations.
 * @internal
 */
const GIT_MCP_SERVER: MCPServerConfig = {
  name: 'git-mcp',
  command: 'npx',
  args: ['@anthropic/git-mcp'],
  env: {},
  description:
    'Git version control operations including commits, branches, merges, and history analysis',
};

/**
 * Filesystem MCP server configuration for file operations.
 * @internal
 */
const FILESYSTEM_MCP_SERVER: MCPServerConfig = {
  name: 'filesystem-mcp',
  command: 'npx',
  args: ['@anthropic/filesystem-mcp'],
  env: {},
  description:
    'Filesystem operations for reading, writing, and managing project files',
};

/**
 * GitHub MCP server configuration for repository management.
 * @internal
 */
const GITHUB_MCP_SERVER: MCPServerConfig = {
  name: 'github-mcp',
  command: 'npx',
  args: ['@modelcontextprotocol/server-github'],
  env: {
    GITHUB_TOKEN: '${GITHUB_TOKEN}',
  },
  description:
    'GitHub integration for issues, pull requests, and repository management',
};

/**
 * Memory MCP server configuration for context persistence.
 * @internal
 */
const MEMORY_MCP_SERVER: MCPServerConfig = {
  name: 'memory-mcp',
  command: 'npx',
  args: ['@modelcontextprotocol/server-memory'],
  env: {},
  description: 'Memory persistence for maintaining context across sessions',
};

/**
 * Sequential thinking MCP server for complex problem solving.
 * @internal
 */
const SEQUENTIAL_THINKING_MCP_SERVER: MCPServerConfig = {
  name: 'sequential-thinking',
  command: 'npx',
  args: ['@modelcontextprotocol/server-sequential-thinking'],
  env: {},
  description:
    'Sequential thinking for breaking down complex problems into steps',
};

// =============================================================================
// Specialized MCP Server Configurations
// =============================================================================

/**
 * Browser tools MCP server for frontend development.
 * @internal
 */
const BROWSER_TOOLS_MCP_SERVER: MCPServerConfig = {
  name: 'browser-tools',
  command: 'npx',
  args: ['@anthropic/browser-tools-mcp'],
  env: {},
  description: 'Browser automation for testing, debugging, and UI verification',
};

/**
 * PostgreSQL MCP server for database operations.
 * @internal
 */
const POSTGRES_MCP_SERVER: MCPServerConfig = {
  name: 'postgres-mcp',
  command: 'npx',
  args: ['@modelcontextprotocol/server-postgres'],
  env: {
    POSTGRES_CONNECTION_STRING: '${DATABASE_URL}',
  },
  description:
    'PostgreSQL database operations for querying and schema management',
};

/**
 * Docker MCP server for container management.
 * @internal
 */
const DOCKER_MCP_SERVER: MCPServerConfig = {
  name: 'docker-mcp',
  command: 'npx',
  args: ['@wundr/mcp-docker'],
  env: {},
  description: 'Docker container management and orchestration operations',
};

/**
 * Kubernetes MCP server for cluster operations.
 * @internal
 */
const KUBERNETES_MCP_SERVER: MCPServerConfig = {
  name: 'kubernetes-mcp',
  command: 'npx',
  args: ['@wundr/mcp-kubernetes'],
  env: {
    KUBECONFIG: '${KUBECONFIG}',
  },
  description: 'Kubernetes cluster management and deployment operations',
};

/**
 * AWS MCP server for cloud operations.
 * @internal
 */
const AWS_MCP_SERVER: MCPServerConfig = {
  name: 'aws-mcp',
  command: 'npx',
  args: ['@wundr/mcp-aws'],
  env: {
    MY_AWS_ACCESS_KEY_ID: '${MY_AWS_ACCESS_KEY_ID}',
    MY_AWS_SECRET_ACCESS_KEY: '${MY_AWS_SECRET_ACCESS_KEY}',
    MY_AWS_REGION: '${MY_AWS_REGION}',
  },
  description: 'AWS cloud services integration for infrastructure management',
};

/**
 * Puppeteer MCP server for E2E testing.
 * @internal
 */
const PUPPETEER_MCP_SERVER: MCPServerConfig = {
  name: 'puppeteer-mcp',
  command: 'npx',
  args: ['@modelcontextprotocol/server-puppeteer'],
  env: {},
  description: 'Puppeteer browser automation for E2E testing and screenshots',
};

// =============================================================================
// Common Hook Configurations
// =============================================================================

/**
 * Pre-commit linting hook.
 * @internal
 */
const PRE_COMMIT_LINT_HOOK: HookConfig = {
  event: 'PreCommit',
  command: 'npm run lint',
  description: 'Run linting before committing to ensure code quality',
  blocking: true,
};

/**
 * Pre-commit type checking hook.
 * @internal
 */
const PRE_COMMIT_TYPECHECK_HOOK: HookConfig = {
  event: 'PreCommit',
  command: 'npm run typecheck',
  description: 'Run type checking before committing to catch type errors',
  blocking: true,
};

/**
 * Pre-commit test hook.
 * @internal
 */
const PRE_COMMIT_TEST_HOOK: HookConfig = {
  event: 'PreCommit',
  command: 'npm run test:affected',
  description: 'Run affected tests before committing to prevent regressions',
  blocking: true,
};

/**
 * Post-commit notification hook.
 * @internal
 */
const POST_COMMIT_NOTIFY_HOOK: HookConfig = {
  event: 'PostCommit',
  command: 'echo "Commit successful: $(git log -1 --format=%H)"',
  description: 'Notify successful commit completion',
  blocking: false,
};

/**
 * Pre-tool use security scan hook.
 * @internal
 */
const PRE_TOOL_SECURITY_HOOK: HookConfig = {
  event: 'PreToolUse',
  command: 'npm run security:check 2>/dev/null || true',
  description: 'Run security scan before tool operations on sensitive files',
  blocking: false,
};

/**
 * Post-tool use format hook.
 * @internal
 */
const POST_TOOL_FORMAT_HOOK: HookConfig = {
  event: 'PostToolUse',
  command: 'npm run format 2>/dev/null || true',
  description: 'Auto-format code after tool modifications',
  blocking: false,
};

// =============================================================================
// Base Engineering Discipline
// =============================================================================

/**
 * Base CLAUDE.md configuration for software engineering.
 * @internal
 */
const ENGINEERING_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Senior Software Engineer',
  context: `You are working on production-grade software systems in a professional engineering environment.
Your work is part of a larger organization with multiple teams and established practices.
The codebase follows modern best practices including TypeScript, comprehensive testing,
and continuous integration/deployment pipelines. All code must be production-ready and maintainable.`,
  rules: [
    'Write clean, maintainable, and well-documented code',
    'Follow Test-Driven Development (TDD) principles',
    'Use meaningful variable and function names',
    'Keep functions small and focused on single responsibility',
    'Handle errors explicitly and gracefully',
    'Write comprehensive unit and integration tests',
    'Follow the existing code style and conventions',
    'Document public APIs with JSDoc comments',
    'Use TypeScript strict mode for type safety',
    'Review security implications of all changes',
    'Consider performance implications at scale',
    'Ensure backward compatibility unless explicitly breaking',
  ],
  objectives: [
    'Deliver high-quality, maintainable software features',
    'Reduce technical debt through continuous refactoring',
    'Improve code coverage and test reliability',
    'Enhance system performance and scalability',
    'Maintain comprehensive documentation',
    'Support team knowledge sharing and code reviews',
  ],
  constraints: [
    'No console.log statements in production code (use proper logging)',
    'No hardcoded secrets or credentials in source code',
    'No direct database access without proper abstraction layer',
    'No breaking changes without migration path documentation',
    'No deployment without passing CI/CD pipeline',
    'No bypassing code review process for production code',
    'No importing from internal module paths directly',
    'No circular dependencies between modules',
  ],
};

/**
 * Comprehensive Software Engineering discipline pack.
 *
 * @description
 * The base engineering discipline provides a complete configuration for
 * full-stack software development. It includes common tools, hooks, and
 * behavioral configurations suitable for general engineering work.
 *
 * This discipline serves as the foundation for more specialized subdisciplines
 * like frontend, backend, DevOps, and QA engineering.
 *
 * @example
 * ```typescript
 * import { ENGINEERING_DISCIPLINE } from '@wundr/org-genesis';
 *
 * // Use as a base for custom engineering discipline
 * const customEngineering: DisciplinePack = {
 *   ...ENGINEERING_DISCIPLINE,
 *   id: 'custom-engineering',
 *   name: 'Custom Engineering Team',
 *   agentIds: ['custom-agent-1', 'custom-agent-2'],
 * };
 * ```
 */
export const ENGINEERING_DISCIPLINE: DisciplinePack = {
  id: ENGINEERING_DISCIPLINE_ID,
  name: 'Software Engineering',
  slug: 'engineering',
  category: 'engineering',
  description:
    'Full-stack software engineering discipline for building production-grade applications with modern best practices including TDD, CI/CD, and comprehensive documentation.',
  claudeMd: ENGINEERING_CLAUDE_MD,
  mcpServers: [
    GIT_MCP_SERVER,
    FILESYSTEM_MCP_SERVER,
    GITHUB_MCP_SERVER,
    MEMORY_MCP_SERVER,
    SEQUENTIAL_THINKING_MCP_SERVER,
  ],
  hooks: [
    PRE_COMMIT_LINT_HOOK,
    PRE_COMMIT_TYPECHECK_HOOK,
    PRE_COMMIT_TEST_HOOK,
    POST_COMMIT_NOTIFY_HOOK,
    PRE_TOOL_SECURITY_HOOK,
    POST_TOOL_FORMAT_HOOK,
  ],
  agentIds: [
    'code-reviewer',
    'test-engineer',
    'docs-writer',
    'refactor-specialist',
    'security-analyst',
    'performance-analyst',
  ],
  parentVpId: undefined,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// =============================================================================
// Frontend Engineering Subdiscipline
// =============================================================================

/**
 * CLAUDE.md configuration for frontend engineering.
 * @internal
 */
const FRONTEND_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Senior Frontend Engineer',
  context: `You are a frontend specialist focused on building responsive, accessible, and performant
user interfaces. You work primarily with React, TypeScript, and modern CSS. Your applications
must work across different browsers and devices while maintaining excellent user experience.
You follow component-driven development and maintain a comprehensive design system.`,
  rules: [
    'Build accessible components following WCAG 2.1 AA guidelines',
    'Write semantic HTML with proper ARIA attributes',
    'Implement responsive designs that work across all viewport sizes',
    'Use CSS-in-JS or CSS modules for component styling',
    'Optimize bundle size and loading performance',
    'Implement proper error boundaries for graceful degradation',
    'Write comprehensive unit tests for components',
    'Use React hooks and functional components',
    'Follow the design system and component library standards',
    'Implement proper keyboard navigation and focus management',
    'Use proper loading states and skeleton screens',
    'Optimize images and media for web delivery',
  ],
  objectives: [
    'Deliver pixel-perfect implementations of designs',
    'Achieve 90%+ Lighthouse accessibility score',
    'Maintain sub-3-second First Contentful Paint',
    'Ensure cross-browser compatibility',
    'Build reusable component library',
    'Maintain comprehensive Storybook documentation',
  ],
  constraints: [
    'No inline styles except for dynamic values',
    'No direct DOM manipulation outside React refs',
    'No accessibility violations in production',
    'No unoptimized images or media assets',
    'No blocking renders in the main thread',
    'No global CSS without explicit scoping',
    'No hardcoded breakpoints - use design tokens',
    'No unauthenticated API calls from client side',
  ],
};

/**
 * Frontend Engineering subdiscipline pack.
 *
 * @description
 * Specialized discipline for frontend/UI development with focus on
 * React, TypeScript, accessibility, and responsive design. Includes
 * browser testing tools and frontend-specific hooks.
 *
 * @example
 * ```typescript
 * import { FRONTEND_ENGINEERING_DISCIPLINE } from '@wundr/org-genesis';
 *
 * // Check frontend discipline configuration
 * console.log(FRONTEND_ENGINEERING_DISCIPLINE.claudeMd.role);
 * // Output: 'Senior Frontend Engineer'
 * ```
 */
export const FRONTEND_ENGINEERING_DISCIPLINE: DisciplinePack = {
  id: FRONTEND_ENGINEERING_DISCIPLINE_ID,
  name: 'Frontend Engineering',
  slug: 'engineering-frontend',
  category: 'engineering',
  description:
    'Frontend engineering discipline focused on building accessible, responsive, and performant user interfaces with React and TypeScript.',
  claudeMd: FRONTEND_CLAUDE_MD,
  mcpServers: [
    GIT_MCP_SERVER,
    FILESYSTEM_MCP_SERVER,
    GITHUB_MCP_SERVER,
    MEMORY_MCP_SERVER,
    BROWSER_TOOLS_MCP_SERVER,
    PUPPETEER_MCP_SERVER,
  ],
  hooks: [
    PRE_COMMIT_LINT_HOOK,
    PRE_COMMIT_TYPECHECK_HOOK,
    {
      event: 'PreCommit',
      command: 'npm run test:unit -- --coverage',
      description: 'Run unit tests with coverage before committing',
      blocking: true,
    },
    {
      event: 'PreToolUse',
      command: 'npm run lint:a11y 2>/dev/null || true',
      description: 'Check accessibility before component modifications',
      blocking: false,
    },
    POST_TOOL_FORMAT_HOOK,
    {
      event: 'PostToolUse',
      command: 'npm run storybook:build 2>/dev/null || true',
      description: 'Update Storybook after component changes',
      blocking: false,
    },
  ],
  agentIds: [
    'react-developer',
    'css-specialist',
    'accessibility-auditor',
    'performance-optimizer',
    'component-tester',
    'storybook-maintainer',
  ],
  parentVpId: ENGINEERING_DISCIPLINE_ID,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// =============================================================================
// Backend Engineering Subdiscipline
// =============================================================================

/**
 * CLAUDE.md configuration for backend engineering.
 * @internal
 */
const BACKEND_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Senior Backend Engineer',
  context: `You are a backend specialist focused on building scalable, secure, and reliable server-side
applications and APIs. You work with Node.js, TypeScript, and various databases. Your services
must handle high traffic, maintain data integrity, and provide comprehensive monitoring.
You follow microservices architecture and event-driven design patterns.`,
  rules: [
    'Design RESTful APIs following OpenAPI/Swagger standards',
    'Implement proper authentication and authorization',
    'Use database transactions for data integrity',
    'Implement comprehensive input validation and sanitization',
    'Follow the principle of least privilege for data access',
    'Write idempotent API endpoints where appropriate',
    'Implement proper rate limiting and throttling',
    'Use structured logging with correlation IDs',
    'Design for horizontal scalability',
    'Implement circuit breakers for external dependencies',
    'Use database migrations for schema changes',
    'Document all API endpoints with OpenAPI specs',
  ],
  objectives: [
    'Maintain 99.9% API availability SLA',
    'Keep average response time under 200ms',
    'Ensure zero data loss in failure scenarios',
    'Build secure APIs passing OWASP security audits',
    'Maintain comprehensive API documentation',
    'Implement efficient database query patterns',
  ],
  constraints: [
    'No N+1 query patterns in database operations',
    'No unencrypted sensitive data in transit or at rest',
    'No API endpoints without authentication',
    'No direct database access bypassing ORM/query builder',
    'No synchronous operations for long-running tasks',
    'No hardcoded configuration values',
    'No API changes without version management',
    'No deployment without health check endpoints',
  ],
};

/**
 * Backend Engineering subdiscipline pack.
 *
 * @description
 * Specialized discipline for backend/API development with focus on
 * Node.js, databases, security, and scalable architecture. Includes
 * database tools and backend-specific monitoring.
 *
 * @example
 * ```typescript
 * import { BACKEND_ENGINEERING_DISCIPLINE } from '@wundr/org-genesis';
 *
 * // Access backend MCP servers
 * const hasPostgres = BACKEND_ENGINEERING_DISCIPLINE.mcpServers
 *   .some(s => s.name === 'postgres-mcp');
 * // true
 * ```
 */
export const BACKEND_ENGINEERING_DISCIPLINE: DisciplinePack = {
  id: BACKEND_ENGINEERING_DISCIPLINE_ID,
  name: 'Backend Engineering',
  slug: 'engineering-backend',
  category: 'engineering',
  description:
    'Backend engineering discipline focused on building secure, scalable, and reliable APIs and server-side applications.',
  claudeMd: BACKEND_CLAUDE_MD,
  mcpServers: [
    GIT_MCP_SERVER,
    FILESYSTEM_MCP_SERVER,
    GITHUB_MCP_SERVER,
    MEMORY_MCP_SERVER,
    POSTGRES_MCP_SERVER,
    SEQUENTIAL_THINKING_MCP_SERVER,
  ],
  hooks: [
    PRE_COMMIT_LINT_HOOK,
    PRE_COMMIT_TYPECHECK_HOOK,
    {
      event: 'PreCommit',
      command: 'npm run test:integration',
      description: 'Run integration tests before committing',
      blocking: true,
    },
    {
      event: 'PreToolUse',
      command: 'npm run db:validate 2>/dev/null || true',
      description: 'Validate database schema before migrations',
      blocking: false,
    },
    PRE_TOOL_SECURITY_HOOK,
    {
      event: 'PostToolUse',
      command: 'npm run openapi:generate 2>/dev/null || true',
      description: 'Regenerate OpenAPI specs after API changes',
      blocking: false,
    },
  ],
  agentIds: [
    'api-developer',
    'database-specialist',
    'security-engineer',
    'integration-tester',
    'performance-tuner',
    'api-documenter',
  ],
  parentVpId: ENGINEERING_DISCIPLINE_ID,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// =============================================================================
// DevOps Engineering Subdiscipline
// =============================================================================

/**
 * CLAUDE.md configuration for DevOps engineering.
 * @internal
 */
const DEVOPS_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Senior DevOps Engineer',
  context: `You are a DevOps specialist focused on building and maintaining reliable infrastructure,
CI/CD pipelines, and operational excellence. You work with containerization, orchestration,
and cloud platforms. Your infrastructure must be reproducible, scalable, and secure.
You follow Infrastructure as Code (IaC) principles and GitOps workflows.`,
  rules: [
    'Define all infrastructure as code using Terraform or Pulumi',
    'Implement comprehensive CI/CD pipelines with proper stages',
    'Use container orchestration for application deployment',
    'Implement proper secrets management with rotation',
    'Design for disaster recovery and business continuity',
    'Implement comprehensive monitoring and alerting',
    'Use GitOps for deployment workflows',
    'Follow the principle of immutable infrastructure',
    'Implement proper backup and restore procedures',
    'Use blue-green or canary deployment strategies',
    'Maintain comprehensive runbooks for incident response',
    'Implement cost optimization and resource tagging',
  ],
  objectives: [
    'Achieve 99.99% infrastructure uptime',
    'Reduce deployment time to under 10 minutes',
    'Implement zero-downtime deployments',
    'Maintain infrastructure cost within budget',
    'Achieve sub-5-minute incident detection',
    'Automate 90% of operational tasks',
  ],
  constraints: [
    'No manual infrastructure changes in production',
    'No deployment without rollback capability',
    'No secrets in version control',
    'No single points of failure in architecture',
    'No unmonitored services in production',
    'No infrastructure changes without peer review',
    'No production access without audit logging',
    'No cloud resources without proper tagging',
  ],
};

/**
 * DevOps Engineering subdiscipline pack.
 *
 * @description
 * Specialized discipline for DevOps/infrastructure with focus on
 * CI/CD, containerization, cloud platforms, and operational excellence.
 * Includes Docker, Kubernetes, and cloud provider tools.
 *
 * @example
 * ```typescript
 * import { DEVOPS_ENGINEERING_DISCIPLINE } from '@wundr/org-genesis';
 *
 * // Check DevOps hooks
 * const preCommitHooks = DEVOPS_ENGINEERING_DISCIPLINE.hooks
 *   .filter(h => h.event === 'PreCommit');
 * ```
 */
export const DEVOPS_ENGINEERING_DISCIPLINE: DisciplinePack = {
  id: DEVOPS_ENGINEERING_DISCIPLINE_ID,
  name: 'DevOps Engineering',
  slug: 'engineering-devops',
  category: 'engineering',
  description:
    'DevOps engineering discipline focused on infrastructure automation, CI/CD pipelines, and operational excellence.',
  claudeMd: DEVOPS_CLAUDE_MD,
  mcpServers: [
    GIT_MCP_SERVER,
    FILESYSTEM_MCP_SERVER,
    GITHUB_MCP_SERVER,
    MEMORY_MCP_SERVER,
    DOCKER_MCP_SERVER,
    KUBERNETES_MCP_SERVER,
    AWS_MCP_SERVER,
  ],
  hooks: [
    {
      event: 'PreCommit',
      command: 'terraform fmt -check && terraform validate',
      description: 'Validate Terraform configuration before committing',
      blocking: true,
    },
    {
      event: 'PreCommit',
      command: 'docker-compose config --quiet',
      description: 'Validate Docker Compose configuration',
      blocking: true,
    },
    {
      event: 'PreToolUse',
      command: 'tfsec . 2>/dev/null || true',
      description: 'Run Terraform security scan before changes',
      blocking: false,
    },
    {
      event: 'PostToolUse',
      command: 'terraform plan -out=tfplan 2>/dev/null || true',
      description: 'Generate Terraform plan after infrastructure changes',
      blocking: false,
    },
    {
      event: 'PreCommit',
      command: 'npm run security:scan',
      description: 'Run security vulnerability scan',
      blocking: true,
    },
    POST_COMMIT_NOTIFY_HOOK,
  ],
  agentIds: [
    'infrastructure-engineer',
    'ci-cd-specialist',
    'container-orchestrator',
    'cloud-architect',
    'sre-engineer',
    'security-ops',
  ],
  parentVpId: ENGINEERING_DISCIPLINE_ID,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// =============================================================================
// QA Engineering Subdiscipline
// =============================================================================

/**
 * CLAUDE.md configuration for QA engineering.
 * @internal
 */
const QA_CLAUDE_MD: ClaudeMdConfig = {
  role: 'Senior QA Engineer',
  context: `You are a QA specialist focused on ensuring software quality through comprehensive testing
strategies. You work with automated testing frameworks, test management tools, and quality
metrics. Your testing must cover functional, non-functional, and edge case scenarios.
You follow shift-left testing principles and integrate quality into the development process.`,
  rules: [
    'Write automated tests for all critical user journeys',
    'Implement comprehensive test coverage metrics',
    'Design tests following the testing pyramid principle',
    'Use data-driven testing for comprehensive coverage',
    'Implement proper test isolation and cleanup',
    'Document test cases with clear preconditions and expected results',
    'Use page object model for UI test maintainability',
    'Implement performance and load testing for critical paths',
    'Create comprehensive regression test suites',
    'Use exploratory testing for edge case discovery',
    'Implement API contract testing between services',
    'Track and analyze quality metrics and trends',
  ],
  objectives: [
    'Achieve 80%+ code coverage for critical paths',
    'Reduce production defect escape rate to under 5%',
    'Maintain automated test suite execution under 30 minutes',
    'Achieve 95%+ automated test reliability',
    'Document and maintain comprehensive test plans',
    'Implement continuous testing in CI/CD pipeline',
  ],
  constraints: [
    'No manual testing for regression scenarios',
    'No flaky tests in the main test suite',
    'No test data pollution between test runs',
    'No production deployment without passing tests',
    'No test code without proper documentation',
    'No hardcoded test data that could expire',
    'No tests that depend on external services without mocks',
    'No testing without proper reporting and metrics',
  ],
};

/**
 * QA Engineering subdiscipline pack.
 *
 * @description
 * Specialized discipline for quality assurance with focus on
 * automated testing, test management, and quality metrics.
 * Includes browser testing and E2E automation tools.
 *
 * @example
 * ```typescript
 * import { QA_ENGINEERING_DISCIPLINE } from '@wundr/org-genesis';
 *
 * // Get QA agent IDs
 * const qaAgents = QA_ENGINEERING_DISCIPLINE.agentIds;
 * // ['test-automation-engineer', 'performance-tester', ...]
 * ```
 */
export const QA_ENGINEERING_DISCIPLINE: DisciplinePack = {
  id: QA_ENGINEERING_DISCIPLINE_ID,
  name: 'QA Engineering',
  slug: 'engineering-qa',
  category: 'engineering',
  description:
    'QA engineering discipline focused on comprehensive testing strategies, test automation, and quality metrics.',
  claudeMd: QA_CLAUDE_MD,
  mcpServers: [
    GIT_MCP_SERVER,
    FILESYSTEM_MCP_SERVER,
    GITHUB_MCP_SERVER,
    MEMORY_MCP_SERVER,
    BROWSER_TOOLS_MCP_SERVER,
    PUPPETEER_MCP_SERVER,
    POSTGRES_MCP_SERVER,
  ],
  hooks: [
    {
      event: 'PreCommit',
      command: 'npm run test:unit -- --bail',
      description: 'Run unit tests with fast-fail before committing',
      blocking: true,
    },
    {
      event: 'PreCommit',
      command: 'npm run test:lint:tests',
      description: 'Lint test files for quality standards',
      blocking: true,
    },
    {
      event: 'PreToolUse',
      command: 'npm run test:coverage:check 2>/dev/null || true',
      description: 'Check test coverage before file modifications',
      blocking: false,
    },
    {
      event: 'PostToolUse',
      command: 'npm run test:affected 2>/dev/null || true',
      description: 'Run affected tests after code changes',
      blocking: false,
    },
    {
      event: 'PostCommit',
      command: 'npm run test:report:generate',
      description: 'Generate test report after commit',
      blocking: false,
    },
  ],
  agentIds: [
    'test-automation-engineer',
    'performance-tester',
    'api-tester',
    'e2e-specialist',
    'test-data-manager',
    'quality-analyst',
  ],
  parentVpId: ENGINEERING_DISCIPLINE_ID,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// =============================================================================
// Collection Exports
// =============================================================================

/**
 * All engineering discipline templates.
 *
 * @description
 * Array containing the base engineering discipline and all specialized subdisciplines.
 * Useful for iterating over all engineering-related configurations.
 *
 * @example
 * ```typescript
 * import { ALL_ENGINEERING_DISCIPLINES } from '@wundr/org-genesis';
 *
 * // List all engineering discipline names
 * const names = ALL_ENGINEERING_DISCIPLINES.map(d => d.name);
 * // ['Software Engineering', 'Frontend Engineering', 'Backend Engineering', ...]
 * ```
 */
export const ALL_ENGINEERING_DISCIPLINES: readonly DisciplinePack[] = [
  ENGINEERING_DISCIPLINE,
  FRONTEND_ENGINEERING_DISCIPLINE,
  BACKEND_ENGINEERING_DISCIPLINE,
  DEVOPS_ENGINEERING_DISCIPLINE,
  QA_ENGINEERING_DISCIPLINE,
] as const;

/**
 * Engineering subdisciplines only (excludes base discipline).
 *
 * @description
 * Array containing only the specialized subdisciplines, excluding the base
 * engineering discipline. Useful when you need to iterate over specific
 * engineering specializations.
 *
 * @example
 * ```typescript
 * import { ENGINEERING_SUBDISCIPLINES } from '@wundr/org-genesis';
 *
 * // Find subdiscipline by slug
 * const frontend = ENGINEERING_SUBDISCIPLINES
 *   .find(d => d.slug === 'engineering-frontend');
 * ```
 */
export const ENGINEERING_SUBDISCIPLINES: readonly DisciplinePack[] = [
  FRONTEND_ENGINEERING_DISCIPLINE,
  BACKEND_ENGINEERING_DISCIPLINE,
  DEVOPS_ENGINEERING_DISCIPLINE,
  QA_ENGINEERING_DISCIPLINE,
] as const;

/**
 * Map of engineering discipline IDs to their configurations.
 *
 * @description
 * A lookup map for quick access to engineering disciplines by their ID.
 * Useful for retrieving specific discipline configurations without iteration.
 *
 * @example
 * ```typescript
 * import { ENGINEERING_DISCIPLINES_BY_ID } from '@wundr/org-genesis';
 *
 * const devops = ENGINEERING_DISCIPLINES_BY_ID.get('discipline-engineering-devops');
 * ```
 */
export const ENGINEERING_DISCIPLINES_BY_ID: ReadonlyMap<
  string,
  DisciplinePack
> = new Map(ALL_ENGINEERING_DISCIPLINES.map(d => [d.id, d]));

/**
 * Map of engineering discipline slugs to their configurations.
 *
 * @description
 * A lookup map for quick access to engineering disciplines by their slug.
 * Useful for URL-based lookups and API routing.
 *
 * @example
 * ```typescript
 * import { ENGINEERING_DISCIPLINES_BY_SLUG } from '@wundr/org-genesis';
 *
 * const backend = ENGINEERING_DISCIPLINES_BY_SLUG.get('engineering-backend');
 * ```
 */
export const ENGINEERING_DISCIPLINES_BY_SLUG: ReadonlyMap<
  string,
  DisciplinePack
> = new Map(ALL_ENGINEERING_DISCIPLINES.map(d => [d.slug, d]));
