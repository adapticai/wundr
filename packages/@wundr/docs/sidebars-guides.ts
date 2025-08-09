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
      label: 'Videos',
      items: [
        'videos/getting-started',
      ],
    },
  ],
};

export default sidebarGuides;