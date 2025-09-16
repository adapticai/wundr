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
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/overview',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/patterns',
        'configuration/analysis',
        'configuration/reporting',
      ],
    },
    {
      type: 'category',
      label: 'CLI Commands',
      items: [
        'cli/commands',
      ],
    },
    {
      type: 'category',
      label: 'Web Dashboard',
      items: [
        'web-dashboard/overview',
        'web-dashboard/setup',
        'web-dashboard/analysis',
        'web-dashboard/team',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/ci-cd',
        'integrations/github-actions',
        'integrations/jenkins',
        'integrations/thresholds',
      ],
    },
    {
      type: 'category',
      label: 'Team Collaboration',
      items: [
        'team/collaboration',
        'team/quality-gates',
        'team/metrics',
      ],
    },
    {
      type: 'category',
      label: 'Migration Guides',
      items: [
        'migration/from-other-tools',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
      ],
    },
    'faq',
    'i18n-workflow',
  ],
};

export default sidebars;