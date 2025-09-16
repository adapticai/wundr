import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebarGuides: SidebarsConfig = {
  guidesSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Quick Start',
      items: [
        'quickstart/new-project',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Guides',
      items: [
        'advanced/performance-optimization',
        'advanced/pattern-development',
        'advanced/scaling',
      ],
    },
    {
      type: 'category',
      label: 'Hands-on Exercises',
      items: [
        'exercises/video-workshop',
      ],
    },
    {
      type: 'category',
      label: 'Video Tutorials',
      items: [
        'videos/getting-started',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/faq',
      ],
    },
  ],
};

export default sidebarGuides;