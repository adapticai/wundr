import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebarApi: SidebarsConfig = {
  apiSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Analysis',
      items: ['analysis/overview'],
    },
    {
      type: 'category', 
      label: 'Batch Processing',
      items: ['batches/overview'],
    },
    {
      type: 'category',
      label: 'Configuration', 
      items: ['config/overview'],
    },
    {
      type: 'category',
      label: 'Files',
      items: ['files/overview'],
    },
    {
      type: 'category',
      label: 'Reports',
      items: ['reports/overview'],
    },
  ],
};

export default sidebarApi;