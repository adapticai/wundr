import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebarGuides: SidebarsConfig = {
  guidesSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Quick Start Guides',
      items: [
        'quickstart/new-project',
        'quickstart/existing-project',
        'quickstart/monorepo-setup',
        'quickstart/team-onboarding',
      ],
    },
    {
      type: 'category',
      label: 'Workflow Guides',
      items: [
        'workflow/daily-usage',
        'workflow/weekly-maintenance',
        'workflow/code-review',
        'workflow/release-preparation',
      ],
    },
    {
      type: 'category',
      label: 'Best Practices',
      items: [
        'best-practices/coding-standards',
        'best-practices/pattern-enforcement',
        'best-practices/quality-gates',
        'best-practices/team-collaboration',
      ],
    },
    {
      type: 'category',
      label: 'Integration Guides',
      items: [
        'integration/ci-cd-setup',
        'integration/github-actions',
        'integration/vscode-setup',
        'integration/slack-notifications',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Usage',
      items: [
        'advanced/custom-analyzers',
        'advanced/pattern-development',
        'advanced/performance-optimization',
        'advanced/large-scale-deployment',
      ],
    },
    {
      type: 'category',
      label: 'Video Tutorials',
      items: [
        'videos/getting-started',
        'videos/dashboard-walkthrough',
        'videos/advanced-features',
        'videos/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/react-project',
        'examples/nodejs-backend',
        'examples/monorepo-migration',
        'examples/enterprise-setup',
      ],
    },
  ],
};

export default sidebarGuides;