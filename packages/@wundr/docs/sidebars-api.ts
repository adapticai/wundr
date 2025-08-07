import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebarApi: SidebarsConfig = {
  apiSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Analysis API',
      items: [
        'analysis/overview',
        'analysis/scan',
        'analysis/entities',
        'analysis/dependencies',
        'analysis/duplicates',
        'analysis/circular',
      ],
    },
    {
      type: 'category',
      label: 'Reports API',
      items: [
        'reports/overview',
        'reports/generate',
        'reports/export',
        'reports/templates',
      ],
    },
    {
      type: 'category',
      label: 'Configuration API',
      items: [
        'config/overview',
        'config/load',
        'config/save',
        'config/validation',
      ],
    },
    {
      type: 'category',
      label: 'Batch Operations',
      items: [
        'batches/overview',
        'batches/create',
        'batches/status',
        'batches/results',
      ],
    },
    {
      type: 'category',
      label: 'File Operations',
      items: [
        'files/overview',
        'files/list',
        'files/read',
        'files/write',
      ],
    },
    {
      type: 'category',
      label: 'Git Integration',
      items: [
        'git/overview',
        'git/status',
        'git/activity',
        'git/hooks',
      ],
    },
    {
      type: 'category',
      label: 'Scripts API',
      items: [
        'scripts/overview',
        'scripts/execute',
        'scripts/status',
        'scripts/results',
      ],
    },
    {
      type: 'category',
      label: 'WebSocket API',
      items: [
        'websocket/overview',
        'websocket/events',
        'websocket/subscriptions',
      ],
    },
  ],
};

export default sidebarApi;