import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
        'getting-started/first-project',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/analysis',
        'concepts/refactoring',
        'concepts/monorepo',
        'concepts/patterns',
        'concepts/quality-metrics',
      ],
    },
    {
      type: 'category',
      label: 'CLI Commands',
      items: [
        'cli/overview',
        'cli/analyze',
        'cli/refactor',
        'cli/report',
        'cli/migrate',
        'cli/config',
      ],
    },
    {
      type: 'category',
      label: 'Web Dashboard',
      items: [
        'dashboard/overview',
        'dashboard/analysis-views',
        'dashboard/reports',
        'dashboard/batch-operations',
        'dashboard/visualizations',
      ],
    },
    {
      type: 'category',
      label: 'Integration',
      items: [
        'integration/mcp-tools',
        'integration/claude-flow',
        'integration/ci-cd',
        'integration/github',
        'integration/vscode',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/custom-patterns',
        'advanced/plugin-development',
        'advanced/performance-tuning',
        'advanced/enterprise-deployment',
      ],
    },
    {
      type: 'category',
      label: 'Migration Guides',
      items: [
        'migration/from-v1',
        'migration/from-other-tools',
        'migration/breaking-changes',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/performance',
        'troubleshooting/debugging',
        'troubleshooting/faq',
      ],
    },
  ],
};

export default sidebars;